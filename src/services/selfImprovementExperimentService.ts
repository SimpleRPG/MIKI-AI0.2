import { SelfImprovementMetrics, selfImprovementMetricsService } from './selfImprovementMetricsService';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

export type ExperimentVerdict = 'ADOPT' | 'HOLD' | 'REJECT';
export interface ImprovementExperimentSnapshot {
  metrics: SelfImprovementMetrics;
  memoryCount: number;
  stableCaseCount: number;
  openGapCount: number;
  createdAt: number;
}
export interface ImprovementExperimentResult {
  experiment_id: string;
  action: string;
  before: ImprovementExperimentSnapshot;
  after: ImprovementExperimentSnapshot;
  verdict: ExperimentVerdict;
  scoreDelta: number;
  reason: string;
  createdAt: number;
}

/**
 * 自己改善の評価境界。
 * 改善処理そのものは行わず、改善前後を同じ観測値で比較して
 * ADOPT / HOLD / REJECT を決める。副作用のある自動ロールバックはしない。
 */
export class SelfImprovementExperimentService {
  private static instance: SelfImprovementExperimentService;
  private readonly storageKey = 'miki_self_improvement_experiments_v1';
  private constructor() {}
  public static getInstance() {
    return this.instance || (this.instance = new SelfImprovementExperimentService());
  }

  public snapshot(): ImprovementExperimentSnapshot {
    const metrics = selfImprovementMetricsService.snapshot();
    let memoryCount = 0;
    try { memoryCount = storageService.getMemories().filter(m => m.active !== false).length; } catch { /* noop */ }
    const cases = this.safeCaseCount();
    return {
      metrics,
      memoryCount,
      stableCaseCount: cases.stable,
      openGapCount: metrics.openGaps,
      createdAt: Date.now(),
    };
  }

  public evaluate(action: string, before: ImprovementExperimentSnapshot, after: ImprovementExperimentSnapshot, outcome?: string): ImprovementExperimentResult {
    const failureImprovement = before.metrics.failureRate - after.metrics.failureRate;
    const gapImprovement = before.openGapCount - after.openGapCount;
    const reuseImprovement = after.metrics.reuseRate - before.metrics.reuseRate;
    const stableImprovement = after.stableCaseCount - before.stableCaseCount;
    let scoreDelta = Math.round(failureImprovement * 100 + gapImprovement * 8 + reuseImprovement * 40 + stableImprovement * 5);
    let verdict: ExperimentVerdict = 'HOLD';
    let reason = `測定差分が小さいため保留します。${outcome ? ` 実行結果=${outcome}` : ''}`;

    if (action === 'RESEARCH_GAP' && gapImprovement > 0) {
      verdict = 'ADOPT';
      reason = `Knowledge Gapが ${gapImprovement} 件減少したため、研究結果を採用します。`;
    } else if (action === 'PROMOTE_CASE' && after.memoryCount > before.memoryCount) {
      verdict = 'ADOPT';
      reason = `安定ケースから長期記憶候補が ${after.memoryCount - before.memoryCount} 件増えたため、昇格を採用します。`;
    } else if (action === 'OBSERVE_FAILURE' && failureImprovement > 0) {
      verdict = 'ADOPT';
      reason = `失敗率が ${(failureImprovement * 100).toFixed(1)}pt 改善したため、観測結果を採用します。`;
    } else if (action === 'IDLE') {
      verdict = 'HOLD';
      reason = '改善対象がないため変更を加えず待機します。';
    } else if (outcome === 'error') {
      verdict = 'REJECT';
      reason = '自己改善処理がエラー終了したため、このサイクルの変更を不採用として記録します。';
    }

    scoreDelta = Math.max(-100, Math.min(100, scoreDelta));
    const result: ImprovementExperimentResult = {
      experiment_id: `SIE-${this.hash(`${action}|${before.createdAt}|${after.createdAt}`)}`,
      action,
      before,
      after,
      verdict,
      scoreDelta,
      reason,
      createdAt: Date.now(),
    };
    this.save(result);
    systemLogger.info('SELF_IMPROVEMENT', `🧪 [Experiment] ${action} => ${verdict}: ${reason}`);
    return result;
  }

  public list(): ImprovementExperimentResult[] {
    try {
      const raw = storageService.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private safeCaseCount(): { stable: number } {
    try {
      const raw = storageService.getItem('miki_task_case_memory_v1');
      const records = raw ? JSON.parse(raw) : [];
      return { stable: Array.isArray(records) ? records.filter((r: any) => r?.outcome === 'SUCCESS' && r?.maturity === 'STABLE').length : 0 };
    } catch { return { stable: 0 }; }
  }

  private save(result: ImprovementExperimentResult) {
    try {
      const history = this.list();
      history.unshift(result);
      storageService.setItem(this.storageKey, JSON.stringify(history.slice(0, 200)));
    } catch { /* storage unavailable */ }
  }

  private hash(raw: string) {
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}
export const selfImprovementExperimentService = SelfImprovementExperimentService.getInstance();
