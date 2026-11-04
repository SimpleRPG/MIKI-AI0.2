import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { selfCodeUnderstandingService } from './selfCodeUnderstandingService';
import {
  japaneseAnalysisService,
  contentTermsFromTokens,
} from '../../research/services/japaneseAnalysisService';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { privacyGuardrailService } from '../../safety/services/privacyGuardrailService';
import { sanitizeOutboundPayload } from '../../safety/services/outboundPayloadSanitizer';
import type { WebImplementationMaterial } from '../../research/services/webMaterialPatternExtractor';
import type { CodeMaterialCollectionContext } from './githubCodeMaterialService';

/*
 * P423: Stack Exchange を「ノウハウ参照専用」の材料チャネルとして
 * 研究層へ接続する。
 *
 * 位置付け（調査報告「追加コード系ソース」§2・§5）: 材料の種類で
 * 行き先を変える原則のうち、GitHub（P422）が「動くコードの実物」を
 * 担うのに対し、Stack Exchange は「やり方の説明＋落とし穴＋なぜ
 * その書き方か」という別種の材料を担う。API は公式に安定しており、
 * キー無しでも動く（IP あたり日次クォータ制）。
 *
 * 参照専用の設計制約（ユーザー決定・最重要）: Stack Exchange の
 * 投稿は CC BY-SA であり、回答のコード断片をほぼそのまま写した
 * 部品が公開リポジトリへ出ると、公開配布時にライセンス継承が
 * 問題化し得る。その経路を構造的に塞ぐため、本チャネルの材料は
 * 回答の説明文（やり方・注意点）だけを implementationApproach /
 * evidenceText へ入れ、コード断片は codeExamples へ一切入れない
 * （回答 HTML の <pre> ブロックは参照テキスト化の段階で除去する）。
 * 生成段の parseImplementationMaterials は codeExamples のみを
 * 候補化するため、参照材料が写しとして部品化されることはない。
 * これは MIKI の思想「外部は素材まで、分解・理解して自分で作る」
 * とも一致する。帰属のため、材料レコードには出典 URL・著者名・
 * 著者プロフィール URL・content_license を必ず保持する。
 *
 * 認証: 読み取りは認証不要。任意の公開キー（stackapps.com で
 * 無料登録して得る、秘密情報ではない公開キー）を設定キーに
 * 保存しておくと key= として付け、クォータが 300/日 → 10,000/日
 * へ広がる。キーの取得自体はユーザーの手作業であり本便の範囲外。
 *
 * 紀律（予算台帳型）: 日次クォータ制なので P422 の分あたり
 * ミニゲートとは型が違い、OpenAlex の予算記録に近い形を取る。
 * 応答エンベロープの quota_max / quota_remaining を永続台帳へ
 * 残し、残量が上限の 10%（最低 30 回）以下になったらその日の
 * 発射を止める（停止は新しい収集単位＝サイト検索の開始に適用し、
 * 開始済みの検索への回答取得はその収集の完結として許可する）。
 * 応答に backoff（秒）が含まれれば、その間は
 * 次の 1 リクエストも送らない（検索に backoff が付いた場合は
 * 回答取得も送らない）。throttle_violation は backoff 扱いで
 * 冷却し、理由を残して静かに引く。原則として再試行はしないが、
 * P427 で唯一の例外を入れた: 検索が items=0 のときだけ、
 * accepted フィルタを外して 1 回だけ広げ直す（消費はサイト
 * あたり「検索最大 2 回＋回答取得 1 回」となり、予算台帳・
 * backoff の枠内に収まる）。主サイト stackoverflow に加えて、
 * ゲーム開発の文脈信号がある場合のみ gamedev を足す（最大 2 サイト）。
 *
 * クエリ整形: Stack Exchange の q はタイトル＋本文へのフリー
 * ワード検索であり、語数に強く敏感である。P427 で、P422 の整形
 * 資産（索引語彙の照合／JMdict グロス橋渡し）の優先順位を組み
 * 替えた: q は最大3語とし、優先順位はグロス変換語（一般英語
 * 語）→ 問いの要点語 → 契約語（camelCase を分割した一般語
 * としてのみ）。自己コード索引で確認できる内部識別子は丸ごと
 * 入れない（Stack Overflow の投稿に存在しないため、含む袋は
 * 必ず0件になる。分離項目調査の VM 実測で切り分け済み）。
 * 対象言語が対象パスの拡張子から確実な場合のみ tagged を
 * 付ける。
 *
 * 使用記録（学習の種）: P422 の台帳と同じ流儀で、材料ごとに
 * 当たったクエリとキーワードの材料源、帰属情報を台帳に残す。
 * 参照材料は部品候補化されないため、使用印は「生成試行の材料
 * として届いた」時点（candidateCodeGenerationService が
 * markMaterialsUsed を呼ぶ）で付ける。重み付けの学習は含めない。
 */

