import { semanticDictionaryGraphP209Service } from '../../core/services/semanticDictionaryGraphP209Service';
import { storageService } from '../../../services/storageService';
import { activationService } from '../../memory/services/activationService';
import { systemLogger } from '../../../services/systemLogger';

/**
 * 日本語辞書レイヤー。
 *
 * 設計思想 2.1/2.2/3/18 に合わせ、形態素解析器と辞書を分離する。
 * - BUILTIN: 端末に常駐する小型コア辞書
 * - JMdict/WORDNET/WIKTIONARY/CHIVE: 外部データを正規化して取り込む契約
 * - PERSONAL: ユーザー訂正から育てる永続辞書
 *
 * 巨大辞書本体をTSコードへ直書きせず、同一スキーマの辞書パッケージとして
 * 追加できるようにしてある。解析器は辞書実装へ直接依存しない。
 */
export type JapaneseDictionarySource = 'BUILTIN' | 'JMdict' | 'WORDNET' | 'WIKTIONARY' | 'CHIVE' | 'PERSONAL';
export type JapanesePos = 'NOUN' | 'VERB' | 'ADJECTIVE' | 'ADVERB' | 'PRONOUN' | 'PROPER_NOUN' | 'TECHNICAL' | 'FUNCTION' | 'UNKNOWN';

export interface JapaneseDictionaryEntry {
  surface: string;
  normalized: string;
  lemma?: string;
  reading?: string;
  pos: JapanesePos;
  source: JapaneseDictionarySource;
  priority: number;
  semanticIds?: string[];
  gloss?: string;
  aliases?: string[];
}

export interface JapaneseDictionaryPackage {
  schemaVersion: 1;
  source: JapaneseDictionarySource;
  version?: string;
  dictionaryName?: string;
  entries: JapaneseDictionaryEntry[];
}

export interface JapaneseDictionaryPackageInfo {
  source: JapaneseDictionarySource;
  version?: string;
  dictionaryName?: string;
  entryCount: number;
  importedAt: number;
}


const PERSONAL_KEY = 'miki_japanese_personal_dictionary_v1';
const PACKAGES_KEY = 'miki_japanese_dictionary_packages_v1';

