import { storageService } from '../../../services/storageService';

/**
 * P915: コード合成の試行統計（コード生成・第1段の棚卸し）。
 *
 * 合成が「何回試みて、何回通り、何の理由で止まったか」を
 * 理由コード別の件数としてだけ残す。失敗理由の分布が、そのまま
 * 部品の不足リストになる（post-table 能力リスト第3項・第1段）。
 * 個別の試行内容は残さない（件数だけの軽い台帳）。
 */

export interface CodeSynthesisStats {
  total: number;
  succeeded: number;
  byReason: Record<string, number>;
}

const STORAGE_KEY = 'miki_code_synthesis_stats_v1';

class CodeSynthesisStatsService {
  private load(): CodeSynthesisStats {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (!raw) return { total: 0, succeeded: 0, byReason: {} };
      const parsed = JSON.parse(raw);
      return {
        total: typeof parsed?.total === 'number' ? parsed.total : 0,
        succeeded: typeof parsed?.succeeded === 'number' ? parsed.succeeded : 0,
        byReason: parsed?.byReason && typeof parsed.byReason === 'object' ? parsed.byReason : {},
      };
    } catch {
      return { total: 0, succeeded: 0, byReason: {} };
    }
  }

  private save(stats: CodeSynthesisStats): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch { /* 統計は補助経路 */ }
  }

  /** 合成の試行を1件記録する。blockedReason があれば失敗として数える。 */
  public record(blockedReason?: string): void {
    const stats = this.load();
    stats.total++;
    if (blockedReason) {
      stats.byReason[blockedReason] = (stats.byReason[blockedReason] || 0) + 1;
    } else {
      stats.succeeded++;
    }
    this.save(stats);
  }

  public summary(): CodeSynthesisStats {
    return this.load();
  }
}

export const codeSynthesisStatsService = new CodeSynthesisStatsService();
