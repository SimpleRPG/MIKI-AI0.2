import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';

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

export type LexicalRelationType = 'SYNONYM' | 'ANTONYM' | 'HYPERNYM';
export type LexicalRelationSource = 'seed' | 'wikidata' | 'teacher' | 'manual';

export interface LexicalRelation {
  a: string;
  b: string;
  type: LexicalRelationType;
  source: LexicalRelationSource;
  updatedAt: number;
}

const RELATIONS_KEY = 'miki_lexical_relations_v1';
const ATTEMPTS_KEY = 'miki_lexical_wikidata_attempts_v1';
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

function normalizeTerm(term: string): string {
  return String(term || '').toLowerCase().trim();
}

class LexicalRelationService {
  private relations: LexicalRelation[] = [];
  private synonymMap = new Map<string, Set<string>>();
  private antonymMap = new Map<string, Set<string>>();
  private hypernymMap = new Map<string, Set<string>>(); // 下位 -> 上位
  private hyponymMap = new Map<string, Set<string>>(); // 上位 -> 下位
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
    if (this.relations.length === 0) {
      const now = Date.now();
      for (const [a, b] of SEED_ANTONYMS) this.relations.push({ a, b, type: 'ANTONYM', source: 'seed', updatedAt: now });
      for (const [a, b] of SEED_SYNONYMS) this.relations.push({ a, b, type: 'SYNONYM', source: 'seed', updatedAt: now });
      for (const [a, b] of SEED_HYPERNYMS) this.relations.push({ a, b, type: 'HYPERNYM', source: 'seed', updatedAt: now });
      this.save();
    }
    this.rebuildIndex();
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
      } else {
        link(this.hypernymMap, rel.a, rel.b);
        link(this.hyponymMap, rel.b, rel.a);
      }
    }
  }

  public addRelation(aRaw: string, bRaw: string, type: LexicalRelationType, source: LexicalRelationSource): boolean {
    this.load();
    const a = normalizeTerm(aRaw);
    const b = normalizeTerm(bRaw);
    if (!a || !b || a === b) return false;
    const exists = this.relations.some((r) =>
      r.type === type &&
      (type === 'HYPERNYM'
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

  public hypernymPairs(): Array<[string, string]> {
    this.load();
    return this.relations.filter((r) => r.type === 'HYPERNYM').map((r) => [r.a, r.b] as [string, string]);
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

  public counts(): { total: number; synonym: number; antonym: number; hypernym: number; wikidata: number } {
    this.load();
    return {
      total: this.relations.length,
      synonym: this.relations.filter((r) => r.type === 'SYNONYM').length,
      antonym: this.relations.filter((r) => r.type === 'ANTONYM').length,
      hypernym: this.relations.filter((r) => r.type === 'HYPERNYM').length,
      wikidata: this.relations.filter((r) => r.source === 'wikidata').length,
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
   * ストアに足す。別名=同義、P461=反対、P279/P31=上位。
   * 失敗しても例外は投げない。同じ語は7日間引き直さない
   * （共有基盤への配慮と無駄撃ち防止）。
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

      const search = await callApi({
        action: 'wbsearchentities', search: term, language: 'ja', uselang: 'ja', type: 'item', limit: '1',
      });
      const hit = Array.isArray(search?.search) ? search.search[0] : null;
      if (!hit?.id) return 0;

      const aliases = Array.isArray(hit.aliases) ? hit.aliases : [];
      for (const alias of aliases.slice(0, 8)) {
        const aliasText = String(alias || '').trim();
        if (aliasText.length >= 2 && aliasText.length <= 20 && normalizeTerm(aliasText) !== term) {
          if (this.addRelation(term, aliasText, 'SYNONYM', 'wikidata')) added++;
        }
      }

      const entityData = await callApi({ action: 'wbgetentities', ids: hit.id, props: 'claims' });
      const claims = entityData?.entities?.[hit.id]?.claims || {};
      const targetIds = new Map<string, LexicalRelationType>();
      for (const id of (claims.P461 || []).map((c: any) => c?.mainsnak?.datavalue?.value?.id).filter(Boolean)) {
        targetIds.set(String(id), 'ANTONYM');
      }
      for (const prop of ['P279', 'P31']) {
        for (const id of (claims[prop] || []).map((c: any) => c?.mainsnak?.datavalue?.value?.id).filter(Boolean)) {
          if (!targetIds.has(String(id))) targetIds.set(String(id), 'HYPERNYM');
        }
      }
      if (targetIds.size > 0) {
        const labels = await callApi({
          action: 'wbgetentities', ids: [...targetIds.keys()].join('|'), props: 'labels', languages: 'ja',
        });
        for (const [id, type] of targetIds) {
          const label = labels?.entities?.[id]?.labels?.ja?.value;
          if (typeof label === 'string' && label.trim().length >= 2) {
            if (this.addRelation(term, label, type, 'wikidata')) added++;
          }
        }
      }
      if (added > 0) {
        systemLogger.info('SELF_IMPROVEMENT', `📚 [語彙ルール] Wikidataから「${term}」の語関係を${added}件学習（累計${this.relations.length}件）`);
      }
    } catch { /* 辞書引きの失敗は学習全体を止めない */ }
    return added;
  }
}

export const lexicalRelationService = new LexicalRelationService();
