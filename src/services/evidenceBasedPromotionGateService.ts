/**
 * 設計思想 7.4「知識の成熟度」/ 9.3「状態遷移」
 * エビデンス駆動・汎用昇格ゲートサービス (Evidence-Based Promotion Gate Service)
 *
 * LLM比較への依存を完全に排除し、部品および能力プロファイルが
 * 「実測件数・意味一致率(精度)・決定性・ユーザー訂正率」の4大客観的基準を満たしているか
 * 機械的かつ厳密に判定・検証する。
 *
 * 昇格基準（固定値）:
 * 1. 実測件数 (recordCount): 10件以上
 * 2. 意味一致率 / 精度 (accuracyScore): 98.0%以上
 * 3. 決定性 (determinismRate): 99.0%以上
 * 4. ユーザー訂正率 (userCorrectionRate): 2.0%以下
 */

import { systemLogger } from './systemLogger';

export interface PromotionEvidenceInput {
  recordCount: number;
  accuracyScore: number;      // 意味一致率 / 精度スコア (0-100)
  determinismRate: number;    // 決定性比率 (0-100)
  userCorrectionRate: number; // ユーザー訂正率 (0-100)
}

export interface PromotionGateRequirement {
  name: string;
  field: keyof PromotionEvidenceInput;
  value: number;
  threshold: number;
  operator: '>=' | '<=';
  passed: boolean;
  message: string;
}

export interface PromotionEvaluationResult {
  ready: boolean;
  missingRequirements: string[];
  requirements: PromotionGateRequirement[];
  evaluatedAt: number;
  summary: string;
}

export const PROMOTION_GATE_CRITERIA = {
  MIN_RECORD_COUNT: 10,
  MIN_ACCURACY_SCORE: 98.0,
  MIN_DETERMINISM_RATE: 99.0,
  MAX_USER_CORRECTION_RATE: 2.0,
} as const;

export class EvidenceBasedPromotionGateService {
  private static instance: EvidenceBasedPromotionGateService;

  private constructor() {}

  public static getInstance(): EvidenceBasedPromotionGateService {
    if (!EvidenceBasedPromotionGateService.instance) {
      EvidenceBasedPromotionGateService.instance = new EvidenceBasedPromotionGateService();
    }
    return EvidenceBasedPromotionGateService.instance;
  }

  /**
   * 7.4 & 9.3 昇格準備状態の評価 (LLM非依存の純粋評価関数)
   * 実測件数10件以上、意味一致率98%以上、決定性99%以上、ユーザー訂正率2%以下の4条件を判定
   */
  public evaluatePromotionReadiness(evidence: PromotionEvidenceInput): PromotionEvaluationResult {
    const recordCount = Number.isFinite(evidence.recordCount) ? Math.max(0, evidence.recordCount) : 0;
    const accuracyScore = Number.isFinite(evidence.accuracyScore) ? Math.max(0, Math.min(100, evidence.accuracyScore)) : 0;
    const determinismRate = Number.isFinite(evidence.determinismRate) ? Math.max(0, Math.min(100, evidence.determinismRate)) : 0;
    const userCorrectionRate = Number.isFinite(evidence.userCorrectionRate) ? Math.max(0, Math.min(100, evidence.userCorrectionRate)) : 0;

    const requirements: PromotionGateRequirement[] = [
      {
        name: '実測件数 (Record Count)',
        field: 'recordCount',
        value: recordCount,
        threshold: PROMOTION_GATE_CRITERIA.MIN_RECORD_COUNT,
        operator: '>=',
        passed: recordCount >= PROMOTION_GATE_CRITERIA.MIN_RECORD_COUNT,
        message: `実測件数が不足しています: ${recordCount}件 (基準: ${PROMOTION_GATE_CRITERIA.MIN_RECORD_COUNT}件以上)`,
      },
      {
        name: '意味一致率 (Accuracy Score)',
        field: 'accuracyScore',
        value: accuracyScore,
        threshold: PROMOTION_GATE_CRITERIA.MIN_ACCURACY_SCORE,
        operator: '>=',
        passed: accuracyScore >= PROMOTION_GATE_CRITERIA.MIN_ACCURACY_SCORE,
        message: `意味一致率(精度)が基準値未満です: ${accuracyScore.toFixed(1)}% (基準: ${PROMOTION_GATE_CRITERIA.MIN_ACCURACY_SCORE}%以上)`,
      },
      {
        name: '決定性 (Determinism Rate)',
        field: 'determinismRate',
        value: determinismRate,
        threshold: PROMOTION_GATE_CRITERIA.MIN_DETERMINISM_RATE,
        operator: '>=',
        passed: determinismRate >= PROMOTION_GATE_CRITERIA.MIN_DETERMINISM_RATE,
        message: `決定性比率が基準値未満です: ${determinismRate.toFixed(1)}% (基準: ${PROMOTION_GATE_CRITERIA.MIN_DETERMINISM_RATE}%以上)`,
      },
      {
        name: 'ユーザー訂正率 (User Correction Rate)',
        field: 'userCorrectionRate',
        value: userCorrectionRate,
        threshold: PROMOTION_GATE_CRITERIA.MAX_USER_CORRECTION_RATE,
        operator: '<=',
        passed: userCorrectionRate <= PROMOTION_GATE_CRITERIA.MAX_USER_CORRECTION_RATE,
        message: `ユーザー訂正率が許容上限を超過しています: ${userCorrectionRate.toFixed(1)}% (基準: ${PROMOTION_GATE_CRITERIA.MAX_USER_CORRECTION_RATE}%以下)`,
      },
    ];

    const missingRequirements = requirements.filter((r) => !r.passed).map((r) => r.message);
    const ready = missingRequirements.length === 0;

    const summary = ready
      ? `昇格ゲート合格: 全4条件充足 (件数=${recordCount}件, 意味一致率=${accuracyScore.toFixed(1)}%, 決定性=${determinismRate.toFixed(1)}%, 訂正率=${userCorrectionRate.toFixed(1)}%)`
      : `昇格ゲート不合格: 未充足条件あり [${missingRequirements.join('; ')}]`;

    if (ready) {
      systemLogger.info('TOOLS', `✅ [PromotionGate PASS] ${summary}`);
    } else {
      systemLogger.warn('TOOLS', `🚫 [PromotionGate REJECT] ${summary}`);
    }

    return {
      ready,
      missingRequirements,
      requirements,
      evaluatedAt: Date.now(),
      summary,
    };
  }

  /**
   * 能力ギャップ(32章/21章)のマスタリー昇格(STABLE -> SATURATED)用評価
   */
  public evaluateMasteryPromotion(evidence: {
    successCount: number;
    failureCount: number;
    accuracyScore?: number;
    determinismRate?: number;
  }): PromotionEvaluationResult {
    const total = evidence.successCount + evidence.failureCount;
    const accuracy = evidence.accuracyScore ?? (total > 0 ? (evidence.successCount / total) * 100 : 0);
    const determinism = evidence.determinismRate ?? 100;
    const correctionRate = total > 0 ? (evidence.failureCount / total) * 100 : 0;

    return this.evaluatePromotionReadiness({
      recordCount: total,
      accuracyScore: accuracy,
      determinismRate: determinism,
      userCorrectionRate: correctionRate,
    });
  }
}

export const evidenceBasedPromotionGateService = EvidenceBasedPromotionGateService.getInstance();