const BUILTIN: string[][] = [
  ['AI','AI','AI','TECHNICAL'],['人工知能','人工知能','人工知能','TECHNICAL'],['アプリ','アプリ','アプリ','TECHNICAL'],['Android','Android','Android','TECHNICAL'],['Galaxy','Galaxy','Galaxy','PROPER_NOUN'],['Termux','Termux','Termux','TECHNICAL'],['Capacitor','Capacitor','Capacitor','TECHNICAL'],['SQLite','SQLite','SQLite','TECHNICAL'],['VBA','VBA','VBA','TECHNICAL'],['Excel','Excel','Excel','PROPER_NOUN'],['JavaScript','JavaScript','JavaScript','TECHNICAL'],['TypeScript','TypeScript','TypeScript','TECHNICAL'],
  ['辞書','辞書','じしょ','NOUN','言葉の意味などを集めて引けるようにしたもの'],['記憶','記憶','きおく','NOUN','物事を覚えておくこと。また、覚えている内容'],['会話','会話','かいわ','NOUN','言葉を交わして話すこと'],['質問','質問','しつもん','NOUN','分からないことを尋ねること'],['回答','回答','かいとう','NOUN','質問への答え'],['要求','要求','ようきゅう','NOUN'],['条件','条件','じょうけん','NOUN'],['前提','前提','ぜんてい','NOUN'],['目的','目的','もくてき','NOUN'],['原因','原因','げんいん','NOUN'],['結果','結果','けっか','NOUN'],['理由','理由','りゆう','NOUN'],['方法','方法','ほうほう','NOUN'],['比較','比較','ひかく','NOUN'],['判断','判断','はんだん','NOUN'],['候補','候補','こうほ','NOUN'],['証拠','証拠','しょうこ','NOUN'],['根拠','根拠','こんきょ','NOUN'],['反証','反証','はんしょう','NOUN'],['事実','事実','じじつ','NOUN'],['主張','主張','しゅちょう','NOUN'],['知識','知識','ちしき','NOUN'],['能力','能力','のうりょく','NOUN'],['部品','部品','ぶひん','NOUN'],['実装','実装','じっそう','NOUN'],['検証','検証','けんしょう','NOUN'],['試験','試験','しけん','NOUN'],['失敗','失敗','しっぱい','NOUN'],['成功','成功','せいこう','NOUN'],['修正','修正','しゅうせい','NOUN'],['訂正','訂正','ていせい','NOUN'],['改善','改善','かいぜん','NOUN'],['安全','安全','あんぜん','NOUN'],['速度','速度','そくど','NOUN'],['負荷','負荷','ふか','NOUN'],['電池','電池','でんち','NOUN'],['発熱','発熱','はつねつ','NOUN'],['環境','環境','かんきょう','NOUN'],['状態','状態','じょうたい','NOUN'],['話題','話題','わだい','NOUN'],['記録','記録','きろく','NOUN'],['履歴','履歴','りれき','NOUN'],['出典','出典','しゅってん','NOUN'],
  ['これ','これ','これ','PRONOUN'],['それ','それ','それ','PRONOUN'],['あれ','あれ','あれ','PRONOUN'],['どれ','どれ','どれ','PRONOUN'],['ここ','ここ','ここ','ADVERB'],['そこ','そこ','そこ','ADVERB'],['あそこ','あそこ','あそこ','ADVERB'],['今日','今日','きょう','NOUN','現在の日'],['昨日','昨日','きのう','NOUN','今日の前の日'],['明日','明日','あした','NOUN','今日の次の日'],['今','今','いま','NOUN','現在の時点'],['あと','あと','あと','NOUN'],['前','前','まえ','NOUN'],['次','次','つぎ','NOUN'],
  ['する','する','する','VERB'],['できる','できる','できる','VERB'],['使う','使う','つかう','VERB'],['作る','作る','つくる','VERB'],['直す','直す','なおす','VERB'],['考える','考える','かんがえる','VERB'],['調べる','調べる','しらべる','VERB'],['探す','探す','さがす','VERB'],['選ぶ','選ぶ','えらぶ','VERB'],['覚える','覚える','おぼえる','VERB'],['忘れる','忘れる','わすれる','VERB'],['分かる','分かる','わかる','VERB'],['わかる','分かる','わかる','VERB'],['話す','話す','はなす','VERB'],['聞く','聞く','きく','VERB'],['見る','見る','みる','VERB'],['読む','読む','よむ','VERB'],['書く','書く','かく','VERB'],['試す','試す','ためす','VERB'],['保存する','保存する','ほぞんする','VERB'],['削除する','削除する','さくじょする','VERB'],['確認する','確認する','かくにんする','VERB'],['検証する','検証する','けんしょうする','VERB'],['実行する','実行する','じっこうする','VERB'],['戻す','戻す','もどす','VERB'],['変える','変える','かえる','VERB'],['変わる','変わる','かわる','VERB'],
  ['いい','良い','いい','ADJECTIVE'],['良い','良い','よい','ADJECTIVE'],['悪い','悪い','わるい','ADJECTIVE'],['正しい','正しい','ただしい','ADJECTIVE'],['難しい','難しい','むずかしい','ADJECTIVE'],['簡単','簡単','かんたん','ADJECTIVE'],['新しい','新しい','あたらしい','ADJECTIVE'],['古い','古い','ふるい','ADJECTIVE'],['自然','自然','しぜん','ADJECTIVE'],['必要','必要','ひつよう','ADJECTIVE'],['可能','可能','かのう','ADJECTIVE'],['重要','重要','じゅうよう','ADJECTIVE'],
  // P2004: 挨拶・相づち等の基本語は5列目に gloss（意味）を同梱する。
  // 会話側の「知っている」判定は gloss の有無であり、従来は BUILTIN が
  // 意味を持たず、JMdict 供給が届くまで基本挨拶すら未知語扱いに
  // なっていた。小型コアの範囲（挨拶・時間・会話の土台語）に限って
  // 意味を内蔵し、初期状態でも意味が届くようにする。
  ['ありがとう','ありがとう','ありがとう','FUNCTION','感謝の気持ちを表す挨拶の言葉'],['ごめん','ごめん','ごめん','FUNCTION','謝るときに使うくだけた言葉'],['おはよう','おはよう','おはよう','FUNCTION','朝に人と会ったときに使う挨拶の言葉'],['こんにちは','こんにちは','こんにちは','FUNCTION','昼間に人と会ったときに使う挨拶の言葉'],['こんばんは','こんばんは','こんばんは','FUNCTION','夕方から夜にかけて、人と会ったときに使う挨拶の言葉'],['なるほど','なるほど','なるほど','FUNCTION','相手の話に納得したときに使う相づちの言葉'],['うん','うん','うん','FUNCTION','肯定や相づちを表すくだけた言葉'],['はい','はい','はい','FUNCTION','肯定や返事を表す言葉'],['違う','違う','ちがう','VERB'],['違います','違う','ちがう','FUNCTION','同じではないことを丁寧に表す言葉'],
  ['ただいま','ただいま','ただいま','FUNCTION','外出先から家に帰ったときに言う挨拶の言葉'],['おかえり','おかえり','おかえり','FUNCTION','帰ってきた人を迎えるときに言う挨拶の言葉'],['おかえりなさい','おかえりなさい','おかえりなさい','FUNCTION','帰ってきた人を迎えるときに言う丁寧な挨拶の言葉'],['おやすみ','おやすみ','おやすみ','FUNCTION','夜に寝る前に人へ言う挨拶の言葉'],['おやすみなさい','おやすみなさい','おやすみなさい','FUNCTION','夜に寝る前に人へ言う丁寧な挨拶の言葉'],['いただきます','いただきます','いただきます','FUNCTION','食事を始める前に言う挨拶の言葉'],['ごちそうさま','ごちそうさま','ごちそうさま','FUNCTION','食事を終えたときに言う挨拶の言葉'],['いってきます','いってきます','いってきます','FUNCTION','家を出るときに残る人へ言う挨拶の言葉'],['いってらっしゃい','いってらっしゃい','いってらっしゃい','FUNCTION','家を出る人を見送るときに言う挨拶の言葉'],['おつかれさま','おつかれさま','おつかれさま','FUNCTION','仕事や用事を終えた人をねぎらう挨拶の言葉'],['さようなら','さようなら','さようなら','FUNCTION','別れるときに言う挨拶の言葉'],['すみません','すみません','すみません','FUNCTION','謝るときや人の注意を引くときに使う言葉'],['はじめまして','はじめまして','はじめまして','FUNCTION','初めて会った人に最初に言う挨拶の言葉'],['よろしく','よろしく','よろしく','FUNCTION','頼みごとや挨拶の締めに使う言葉'],
];

