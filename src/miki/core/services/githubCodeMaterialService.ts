import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { apiUrl, fetchGitHubFileContents } from '../../../services/api';
import { selfCodeSpaceService } from './selfCodeSpaceService';
import { selfCodeUnderstandingService } from './selfCodeUnderstandingService';
import {
  japaneseAnalysisService,
  contentTermsFromTokens,
} from '../../research/services/japaneseAnalysisService';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { privacyGuardrailService } from '../../safety/services/privacyGuardrailService';
import { sanitizeOutboundPayload } from '../../safety/services/outboundPayloadSanitizer';
import type { WebImplementationMaterial } from '../../research/services/webMaterialPatternExtractor';

/*
 * P422: GitHub コード検索を「実装材料チャネル」として研究層へ接続する。
 *
 * 位置付け（調査報告 §5-6 の方式c）: コードの材料はコード専門の場所へ。
 * 改善ループの不足調査（MISSING_IMPLEMENTATION_PATTERN）が探しているのは
 * 事実の裏付けではなく「どう作るか」の実装例であり、GitHub のコード検索が
 * 返すファイル断片＋実ファイル本文は WebImplementationMaterial.codeExamples
 * へ直接流せる形をしている。一般検索への合流（方式a）は、合流後のページ
 * 読取が blob 画面の HTML を拾って材料の質を落とすため採らない（第2段）。
 *
 * 既存の codeSearchService（リポジトリ検索・無認証・メタデータのみ）とは
 * 別物であり、置き換えない。あちらは「どのリポジトリが関連しそうか」の
 * 当たり付け、こちらは認証付きコード検索による実装材料の取得である。
 *
 * 認証: 自己コード同期で使う既存 PAT（localStorage の
 * miki_self_code_github_pat）を selfCodeSpaceService.getGitHubPat() から
 * 流用する。未設定なら SKIPPED として静かに無効化し、既存の材料収集は
 * 従来どおり動く。PAT の実値はログにも記録にも一切出さない。
 *
 * 紀律（専用ミニゲート）: コード検索は認証時 10 回/分という専用バケット
 * （他の検索 30 回/分・コア 5,000 回/時とは別枠で、同期を圧迫しない）。
 * 最小開始間隔 6.5 秒、X-RateLimit-Remaining / Reset の順守、429 では
 * リセットまで冷却、再試行なし、常駐タイマーは持たない（P418 の検索
 * ペーサーと同じ設計：状態はメモリ上のみ、待ちは呼び出し自身の中で行う）。
 * 実ファイル本文の取得（Contents API）はコア枠のためゲート対象外とし、
 * 件数（最大2件）とサイズで制限する。
 *
 * クエリ整形は決定的な処理のみ（LLM は使わない）:
 *  1. 契約ファースト — P421 の gap 契約欄（不足スロット名・期待
 *     インターフェースの識別子・対象パス）から識別子キーワードと
 *     language: / filename: 修飾を作る。
 *  2. 索引語彙の照合 — camelCase / snake_case を分割し、自己コード索引の
 *     シンボル語彙に存在する語を優先する（索引にある語は検索でも当たる）。
 *  3. 日本語→英語の橋渡し — 問いの日本語語を、P402 の目標→ファイル対応
 *     付けと同じ JMdict グロス橋渡しで英語キーワード候補に変換する
 *     （GitHub のコードは英語の識別子で書かれているため）。
 *  4. 複数バリアント — 1 回の派遣につき最大 3 本（識別子／グロス／
 *     絞り込み）。全部空なら修飾を落とした緩和クエリを枠内でもう 1 本。
 * legacy 構文のみ（symbol: は使えない）、クエリは GitHub の上限に合わせ
 * 256 字以内、検索語必須を守る。対象の内部パスは外部リポジトリに存在
 * しないため path: 修飾は使わず、ファイル名（汎用名でない場合のみ）を
 * filename: として使う。
 *
 * 使用記録（学習の種）: 材料ごとに「当たったクエリと、そのキーワードの
 * 材料源（契約欄／グロス変換／索引語彙／問い）」と「生成まで生き残ったか
 * （部品候補に使われたか）」を台帳に残す。重み付けの学習そのものは
 * 本便に含めない（記録まで）。
 *
 * P424: サーバー中継フォールバック。実機では WebView から
 * api.github.com への直接 fetch が輸送レベルで失敗する（Failed to
 * fetch。P416 の Wikipedia と同系統）一方、同じ端末の Termux
 * サーバーからは届く。そこで直接 fetch が輸送レベルの失敗
 * （ネットワーク失敗・タイムアウト）になった場合に限り、サーバーの
 * 中継ルート（POST /api/github/code-search）へ1回だけ切り替えて
 * 収集を続ける。HTTP エラー（401/403/429 等、GitHub が応答した
 * もの）は従来どおり直接の結果として扱い、中継へは切り替えない。
 * 実ファイル本文も、直接の輸送失敗時に限り既存の
 * /api/github/file-contents（P352 の実績経路）を中継として流用する。
 * ミニゲートは輸送経路によらず論理検索1回につき1スロットで効かせ
 * （レート枠はトークン単位）、中継応答が運ぶレートヘッダも同じ
 * ゲートへ反映する。どちらの経路で届いたかは結果（routesUsed）・
 * 使用台帳（route）・ログの経路表記に残す。PAT は中継でも従来の
 * GitHub 中継と同じくサーバーへ渡すだけで、サーバー側は保持しない。
 */

export type GitHubCodeKeywordSource =
  | 'CONTRACT'
  | 'GLOSS'
  | 'INDEX_VOCAB'
  | 'QUESTION';

