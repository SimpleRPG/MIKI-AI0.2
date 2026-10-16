/**
 * 設計思想 第36章: 反実仮想推論・もしものシミュレーション
 * (Counterfactual Reasoning & What-If Simulation Engine)
 *
 * 【主要要件】
 * 1. 反実仮想シナリオ評価 (Counterfactual Scenario Evaluation):
 *    過去の会話やコード決定における「もし別の選択をしていたら」の反実仮想検証。
 * 2. 分岐推論シミュレーション (Branch Reasoning Simulation):
 *    並行世界・代替パスのシミュレーションを実行し、安全性・品質・リソース消費の差分を定量算出。
 * 3. 不変条件の保護 (Invariant Protection):
 *    モデル重み不変性、送信前プライバシー境界、変更契約とロールバック性を全パスで厳格保証。
 */

import {
  CounterfactualScenario,
  CounterfactualEvaluationResult,
  BranchReasoningSimulation,
} from '../../../types';
import {
  aggregateCounterfactualMeasurementStatus,
  type CounterfactualMeasurementEvidence,
} from './counterfactualEvaluationPolicy';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { privacyGuardrailService } from '../../safety/services/privacyGuardrailService';
import { chapter36CounterfactualEngine } from '../../../autonomous_modules/chapter_36';

const SIMULATION_HISTORY_KEY = 'miki_counterfactual_simulations_v1';

export class CounterfactualReasoningService {
  private simulations: BranchReasoningSimulation[] = [];

  constructor() {
    this.loadHistory();
  }

  private loadHistory(): void {
    try {
      const raw = storageService.getItem(SIMULATION_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.simulations = parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load counterfactual simulation history:', e);
      this.simulations = [];
    }
  }

  private saveHistory(): void {
    try {
      storageService.setItem(SIMULATION_HISTORY_KEY, JSON.stringify(this.simulations.slice(-50)));
    } catch (e) {
      console.warn('Failed to save counterfactual simulation history:', e);
    }
  }

  /**
   * 単一の反実仮想シナリオを評価
   */
  public evaluateScenario(
    factualDecision: string,
    scenario: CounterfactualScenario,
    contextSummary: string = '',
    measurementEvidence?: CounterfactualMeasurementEvidence
  ): CounterfactualEvaluationResult {
    void contextSummary;
    return chapter36CounterfactualEngine.evaluate(
      factualDecision,
      scenario,
      measurementEvidence
    );
  }

  /**
   * 分岐推論シミュレーションの実行 (Chapter 36 メインパイプライン)
   */
  public simulateBranchReasoning(
    topic: string,
    factualDecision: string,
    contextSummary: string,
    candidateScenarios?: CounterfactualScenario[],
    measurementEvidenceByScenario?: Record<string, CounterfactualMeasurementEvidence>
  ): BranchReasoningSimulation {
    const simulationId = `sim_cf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // デフォルトの反実仮想シナリオ群（明示指定がない場合）
    const scenarios: CounterfactualScenario[] = candidateScenarios && candidateScenarios.length > 0
      ? candidateScenarios
      : [
          {
            id: 'cf_opt_aggressive_cache',
            name: '積極キャッシュ & 事前推論バイパス',
            condition: 'もし過去の同一文脈応答を積極キャッシュしていたら',
            alternativeChoice: 'LRUインメモリキャッシュを活用し重複推論を完全スキップ',
            hypothesis: 'キャッシュによる応答遅延と文脈ドリフトへの影響を検証する必要がある。具体的な効果は未測定。',
          },
          {
            id: 'cf_opt_formal_verify',
            name: '厳密形式検証 & TDD事前契約',
            condition: 'もしコード配備前にAST形式検証と不変条件テストを二重化していたら',
            alternativeChoice: 'ChangeContractとCSP制約ソルバーによる自動検証を義務化',
            hypothesis: '形式検証とTDDが不具合・退行へ与える影響を検証する必要がある。具体的な効果は未測定。',
          },
          {
            id: 'cf_opt_minimal_fallback',
            name: '極小スコープ安全退行',
            condition: 'もし高負荷・エラー時に最小スコープへ直ちにフォールバックしていたら',
            alternativeChoice: '外部依存を切り離し、ネットワーク断時は確実に動作可能な機能だけを残して能力制限を明示',
            hypothesis: 'フォールバック時の可用性と依存関係の影響を検証する必要がある。具体的な効果は未測定。',
          },
        ];

    // 全シナリオを評価
    const evaluations = scenarios.map((s) => this.evaluateScenario(factualDecision, s, contextSummary, measurementEvidenceByScenario?.[s.id]));

    // 実測済みで、独立評価により採用判定された候補だけを推薦対象にする。
    const validAlternatives = evaluations.filter(
      (e) => e.measurementStatus === 'MEASURED' &&
        e.recommendation === 'ADOPT_COUNTERFACTUAL' &&
        e.invariantsPassed
    );
    validAlternatives.sort((a, b) => b.overallDeltaScore - a.overallDeltaScore);
    const bestAlternative = validAlternatives[0];

    const conclusion = bestAlternative
      ? `第36章 反実仮想推論: 独立評価済みの代替案『${bestAlternative.scenarioName}』が採用候補です。`
      : `第36章 反実仮想推論: 代替案の実行・独立評価が未実施のため採用推奨を行いません。事実選択（${factualDecision}）を維持し、測定待ちとします。`;
    const simulationRecord: BranchReasoningSimulation = {
      id: simulationId,
      timestamp: Date.now(),
      topic,
      contextSummary,
      factualDecision,
      scenarios,
      evaluations,
      bestAlternative,
      conclusion,
      measurementStatus: aggregateCounterfactualMeasurementStatus(evaluations),
    };

    this.simulations.unshift(simulationRecord);
    this.saveHistory();

    // 自律モジュール (chapter_36.ts) との決定論的同期
    try {
      chapter36CounterfactualEngine.runSimulation(
        topic,
        factualDecision,
        scenarios.map((s) => ({
          id: s.id,
          name: s.name,
          condition: s.condition,
          alternativeChoice: s.alternativeChoice,
          hypothesis: s.hypothesis,
        })),
        measurementEvidenceByScenario
      );
    } catch (e) {
      console.warn('Failed to sync with chapter36CounterfactualEngine:', e);
    }

    systemLogger.info('SELF_IMPROVEMENT', `[第36章 反実仮想推論] 『${topic}』の仮説評価を記録 (measurementStatus=${simulationRecord.measurementStatus}; 結論: ${conclusion.slice(0, 60)}...)`);

    return simulationRecord;
  }

  public getSimulationHistory(): BranchReasoningSimulation[] {
    return [...this.simulations];
  }

  public clearHistory(): void {
    this.simulations = [];
    this.saveHistory();
  }
}

export const counterfactualReasoningService = new CounterfactualReasoningService();