function normalize(value: string): string { return (value || '').normalize('NFKC').trim().toLowerCase(); }
function makeEntry(row: string[]): JapaneseDictionaryEntry {
  // P2004: 5列目は任意の gloss（意味）。基本語にだけ同梱する。
  const [surface, lemma, reading, pos, gloss] = row;
  return { surface, normalized: normalize(surface), lemma, reading, pos: pos as JapanesePos, source: 'BUILTIN', priority: 40, ...(gloss ? { gloss } : {}) };
}

class JapaneseDictionaryService {
  private static instance: JapaneseDictionaryService;
  private personal = new Map<string, JapaneseDictionaryEntry>();
  private savePersonalTimer: ReturnType<typeof setTimeout> | null = null;
  private imported = new Map<JapaneseDictionarySource, JapaneseDictionaryEntry[]>();
  private packageInfo = new Map<JapaneseDictionarySource, JapaneseDictionaryPackageInfo>();
  private builtinEntries: JapaneseDictionaryEntry[] = BUILTIN.map(makeEntry);
  // P2005: normalized キー→輸入エントリの索引。以前は lookup の
  // たびに輸入辞書全体（実機で 67,283 件）を複写して走査して
  // いたため、形態素解析のトークン毎・学習候補毎の参照が合算で
  // 数十秒級の同期占有になっていた（2026-11-23 実機の固まりの
  // 主因。JMdict 取り込みが届くようになった P2004 で顕在化）。
  // 輸入辞書が変わる地点で破棄され、次回参照時に作り直される。
  private importedIndex: Map<string, JapaneseDictionaryEntry[]> | null = null;
  private semanticIndex: Map<string, Set<string>> | null = null;
  private constructor() { this.loadPersonal(); this.loadPackages(); }
  public static getInstance(): JapaneseDictionaryService { return this.instance ||= new JapaneseDictionaryService(); }

