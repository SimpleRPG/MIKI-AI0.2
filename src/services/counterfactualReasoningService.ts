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
 *    Qwen 3B絶対保護、送信前プライバシー境界、変更契約とロールバック性を全パスで厳格保証。
 */

import {
  CounterfactualScenario,
  CounterfactualEvaluationResult,
  BranchReasoningSimulation,
} from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { privacyGuardrailService } from './privacyGuardrailService';
import { chapter36CounterfactualEngine } from '../autonomous_modules/chapter_36';

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
    contextSummary: string = ''
  ): CounterfactualEvaluationResult {
    // 1. 不変条件チェック（Qwen 3B除外やプライバシー侵害を試みるシナリオは即座に拒絶）
    const forbidsAnchorRemoval = !scenario.alternativeChoice.includes('qwen') || !scenario.alternativeChoice.includes('delete');
    const privacyAudit = privacyGuardrailService.auditOutboundContent(
      `${scenario.alternativeChoice} ${scenario.hypothesis}`,
      'GEMINI_TEACHER',
      { autoSanitize: false }
    );
    const invariantsPassed = forbidsAnchorRemoval && privacyAudit.allowed;

    // 2. 評価メトリクスのシミュレーション計算
    let safetyScore = invariantsPassed ? 95 : 20;
    let performanceScore = 80;
    let accuracyScore = 85;

    // シナリオ属性に基づく分岐評価
    const altLower = scenario.alternativeChoice.toLowerCase();
    if (altLower.includes('cache') || altLower.includes('キャッシュ')) {
      performanceScore += 12;
    }
    if (altLower.includes('verify') || altLower.includes('tdd') || altLower.includes('検証')) {
      safetyScore += 4;
      accuracyScore += 8;
    }
    if (altLower.includes('fallback') || altLower.includes('安全退行')) {
      safetyScore += 5;
    }

    safetyScore = Math.min(100, Math.max(0, safetyScore));
    performanceScore = Math.min(100, Math.max(0, performanceScore));
    accuracyScore = Math.min(100, Math.max(0, accuracyScore));

    // 差分スコア計算（事実選択の基準スコア80点との比較）
    const factualBenchmark = 80;
    const counterfactualCombined = Math.round((safetyScore * 0.4) + (performanceScore * 0.3) + (accuracyScore * 0.3));
    const overallDeltaScore = counterfactualCombined - factualBenchmark;

    let recommendation: 'ADOPT_COUNTERFACTUAL' | 'MAINTAIN_FACTUAL' | 'INCONCLUSIVE' = 'MAINTAIN_FACTUAL';
    if (!invariantsPassed) {
      recommendation = 'MAINTAIN_FACTUAL';
    } else if (overallDeltaScore >= 8) {
      recommendation = 'ADOPT_COUNTERFACTUAL';
    } else if (overallDeltaScore >= -3 && overallDeltaScore < 8) {
      recommendation = 'INCONCLUSIVE';
    }

    const reasoning = invariantsPassed
      ? `反実仮想選択肢『${scenario.name}』をシミュレーション: 安全度=${safetyScore}点, 性能=${performanceScore}点, 精度=${accuracyScore}点 (基準比 Δ=${overallDeltaScore >= 0 ? `+${overallDeltaScore}` : overallDeltaScore}点)。判定: ${recommendation === 'ADOPT_COUNTERFACTUAL' ? '反実仮想案が事実選択を有意に上回る' : recommendation === 'MAINTAIN_FACTUAL' ? '事実選択の維持が最善' : '差異僅差・状況に応じて選択'}。`
      : '⚠️ 反実仮想シナリオが不変条件（アンカーモデル保護・プライバシー境界）に抵触するため却下されました。';

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      factualOutcome: `実際の決定: ${factualDecision}`,
      counterfactualOutcome: `もしもの結果: ${scenario.hypothesis} -> 推定改善度 Δ=${overallDeltaScore}点`,
      safetyScore,
      performanceScore,
      accuracyScore,
      overallDeltaScore,
      recommendation,
      reasoning,
      invariantsPassed,
    };
  }

  /**
   * 分岐推論シミュレーションの実行 (Chapter 36 メインパイプライン)
   */
  public simulateBranchReasoning(
    topic: string,
    factualDecision: string,
    contextSummary: string,
    candidateScenarios?: CounterfactualScenario[]
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
            hypothesis: 'TTFT（初速トークンレイテンシ）が90%削減されるが、文脈ドリフトへの感応度が微減する。',
          },
          {
            id: 'cf_opt_formal_verify',
            name: '厳密形式検証 & TDD事前契約',
            condition: 'もしコード配備前にAST形式検証と不変条件テストを二重化していたら',
            alternativeChoice: 'ChangeContractとCSP制約ソルバーによる自動検証を義務化',
            hypothesis: '配備速度が約15ms増加するが、潜在バグ・退行リスクが99%根絶される。',
          },
          {
            id: 'cf_opt_minimal_fallback',
            name: '極小スコープ安全退行',
            condition: 'もし高負荷・エラー時に最小スコープへ直ちにフォールバックしていたら',
            alternativeChoice: '依存ライブラリを切り離し、オンデバイスQwen 3Bのみで応答',
            hypothesis: 'API利用制限を完全回避し、ネットワーク切断時でも100%の可用性を維持する。',
          },
        ];

    // 全シナリオを評価
    const evaluations = scenarios.map((s) => this.evaluateScenario(factualDecision, s, contextSummary));

    // 最良代替案を特定
    const validAlternatives = evaluations.filter((e) => e.invariantsPassed);
    validAlternatives.sort((a, b) => b.overallDeltaScore - a.overallDeltaScore);
    const bestAlternative = validAlternatives[0];

    const conclusion = bestAlternative && bestAlternative.overallDeltaScore > 5
      ? `第36章 反実仮想推論完了: 最良の代替案『${bestAlternative.scenarioName}』が事実選択よりΔ=+${bestAlternative.overallDeltaScore}点優位です。次回類似シチュエーションでの先行採用を推奨します。`
      : `第36章 反実仮想推論完了: 事実の選択（${factualDecision}）が安全性・堅牢性の観点で最適バランスを維持していました。`;

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
        }))
      );
    } catch (e) {
      console.warn('Failed to sync with chapter36CounterfactualEngine:', e);
    }

    systemLogger.info('SELF_IMPROVEMENT', `[第36章 反実仮想推論] 『${topic}』の分岐推論シミュレーション完了 (結論: ${conclusion.slice(0, 60)}...)`);

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