/*
 * P421 の CandidateGenerationGapContract と構造的に同一の形。
 * 生成段が組み立てた契約をそのまま渡せるよう、こちらで構造型として
 * 定義し、値 import の循環を作らない。
 */
export interface CodeSearchGapContract {
  targets: Array<{
    path: string;
    exports: string[];
    signatures: Array<{
      name: string;
      kind: string;
      parameters: string[];
      returnType?: string;
    }>;
    imports: string[];
  }>;
  missingSlots: Array<{
    knowledgeId: string;
    slotName: string;
    inputKinds: string[];
  }>;
  missingComponentIds: string[];
}

export interface CodeMaterialCollectionContext {
  targetPaths?: string[];
  gapContract?: CodeSearchGapContract;
}

export type GitHubCodeMaterialStatusKind =
  | 'SUCCEEDED'
  | 'EMPTY'
  | 'FAILED'
  | 'SKIPPED';

export interface GitHubCodeMaterialOutcome {
  materials: WebImplementationMaterial[];
  status: GitHubCodeMaterialStatusKind;
  error?: string;
  queriesUsed: number;
  // P424: GitHub の応答を運んだ輸送経路（応答が届いた検索のみ。
  // 直接・中継の両方とも輸送失敗に終わった収集では空になる）。
  routesUsed?: Array<'direct' | 'relay'>;
}

export interface GitHubCodeGateSnapshot {
  minIntervalMs: number;
  lastStartAt: number;
  remaining: number | null;
  resetAt: number;
  cooldownRemainingMs: number;
  cooldownReason: string;
}

export interface GitHubCodeMaterialUsageRecord {
  materialId: string;
  sourceId: string;
  sourceUrl: string;
  query: string;
  keywordSources: GitHubCodeKeywordSource[];
  collectedAt: number;
  usedInGeneration: boolean;
  usedAt?: number;
  // P424: この材料の内容を運んだ輸送経路（実本文が届いた場合は
  // その経路、断片のみの場合は検索の経路）。P422 以前の記録には無い。
  route?: 'direct' | 'relay';
}

/*
 * P427（学習の段階0）: 収集の試行レベル記録。使用台帳は「当たった
 * 材料」しか残らないため、キーワード材料源ごとの成功率（分母）が
 * 計算できなかった。試行記録は収集の出口ごとに status・発射した
 * 整形クエリ・キーワード材料源・消費クエリ数・取得件数を別の
 * キーへ有界で残す。空・失敗・スキップも記録する。挙動を変える
 * 消費者はまだ置かない（将来の重み付け学習の前提工事）。
 */
export interface GitHubCodeMaterialAttemptRecord {
  status: GitHubCodeMaterialStatusKind;
  shapedQuery: string;
  keywordSources: GitHubCodeKeywordSource[];
  requestsUsed: number;
  materialCount: number;
  collectedAt: number;
}

interface ShapedQuery {
  text: string;
  keywordSources: GitHubCodeKeywordSource[];
  variant: 'IDENTIFIER' | 'GLOSS' | 'SCOPED' | 'RELAXED';
  terms: string[];
}

interface SearchHit {
  htmlUrl: string;
  path: string;
  repoFullName: string;
  language: string;
  fragment: string;
  keywordSources: GitHubCodeKeywordSource[];
  queryText: string;
  // P424: このヒットを運んだ検索の輸送経路と、実本文が届いた場合の
  // その経路、および中継の本文取得（file-contents）が使う既定ブランチ。
  route: 'direct' | 'relay';
  bodyRoute?: 'direct' | 'relay';
  defaultBranch: string;
}

/*
 * P424: 1回の論理検索に対する試行結果。response は「GitHub が応答
 * した」こと（HTTP エラー含む）を、transport は「応答が届かな
 * かった」こと（ネットワーク失敗・タイムアウト）を表す。中継への
 * 切り替えは transport の場合に限る。
 */
type SearchAttempt =
  | {
      kind: 'response';
      status: number;
      body: any;
      rate: { remaining: number; reset: number };
    }
  | { kind: 'transport'; reason: string };

type SearchCodeResult =
  | { kind: 'ok'; items: any[]; route: 'direct' | 'relay' }
  | { kind: 'blocked'; reason: string }
  | {
      kind: 'error';
      reason: string;
      rateLimited?: boolean;
      route?: 'direct' | 'relay';
    };

const SETTINGS_KEY = 'miki_github_code_material_settings_v1';
const USAGE_KEY = 'miki_github_code_material_usage_v1';
const ATTEMPTS_KEY = 'miki_github_code_material_attempts_v1';
const ATTEMPTS_LEDGER_CAP = 200;
const API_URL_KEY = 'miki_github_api_url';
const DEFAULT_API_BASE = 'https://api.github.com';
const SEARCH_MIN_INTERVAL_MS = 6500;
const SEARCH_TIMEOUT_MS = 8000;
const CONTENTS_TIMEOUT_MS = 8000;
// P424: 中継は端末内サーバーへの往復＋サーバーから GitHub への
// 往復を含むため、直接より長めに取る（サーバー側の上限は15秒）。
const RELAY_TIMEOUT_MS = 20000;
const COLLECTION_DEADLINE_MS = 60000;
const MAX_QUERY_VARIANTS = 3;
const MAX_HITS = 4;
const MAX_CONTENTS_FILES = 2;
const MAX_CODE_CHARS = 12000;
const MAX_CONTENTS_BYTES = 256 * 1024;
const QUERY_CHAR_LIMIT = 250;
const USAGE_LEDGER_CAP = 100;

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  kt: 'Kotlin',
  java: 'Java',
  py: 'Python',
  go: 'Go',
  rs: 'Rust',
};

