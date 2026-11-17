import { storageService } from '../../../services/storageService';

/**
 * P910: プロダクション競合の観測（対応表#2・第1段）。
 *
 * 会話コアの早期回答レーンは実質プロダクション（条件→即答）だが、
 * 優先は呼び出し順の固定で、複数レーンが同時にマッチしても
 * 記録が残らなかった。第2段（具体度・活性化による解決）に
 * 進む前に、まず「競合が実際にどこで起きるか」を数える。
 *
 * 対象は同形ファミリーの fact_*（本人の事実）と gloss_*
 * （辞書の説明）の3組：最上級・差分・比。どれも読み取り専用の
 * 純粋なマッチャであることを確認済みで、fact 側がマッチした
 * ときだけ gloss 側を影で評価する。挙動は一切変えない
 * （勝者は従来どおり呼び出し順で fact）。
 *
 * 台帳は直近50件だけを保つ（観測が保存を重くしないため）。
 */

export type ProductionFamily = 'superlative' | 'difference' | 'ratio';

export interface ProductionConflictRecord {
  family: ProductionFamily;
  winner: 'fact';
  at: number;
  prompt: string;
}

const STORAGE_KEY = 'miki_production_conflicts_v1';
const CAP = 50;

class ProductionConflictService {
  private load(): ProductionConflictRecord[] {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public record(family: ProductionFamily, prompt: string): void {
    try {
      const records = this.load();
      records.push({ family, winner: 'fact', at: Date.now(), prompt: String(prompt || '').slice(0, 60) });
      while (records.length > CAP) records.shift();
      storageService.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch { /* 観測の記録は補助経路 */ }
  }

  public recent(limit = CAP): ProductionConflictRecord[] {
    return this.load().slice(-limit);
  }

  public summary(): { total: number; byFamily: Record<string, number> } {
    const byFamily: Record<string, number> = {};
    let total = 0;
    for (const r of this.load()) {
      total++;
      byFamily[r.family] = (byFamily[r.family] || 0) + 1;
    }
    return { total, byFamily };
  }
}

export const productionConflictService = new ProductionConflictService();