  public lookup(surface: string): JapaneseDictionaryEntry[] {
    const graph = semanticDictionaryGraphP209Service.lookup(surface);
    const graphEntries: JapaneseDictionaryEntry[] = graph.entries.map(entry => ({
      surface: entry.surface, normalized: entry.normalized, lemma: entry.lemma, reading: entry.reading,
      pos: entry.pos, source: 'BUILTIN', priority: entry.priority, semanticIds: entry.semanticIds,
    }));
    const key = normalize(surface);
    if (!key) return [];
    const results = [
      ...(this.personal.has(key) ? [this.personal.get(key)!] : []),
      ...this.importedEntries(key),
      ...this.builtinEntries.filter(e => e.normalized === key),
    ];
    const seen = new Set<string>();
    const legacyEntries = results.filter(e => { const id = `${e.source}|${e.normalized}|${e.lemma || ''}|${e.reading || ''}`; if (seen.has(id)) return false; seen.add(id); return true; })
      .sort((a,b) => b.priority - a.priority);
    // P411: a P209 graph entry shadows legacy entries with the same
    // normalized+POS, but the graph entry itself carries no gloss and only
    // the lexeme concept id. The shadowed JMdict entries hold the WordNet
    // concept ids (wn:...) and the gloss for exactly those basic words, so
    // discarding them severed every concept path that starts from a graph
    // word (辞書・主張・知識・質問 ...): conceptIdsFor returned [] and no
    // concept sibling was reachable from them. Merge the meaning-bearing
    // fields (semanticIds, gloss) into the graph entry instead.
    const mergedGraphEntries = graphEntries.map(graphEntry => {
      const shadowed = legacyEntries.filter(entry => entry.normalized === graphEntry.normalized && entry.pos === graphEntry.pos);
      if (!shadowed.length) return graphEntry;
      const semanticIds = [...new Set([...(graphEntry.semanticIds || []), ...shadowed.flatMap(entry => entry.semanticIds || [])])];
      const gloss = graphEntry.gloss || shadowed.map(entry => entry.gloss).find(value => !!value);
      return gloss ? { ...graphEntry, semanticIds, gloss } : { ...graphEntry, semanticIds };
    });
    return [...mergedGraphEntries, ...legacyEntries.filter(entry => !graphEntries.some(graphEntry => graphEntry.normalized === entry.normalized && graphEntry.pos === entry.pos))];
  }

  public has(surface: string): boolean { return this.lookup(surface).length > 0; }

  public findLongest(text: string, offset: number): JapaneseDictionaryEntry | undefined {
    let best: JapaneseDictionaryEntry | undefined;
    const max = Math.min(text.length, offset + 32);
    for (let end = offset + 1; end <= max; end++) {
      const candidate = text.slice(offset, end);
      const hit = this.lookup(candidate)[0];
      if (hit) best = hit;
    }
    return best;
  }

