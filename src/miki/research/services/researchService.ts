import { autonomousSearchService } from './autonomousSearchService';
import { knowledgeGapService, KnowledgeGap } from '../../unknown/services/knowledgeGapService';
import { evidenceService, EvidenceRecord } from '../../memory/services/evidenceService';
import { verifierService, VerificationResult } from '../../verification/services/verifierService';
import { researchStrategyService, ResearchRoute } from './researchStrategyService';
import { cognitiveEvidenceIntegrationService } from '../../selfAwareness/services/cognitiveEvidenceIntegrationService';
import { mikiUnifiedLearningContinuumService } from '../../learning/services/mikiUnifiedLearningContinuumService';

export type { ResearchRoute };

export type ResearchOutcomeState =
  | 'EVIDENCE_FOUND'
  | 'NO_RESULT'
  | 'INSUFFICIENT_SEARCH'
  | 'SOURCE_UNAVAILABLE'
  | 'NOT_FOUND_AFTER_COVERAGE'
  | 'CONFIRMED_ABSENCE';

export interface ResearchResult {
  gapId: string;
  route: ResearchRoute;
  performed: boolean;
  evidence: EvidenceRecord[];
  claimIds: string[];
  resolved: boolean;
  reason: string;
  outcome: ResearchOutcomeState;
  summary?: string;
  verification?: VerificationResult[];
  roundsCompleted?: number;
  continuationAvailable?: boolean;
  continuationReason?: string;
  nextQuery?: string;
  researchQuery?: string;
  continuationRound?: number;
}

/**
 * Evidence acquisition only.
 *
 * Invariants:
 * - Search output is Evidence first.
 * - Synthetic/offline fallback is rejected by EvidenceService.
 * - Evidence-derived Claims remain UNVERIFIED.
 * - Search alone never resolves a Knowledge Gap.
 * - Only a later explicit verifier may promote Claims or resolve the Gap.
 */
export class ResearchService {
  private static instance: ResearchService;

  private constructor() {}

  public static getInstance(): ResearchService {
    if (!ResearchService.instance) {
      ResearchService.instance = new ResearchService();
    }
    return ResearchService.instance;
  }

