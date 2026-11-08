import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';

/*
 * P490: 語彙ルール（型つき語関係）の置き場。
 *
 * きりあの発案（2026-11-08）: 「LLM の中で近いもの同士」のような
 * 語と語の関係を、ルールとして明示的に持つ。連想グラフ
 * （wordAssociationGraphService）は型のない「関連」だけを持つため、
 * 同義・反対・上位下位の区別が要る判断（矛盾検出・クエリ拡張・
 * 世界モデルの継承）には使えなかった。本サービスは型つきの関係を
 * 専門に持つ。Claim（真偽を検証する信念）とは別物で、ここにある
 * 関係は「使い勝手」の知識であり、検証系には載せない。
 *
 * 供給路:
 * - seed: 下記の組み込み初期集合（決定的・オフライン）。
 * - wikidata: 用語学習のついでに Wikidata の公開 API から
 *   別名（同義）・P461（反対）・P279/P31（上位）を引く。無料・
 *   鍵なし。同じ語は7日間引き直さない。
 * - teacher / manual: 将来の受け口（型だけ用意）。
 */

export type LexicalRelationType = 'SYNONYM' | 'ANTONYM' | 'HYPERNYM' | 'TRANSLATION' | 'ABBREVIATION' | 'FIELD' | 'VARIANT' | 'PARAPHRASE';
export type LexicalRelationSource = 'seed' | 'wikidata' | 'teacher' | 'manual' | 'learned';

export interface LexicalRelation {
  a: string;
  b: string;
  type: LexicalRelationType;
  source: LexicalRelationSource;
  updatedAt: number;
}

const RELATIONS_KEY = 'miki_lexical_relations_v1';
const ATTEMPTS_KEY = 'miki_lexical_wikidata_attempts_v1';
const SENSES_KEY = 'miki_lexical_senses_v1';
const MAX_RELATIONS = 2000;
const WIKIDATA_RETRY_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;
const USER_AGENT = 'MIKI-AI0.2 lexical learning (educational, on-device)';

// 反対語の種: 矛盾検出の対立ペアとして効く、動詞・形容詞の対。
const SEED_ANTONYMS: Array<[string, string]> = [
  ['増加する', '減少する'], ['増える', '減る'], ['増やす', '減らす'],
  ['上がる', '下がる'], ['上昇する', '下降する'], ['高い', '低い'],
  ['速い', '遅い'], ['強い', '弱い'], ['多い', '少ない'],
  ['大きい', '小さい'], ['新しい', '古い'], ['明るい', '暗い'],
  ['有効', '無効'], ['成功', '失敗'], ['必要', '不要'],
  ['可能', '不可能'], ['安全', '危険'], ['公開', '非公開'],
  ['含む', '含まない'], ['始まる', '終わる'], ['勝つ', '負ける'],
  ['増大する', '縮小する'], ['拡大する', '縮小する'], ['改善する', '悪化する'],
];

// 同義語の種: クエリの言い換えと主題の同一視に効く対。
const SEED_SYNONYMS: Array<[string, string]> = [
  ['調べる', '検索する'], ['調査', '検索'], ['作る', '作成する'],
  ['直す', '修正する'], ['直す', '修理する'], ['改善', '改良'],
  ['理由', '原因'], ['方法', '手段'], ['使う', '使用する'],
  ['用いる', '使う'], ['終わる', '終了する'], ['始める', '開始する'],
  ['買う', '購入する'], ['速い', '早い'], ['問題', '課題'],
  ['直る', '治る'], ['壊れる', '故障する'], ['教える', '伝える'],
];

// 上位語の種: [下位, 上位]。世界モデルの継承の足場。
const SEED_HYPERNYMS: Array<[string, string]> = [
  ['typescript', 'プログラミング言語'], ['javascript', 'プログラミング言語'],
  ['python', 'プログラミング言語'], ['searxng', '検索エンジン'],
  ['sqlite', 'データベース'], ['android', 'オペレーティングシステム'],
  ['犬', '哺乳類'], ['猫', '哺乳類'], ['哺乳類', '動物'],
  ['りんご', '果物'], ['ギター', '楽器'], ['ピアノ', '楽器'],
];

