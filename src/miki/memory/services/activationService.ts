import { storageService } from '../../../services/storageService';

/**
 * P845: 活性化台帳（ACT-R のベースレベル活性化）。
 *
 * 語が「使われた」回数と新しさから、その語がどれだけ思い出し
 * やすいか（活性化）を数える。教わった語は登録のたびに熱が
 * 入る。活性化は時間で冷める（半減期7日）。
 *
 * 消費先についての実測（P845）: 話題の舞台の候補プールに熱い語を
 * 混ぜると、「直近に言及された順」というプールの契約に依存する
 * 照応・省略解決が誤作動した。そのため活性化はまず台帳と
 * スナップショットでの可視化までとし、消費は直近性が意味を
 * 持たない選択の場面（話題の問いかけ候補など）に限って入れる。
 */

interface ActivationEntry {
  count: number;
  lastAt: number;
}

const STORAGE_KEY = 'miki_activation_v1';
const MAX_TERMS = 200;
const HALF_LIFE_MS = 7 * 24 * 3600_000;

class ActivationService {
  private load(): Record<string, ActivationEntry> {
    try {
      const parsed = JSON.parse(storageService.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }

  private save(data: Record<string, ActivationEntry>): void {
    try {
      const entries = Object.entries(data)
        .sort((a, b) => b[1].lastAt - a[1].lastAt)
        .slice(0, MAX_TERMS);
      storageService.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch { /* 台帳は補助経路 */ }
  }

  /** 語が使われた（教わった）ことを記録する。 */
  public tick(term: string, at = Date.now()): void {
    const clean = String(term || '').trim();
    if (!clean) return;
    try {
      const data = this.load();
      const entry = data[clean] || { count: 0, lastAt: 0 };
      entry.count += 1;
      entry.lastAt = Math.max(entry.lastAt, at);
      data[clean] = entry;
      this.save(data);
    } catch { /* 記録できなくても本流は止めない */ }
  }

  /** 活性化スコア。回数の対数 × 時間減衰。未記録は0。 */
  public score(term: string, now = Date.now()): number {
    try {
      const entry = this.load()[String(term || '').trim()];
      if (!entry || entry.count <= 0) return 0;
      const decay = Math.pow(0.5, Math.max(0, now - entry.lastAt) / HALF_LIFE_MS);
      return (1 + Math.log(entry.count)) * decay;
    } catch { return 0; }
  }

  /** 活性化の高い順に語を返す。 */
  public top(limit = 5, now = Date.now()): Array<{ term: string; score: number }> {
    try {
      return Object.keys(this.load())
        .map((term) => ({ term, score: this.score(term, now) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch { return []; }
  }
}

export const activationService = new ActivationService();
