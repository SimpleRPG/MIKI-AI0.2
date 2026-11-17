import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';

export type ResearchPrediction = 'LEARNABLE' | 'EMPTY';

export interface ResearchRecord {
  capabilityId: string;
  attempts: number;
  successes: number;
  consecutiveFailures: number;
  surprises: number;
  lastPrediction?: ResearchPrediction;
  updatedAt: number;
}

const LEDGER_KEY = 'miki_research_predictions_v1';

/**
 * P906（対応表#7 予測誤差の定常ループ）: 能力ギャップの調査に
 * ついて「調べれば得られるか」を予測し、結果と照合して、誤差を
 * 次の調査順へ還す。
 *
 * 世界関係の予測（predictionLedgerService）とは記録の形が違う
 * （三つ組みではなく調査の成否）ため、台帳は分ける。予測は
 * 「直近2回連続で空振りなら EMPTY、それ以外は LEARNABLE」。
 * 連続空振りのギャップは順位で後ろへ回るが、除外はしない。
 */
class ResearchPredictionService {
  private load(): ResearchRecord[] {
    try {
      const parsed = JSON.parse(storageService.getItem(LEDGER_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  private save(items: ResearchRecord[]): void {
    try { storageService.setItem(LEDGER_KEY, JSON.stringify(items.slice(-100))); } catch { /* 台帳は補助経路 */ }
  }

  public record(capabilityId: string): ResearchRecord | undefined {
    return this.load().find((r) => r.capabilityId === capabilityId);
  }

  /** 調査前の予測。予測は台帳に残し、settle で照合する。 */
  public predict(capabilityId: string): ResearchPrediction {
    const items = this.load();
    let rec = items.find((r) => r.capabilityId === capabilityId);
    if (!rec) {
      rec = { capabilityId, attempts: 0, successes: 0, consecutiveFailures: 0, surprises: 0, updatedAt: Date.now() };
      items.push(rec);
    }
    const prediction: ResearchPrediction = rec.consecutiveFailures >= 2 ? 'EMPTY' : 'LEARNABLE';
    rec.lastPrediction = prediction;
    rec.updatedAt = Date.now();
    this.save(items);
    return prediction;
  }

  /** 調査後の照合。予測と食い違ったら予測誤差（surprise）として数える。 */
  public settle(capabilityId: string, learned: boolean): { surprise: boolean } {
    const items = this.load();
    let rec = items.find((r) => r.capabilityId === capabilityId);
    if (!rec) {
      rec = { capabilityId, attempts: 0, successes: 0, consecutiveFailures: 0, surprises: 0, updatedAt: Date.now() };
      items.push(rec);
    }
    const surprise = Boolean(rec.lastPrediction)
      && ((rec.lastPrediction === 'LEARNABLE' && !learned) || (rec.lastPrediction === 'EMPTY' && learned));
    rec.attempts++;
    if (learned) {
      rec.successes++;
      rec.consecutiveFailures = 0;
    } else {
      rec.consecutiveFailures++;
    }
    if (surprise) {
      rec.surprises++;
      systemLogger.info('SELF_IMPROVEMENT', `🎯 [予測誤差] 「${capabilityId}」の調査予測が外れました（予測: ${rec.lastPrediction}、実際: ${learned ? '得られた' : '空振り'}）`);
    }
    rec.lastPrediction = undefined;
    rec.updatedAt = Date.now();
    this.save(items);
    return { surprise };
  }

  /** 順位への調整: 連続空振り2回以上は 1（後ろへ回す）。 */
  public rankPenalty(capabilityId: string): number {
    const rec = this.record(capabilityId);
    return rec && rec.consecutiveFailures >= 2 ? 1 : 0;
  }
}

export const researchPredictionService = new ResearchPredictionService();
