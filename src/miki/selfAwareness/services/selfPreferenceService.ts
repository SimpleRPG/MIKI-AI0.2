import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { isBackchannelText } from '../../memory/services/utteranceFeatureService';

/*
 * P578: みき／ビービー自身の「好き・興味・得意」の置き場。
 *
 * 出所は2つ（きりあの指定で両方）:
 *   A. 教えてもらう: 「みきはXが好き」のような教示で記録する（確実）。
 *   B. 会話の頻度から導く: 会話に出てくる内容語を人格ごとに数え、
 *      よく出るものを「よく話すもの」として弱く持つ。頻度は好みの
 *      代理でしかないので、教示（A）とは分けて弱く扱う。
 *
 * 人格ごとに分けて持つ（頭脳・記憶は共有でも、好みは人格の輪郭）。
 */

export type SelfPreferenceKind = 'like' | 'interest' | 'good_at';

export interface SelfPreferenceRecord {
  term: string;
  kind: SelfPreferenceKind;
  at: number;
}

interface PersonaPreferenceState {
  taught: SelfPreferenceRecord[];
  termCounts: Record<string, number>;
  /** P935: 頻度が育って「好きになってきた」もの（教示とは別枠）。 */
  grown: Array<{ term: string; at: number; count: number }>;
  updatedAt: number;
}

const KEY = 'miki_self_preferences_v1';
const DERIVE_THRESHOLD = 6;
const GROWN_THRESHOLD = 15;
const COUNT_CAP = 200;
// 頻度に数えても意味のない一般語（内容語に混ざるもの）。
const FREQUENCY_STOPWORDS = new Set([
  '今日', '明日', '昨日', '話', 'こと', 'もの', '自分', '相手', '時間',
  '感じ', '方', '時', '今', 'これ', 'それ', 'あれ', 'ここ', 'そこ',
  // P935: 機能語・助動詞・彼女自身の名前など、好みになり得ない語。
  'いい', 'どう', 'する', 'した', 'して', 'ある', 'いる', 'なる', 'ない',
  'なん', 'なに', 'どれ', 'どの', 'です', 'ます', 'たい', 'けど', 'けれど',
  'から', 'ので', 'のに', 'ため', 'よう', 'みたい', 'らしい',
  '好き', '興味', '得意', '教えて', '知りたい', 'ビービー',
  // 会話そのものについての語（話題ではないもの）。
  '何日', '何時', '名前', 'どっち', 'どちら', 'いつ', 'どこ', '誰',
  'なぜ', 'なんで', '意味',
]);