// P491 日英対応の種: [日本語, 英語]。英語圏の出典と Marginalia に効く。
const SEED_TRANSLATIONS: Array<[string, string]> = [
  ['検索エンジン', 'search engine'], ['関数', 'function'], ['変数', 'variable'],
  ['配列', 'array'], ['例外', 'exception'], ['非同期', 'asynchronous'],
  ['型', 'type'], ['戻り値', 'return value'], ['認証', 'authentication'],
  ['認可', 'authorization'], ['暗号化', 'encryption'], ['圧縮', 'compression'],
  ['並行処理', 'concurrency'], ['期限', 'deadline'], ['在庫', 'inventory'],
];

// P491 略語の種: [略語, 正式名称]。
const SEED_ABBREVIATIONS: Array<[string, string]> = [
  ['api', 'application programming interface'], ['cpu', 'central processing unit'],
  ['gpu', 'graphics processing unit'], ['ram', 'random access memory'],
  ['url', 'uniform resource locator'], ['html', 'hypertext markup language'],
  ['css', 'cascading style sheets'], ['json', 'javascript object notation'],
  ['sql', 'structured query language'], ['sdk', 'software development kit'],
  ['ui', 'user interface'], ['os', 'operating system'],
  ['llm', 'large language model'], ['rag', 'retrieval augmented generation'],
  ['ocr', 'optical character recognition'], ['vpn', 'virtual private network'],
];

// P491 分野の種: [語, 分野]。調査の組み立ての判断材料。
const SEED_FIELDS: Array<[string, string]> = [
  ['typescript', 'プログラミング'], ['javascript', 'プログラミング'],
  ['python', 'プログラミング'], ['プログラミング言語', 'プログラミング'],
  ['sqlite', 'プログラミング'], ['データベース', 'プログラミング'],
  ['searxng', '情報検索'], ['検索エンジン', '情報検索'],
  ['android', 'モバイル'], ['ギター', '音楽'], ['ピアノ', '音楽'],
  ['楽器', '音楽'], ['犬', '動物'], ['猫', '動物'], ['哺乳類', '動物'],
  ['りんご', '食'], ['果物', '食'],
];

// P491 表記ゆれの種: [正形, ゆれ]。foldVariants で ゆれ→正形 に寄せる。
const SEED_VARIANTS: Array<[string, string]> = [
  ['サーバー', 'サーバ'], ['ユーザー', 'ユーザ'], ['ブラウザー', 'ブラウザ'],
  ['コンピューター', 'コンピュータ'], ['プリンター', 'プリンタ'],
  ['モニター', 'モニタ'], ['フィルター', 'フィルタ'],
  ['できる', '出来る'], ['ください', '下さい'], ['ありがとう', '有難う'],
  ['すごい', '凄い'], ['わかる', '分かる'],
];

// P495: 言い換え（硬い表現・長い表現 → 口語・短い表現）。方向を
// 持つ（a を b に言い換える）。種は安全なサ変動詞→和語動詞と、
// 定型の圧縮だけに絞る。文脈依存の圧縮（例: 療法→癒し）は種に
// 入れず、教師・学習・手動の供給に委ねる。
const SEED_PARAPHRASES: Array<[string, string]> = [
  ['利用する', '使う'], ['使用する', '使う'], ['購入する', '買う'],
  ['質問する', '聞く'], ['回答する', '答える'], ['開始する', '始める'],
  ['終了する', '終わる'], ['選択する', '選ぶ'], ['決定する', '決める'],
  ['変更する', '変える'], ['作成する', '作る'], ['削除する', '消す'],
  ['修理する', '直す'], ['確認する', '確かめる'], ['行う', 'する'],
  ['することができる', 'できる'], ['することができない', 'できない'],
];

