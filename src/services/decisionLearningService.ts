import { unifiedDecisionEngineService } from './unifiedDecisionEngineService';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { DecisionFailureCause, DecisionDelayCheckpoint, UnifiedDecisionRecord } from '../types';

export interface DecisionLearningSignal {
  cause: DecisionFailureCause;
  count: number;
  score: number;
  recommendedTarget: 'SEARCH' | 'EVALUATION_AXES' | 'COMPONENTS' | 'TESTS' | 'ENVIRONMENT' | 'PREFERENCES' | 'COMPOSITION';
  reason: string;
}

/** 8.4: 遅延評価を「失敗だった」で終わらせず、原因別に次の改善対象へ変換する観測層。安全規則そのものは変更しない。 */
export class DecisionLearningService {
  private static instance: DecisionLearningService;
  private readonly storageKey = 'miki_decision_learning_v1';
  private constructor() {}
  public static getInstance(): DecisionLearningService { return this.instance || (this.instance = new DecisionLearningService()); }

  public evaluateDecision(decisionId: string, checkpoint: DecisionDelayCheckpoint, outcome: 'SUCCESS'|'SUBOPTIMAL'|'FAILURE', feedback: string, cause?: DecisionFailureCause): boolean {
    return unifiedDecisionEngineService.evaluateDelayedOutcome({ decisionId, checkpoint, outcome, feedback, cause });
  }

  /** 実行系から判断結果を安全に接続する薄いアダプタ。未リンクIDは何も変更しない。 */
  public recordExecutionOutcome(params: { decisionId?: string; outcome: 'SUCCESS' | 'FAILURE'; feedback: string; cause?: DecisionFailureCause }): boolean {
    if (!params.decisionId) return false;
    return this.evaluateDecision(params.decisionId, 'NEXT_USE', params.outcome, params.feedback, params.cause);
  }

  public signals(): DecisionLearningSignal[] {
    const records = unifiedDecisionEngineService.getAllDecisions();
    const counts = new Map<DecisionFailureCause, number>();
    for (const record of records) {
      for (const evaluation of Object.values(record.evaluations || {})) {
        if (!evaluation || (evaluation.outcome !== 'FAILURE' && evaluation.outcome !== 'SUBOPTIMAL') || !evaluation.cause) continue;
        counts.set(evaluation.cause, (counts.get(evaluation.cause) || 0) + 1);
      }
    }
    const target: Record<DecisionFailureCause, DecisionLearningSignal['recommendedTarget']> = {
      DECISION_ERROR: 'EVALUATION_AXES', INFORMATION_GAP: 'SEARCH', ENVIRONMENT_DRIFT: 'ENVIRONMENT',
      PREFERENCE_CHANGE: 'PREFERENCES', IMPLEMENTATION_ERROR: 'COMPONENTS', COMPOSITION_ERROR: 'COMPOSITION', TEST_GAP: 'TESTS',
    };
    const reasons: Record<DecisionFailureCause, string> = {
      DECISION_ERROR: '評価軸・重み・候補比較の再点検が必要', INFORMATION_GAP: '不足証拠の収集経路を改善', ENVIRONMENT_DRIFT: '現在環境との差分を再検証',
      PREFERENCE_CHANGE: '作業プロファイルや最新明示指示を再確認', IMPLEMENTATION_ERROR: '部品・実装の失敗履歴を優先確認',
      COMPOSITION_ERROR: '能力間の接続・前提・依存関係を再評価', TEST_GAP: '失敗条件を回帰テストへ追加',
    };
    return Array.from(counts.entries()).map(([cause, count]) => ({ cause, count, score: Math.min(100, count * 25), recommendedTarget: target[cause], reason: reasons[cause] })).sort((a,b)=>b.score-a.score);
  }

  public snapshot(): { decision_count: number; evaluated_count: number; failure_signals: number; updated_at: number } {
    const records = unifiedDecisionEngineService.getAllDecisions();
    let evaluated = 0;
    for (const r of records) evaluated += Object.keys(r.evaluations || {}).length;
    const snapshot = { decision_count: records.length, evaluated_count: evaluated, failure_signals: this.signals().length, updated_at: Date.now() };
    try { storageService.setItem(this.storageKey, JSON.stringify(snapshot)); } catch {}
    return snapshot;
  }

  public explainImprovementPriority(): string {
    const top = this.signals()[0];
    if (!top) return '遅延評価から優先的に修正すべき判断弱点はまだ検出されていません。';
    const message = `判断学習優先: ${top.cause} (${top.count}件) → ${top.reason}`;
    systemLogger.info('SELF_IMPROVEMENT', `🧠 [8.4 判断後悔学習] ${message}`);
    return message;
  }
}
export const decisionLearningService = DecisionLearningService.getInstance();
