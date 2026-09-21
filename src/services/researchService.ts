import { autonomousSearchService } from './autonomousSearchService';
import { knowledgeGapService, KnowledgeGap } from './knowledgeGapService';
import { evidenceService, EvidenceRecord } from './evidenceService';
import { verifierService, VerificationResult } from './verifierService';
import { researchStrategyService } from './researchStrategyService';
import { cognitiveEvidenceIntegrationService } from './cognitiveEvidenceIntegrationService';

export type ResearchRoute =
  | 'LOCAL_CLAIM'
  | 'WEB_SEARCH'
  | 'EXECUTION_TEST'
  | 'CLOUD_AI';

export interface ResearchResult {
  gapId: string;
  route: ResearchRoute;
  performed: boolean;
  evidence: EvidenceRecord[];
  claimIds: string[];
  resolved: boolean;
  reason: string;
  summary?: string;
  verification?: VerificationResult[];
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

  public async researchGap(gap: KnowledgeGap, options?: { forceRoute?: ResearchRoute; requireFresh?: boolean; maxAgeDays?: number; maxPasses?: number }): Promise<ResearchResult> {
    const evidence: EvidenceRecord[] = [];
    const claimIds: string[] = [];

    knowledgeGapService.markResearching(gap.id);
    const startedAt = Date.now();
    const maxPasses = Math.max(1, Math.min(3, options?.maxPasses ?? 2));
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
        };
      }

      let summary: string | undefined;
      let verification: VerificationResult[] = [];
      let resolved = false;

      for (let pass = 0; pass < maxPasses; pass++) {
        const passQuery = pass === 0
          ? gap.query
          : `${gap.query} / second-pass independent verification / official documentation / troubleshooting root cause / compatibility / known failure`;
        const raw = await autonomousSearchService.executeSearch(passQuery, { bypassCache: pass > 0 });
        const results = this.normalizeSearchResults(raw);
        if (typeof (raw as any)?.summary === 'string') summary = (raw as any).summary;

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
        if (resolved) break;
      }

      researchStrategyService.recordOutcome(gap.type, 'WEB_SEARCH', resolved, Date.now() - startedAt);
      return {
        gapId: gap.id,
        route: 'WEB_SEARCH',
        performed: evidence.some((e) => e.status !== 'REJECTED'),
        evidence,
        claimIds,
        resolved,
        verification,
        summary,
        reason: resolved
          ? '複数パスのWeb調査で得たEvidenceを独立性・矛盾条件で検証し、少なくとも1件のClaimをSUPPORTED/DEVICE_VERIFIEDへ昇格しました。'
          : `最大${maxPasses}パスの調査を行いましたが、独立検証条件を満たさないためKnowledge Gapは未解決です。`,
      };
    } catch (error) {
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
