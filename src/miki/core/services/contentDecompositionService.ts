/**
 * contentDecompositionService.ts (P3019)
 *
 * 取り込み内容の「分解」工程。登録済みコンテンツ（まず教師教材の
 * レッスン。本文は rule）を原子文へ割り、本文自身が明示する関係
 * （因果 CAUSES／条件 CONDITION／順序 SEQUENCE）だけをリンクとして
 * 記録する。本文が主張していない関係は作らない（誤った「ので」は
 * 欠けた「ので」より悪い、という P3014 以来の注意書きに従う）。
 * 割れなかった文は文のまま残し、テキストは決して捨てない
 * （割れなければ本文全体が1文になるのが最悪ケース）。
 *
 * 分解は取り込みの一般工程：入力は decomposeItem の一般形
 * （parentKind / parentId / parentTitle / text / verification /
 * 任意で parentComponentId・sourceRef）で、レッスンの形に限らない。
 * 今回配線するのは TEACHER_LESSON（decomposeComponent アダプタ）。
 * 既存ストック（主張・世界知識）への適用は後続スライスが同じ
 * decomposeItem を項目ごとに呼んで行う——主張は既に原子的なので、
 * そちらで要るのは主に「主張どうしのリンク抽出」である。
 *
 * 未解決参照（概念の穴、P3019 追加設計）：
 * 文が参照する語に対応するノードがグラフに無い場合、勝手に
 * リンクを作らず「未解決参照」として台帳に残す。解決は3段：
 *   1. グラフ内解決：レッスン名・ID、主張文、世界モデルの実体名、
 *      コード索引（ファイル名・シンボル名）、辞書から学んだ語
 *      ノードのいずれかに一致すれば解決（＝リンク先がある）。
 *   2. 辞書解決：彼女の辞書（japaneseDictionaryService）に gloss
 *      があり、その定義文に出る語もすべて 1/2 で接地するなら、
 *      彼女は辞書から自分で学べる。定義文は「辞書を出典とする
 *      未検証の文」として分解し、別レコード（parentKind=
 *      DICTIONARY）に記録する（出典つき主張と同じ扱い）。
 *   3. 概念の穴：定義の連鎖が接地しない／辞書に gloss が無い語は
 *      穴として残し、未知語ギャップ（UNKNOWN_TERM）へ回す。
 *      外部の概念供給が埋めるべきはこの一覧だけ。
 * 未知の「語」であって未知の「概念」とは限らない、という区別が
 * この3段の要点（2で学べる語を穴に数えない）。
 *
 * 台帳は診断台帳（diagnosisTaskService）と同じ作法：
 * storageService 永続化、読み書きの失敗は握りつぶして本体を
 * 壊さない。直接 DB 注入はしない（分解は彼女の取り込み経路の
 * 中で走り、結果はこの台帳とグラフ射影にだけ現れる）。
 */
import { storageService } from '../../../services/storageService';
import {
  isStorageAuthoritativeNow,
  runWhenStorageAuthoritative,
} from '../../../services/deferredStoreLoad';
import { systemLogger } from '../../../services/systemLogger';
import { canonicalSha256 } from './canonicalSha256Service';
import { isTrustedVerifierName } from './trustedVerifier';
import { componentRepositoryCacheService } from '../../memory/services/componentRepositoryCacheService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { worldModelGraphService } from '../../selfAwareness/services/worldModelGraphService';
import { selfCodeUnderstandingService } from './selfCodeUnderstandingService';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';

export type DecompositionLinkKind = 'CAUSES' | 'CONDITION' | 'SEQUENCE';
export type DecompositionVerification = 'CLAUDE_VERIFIED' | 'SELF_GATED' | 'UNVERIFIED';

export interface DecompositionLink {
  fromIndex: number;
  toIndex: number;
  kind: DecompositionLinkKind;
  /** リンクの根拠になった接続表現そのもの（例: 「ので」「すると」）。 */
  marker: string;
}