export type StackExchangeKeywordSource =
  | 'CONTRACT'
  | 'GLOSS'
  | 'INDEX_VOCAB'
  | 'QUESTION';

export type StackExchangeMaterialStatusKind =
  | 'SUCCEEDED'
  | 'EMPTY'
  | 'FAILED'
  | 'SKIPPED';

export interface StackExchangeMaterialOutcome {
  materials: WebImplementationMaterial[];
  status: StackExchangeMaterialStatusKind;
  error?: string;
  requestsUsed: number;
}

export interface StackExchangeChannelState {
  quotaMax: number | null;
  quotaRemaining: number | null;
  quotaStopped: boolean;
  backoffRemainingMs: number;
  backoffReason: string;
}

export interface StackExchangeMaterialUsageRecord {
  materialId: string;
  sourceId: string;
  sourceUrl: string;
  site: string;
  query: string;
  keywordSources: StackExchangeKeywordSource[];
  authorName: string;
  authorUrl: string;
  contentLicense: string;
  collectedAt: number;
  usedInGeneration: boolean;
  usedAt?: number;
}

/*
 * P427（学習の段階0）: 収集の試行レベル記録。使用台帳は「当たった
 * 材料」しか残らないため、チャネルごとの成功率（分母）が永遠に
 * 計算できなかった。試行記録は収集の出口ごとに status・整形クエリ・
 * キーワード材料源・消費リクエスト数・取得件数を別のキーへ有界で
 * 残す。空・失敗・スキップも記録する。挙動を変える消費者はまだ
 * 置かない（将来の重み付け学習の前提工事）。
 */
export interface StackExchangeMaterialAttemptRecord {
  status: StackExchangeMaterialStatusKind;
  shapedQuery: string;
  keywordSources: StackExchangeKeywordSource[];
  requestsUsed: number;
  materialCount: number;
  collectedAt: number;
}

interface ShapedQuery {
  text: string;
  keywordSources: StackExchangeKeywordSource[];
  tagged?: string;
}

interface AnswerPick {
  questionId: number;
  questionTitle: string;
  questionLink: string;
  questionLicense: string;
  questionScore: number;
  prose: string;
  authorName: string;
  authorUrl: string;
  contentLicense: string;
  queryText: string;
  keywordSources: StackExchangeKeywordSource[];
  site: string;
}

const SETTINGS_KEY = 'miki_stackexchange_material_settings_v1';
const USAGE_KEY = 'miki_stackexchange_material_usage_v1';
const ATTEMPTS_KEY = 'miki_stackexchange_material_attempts_v1';
const ATTEMPTS_LEDGER_CAP = 200;
const QUOTA_KEY = 'miki_stackexchange_material_quota_v1';
const API_URL_KEY = 'miki_stackexchange_api_url';
const DEFAULT_API_BASE = 'https://api.stackexchange.com/2.3';
const REQUEST_TIMEOUT_MS = 8000;
const COLLECTION_DEADLINE_MS = 30000;
const MAX_QUESTIONS_PER_SITE = 3;
const MAX_MATERIALS = 3;
const MIN_PROSE_CHARS = 60;
const QUOTA_STOP_FRACTION = 0.1;
const QUOTA_STOP_FLOOR = 30;
const DEFAULT_BACKOFF_SEC = 60;
const USAGE_LEDGER_CAP = 100;
const DEFAULT_LICENSE = 'CC BY-SA 4.0';
const PRIMARY_SITE = 'stackoverflow';

