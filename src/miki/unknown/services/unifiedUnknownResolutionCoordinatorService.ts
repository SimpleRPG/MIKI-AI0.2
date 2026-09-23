import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { crossDomainCirculationService } from '../../core/services/crossDomainCirculationService';
import { unifiedExperienceImprovementBridgeService } from '../../experience/services/unifiedExperienceImprovementBridgeService';
import { unifiedWebResearchService };
import { researchService } from '../../research/services/researchService';
 from '../../research/services/unifiedWebResearchService';
import { unknownKnowledgeIntegrationService } from './unknownKnowledgeIntegrationService';
import {
  unknownResolutionService,
  type ResolutionRoute,
  type UnknownClassification,
} from './unknownResolutionService';

export interface UnifiedUnknownRequest {
  question: string;
  useSearch: boolean;
  /** 解析Componentが報告した未解決語。キーワード判定に掛からなくても調査根拠にする。 */
  unknownTerms?: string[];
  hasAttachments: boolean;
  confirmRetry?: (message: string) => boolean | Promise<boolean>;
  onProgress?: (message: string, details?: Record<string, unknown>) => void;
}

export interface UnifiedUnknownResult {
  effectiveText: string;
  resolution: ReturnType<typeof unknownResolutionService.open>;
  status: 'REUSED_SUPPORTED' | 'LOCAL_EVIDENCE' | 'RESEARCHED_UNVERIFIED' | 'NO_EVIDENCE' | 'SEARCH_FAILED' | 'USER_STOPPED';
  evidenceCount: number;
  query?: string;
  provider?: string;
  routes: ResolutionRoute[];
}

