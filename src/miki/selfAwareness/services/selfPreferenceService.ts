import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';

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
  updatedAt: number;
}

const KEY = 'miki_self_preferences_v1';
const DERIVE_THRESHOLD = 6;
const COUNT_CAP = 200;
// 頻度に数えても意味のない一般語（内容語に混ざるもの）。
const FREQUENCY_STOPWORDS = new Set([
  '今日', '明日', '昨日', '話', 'こと', 'もの', '自分', '相手', '時間',
  '感じ', '方', '時', '今', 'これ', 'それ', 'あれ', 'ここ', 'そこ',
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
    return { taught: [], termCounts: {}, updatedAt: Date.now() };
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
    const unique = [...new Set(terms.map((t) => String(t || '').trim()))]
      .filter((t) => t.length >= 2 && !FREQUENCY_STOPWORDS.has(t));
    if (unique.length === 0) return;
    const all = this.loadAll();
    const state = all[personaId] ?? this.emptyState();
    for (const t of unique) state.termCounts[t] = (state.termCounts[t] ?? 0) + 1;
    const entries = Object.entries(state.termCounts);
    if (entries.length > COUNT_CAP) {
      entries.sort((a, b) => b[1] - a[1]);
      state.termCounts = Object.fromEntries(entries.slice(0, COUNT_CAP));
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
}

export const selfPreferenceService = new SelfPreferenceService();