// 対象言語が拡張子から確実な場合にだけ使う Stack Overflow のタグ。
const TAG_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  kt: 'kotlin',
  java: 'java',
  py: 'python',
  go: 'go',
  rs: 'rust',
};

// ゲーム開発の文脈信号。これがある場合のみ gamedev を対象に足す。
const GAME_SIGNAL_PATTERN = /(ゲーム|gamedev|game\s*dev|unity|unreal)/i;

// GitHub チャネルと同じく、問いのテンプレート文の一般語は要点語にしない。
const QUESTION_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'find', 'needed',
  'objective', 'current', 'repository', 'context', 'structured', 'goal',
  'latent', 'intent', 'deliverables', 'determine', 'required', 'reusable',
]);

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

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/*
 * 回答 HTML から参照テキストを作る。<pre> ブロック（コード断片の
 * 実体）は丸ごと除去し、説明文だけを残す。これが参照専用の実体的な
 * 関門であり、除去後のテキストにコード断片は含まれない。
 */
function answerHtmlToReferenceText(html: string): string {
  let text = String(html || '');
  text = text.replace(/<pre[\s\S]*?<\/pre>/gi, ' ');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|li|div|blockquote|h[1-6])>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = decodeEntities(text);
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .replace(/^\s+|\s+$/g, '')
    .trim();
}

