import { unifiedWebResearchService } from './unifiedWebResearchService';
import type { SearchLane } from './unifiedWebResearchService';
import { knowledgeGapService, KnowledgeGap } from '../../unknown/services/knowledgeGapService';
import { evidenceService, EvidenceRecord } from '../../memory/services/evidenceService';
import { researchStrategyService, ResearchRoute } from './researchStrategyService';
import { cognitiveEvidenceIntegrationService } from '../../selfAwareness/services/cognitiveEvidenceIntegrationService';
import { mikiUnifiedLearningContinuumService } from '../../learning/services/mikiUnifiedLearningContinuumService';
import { webTermLearningService } from './webTermLearningService';
import { webContentUnderstandingService } from './webContentUnderstandingService';
import { wordAssociationGraphService } from '../../memory/services/wordAssociationGraphService';
import { systemLogger } from '../../../services/systemLogger';
import { sourcePageGraphService } from './sourcePageGraphService';
import { contentTermsFromTokens } from './japaneseAnalysisService';
import { japaneseAnalysisCompositionService } from '../../conversation/services/japaneseAnalysisCompositionService';
import { researchQueryPlanningService } from './researchQueryPlanningService';
import type { GapFocusMaterialInput, ResearchQueryExclusion, IndependentEvidenceFocus } from './researchQueryPlanningService';
import { storageService } from '../../../services/storageService';
import { collectionSourceRegistryService } from '../../core/services/collectionSourceRegistryService';
import type { VerificationResult } from '../../verification/services/verifierService';
import { researchQueryOutcomeLearningService } from './researchQueryOutcomeLearningService';
import { webResearchPolicyService, WebResearchProgress } from './webResearchPolicyService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import {
  WebMaterialPatternExtractor,
  type WebImplementationMaterial,
} from './webMaterialPatternExtractor';
import {
  githubCodeMaterialService,
  type CodeMaterialCollectionContext,
} from '../../core/services/githubCodeMaterialService';
import { stackExchangeMaterialService } from '../../core/services/stackExchangeMaterialService';

// P439: 不足スロット向け研究で試した戦略の記録。ギャップごとに3戦略まで。
const GAP_FOCUS_STRATEGY_LEDGER_KEY='miki_gap_focus_strategy_attempts_v1';

