import { unifiedWebResearchService } from './unifiedWebResearchService';
import { linkFollowService } from './linkFollowService';
import { autonomousSearchService } from './autonomousSearchService';
import type { SearchLane } from './unifiedWebResearchService';
import { knowledgeGapService, KnowledgeGap } from '../../unknown/services/knowledgeGapService';
import { evidenceService, EvidenceRecord } from '../../memory/services/evidenceService';
import { researchStrategyService, ResearchRoute } from './researchStrategyService';
import { cognitiveEvidenceIntegrationService } from '../../selfAwareness/services/cognitiveEvidenceIntegrationService';
import { mikiUnifiedLearningContinuumService } from '../../learning/services/mikiUnifiedLearningContinuumService';
import { webTermLearningService } from './webTermLearningService';
import { japaneseDictionaryService } from './japaneseDictionaryService';
import { dictionaryBootstrapService } from './dictionaryBootstrapService';
import { webContentUnderstandingService } from './webContentUnderstandingService';
import { wordAssociationGraphService } from '../../memory/services/wordAssociationGraphService';
import { lexicalRelationService } from '../../memory/services/lexicalRelationService';
import { subjectUnderstandingService } from '../../memory/services/subjectUnderstandingService';
import { systemLogger } from '../../../services/systemLogger';
import { sourcePageGraphService } from './sourcePageGraphService';
import { contentTermsFromTokens } from './japaneseAnalysisService';
import { japaneseAnalysisCompositionService } from '../../conversation/services/japaneseAnalysisCompositionService';
import { researchQueryPlanningService, buildShortResearchQuery, isLongResearchIntent, isBriefOrDiagnosticText, extractHumanSubjectTerms } from './researchQueryPlanningService';
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

// P473: 主張適格性（知識在庫の監査 2026-11-07 の対策）。
// ページの文を Claim 化する前に「知識として持つに値する文か」を見る。
// 出典に実在することと検索語に一致することだけでは、宣伝文・見出し
// 断片・書き手の一人称の体験談まで事実の主張として在庫化してしまう
// （実例: 製品ページの宣伝文が FACT_CLAIM になった）。ここで落とす
// のは Claim 化だけで、Evidence 自体は従来どおり記録される。
const P473_PROMO_TERMS = ['応援し', '激減', '瞬時', 'ゼロで', '徹底的', '叩き出', 'かみ砕', 'あるある', '詰まったら', 'ここへ', '爆速', '禁断', '裏技', 'じゃじゃ馬', 'お任せ'];
export function assessClaimWorthiness(statement: string): { ok: boolean; reason?: string } {
  const text = String(statement || '').trim();
  if (!text) return { ok: false, reason: 'EMPTY' };
  if (/[？?]\s*$/.test(text)) return { ok: false, reason: 'QUESTION_FORM' };
  if (/(私自身|私の経験|僕自身|働き始めた当初)/.test(text)) return { ok: false, reason: 'FIRST_PERSON_ANECDOTE' };
  const promoHits = P473_PROMO_TERMS.filter((term) => text.includes(term)).length;
  if (promoHits >= 2) return { ok: false, reason: 'PROMOTIONAL' };
  if (promoHits >= 1 && /[！!]/.test(text)) return { ok: false, reason: 'PROMOTIONAL' };
  if (/(だよ|だね|じゃん|なんだ|んだよ)[。！!]?\s*$/.test(text)) return { ok: false, reason: 'CASUAL_BLOG_VOICE' };
  // P493: 動機・規範の修辞は事実の文ではない。実例（2026-11-08 の
  // TSConfig 調査）:「noEmitOnError を true にするのは、自分に厳しく
  // あるためだ。」が FACT_CLAIM として登録された。書き手の動機や
  // 心構えは、設定の事実とは分けて扱う。
  if (/(ためだ|ためです|べきだ|べきです|ことが大切|のがコツ|心がけ)[。！!]?\s*$/.test(text)) return { ok: false, reason: 'RHETORIC_NOT_FACT' };
  if (!/[。！？!?」』.]$/.test(text) && text.length < 30) return { ok: false, reason: 'HEADING_FRAGMENT' };
  return { ok: true };
}

