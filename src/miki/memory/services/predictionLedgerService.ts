import { storageService } from '../../../services/storageService';
import { worldModelGraphService } from '../../selfAwareness/services/worldModelGraphService';

/**
 * P844: 予測台帳（予測処理の「予測→結果→差分で学ぶ」の受け口）。
 *
 * 調査に入る前に「今の自分の世界モデルなら、答えはこうなるはず」
 * という予測を1件残し、後で（日次統合のときに）世界モデルの現在
 * 形と照合する。予測が当たれば CONFIRMED、外れれば REFUTED。
 * 外れた予測は「自分の信念がいつ・どこで間違っていたか」の記録
 * になり、学習の材料になる。信念が無い対象には予測を作らない
 * （分からないものは分からないまま調べる）。
 */

export interface PredictionRecord {
  id: string;
  target: string;
  type: string;
  to: string;
  provisional: boolean;
  gapId?: string;
  createdAt: number;
  outcome: 'OPEN' | 'CONFIRMED' | 'REFUTED';
  settledAt?: number;
}

const STORAGE_KEY = 'miki_predictions_v1';
const MAX_ITEMS = 100;

class PredictionLedgerService {
  private load(): PredictionRecord[] {
    try {
      const parsed = JSON.parse(storageService.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  private save(items: PredictionRecord[]): void {
    try { storageService.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_ITEMS))); } catch { /* 台帳は補助経路 */ }
  }

  /**
   * ギャップの対象について、今の世界モデルから予測を立てる。
   * 関係が無ければ予測なし（undefined）。同じ対象・種類で未照合の
   * 予測があれば、それを返す（重ねて作らない）。
   */
  public predictForTarget(target: string, gapId?: string): PredictionRecord | undefined {
    const clean = String(target || '').trim();
    if (!clean) return undefined;
    try {
      const relations = worldModelGraphService.relationsOf(clean).filter((r) => r.from === clean);
      if (relations.length === 0) return undefined;
      const items = this.load();
      const existing = items.find((p) => p.outcome === 'OPEN' && p.target === clean
        && relations.some((r) => r.type === p.type));
      if (existing) return existing;
      // 確定した関係を優先し、無ければ確信度の高い仮関係を使う。
      const sorted = [...relations].sort((a, b) =>
        Number(a.provisional) - Number(b.provisional) || (b.confidence || 0) - (a.confidence || 0));
      const best = sorted[0];
      const record: PredictionRecord = {
        id: `PRED-${clean}-${best.type}-${Date.now()}`,
        target: clean,
        type: best.type,
        to: best.to,
        provisional: Boolean(best.provisional),
        gapId,
        createdAt: Date.now(),
        outcome: 'OPEN',
      };
      items.push(record);
      this.save(items);
      return record;
    } catch { return undefined; }
  }

  /**
   * 未照合の予測を、世界モデルの現在形と照合する。
   * - 同じ向きの確定関係があれば CONFIRMED。
   * - IS_A は1つの対象に1つの分類が基本なので、別の分類が
   *   確定していたら REFUTED（予測が外れた）。
   * それ以外はまだ OPEN のまま。
   */
  public settleAll(now = Date.now()): { confirmed: number; refuted: number } {
    let confirmed = 0;
    let refuted = 0;
    try {
      const items = this.load();
      let changed = false;
      for (const p of items) {
        if (p.outcome !== 'OPEN') continue;
        const relations = worldModelGraphService.relationsOf(p.target)
          .filter((r) => r.from === p.target && r.type === p.type && !r.provisional);
        if (relations.some((r) => r.to === p.to)) {
          p.outcome = 'CONFIRMED';
          p.settledAt = now;
          confirmed++;
          changed = true;
        } else if (p.type === 'IS_A' && relations.length > 0) {
          p.outcome = 'REFUTED';
          p.settledAt = now;
          refuted++;
          changed = true;
        }
      }
      if (changed) this.save(items);
    } catch { /* 照合できなくても他の処理は止めない */ }
    return { confirmed, refuted };
  }

  public list(): PredictionRecord[] {
    return this.load();
  }

  public stats(): { open: number; confirmed: number; refuted: number; lastRefutedTarget: string } {
    const items = this.load();
    const refutedItems = items.filter((p) => p.outcome === 'REFUTED');
    return {
      open: items.filter((p) => p.outcome === 'OPEN').length,
      confirmed: items.filter((p) => p.outcome === 'CONFIRMED').length,
      refuted: refutedItems.length,
      lastRefutedTarget: refutedItems.length > 0 ? refutedItems[refutedItems.length - 1].target : '',
    };
  }
}

export const predictionLedgerService = new PredictionLedgerService();
