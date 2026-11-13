import { storageService } from '../../../services/storageService';

/**
 * P853（認知アーキテクチャ対応表 #10 CLARION の明示／暗黙二層）:
 * 社交の定型文（固定返答）の「暗黙層」＝使用統計を持つ共有サービス。
 *
 * 固定返答は回転で選ばれるため、使用回数そのものに優劣の意味はない。
 * 暗黙の信号として使えるのは負の証拠だけ：その返答の直後にユーザーが
 * 訂正（違う・そうじゃない）で返した回数を「当たり」として記録し、
 * 繰り返し当たった言い回しは明示的な規則として降格（回転から外す）
 * する。統計はスナップショットにも出し、教師が言い回しを供給する
 * ときの材料にもする。
 */

const STATS_KEY = 'miki_fixed_reply_stats_v1';
const LAST_KEY = 'miki_last_fixed_reply_v1';

export interface FixedReplyStat {
  used: number;
  strikes: number;
}

type StatsMap = Record<string, Record<string, FixedReplyStat>>;

class FixedReplyStatsService {
  private load(): StatsMap {
    try {
      const parsed = JSON.parse(storageService.getItem(STATS_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed as StatsMap : {};
    } catch { return {}; }
  }

  private save(stats: StatsMap): void {
    try { storageService.setItem(STATS_KEY, JSON.stringify(stats)); } catch { /* 統計は補助 */ }
  }

  /** 固定返答を1回使ったことを記録し、「直近の固定返答」も残す。 */
  public recordUse(category: string, index: number): void {
    const stats = this.load();
    const byIndex = stats[category] || (stats[category] = {});
    const entry = byIndex[String(index)] || (byIndex[String(index)] = { used: 0, strikes: 0 });
    entry.used += 1;
    this.save(stats);
    try {
      storageService.setItem(LAST_KEY, JSON.stringify({ category, index, at: Date.now() }));
    } catch { /* 補助経路 */ }
  }

  /**
   * 直近の固定返答（10分以内）に訂正が続いたら「当たり」を1つ付ける。
   * 記録は消費する（同じ訂正で二重に数えない）。当たったら true。
   */
  public recordStrikeIfRecent(now = Date.now()): boolean {
    try {
      const last = JSON.parse(storageService.getItem(LAST_KEY) || 'null') as { category?: string; index?: number; at?: number } | null;
      if (!last || typeof last.category !== 'string' || typeof last.index !== 'number') return false;
      if (now - Number(last.at || 0) > 10 * 60_000) return false;
      const stats = this.load();
      const byIndex = stats[last.category] || (stats[last.category] = {});
      const entry = byIndex[String(last.index)] || (byIndex[String(last.index)] = { used: 0, strikes: 0 });
      entry.strikes += 1;
      this.save(stats);
      storageService.removeItem(LAST_KEY);
      return true;
    } catch { return false; }
  }

  /**
   * 降格された言い回しの index 集合。当たり2回以上、かつ使用4回以上
   * （偶然の1回で落とさない）。残りが無くなる場合は降格しない。
   */
  public demotedIndexes(category: string, formCount: number): Set<number> {
    const demoted = new Set<number>();
    if (formCount <= 1) return demoted;
    const byIndex = this.load()[category] || {};
    for (const [idx, entry] of Object.entries(byIndex)) {
      if (entry.strikes >= 2 && entry.used >= 4) demoted.add(Number(idx));
    }
    if (demoted.size >= formCount) demoted.clear();
    return demoted;
  }

  public stats(): StatsMap {
    return this.load();
  }
}

export const fixedReplyStatsService = new FixedReplyStatsService();