class UnifiedUnknownResolutionCoordinatorService {
  async resolveForChat(request: UnifiedUnknownRequest): Promise<UnifiedUnknownResult> {
    crossDomainCirculationService.record('conversation', 'unknown', 'UNKNOWN_RESOLUTION_REQUESTED');
    const reused = unknownKnowledgeIntegrationService.findReusable(request.question);
    const resolution = reused?.resolution || unknownResolutionService.open(request.question, 6);
    const routes = this.routes(resolution.classification, request.hasAttachments);
    request.onProgress?.(`未知分類: ${resolution.classification}`, { unknownId: resolution.id, routes });

    if (reused) {
      const text = reused.evidence
        .map((item) => item ? `${item.title}\n${item.snippet}\n${item.url || ''}` : '')
        .filter(Boolean)
        .join('\n\n');
      return {
        effectiveText: `${request.question}\n\n【検証済みの過去調査】\n${text}`,
        resolution,
        status: 'REUSED_SUPPORTED',
        evidenceCount: reused.evidence.length,
        routes,
      };
    }

    let decision: ReturnType<typeof unifiedWebResearchService.detectNeedForSearch> = request.useSearch
      ? unifiedWebResearchService.detectNeedForSearch(request.question)
      : { needsSearch: false };
    const terms = (request.unknownTerms || []).map((term) => String(term).trim()).filter(Boolean);
    if (request.useSearch && !decision.needsSearch && terms.length > 0) {
      const searchConfig = unifiedWebResearchService.getConfig();
      if (searchConfig.enabled && searchConfig.autoSearchInChat) {
        decision = { needsSearch: true, query: terms.join(' '), reason: '解析Componentが未解決語を検出', category: 'factual' };
      }
    }

    if (!decision.needsSearch || !decision.query || !routes.includes('WEB')) {
      unknownResolutionService.attempt(resolution.id, routes[0] || 'SOURCE');
      unifiedExperienceImprovementBridgeService.ingest({
        domain: 'research',
        action: 'unknown_local_first',
        summary: request.question,
        outcome: 'UNKNOWN',
        verified: false,
        concepts: [resolution.classification, ...routes],
        lesson: 'Web検索よりローカル資料・コード・テストを優先した',
      });
      return {
        effectiveText: request.question,
        resolution,
        status: request.hasAttachments ? 'LOCAL_EVIDENCE' : 'NO_EVIDENCE',
        evidenceCount: 0,
        routes,
      };
    }

    const query = decision.query;
    if (!unknownResolutionService.shouldRetryQuery(resolution.id, query)) {
      const retry = request.confirmRetry
        ? await request.confirmRetry(`「${query}」は直近の検索で解決できませんでした。再検索しますか？`)
        : false;
      if (!retry) {
        unknownResolutionService.attempt(resolution.id, 'STOP', undefined, { query, failureReason: 'USER_STOPPED' });
        return { effectiveText: request.question, resolution, status: 'USER_STOPPED', evidenceCount: 0, query, routes };
      }
    }

    request.onProgress?.(`Web調査: ${query}`, { unknownId: resolution.id, route: 'WEB' });
    try {
      const result = await researchService.executeSearch(query, { maxResults: 5 });
      if (!result.results.length) {
        unknownResolutionService.attempt(resolution.id, 'WEB', undefined, {
          query,
          provider: result.provider,
          resultCount: 0,
          failureReason: 'NO_RESULTS',
        });
        const experience = unifiedExperienceImprovementBridgeService.ingest({
          domain: 'research',
          action: 'unknown_search_no_results',
          summary: query,
          outcome: 'BLOCKED',
          verified: false,
          sourceFingerprint: result.provider,
          concepts: [resolution.classification, 'NO_RESULTS'],
          lesson: '検索経路を変更する必要がある',
        });
        const gap = capabilityGapService.recordGap({
          capabilityId: 'CAP-UNKNOWN-RESEARCH',
          description: `未知調査で結果を取得できない: ${query}`,
          gap_type: 'failure',
          impact: 'MEDIUM',
          current_workaround: 'ローカル資料・コード・ユーザー確認へ切り替える',
          candidate_solution: '検索プロバイダーと検索語のフェイルオーバーを改善する',
          source: 'observed',
          experienceId: experience.id,
          samplePrompt: request.question,
        });
        unknownResolutionService.link(resolution.id, { experienceIds: [experience.id], capabilityGapIds: [gap.gap_id] });
        return { effectiveText: request.question, resolution, status: 'NO_EVIDENCE', evidenceCount: 0, query, provider: result.provider, routes };
      }

      const experience = unifiedExperienceImprovementBridgeService.ingest({
        domain: 'research',
        action: 'unknown_search_results',
        summary: query,
        outcome: 'SUCCESS',
        verified: false,
        sourceFingerprint: result.provider,
        concepts: [resolution.classification, 'WEB_RESEARCH'],
        lesson: `${result.results.length}件の未検証候補を取得した`,
      });
      crossDomainCirculationService.record('unknown', 'research', 'WEB_RESEARCH_COMPLETED', result.provider);
      const integrated = unknownKnowledgeIntegrationService.ingestWeb({
        unknownId: resolution.id,
        question: request.question,
        results: result.results,
        experienceId: experience.id,
      });
      unknownResolutionService.attempt(
        resolution.id,
        'WEB',
        `取得${result.results.length}件・Claim検証待ち`,
        { query, provider: result.provider, resultCount: result.results.length, evidenceIds: integrated.evidenceIds },
      );
      const researchText = result.results
        .map((item) => `${item.title}\n${item.snippet}\n${item.url}`)
        .join('\n\n');
      return {
        effectiveText: `${request.question}\n\n【Web調査結果・未検証】\n${researchText}`,
        resolution,
        status: 'RESEARCHED_UNVERIFIED',
        evidenceCount: integrated.evidenceIds.length,
        query,
        provider: result.provider,
        routes,
      };
    } catch (error) {
      unknownResolutionService.attempt(resolution.id, 'WEB', undefined, { query, failureReason: String(error) });
      unifiedExperienceImprovementBridgeService.ingest({
        domain: 'research',
        action: 'unknown_search_failure',
        summary: query,
        outcome: 'FAILURE',
        verified: false,
        concepts: [resolution.classification, 'SEARCH_FAILURE'],
        lesson: String(error),
      });
      return { effectiveText: request.question, resolution, status: 'SEARCH_FAILED', evidenceCount: 0, query, routes };
    }
  }

  private routes(classification: UnknownClassification, hasAttachments: boolean): ResolutionRoute[] {
    const map: Record<UnknownClassification, ResolutionRoute[]> = {
      UNKNOWN_TERM: ['WEB', 'SOURCE', 'TOOL', 'USER'],
      MISSING_FACT: ['WEB', 'SOURCE', 'TOOL', 'USER'],
      STALE_INFORMATION: ['WEB', 'SOURCE', 'TEST', 'USER'],
      CONFLICTING_EVIDENCE: ['SOURCE', 'WEB', 'TEST', 'USER'],
      MISSING_CODE_CONTEXT: ['CODE', 'SOURCE', 'USER'],
      MISSING_CAPABILITY: ['CODE', 'TEST', 'WEB', 'TOOL', 'USER'],
      MISSING_TEST: ['TEST', 'CODE', 'SOURCE', 'USER'],
      AMBIGUOUS_REQUEST: ['SOURCE', 'USER'],
      ENVIRONMENT_BLOCKED: ['SOURCE', 'TEST', 'USER'],
    };
    const routes = [...map[classification]];
    if (hasAttachments) {
      const sourceIndex = routes.indexOf('SOURCE');
      if (sourceIndex > 0) {
        routes.splice(sourceIndex, 1);
        routes.unshift('SOURCE');
      }
    }
    return routes;
  }
}

export const unifiedUnknownResolutionCoordinatorService = new UnifiedUnknownResolutionCoordinatorService();