  public async researchGap(gap: KnowledgeGap, options?: {
    forceRoute?: ResearchRoute;
    requireFresh?: boolean;
    maxAgeDays?: number;
    maxPasses?: number;
    adaptive?: boolean;
    maxPagesPerPass?: number;
    query?: string;
    continuationRound?: number;
  }): Promise<ResearchResult> {
    const evidence: EvidenceRecord[] = [];
    const claimIds: string[] = [];

    knowledgeGapService.buildResolutionPlan(gap);
    knowledgeGapService.advanceResolutionPlan(gap.id, 'COLLECT_EVIDENCE', 'RESEARCH');
    knowledgeGapService.markResearching(gap.id);
    const startedAt = Date.now();
    const baseQuery = typeof options?.query === 'string' && options.query.trim().length > 0
      ? options.query.trim()
      : gap.query;
    const continuationRound = Number.isFinite(options?.continuationRound)
      ? Math.max(0, Math.floor(options!.continuationRound!))
      : 0;
    /*
     * P0: 固定3回を最終仕様にしない。
     * 1回の呼び出しには安全な実行上限を置くが、adaptive=trueなら
     * COREが同じKnowledge Gapを次のcycleで再投入できる。
     * これにより「無限HTTP」ではなく、状態を持った論理的に無制限な探索になる。
     */
    const adaptive = options?.adaptive !== false;
    const requestedPasses = Number.isFinite(options?.maxPasses)
      ? Math.max(1, Math.floor(options!.maxPasses!))
      : 2;
    const invocationPassLimit = adaptive
      ? Math.max(requestedPasses, 4)
      : Math.min(3, requestedPasses);
    const maxPagesPerPass = Math.max(1, Math.min(3, options?.maxPagesPerPass ?? 2));
    const strategy = options?.forceRoute
      ? { route: options.forceRoute, reason: '呼び出し元が明示的にこの研究経路を要求しました。', alternatives: [] as ResearchRoute[] }
      : researchStrategyService.chooseRoute(gap.type, gap.query);

    try {
      if (strategy.route === 'LOCAL_CLAIM') {
        researchStrategyService.recordOutcome(gap.type, strategy.route, false, Date.now() - startedAt);
        return {
          gapId: gap.id,
          route: 'LOCAL_CLAIM',
          performed: false,
          evidence,
          claimIds,
          resolved: false,
          reason: `Local Claim経路を選択しましたが、現在のResearchServiceにはローカルClaimから検証する安全な入口がないため保留しました。 ${strategy.reason}`,
          outcome: 'INSUFFICIENT_SEARCH',
        };
      }

      // 自動検索判定がfalseでも、Knowledge Gapとして明示的に登録された調査は、
      // StrategyがWEB_SEARCHを選択した場合に限り実行する。
      const need = autonomousSearchService.detectNeedForSearch(gap.query);
      if (!need.needsSearch && strategy.route !== 'WEB_SEARCH') {
        researchStrategyService.recordOutcome(gap.type, strategy.route, false, Date.now() - startedAt);
        return {
          gapId: gap.id,
          route: strategy.route,
          performed: false,
          evidence,
          claimIds,
          resolved: false,
          reason: `Research Strategy=${strategy.route}。安全な実行入口がないため外部調査は行いませんでした。`,
          outcome: 'SOURCE_UNAVAILABLE',
        };
      }

      let summary: string | undefined;
      let verification: VerificationResult[] = [];
      let resolved = false;
      let continuationAvailable = false;
      let continuationReason = '';
      let nextQuery = gap.query;
      let roundsCompleted = 0;
      let previousEvidenceFingerprint = '';

      const buildAdaptiveQuery = (round: number, results: VerificationResult[]): string => {
        if (round === 0) return baseQuery;
        const reasons = results.flatMap(result => Array.isArray(result.reasons) ? result.reasons : [])
          .map(String)
          .filter(Boolean);
        const focus = reasons.length > 0
          ? [...new Set(reasons)].slice(0, 4).join(' / ')
          : 'independent evidence / official documentation / counterevidence / compatibility';
        return `${baseQuery} / adaptive research round ${continuationRound + round + 1} / ${focus}`;
      };

      for (let pass = 0; pass < invocationPassLimit; pass++) {
        roundsCompleted = pass + 1;
        const passQuery = buildAdaptiveQuery(pass, verification);
        nextQuery = passQuery;
        const raw = await autonomousSearchService.executeSearch(passQuery, {
          bypassCache: pass > 0,
        });
        const results = this.normalizeSearchResults(raw);
        if (typeof (raw as any)?.summary === 'string') summary = (raw as any).summary;

        // Search is only the discovery step. Read the selected result pages before
        // building the final evidence/claim set, so SearXNG -> page content -> Evidence
        // is one Research pipeline rather than two disconnected services.
        const readResults = await autonomousSearchService.readSearchResultPages(passQuery, results, {
          maxPages: maxPagesPerPass,
        });

        for (const page of readResults) {
          if (!page.success || !page.text.trim()) continue;
          const itemSource = String(page.result.source || '').toLowerCase();
          const sourceProvider = itemSource.includes('searxng')
            ? 'searxng'
            : itemSource.includes('wikipedia')
              ? 'wikipedia'
              : itemSource.includes('duckduckgo')
                ? 'duckduckgo'
                : 'headless_webview';
          const content = page.text.trim().slice(0, 12000);
          const pageEvidence = evidenceService.recordWebEvidence({
            title: `${page.result.title} [本文読取]`,
            snippet: content,
            source: sourceProvider,
            url: page.url,
            publishedDate: page.result.publishedDate,
            sourceId: page.result.sourceId,
            independenceClusterId: page.result.independenceClusterId,
            metadata: {
              fetch_method: 'headless_webview',
              observed_at: Date.now(),
              environment: 'MIKI-AI0.2 research page reader',
              result_summary: `検索結果URLを実際に読み取り、本文${page.text.length}文字を取得`,
            },
          });
          evidence.push(pageEvidence);

          if (pageEvidence.status === 'REJECTED') continue;
          // The page itself is evidence; keep the claim conservative by using the
          // original search snippet when available rather than treating the whole page as one fact.
          const pageClaimStatement = (page.result.claimText || page.result.snippet || content.slice(0, 1000)).trim();
          const normalizedPageStatement = this.normalizeClaimStatement(pageClaimStatement);
          if (!pageClaimStatement) continue;
          let pageClaimId = evidenceService.registerUnverifiedClaim(pageEvidence.evidence_id, pageClaimStatement);
          if (pageClaimId && !claimIds.includes(pageClaimId)) claimIds.push(pageClaimId);
          if (!pageClaimId && normalizedPageStatement) {
            // Claim linkage is intentionally deferred to the normal search-evidence pass below.
          }
        }

        let canonicalClaimId: string | undefined;
        let canonicalStatement = '';

        for (const result of results) {
        const record = evidenceService.recordWebEvidence({
          title: result.title,
          snippet: result.snippet,
          source: result.source,
          url: result.url,
          publishedDate: result.publishedDate,
          sourceId: result.sourceId,
          independenceClusterId: result.independenceClusterId,
        });

        evidence.push(record);

        // Rejected synthetic/offline results can never become Claims.
        if (record.status === 'REJECTED') continue;

        const statement = (result.claimText || result.snippet).trim();
        const normalizedStatement = this.normalizeClaimStatement(statement);

        // Conservative grouping: only evidence with the same normalized statement
        // is attached to one Claim. Different wording creates a separate Claim,
        // so the verifier never assumes semantic agreement from mere co-occurrence.
        let claimId: string | undefined;
        if (canonicalClaimId && normalizedStatement === canonicalStatement) {
          if (evidenceService.attachEvidenceToClaim(record.evidence_id, canonicalClaimId)) {
            claimId = canonicalClaimId;
          }
        } else {
          claimId = evidenceService.registerUnverifiedClaim(record.evidence_id, statement);
          if (claimId && !canonicalClaimId) {
            canonicalClaimId = claimId;
            canonicalStatement = normalizedStatement;
          }
        }

        if (claimId && !claimIds.includes(claimId)) claimIds.push(claimId);
      }

        // Search is only acquisition. The explicit verifier is the boundary that
        // may promote a Claim or resolve a Knowledge Gap. A second independent
        // pass is allowed when the first pass is insufficient; it still cannot
        // resolve the gap without the same verifier boundary.
        knowledgeGapService.advanceResolutionPlan(gap.id, 'VERIFY', 'RESEARCH');
        verification = claimIds.length > 0
          ? verifierService.verifyMany({
              claimIds,
              requireFresh: options?.requireFresh,
              maxAgeDays: options?.maxAgeDays,
              resolveGapId: gap.id,
            })
          : [];
        resolved = verification.some((result) => result.promoted);
        // Verified or otherwise admissible claims are mirrored into the Knowledge OS.
        // This is a structural sync only; it never promotes an unverified claim.
        cognitiveEvidenceIntegrationService.ingestClaims(claimIds);
        if (resolved) {
          knowledgeGapService.advanceResolutionPlan(gap.id, 'RESOLVE', 'RESEARCH');
          continuationAvailable = false;
          continuationReason = 'VERIFIED';
          break;
        }

        const evidenceFingerprint = [...new Set(evidence.map(item => `${item.source_id}|${item.independence_cluster_id}|${item.url}`))]
          .sort()
          .join('||');
        const noNewEvidence = evidenceFingerprint !== '' && evidenceFingerprint === previousEvidenceFingerprint;
        previousEvidenceFingerprint = evidenceFingerprint;

        if (adaptive && noNewEvidence) {
          continuationAvailable = false;
          continuationReason = 'NO_NEW_EVIDENCE';
          knowledgeGapService.advanceResolutionPlan(gap.id, 'IDENTIFY', 'CLARIFY');
          break;
        }

        continuationAvailable = adaptive && pass + 1 >= invocationPassLimit;
        continuationReason = continuationAvailable
          ? 'NEXT_CORE_CYCLE_REQUIRED'
          : 'INSUFFICIENT_VERIFICATION';

        if (!adaptive) break;
      }

      mikiUnifiedLearningContinuumService.observe({
        domain: 'research',
        key: `knowledge-gap:${gap.id}`,
        action: 'adaptive_research_round',
        input: baseQuery,
        outcome: resolved ? 'SUCCESS' : 'FAILURE',
        verified: resolved,
        concepts: [gap.type, continuationReason || 'INSUFFICIENT_VERIFICATION'],
        lesson: resolved
          ? 'Research evidence was independently verified and promoted.'
          : continuationAvailable
            ? 'Research requires another CORE cycle with a new evidence query.'
            : continuationReason || 'Research stopped without sufficient verification.'
      });
      const observedEvidenceCount = evidence.filter(item => item.status !== 'REJECTED').length;
      const hasAnyResults = observedEvidenceCount > 0 || claimIds.length > 0;
      const outcome: ResearchOutcomeState = resolved
        ? 'EVIDENCE_FOUND'
        : hasAnyResults
          ? (continuationAvailable ? 'INSUFFICIENT_SEARCH' : 'NOT_FOUND_AFTER_COVERAGE')
          : (roundsCompleted > 0 ? 'NO_RESULT' : 'SOURCE_UNAVAILABLE');

      researchStrategyService.recordOutcome(gap.type, 'WEB_SEARCH', resolved, Date.now() - startedAt);
      return {
        gapId: gap.id,
        route: 'WEB_SEARCH',
        performed: evidence.some((e) => e.status !== 'REJECTED'),
        evidence,
        claimIds,
        resolved,
        outcome,
        verification,
        summary,
        roundsCompleted,
        continuationAvailable,
        continuationReason,
        nextQuery,
        researchQuery: baseQuery,
        continuationRound,
        reason: resolved
          ? 'Web調査で得たEvidenceを独立性・矛盾条件で検証し、少なくとも1件のClaimをSUPPORTED/DEVICE_VERIFIEDへ昇格しました。'
          : continuationAvailable
            ? `現在のResearch実行枠では未解決です。COREは次cycleで同じKnowledge Gapを再評価し、次の探索ラウンドを継続できます。`
            : `Researchを${roundsCompleted}ラウンド実行しましたが、独立検証条件を満たさないためKnowledge Gapは未解決です。`,
      };
    } catch (error) {
      mikiUnifiedLearningContinuumService.observe({
        domain: 'research',
        key: `knowledge-gap:${gap.id}`,
        action: 'adaptive_research_error',
        input: baseQuery,
        outcome: 'FAILURE',
        verified: false,
        concepts: [gap.type, 'RESEARCH_ERROR'],
        lesson: error instanceof Error ? error.message : 'unknown research error'
      });
      researchStrategyService.recordOutcome(gap.type, strategy.route, false, Date.now() - startedAt);
      knowledgeGapService.markBlocked(
        gap.id,
        error instanceof Error ? error.message : 'unknown research error'
      );

      return {
        gapId: gap.id,
        route: 'WEB_SEARCH',
        performed: false,
        evidence,
        claimIds,
        resolved: false,
        outcome: evidence.length > 0 ? 'INSUFFICIENT_SEARCH' : 'SOURCE_UNAVAILABLE',
        researchQuery: baseQuery,
        continuationRound,
        reason: '調査中にエラーが発生したため、Knowledge GapをBLOCKEDにしました。',
      };
    }
  }