export interface UnresolvedReference {
  term: string;
  statementIndexes: number[];
  outcome: 'resolved-by-dictionary' | 'concept-hole';
  /** concept-hole の理由（辞書に無い／定義が未接地の語を含む 等）。 */
  reason?: string;
  /** resolved-by-dictionary のとき：定義の出典（辞書の source）。 */
  definitionSource?: string;
  /** resolved-by-dictionary のとき：定義文の分解レコード。 */
  definitionRecordId?: string;
  /** 定義文の中で接地しなかった語（連鎖が底をついた先）。 */
  ungroundedTerms?: string[];
}

export interface ContentDecompositionRecord {
  recordId: string;
  /** 'TEACHER_LESSON'（教材）| 'DICTIONARY'（辞書の定義文）| その他の登録項目の種別名（decomposeItem の呼び出し側が決める）。 */
  parentKind: string;
  /** 親部品の componentId。DICTIONARY レコードでは ''。 */
  parentComponentId: string;
  /** 親の識別子（レッスン ID、DICTIONARY では語そのもの）。 */
  parentId: string;
  parentTitle: string;
  /** DICTIONARY レコードの出典（例: 'dictionary:JMdict'）。 */
  sourceRef?: string;
  /** 親から引き継ぐ検証状態（P3007：教師スタンプつきは CLAUDE_VERIFIED のまま文へ）。 */
  verification: DecompositionVerification;
  contentSha256: string;
  statements: string[];
  links: DecompositionLink[];
  unresolvedRefs: UnresolvedReference[];
  viaIntakeId?: string;
  at: number;
}

const LEDGER_KEY = 'miki_content_decomposition_ledger_v1';
const MAX_DICT_CHAIN_DEPTH = 2;

// ---------------------------------------------------------------------
// テキスト分解（純粋関数）
// ---------------------------------------------------------------------

function cleanFragment(raw: string): string {
  return raw
    .replace(/^[\s、，,・：:；;]+/u, '')
    .replace(/[\s、，,]+$/u, '')
    .trim();
}

/** 括弧の深さを数えながら文末（。！？）で文に割る。括弧内では割らない。 */
function splitSentences(line: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '（' || ch === '(') depth++;
    else if (ch === '）' || ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && (ch === '。' || ch === '！' || ch === '？')) {
      out.push(line.slice(start, i));
      start = i + 1;
    }
  }
  const tail = line.slice(start);
  if (tail.trim()) out.push(tail);
  return out;
}

interface MarkerHit {
  index: number;
  kind: DecompositionLinkKind;
  marker: string;
  /** マーカーのうち断片側に残す文字数（動詞の辞書形など）。 */
  fragKeep: number;
  /** マーカー全体の長さ（残りはここから始まる）。 */
  length: number;
}

const MARKER_RE =
  /のせいで|のため(?![にの])|なので|ので|すると(?![きい])|いれば|で初めて|て初めて|ため(?=[、,])|[うくぐすつぬぶむる]と|[た]ら/gu;
const VERB_END_CHARS = 'うくぐすつぬぶむる';
const QUOTATIVE_HEADS = ['こと', 'もの', '思う', '言う', 'いう', 'され', 'いわれ'];

