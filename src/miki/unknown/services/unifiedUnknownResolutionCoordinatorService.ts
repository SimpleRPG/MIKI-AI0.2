import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { crossDomainCirculationService } from '../../core/services/crossDomainCirculationService';
import { unifiedExperienceImprovementBridgeService } from '../../experience/services/unifiedExperienceImprovementBridgeService';
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
  status: 'REUSED_SUPPORTED' | 'LOCAL_EVIDENCE' | 'RESEARCHED_UNVERIFIED' | 'NO_EVIDENCE' | 'RESEARCH_REQUIRED' | 'SEARCH_FAILED' | 'USER_STOPPED';
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

    request.onProgress?.(`Web調査が必要: ${query}`, { unknownId: resolution.id, route: 'WEB' });
    unknownResolutionService.attempt(resolution.id, 'WEB', `Research実行待ち: ${query}`, { query });
    return {
      effectiveText: request.question,
      resolution,
      status: 'RESEARCH_REQUIRED',
      evidenceCount: 0,
      query,
      researchQuestion: query,
      unresolvedRequirements: [`RESEARCH_REQUIRED:${query}`],
      routes,
    };
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