const EXTENSION_BY_LANGUAGE: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
  kotlin: 'kt',
  java: 'java',
  python: 'py',
  go: 'go',
  rust: 'rs',
};

// filename: 修飾に使うには汎用的すぎるファイル名（どのリポジトリにもある）。
const GENERIC_FILE_STEMS = new Set(['index', 'main', 'app', 'mod', 'lib', 'types', 'utils']);

// 問いのテンプレート文に含まれる一般語は、識別子キーワードとしては
// ノイズになるため除外する（材料として意味を持つ語は残す）。
const QUESTION_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'find', 'needed',
  'objective', 'current', 'repository', 'context', 'structured', 'goal',
  'latent', 'intent', 'deliverables', 'determine', 'required', 'reusable',
]);

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function splitIdentifierWords(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map(word => word.toLowerCase())
    .filter(word => word.length >= 3 && !/^\d+$/.test(word));
}

function languageForPaths(paths: string[]): string {
  for (const path of paths) {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    if (LANGUAGE_BY_EXTENSION[ext]) return LANGUAGE_BY_EXTENSION[ext];
  }
  return '';
}

function languageForHit(hit: SearchHit): string {
  const ext = hit.path.split('.').pop()?.toLowerCase() ?? '';
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'kt', 'java', 'py', 'go', 'rs'].includes(ext)) {
    return ext;
  }
  const fromName = EXTENSION_BY_LANGUAGE[hit.language.toLowerCase()];
  if (fromName) return fromName;
  return hit.language.toLowerCase() || 'text';
}

function readGitHubApiBase(): string {
  try {
    const override = storageService.getItem(API_URL_KEY);
    if (override) {
      const url = new URL(override);
      if (url.protocol === 'https:' && !url.username && !url.password) {
        return override.replace(/\/+$/, '');
      }
    }
  } catch {
    // 不正な上書き値は既定値へ落とす。
  }
  return DEFAULT_API_BASE;
}

// ミニゲートの状態（メモリ上のみ。アプリ再起動でリセットされる）。
const codeSearchGate = {
  lastStartAt: 0,
  remaining: null as number | null,
  resetAt: 0,
  cooldownUntil: 0,
  cooldownReason: '',
};

let vocabCache: { key: string; words: Set<string>; names: Set<string> } | null = null;

class GitHubCodeMaterialService {
  getSettings(): { enabled: boolean } {
    try {
      const raw = storageService.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return { enabled: parsed?.enabled !== false };
    } catch {
      return { enabled: true };
    }
  }

  saveSettings(input: { enabled?: boolean }): { enabled: boolean } {
    const next = { enabled: input.enabled !== false };
    storageService.setItem(SETTINGS_KEY, JSON.stringify(next));
    return next;
  }

  getGateState(): GitHubCodeGateSnapshot {
    return {
      minIntervalMs: SEARCH_MIN_INTERVAL_MS,
      lastStartAt: codeSearchGate.lastStartAt,
      remaining: codeSearchGate.remaining,
      resetAt: codeSearchGate.resetAt,
      cooldownRemainingMs: Math.max(0, codeSearchGate.cooldownUntil - Date.now()),
      cooldownReason: codeSearchGate.cooldownReason,
    };
  }

  /*
   * 検証用・設定変更後の運用者リセット用（P418 の resetSearchPacer と
   * 同じ位置付け）。実行中の検索がある間は使わない。
   */
  resetGate(): void {
    codeSearchGate.lastStartAt = 0;
    codeSearchGate.remaining = null;
    codeSearchGate.resetAt = 0;
    codeSearchGate.cooldownUntil = 0;
    codeSearchGate.cooldownReason = '';
  }

  listUsage(limit = 50): GitHubCodeMaterialUsageRecord[] {
    return this.loadUsage().slice(-Math.max(1, limit));
  }

  // P427（段階0）: 試行レベル記録の読み出し。使用台帳とは別系統で、
  // 空・失敗を含む収集の全試行が対象（成功率の分母）。
  listAttempts(limit = 50): GitHubCodeMaterialAttemptRecord[] {
    return this.loadAttempts().slice(-Math.max(1, limit));
  }

  /*
   * 生成段が材料を部品候補に使った時点で呼ばれる使用印。
   * 台帳に無い sourceId は無視する（Web 由来の材料など）。
   */
  markMaterialsUsed(sourceIds: Iterable<string>): void {
    const ids = new Set(sourceIds);
    if (ids.size === 0) return;
    const ledger = this.loadUsage();
    let changed = false;
    for (const record of ledger) {
      if (ids.has(record.sourceId) && !record.usedInGeneration) {
        record.usedInGeneration = true;
        record.usedAt = Date.now();
        changed = true;
      }
    }
    if (changed) this.saveUsage(ledger);
  }

  /*
   * 決定的なクエリ整形。問い（安全化済みでなくてよい。送信前の安全化は
   * collectMaterials 側で行う）と収集文脈から、発射候補のクエリ群を作る。
   */
  buildQueries(
    question: string,
    context?: CodeMaterialCollectionContext,
  ): Array<{ text: string; keywordSources: GitHubCodeKeywordSource[]; variant: string }> {
    return this.shapeQueries(question, context).map(query => ({
      text: query.text,
      keywordSources: query.keywordSources,
      variant: query.variant,
    }));
  }