  public addPersonal(surface: string, options: Partial<Omit<JapaneseDictionaryEntry, 'surface'|'normalized'|'source'|'priority'>> = {}): JapaneseDictionaryEntry | undefined {
    const clean = surface.trim();
    if (!clean) return undefined;
    // P862: 説明文の入口整形。「Xは、〜」の形で教わると、説明の
    // 先頭に読点が残ったまま保存され、受け答えや引用のたびに
    // 「！、草原に…」「は「、草原に…」」と崩れて出ていた。
    // 先頭の句読点・末尾の句点だけを落とす（中身は触らない）。
    const cleanGloss = typeof options.gloss === 'string'
      ? options.gloss.trim().replace(/^[、。，・：:；;！!？?「『（(\s]+/u, '').replace(/。\s*$/u, '').trim() || undefined
      : options.gloss;
    const entry: JapaneseDictionaryEntry = { surface: clean, normalized: normalize(clean), lemma: options.lemma || clean, reading: options.reading, pos: options.pos || 'UNKNOWN', semanticIds: options.semanticIds, gloss: cleanGloss, aliases: options.aliases, source: 'PERSONAL', priority: 100 };
    // P497: 再登録は「最近使った」として末尾へ移す。保存は末尾
    // 5000件の切り出しのため、初回登録順のままだと、よく使う語が
    // 古い一回きりの語に押し出されて再起動で消える。
    this.personal.delete(entry.normalized);
    this.personal.set(entry.normalized, entry); this.savePersonal();
    // P845: 教わった語は活性化台帳にも熱を入れる（思い出しやすさ）。
    try { activationService.tick(clean); } catch { /* 補助経路 */ }
    return entry;
  }

  public removePersonal(surface: string): boolean { const ok = this.personal.delete(normalize(surface)); if (ok) this.savePersonal(); return ok; }
  public listPersonal(): JapaneseDictionaryEntry[] { return [...this.personal.values()]; }

  public importPackage(pkg: JapaneseDictionaryPackage): number {
    if (!pkg || pkg.schemaVersion !== 1 || !Array.isArray(pkg.entries)) return 0;
    const normalized = pkg.entries.filter(e => e?.surface).map(e => ({ ...e, normalized: normalize(e.surface), source: pkg.source, priority: e.priority ?? 60 }));
    if (!normalized.length) return 0;
    this.semanticIndex = null;
    this.importedIndex = null;
    this.imported.set(pkg.source, normalized);
    this.packageInfo.set(pkg.source, { source: pkg.source, version: pkg.version, dictionaryName: pkg.dictionaryName, entryCount: normalized.length, importedAt: Date.now() });
    this.savePackages();
    return normalized.length;
  }

  /** JMdict XMLの主要なentry要素を抽出した正規化JSONを受け取るための軽量API。 */
  public importNormalized(entries: JapaneseDictionaryEntry[], source: Exclude<JapaneseDictionarySource,'BUILTIN'|'PERSONAL'>): number {
    return this.importPackage({ schemaVersion: 1, source, entries });
  }

  /**
   * P386: append individually fetched entries (e.g. deep lookups
   * against the server's full dictionary) to an imported source,
   * deduplicated by normalized surface, and persist them together
   * with that source's package.
   */
  public addImportedEntries(entries: JapaneseDictionaryEntry[], source: Exclude<JapaneseDictionarySource,'BUILTIN'|'PERSONAL'>): number {
    const existing = this.imported.get(source) || [];
    const seen = new Set(existing.map(e => `${e.normalized}::${e.surface}`));
    let added = 0;
    for (const entry of entries || []) {
      if (!entry?.surface) continue;
      const normalized = normalize(entry.surface);
      const key = `${normalized}::${entry.surface}`;
      if (seen.has(key)) continue;
      seen.add(key);
      existing.push({ ...entry, normalized, source, priority: entry.priority ?? 60 });
      added += 1;
    }
    if (added > 0) {
      this.semanticIndex = null;
      this.importedIndex = null;
      this.imported.set(source, existing);
      const info = this.packageInfo.get(source);
      if (info) info.entryCount = existing.length;
      this.savePackages();
    }
    return added;
  }

  /** P389/P390: the WordNet synset ids a term belongs to, if any. */
  public conceptIdsFor(term: string): string[] {
    const ids = new Set<string>();
    for (const entry of this.lookup(term || '')) {
      for (const id of entry.semanticIds || []) if (id.startsWith('wn:')) ids.add(id);
    }
    return [...ids];
  }

  /**
   * P389: concept siblings. Words that share a semantic id (a
   * WordNet synset attached during dictionary conversion) are the
   * same concept in different words — paraphrases of each other.
   * Given content terms, return the lemmas of their concept
   * siblings so callers can recognize a paraphrase as engagement
   * with the same content. The index is built lazily over the
   * entries this service holds and rebuilt when they change.
   */
  public expandConceptSiblings(terms: string[], maxTotal = 24): string[] {
    if (!this.semanticIndex) {
      const index = new Map<string, Set<string>>();
      const addEntry = (entry: JapaneseDictionaryEntry) => {
        for (const id of entry.semanticIds || []) {
          if (!id.startsWith('wn:')) continue;
          const lemmas = index.get(id) || new Set<string>();
          lemmas.add(entry.lemma || entry.surface);
          index.set(id, lemmas);
        }
      };
      for (const entry of this.builtinEntries) addEntry(entry);
      for (const entry of this.personal.values()) addEntry(entry);
      for (const entries of this.imported.values()) for (const entry of entries) addEntry(entry);
      this.semanticIndex = index;
    }
    const termSet = new Set(terms);
    const out = new Set<string>();
    for (const term of terms) {
      for (const entry of this.lookup(term)) {
        for (const id of entry.semanticIds || []) {
          if (!id.startsWith('wn:')) continue;
          for (const lemma of this.semanticIndex.get(id) || []) {
            if (!termSet.has(lemma)) out.add(lemma);
            if (out.size >= maxTotal) return [...out];
          }
        }
      }
    }
    return [...out];
  }

  /**
   * P669: 遊び（しりとり）に使える語の一覧。名詞系で読みがある語を、
   * 内蔵・取り込み・個人の全部から返す。彼女の語彙がそのまま
   * 遊びの材料になる。
   */
  public listPlayableWords(): { surface: string; reading: string }[] {
    const seen = new Set<string>();
    const out: { surface: string; reading: string }[] = [];
    const push = (e: JapaneseDictionaryEntry) => {
      if (!e.reading || e.reading.length < 2) return;
      if (!(e.pos === 'NOUN' || e.pos === 'PROPER_NOUN' || e.pos === 'TECHNICAL')) return;
      const key = normalize(e.surface);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ surface: e.surface, reading: e.reading });
    };
    this.builtinEntries.forEach(push);
    for (const list of this.imported.values()) list.forEach(push);
    for (const e of this.personal.values()) push(e);
    return out;
  }

  public getStats() {
    return { builtin: this.builtinEntries.length, personal: this.personal.size, imported: [...this.imported.entries()].reduce((n,[,v]) => n + v.length, 0), sources: [...this.imported.keys()], packages: [...this.packageInfo.values()] };
  }

  /** 外部辞書(JSON)を取り込む境界。パーサーは呼び出し側に限定し、辞書の真正性を混ぜない。 */
  public importJson(json: string, source: Exclude<JapaneseDictionarySource,'BUILTIN'|'PERSONAL'>): number {
    try {
      const pkg = JSON.parse(json) as JapaneseDictionaryPackage;
      if (pkg.source !== source) return 0;
      return this.importPackage(pkg);
    } catch {
      systemLogger.warn('CHAT', `[JapaneseDictionary] invalid ${source} package rejected`);
      return 0;
    }
  }

  public getPackageInfo(): JapaneseDictionaryPackageInfo[] { return [...this.packageInfo.values()]; }

  private importedEntries(key: string): JapaneseDictionaryEntry[] {
    if (!this.importedIndex) {
      const index = new Map<string, JapaneseDictionaryEntry[]>();
      for (const entries of this.imported.values()) {
        for (const entry of entries) {
          const bucket = index.get(entry.normalized);
          if (bucket) bucket.push(entry);
          else index.set(entry.normalized, [entry]);
        }
      }
      this.importedIndex = index;
    }
    return this.importedIndex.get(key) || [];
  }
  private loadPersonal() { try { const arr = storageService.getJson<JapaneseDictionaryEntry[]>(PERSONAL_KEY, []); if (Array.isArray(arr)) for (const e of arr) if (e?.normalized) this.personal.set(e.normalized, e); } catch { /* conservative empty dictionary */ } }
  private savePersonal() {
    // P499: 保存を短い窓でまとめる（意味学習は1ページで複数語を
    // 連続登録するため、その都度の全件 JSON 化を避ける）。
    if (this.savePersonalTimer) return;
    this.savePersonalTimer = setTimeout(() => {
      this.savePersonalTimer = null;
      try { const all=[...this.personal.values()]; if (all.length>5000) systemLogger.warn('CHAT', `[JapaneseDictionary] 個人辞書が保存上限5000件を超えたため、古い${all.length-5000}件は保存されません（メモリ内には保持）`); storageService.setItem(PERSONAL_KEY, JSON.stringify(all.slice(-5000))); } catch { systemLogger.warn('CHAT', '[JapaneseDictionary] personal dictionary persistence unavailable'); }
    }, 150);
  }
  private loadPackages() {
    try {
      const raw = storageService.getItem(PACKAGES_KEY);
      const saved = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(saved)) return;
      for (const item of saved) {
        if (item?.package?.source && Array.isArray(item.package.entries)) {
          const pkg = item.package as JapaneseDictionaryPackage;
          const normalized = pkg.entries.filter(e => e?.surface).map(e => ({ ...e, normalized: normalize(e.surface), source: pkg.source, priority: e.priority ?? 60 }));
          this.imported.set(pkg.source, normalized);
          this.packageInfo.set(pkg.source, { source: pkg.source, version: pkg.version, dictionaryName: pkg.dictionaryName, entryCount: normalized.length, importedAt: Number(item.importedAt) || Date.now() });
        }
      }
    } catch { systemLogger.warn('CHAT', '[JapaneseDictionary] persisted package load failed; starting empty external dictionary layer'); }
  }
  private savePackages() {
    try {
      const packages = [...this.imported.entries()].map(([source, entries]) => {
        const info = this.packageInfo.get(source);
        return { importedAt: info?.importedAt || Date.now(), package: { schemaVersion: 1, source, version: info?.version, dictionaryName: info?.dictionaryName, entries } as JapaneseDictionaryPackage };
      });
      storageService.setItem(PACKAGES_KEY, JSON.stringify(packages));
    } catch { systemLogger.warn('CHAT', '[JapaneseDictionary] external dictionary persistence unavailable'); }
  }
}

export const japaneseDictionaryService = JapaneseDictionaryService.getInstance();