// P440 D5: 勉強の測定値の置き場所（verifierService・
// reusableComponentFactoryService・domainIntegrationBootstrapService と
// 同じキー・同じ形）。ここでは読むだけ（書くのは各測定点）。
const STUDY_MEASUREMENT_KEY = 'miki_study_measurement_v1';
function readStudyMeasurement(): Record<string, number> {
  try {
    const raw = storageService.getItem(STUDY_MEASUREMENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export type { ResearchRoute };

export type ResearchOutcomeState =
  | 'EVIDENCE_FOUND'
  | 'NO_RESULT'
  | 'INSUFFICIENT_SEARCH'
  | 'INSUFFICIENT_VERIFICATION'
  | 'SOURCE_UNAVAILABLE'
  | 'NOT_FOUND_AFTER_COVERAGE'
  | 'CONFIRMED_ABSENCE';

export interface ResearchSearchResult { title:string; snippet:string; source:string; url?:string; publishedDate?:string; sourceId?:string; independenceClusterId?:string; claimText?:string; }

export interface ResearchResult {
  gapId: string;
  results: ResearchSearchResult[];
  route: ResearchRoute;
  performed: boolean;
  evidence: EvidenceRecord[];
  claimIds: string[];
  resolved: boolean;
  reason: string;
  outcome: ResearchOutcomeState;
  summary?: string;
  verification?: VerificationResult[];
  semanticVerification?: VerificationResult[];
  roundsCompleted?: number;
  continuationAvailable?: boolean;
  continuationReason?: string;
  nextQuery?: string;
  researchQuery?: string;
  continuationRound?: number;
  routes?: ResearchRoute[];
  localClaimIds?: string[];
  learnedTermComponentClaims?: Array<{ componentId: string; claimId: string }>;
  learnedSemanticComponentClaims?: Array<{ componentId: string; claimId: string; unitId: string }>;
}

/**
 * Research orchestration and Evidence acquisition.
 *
 * Invariants:
 * - Search output is Evidence first.
 * - Synthetic/offline fallback is rejected by EvidenceService.
 * - Evidence-derived Claims remain UNVERIFIED.
 * - Search alone never resolves a Knowledge Gap.
 * - Only a later explicit verifier may promote Claims or resolve the Gap.
 */
export function assessResearchSourceRole(query: { intentType?: string; sourceTierTarget?: string; siteOrDomainConstraints?: string[] }, page: { url: string }): "PRIMARY"|"OFFICIAL"|"SECONDARY"|"COUNTEREVIDENCE"|"UNCLASSIFIED" {
  if (query.intentType === "COUNTEREVIDENCE") return "COUNTEREVIDENCE";
  const host = (() => { try { return new URL(page.url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } })();
  const constraints = (query.siteOrDomainConstraints || []).map(v => v.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]).filter(Boolean);
  if (host && constraints.some(domain => host === domain || host.endsWith("." + domain))) return "OFFICIAL";
  // P387: public-sector and academic issuers are authoritative for
  // their own publications even when the query named no explicit
  // site. Until now such pages stayed UNCLASSIFIED, so the primary /
  // official source requirements of the research policy could
  // almost never be satisfied by what was actually gathered.
  if (host && (host.endsWith(".go.jp") || host.endsWith(".lg.jp") || host.endsWith(".ac.jp") || host.endsWith(".gov") || host.endsWith(".edu"))) return "OFFICIAL";
  return "UNCLASSIFIED";
}

/**
 * P387: page reading is the expensive, deep step and only a few
 * pages are read per pass. Read authoritative (official / primary)
 * pages first instead of whatever the search order happened to
 * return; the remaining results still contribute snippet evidence.
 */
export function orderResultsForReading<T extends { url?: string }>(results: T[], query: { intentType?: string; sourceTierTarget?: string; siteOrDomainConstraints?: string[] }): T[] {
  const rank = (item: T): number => {
    const role = assessResearchSourceRole(query, { url: item.url || "" });
    return role === "OFFICIAL" || role === "PRIMARY" ? 0 : 1;
  };
  return [...results].sort((a, b) => rank(a) - rank(b));
}

export class ResearchService {
  private static instance: ResearchService;

  private constructor() {}

  public static getInstance(): ResearchService {
    if (!ResearchService.instance) {
      ResearchService.instance = new ResearchService();
    }
    return ResearchService.instance;
  }

  public async executeSearch(query: string, options?: { maxResults?: number; sourceRequestId?: string; lane?: SearchLane; gapFocus?: GapFocusMaterialInput }): Promise<ResearchResult> {
    const text = query.trim();
    if (!text) throw new Error("RESEARCH_QUERY_REQUIRED");
    const gap = knowledgeGapService.detect({ query: text, type: "INSUFFICIENT_EVIDENCE", reason: "通常のWeb知識探索要求をResearchServiceへ統合", priority: 50, sourceRequestId: options?.sourceRequestId });
    return this.researchGap(gap, { forceRoute: "WEB_SEARCH", query: text, maxPagesPerPass: Math.max(1, Math.min(3, options?.maxResults || 2)), lane: options?.lane, ...(options?.gapFocus ? { gapFocus: options.gapFocus } : {}) });
  }

  /*
   * P439: 不足スロット向けの研究の再試行で、試した戦略を記録して
   * ローテーションする。戦略は GitHub コード検索 → Stack Exchange →
   * Web 文書の順。ギャップごとに3戦略までで、超えたら材料探索クエリ
   * は足さない（同じ調査の繰り返しにしないための歯止め。教師供給への
   * 導線は既存の供給要求のまま）。記録の読み書きに失敗しても研究自体
   * は続ける（初回は未試行として扱い、書き込み失敗は無視する）。
   */
  private resolveGapFocusStrategy(gapFocus: GapFocusMaterialInput | undefined): GapFocusMaterialInput | undefined {
    if (!gapFocus) return undefined;
    const slotNames = (Array.isArray(gapFocus.slotNames) ? gapFocus.slotNames : []).map((value) => String(value || '').trim()).filter(Boolean).slice(0, 3);
    const targetPaths = (Array.isArray(gapFocus.targetPaths) ? gapFocus.targetPaths : []).map((value) => String(value || '').trim()).filter(Boolean).slice(0, 3);
    if (slotNames.length === 0 && targetPaths.length === 0) return undefined;
    const strategies: Array<GapFocusMaterialInput['strategy']> = ['GITHUB_CODE', 'STACK_EXCHANGE', 'WEB_DOCS'];
    const gapKey = `${slotNames.join(',')}@${targetPaths.join(',')}`.slice(0, 200);
    const ledger = this.readGapFocusStrategyLedger();
    const entry = ledger[gapKey];
    const tried = entry && Array.isArray(entry.strategies)
      ? entry.strategies.filter((value): value is string => typeof value === 'string')
      : [];
    const next = strategies.find((strategy) => !tried.includes(strategy));
    if (!next) return undefined;
    ledger[gapKey] = { strategies: [...tried, next], updatedAt: Date.now() };
    try {
      storageService.setItem(GAP_FOCUS_STRATEGY_LEDGER_KEY, JSON.stringify(ledger));
    } catch {
      // 記録に失敗しても研究自体は続ける。
    }
    return {
      slotNames,
      targetPaths,
      strategy: next,
      ...(typeof gapFocus.gapReason === 'string' && gapFocus.gapReason.trim() ? { gapReason: gapFocus.gapReason.trim() } : {}),
      ...(typeof gapFocus.nextStep === 'string' && gapFocus.nextStep.trim() ? { nextStep: gapFocus.nextStep.trim() } : {}),
    };
  }

  private readGapFocusStrategyLedger(): Record<string, { strategies: string[]; updatedAt: number }> {
    try {
      const raw = storageService.getItem(GAP_FOCUS_STRATEGY_LEDGER_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, { strategies: string[]; updatedAt: number }>
        : {};
    } catch {
      return {};
    }
  }

  /*
   * P440 D6: 既存の証拠から除外条件を作る。既読 URL と既存クラスタの
   * ホスト（cluster_web_<host> と URL のホスト）を除外対象にする。
   * 除外しすぎて結果が0件になるリスクがあるため、ホストは最大3件、
   * URL は最大10件に限定する。除外後に0件なら除外を緩める
   * フォールバックは入れず、ログで様子を見る。
   */
  private buildSourceExclusion(claimIds: string[]): ResearchQueryExclusion {
    const hosts = new Set<string>();
    const urls = new Set<string>();
    for (const claimId of claimIds) {
      for (const record of evidenceService.list({ claimId })) {
        if (record.status === 'REJECTED') continue;
        if (record.url) {
          urls.add(record.url);
          try {
            const host = new URL(record.url).hostname.toLowerCase().replace(/^www\./, '');
            if (host) hosts.add(host);
          } catch { /* URL が壊れていても除外は止めない */ }
        }
        const cluster = record.independence_cluster_id || '';
        if (cluster.startsWith('cluster_web_')) {
          const webHost = cluster.slice('cluster_web_'.length).toLowerCase();
          if (webHost && webHost !== 'unknown') hosts.add(webHost);
        }
      }
    }
    return { excludedHosts: [...hosts].slice(0, 3), excludedUrls: [...urls].slice(0, 10) };
  }

  /*
   * P440 D6/1-B: UNRESOLVED の主張のうち独立クラスタが2未満のものを
   * 独立出典の追加探索の対象にする。試行回数は既存の改訂上限
   * （maxRevisionPerQuery: 2）に合わせ、上限に達したら探索しない。
   * SearXNG の冷却や検索回数の上限には、既存の検索ペーサーと
   * 冷却中の省略をそのまま使う（ここでは追加の検索はしない）。
   */
  private buildIndependentEvidenceFocus(claimIds: string[], baseQuery: string): IndependentEvidenceFocus | undefined {
    const short: string[] = [];
    let needed = 0;
    for (const claimId of claimIds) {
      const claim = claimDatabaseService.getClaim(claimId);
      if (!claim || claim.status !== 'UNRESOLVED') continue;
      const evidenceIds = evidenceService.list({ claimId })
        .filter(record => record.status !== 'REJECTED')
        .map(record => record.evidence_id);
      const clusters = evidenceService.getIndependentClusterCount(evidenceIds);
      if (clusters < 2) {
        short.push(claimId);
        needed = Math.max(needed, 2 - clusters);
      }
    }
    if (short.length === 0) return undefined;
    const attempts = this.countIndependentEvidenceAttempts(baseQuery);
    const maxAttempts = researchQueryPlanningService.getPolicy().maxRevisionPerQuery;
    if (attempts >= maxAttempts) {
      systemLogger.info('SELF_IMPROVEMENT', `[Research] independent evidence search skipped: attempts=${attempts} >= maxRevisionPerQuery=${maxAttempts}`);
      return undefined;
    }
    return { claimIds: short, neededClusters: needed };
  }

  // P440 D6: 同一の研究意図に対する独立証拠クエリの試行回数を数える。
  // queryText に 'independent source evidence' を含む成果記録を数える。
  private countIndependentEvidenceAttempts(baseQuery: string): number {
    const normalized = baseQuery.normalize('NFKC').replace(/\s+/g, ' ').trim();
    let count = 0;
    for (const plan of researchQueryPlanningService.listPlans()) {
      if (plan.canonicalResearchIntent !== normalized) continue;
      for (const outcome of researchQueryOutcomeLearningService.list(plan.queryPlanId)) {
        if (outcome.queryText.includes('independent source evidence')) count++;
      }
    }
    return count;
  }

  // P440 D6: 検索結果が除外条件に当たるかどうか（既読 URL または
  // 既存クラスタのホスト）。URL が無い結果は除外しない。
  private isExcludedSearchResult(result: { url?: string }, exclusion: ResearchQueryExclusion): boolean {
    if (!result.url) return false;
    if (exclusion.excludedUrls.includes(result.url)) return true;
    try {
      const host = new URL(result.url).hostname.toLowerCase().replace(/^www\./, '');
      return exclusion.excludedHosts.includes(host);
    } catch {
      return false;
    }
  }

  /**
   * 自律コード改善が必要とする実装材料をResearch正規経路から収集する。
   *
   * Candidate/Unknown側からUnifiedWebResearchServiceを直接呼ばない。
   * Search -> page read -> implementation material extractionをResearch側へ集約し、
   * Candidate側は結果だけを利用する。
   */
  public async collectImplementationMaterials(
    query: string,
    options?: {
      maxResults?: number;
      maxPages?: number;
      // P422/P423: shaping context for the dedicated material
      // channels (GitHub code search, Stack Exchange). Target paths
      // and, when the caller has it, the P421 gap contract. Web
      // collection does not use it.
      codeMaterialContext?: CodeMaterialCollectionContext;
    },
  ): Promise<WebImplementationMaterial[]> {
    const text = query.trim();
    if (!text) return [];

    const maxResults = Math.max(1, Math.min(6, options?.maxResults ?? 4));
    const maxPages = Math.max(1, Math.min(4, options?.maxPages ?? 3));

    // P422: the GitHub code-search channel runs in parallel with the
    // web path below -- code material comes from a code-specialized
    // source, shaped by the gap contract / dictionary gloss bridge,
    // under its own rate gate. It never holds the web path up: both
    // start together and the (usually slower) channel is awaited only
    // at the end. With no PAT configured it resolves immediately as
    // SKIPPED and the web result is exactly what it was before.
    const githubPromise = githubCodeMaterialService
      .collectMaterials(text, options?.codeMaterialContext)
      .catch(() => null);

    // P423: the Stack Exchange channel runs in parallel too, as the
    // third material source. It supplies know-how reference material
    // (how-to explanation and pitfalls, reference-only: no copyable
    // code examples) under its own daily-quota ledger. It never
    // holds the web path up either, and when disabled it resolves
    // immediately as SKIPPED.
    const stackExchangePromise = stackExchangeMaterialService
      .collectMaterials(text, options?.codeMaterialContext)
      .catch(() => null);

    const materials: WebImplementationMaterial[] = [];

    const raw = await unifiedWebResearchService.executePlannedSearch(text);
    const results = this.normalizeSearchResults(raw).slice(0, maxResults);

    if (results.length > 0) {
      const pages = await unifiedWebResearchService.readSearchResultPages(
        text,
        results,
        { maxPages },
      );

      for (const page of pages) {
        if (!page.success || !page.text.trim()) continue;

        const source = String(page.result.source || '').toLowerCase();
        const provider =
          source.includes('searxng') ? 'searxng' :
          source.includes('wikipedia') ? 'wikipedia' :
          source.includes('duckduckgo') ? 'duckduckgo' :
          'headless_webview';

        materials.push(
          ...WebMaterialPatternExtractor.extractImplementationMaterialsFromWebText({
            text: page.text,
            sourceQuery: text,
            sourceUrl: page.url,
            provider,
            fetchMethod: 'headless_webview',
          }),
        );
      }
    }

    const githubOutcome = await githubPromise;
    if (githubOutcome && githubOutcome.materials.length > 0) {
      // Web materials keep priority: generation consumes materials in
      // order, so the researched web examples are offered first and
      // the code-search examples widen the pool behind them.
      materials.push(...githubOutcome.materials);
    }

    const stackExchangeOutcome = await stackExchangePromise;
    if (stackExchangeOutcome && stackExchangeOutcome.materials.length > 0) {
      // Merge order is Web -> GitHub -> Stack Exchange: real working
      // code first, know-how reference last (P423).
      materials.push(...stackExchangeOutcome.materials);
    }

    return materials;
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
    // P418: SearXNG gate lane, threaded to every search pass below.
    lane?: SearchLane;
    // P439: 候補生成の不足記録から来た研究の焦点（不足スロット名・対象
    // ファイル）。ある場合はスロット向けの材料探索クエリを1本足す。
    gapFocus?: GapFocusMaterialInput;
  }): Promise<ResearchResult> {
    const evidence: EvidenceRecord[] = [];
    const claimIds: string[] = [];
    const requiredResearchClaimIds: string[] = [];
    const learnedTermComponentIds: string[] = [];
    const learnedTermComponentClaims: Array<{ componentId: string; claimId: string }> = [];
    const learnedSemanticComponentClaims: Array<{ componentId: string; claimId: string; unitId: string }> = [];
    // P440 D5: この調査ランでの学習進捗の集計（診断ログ用）。
    const termLearningTotals = { terms: 0, glossed: 0, dupes: 0, needsGloss: 0 };
    const claimIdByNormalizedStatement = new Map<string, string>();
    const reusablePriorClaimStatuses = new Set(['UNVERIFIED', 'SUPPORTED']);

    for (const existingClaim of claimDatabaseService.listClaims({
      world: 'REAL',
      kind: 'FACT_CLAIM',
      excludeSuperseded: true,
    })) {
      const normalized = this.normalizeClaimStatement(existingClaim.statement);

      if (
        existingClaim.source !== 'web_search' ||
        normalized.length < 15 ||
        !reusablePriorClaimStatuses.has(String(existingClaim.status)) ||
        Object.keys(existingClaim.scope || {}).length !== 0 ||
        claimDatabaseService.getBeliefStatus(existingClaim.claim_id) !== 'ACTIVE'
      ) {
        continue;
      }

      if (!claimIdByNormalizedStatement.has(normalized)) {
        claimIdByNormalizedStatement.set(normalized, existingClaim.claim_id);
      }
    }
    const searchResults: ResearchSearchResult[] = [];

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
    // P440 D6: 既存クラスタ・既読 URL の除外条件と、独立証拠の追加探索
    // の対象を計画に渡す。除外はホスト・URL ともに件数を限定する。
    const sourceExclusion = this.buildSourceExclusion(gap.researchClaimIds || []);
    const independentFocus = this.buildIndependentEvidenceFocus(gap.researchClaimIds || [], baseQuery);
    const queryPlan = researchQueryPlanningService.buildPlan(baseQuery, gap.researchClaimIds || [], this.resolveGapFocusStrategy(options?.gapFocus), sourceExclusion, independentFocus);
    const invocationPassLimit = Math.min(
      queryPlan.policy.maxTotalSearchRequests,
      queryPlan.policy.maxQueriesPerPlan,
      adaptive ? Math.max(requestedPasses, queryPlan.queries.length) : Math.min(3, requestedPasses),
    );
    const maxPagesPerPass = Math.max(1, Math.min(3, options?.maxPagesPerPass ?? 2));
    // P440 D6: 試行済み戦略を避けて経路を選ぶ（ローテーション）。
    // 強制経路の場合は記録しない。
    const strategy = options?.forceRoute
      ? { route: options.forceRoute, reason: '呼び出し元が明示的にこの研究経路を要求しました。', alternatives: [] as ResearchRoute[] }
      : researchStrategyService.chooseRoute(gap.type, gap.query, undefined, researchStrategyService.triedGapRoutes(gap.id));
    if (!options?.forceRoute) researchStrategyService.recordGapRouteAttempt(gap.id, strategy.route);

    // P360: 収集レシートを発行し、この調査ランで記録するEvidenceへIDを載せる（収集台帳への最小接続）
    const collectionReceipt = collectionSourceRegistryService.record({
      taskId: gap.id,
      sourceType: 'WEB_RESEARCH',
      sourceRecordIds: queryPlan.status === "READY" ? queryPlan.queries.map((q) => q.queryId) : [],
      collectedArtifactKind: 'CLAIM',
      canonicalSha256: queryPlan.status === "READY" ? queryPlan.queryPlanId : gap.id,
      verificationStatus: 'RETRIEVED',
      storedByDomain: 'research',
      coreDecisionId: gap.id,
    });

    try {
      /*
       * LOCAL is a real Research strand.
       *
       * Important: LOCAL does not replace WEB.
       * Existing claims are collected as local evidence first, then WEB
       * research continues so freshness / official source / counterevidence
       * can be compared against the local knowledge.
       */
      const localClaimIds: string[] = [];
      const localMatch = claimDatabaseService.findBestMatchingClaim(baseQuery);

      if (localMatch.hasMatch) {
        const localClaims = [
          ...(localMatch.supportingClaims || []),
          ...(localMatch.contradictingClaims || []),
        ];

        const seenLocalClaims = new Set<string>();

        for (const claim of localClaims) {
          if (seenLocalClaims.has(claim.claim_id)) continue;
          seenLocalClaims.add(claim.claim_id);

          const localEvidence = evidenceService.recordLocalClaimEvidence({
            title: `LOCAL Claim [${claim.status}]`,
            statement: claim.statement,
            sourceId: claim.claim_id,
            independenceClusterId: claim.independence_cluster_id,
            metadata: {
              environment: 'MIKI-AI0.2 local claim database',
              observed_at: Date.now(),
              result_summary: `LOCAL Claim DBからResearch queryへの既存知識照合: ${localMatch.confidence}`,
            },
          });

          evidence.push(localEvidence);

          if (!localClaimIds.includes(claim.claim_id)) {
            localClaimIds.push(claim.claim_id);
          }

          if (evidenceService.attachEvidenceToClaim(
            localEvidence.evidence_id,
            claim.claim_id,
          )) {
            if (!claimIds.includes(claim.claim_id)) {
              claimIds.push(claim.claim_id);
            }
          }
        }

        if (localClaims.length > 0) {
          researchStrategyService.recordOutcome(
            gap.type,
            'LOCAL_CLAIM',
            true,
            Date.now() - startedAt,
          );
        }
      } else {
        researchStrategyService.recordOutcome(
          gap.type,
          'LOCAL_CLAIM',
          false,
          Date.now() - startedAt,
        );
      }

      // P388: statements already modeled in source page graphs are
      // recalled before any new search, so a known source is
      // traversed instead of re-searched from zero. Recalled
      // statements become claims on their original page evidence.
      try {
        const recallTerms = contentTermsFromTokens(japaneseAnalysisCompositionService.analyzeSync(baseQuery).analysis?.tokens ?? []);
        for (const hit of sourcePageGraphService.searchStatements(recallTerms, 4)) {
          if (!hit.graph.evidenceId) continue;
          const recalledClaimId = this.linkResearchEvidenceToClaim(hit.graph.evidenceId, hit.statement.text, claimIdByNormalizedStatement, true);
          if (recalledClaimId && !claimIds.includes(recalledClaimId)) claimIds.push(recalledClaimId);
          if (recalledClaimId && !localClaimIds.includes(recalledClaimId)) localClaimIds.push(recalledClaimId);
        }
      } catch { /* graph recall is an addition, never a blocker */ }

      // LOCALだけで終了しない。
      // LOCAL knowledgeを現在のWeb evidenceで補強・更新・反証する。
      // 自動検索判定がfalseでもKnowledge Gapとして明示的に登録された調査は、
      // StrategyがWEB_SEARCHを選択した場合に限り実行する。
      const need = unifiedWebResearchService.detectNeedForSearch(gap.query);
      if (!need.needsSearch && strategy.route !== 'WEB_SEARCH') {
        const hasLocalEvidence = evidence.some(
          item => item.kind === 'LOCAL_CLAIM' && item.status !== 'REJECTED'
        );

        return {
          gapId: gap.id,
          results: searchResults,
          route: 'LOCAL_CLAIM',
          routes: ['LOCAL_CLAIM'],
          localClaimIds,
          performed: hasLocalEvidence,
          evidence,
          claimIds,
          resolved: false,
          reason: hasLocalEvidence
            ? `LOCAL Claimから既存知識を取得しました。Web検索対象としての必要性は低いため、LOCAL結果をCOREへ返します。`
            : `LOCAL Claimにも該当知識がなく、今回のResearchでは外部検索を実行しませんでした。`,
          outcome: hasLocalEvidence ? 'EVIDENCE_FOUND' : 'SOURCE_UNAVAILABLE',
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
      let previousEvidenceIds: string[] = [];
      let previousIndependentClusters: string[] = [];

      let recommendedRevisionQuery: string | undefined;
      let latestWebResearchProgress: WebResearchProgress | undefined;

      const buildAdaptiveQuery = (round: number, results: VerificationResult[]): string => {
        if (round === 0) return baseQuery;
        if (recommendedRevisionQuery) return recommendedRevisionQuery;
        const reasons = results.flatMap(result => Array.isArray(result.reasons) ? result.reasons : [])
          .map(String)
          .filter(Boolean);
        const focus = reasons.length > 0
          ? [...new Set(reasons)].slice(0, 4).join(' / ')
          : 'independent evidence / official documentation / counterevidence / compatibility';
        const adaptiveQuery = `${baseQuery} / adaptive research round ${continuationRound + round + 1} / ${focus}`;
        // P440 D6: 適応クエリにも既存クラスタのホスト除外を載せる
        // （単語数24の上限を超えない場合のみ）。
        const siteExclusions = sourceExclusion.excludedHosts.slice(0, 2).map(host => `-site:${host}`).join(' ');
        return siteExclusions && `${adaptiveQuery} ${siteExclusions}`.split(/\s+/).filter(Boolean).length <= 24
          ? `${adaptiveQuery} ${siteExclusions}`
          : adaptiveQuery;
      };

      for (let pass = 0; pass < invocationPassLimit; pass++) {
        roundsCompleted = pass + 1;
        const plannedQuery = queryPlan.status === 'READY'
          ? queryPlan.queries[pass]?.queryText
          : undefined;
        const passQuery = plannedQuery || buildAdaptiveQuery(pass, verification);
        nextQuery = passQuery;
        const queryStartedAt = Date.now();
        const raw = await unifiedWebResearchService.executePlannedSearch(passQuery, {
          bypassCache: pass > 0,
          lane: options?.lane,
          // P418: a PRIMARY_OR_OFFICIAL pass is the scholarly /
          // official-source intent reaching the search layer; only
          // then may OpenAlex fire in parallel (budget care).
          officialSourceIntent:
            queryPlan.status === 'READY' &&
            queryPlan.queries[pass]?.sourceTierTarget === 'PRIMARY_OR_OFFICIAL',
        });
        const rawResults = this.normalizeSearchResults(raw);
        // P440 D6: 既読URL・既存クラスタのホストを検索結果から除外する
        // （同じ出典の繰り返しを避ける）。除外しすぎて0件になっても
        // フォールバックはしない（ログで様子を見る）。件数だけログに出す。
        const results = rawResults.filter(result => !this.isExcludedSearchResult(result, sourceExclusion));
        const excludedResultCount = rawResults.length - results.length;
        if (excludedResultCount > 0) {
          systemLogger.info('SELF_IMPROVEMENT', `[Research] excluded ${excludedResultCount} known-source results (hosts=${sourceExclusion.excludedHosts.length}, urls=${sourceExclusion.excludedUrls.length})`);
        }
        searchResults.push(...results);
        if (typeof (raw as any)?.summary === 'string') summary = (raw as any).summary;

        // Search is only the discovery step. Read the selected result pages before
        // building the final evidence/claim set, so SearXNG -> page content -> Evidence
        // is one Research pipeline rather than two disconnected services.
        const readResults = await unifiedWebResearchService.readSearchResultPages(passQuery, orderResultsForReading(results, queryPlan.status === "READY" ? queryPlan.queries[pass] : {}), {
          maxPages: maxPagesPerPass,
        });
        const isCounterEvidencePass =
          queryPlan.status === 'READY' &&
          queryPlan.queries[pass]?.intentType === 'COUNTEREVIDENCE';

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
          // P388: model the whole page (not only its head) as a
          // per-source graph before recording evidence, so claims
          // can come from anywhere in the page and the page stays
          // traversable for later research on the same source.
          const pageGraphBuild = sourcePageGraphService.buildFromPage({
            url: page.url,
            title: page.result.title,
            text: page.text,
            questionTerms: queryPlan.status === "READY" ? (queryPlan.queries[pass]?.termsIncluded || []) : [],
          });
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
              research_query_id: queryPlan.status === "READY" ? queryPlan.queries[pass]?.queryId : undefined,
              research_query_plan_id: queryPlan.status === "READY" ? queryPlan.queryPlanId : undefined,
              collection_receipt_id: collectionReceipt.collectionReceiptId,
              research_source_tier_target: queryPlan.status === "READY" ? queryPlan.queries[pass]?.sourceTierTarget : undefined,
              research_intent_type: queryPlan.status === "READY" ? queryPlan.queries[pass]?.intentType : undefined,
              research_source_role_target: queryPlan.status === "READY" ? ({ COUNTEREVIDENCE: "COUNTEREVIDENCE", PRIMARY_SOURCE: "PRIMARY", OFFICIAL_SPECIFICATION: "OFFICIAL" } as Record<string,'PRIMARY'|'OFFICIAL'|'SECONDARY'|'COUNTEREVIDENCE'|'UNCLASSIFIED'>)[queryPlan.queries[pass]?.intentType || ""] || "UNCLASSIFIED" : "UNCLASSIFIED",
              research_source_role: queryPlan.status === "READY" ? assessResearchSourceRole(queryPlan.queries[pass], { url: page.url }) : "UNCLASSIFIED",
              research_source_provider: String(page.result.source || ""),
              research_source_engine: String((page.result as any).engine || ""),
              research_source_author: String((page.result as any).author || ""),
              research_source_category: String((page.result as any).category || ""),
              research_source_metadata: String((page.result as any).metadata || ""),
              source_page_graph_id: pageGraphBuild.graph.pageId,
            },
          });
          evidence.push(pageEvidence);

          if (pageEvidence.status === 'REJECTED') continue;

          sourcePageGraphService.attachEvidenceId(pageGraphBuild.graph.pageId, pageEvidence.evidence_id);

          // P388: statements the page makes anywhere in its text
          // (not only inside the head slice) become claims on this
          // page's evidence when they speak to the research question.
          {
            const normalizedFullText = this.normalizeClaimStatement(page.text);
            let graphClaims = 0;
            for (const relevant of pageGraphBuild.relevantStatements) {
              if (graphClaims >= 4) break;
              const normalizedStatement = this.normalizeClaimStatement(relevant.text);
              if (normalizedStatement.length < 15 || !normalizedFullText.includes(normalizedStatement)) continue;
              const graphClaimId = this.linkResearchEvidenceToClaim(pageEvidence.evidence_id, relevant.text, claimIdByNormalizedStatement, !isCounterEvidencePass);
              if (graphClaimId) {
                if (!claimIds.includes(graphClaimId)) claimIds.push(graphClaimId);
                graphClaims += 1;
              }
            }
          }

          // Understand page content independently from the search-result snippet.
          // Every accepted sentence is checked against the fetched page before its
          // own unverified Claim and structured semantic candidate are created.
          if (learnedSemanticComponentClaims.length < 24) {
            const semanticLearning = webContentUnderstandingService.learnPage({
              text: content,
              url: page.url,
              evidenceId: pageEvidence.evidence_id,
              sourceTitle: page.result.title,
              maxUnits: Math.max(0, 24 - learnedSemanticComponentClaims.length),
              registerClaim: (statement) => {
                const normalizedPageStatement = this.normalizeClaimStatement(statement);
                const normalizedPageContent = this.normalizeClaimStatement(content);
                if (
                  normalizedPageStatement.length < 15 ||
                  !normalizedPageContent.includes(normalizedPageStatement)
                ) {
                  return undefined;
                }
                return this.linkResearchEvidenceToClaim(
                  pageEvidence.evidence_id,
                  statement,
                  claimIdByNormalizedStatement,
                  !isCounterEvidencePass,
                );
              },
            });

            for (const semantic of semanticLearning.componentClaims) {
              if (!learnedSemanticComponentClaims.some(
                item => item.componentId === semantic.componentId &&
                  item.claimId === semantic.claimId
              )) {
                learnedSemanticComponentClaims.push(semantic);
              }
            }
          }


          // Page Evidence can support a snippet Claim only when the normalized
          // statement is actually present in the fetched page text.
          const pageClaimStatement = (page.result.claimText || page.result.snippet || content.slice(0, 1000)).trim();
          const normalizedPageStatement = this.normalizeClaimStatement(pageClaimStatement);
          const normalizedPageContent = this.normalizeClaimStatement(content);
          let pageClaimId: string | undefined;

          if (
            normalizedPageStatement.length >= 15 &&
            normalizedPageContent.includes(normalizedPageStatement)
          ) {
            pageClaimId = this.linkResearchEvidenceToClaim(
              pageEvidence.evidence_id,
              pageClaimStatement,
              claimIdByNormalizedStatement,
              !isCounterEvidencePass,
            );
            if (pageClaimId && !claimIds.includes(pageClaimId)) {
              claimIds.push(pageClaimId);
            }
          }

          // Page-derived term knowledge retains Claim lineage. No linked Claim
          // means no term component is presented as research-backed knowledge.
          if (pageClaimId) {
            const termLearning = webTermLearningService.learnPage({
              text: content,
              url: page.url,
              evidenceId: pageEvidence.evidence_id,
              claimIds: [pageClaimId],
              sourceTitle: page.result.title,
            });

            for (const componentId of termLearning.componentIds) {
              if (!learnedTermComponentIds.includes(componentId)) {
                learnedTermComponentIds.push(componentId);
              }
              if (!learnedTermComponentClaims.some(
                item => item.componentId === componentId && item.claimId === pageClaimId
              )) {
                learnedTermComponentClaims.push({ componentId, claimId: pageClaimId });
              }
            }

            // P440 1-C: 同一ページに共起した gloss 付き用語から連想の
            // 辺を生やす。gloss 付きだけを対象にする（意味の裏付けが
            // ある用語同士の共起だけを辺にする）。
            const glossedTerms = termLearning.terms
              .filter((item) => item.gloss)
              .map((item) => item.term);
            if (glossedTerms.length > 1) {
              wordAssociationGraphService.recordCooccurrences(glossedTerms);
            }
            // P440 D5: 学習進捗の集計。
            termLearningTotals.terms += termLearning.terms.length;
            termLearningTotals.glossed += termLearning.glossedCount;
            termLearningTotals.dupes += termLearning.duplicateCount;
            termLearningTotals.needsGloss += termLearning.needsGlossCount;
          }
        }


        for (const result of results) {
        const record = evidenceService.recordWebEvidence({
          title: result.title,
          snippet: result.snippet,
          source: result.source,
          url: result.url,
          publishedDate: result.publishedDate,
          sourceId: result.sourceId,
          independenceClusterId: result.independenceClusterId,
          metadata: {
            research_query_id: queryPlan.status === "READY" ? queryPlan.queries[pass]?.queryId : undefined,
            research_query_plan_id: queryPlan.status === "READY" ? queryPlan.queryPlanId : undefined,
            collection_receipt_id: collectionReceipt.collectionReceiptId,
            research_source_tier_target: queryPlan.status === "READY" ? queryPlan.queries[pass]?.sourceTierTarget : undefined,
            research_source_role_target: queryPlan.status === "READY" && queryPlan.queries[pass]
              ? (({ COUNTEREVIDENCE: "COUNTEREVIDENCE", PRIMARY_SOURCE: "PRIMARY", OFFICIAL_SPECIFICATION: "OFFICIAL" } as Record<string, 'PRIMARY'|'OFFICIAL'|'SECONDARY'|'COUNTEREVIDENCE'|'UNCLASSIFIED'>)[queryPlan.queries[pass].intentType || ""] || "UNCLASSIFIED")
              : "UNCLASSIFIED",
            research_source_role: queryPlan.status === "READY" && queryPlan.queries[pass]
              ? assessResearchSourceRole(queryPlan.queries[pass], { url: result.url || "" })
              : "UNCLASSIFIED",
            research_intent_type: queryPlan.status === "READY" ? queryPlan.queries[pass]?.intentType : undefined,
          },
        });

        evidence.push(record);

        // Rejected synthetic/offline results can never become Claims.
        if (record.status === 'REJECTED') continue;

        const statement = (result.claimText || result.snippet).trim();
        const normalizedStatement = this.normalizeClaimStatement(statement);

        // Only exact normalized statement matches may share a Claim. Explicit
        // counterevidence runs are isolated from positive-source Claim pooling.
        const claimId = this.linkResearchEvidenceToClaim(
          record.evidence_id,
          statement,
          claimIdByNormalizedStatement,
          !isCounterEvidencePass,
        );

        if (claimId && !claimIds.includes(claimId)) claimIds.push(claimId);

      }

        // ResearchはEvidence/Claimの収集までを担当し、VerificationはCORE経由で実行する。
        knowledgeGapService.advanceResolutionPlan(gap.id, 'VERIFY', 'RESEARCH');
        knowledgeGapService.attachResearchClaims(gap.id, claimIds);
        knowledgeGapService.attachResearchRequiredClaims(gap.id, requiredResearchClaimIds);
        verification = [];
        resolved = false;

        if (queryPlan.status === "READY" && queryPlan.queries[pass]) { const passEvidenceIds = [...new Set(evidence.filter(item => item.status !== "REJECTED").map(item => item.evidence_id))]; const passClusters = new Set(evidence.filter(item => item.status !== "REJECTED" && item.independence_cluster_id).map(item => item.independence_cluster_id)); researchQueryOutcomeLearningService.record({ queryPlanId: queryPlan.queryPlanId, queryId: queryPlan.queries[pass].queryId, queryText: queryPlan.queries[pass].queryText, status: passEvidenceIds.length ? "EVIDENCE_GAINED" : results.length ? "LOW_QUALITY_RESULTS" : "NO_RESULTS", candidateUrlCount: results.filter(result => !!result.url).length, renderedPageCount: readResults.filter(page => page.success && !!page.text.trim()).length, admissibleIndependentSourceCount: passClusters.size, primarySourceCount: passEvidenceIds.filter(id => { const item = evidence.find(e => e.evidence_id === id); return item?.status !== "REJECTED" && (item?.metadata?.research_source_role === "PRIMARY" || item?.metadata?.research_source_role === "OFFICIAL"); }).length, sourceTierTarget: queryPlan.queries[pass].sourceTierTarget, counterevidenceChecked: queryPlan.queries[pass].intentType === "COUNTEREVIDENCE", evidenceIds: passEvidenceIds, failureReasons: verification.filter(result => result.outcome === "UNRESOLVED").flatMap(result => result.reasons), environmentApplicability: "CURRENT_ENVIRONMENT", executionTimeMs: Date.now() - queryStartedAt, attempt: pass + 1 }); }

        if (queryPlan.status === "READY" && queryPlan.queries[pass]) {
          const revision = researchQueryOutcomeLearningService.recommendRevision(queryPlan.queryPlanId, queryPlan.queries[pass].queryId);
          if (revision.shouldRevise && revision.revisedQuery) { recommendedRevisionQuery = revision.revisedQuery; nextQuery = revision.revisedQuery; }
        }

        const webResearchPolicy = webResearchPolicyService.get();
        const completedIntentTypes = queryPlan.status === "READY"
          ? queryPlan.queries.slice(0, pass + 1).filter(query => evidence.some(item => item.status !== "REJECTED" && item.metadata?.research_intent_type === query.intentType && !!item.url)).map(query => query.intentType)
          : [];
        const requiredIntentTypes = queryPlan.status === "READY"
          ? queryPlan.queries.filter(query => query.intentType === "BASELINE" || query.intentType === "OFFICIAL_SPECIFICATION" || query.intentType === "CURRENT_ENVIRONMENT" || query.intentType === "COUNTEREVIDENCE" || query.intentType === "PRIMARY_SOURCE").map(query => query.intentType)
          : [];
        const webResearchProgress: WebResearchProgress = {
          acceptedIndependentSourceCount: new Set(evidence.filter(item => item.status !== "REJECTED" && item.independence_cluster_id).map(item => item.independence_cluster_id)).size,
          candidateUrlsChecked: results.filter(result => !!result.url).length,
          renderedPages: readResults.filter(page => page.success && !!page.text.trim()).length,
          // P361: verification is CORE's job and is always empty at this
          // point, so deriving progress from it made both indicators
          // permanently fake (0 / no-conflict). Use real collected data
          // instead: supporting material actually gathered in this run,
          // and contradictions already present in local knowledge.
          supportingSourceCount: evidence.filter(item => item.status !== "REJECTED" && item.metadata?.research_source_role !== "COUNTEREVIDENCE").length,
          counterEvidenceSourceCount: evidence.filter(item => item.status !== "REJECTED" && item.metadata?.research_source_role === "COUNTEREVIDENCE").length,
          primarySourceSatisfied: evidence.some(item => item.status !== "REJECTED" && (item.metadata?.research_source_role === "PRIMARY" || (item.metadata?.research_source_role === "OFFICIAL" && item.metadata?.research_source_tier_target === "PRIMARY_OR_OFFICIAL"))),
          counterEvidenceSearchCompleted: queryPlan.status === "READY" && queryPlan.queries.slice(0, pass + 1).some(query => query.intentType === "COUNTEREVIDENCE" && evidence.some(item => item.status !== "REJECTED" && !!item.url)),
          excludedDuplicateCount: 0,
          rejectedQualityCount: evidence.filter(item => item.status === "REJECTED").length,
          conflictingEvidence: (localMatch.contradictingClaims || []).length > 0,
          requiredIntentTypes: [...new Set(requiredIntentTypes)],
          completedIntentTypes: [...new Set(completedIntentTypes)],
          environmentApplicabilitySatisfied: queryPlan.status !== "READY" || !requiredIntentTypes.includes("CURRENT_ENVIRONMENT") || completedIntentTypes.includes("CURRENT_ENVIRONMENT"),
        };
        latestWebResearchProgress = webResearchProgress;

        const evidenceFingerprint = [...new Set(evidence.map(item => `${item.source_id}|${item.independence_cluster_id}|${item.url}`))]
          .sort()
          .join('||');
        const currentEvidenceIds = [...new Set(
          evidence.filter(item => item.status !== 'REJECTED').map(item => item.evidence_id)
        )];
        const currentIndependentClusters = [...new Set(
          evidence
            .filter(item => item.status !== 'REJECTED' && item.independence_cluster_id)
            .map(item => item.independence_cluster_id as string)
        )];
        const meaningfulness = researchStrategyService.assessMeaningfulness({
          previousEvidenceIds,
          currentEvidenceIds,
          previousIndependentClusters,
          currentIndependentClusters,
          previousCoverage: previousIndependentClusters,
          currentCoverage: currentIndependentClusters,
        });
        const noNewEvidence = evidenceFingerprint !== '' && evidenceFingerprint === previousEvidenceFingerprint;
        previousEvidenceFingerprint = evidenceFingerprint;
        previousEvidenceIds = currentEvidenceIds;
        previousIndependentClusters = currentIndependentClusters;

        const webPolicySatisfied = webResearchPolicy.stopWhenTargetReached && webResearchPolicyService.isSatisfied(webResearchProgress, webResearchPolicy);
        if (webPolicySatisfied && !resolved) {
          continuationAvailable = false;
          continuationReason = "INSUFFICIENT_VERIFICATION";
          break;
        }

        if (adaptive && (noNewEvidence || (!meaningfulness.meaningful && pass > 0))) {
          continuationAvailable = false;
          continuationReason = noNewEvidence ? 'NO_NEW_EVIDENCE' : 'LOW_INFORMATION_GAIN';
          knowledgeGapService.advanceResolutionPlan(gap.id, 'IDENTIFY', 'CLARIFY');
          break;
        }

        continuationAvailable = adaptive && pass + 1 >= invocationPassLimit;
        continuationReason = continuationAvailable
          ? 'NEXT_CORE_CYCLE_REQUIRED'
          : 'INSUFFICIENT_VERIFICATION';

        if (!adaptive) break;
      }

      /*
       * P432: gap自身のclaimへ全web証拠を紐付ける。claimContextが無い
       * 経路では、web証拠がどのclaimにもattachされずADMISSIBLEになら
       * ないため、ゲートの独立証拠確認が永久に通らなかった。gapに紐
       * づくclaim（このrunで生まれたもの／過去ラウンドでgapへattach
       * されたもの）が無ければ、gapの要求文から1件作る。反証
       * （counterevidence）役割の証拠は対象claimの支持にはしない。
       * ゲート自体は緩和しない。
       */
      const gapClaimId = this.ensureGapClaim(gap, claimIds, evidence);
      if (gapClaimId) {
        for (const record of evidence) {
          if (record.kind !== 'WEB' && record.kind !== 'DOCUMENT') continue;
          if (record.status === 'REJECTED') continue;
          if (record.metadata?.research_source_role === 'COUNTEREVIDENCE') continue;
          evidenceService.attachEvidenceToClaim(record.evidence_id, gapClaimId);
        }
        if (!claimIds.includes(gapClaimId)) claimIds.push(gapClaimId);
        knowledgeGapService.attachResearchClaims(gap.id, [gapClaimId]);
      }

      mikiUnifiedLearningContinuumService.observe({
        domain: 'research',
        key: `knowledge-gap:${gap.id}`,
        action: 'adaptive_research_round',
        input: baseQuery,
        outcome: resolved
          ? 'SUCCESS'
          : evidence.some(item => item.status !== 'REJECTED')
            ? 'BLOCKED'
            : 'FAILURE',
        verified: resolved,
        concepts: [gap.type, continuationReason || 'INSUFFICIENT_VERIFICATION'],
        lesson: resolved
          ? 'Research evidence was independently verified and promoted.'
          : evidence.some(item => item.status !== 'REJECTED')
            ? 'Evidence was collected; explicit CORE verification is still required.'
            : continuationAvailable
              ? 'Research requires another CORE cycle with a new evidence query.'
              : continuationReason || 'Research stopped without sufficient verification.'
      });

      if (searchResults.length > 0 || summary) {
        unifiedWebResearchService.learnFromSearch(
          baseQuery,
          searchResults,
          summary,
          {
            triggerType: 'working_agenda',
            sourceRef: `research_gap:${gap.id}`,
            evidenceIds: [...new Set(evidence.filter(item => item.status !== 'REJECTED').map(item => item.evidence_id))],
            claimIds: [...new Set(claimIds)],
            researchGapId: gap.id,
            verificationStatus: resolved ? 'VERIFIED' : 'UNVERIFIED',
          }
        );
      }
      const observedEvidenceCount = evidence.filter(item => item.status !== 'REJECTED').length;
      const hasAnyResults = observedEvidenceCount > 0 || claimIds.length > 0;
      const coverageSatisfied = latestWebResearchProgress
        ? webResearchPolicyService.isSatisfied(latestWebResearchProgress, webResearchPolicyService.get())
        : false;
      const outcome: ResearchOutcomeState = resolved
        ? 'EVIDENCE_FOUND'
        : continuationAvailable
          ? 'INSUFFICIENT_SEARCH'
          : continuationReason === 'INSUFFICIENT_VERIFICATION'
            ? 'INSUFFICIENT_VERIFICATION'
            : continuationReason === 'NO_NEW_EVIDENCE' || continuationReason === 'LOW_INFORMATION_GAIN'
            ? 'INSUFFICIENT_SEARCH'
            : hasAnyResults
              ? (coverageSatisfied ? 'NOT_FOUND_AFTER_COVERAGE' : 'INSUFFICIENT_SEARCH')
              : (roundsCompleted > 0 ? 'NO_RESULT' : 'SOURCE_UNAVAILABLE');

      // P440 D5: 学習進捗の診断ログ1行。固定長サマリ（全文ログ化はしない）。
      // promotions は知識部品の VERIFIED 昇格の累計（測定ストアから読む）。
      if (termLearningTotals.terms > 0) {
        const measurement = readStudyMeasurement();
        systemLogger.info(
          'SELF_IMPROVEMENT',
          `[StudyProgress] terms=${termLearningTotals.terms} glossed=${termLearningTotals.glossed} dupes=${termLearningTotals.dupes} promotions=${measurement.knowledgePromotions ?? 0}`,
        );
      }

      researchStrategyService.recordOutcome(gap.type, 'WEB_SEARCH', evidence.some(item => item.status !== 'REJECTED'), Date.now() - startedAt);
      return {
        gapId: gap.id,
        results: [],
        route: 'WEB_SEARCH',
        routes: ['LOCAL_CLAIM', 'WEB_SEARCH'],
        localClaimIds,
        learnedTermComponentClaims,
        learnedSemanticComponentClaims,
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
        results: [],
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

  /*
   * P432: gapに対応するclaimを返す。無ければgapの要求文から1件作る。
   * 作成には最初のweb証拠を起点にする。要求文が短すぎる場合やweb
   * 証拠が無い場合は作れない。
   */
  private ensureGapClaim(gap: KnowledgeGap, claimIds: string[], evidence: EvidenceRecord[]): string | undefined {
    const existing =
      claimIds[0] ??
      knowledgeGapService.getById(gap.id)?.researchClaimIds?.[0] ??
      knowledgeGapService.getById(gap.id)?.identity?.claimIds?.[0];
    if (existing) return existing;
    const anchor = evidence.find(item => (item.kind === 'WEB' || item.kind === 'DOCUMENT') && item.status !== 'REJECTED');
    if (!anchor) return undefined;
    const statement = gap.query.trim();
    if (statement.length < 15) return undefined;
    return evidenceService.registerUnverifiedClaim(anchor.evidence_id, statement);
  }

  private linkResearchEvidenceToClaim(
    evidenceId: string,
    statement: string,
    claimIdByNormalizedStatement: Map<string, string>,
    reuseExisting = true,
  ): string | undefined {
    const normalized = this.normalizeClaimStatement(statement);
    if (normalized.length < 15) return undefined;

    // Counterevidence remains a separately inspectable Claim; it must not
    // silently join an existing positive-support Claim.
    if (!reuseExisting) {
      return evidenceService.registerUnverifiedClaim(evidenceId, statement);
    }

    const existingClaimId = claimIdByNormalizedStatement.get(normalized);
    if (existingClaimId) {
      return evidenceService.attachEvidenceToClaim(evidenceId, existingClaimId)
        ? existingClaimId
        : undefined;
    }

    const createdClaimId = evidenceService.registerUnverifiedClaim(evidenceId, statement);
    if (createdClaimId) {
      claimIdByNormalizedStatement.set(normalized, createdClaimId);
    }
    return createdClaimId;
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