class SelfPreferenceService {
  private loadAll(): Record<string, PersonaPreferenceState> {
    try {
      const raw = storageService.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private saveAll(all: Record<string, PersonaPreferenceState>): void {
    storageService.setItem(KEY, JSON.stringify(all));
  }

  private emptyState(): PersonaPreferenceState {
    return { taught: [], termCounts: {}, grown: [], updatedAt: Date.now() };
  }

  private normalize(state: PersonaPreferenceState): PersonaPreferenceState {
    if (!Array.isArray(state.grown)) state.grown = [];
    return state;
  }

  /** A: 教示で記録する。同じ語・同じ種類は重ねない。 */
  public recordTaught(personaId: string, term: string, kind: SelfPreferenceKind): void {
    const t = String(term || '').trim();
    if (!personaId || !t) return;
    const all = this.loadAll();
    const state = all[personaId] ?? this.emptyState();
    if (!state.taught.some((p) => p.term === t && p.kind === kind)) {
      state.taught = [...state.taught, { term: t, kind, at: Date.now() }].slice(-50);
      systemLogger.info('SYSTEM', `💗 [自己の輪郭] ${personaId} の${kind === 'like' ? '好き' : kind === 'good_at' ? '得意' : '興味'}として「${t}」を覚えました。`);
    }
    state.updatedAt = Date.now();
    all[personaId] = state;
    this.saveAll(all);
  }

  public listTaught(personaId: string): SelfPreferenceRecord[] {
    return this.loadAll()[personaId]?.taught ?? [];
  }

  /** B: 会話の内容語を数える（1回の呼び出しでは同じ語は1回まで）。 */
  public observeTerms(personaId: string, terms: string[]): void {
    if (!personaId || !Array.isArray(terms) || terms.length === 0) return;
    // P659: 相槌は頻度が高くても「よく話すもの」ではない。相槌の
    // 語群は共有の特徴層（isBackchannelText）で判定する。
    const unique = [...new Set(terms.map((t) => String(t || '').trim()))]
      .filter((t) => t.length >= 2 && !FREQUENCY_STOPWORDS.has(t) && !isBackchannelText(t)
        // P935: ひらがな2文字以下は機能語の混入が多く、好みの材料にしない。
        && !(/^[ぁ-ん]+$/.test(t) && t.length <= 2));
    if (unique.length === 0) return;
    const all = this.loadAll();
    const state = this.normalize(all[personaId] ?? this.emptyState());
    for (const t of unique) state.termCounts[t] = (state.termCounts[t] ?? 0) + 1;
    const entries = Object.entries(state.termCounts);
    if (entries.length > COUNT_CAP) {
      // P935: 上限で切り捨てるとき、今まさに話している語は守る。
      // 守らないと、表が飽和した後は新しい好みが永遠に育たない。
      const current = new Set(unique);
      const others = entries
        .filter(([term]) => !current.has(term))
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.max(0, COUNT_CAP - current.size));
      const kept: Record<string, number> = Object.fromEntries(others);
      for (const t of current) kept[t] = state.termCounts[t];
      state.termCounts = kept;
    }
    // P935: 頻度が十分に育った語は「好きになってきたもの」へ
    // 昇格する。教示された好みとは出所を分けたままにする。
    const taughtTerms = new Set(state.taught.map((p) => p.term));
    for (const t of unique) {
      const count = state.termCounts[t] || 0;
      if (count >= GROWN_THRESHOLD && !taughtTerms.has(t) && !state.grown.some((g) => g.term === t)) {
        state.grown = [...state.grown, { term: t, at: Date.now(), count }].slice(-30);
        systemLogger.info('SYSTEM', `💗 [好みの成長] ${personaId} は「${t}」をよく話すうちに好きになってきました（頻度 ${count}）。`);
      }
    }
    state.updatedAt = Date.now();
    all[personaId] = state;
    this.saveAll(all);
  }

  /** B: 頻度から導いた「よく話すもの」。教示済みの語は除く。 */
  public derivedInterests(personaId: string, limit: number = 5): string[] {
    const state = this.loadAll()[personaId];
    if (!state) return [];
    const taughtTerms = new Set(state.taught.map((p) => p.term));
    return Object.entries(state.termCounts)
      .filter(([term, count]) => count >= DERIVE_THRESHOLD && !taughtTerms.has(term))
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term]) => term);
  }

  /**
   * P935: 頻度由来の強さ。入口は従来どおり弱く（7回で 0.4）、
   * 回数に応じて 0.65 まで育つ（教示の好き=1.0 には届かない）。
   * 育った好みは下限 0.7。
   */
  public derivedInterestStrengths(personaId: string, limit: number = 10): Array<{ term: string; strength: number; grown: boolean }> {
    const state = this.loadAll()[personaId];
    if (!state) return [];
    const taughtTerms = new Set(state.taught.map((p) => p.term));
    const grownTerms = new Set((state.grown || []).map((g) => g.term));
    return Object.entries(state.termCounts)
      .filter(([term, count]) => count >= DERIVE_THRESHOLD && !taughtTerms.has(term))
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term, count]) => {
        const grown = grownTerms.has(term);
        // 従来の入口の強さ（7回で 0.4）を保ちつつ、回数で育てる。
        const raw = grown
          ? Math.min(0.85, 0.7 + (count - GROWN_THRESHOLD) * 0.01)
          : Math.min(0.65, 0.19 + count * 0.03);
        const strength = Math.round(raw * 100) / 100;
        return { term, strength, grown };
      });
  }

  /** P935: 育った好みの一覧（新しい順）。 */
  public listGrown(personaId: string): Array<{ term: string; at: number; count: number }> {
    const state = this.loadAll()[personaId];
    if (!state || !Array.isArray(state.grown)) return [];
    return [...state.grown].reverse();
  }

  /** P935: 全人格分の育った好みの総数（自己点検用）。 */
  public grownCount(): number {
    return Object.values(this.loadAll())
      .reduce((sum, state) => sum + (Array.isArray(state.grown) ? state.grown.length : 0), 0);
  }
}

export const selfPreferenceService = new SelfPreferenceService();