function utcDayKey(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

function readApiBase(): string {
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

interface QuotaSnapshot {
  dayKey: string;
  quotaMax: number;
  quotaRemaining: number;
  updatedAt: number;
}

// backoff の状態（メモリ上のみ。P422 のゲート冷却と同じ持ち方）。
const backoffState = {
  until: 0,
  reason: '',
};

let vocabCache: { key: string; words: Set<string>; names: Set<string> } | null = null;

class StackExchangeMaterialService {
  getSettings(): { enabled: boolean; apiKey: string } {
    try {
      const raw = storageService.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        enabled: parsed?.enabled !== false,
        apiKey: typeof parsed?.apiKey === 'string' ? parsed.apiKey : '',
      };
    } catch {
      return { enabled: true, apiKey: '' };
    }
  }

  saveSettings(input: { enabled?: boolean; apiKey?: string }): { enabled: boolean; apiKey: string } {
    const current = this.getSettings();
    const next = {
      enabled: input.enabled !== undefined ? input.enabled : current.enabled,
      apiKey: typeof input.apiKey === 'string' ? input.apiKey.trim() : current.apiKey,
    };
    storageService.setItem(SETTINGS_KEY, JSON.stringify(next));
    return next;
  }

  getChannelState(): StackExchangeChannelState {
    const quota = this.loadQuota();
    return {
      quotaMax: quota?.quotaMax ?? null,
      quotaRemaining: quota?.quotaRemaining ?? null,
      quotaStopped: this.isQuotaStopped(quota),
      backoffRemainingMs: Math.max(0, backoffState.until - Date.now()),
      backoffReason: backoffState.reason,
    };
  }

  /*
   * 検証用・設定変更後の運用者リセット用（P422 の resetGate と
   * 同じ位置付け）。永続化されたクォータ台帳は API 応答の実績で
   * あるため消さない。
   */
  resetChannel(): void {
    backoffState.until = 0;
    backoffState.reason = '';
  }

  listUsage(limit = 50): StackExchangeMaterialUsageRecord[] {
    return this.loadUsage().slice(-Math.max(1, limit));
  }

  // P427（段階0）: 試行レベル記録の読み出し。使用台帳とは別系統で、
  // 空・失敗を含む収集の全試行が対象（成功率の分母）。
  listAttempts(limit = 50): StackExchangeMaterialAttemptRecord[] {
    return this.loadAttempts().slice(-Math.max(1, limit));
  }

  /*
   * 生成試行へ参照材料として届いた時点で呼ばれる使用印。
   * 台帳に無い sourceId は無視する（Web／GitHub 由来の材料など）。
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
   * 決定的なクエリ整形。Stack Exchange の q はフリーワード検索の
   * ため、グロス変換語・問いの要点語・契約の一般語を最大3語の
   * 1 本へ統合する（P427。内部識別子の丸ごとは入れない）。
   */
  buildQueries(
    question: string,
    context?: CodeMaterialCollectionContext,
  ): Array<{ text: string; keywordSources: StackExchangeKeywordSource[]; tagged?: string }> {
    const shaped = this.shapeQuery(question, context);
    return shaped ? [{ text: shaped.text, keywordSources: shaped.keywordSources, ...(shaped.tagged ? { tagged: shaped.tagged } : {}) }] : [];
  }

  async collectMaterials(
    question: string,
    context?: CodeMaterialCollectionContext,
  ): Promise<StackExchangeMaterialOutcome> {
    // P427（段階0）: 試行記録は収集の全出口（done）で 1 件だけ残す。
    // 整形前のスキップでは shapedQuery は空になる。
    let attemptQueryText = '';
    let attemptKeywordSources: StackExchangeKeywordSource[] = [];
    const done = (
      status: StackExchangeMaterialStatusKind,
      materials: WebImplementationMaterial[],
      requestsUsed: number,
      error?: string,
    ): StackExchangeMaterialOutcome => {
      this.recordAttempt({
        status,
        shapedQuery: attemptQueryText,
        keywordSources: [...attemptKeywordSources],
        requestsUsed,
        materialCount: materials.length,
        collectedAt: Date.now(),
      });
      return { materials, status, requestsUsed, ...(error ? { error } : {}) };
    };

    if (!this.getSettings().enabled) {
      return done('SKIPPED', [], 0, 'Stack Exchange材料チャネルは設定で無効です');
    }

    const outbound = sanitizeOutboundPayload(question, (serialized) =>
      privacyGuardrailService.auditOutboundContent(serialized, 'web_search', { autoSanitize: true }),
    );
    if (!outbound.allowed || typeof outbound.payload !== 'string') {
      systemLogger.warn('SELF_IMPROVEMENT', '🚫 [Stack Exchange] outbound sanitization failed; query redacted');
      return done('SKIPPED', [], 0, 'プライバシー保護のためStack Exchange検索を安全にスキップしました');
    }
    const safeQuestion = outbound.payload;

    const shaped = this.shapeQuery(safeQuestion, context);
    if (!shaped) {
      return done('SKIPPED', [], 0, '問いと契約から検索キーワードを導出できませんでした');
    }
    attemptQueryText = shaped.text;
    attemptKeywordSources = [...shaped.keywordSources];

    const sites = this.targetSites(safeQuestion, context);
    const deadline = Date.now() + COLLECTION_DEADLINE_MS;
    const picks: AnswerPick[] = [];
    let requestsUsed = 0;
    let lastError = '';
    let sawSuccessfulSearch = false;

    for (const site of sites) {
      if (picks.length >= MAX_MATERIALS || Date.now() > deadline) break;
      const searchParams = (accepted: boolean): Record<string, string> => ({
        site,
        q: shaped.text,
        ...(accepted ? { accepted: 'True' } : {}),
        answers: '1',
        order: 'desc',
        sort: 'votes',
        pagesize: '5',
        ...(shaped.tagged && site === PRIMARY_SITE ? { tagged: shaped.tagged } : {}),
      });
      let search = await this.apiGet('/search/advanced', searchParams(true));
      if (search.kind === 'blocked') {
        // backoff 中・クォータ停止中は発射自体をしていない。
        lastError = search.reason;
        break;
      }
      requestsUsed += search.requestsUsed;
      if (
        search.kind === 'ok' &&
        (Array.isArray(search.data?.items) ? search.data.items.length : 0) === 0
      ) {
        // P427: accepted フィルタは母数を大きく削るため、items=0 の
        // ときだけフィルタを外して 1 回だけ広げ直す（tagged は維持）。
        // 再検索も apiGet の予算台帳・backoff の枠内であり、消費は
        // サイトあたり検索最大 2 回＋回答 1 回に収まる。
        const widened = await this.apiGet('/search/advanced', searchParams(false));
        if (widened.kind === 'blocked') {
          lastError = widened.reason;
          break;
        }
        requestsUsed += widened.requestsUsed;
        if (widened.kind === 'ok') {
          search = widened;
        } else {
          // 広げ直しの失敗で、成功していた初回（0 件）を失敗へ
          // 格下げはしない。理由だけ残す。
          lastError = widened.reason;
        }
      }
      if (search.kind !== 'ok') {
        lastError = search.reason;
        continue;
      }
      sawSuccessfulSearch = true;
      const questions = (Array.isArray(search.data?.items) ? search.data.items : [])
        .filter((item: any) => item && typeof item.question_id === 'number')
        .filter((item: any) => item.accepted_answer_id || Number(item.answer_count ?? 0) > 0)
        .slice(0, MAX_QUESTIONS_PER_SITE);
      if (questions.length === 0) continue;

      const ids = questions.map((item: any) => item.question_id).join(';');
      const answers = await this.apiGet(
        `/questions/${ids}/answers`,
        {
          site,
          order: 'desc',
          sort: 'votes',
          pagesize: '10',
          filter: 'withbody',
        },
        { quotaGate: false },
      );
      requestsUsed += answers.requestsUsed;
      if (answers.kind !== 'ok') {
        // backoff が検索応答に付いていた場合など、回答取得を送らずに引く。
        if (answers.kind === 'error') lastError = answers.reason;
        continue;
      }
      const answerItems = Array.isArray(answers.data?.items) ? answers.data.items : [];
      for (const questionItem of questions) {
        if (picks.length >= MAX_MATERIALS) break;
        const candidates = answerItems.filter(
          (answer: any) => answer && answer.question_id === questionItem.question_id,
        );
        if (candidates.length === 0) continue;
        const best =
          candidates.find((answer: any) => answer.is_accepted) ?? candidates[0];
        const prose = answerHtmlToReferenceText(String(best.body ?? ''));
        if (prose.length < MIN_PROSE_CHARS) continue;
        picks.push({
          questionId: questionItem.question_id,
          questionTitle: decodeEntities(String(questionItem.title ?? '')).trim(),
          questionLink: String(questionItem.link ?? ''),
          questionLicense: String(questionItem.content_license ?? ''),
          questionScore: Number(questionItem.score ?? 0),
          prose,
          authorName: String(best.owner?.display_name ?? '').trim() || 'unknown',
          authorUrl: String(best.owner?.link ?? ''),
          contentLicense:
            String(best.content_license ?? '') ||
            String(questionItem.content_license ?? '') ||
            DEFAULT_LICENSE,
          queryText: shaped.text,
          keywordSources: shaped.keywordSources,
          site,
        });
      }
    }

    if (picks.length === 0) {
      if (!sawSuccessfulSearch && lastError) {
        systemLogger.info('SELF_IMPROVEMENT', `ℹ️ [Stack Exchange] 取得失敗: ${lastError}`);
        return done('FAILED', [], requestsUsed, lastError);
      }
      systemLogger.info('SELF_IMPROVEMENT', '🔍 [Stack Exchange] 該当するノウハウ材料はありませんでした');
      return done('EMPTY', [], requestsUsed, lastError || undefined);
    }

    const materials = picks
      .map(pick => this.buildMaterial(safeQuestion, pick))
      .filter((material): material is WebImplementationMaterial => Boolean(material));
    if (materials.length === 0) {
      return done('EMPTY', [], requestsUsed, '検索ヒットから材料を構成できませんでした');
    }

    this.recordUsage(materials, picks);
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🔍 [Stack Exchange] ノウハウ参照材料を ${materials.length} 件取得しました（リクエスト ${requestsUsed} 回）`,
    );
    return done('SUCCEEDED', materials, requestsUsed);
  }

  // ------------------------------------------------------------------
  // 対象サイトとクエリ整形
  // ------------------------------------------------------------------

  private targetSites(
    question: string,
    context?: CodeMaterialCollectionContext,
  ): string[] {
    const sites = [PRIMARY_SITE];
    const haystack = [
      question,
      ...(context?.targetPaths ?? []),
    ].join('\n');
    if (GAME_SIGNAL_PATTERN.test(haystack)) sites.push('gamedev');
    return sites;
  }

  private shapeQuery(
    question: string,
    context?: CodeMaterialCollectionContext,
  ): ShapedQuery | undefined {
    const contract = context?.gapContract;
    const targetPaths = (context?.targetPaths ?? []).filter(Boolean);
    const vocab = this.indexVocabulary();
    const sources = new Set<StackExchangeKeywordSource>();
    const terms: string[] = [];
    // P427: /search/advanced の q は語数に強く敏感で、珍しい語を
    // 含む長い袋は実質 AND 的に潰れる（分離項目調査の VM 実測:
    // 復元形8語はフィルタ全なしでも items=0、短い2語は同じ
    // フィルタで items=5）。q は最大3語へ絞る。
    const MAX_QUERY_TERMS = 3;
    const pushTerms = (values: string[], source: StackExchangeKeywordSource, cap: number) => {
      let added = 0;
      for (const value of values) {
        if (added >= cap || terms.length >= MAX_QUERY_TERMS) break;
        const term = value.trim();
        if (term.length < 3 || terms.includes(term)) continue;
        terms.push(term);
        added += 1;
      }
      if (added > 0) sources.add(source);
    };
    // 自己コード索引の語彙（export 名・シンボル名の完全一致）で
    // 確認できる識別子は MIKI 内部の名前であり、Stack Overflow の
    // 投稿には存在しないことがほぼ確定するため、丸ごとでは q へ
    // 入れない。
    const isInternalIdentifier = (term: string): boolean =>
      vocab.names.has(term.toLowerCase());

    // 1. グロス橋渡し（最優先）: 問いの日本語内容語を JMdict
    // グロスの一般英語語へ。汎用語が短い q の主軸になる。
    pushTerms(this.glossBridgeWords(question), 'GLOSS', MAX_QUERY_TERMS);

    // 2. 問いの要点語: 日本語の内容語と、問いに含まれる識別子の
    // うち内部識別子でないもの（ライブラリ名等は残す）。
    const questionTerms: string[] = [];
    try {
      for (const term of contentTermsFromTokens(japaneseAnalysisService.analyze(question).tokens)) {
        if (term.length >= 2 && !questionTerms.includes(term)) questionTerms.push(term);
      }
    } catch {
      // 形態素解析が使えない環境では英字識別子のみで組み立てる。
    }
    for (const term of question.match(/[A-Za-z_$][A-Za-z0-9_$]{2,}/g) ?? []) {
      if (!QUESTION_STOPWORDS.has(term.toLowerCase()) && !questionTerms.includes(term)) {
        questionTerms.push(term);
      }
    }
    pushTerms(
      questionTerms.filter(term => !isInternalIdentifier(term)),
      'QUESTION',
      MAX_QUERY_TERMS,
    );

    // 3. 契約語（最後）: 不足スロット名・シグネチャ名・export 名は
    // camelCase を分割した一般語としてのみ入れる。内部識別子の
    // 丸ごとは入れない。分割語は一般英語語として扱う。
    const contractWords: string[] = [];
    if (contract) {
      const contractRaw: string[] = [];
      for (const slot of contract.missingSlots ?? []) {
        if (slot.slotName && slot.slotName.length >= 3) contractRaw.push(slot.slotName);
      }
      for (const target of contract.targets ?? []) {
        for (const signature of target.signatures ?? []) {
          if (signature.name && signature.name.length >= 3) contractRaw.push(signature.name);
        }
        for (const name of target.exports ?? []) {
          if (name && name.length >= 3) contractRaw.push(name);
        }
      }
      for (const raw of unique(contractRaw)) {
        for (const word of splitIdentifierWords(raw)) {
          if (!contractWords.includes(word)) contractWords.push(word);
        }
      }
    }
    pushTerms(contractWords, 'CONTRACT', MAX_QUERY_TERMS);

    if (terms.length === 0) return undefined;

    const tagged = (() => {
      for (const path of [...targetPaths, ...(contract?.targets ?? []).map(t => t.path)]) {
        const ext = path.split('.').pop()?.toLowerCase() ?? '';
        if (TAG_BY_EXTENSION[ext]) return TAG_BY_EXTENSION[ext];
      }
      return undefined;
    })();

    return {
      text: terms.join(' '),
      keywordSources: [...sources],
      ...(tagged ? { tagged } : {}),
    };
  }

  /*
   * P402 / P422 と同じ JMdict グロス橋渡し。辞書が無い環境では
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
  // Stack Exchange API（予算台帳と backoff の順守）
  // ------------------------------------------------------------------

  private loadQuota(): QuotaSnapshot | null {
    try {
      const raw = storageService.getItem(QUOTA_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (
        parsed &&
        parsed.dayKey === utcDayKey(Date.now()) &&
        Number.isFinite(parsed.quotaMax) &&
        Number.isFinite(parsed.quotaRemaining)
      ) {
        return parsed as QuotaSnapshot;
      }
    } catch {
      // 台帳が読めなければ未観測として扱う。
    }
    return null;
  }

  private saveQuota(data: any): void {
    const quotaMax = Number(data?.quota_max);
    const quotaRemaining = Number(data?.quota_remaining);
    if (!Number.isFinite(quotaMax) || !Number.isFinite(quotaRemaining)) return;
    try {
      storageService.setItem(
        QUOTA_KEY,
        JSON.stringify({
          dayKey: utcDayKey(Date.now()),
          quotaMax,
          quotaRemaining,
          updatedAt: Date.now(),
        } satisfies QuotaSnapshot),
      );
    } catch {
      // 予算台帳は学習の種であり、書けなくても収集自体は止めない。
    }
  }

  private isQuotaStopped(quota: QuotaSnapshot | null): boolean {
    if (!quota) return false;
    const threshold = Math.max(
      QUOTA_STOP_FLOOR,
      Math.floor(quota.quotaMax * QUOTA_STOP_FRACTION),
    );
    return quota.quotaRemaining <= threshold;
  }

  private async apiGet(
    path: string,
    params: Record<string, string>,
    options?: { quotaGate?: boolean },
  ): Promise<
    | { kind: 'ok'; data: any; requestsUsed: number }
    | { kind: 'blocked'; reason: string; requestsUsed: 0 }
    | { kind: 'error'; reason: string; requestsUsed: number }
  > {
    const now = Date.now();
    if (backoffState.until > now) {
      const remainSec = Math.ceil((backoffState.until - now) / 1000);
      return {
        kind: 'blocked',
        reason: `Stack Exchange APIのbackoff中です（残り約${remainSec}秒）: ${backoffState.reason}`,
        requestsUsed: 0,
      };
    }
    // クォータ停止は「新しい収集単位（サイト検索）の開始」に適用する。
    // 開始済みの検索に対する回答取得は、その収集を完結させるための
    // 対の後半であり、消費した検索を無駄にしないため止めない
    // （backoff は API の指示として回答取得にも常時適用する）。
    if (options?.quotaGate !== false) {
      const quota = this.loadQuota();
      if (this.isQuotaStopped(quota)) {
        return {
          kind: 'blocked',
          reason: `Stack Exchangeの日次クォータ残量が閾値以下のため発射を止めています（残り ${quota?.quotaRemaining} 回）`,
          requestsUsed: 0,
        };
      }
    }
    try {
      const url = new URL(`${readApiBase()}${path}`);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      const apiKey = this.getSettings().apiKey;
      if (apiKey) url.searchParams.set('key', apiKey);
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { 'User-Agent': 'MIKI-AI0.2' },
      });
      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object') this.saveQuota(data);
      const backoffSec = Number((data as any)?.backoff);
      if (Number.isFinite(backoffSec) && backoffSec > 0) {
        backoffState.until = Date.now() + backoffSec * 1000;
        backoffState.reason = 'API応答のbackoff指示';
      }
      if (data && typeof data === 'object' && 'error_id' in data) {
        const name = String((data as any).error_name ?? 'api_error');
        const message = String((data as any).error_message ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
        const reason = message ? `${name}: ${message}` : name;
        if (Number((data as any).error_id) === 502 && !(Number.isFinite(backoffSec) && backoffSec > 0)) {
          // throttle_violation は backoff 扱いで冷却する。
          backoffState.until = Date.now() + DEFAULT_BACKOFF_SEC * 1000;
          backoffState.reason = reason;
        }
        return { kind: 'error', reason, requestsUsed: 1 };
      }
      if (!res.ok) {
        return { kind: 'error', reason: `HTTP ${res.status}`, requestsUsed: 1 };
      }
      return { kind: 'ok', data, requestsUsed: 1 };
    } catch (error: any) {
      const reason = error?.name === 'TimeoutError' ? 'タイムアウト' : error?.message || String(error);
      return { kind: 'error', reason, requestsUsed: 1 };
    }
  }

  // ------------------------------------------------------------------
  // 材料の構成と使用記録
  // ------------------------------------------------------------------

  private buildMaterial(
    question: string,
    pick: AnswerPick,
  ): WebImplementationMaterial | undefined {
    if (!pick.questionLink) return undefined;
    return {
      materialId: `IM-${Math.abs(
        Array.from(`${question}|${pick.questionLink}`).reduce(
          (hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0,
          0,
        ),
      ).toString(16)}-${Date.now().toString(36)}`,
      sourceQuery: question,
      sourceUrl: pick.questionLink,
      sourceId: pick.questionLink,
      provider: 'stackexchange_qa',
      fetchMethod: 'api_search',
      implementationApproach:
        `Stack Exchange（${pick.site}）の回答に基づくノウハウ参照: ${pick.questionTitle}\n${pick.prose.slice(0, 900)}`,
      // 参照専用: 回答のコード断片は写せる材料へ入れない（設計制約）。
      codeExamples: [],
      dependencies: [],
      constraints: [],
      testClues: [],
      evidenceText: pick.prose.slice(0, 1600),
      extractedAt: Date.now(),
      queryKeywordSources: [...pick.keywordSources],
      authorName: pick.authorName,
      authorUrl: pick.authorUrl,
      contentLicense: pick.contentLicense,
      referenceOnly: true,
    };
  }

  private loadUsage(): StackExchangeMaterialUsageRecord[] {
    try {
      const raw = storageService.getItem(USAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveUsage(records: StackExchangeMaterialUsageRecord[]): void {
    try {
      storageService.setItem(USAGE_KEY, JSON.stringify(records.slice(-USAGE_LEDGER_CAP)));
    } catch {
      // 使用記録は学習の種であり、書けなくても材料収集自体は止めない。
    }
  }

  private loadAttempts(): StackExchangeMaterialAttemptRecord[] {
    try {
      const raw = storageService.getItem(ATTEMPTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveAttempts(records: StackExchangeMaterialAttemptRecord[]): void {
    try {
      storageService.setItem(ATTEMPTS_KEY, JSON.stringify(records.slice(-ATTEMPTS_LEDGER_CAP)));
    } catch {
      // 試行記録は学習の種であり、書けなくても材料収集自体は止めない。
    }
  }

  private recordAttempt(record: StackExchangeMaterialAttemptRecord): void {
    const ledger = this.loadAttempts();
    ledger.push(record);
    this.saveAttempts(ledger);
  }

  private recordUsage(
    materials: WebImplementationMaterial[],
    picks: AnswerPick[],
  ): void {
    const pickByUrl = new Map(picks.map(pick => [pick.questionLink, pick]));
    const ledger = this.loadUsage();
    for (const material of materials) {
      const pick = pickByUrl.get(material.sourceUrl);
      ledger.push({
        materialId: material.materialId,
        sourceId: material.sourceId,
        sourceUrl: material.sourceUrl,
        site: pick?.site ?? PRIMARY_SITE,
        query: pick?.queryText ?? '',
        keywordSources: [...(material.queryKeywordSources ?? [])] as StackExchangeKeywordSource[],
        authorName: material.authorName ?? '',
        authorUrl: material.authorUrl ?? '',
        contentLicense: material.contentLicense ?? DEFAULT_LICENSE,
        collectedAt: Date.now(),
        usedInGeneration: false,
      });
    }
    this.saveUsage(ledger);
  }
}

export const stackExchangeMaterialService = new StackExchangeMaterialService();