/** 括弧の外にあるマーカーだけを拾う。守りの条件に合わない候補は捨てる。 */
function findMarkers(sentence: string): MarkerHit[] {
  const hits: MarkerHit[] = [];
  // 括弧内を伏せ字にしてから走査する（位置はそのまま）。
  let masked = '';
  let depth = 0;
  for (const ch of sentence) {
    if (ch === '（' || ch === '(') depth++;
    if (depth > 0) masked += '□';
    else masked += ch;
    if (ch === '）' || ch === ')') depth = Math.max(0, depth - 1);
  }
  MARKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKER_RE.exec(masked)) !== null) {
    const text = m[0];
    const i = m.index;
    if (text === 'のせいで') {
      hits.push({ index: i, kind: 'CAUSES', marker: text, fragKeep: 3, length: 4 });
    } else if (text === 'のため') {
      hits.push({ index: i, kind: 'CAUSES', marker: text, fragKeep: 0, length: 3 });
    } else if (text === 'なので' || text === 'ので') {
      hits.push({ index: i, kind: 'CAUSES', marker: text, fragKeep: 0, length: text.length });
    } else if (text === 'ため') {
      const prev = i > 0 ? sentence[i - 1] : '';
      if ('たして'.includes(prev)) hits.push({ index: i, kind: 'CAUSES', marker: 'ため', fragKeep: 0, length: 2 });
    } else if (text === 'すると') {
      // 「すると」は3文字。length を2にすると帰結側の文頭に「と」が残る。
      hits.push({ index: i, kind: 'CONDITION', marker: text, fragKeep: 0, length: 3 });
    } else if (text === 'いれば') {
      const prev = i > 0 ? sentence[i - 1] : '';
      if (prev === 'て') hits.push({ index: i, kind: 'CONDITION', marker: 'ていれば', fragKeep: 0, length: 3 });
    } else if (text === 'で初めて' || text === 'て初めて') {
      hits.push({ index: i, kind: 'CONDITION', marker: text, fragKeep: 0, length: 4 });
    } else if (text.length === 2 && text[1] === 'と' && VERB_END_CHARS.includes(text[0])) {
      // 動詞辞書形＋と（条件）。引用・名詞化の「と」は守りで落とす。
      const after = sentence.slice(i + 2);
      const fragSoFar = sentence.slice(0, i + 1);
      if (after.startsWith('き')) continue; // 〜とき は割らない（LAB_NOTES の限界）
      if (QUOTATIVE_HEADS.some((h) => after.startsWith(h))) continue;
      if (/(?:だ|です|ます|こと|もの)$/u.test(fragSoFar)) continue;
      hits.push({ index: i, kind: 'CONDITION', marker: 'と', fragKeep: 1, length: 2 });
    } else if (text === 'たら') {
      // 条件の「たら」は過去形（〜た）の後ろの「ら」。正規表現は
      // 「たら」で拾い、断片側に「た」を残す。後ろが平仮名で続く
      // 語（あたらしい 等）は条件節ではないので落とす。
      const after = sentence.slice(i + 2);
      const next = after.charAt(0);
      if (next && /[\u3040-\u30ff]/u.test(next) && next !== '、') continue;
      hits.push({ index: i, kind: 'CONDITION', marker: 'たら', fragKeep: 1, length: 2 });
    }
  }
  return hits;
}

const SENTENCE_INITIAL_CAUSES = /^(したがって|そのため|だから|そこで)[、,]?/u;
const SENTENCE_INITIAL_SEQUENCE = /^(その後|次に|それから|続いて|まず)[、,]?/u;

export interface DecomposedText {
  statements: string[];
  links: DecompositionLink[];
}

/**
 * テキストを原子文へ割る。本文が明示する接続表現だけがリンクに
 * なる。割れない文はそのまま1文。空の結果には絶対にしない。
 */