  private normalizeClaimStatement(text: string): string {
    return text
      .toLowerCase()
      .replace(/[\s\u3000]+/g, ' ')
      .replace(/[「」『』“”"'、。！？!?]/g, '')
      .trim();
  }

  private normalizeSearchResults(raw: unknown): Array<{
    title: string;
    snippet: string;
    source: string;
    url?: string;
    publishedDate?: string;
    sourceId?: string;
    independenceClusterId?: string;
    claimText?: string;
  }> {
    // autonomousSearchService currently returns { results, summary, provider }.
    // Accepting an array too keeps this adapter tolerant of older callers.
    const items = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as any)?.results)
        ? (raw as any).results
        : [];

    return items
      .map((item: any) => ({
        title: String(item?.title || item?.name || 'Untitled result'),
        snippet: String(item?.snippet || item?.description || item?.text || ''),
        source: String(item?.source || item?.domain || 'unknown'),
        url: typeof item?.url === 'string' ? item.url : undefined,
        publishedDate:
          typeof item?.publishedDate === 'string' ? item.publishedDate : undefined,
        sourceId: typeof item?.sourceId === 'string' ? item.sourceId : undefined,
        independenceClusterId:
          typeof item?.independenceClusterId === 'string'
            ? item.independenceClusterId
            : undefined,
        claimText: typeof item?.claimText === 'string' ? item.claimText : undefined,
      }))
      .filter((item: { snippet: string }) => item.snippet.trim().length > 0);
  }
}

export const researchService = ResearchService.getInstance();