// P473: 錨語の抽出で落とす一般語（研究の meta な言葉）。
const P473_ANCHOR_STOP_SEGMENTS = new Set(['研究', '調査', '不足', '必要', '方法', '対象', '情報', '知識', '理解', '説明', '確認', '内容', '場合', '使用', '利用', 'について', 'ため', 'こと', 'もの', 'よう', 'これ', 'それ', '現在', '可能', '関連', '実現', '構築', '重要', '具体', '詳細', '基本', '一般', '全体', '部分', '状態', '形式', '種類', '特徴', '性質', '効果', '影響', '変化']);
const P473_ANCHOR_STOP_LATIN = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'research', 'gap', 'unknown', 'missing']);

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
  // P487: 主題を理解できなかった調査を、意味の学習へつなぐ。内部
  // 情報だけの文（診断ダンプ・内部ID）には学ぶべき人間の主題が
  // 無いので回さない。人間の語が残っている場合は、その語の意味を
  // 学ぶ gap（UNKNOWN_TERM）を立て、意味が分かった後の再調査で
  // 主題を組み直せるようにする。detect は同一クエリを統合する
  // ので、同じ未理解が繰り返されても gap は溜まらない。
  private routeUnunderstoodSubjectToMeaningLearning(gap: KnowledgeGap, baseQuery: string, planUnknownTerms?: string[]): void {
    try {
      // 材料は baseQuery だけでなく、gap の対象・不足内容と、ダンプ内
      // の meaning 値からも取る。組み立て段が主題として読めなかった
      // 場所にこそ、人間の語が残っていることがある（逆に内部IDは
      // 抽出側で落ちるため、内部情報だけの文はここでも空になる）。
      const meaningValues = [...baseQuery.matchAll(/(?:meaning|意味)[:：]?\s+([^\s。]{2,60})/g)]
        .map(m => m[1])
        .join(' ');
      const source = [baseQuery, gap.identity?.target ?? '', gap.identity?.missingContent ?? '', meaningValues].join(' ');
      // P493: 主題理解の段が未知語を特定できている場合は、その語を
      // そのまま使う（抽出の当て推量より段の判定の方が正確）。
      const terms = planUnknownTerms && planUnknownTerms.length > 0
        ? [...new Set(planUnknownTerms)].slice(0, 8)
        : extractHumanSubjectTerms(source);
      if (terms.length === 0) return;
      knowledgeGapService.detect({
        query: `用語の意味を学ぶ: ${terms.slice(0, 3).join(' ')}`,
        reason: `調査の主題を理解できなかったため、検索の前に主題の語の意味を学ぶ。元の問い: ${baseQuery.slice(0, 120)}`,
        type: 'UNKNOWN_TERM',
        target: terms[0],
        priority: Math.max(40, Math.min(90, (gap.priority ?? 50) - 5)),
        sourceRequestId: gap.sourceRequestId,
      });
      systemLogger.info('SELF_IMPROVEMENT', `🧭 [主題理解] 主題の語（${terms.slice(0, 3).join('／')}）の意味を学ぶ gap を立てました`);
    } catch {
      // 意味学習への接続は補助経路。失敗しても調査自体は止めない。
    }
  }

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
      // P484: 対象は「未確定で裏付け不足」の主張。検証器は UNRESOLVED
      // という結果を status に書き戻さない（未確定の主張は UNVERIFIED
      // のまま留まる）ため、status==='UNRESOLVED' だけでは会話改訂を
      // 経た主張しか拾えず、独立裏付け探索の本流が外れていた。
      // 矛盾経路にいる DISPUTED / CONTRADICTED は従来どおり対象外。
      if (!claim || (claim.status !== 'UNRESOLVED' && claim.status !== 'UNVERIFIED')) continue;
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

    // P460: Web チャンネルにも、コード専用チャンネルと同じ文脈から
    // 組み立てた短いクエリを渡す（従来は長い問いがそのまま検索文に
    // なっていた）。材料の出所表記（sourceQuery）は元の問いのまま。
    const webQuery = isLongResearchIntent(text)
      ? buildShortResearchQuery(text, {
          slotNames: (options?.codeMaterialContext?.gapContract?.missingSlots ?? []).map((slot) => slot.slotName),
          targetPaths: options?.codeMaterialContext?.targetPaths,
        }) || text
      : text;
    const raw = await unifiedWebResearchService.executePlannedSearch(webQuery);
    const results = this.normalizeSearchResults(raw).slice(0, maxResults);

    if (results.length > 0) {
      const pages = await unifiedWebResearchService.readSearchResultPages(
        webQuery,
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
    // P473: この研究の錨語。質問・gap の対象・不足内容・焦点スロット
    // から抽出する。派生クエリの語や、取得したページの語彙は含めない
    // （含めると「読んだページの言葉」が錨になって漂流が止まらない）。
    const anchorTerms = this.extractAnchorTerms(
      baseQuery,
      gap.identity?.target || '',
      gap.identity?.missingContent || '',
      (options?.gapFocus?.slotNames || []).join(' '),
      (options?.gapFocus?.targetPaths || []).join(' '),
    );
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
    const queryPlan = researchQueryPlanningService.buildPlan(baseQuery, gap.researchClaimIds || [], this.resolveGapFocusStrategy(options?.gapFocus), sourceExclusion, independentFocus, {
      // P461: 計画に gap の構造（type・対象・不足内容・条件）を渡し、
      // 必要に応じた分解が起きるようにする。
      gapType: gap.type,
      target: gap.identity?.target,
      missingContent: gap.identity?.missingContent,
      conditions: gap.identity?.conditions,
    });
    // P493: この調査パスの主題の分野（主題理解の段が確定できた場合）。
    // 取り込み側の分野照合に使う。
    const subjectField = queryPlan.subject?.field;
    // P494: 意味学習の優先語（この調査の主題で意味が要る語）。
    const priorityTermsForLearning = [...new Set(
      [gap.identity?.target, ...(queryPlan.subject?.unknownTerms ?? [])]
        .map((t) => (t || '').trim())
        .filter(Boolean),
    )];
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
      // P803: リンク巡回の予算（1調査あたり成功3件まで）と既辿り URL。
      let followReadsUsed = 0;
      const followedUrls = new Set<string>();
      let previousIndependentClusters: string[] = [];

      let recommendedRevisionQuery: string | undefined;
      let latestWebResearchProgress: WebResearchProgress | undefined;

      // P460: 計画が BLOCKED のときのフォールバックでも、生の長い
      // baseQuery は飛ばさない。組み立て段で短いクエリに直してから使う。
      // P486: ブリーフ／診断ダンプでは主題を抽出できなければ空のままに
      // する（生文を蘇らせない）。通常の長文では従来どおり切り取り
      // フォールバックが効くため、|| baseQuery は分類済み文に限って外す。
      const adaptiveBase = isBriefOrDiagnosticText(baseQuery)
        ? buildShortResearchQuery(baseQuery, options?.gapFocus)
        : isLongResearchIntent(baseQuery)
          ? buildShortResearchQuery(baseQuery, options?.gapFocus) || baseQuery
          : baseQuery;
      let subjectUnresolved = false;
      const buildAdaptiveQuery = (round: number, results: VerificationResult[]): string => {
        if (round === 0) return adaptiveBase;
        if (recommendedRevisionQuery) return recommendedRevisionQuery;
        const reasons = results.flatMap(result => Array.isArray(result.reasons) ? result.reasons : [])
          .map(String)
          .filter(Boolean);
        const focus = reasons.length > 0
          ? [...new Set(reasons)].slice(0, 4).join(' / ')
          : 'independent evidence / official documentation / counterevidence / compatibility';
        const adaptiveQuery = `${adaptiveBase} / adaptive research round ${continuationRound + round + 1} / ${focus}`;
        // P440 D6: 適応クエリにも既存クラスタのホスト除外を載せる
        // （単語数24の上限を超えない場合のみ）。
        const siteExclusions = sourceExclusion.excludedHosts.slice(0, 2).map(host => `-site:${host}`).join(' ');
        return siteExclusions && `${adaptiveQuery} ${siteExclusions}`.split(/\s+/).filter(Boolean).length <= 24
          ? `${adaptiveQuery} ${siteExclusions}`
          : adaptiveQuery;
      };

      // P488: 自分の自己診断（P485）が「上流停止中／予算枯渇」を
      // 示している間は、調査を回しても検索層で止まるだけなので、
      // 計画段で証拠待ちに倒す。診断は彼女自身の結論であり、
      // それに従って行動を変えることが「活用」である。
      let liveSearchDiagnosis: string | null = null;
      try {
        const diagnosis = autonomousSearchService.getSearchSelfDiagnosis();
        if (
          (diagnosis.cause === 'UPSTREAM_SUSPENDED' || diagnosis.cause === 'BUDGET_EXHAUSTED') &&
          (!diagnosis.until || diagnosis.until > Date.now())
        ) {
          liveSearchDiagnosis = `${diagnosis.cause}: ${diagnosis.detail}`;
        }
      } catch {
        // 診断が読めなければ通常運転を続ける。
      }

      for (let pass = 0; pass < invocationPassLimit; pass++) {
        if (liveSearchDiagnosis) {
          systemLogger.info('SELF_IMPROVEMENT', `🩺 [自己診断を活用] 検索基盤の自己診断（${liveSearchDiagnosis}）のため、この調査は証拠待ちにします`);
          break;
        }
        roundsCompleted = pass + 1;
        const plannedQuery = queryPlan.status === 'READY'
          ? queryPlan.queries[pass]?.queryText
          : undefined;
        // P461: 前パスの結果から勧められた改訂クエリは、計画が READY の
        // 通常パスでも次の1パスに使う（従来は BLOCKED 時のフォールバック
        // でしか使われず、結果の質が残りの計画に影響しなかった）。
        const useRevision = pass > 0 && !!recommendedRevisionQuery;
        const passQuery = useRevision
          ? (recommendedRevisionQuery as string)
          : plannedQuery || buildAdaptiveQuery(pass, verification);
        if (useRevision) recommendedRevisionQuery = undefined;
        // P486: 主題を特定できなかったパスは検索を発射しない。理解
        // できていない問いへの検索は、枠の消費と「調べたつもり」だけ
        // を生む。gap は証拠待ちとして残り、主題が分かる材料が来た
        // ときに再び調べられる。
        if (!passQuery.trim()) {
          subjectUnresolved = true;
          // P487: 止めて終わりにしない。人間の語が残っているなら、
          // その語の意味を学ぶ gap へ回し、意味が分かった後の
          // 再調査で主題を組めるようにする。
          this.routeUnunderstoodSubjectToMeaningLearning(gap, baseQuery, queryPlan.subject?.unknownTerms);
          systemLogger.info('SELF_IMPROVEMENT', '🧭 [主題理解] 検索の主題を特定できなかったため、この調査では検索しません');
          break;
        }
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
        // P494: 未知語の意味を学ぶ調査では、検索エンジンの調子に
        // 左右されないよう、辞書サイトのその語のページを直接の
        // 読み対象として先頭に足す（通常の読み経路で証拠化される）。
        if (pass === 0 && gap.type === 'UNKNOWN_TERM') {
          const directTarget = (gap.identity?.target || '').trim()
            || (gap.query.split(':')[1] || '').trim().split(/\s+/)[0];
          if (directTarget && !japaneseDictionaryService.has(directTarget)) {
            const encoded = encodeURIComponent(directTarget);
            const directResults = [
              { title: `${directTarget} - Wikipedia`, snippet: '', source: 'wikipedia-direct', url: `https://ja.wikipedia.org/wiki/${encoded}` },
              { title: `${directTarget} - Wiktionary`, snippet: '', source: 'wiktionary-direct', url: `https://ja.wiktionary.org/wiki/${encoded}` },
            ].filter((d) => !results.some((r) => r.url === d.url));
            if (directResults.length > 0) {
              results.unshift(...directResults);
              systemLogger.info('SELF_IMPROVEMENT', `📖 [意味学習] 「${directTarget}」を辞書サイトから直接引く (読み対象に ${directResults.length} 件追加)`);
            }
          }
        }
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
        // P803: リンク巡回。読んだページのアンカーが調査対象を含む
        // リンクを、その場で追加の読み対象にする。答えが1リンク先に
        // ある型の調査で、検索し直さずに前へ進むための運転。
        // 予算は1調査あたり成功3件まで（読みは直列で時間を使うため）。
        if (followReadsUsed < 3) {
          const followTerms = [
            String(gap.identity?.target || ''),
            ...(queryPlan.status === 'READY' ? (queryPlan.subject?.unknownTerms || []) : []),
            ...String(baseQuery || '').split(/[\s:：]+/).filter((w: string) => w.length >= 2).slice(0, 2),
          ];
          const followExclude = new Set<string>([
            ...readResults.map((p) => p.url),
            ...followedUrls,
            ...((sourceExclusion as any)?.excludedUrls || []),
          ]);
          const follows = linkFollowService.selectFollowLinks(readResults as any, followTerms, followExclude, Math.min(2, 3 - followReadsUsed));
          if (follows.length > 0) {
            const followRead = await unifiedWebResearchService.readSearchResultPages(passQuery, follows.map((f) => ({ title: f.title || f.url, snippet: '', source: 'link-follow', url: f.url })) as any, { maxPages: follows.length });
            let followedOk = 0;
            for (const fp of followRead) {
              followedUrls.add(fp.url);
              if (fp.success && fp.text.trim()) { readResults.push(fp); followedOk++; }
            }
            followReadsUsed += followedOk;
            systemLogger.info('SELF_IMPROVEMENT', `🔗 [リンク巡回] 「${passQuery}」で ${follows.length} 件のリンクを辿り、${followedOk} 件を読んだ`);
          }
        }
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
              const graphClaimId = this.linkResearchEvidenceToClaim(pageEvidence.evidence_id, relevant.text, claimIdByNormalizedStatement, !isCounterEvidencePass, { anchorTerms, subjectField });
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
                  { anchorTerms, subjectField },
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
              { anchorTerms, subjectField },
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
              priorityTerms: priorityTermsForLearning.length ? priorityTermsForLearning : undefined,
            });

            // P494: 意味が辞書に載ったら、この UNKNOWN_TERM gap は
            // 役目を終える。再調査のたびに同じ語を調べ直さない。
            if (gap.type === 'UNKNOWN_TERM' && termLearning.learnedDefinitions.length > 0) {
              const learnedTarget = (gap.identity?.target || '').trim();
              if (learnedTarget && japaneseDictionaryService.has(learnedTarget)) {
                knowledgeGapService.markResolved(gap.id);
                systemLogger.info('SELF_IMPROVEMENT', `📖 [意味学習] 「${learnedTarget}」を覚えたため、意味学習 gap を解決しました`);
              }
            }

            // P463: gloss が無い語（needsGloss）は、深掘り辞書引きの
            // 消費者に渡す。従来は印と集計だけで、補完する後段がなかった。
            // lookupDeep は同一語の再試行を内部で抑止する。
            // P473: 深掘りは「この研究の錨に触れる語」だけに限る。ページ
            // 由来だけの語彙は needsGloss の記録に留め、ここでは掘らない
            // （読んだページの言葉がそのまま次の調査語彙になる循環を断つ）。
            const deepDiveTerms = termLearning.terms
              .filter((t) => t.needsGloss)
              .filter((t) => anchorTerms.length === 0 || baseQuery.includes(t.term) || anchorTerms.some((a) => a.includes(t.term) || t.term.includes(a)))
              .slice(0, 5);
            for (const learnedTerm of deepDiveTerms) {
              dictionaryBootstrapService.lookupDeep(learnedTerm.term);
            }

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
            // P490: gloss 付きで学べた語は、辞書的な語関係（同義・
            // 反対・上位）も Wikidata から引いて語彙ルールへ足す。
            // fire-and-forget（内部で7日間引き・例外は投げない）。
            // 1ページあたり最大2語まで（共有基盤への配慮）。
            for (const term of glossedTerms.slice(0, 2)) {
              void lexicalRelationService.learnFromWikidata(term);
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
          { anchorTerms, subjectField },
        );

        if (claimId && !claimIds.includes(claimId)) claimIds.push(claimId);

      }

        // ResearchはEvidence/Claimの収集までを担当し、VerificationはCORE経由で実行する。
        knowledgeGapService.advanceResolutionPlan(gap.id, 'VERIFY', 'RESEARCH');
        knowledgeGapService.attachResearchClaims(gap.id, claimIds);
        knowledgeGapService.attachResearchRequiredClaims(gap.id, requiredResearchClaimIds);
        verification = [];
        resolved = false;

        if (queryPlan.status === "READY" && queryPlan.queries[pass]) { const passEvidenceIds = [...new Set(evidence.filter(item => item.status !== "REJECTED").map(item => item.evidence_id))]; const passClusters = new Set(evidence.filter(item => item.status !== "REJECTED" && item.independence_cluster_id).map(item => item.independence_cluster_id)); researchQueryOutcomeLearningService.record({ queryPlanId: queryPlan.queryPlanId, queryId: queryPlan.queries[pass].queryId, queryText: queryPlan.queries[pass].queryText, status: passEvidenceIds.length ? "EVIDENCE_GAINED" : results.length ? "LOW_QUALITY_RESULTS" : "NO_RESULTS", candidateUrlCount: results.filter(result => !!result.url).length, renderedPageCount: readResults.filter(page => page.success && !!page.text.trim()).length, admissibleIndependentSourceCount: passClusters.size, primarySourceCount: passEvidenceIds.filter(id => { const item = evidence.find(e => e.evidence_id === id); return item?.status !== "REJECTED" && (item?.metadata?.research_source_role === "PRIMARY" || item?.metadata?.research_source_role === "OFFICIAL"); }).length, sourceTierTarget: queryPlan.queries[pass].sourceTierTarget, counterevidenceChecked: queryPlan.queries[pass].intentType === "COUNTEREVIDENCE", evidenceIds: passEvidenceIds, failureReasons: [...verification.filter(result => result.outcome === "UNRESOLVED").flatMap(result => result.reasons), ...(results.length >= 8 && passEvidenceIds.length > 0 && passEvidenceIds.length / results.length < 0.25 ? ["LOW_EVIDENCE_RATE"] : [])], environmentApplicability: "CURRENT_ENVIRONMENT", executionTimeMs: Date.now() - queryStartedAt, attempt: pass + 1 }); }

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

  // P473: 元の研究質問から錨語（内容語）を抽出する。派生クエリの語では
  // なく「何を調べているか」の核の語を錨にすることで、読んだページの
  // 語彙に引っ張られてテーマが漂流するのを止める。
  private extractAnchorTerms(...sources: string[]): string[] {
    const terms: string[] = [];
    const push = (value: string) => {
      const term = value.trim();
      if (term.length >= 2 && !terms.includes(term)) terms.push(term);
    };
    for (const source of sources) {
      const text = String(source || '');
      for (const m of text.matchAll(/[A-Za-z][A-Za-z0-9_$.-]{2,}/g)) {
        if (!P473_ANCHOR_STOP_LATIN.has(m[0].toLowerCase())) push(m[0]);
      }
      for (const m of text.matchAll(/[ァ-ヶー]{2,}|[一-龠々]{2,}/g)) {
        if (!P473_ANCHOR_STOP_SEGMENTS.has(m[0])) push(m[0]);
      }
    }
    return terms.slice(0, 10);
  }

  // P473: 文が錨語を十分に含むか。錨が2語以下しか取れない研究（辞書
  // 引き等）では1語の一致で通す。既に在庫にある Claim への証拠付加は
  // この関門の対象外（呼び出し側の重複排除マップで先に処理される）。
  private passesAnchorGate(statement: string, anchorTerms: string[]): boolean {
    if (anchorTerms.length === 0) return true;
    const normalized = this.normalizeClaimStatement(statement);
    const hits = anchorTerms.filter((term) => normalized.includes(this.normalizeClaimStatement(term))).length;
    return anchorTerms.length <= 2 ? hits >= 1 : hits >= 2;
  }

  private linkResearchEvidenceToClaim(
    evidenceId: string,
    statement: string,
    claimIdByNormalizedStatement: Map<string, string>,
    reuseExisting = true,
    gate?: { anchorTerms?: string[]; subjectField?: string },
  ): string | undefined {
    const normalized = this.normalizeClaimStatement(statement);
    if (normalized.length < 15) return undefined;

    // P473: 主張適格性。知識として持つに値しない文（疑問文・見出し
    // 断片・宣伝・一人称の体験談・ブログ調の語りかけ）は Claim 化
    // しない。Evidence 自体は記録済みなので、出所の追跡は失われない。
    const worthiness = assessClaimWorthiness(statement);
    if (!worthiness.ok) {
      systemLogger.info('SELF_IMPROVEMENT', `[P473] 主張化を見送り (${worthiness.reason}): ${statement.slice(0, 60)}`);
      return undefined;
    }

    // Counterevidence remains a separately inspectable Claim; it must not
    // silently join an existing positive-support Claim.
    // P459: そのため反証パスだけは Claim DB の重複排除を明示的に外し、
    // 従来どおり別 Claim として登録する。
    if (!reuseExisting) {
      return evidenceService.registerUnverifiedClaim(evidenceId, statement, { allowDuplicate: true });
    }

    const existingClaimId = claimIdByNormalizedStatement.get(normalized);
    if (existingClaimId) {
      return evidenceService.attachEvidenceToClaim(evidenceId, existingClaimId)
        ? existingClaimId
        : undefined;
    }

    // P473: 錨チェック。新規 Claim 化は、元の研究質問の核の語を含む
    // 文だけに限る。検索語との1語一致で流れ着いたページの文は、ここ
    // で止まる（証拠付加は上の重複排除経路で従来どおり可能）。
    if (gate?.anchorTerms && gate.anchorTerms.length > 0 && !this.passesAnchorGate(statement, gate.anchorTerms)) {
      systemLogger.info('SELF_IMPROVEMENT', `[P473] 錨語不足で主張化を見送り: ${statement.slice(0, 60)}`);
      return undefined;
    }

    // P493: 分野照合。主題の分野と文の分野が両方確定していて交わら
    // ない文は、この調査の成果として Claim 化しない。同音異義の別
    // 分野（例：特許のクレーム）から流れ着いた文が、証拠探しの副産
    // 物として事実化するのを止める。どちらか不定なら判断しない。
    if (subjectUnderstandingService.fieldMismatch(gate?.subjectField, statement) === true) {
      systemLogger.info('SELF_IMPROVEMENT', `🧠 [意味照合] 主題の分野（${gate?.subjectField}）と合わないため主張化を見送り: ${statement.slice(0, 60)}`);
      return undefined;
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