export function decomposeText(rawText: string): DecomposedText {
  const text = typeof rawText === 'string' ? rawText : '';
  const statements: string[] = [];
  const links: DecompositionLink[] = [];
  if (!text.trim()) return { statements: [], links: [] };
  let pendings: Array<{ from: number; kind: DecompositionLinkKind; marker: string }> = [];
  let lastStatement = -1;

  const flush = (raw: string, resolvePendings: boolean): number => {
    const cleaned = cleanFragment(raw);
    if (!cleaned) return -1;
    const idx = statements.length;
    statements.push(cleaned);
    lastStatement = idx;
    if (resolvePendings) {
      for (const p of pendings) {
        if (p.from !== idx) links.push({ fromIndex: p.from, toIndex: idx, kind: p.kind, marker: p.marker });
      }
      pendings = [];
    }
    return idx;
  };

  for (const line of text.split(/\r?\n/)) {
    for (const rawSentence of splitSentences(line)) {
      let sentence = rawSentence;
      // 文頭の接続表現は、前の文からのリンクとして扱い、文からは外す。
      const initialCauses = sentence.match(SENTENCE_INITIAL_CAUSES);
      const initialSeq = initialCauses ? null : sentence.match(SENTENCE_INITIAL_SEQUENCE);
      const initial = initialCauses || initialSeq;
      if (initial && lastStatement >= 0) {
        pendings.push({
          from: lastStatement,
          kind: initialCauses ? 'CAUSES' : 'SEQUENCE',
          marker: initial[1],
        });
        sentence = sentence.slice(initial[0].length);
      }
      const hits = findMarkers(sentence);
      if (!hits.length) {
        flush(sentence, true);
        continue;
      }
      let cursor = 0;
      let consumed = false;
      for (const hit of hits) {
        if (hit.index < cursor) continue;
        const rawLeft = sentence.slice(cursor, hit.index + hit.fragKeep);
        // 主部が読点の後ろにあるときは、前の部分を文脈文として先に置く。
        // 文脈文には保留リンクを解決しない（帰結は主部の側）。
        let leftFragment = rawLeft;
        let contextPart = '';
        const commaAt = rawLeft.lastIndexOf('、');
        if (commaAt >= 0) {
          const head = rawLeft.slice(0, commaAt);
          const tail = rawLeft.slice(commaAt + 1);
          if (tail === 'その' || tail === 'それ' || tail === 'この') {
            leftFragment = head;
          } else if (tail.length >= 4 && head.trim().length >= 2) {
            contextPart = head;
            leftFragment = tail;
          }
        }
        if (cleanFragment(leftFragment).length < 2) continue; // 割るには細すぎる断片は割らない
        if (contextPart) flush(contextPart, false);
        const from = flush(leftFragment, true);
        if (from >= 0) pendings.push({ from, kind: hit.kind, marker: hit.marker });
        cursor = hit.index + hit.length;
        consumed = true;
      }
      if (!consumed) {
        flush(sentence, true);
      } else {
        flush(sentence.slice(cursor), true);
      }
    }
  }
  if (!statements.length) {
    // バンドル・フォールバック：割れなければ本文全体を1文として残す。
    return { statements: [text.trim()], links: [] };
  }
  return { statements, links };
}

// ---------------------------------------------------------------------
// 参照語の抽出と解決（概念の穴）
// ---------------------------------------------------------------------

const TERM_STOP = new Set([
  'こと', 'もの', 'ため', 'よう', '場合', 'とき', '時', '中', '前', '後',
  'this', 'that', 'these', 'those', 'with', 'from', 'into', 'about',
  'true', 'false', 'null', 'undefined',
]);

/**
 * 文が参照する語の候補。対象は「概念を指す語」だけに絞る：
 * 「」で括られた語（教材が術語として立てるもの）、ラテン文字の
 * 識別子（コード・外来の固有名）、カタカナ語（術語的な外来語）。
 * 括られていない漢字複合語は対象にしない——それは彼女が既に
 * 使いこなす通常の語彙であり、全部を参照扱いすると穴の一覧が
 * 汎用語で埋まって概念供給の合図にならない（実測：24レッスンで
 * 959件、その大半が「準備」「開発」のような汎用語だった）。
 */