  async collectMaterials(
    question: string,
    context?: CodeMaterialCollectionContext,
  ): Promise<GitHubCodeMaterialOutcome> {
    // P424: GitHub の応答を運んだ輸送経路の記録（done の呼び出し
    // 時点までに fireVariant が積む）。
    const routesUsed = new Set<'direct' | 'relay'>();
    // P427（段階0）: 試行記録は収集の全出口（done）で 1 件だけ残す。
    // 発射したバリアント（緩和クエリ含む）を fireVariant が積む。
    const firedQueries: Array<{ text: string; keywordSources: GitHubCodeKeywordSource[] }> = [];
    const done = (
      status: GitHubCodeMaterialStatusKind,
      materials: WebImplementationMaterial[],
      queriesUsed: number,
      error?: string,
    ): GitHubCodeMaterialOutcome => {
      this.recordAttempt({
        status,
        shapedQuery: firedQueries.map(query => query.text).join(' || '),
        keywordSources: [...new Set(firedQueries.flatMap(query => query.keywordSources))],
        requestsUsed: queriesUsed,
        materialCount: materials.length,
        collectedAt: Date.now(),
      });
      return {
        materials,
        status,
        queriesUsed,
        ...(error ? { error } : {}),
        ...(routesUsed.size > 0 ? { routesUsed: [...routesUsed] } : {}),
      };
    };

    if (!this.getSettings().enabled) {
      return done('SKIPPED', [], 0, 'GitHubコード材料チャネルは設定で無効です');
    }
    const pat = (() => {
      try {
        return selfCodeSpaceService.getGitHubPat().trim();
      } catch {
        return '';
      }
    })();
    if (!pat) {
      // 前提条件が無いだけであり、失敗ではない。既存の材料収集は
      // 従来どおり動く（静かに無効化）。
      return done('SKIPPED', [], 0, 'GitHub PATが未設定のためコード検索を省略しました');
    }

    const outbound = sanitizeOutboundPayload(question, (serialized) =>
      privacyGuardrailService.auditOutboundContent(serialized, 'web_search', { autoSanitize: true }),
    );
    if (!outbound.allowed || typeof outbound.payload !== 'string') {
      systemLogger.warn('SELF_IMPROVEMENT', '🚫 [GitHubコード検索] outbound sanitization failed; query redacted');
      return done('SKIPPED', [], 0, 'プライバシー保護のためコード検索を安全にスキップしました');
    }
    const safeQuestion = outbound.payload;

    const variants = this.shapeQueries(safeQuestion, context);
    if (variants.length === 0) {
      return done('SKIPPED', [], 0, '問いと契約から検索キーワードを導出できませんでした');
    }

    const deadline = Date.now() + COLLECTION_DEADLINE_MS;
    const hits = new Map<string, SearchHit>();
    let queriesUsed = 0;
    let lastError = '';
    let sawSuccessfulSearch = false;
    let rateBlocked = false;

    const fireVariant = async (variant: ShapedQuery): Promise<void> => {
      const result = await this.searchCode(variant.text, pat);
      if (result.kind === 'blocked') {
        rateBlocked = true;
        lastError = result.reason;
        return;
      }
      firedQueries.push({ text: variant.text, keywordSources: [...variant.keywordSources] });
      queriesUsed += 1;
      if (result.route) routesUsed.add(result.route);
      if (result.kind === 'error') {
        lastError = result.reason;
        if (result.rateLimited) rateBlocked = true;
        return;
      }
      sawSuccessfulSearch = true;
      for (const item of result.items) {
        if (hits.size >= MAX_HITS) break;
        if (!item || typeof item.html_url !== 'string' || !item.html_url) continue;
        if (hits.has(item.html_url)) continue;
        const fragment = Array.isArray(item.text_matches)
          ? item.text_matches
              .map((match: any) => String(match?.fragment || '').trim())
              .filter(Boolean)
              .join('\n')
          : '';
        hits.set(item.html_url, {
          htmlUrl: item.html_url,
          path: String(item.path || ''),
          repoFullName: String(item.repository?.full_name || ''),
          language: String(item.language || ''),
          fragment,
          keywordSources: variant.keywordSources,
          queryText: variant.text,
          route: result.route,
          defaultBranch: String(item.repository?.default_branch || ''),
        });
      }
    };

    for (const variant of variants) {
      if (hits.size >= MAX_HITS || rateBlocked || Date.now() > deadline) break;
      await fireVariant(variant);
    }

    if (hits.size === 0 && sawSuccessfulSearch && !rateBlocked) {
      // 緩和: 修飾を落とし、識別子だけでもう 1 本（枠内）。
      const relaxed = this.buildRelaxedQuery(variants);
      if (relaxed && Date.now() <= deadline) await fireVariant(relaxed);
    }

    if (hits.size === 0) {
      if (!sawSuccessfulSearch && lastError) {
        systemLogger.info('SELF_IMPROVEMENT', `ℹ️ [GitHubコード検索] 取得失敗: ${lastError}`);
        return done('FAILED', [], queriesUsed, lastError);
      }
      systemLogger.info('SELF_IMPROVEMENT', '🔍 [GitHubコード検索] 該当するコード材料はありませんでした');
      return done('EMPTY', [], queriesUsed, lastError || undefined);
    }

    const hitList = [...hits.values()];
    const bodies = new Map<string, { text: string; route: 'direct' | 'relay' }>();
    for (const hit of hitList.slice(0, MAX_CONTENTS_FILES)) {
      const body = await this.fetchFileBody(hit, pat);
      if (body) {
        bodies.set(hit.htmlUrl, body);
        hit.bodyRoute = body.route;
      }
    }

    const materials: WebImplementationMaterial[] = [];
    for (const hit of hitList) {
      const material = this.buildMaterial(safeQuestion, hit, bodies.get(hit.htmlUrl)?.text);
      if (material) materials.push(material);
    }

    if (materials.length === 0) {
      return done('EMPTY', [], queriesUsed, '検索ヒットから材料を構成できませんでした');
    }

    this.recordUsage(materials, hitList);
    // P424: 中継が関与した収集はログでも判別できるようにする。
    const relayedCount = hitList.filter(
      hit => (hit.bodyRoute ?? hit.route) === 'relay',
    ).length;
    const routeSuffix =
      relayedCount === 0
        ? ''
        : relayedCount === hitList.length
          ? '（サーバー中継経由）'
          : '（一部サーバー中継経由）';
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🔍 [GitHubコード検索] 実装材料を ${materials.length} 件取得しました（クエリ ${queriesUsed} 本）${routeSuffix}`,
    );
    return done('SUCCEEDED', materials, queriesUsed);
  }

  // ------------------------------------------------------------------
  // クエリ整形
  // ------------------------------------------------------------------

  private shapeQueries(
    question: string,
    context?: CodeMaterialCollectionContext,
  ): ShapedQuery[] {
    const contract = context?.gapContract;
    const targetPaths = (context?.targetPaths ?? []).filter(Boolean);
    const vocab = this.indexVocabulary();

    const contractRaw: string[] = [];
    const pushRaw = (value: string) => {
      const term = value.trim();
      if (term.length >= 3 && !/\s/.test(term) && !contractRaw.includes(term)) {
        contractRaw.push(term);
      }
    };
    if (contract) {
      for (const slot of contract.missingSlots ?? []) pushRaw(slot.slotName);
      for (const target of contract.targets ?? []) {
        for (const signature of target.signatures ?? []) pushRaw(signature.name);
        for (const name of target.exports ?? []) pushRaw(name);
      }
    }
    const cappedContractRaw = contractRaw.slice(0, 6);

    const contractWords = unique([
      ...cappedContractRaw.flatMap(splitIdentifierWords),
      ...(contract?.missingSlots ?? []).flatMap(slot =>
        (slot.inputKinds ?? []).flatMap(splitIdentifierWords),
      ),
      ...(contract?.missingComponentIds ?? []).flatMap(splitIdentifierWords),
    ]).slice(0, 10);

    const questionRaw = unique(
      (question.match(/[A-Za-z_$][A-Za-z0-9_$]{2,}/g) ?? []).filter(
        term => !QUESTION_STOPWORDS.has(term.toLowerCase()),
      ),
    ).slice(0, 6);
    const questionWords = unique(questionRaw.flatMap(splitIdentifierWords)).slice(0, 8);

    const glossWords = this.glossBridgeWords(question);

    const language = languageForPaths([
      ...targetPaths,
      ...(contract?.targets ?? []).map(target => target.path),
    ]);
    const languageQualifier = language ? `language:${language}` : '';
    const filenameQualifier = (() => {
      const primary = targetPaths[0] ?? contract?.targets?.[0]?.path ?? '';
      const base = primary.split('/').pop() ?? '';
      const stem = base.replace(/\.[^.]+$/, '').toLowerCase();
      return base && !GENERIC_FILE_STEMS.has(stem) ? `filename:${base}` : '';
    })();

    const confirmedByVocab = (terms: string[]): boolean =>
      terms.some(
        term =>
          vocab.names.has(term.toLowerCase()) ||
          splitIdentifierWords(term).some(word => vocab.words.has(word)),
      );

    const compose = (
      terms: string[],
      qualifiers: string[],
      sources: GitHubCodeKeywordSource[],
      variant: ShapedQuery['variant'],
      withVocabMark: string[],
    ): ShapedQuery | undefined => {
      const cleanTerms = unique(terms).filter(Boolean);
      if (cleanTerms.length === 0) return undefined;
      let text = [...cleanTerms, ...qualifiers.filter(Boolean)].join(' ');
      while (text.length > QUERY_CHAR_LIMIT && cleanTerms.length > 1) {
        cleanTerms.pop();
        text = [...cleanTerms, ...qualifiers.filter(Boolean)].join(' ');
      }
      if (text.length > QUERY_CHAR_LIMIT || cleanTerms.length === 0) return undefined;
      const keywordSources = [...sources];
      if (withVocabMark.length > 0 && confirmedByVocab(withVocabMark) && !keywordSources.includes('INDEX_VOCAB')) {
        keywordSources.push('INDEX_VOCAB');
      }
      return { text, keywordSources, variant, terms: cleanTerms };
    };

    const variants: ShapedQuery[] = [];
    const seen = new Set<string>();
    const add = (query: ShapedQuery | undefined) => {
      if (!query || seen.has(query.text) || variants.length >= MAX_QUERY_VARIANTS) return;
      seen.add(query.text);
      variants.push(query);
    };

    // V1: 識別子そのまま（契約優先、無ければ問いの識別子）。
    if (cappedContractRaw.length > 0) {
      add(compose(cappedContractRaw.slice(0, 4), [languageQualifier], ['CONTRACT'], 'IDENTIFIER', cappedContractRaw));
    } else if (questionRaw.length > 0) {
      add(compose(questionRaw.slice(0, 4), [languageQualifier], ['QUESTION'], 'IDENTIFIER', questionRaw));
    }

    // V2: グロス変換（日本語の問い→英語の語彙）＋契約の分割語で補強。
    if (glossWords.length > 0) {
      const terms = [...glossWords.slice(0, 3), ...contractWords.slice(0, 2)];
      const sources: GitHubCodeKeywordSource[] = ['GLOSS'];
      if (contractWords.length > 0) sources.push('CONTRACT');
      add(compose(terms, [languageQualifier], sources, 'GLOSS', terms));
    }

    // V3: 絞り込み（識別子＋言語＋ファイル名）。
    if (cappedContractRaw.length > 0 || contractWords.length > 0) {
      const terms =
        cappedContractRaw.length > 0 ? cappedContractRaw.slice(0, 2) : contractWords.slice(0, 3);
      add(compose(terms, [languageQualifier, filenameQualifier], ['CONTRACT'], 'SCOPED', terms));
    } else if (questionWords.length > 0 && variants.length === 0) {
      add(compose(questionWords.slice(0, 3), [languageQualifier], ['QUESTION'], 'IDENTIFIER', questionWords));
    }

    return variants;
  }

  private buildRelaxedQuery(variants: ShapedQuery[]): ShapedQuery | undefined {
    const first = variants[0];
    if (!first || first.terms.length === 0) return undefined;
    const terms = first.terms.slice(0, 2);
    const text = terms.join(' ');
    if (!text || variants.some(variant => variant.text === text)) return undefined;
    return { text, keywordSources: first.keywordSources, variant: 'RELAXED', terms };
  }

  /*
   * P402 と同じ JMdict グロス橋渡し: 問いの日本語内容語を辞書で引き、
   * グロス（英語）の語を検索キーワード候補にする。辞書が無い環境では
   * 何も返らない（その場合は橋渡しなしで組み立てる）。
   */
  private glossBridgeWords(question: string): string[] {
    let contentTerms: string[] = [];
    try {
      contentTerms = contentTermsFromTokens(japaneseAnalysisService.analyze(question).tokens);
    } catch {
      contentTerms = [];
    }
    const japaneseTerms = [...new Set(contentTerms)]
      .filter(term => !(/^[ぁ-ん]+$/.test(term) && term.length <= 2))
      .slice(0, 8);
    const bridge = new Set<string>();
    for (const term of japaneseTerms) {
      if (bridge.size >= 12) break;
      try {
        const gloss = japaneseDictionaryService.lookup(term)[0]?.gloss || '';
        for (const word of (gloss.toLowerCase().match(/[a-z][a-z-]{3,}/g) || []).slice(0, 5)) {
          if (bridge.size < 12) bridge.add(word.replace(/-/g, ''));
        }
      } catch {
        // 辞書が使えない場合は橋渡しなし。
      }
    }
    return [...bridge];
  }

  private indexVocabulary(): { words: Set<string>; names: Set<string> } {
    let entries: Array<{ symbols?: Array<{ name: string }>; exports?: string[] }> = [];
    try {
      entries = (selfCodeUnderstandingService.getSnapshot()?.entries ?? []) as typeof entries;
    } catch {
      entries = [];
    }
    const key = `${entries.length}|${entries[0]?.exports?.[0] ?? ''}|${entries[entries.length - 1]?.exports?.[0] ?? ''}`;
    if (vocabCache && vocabCache.key === key) return vocabCache;
    const words = new Set<string>();
    const names = new Set<string>();
    for (const entry of entries) {
      const surfaces = [
        ...(entry.symbols ?? []).map(symbol => symbol.name),
        ...(entry.exports ?? []),
      ];
      for (const surface of surfaces) {
        if (!surface) continue;
        names.add(surface.toLowerCase());
        for (const word of splitIdentifierWords(surface)) words.add(word);
      }
    }
    vocabCache = { key, words, names };
    return vocabCache;
  }

  // ------------------------------------------------------------------
  // GitHub API（ミニゲート経由の検索／コア枠の本文取得）
  // ------------------------------------------------------------------

  private async acquireSearchSlot(): Promise<{ ok: boolean; reason?: string }> {
    for (;;) {
      const now = Date.now();
      if (codeSearchGate.cooldownUntil > now) {
        const remainSec = Math.ceil((codeSearchGate.cooldownUntil - now) / 1000);
        return {
          ok: false,
          reason: `GitHubコード検索は冷却中です（残り約${remainSec}秒）: ${codeSearchGate.cooldownReason}`,
        };
      }
      if (codeSearchGate.remaining === 0 && codeSearchGate.resetAt > now) {
        const remainSec = Math.ceil((codeSearchGate.resetAt - now) / 1000);
        return {
          ok: false,
          reason: `GitHubコード検索の予算が残っていません（リセットまで約${remainSec}秒）`,
        };
      }
      const wait = codeSearchGate.lastStartAt + SEARCH_MIN_INTERVAL_MS - now;
      if (wait <= 0) {
        codeSearchGate.lastStartAt = now;
        return { ok: true };
      }
      await sleep(wait);
    }
  }

  /*
   * レートヘッダの取り込み。直接応答のヘッダと中継エンベロープの
   * 値のどちらからでも、同じ形（epoch 秒の reset）で受ける。値が
   * 無い項目はゲートへ反映しない（Number(null) が 0 になり予算切れ
   * と誤認するのを避ける。GitHub の実応答には常時含まれる）。
   */
  private captureRateHeaders(res: Response): { remaining: number; reset: number } {
    const read = (raw: string | null): number =>
      raw != null && raw !== '' ? Number(raw) : Number.NaN;
    return {
      remaining: read(res.headers.get('x-ratelimit-remaining')),
      reset: read(res.headers.get('x-ratelimit-reset')),
    };
  }

  private applyRate(rate: { remaining: number; reset: number }): void {
    if (Number.isFinite(rate.remaining)) codeSearchGate.remaining = rate.remaining;
    if (Number.isFinite(rate.reset) && rate.reset > 0) codeSearchGate.resetAt = rate.reset * 1000;
  }

  /*
   * 直接のコード検索。GitHub が応答した場合はその状態をそのまま
   * 返し、fetch 自体が投げた場合（ネットワーク失敗・タイムアウト）
   * のみ transport として返す。
   */
  private async trySearchDirect(query: string, pat: string): Promise<SearchAttempt> {
    try {
      const url = new URL(`${readGitHubApiBase()}/search/code`);
      url.searchParams.set('q', query);
      url.searchParams.set('per_page', '5');
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${pat}`,
          // text_matches（断片）を返すメディアタイプを指定する。
          Accept: 'application/vnd.github.text-match+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'MIKI-AI0.2',
        },
      });
      const rate = this.captureRateHeaders(res);
      const body = await res.json().catch(() => null);
      return { kind: 'response', status: res.status, body, rate };
    } catch (error: any) {
      const reason = error?.name === 'TimeoutError' ? 'タイムアウト' : error?.message || String(error);
      return { kind: 'transport', reason };
    }
  }

  /*
   * P424: サーバー中継でのコード検索（POST /api/github/code-search）。
   * 中継サーバーが GitHub の応答を運べた場合は response（GitHub の
   * ステータス・本文・レートをエンベロープから復元）、中継自体に
   * 届かなかった・中継が GitHub へ届かなかった場合は transport。
   */
  private async trySearchViaRelay(query: string, pat: string): Promise<SearchAttempt> {
    try {
      const res = await fetch(apiUrl('/api/github/code-search'), {
        method: 'POST',
        signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, perPage: 5, githubToken: pat }),
      });
      const envelope = await res.json().catch(() => null);
      if (!envelope || envelope.success !== true) {
        const detail =
          typeof envelope?.error === 'string' && envelope.error
            ? envelope.error
            : `HTTP ${res.status}`;
        return { kind: 'transport', reason: `サーバー中継に失敗しました: ${detail}` };
      }
      const read = (raw: unknown): number =>
        raw != null && raw !== '' ? Number(raw) : Number.NaN;
      return {
        kind: 'response',
        status: Number(envelope.status) || 0,
        body: envelope.data ?? null,
        rate: {
          remaining: read(envelope.rateLimit?.remaining),
          reset: read(envelope.rateLimit?.reset),
        },
      };
    } catch (error: any) {
      const reason =
        error?.name === 'TimeoutError'
          ? 'サーバー中継がタイムアウトしました'
          : `サーバー中継に接続できませんでした: ${error?.message || String(error)}`;
      return { kind: 'transport', reason };
    }
  }

  /*
   * 直接・中継で共通の応答処理。レートをゲートへ反映し、429 では
   * 冷却に入る。経路によらず同じ規則で扱うことで、ミニゲートの
   * 紀律（トークン単位の予算）が輸送経路をまたいで合算される。
   */
  private processSearchResponse(
    attempt: Extract<SearchAttempt, { kind: 'response' }>,
    route: 'direct' | 'relay',
  ): SearchCodeResult {
    this.applyRate(attempt.rate);
    const message =
      typeof attempt.body?.message === 'string'
        ? attempt.body.message.replace(/\s+/g, ' ').trim().slice(0, 200)
        : '';
    if (attempt.status === 429) {
      const reason = message ? `HTTP 429: ${message}` : 'HTTP 429';
      codeSearchGate.cooldownUntil =
        codeSearchGate.resetAt > Date.now() ? codeSearchGate.resetAt : Date.now() + 60000;
      codeSearchGate.cooldownReason = reason;
      return { kind: 'error', reason, rateLimited: true, route };
    }
    if (attempt.status < 200 || attempt.status >= 300) {
      return {
        kind: 'error',
        reason: message ? `HTTP ${attempt.status}: ${message}` : `HTTP ${attempt.status}`,
        route,
      };
    }
    return {
      kind: 'ok',
      items: Array.isArray(attempt.body?.items) ? attempt.body.items : [],
      route,
    };
  }

  private async searchCode(query: string, pat: string): Promise<SearchCodeResult> {
    // ゲートのスロットは論理検索1回につき1つだけ取る。中継への
    // 切り替えは同じスロットの中で行い、経路を変えても開始間隔と
    // 予算の数え方は増えない。
    const slot = await this.acquireSearchSlot();
    if (!slot.ok) return { kind: 'blocked', reason: slot.reason ?? 'GitHubコード検索のゲートで停止しました' };

    const direct = await this.trySearchDirect(query, pat);
    if (direct.kind === 'response') {
      return this.processSearchResponse(direct, 'direct');
    }
    // 輸送レベルの失敗のときだけ中継へ1回切り替える。HTTP エラー
    // （GitHub が応答したもの）は上の分岐で確定済みであり、ここへ
    // は来ない。
    const relay = await this.trySearchViaRelay(query, pat);
    if (relay.kind === 'response') {
      return this.processSearchResponse(relay, 'relay');
    }
    // どちらの経路でも応答が届かなかった。route は付けない
    // （routesUsed は「応答を運んだ経路」の記録であり、試行の
    // 内訳は理由の文面が担う）。
    return {
      kind: 'error',
      reason: `${direct.reason}（直接接続）／${relay.reason}`,
    };
  }

  private async fetchFileBody(
    hit: SearchHit,
    pat: string,
  ): Promise<{ text: string; route: 'direct' | 'relay' } | undefined> {
    if (!hit.repoFullName || !hit.path) return undefined;
    let transportFailed = false;
    try {
      const encodedPath = hit.path.split('/').map(encodeURIComponent).join('/');
      const res = await fetch(
        `${readGitHubApiBase()}/repos/${hit.repoFullName}/contents/${encodedPath}`,
        {
          signal: AbortSignal.timeout(CONTENTS_TIMEOUT_MS),
          headers: {
            Authorization: `Bearer ${pat}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'MIKI-AI0.2',
          },
        },
      );
      // HTTP エラーは GitHub が応答した結果であり、中継へは
      // 切り替えない（検索と同じ規則）。
      if (!res.ok) return undefined;
      const data = await res.json();
      if (data?.encoding !== 'base64' || typeof data?.content !== 'string') return undefined;
      if (typeof data?.size === 'number' && data.size > MAX_CONTENTS_BYTES) return undefined;
      const compact = data.content.replace(/\s+/g, '');
      if (compact.length > Math.ceil(MAX_CONTENTS_BYTES * 1.4)) return undefined;
      const binary = atob(compact);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      return { text: text.slice(0, MAX_CODE_CHARS), route: 'direct' };
    } catch {
      transportFailed = true;
    }
    if (!transportFailed) return undefined;

    // P424: 直接が輸送レベルで失敗した場合に限り、既存の
    // /api/github/file-contents（対象リポジトリのアーカイブから
    // 読む実績経路）を中継として流用する。応答は復号済みの本文
    // 文字列で返る。内容は既定ブランチ時点のものであり、検索
    // 索引の断片との僅かなずれは材料の性質上許容する（断片は
    // evidenceText 側に残る）。
    try {
      const result = await fetchGitHubFileContents(`https://github.com/${hit.repoFullName}`, {
        branch: hit.defaultBranch || undefined,
        githubToken: pat,
        items: [{ path: hit.path }],
      });
      const file = result.files.find(entry => entry.path === hit.path);
      if (!file || typeof file.content !== 'string') return undefined;
      if (file.content.length > MAX_CONTENTS_BYTES) return undefined;
      return { text: file.content.slice(0, MAX_CODE_CHARS), route: 'relay' };
    } catch {
      return undefined;
    }
  }

  // ------------------------------------------------------------------
  // 材料の構成と使用記録
  // ------------------------------------------------------------------

  private buildMaterial(
    question: string,
    hit: SearchHit,
    body: string | undefined,
  ): WebImplementationMaterial | undefined {
    const language = languageForHit(hit);
    const code = (body ?? '').trim();
    const fragment = hit.fragment.trim();
    const codeExamples: WebImplementationMaterial['codeExamples'] = [];
    if (code.length >= 20) {
      codeExamples.push({ language, code: code.slice(0, MAX_CODE_CHARS), sourceUrl: hit.htmlUrl });
    } else if (fragment.length >= 20) {
      codeExamples.push({ language, code: fragment.slice(0, MAX_CODE_CHARS), sourceUrl: hit.htmlUrl });
    }
    if (codeExamples.length === 0) return undefined;

    const dependencySource = code || fragment;
    const dependencySet = new Set<string>();
    const dependencyPatterns = [
      /import\s+.+?\s+from\s+['"]([^'"]+)['"]/g,
      /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];
    for (const pattern of dependencyPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(dependencySource)) !== null) {
        const value = String(match[1] || '').trim();
        if (value) dependencySet.add(value.slice(0, 300));
      }
    }

    return {
      materialId: `IM-${Math.abs(
        Array.from(`${question}|${hit.htmlUrl}`).reduce(
          (hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0,
          0,
        ),
      ).toString(16)}-${Date.now().toString(36)}`,
      sourceQuery: question,
      sourceUrl: hit.htmlUrl,
      sourceId: hit.htmlUrl,
      provider: 'github_code_search',
      fetchMethod: 'api_search',
      implementationApproach:
        `GitHubコード検索で取得した実装例: ${hit.repoFullName} / ${hit.path}`,
      codeExamples,
      dependencies: [...dependencySet].slice(0, 12),
      constraints: [],
      testClues: [],
      evidenceText: (fragment || code).slice(0, 1600),
      extractedAt: Date.now(),
      queryKeywordSources: [...hit.keywordSources],
    };
  }

  private loadUsage(): GitHubCodeMaterialUsageRecord[] {
    try {
      const raw = storageService.getItem(USAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveUsage(records: GitHubCodeMaterialUsageRecord[]): void {
    try {
      storageService.setItem(USAGE_KEY, JSON.stringify(records.slice(-USAGE_LEDGER_CAP)));
    } catch {
      // 使用記録は学習の種であり、書けなくても材料収集自体は止めない。
    }
  }

  private loadAttempts(): GitHubCodeMaterialAttemptRecord[] {
    try {
      const raw = storageService.getItem(ATTEMPTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveAttempts(records: GitHubCodeMaterialAttemptRecord[]): void {
    try {
      storageService.setItem(ATTEMPTS_KEY, JSON.stringify(records.slice(-ATTEMPTS_LEDGER_CAP)));
    } catch {
      // 試行記録は学習の種であり、書けなくても材料収集自体は止めない。
    }
  }

  private recordAttempt(record: GitHubCodeMaterialAttemptRecord): void {
    const ledger = this.loadAttempts();
    ledger.push(record);
    this.saveAttempts(ledger);
  }

  private recordUsage(
    materials: WebImplementationMaterial[],
    hits: SearchHit[],
  ): void {
    const hitByUrl = new Map(hits.map(hit => [hit.htmlUrl, hit]));
    const ledger = this.loadUsage();
    for (const material of materials) {
      const hit = hitByUrl.get(material.sourceUrl);
      ledger.push({
        materialId: material.materialId,
        sourceId: material.sourceId,
        sourceUrl: material.sourceUrl,
        query: hit?.queryText ?? '',
        keywordSources: [...(material.queryKeywordSources ?? [])] as GitHubCodeKeywordSource[],
        collectedAt: Date.now(),
        usedInGeneration: false,
        // P424: 内容を運んだ経路（実本文があればその経路、無ければ
        // 検索の経路）。
        ...(hit ? { route: hit.bodyRoute ?? hit.route } : {}),
      });
    }
    this.saveUsage(ledger);
  }
}

export const githubCodeMaterialService = new GitHubCodeMaterialService();