function normalizeTerm(term: string): string {
  return String(term || '').toLowerCase().trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * P491: 意味の分岐（多義語）。同じ語に対する Wikidata の別項目が
 * 別の意味に対応する。description と上位語が、文脈から意味を
 * 選ぶための手がかり。
 */
export interface LexicalSense {
  term: string;
  entityId: string;
  description: string;
  enLabel?: string;
  hypernyms: string[];
  // P494: ページの定義文から学んだ意味の出所と学習時刻。
  sourceUrl?: string;
  learnedAt?: number;
}

class LexicalRelationService {
  private relations: LexicalRelation[] = [];
  private synonymMap = new Map<string, Set<string>>();
  private antonymMap = new Map<string, Set<string>>();
  private hypernymMap = new Map<string, Set<string>>(); // 下位 -> 上位
  private hyponymMap = new Map<string, Set<string>>(); // 上位 -> 下位
  private translationMap = new Map<string, Set<string>>(); // 双方向
  private abbreviationMap = new Map<string, Set<string>>(); // 双方向
  private fieldMap = new Map<string, Set<string>>(); // 語 -> 分野
  private senses: LexicalSense[] = [];
  private loaded = false;

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = storageService.getItem(RELATIONS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.relations = parsed.filter(
          (r: any) => r && typeof r.a === 'string' && typeof r.b === 'string' && typeof r.type === 'string',
        );
      }
    } catch { /* 読めなければ種から始める */ }
    // P495: 種は「台帳が空のときだけ」ではなく、不足分を補う形で
    // 入れる。新しい型の種を後から足しても既存の台帳に届くように
    // するため（この形でないと、端末で育った台帳には P491 の種も
    // 届かなかった）。
    {
      const now = Date.now();
      const seedPairs: Array<[string, string, LexicalRelationType]> = [
        ...SEED_ANTONYMS.map(([a, b]): [string, string, LexicalRelationType] => [a, b, 'ANTONYM']),
        ...SEED_SYNONYMS.map(([a, b]): [string, string, LexicalRelationType] => [a, b, 'SYNONYM']),
        ...SEED_HYPERNYMS.map(([a, b]): [string, string, LexicalRelationType] => [a, b, 'HYPERNYM']),
        ...SEED_TRANSLATIONS.map(([a, b]): [string, string, LexicalRelationType] => [a, b, 'TRANSLATION']),
        ...SEED_ABBREVIATIONS.map(([a, b]): [string, string, LexicalRelationType] => [a, b, 'ABBREVIATION']),
        ...SEED_FIELDS.map(([a, b]): [string, string, LexicalRelationType] => [a, b, 'FIELD']),
        ...SEED_VARIANTS.map(([a, b]): [string, string, LexicalRelationType] => [a, b, 'VARIANT']),
        ...SEED_PARAPHRASES.map(([a, b]): [string, string, LexicalRelationType] => [a, b, 'PARAPHRASE']),
      ];
      let supplemented = 0;
      for (const [a, b, type] of seedPairs) {
        const directional = type === 'HYPERNYM' || type === 'FIELD';
        const exists = this.relations.some((r) =>
          r.type === type &&
          (directional
            ? r.a === a && r.b === b
            : (r.a === a && r.b === b) || (r.a === b && r.b === a)),
        );
        if (!exists) {
          this.relations.push({ a, b, type, source: 'seed', updatedAt: now });
          supplemented++;
        }
      }
      if (supplemented > 0) this.save();
    }
    try {
      const sensesRaw = storageService.getItem(SENSES_KEY);
      const parsedSenses = sensesRaw ? JSON.parse(sensesRaw) : null;
      if (Array.isArray(parsedSenses)) {
        this.senses = parsedSenses.filter(
          (s: any) => s && typeof s.term === 'string' && typeof s.entityId === 'string',
        );
      }
    } catch { /* 意味分岐が読めなくても関係ストアは動く */ }
    this.rebuildIndex();
  }

  private saveSenses(): void {
    try {
      storageService.setItem(SENSES_KEY, JSON.stringify(this.senses.slice(-500)));
    } catch (e) {
      systemLogger.warn('PERSISTENCE', 'Failed to save lexical senses', e);
    }
  }

  private save(): void {
    try {
      storageService.setItem(RELATIONS_KEY, JSON.stringify(this.relations.slice(-MAX_RELATIONS)));
    } catch (e) {
      systemLogger.warn('PERSISTENCE', 'Failed to save lexical relations', e);
    }
  }

  private rebuildIndex(): void {
    this.synonymMap.clear();
    this.antonymMap.clear();
    this.hypernymMap.clear();
    this.hyponymMap.clear();
    this.translationMap.clear();
    this.abbreviationMap.clear();
    this.fieldMap.clear();
    const link = (map: Map<string, Set<string>>, from: string, to: string) => {
      if (!map.has(from)) map.set(from, new Set());
      map.get(from)!.add(to);
    };
    for (const rel of this.relations) {
      if (rel.type === 'SYNONYM') {
        link(this.synonymMap, rel.a, rel.b);
        link(this.synonymMap, rel.b, rel.a);
      } else if (rel.type === 'ANTONYM') {
        link(this.antonymMap, rel.a, rel.b);
        link(this.antonymMap, rel.b, rel.a);
      } else if (rel.type === 'TRANSLATION') {
        link(this.translationMap, rel.a, rel.b);
        link(this.translationMap, rel.b, rel.a);
      } else if (rel.type === 'ABBREVIATION') {
        link(this.abbreviationMap, rel.a, rel.b);
        link(this.abbreviationMap, rel.b, rel.a);
      } else if (rel.type === 'FIELD') {
        link(this.fieldMap, rel.a, rel.b);
      } else if (rel.type === 'HYPERNYM') {
        link(this.hypernymMap, rel.a, rel.b);
        link(this.hyponymMap, rel.b, rel.a);
      }
      // VARIANT は foldVariants が関係リストから直接読む。
    }
  }

  public addRelation(aRaw: string, bRaw: string, type: LexicalRelationType, source: LexicalRelationSource): boolean {
    this.load();
    const a = normalizeTerm(aRaw);
    const b = normalizeTerm(bRaw);
    if (!a || !b || a === b) return false;
    const directional = type === 'HYPERNYM' || type === 'FIELD';
    const exists = this.relations.some((r) =>
      r.type === type &&
      (directional
        ? r.a === a && r.b === b
        : (r.a === a && r.b === b) || (r.a === b && r.b === a)),
    );
    if (exists) return false;
    if (this.relations.length >= MAX_RELATIONS) return false;
    this.relations.push({ a, b, type, source, updatedAt: Date.now() });
    this.rebuildIndex();
    this.save();
    return true;
  }

  public synonymsOf(termRaw: string): string[] {
    this.load();
    return [...(this.synonymMap.get(normalizeTerm(termRaw)) || [])];
  }

  public antonymsOf(termRaw: string): string[] {
    this.load();
    return [...(this.antonymMap.get(normalizeTerm(termRaw)) || [])];
  }

  /** 直接の上位語に、推移的な上位語（深さ3まで）を加えて返す。 */
  public hypernymsOf(termRaw: string): string[] {
    this.load();
    const start = normalizeTerm(termRaw);
    const found = new Set<string>();
    let frontier = [...(this.hypernymMap.get(start) || [])];
    for (let depth = 0; depth < 3 && frontier.length > 0; depth++) {
      const next: string[] = [];
      for (const term of frontier) {
        if (found.has(term) || term === start) continue;
        found.add(term);
        next.push(...(this.hypernymMap.get(term) || []));
      }
      frontier = next;
    }
    return [...found];
  }

  public hyponymsOf(termRaw: string): string[] {
    this.load();
    return [...(this.hyponymMap.get(normalizeTerm(termRaw)) || [])];
  }

  public areSynonyms(aRaw: string, bRaw: string): boolean {
    this.load();
    return this.synonymMap.get(normalizeTerm(aRaw))?.has(normalizeTerm(bRaw)) || false;
  }

  public areAntonyms(aRaw: string, bRaw: string): boolean {
    this.load();
    return this.antonymMap.get(normalizeTerm(aRaw))?.has(normalizeTerm(bRaw)) || false;
  }

  public synonymPairs(): Array<[string, string]> {
    this.load();
    return this.relations.filter((r) => r.type === 'SYNONYM').map((r) => [r.a, r.b] as [string, string]);
  }

  public antonymPairs(): Array<[string, string]> {
    this.load();
    return this.relations.filter((r) => r.type === 'ANTONYM').map((r) => [r.a, r.b] as [string, string]);
  }

  /** P495: 言い換え対（a を b に言い換える、方向あり）。 */
  public paraphrasePairs(): Array<[string, string]> {
    this.load();
    return this.relations.filter((r) => r.type === 'PARAPHRASE').map((r) => [r.a, r.b] as [string, string]);
  }

  public paraphrasesOf(phraseRaw: string): string[] {
    const phrase = normalizeTerm(phraseRaw);
    return this.paraphrasePairs().filter(([a]) => a === phrase).map(([, b]) => b);
  }

  public hypernymPairs(): Array<[string, string]> {
    this.load();
    return this.relations.filter((r) => r.type === 'HYPERNYM').map((r) => [r.a, r.b] as [string, string]);
  }

  // ----------------------------------------------------------------
  // P491: 日英対応・略語・分野・表記ゆれ・意味分岐
  // ----------------------------------------------------------------

  public translationsOf(termRaw: string): string[] {
    this.load();
    return [...(this.translationMap.get(normalizeTerm(termRaw)) || [])];
  }

  /** 略語⇔正式名称のもう一方を返す。 */
  public expansionsOf(termRaw: string): string[] {
    this.load();
    return [...(this.abbreviationMap.get(normalizeTerm(termRaw)) || [])];
  }

  /** 語の分野。上位語に付いた分野も継承する。 */
  public fieldsOf(termRaw: string): string[] {
    this.load();
    const term = normalizeTerm(termRaw);
    const found = new Set<string>(this.fieldMap.get(term) || []);
    for (const hyper of this.hypernymsOf(term)) {
      for (const field of this.fieldMap.get(hyper) || []) found.add(field);
    }
    return [...found];
  }

  /** テキスト中に現れる語の分野を集める。 */
  public fieldsOfText(textRaw: string): string[] {
    this.load();
    const text = String(textRaw || '').toLowerCase();
    const found = new Set<string>();
    for (const term of this.fieldMap.keys()) {
      if (term && text.includes(term)) {
        for (const field of this.fieldsOf(term)) found.add(field);
      }
    }
    return [...found];
  }

  private variantOfPairs(
    pairs: Array<[string, string]>,
    textRaw: string,
    caseInsensitive = false,
  ): string | undefined {
    const text = String(textRaw || '');
    if (!text) return undefined;
    const sorted = [...pairs].sort((x, y) => Math.max(y[0].length, y[1].length) - Math.max(x[0].length, x[1].length));
    for (const [a, b] of sorted) {
      for (const [from, to] of [[a, b], [b, a]] as Array<[string, string]>) {
        if (caseInsensitive) {
          const idx = text.toLowerCase().indexOf(from.toLowerCase());
          if (idx >= 0) {
            const variant = text.slice(0, idx) + to + text.slice(idx + from.length);
            if (variant !== text) return variant;
          }
        } else if (text.includes(from)) {
          const variant = text.replace(from, to);
          if (variant !== text) return variant;
        }
      }
    }
    return undefined;
  }

  /**
   * テキスト中の語を1つだけ英語（または日本語）対応語に置き換えた
   * 文を返す。多義語は文脈で意味を選んで、その意味の英語ラベルを
   * 優先する。
   */
  public translationVariantOf(textRaw: string): string | undefined {
    this.load();
    const text = String(textRaw || '');
    const pairs = this.relations
      .filter((r) => r.type === 'TRANSLATION')
      .map((r) => [r.a, r.b] as [string, string])
      .sort((x, y) => Math.max(y[0].length, y[1].length) - Math.max(x[0].length, x[1].length));
    for (const [a, b] of pairs) {
      // a は日本語側の想定。多義語なら意味に合った enLabel を使う。
      if (text.includes(a)) {
        const senses = this.sensesOf(a);
        if (senses.length > 1) {
          const sense = this.disambiguate(a, text);
          if (sense?.enLabel) {
            const variant = text.replace(a, sense.enLabel);
            if (variant !== text) return variant;
          }
        }
        const variant = text.replace(a, b);
        if (variant !== text) return variant;
      }
      if (text.includes(b)) {
        const variant = text.replace(b, a);
        if (variant !== text) return variant;
      }
    }
    return undefined;
  }

  /** テキスト中の略語（または正式名称）をもう一方に置き換えた文。 */
  public abbreviationVariantOf(textRaw: string): string | undefined {
    this.load();
    const pairs = this.relations
      .filter((r) => r.type === 'ABBREVIATION')
      .map((r) => [r.a, r.b] as [string, string]);
    return this.variantOfPairs(pairs, textRaw, true);
  }

  /**
   * 表記ゆれを正形に寄せる（サーバ→サーバー 等）。正形が ゆれ+
   * 残り、という形の場合は、既に正形の箇所を二重化しないよう
   * 後読みで守る。
   */
  public foldVariants(textRaw: string): string {
    this.load();
    let text = String(textRaw || '');
    const pairs = this.relations
      .filter((r) => r.type === 'VARIANT')
      .sort((x, y) => y.b.length - x.b.length);
    for (const rel of pairs) {
      const canonical = rel.a;
      const variant = rel.b;
      if (!variant || canonical === variant) continue;
      if (canonical.startsWith(variant)) {
        const rest = canonical.slice(variant.length);
        const re = new RegExp(escapeRegExp(variant) + '(?!' + escapeRegExp(rest) + ')', 'g');
        text = text.replace(re, canonical);
      } else {
        text = text.split(variant).join(canonical);
      }
    }
    return text;
  }

  public sensesOf(termRaw: string): LexicalSense[] {
    this.load();
    const term = normalizeTerm(termRaw);
    return this.senses.filter((s) => s.term === term);
  }

  /**
   * 文脈に最も合う意味を選ぶ。意味の手がかり（説明文・上位語・
   * 英語ラベル）の語が文脈にどれだけ現れるかで決める。同点や
   * 手がかり無しでは選ばない（undefined）。
   */
  public disambiguate(termRaw: string, contextRaw: string): LexicalSense | undefined {
    const senses = this.sensesOf(termRaw);
    if (senses.length === 0) return undefined;
    if (senses.length === 1) return senses[0];
    const context = String(contextRaw || '').toLowerCase();
    const tokensOf = (text: string): string[] => {
      const found: string[] = [];
      for (const m of String(text || '').toLowerCase().matchAll(/[a-z0-9]{2,}|[一-龯]{2,}|[ぁ-んァ-ヶ]{2,}/g)) {
        found.push(m[0]);
      }
      return found;
    };
    const contextTokens = new Set(tokensOf(context));
    let best: LexicalSense | undefined;
    let bestScore = 0;
    let tied = false;
    for (const sense of senses) {
      const clueText = [sense.description, ...(sense.hypernyms || []), sense.enLabel || ''].join(' ');
      let score = 0;
      for (const token of new Set(tokensOf(clueText))) {
        // P494: 文脈の語が手がかりの語の一部である場合（熱帯 ⊂
        // 熱帯地域）も一致と数える。語の切り方の粒度差で、意味の
        // 選択が常時失敗するのを防ぐ。
        if (
          contextTokens.has(token) ||
          context.includes(token) ||
          [...contextTokens].some((ct) => ct.length >= 2 && token.includes(ct))
        ) {
          score++;
        }
      }
      if (score > bestScore) {
        best = sense;
        bestScore = score;
        tied = false;
      } else if (score === bestScore && score > 0) {
        tied = true;
      }
    }
    return bestScore > 0 && !tied ? best : undefined;
  }

  /**
   * P494: ページの定義文から学んだ意味を、意味の分岐として記録
   * する。多義語は「最初の定義で上書き」せず、別の定義が来たら
   * 別の意味として並べる（日本語は同音・同表記の別義が多いため）。
   * 既存の学習済み意味と説明文の重なりが大きければ同じ意味と
   * みなして reinforced を返す。Wikidata 由来の意味とは別枠
   * （entityId が 'learned:' 始まり）で持ち、disambiguate の
   * 候補には両方とも載る。
   */
  public addLearnedSense(
    termRaw: string,
    input: { description: string; hypernyms?: string[]; enLabel?: string; sourceUrl?: string },
  ): 'added' | 'reinforced' | 'skipped' {
    this.load();
    const term = normalizeTerm(termRaw);
    const description = (input.description || '').trim();
    if (!term || description.length < 4) return 'skipped';
    const tokensOf = (text: string): Set<string> =>
      new Set(
        (String(text || '').toLowerCase().match(/[a-z0-9]{2,}|[一-龯]{2,}|[ぁ-んァ-ヶ]{2,}/g) ?? []),
      );
    const newTokens = tokensOf(description);
    for (const sense of this.senses) {
      if (sense.term !== term || !sense.entityId.startsWith('learned:')) continue;
      const oldTokens = tokensOf(sense.description);
      let inter = 0;
      for (const t of newTokens) if (oldTokens.has(t)) inter++;
      const union = new Set([...newTokens, ...oldTokens]).size || 1;
      if (inter / union >= 0.5) {
        if (!sense.sourceUrl && input.sourceUrl) sense.sourceUrl = input.sourceUrl;
        this.saveSenses();
        return 'reinforced';
      }
    }
    const learnedCount = this.senses.filter(
      (s) => s.term === term && s.entityId.startsWith('learned:'),
    ).length;
    if (learnedCount >= 6) return 'skipped';
    const entityId = `learned:${canonicalSha256Object({ term, description }).slice(0, 16)}`;
    if (this.senses.some((s) => s.entityId === entityId)) return 'reinforced';
    this.senses.push({
      term,
      entityId,
      description,
      enLabel: input.enLabel,
      hypernyms: input.hypernyms ?? [],
      sourceUrl: input.sourceUrl,
      learnedAt: Date.now(),
    });
    this.saveSenses();
    return 'added';
  }

  /**
   * テキスト中に現れる同義語を1つだけ counterpart に置き換えた
   * 文を返す（クエリの言い換え用）。長い語を優先し、置き換えが
   * 起きなければ undefined。
   */
  public synonymVariantOf(textRaw: string): string | undefined {
    this.load();
    const text = String(textRaw || '');
    if (!text) return undefined;
    const pairs = this.synonymPairs().sort((x, y) => Math.max(y[0].length, y[1].length) - Math.max(x[0].length, x[1].length));
    for (const [a, b] of pairs) {
      if (text.includes(a)) {
        const variant = text.replace(a, b);
        if (variant !== text) return variant;
      }
      if (text.includes(b)) {
        const variant = text.replace(b, a);
        if (variant !== text) return variant;
      }
    }
    return undefined;
  }

  public counts(): {
    total: number; synonym: number; antonym: number; hypernym: number; wikidata: number;
    translation: number; abbreviation: number; field: number; variant: number; polysemousTerms: number;
  } {
    this.load();
    const senseCounts = new Map<string, number>();
    for (const sense of this.senses) senseCounts.set(sense.term, (senseCounts.get(sense.term) || 0) + 1);
    return {
      total: this.relations.length,
      synonym: this.relations.filter((r) => r.type === 'SYNONYM').length,
      antonym: this.relations.filter((r) => r.type === 'ANTONYM').length,
      hypernym: this.relations.filter((r) => r.type === 'HYPERNYM').length,
      wikidata: this.relations.filter((r) => r.source === 'wikidata').length,
      translation: this.relations.filter((r) => r.type === 'TRANSLATION').length,
      abbreviation: this.relations.filter((r) => r.type === 'ABBREVIATION').length,
      field: this.relations.filter((r) => r.type === 'FIELD').length,
      variant: this.relations.filter((r) => r.type === 'VARIANT').length,
      polysemousTerms: [...senseCounts.values()].filter((n) => n > 1).length,
    };
  }

  private loadAttempts(): Record<string, number> {
    try {
      const raw = storageService.getItem(ATTEMPTS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  /**
   * Wikidata の公開 API から、1語分の辞書的な語関係を引いて
   * ストアに足す。別名=同義、P461=反対、P279/P31=上位、
   * 英語ラベル=日英対応、P1813（短い名前）=略語。
   * P491: 検索は上位3件まで取り、別項目は「意味の分岐」として
   * 記録する（多義語）。失敗しても例外は投げない。同じ語は
   * 7日間引き直さない（共有基盤への配慮と無駄撃ち防止）。
   */
  public async learnFromWikidata(termRaw: string): Promise<number> {
    const term = normalizeTerm(termRaw);
    if (!term || term.length < 2) return 0;
    this.load();
    const attempts = this.loadAttempts();
    const last = attempts[term] || 0;
    if (Date.now() - last < WIKIDATA_RETRY_MS) return 0;
    attempts[term] = Date.now();
    try {
      storageService.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
    } catch { /* 間引き台帳が書けなくても学習自体は続ける */ }

    let added = 0;
    try {
      const api = new URL('https://www.wikidata.org/w/api.php');
      const callApi = async (params: Record<string, string>): Promise<any | null> => {
        const url = new URL(api.toString());
        for (const [key, value] of Object.entries({ ...params, format: 'json' })) {
          url.searchParams.set(key, value);
        }
        const res = await fetch(url.toString(), {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        });
        if (!res.ok) return null;
        return res.json();
      };
      const claimTargetIds = (claims: any, prop: string): string[] =>
        (claims?.[prop] || [])
          .map((c: any) => c?.mainsnak?.datavalue?.value?.id)
          .filter(Boolean)
          .map(String);

      const search = await callApi({
        action: 'wbsearchentities', search: term, language: 'ja', uselang: 'ja', type: 'item', limit: '3',
      });
      const hits = (Array.isArray(search?.search) ? search.search : []).filter((h: any) => h?.id);
      if (hits.length === 0) return 0;
      const main = hits[0];
      const hitIds = hits.map((h: any) => String(h.id));

      const aliases = Array.isArray(main.aliases) ? main.aliases : [];
      for (const alias of aliases.slice(0, 8)) {
        const aliasText = String(alias || '').trim();
        if (aliasText.length >= 2 && aliasText.length <= 20 && normalizeTerm(aliasText) !== term) {
          if (this.addRelation(term, aliasText, 'SYNONYM', 'wikidata')) added++;
        }
      }

      // 全ヒットのラベル（日英）: 主項目の英語ラベルは日英対応に、
      // 各ヒットの英語ラベルは意味分岐の手がかりになる。
      const entityLabels = await callApi({
        action: 'wbgetentities', ids: hitIds.join('|'), props: 'labels', languages: 'ja|en',
      });
      const enLabelOf = (id: string): string | undefined => {
        const value = entityLabels?.entities?.[id]?.labels?.en?.value;
        return typeof value === 'string' && value.trim().length >= 2 ? value.trim() : undefined;
      };
      const mainEn = enLabelOf(String(main.id));
      if (mainEn && normalizeTerm(mainEn) !== term) {
        if (this.addRelation(term, mainEn, 'TRANSLATION', 'wikidata')) added++;
      }

      // 全ヒットの claims を一括で取る。
      const claimsData = await callApi({ action: 'wbgetentities', ids: hitIds.join('|'), props: 'claims' });
      const claimsOf = (id: string): any => claimsData?.entities?.[id]?.claims || {};
      const mainClaims = claimsOf(String(main.id));

      // 略語（P1813 短い名前）は主項目から。
      for (const entry of (mainClaims.P1813 || [])) {
        const value = entry?.mainsnak?.datavalue?.value;
        if (value && typeof value.text === 'string' && value.text.trim().length >= 2) {
          if (this.addRelation(value.text, term, 'ABBREVIATION', 'wikidata')) added++;
        }
      }

      // 関係の行き先（反対・上位）の日本語ラベルを一括で引く。
      const targetIds = new Set<string>();
      for (const id of hitIds) {
        const claims = claimsOf(id);
        for (const id2 of claimTargetIds(claims, 'P461')) targetIds.add(id2);
        for (const id2 of claimTargetIds(claims, 'P279')) targetIds.add(id2);
        for (const id2 of claimTargetIds(claims, 'P31')) targetIds.add(id2);
      }
      const labelOf = new Map<string, string>();
      if (targetIds.size > 0) {
        const labels = await callApi({
          action: 'wbgetentities', ids: [...targetIds].join('|'), props: 'labels', languages: 'ja',
        });
        for (const id of targetIds) {
          const label = labels?.entities?.[id]?.labels?.ja?.value;
          if (typeof label === 'string' && label.trim().length >= 2) labelOf.set(id, label.trim());
        }
      }

      // 主項目の反対・上位は語レベルのルールとして登録する。
      for (const id of claimTargetIds(mainClaims, 'P461')) {
        const label = labelOf.get(id);
        if (label && this.addRelation(term, label, 'ANTONYM', 'wikidata')) added++;
      }
      for (const prop of ['P279', 'P31']) {
        for (const id of claimTargetIds(mainClaims, prop)) {
          const label = labelOf.get(id);
          if (label && this.addRelation(term, label, 'HYPERNYM', 'wikidata')) added++;
        }
      }

      // 意味の分岐: ヒット全件を意味として記録する（既存は飛ばす）。
      let sensesChanged = false;
      for (const hit of hits) {
        const entityId = String(hit.id);
        if (this.senses.some((s) => s.term === term && s.entityId === entityId)) continue;
        const claims = claimsOf(entityId);
        const hypernymLabels = [...claimTargetIds(claims, 'P279'), ...claimTargetIds(claims, 'P31')]
          .map((id) => labelOf.get(id))
          .filter((v): v is string => Boolean(v));
        this.senses.push({
          term,
          entityId,
          description: String(hit.description || ''),
          enLabel: enLabelOf(entityId),
          hypernyms: hypernymLabels,
        });
        sensesChanged = true;
      }
      if (sensesChanged) this.saveSenses();

      if (added > 0) {
        systemLogger.info('SELF_IMPROVEMENT', `📚 [語彙ルール] Wikidataから「${term}」の語関係を${added}件学習（累計${this.relations.length}件）`);
      }
    } catch { /* 辞書引きの失敗は学習全体を止めない */ }
    return added;
  }
}

export const lexicalRelationService = new LexicalRelationService();