export function candidateTerms(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (term: string) => {
    const t = term.trim();
    if (t.length < 2 || t.length > 40 || TERM_STOP.has(t) || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const m of text.matchAll(/「([^」]{2,30})」/gu)) push(m[1]);
  for (const m of text.matchAll(/[A-Za-z][A-Za-z0-9_.$+#-]{2,}/gu)) push(m[0].replace(/[.-]+$/u, ''));
  for (const m of text.matchAll(/[ァ-ヶー]{3,}/gu)) push(m[0]);
  return out;
}

interface ResolutionIndex {
  exact: Set<string>;
  texts: string[];
}

/**
 * グラフ側の「リンク先がある語」の索引。レッスン本文そのものは
 * 入れない（同じ文の中に出てくるだけでは、その語についての
 * ノードがあることにならない）。原子的な主張文は、その文自体が
 * ノードなので入れる。
 */
function buildResolutionIndex(extraTermLabels: string[]): ResolutionIndex {
  const exact = new Set<string>();
  const texts: string[] = [];
  const addText = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) texts.push(value);
  };
  try {
    for (const raw of componentRepositoryCacheService.readAll()) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      if (item.componentType === 'TEACHER_LESSON') {
        const lesson = item.lesson as Record<string, unknown> | undefined;
        if (lesson) {
          addText(lesson.title);
          if (typeof lesson.id === 'string') exact.add(lesson.id);
        }
      }
    }
  } catch { /* 索引が作れなくても分解自体は続ける */ }
  try {
    for (const claim of claimDatabaseService.getAllClaims()) {
      const c = claim as unknown as Record<string, unknown>;
      if (c.world === 'FICTION' || c.status === 'CONTEXT_ONLY') continue;
      addText(c.statement);
    }
  } catch { /* 同上 */ }
  try {
    for (const entity of worldModelGraphService.entities()) addText(entity.name);
  } catch { /* 同上 */ }
  try {
    const snapshot = selfCodeUnderstandingService.getSnapshot();
    if (snapshot) {
      for (const entry of snapshot.entries || []) {
        if (typeof entry.path === 'string') {
          exact.add(entry.path);
          const base = entry.path.split('/').pop() || '';
          if (base) {
            exact.add(base);
            exact.add(base.replace(/\.[^.]+$/u, ''));
          }
        }
        for (const sym of entry.symbols || []) {
          const s = sym as unknown as Record<string, unknown>;
          if (typeof s.name === 'string') exact.add(s.name);
          if (typeof s.qualifiedName === 'string') exact.add(s.qualifiedName);
        }
        // リテラル契約（data-action 値・イベント名・ストレージキー等）
        // もコード索引のノードなので、参照の解決先に数える。
        for (const lit of entry.literalContracts || []) {
          const l = lit as unknown as Record<string, unknown>;
          if (typeof l.value === 'string' && l.value) exact.add(l.value);
        }
      }
    }
  } catch { /* コード索引が無ければ識別子は穴側に倒れる（正直な劣化） */ }
  for (const label of extraTermLabels) {
    exact.add(label);
    texts.push(label);
  }
  return { exact, texts };
}

function graphResolves(index: ResolutionIndex, term: string): boolean {
  if (index.exact.has(term)) return true;
  for (const text of index.texts) if (text.includes(term)) return true;
  return false;
}

function dictionaryGloss(term: string): { gloss: string; source: string } | undefined {
  try {
    for (const entry of japaneseDictionaryService.lookup(term)) {
      if (entry.gloss && entry.gloss.trim()) return { gloss: entry.gloss, source: entry.source };
    }
  } catch { /* 辞書が引けなければ穴側に倒れる */ }
  return undefined;
}

// ---------------------------------------------------------------------
// 台帳と分解の実行
// ---------------------------------------------------------------------

class ContentDecompositionService {
  private static instance: ContentDecompositionService;
  private records = new Map<string, ContentDecompositionRecord>();
  private loaded = false;
  // P3022: 権威ある読み込みの遅延コールバックを登録済みか。
  private loadDeferred = false;
  private queuedGapTerms = new Set<string>();

  public static getInstance(): ContentDecompositionService {
    return ContentDecompositionService.instance ||= new ContentDecompositionService();
  }

  private load(): void {
    if (this.loaded) return;
    if (!isStorageAuthoritativeNow()) {
      // P3022: この台帳は無防備だった（初回呼び出しが未ハイドレー
      // ションの窓に当たると loaded=true のまま空で固定され、後続
      // の保存が実台帳を上書きする）。権威ある状態になるまで読み
      // 込み自体を固定せず、provisional な空の像で動く。権威ある
      // 状態になったら performLoad が実台帳を読み、保留中の記録
      // を合体させる。
      if (!this.loadDeferred) {
        this.loadDeferred = true;
        runWhenStorageAuthoritative(() => this.performLoad());
      }
      return;
    }
    this.performLoad();
  }

  private performLoad(): void {
    if (this.loaded) return;
    this.loaded = true;
    // P3022: 保留中に作られた分解記録を退避し、実台帳の後で（実
    // 台帳に無いものだけ）合体させる。
    const provisional = [...this.records.values()];
    this.records.clear();
    try {
      const raw = storageService.getItem(LEDGER_KEY);
      const saved = raw ? JSON.parse(raw) : [];
      if (Array.isArray(saved)) {
        for (const rec of saved) {
          if (rec && typeof rec.recordId === 'string' && Array.isArray(rec.statements)) {
            this.records.set(rec.recordId, rec as ContentDecompositionRecord);
          }
        }
      }
    } catch { /* 台帳が読めなくても本体は壊さない */ }
    let mergedProvisional = false;
    for (const rec of provisional) {
      if (!this.records.has(rec.recordId)) {
        this.records.set(rec.recordId, rec);
        mergedProvisional = true;
      }
    }
    if (mergedProvisional) {
      this.save();
      systemLogger.info(
        'SELF_IMPROVEMENT',
        '🔐 [P3022 分解台帳] 保留中に作られた分解記録を、権威ある読み込みへ合体しました'
      );
    }
  }

  private save(): void {
    // P3022: 権威ある読み込みが済むまでの保存は、provisional な
    // 部分像で実台帳を上書きするため拒否する。
    if (!this.loaded) return;
    try {
      // P3022: P3011/P3020 と同型の書込拒否ガード（この台帳には
      // 従来ガードが無かった）。永続側に既存値があるのに配列とし
      // て読めない場合、その値をメモリ像で上書きしない。
      const persistedRaw = storageService.getItem(LEDGER_KEY);
      if (persistedRaw) {
        let persistedIsArray = false;
        try {
          persistedIsArray = Array.isArray(JSON.parse(persistedRaw));
        } catch {
          persistedIsArray = false;
        }
        if (!persistedIsArray) {
          systemLogger.warn(
            'SELF_IMPROVEMENT',
            '🔐 [P3022 分解台帳保護] 永続側の分解台帳が配列として読めないため、上書き保存を見送りました（メモリ上の記録は保持されます）'
          );
          return;
        }
      }
      storageService.setItem(LEDGER_KEY, JSON.stringify([...this.records.values()]));
    } catch { /* 同上 */ }
  }

  public allRecords(): ContentDecompositionRecord[] {
    this.load();
    return [...this.records.values()];
  }

  public recordForComponent(componentId: string): ContentDecompositionRecord | undefined {
    this.load();
    for (const rec of this.records.values()) {
      if (rec.parentComponentId === componentId) return rec;
    }
    return undefined;
  }

  public fingerprint(): string {
    this.load();
    // 全レコードの id@at を連結する（途中のレコードが差し替わっても
    // 指紋が変わるように。末尾だけ見ると差し替えを取りこぼす）。
    const parts: string[] = [];
    for (const rec of this.records.values()) parts.push(`${rec.recordId}@${rec.at}`);
    return `${this.records.size}:${parts.join('|')}`;
  }

  private queueConceptHole(term: string): void {
    if (this.queuedGapTerms.has(term)) return;
    this.queuedGapTerms.add(term);
    try {
      knowledgeGapService.detect({
        query: `${term} 意味 用語 定義`,
        reason: '取り込み内容の分解で見つかった未解決の参照（概念の穴）',
        type: 'UNKNOWN_TERM',
        target: term,
        priority: 30,
      });
    } catch { /* 補助経路：失敗しても分解は記録済み */ }
  }

  /**
   * 語が辞書の定義連鎖で接地するか（深さ上限つき・循環安全）。
   * 接地しない語の一覧を返す（空なら接地する）。
   */
  private ungroundedInDefinition(
    term: string,
    index: ResolutionIndex,
    depth: number,
    visited: Set<string>,
  ): string[] | undefined {
    const gloss = dictionaryGloss(term);
    if (!gloss) return undefined; // 辞書に無い＝この経路では判定不能
    const ungrounded: string[] = [];
    for (const inner of candidateTerms(gloss.gloss)) {
      if (inner === term || visited.has(inner)) continue;
      if (graphResolves(index, inner)) continue;
      if (depth < MAX_DICT_CHAIN_DEPTH) {
        const sub = this.ungroundedInDefinition(inner, index, depth + 1, new Set([...visited, term]));
        if (sub === undefined) ungrounded.push(inner);
        else ungrounded.push(...sub);
      } else if (!dictionaryGloss(inner)) {
        ungrounded.push(inner);
      }
    }
    return [...new Set(ungrounded)];
  }

  /**
   * 文集合の未解決参照を判定する。allowDictRecords のときは
   * 辞書解決した語の定義文を DICTIONARY レコードとして残す
   * （辞書レコード自身の分解からは連鎖させない＝深さ1で止める）。
   */
  private resolveReferences(
    statements: string[],
    index: ResolutionIndex,
    allowDictRecords: boolean,
    viaIntakeId?: string,
  ): UnresolvedReference[] {
    const byTerm = new Map<string, UnresolvedReference>();
    statements.forEach((statement, statementIndex) => {
      for (const term of candidateTerms(statement)) {
        if (graphResolves(index, term)) continue;
        const existing = byTerm.get(term);
        if (existing) {
          existing.statementIndexes.push(statementIndex);
          continue;
        }
        const ref: UnresolvedReference = { term, statementIndexes: [statementIndex], outcome: 'concept-hole' };
        const gloss = dictionaryGloss(term);
        if (!gloss) {
          ref.reason = '彼女の辞書に gloss が無い（未学習の語）';
          byTerm.set(term, ref);
          this.queueConceptHole(term);
          continue;
        }
        const ungrounded = this.ungroundedInDefinition(term, index, 0, new Set([term]));
        if (ungrounded && ungrounded.length === 0) {
          ref.outcome = 'resolved-by-dictionary';
          ref.definitionSource = gloss.source;
          if (allowDictRecords) {
            const dictRecord = this.recordDictionaryDefinition(term, gloss.gloss, gloss.source, index, viaIntakeId);
            if (dictRecord) ref.definitionRecordId = dictRecord.recordId;
          }
          // 辞書で学んだ語は、以降の解決ではグラフ側に数える。
          index.exact.add(term);
          index.texts.push(term);
        } else {
          ref.reason = '辞書の定義文が、接地しない語を含んでいる';
          ref.ungroundedTerms = ungrounded && ungrounded.length ? ungrounded : undefined;
          this.queueConceptHole(term);
        }
        byTerm.set(term, ref);
      }
    });
    return [...byTerm.values()];
  }

  private recordDictionaryDefinition(
    term: string,
    gloss: string,
    source: string,
    index: ResolutionIndex,
    viaIntakeId?: string,
  ): ContentDecompositionRecord | undefined {
    this.load();
    const recordId = `decomp:DICTIONARY:${canonicalSha256(term).slice(0, 16)}`;
    const sha = canonicalSha256(gloss);
    const existing = this.records.get(recordId);
    if (existing && existing.contentSha256 === sha) return existing;
    const { statements, links } = decomposeText(gloss.endsWith('。') ? gloss : `${gloss}。`);
    if (!statements.length) return undefined;
    const record: ContentDecompositionRecord = {
      recordId,
      parentKind: 'DICTIONARY',
      parentComponentId: '',
      parentId: term,
      parentTitle: term,
      sourceRef: `dictionary:${source}`,
      // 辞書は出典のある未検証（出典つき主張と同じ扱い）。
      verification: 'UNVERIFIED',
      contentSha256: sha,
      statements,
      links,
      unresolvedRefs: this.resolveReferences(statements, index, false, viaIntakeId),
      viaIntakeId,
      at: Date.now(),
    };
    this.records.set(recordId, record);
    this.save();
    return record;
  }

  /**
   * 一般の取り込み口（P3019、きりあの設計制約 2026-11-28）：
   * 分解の入力はレッスンの形に限らない。「登録済みのテキスト項目」
   * ＝ { parentKind, parentId, parentTitle, text, verification } を
   * 渡せば、原子文＋明示リンク＋未解決参照に割って台帳へ残す。
   * 親が部品なら parentComponentId も渡す（グラフ射影がその部品
   * ノードへ文をぶら下げる）。内容ハッシュが同じなら既存レコード
   * をそのまま返す（冪等）。既存ストック（主張・世界知識）への
   * 一括適用は、この口を項目ごとに呼ぶ形で後続スライスが行う。
   */
  public decomposeItem(input: {
    parentKind: string;
    parentId: string;
    parentComponentId?: string;
    parentTitle: string;
    text: string;
    verification: DecompositionVerification;
    sourceRef?: string;
    viaIntakeId?: string;
    recordId?: string;
  }): ContentDecompositionRecord | undefined {
    this.load();
    if (!input || typeof input.text !== 'string' || !input.text.trim()) return undefined;
    const sha = canonicalSha256(input.text);
    const recordId = input.recordId
      || `decomp:${input.parentKind}:${canonicalSha256(input.parentId || input.parentTitle).slice(0, 16)}`;
    const existing = this.records.get(recordId);
    if (existing && existing.contentSha256 === sha) return existing;
    const { statements, links } = decomposeText(input.text);
    if (!statements.length) return undefined;
    const dictLabels = this.allRecords()
      .filter((r) => r.parentKind === 'DICTIONARY')
      .map((r) => r.parentId);
    const index = buildResolutionIndex(dictLabels);
    const record: ContentDecompositionRecord = {
      recordId,
      parentKind: input.parentKind,
      parentComponentId: input.parentComponentId || '',
      parentId: input.parentId,
      parentTitle: input.parentTitle,
      sourceRef: input.sourceRef,
      verification: input.verification,
      contentSha256: sha,
      statements,
      links,
      unresolvedRefs: this.resolveReferences(statements, index, true, input.viaIntakeId),
      viaIntakeId: input.viaIntakeId,
      at: Date.now(),
    };
    this.records.set(recordId, record);
    this.save();
    try {
      systemLogger.info('SELF_IMPROVEMENT', '[ContentDecomposition] decomposed', {
        parentKind: record.parentKind, parentId: record.parentId,
        statements: statements.length, links: links.length,
        holes: record.unresolvedRefs.filter((r) => r.outcome === 'concept-hole').length,
      });
    } catch { /* ログは補助 */ }
    return record;
  }

  /**
   * 教材レッスン用のアダプタ：部品から一般入力を組み立てて
   * decomposeItem に渡す。検証状態は部品から引き継ぐ（教師
   * スタンプつき＝CLAUDE_VERIFIED、彼女のゲート済み＝SELF_GATED、
   * それ以外＝UNVERIFIED）。
   */
  public decomposeComponent(
    componentId: string,
    opts?: { intakeId?: string },
  ): ContentDecompositionRecord | undefined {
    this.load();
    let item: Record<string, unknown> | undefined;
    try {
      const found = componentRepositoryCacheService.readAll()
        .find((raw: unknown) => raw && typeof raw === 'object'
          && (raw as Record<string, unknown>).componentId === componentId);
      item = found as Record<string, unknown> | undefined;
    } catch { item = undefined; }
    if (!item) return undefined;
    if (item.componentType !== 'TEACHER_LESSON') return undefined; // 部品アダプタはレッスンのみ（一般口は decomposeItem）
    const lesson = item.lesson as Record<string, unknown> | undefined;
    if (!lesson || typeof lesson.rule !== 'string' || typeof lesson.title !== 'string') return undefined;
    const tv = item.teacherVerification as { verifiedBy?: unknown } | undefined;
    const verification: DecompositionVerification =
      tv && typeof tv.verifiedBy === 'string' && isTrustedVerifierName(tv.verifiedBy)
        ? 'CLAUDE_VERIFIED'
        : item.verificationStatus === 'VERIFIED' || item.lifecycleStatus === 'VERIFIED'
          ? 'SELF_GATED'
          : 'UNVERIFIED';
    return this.decomposeItem({
      parentKind: 'TEACHER_LESSON',
      parentId: typeof lesson.id === 'string' ? lesson.id : '',
      parentComponentId: componentId,
      parentTitle: lesson.title,
      text: lesson.rule,
      verification,
      viaIntakeId: opts?.intakeId,
      recordId: `decomp:${componentId}`,
    });
  }
}

export const contentDecompositionService = ContentDecompositionService.getInstance();
