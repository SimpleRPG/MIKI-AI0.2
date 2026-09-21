/**
 * 設計思想 第38章: メタ認知モニタリング・自己確信度較正
 * (Metacognitive Monitoring & Confidence Calibration Service)
 *
 * 【主要要件】
 * 1. 確信度スコアリング (Confidence Scoring):
 *    回答や推論・提案コードに対する自己確信度を事実根拠・構文健全性・制約充足度・ドメイン熟練度から多面的に算出。
 * 2. 過信防止キャリブレーション (Overconfidence Prevention Calibration):
 *    客観的根拠の薄い「過信」「ハルシネーション」を抑制するため、キャリブレーションペナルティを課し、慎重なヘッジや検証要請を動的挿入。
 * 3. 不変条件保護:
 *    モデル重み不変性、送信前プライバシー境界、変更契約とロールバック性を全パスで厳格保証。
 */

import { MetacognitiveCalibrationResult } from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { privacyGuardrailService } from './privacyGuardrailService';
import { chapter38MetacognitiveEngine } from '../autonomous_modules/chapter_38';

const CALIBRATION_LOG_KEY = 'miki_metacognitive_calibrations_v1';

export class MetacognitiveCalibrationService {
  private history: MetacognitiveCalibrationResult[] = [];

  constructor() {
    this.loadHistory();
  }

  private loadHistory(): void {
    try {
      const raw = storageService.getItem(CALIBRATION_LOG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.history = parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load metacognitive calibration history:', e);
    }
  }

  private saveHistory(): void {
    try {
      storageService.setItem(CALIBRATION_LOG_KEY, JSON.stringify(this.history.slice(-50)));
    } catch (e) {
      console.warn('Failed to save metacognitive calibration history:', e);
    }
  }

  /**
   * 確信度スコアリング & 過信防止キャリブレーション実行 (Chapter 38 メインパイプライン)
   */
  public calibrateConfidence(
    topic: string,
    claimOrCode: string,
    context: { domain?: string; hasTestRun?: boolean; hasMemoryGrounding?: boolean } = {}
  ): MetacognitiveCalibrationResult {
    // プライバシー検証
    privacyGuardrailService.auditOutboundContent(claimOrCode, 'GEMINI_TEACHER', { autoSanitize: true });

    const text = claimOrCode.toLowerCase();

    // 1. 各要素スコアの算定 (0 - 100)
    let factualGroundingScore = context.hasMemoryGrounding ? 90 : 75;
    let syntaxValidityScore = 85;
    let constraintSatisfactionScore = 90;
    let domainFamiliarityScore = 80;

    // ドメイン別熟練度
    const domain = context.domain || (text.includes('vba') ? 'vba' : text.includes('react') ? 'frontend' : 'general');
    if (domain === 'vba') {
      domainFamiliarityScore = 95;
    } else if (domain === 'frontend' || domain === 'typescript') {
      domainFamiliarityScore = 90;
    }

    // 構文・テスト検証の有無
    if (context.hasTestRun) {
      syntaxValidityScore = 98;
      constraintSatisfactionScore = 95;
    } else if (text.includes('function') || text.includes('sub ') || text.includes('class ')) {
      // コードを含むが実機テスト未実行の場合は過信を警戒
      syntaxValidityScore = 82;
    }

    // 根拠の薄い断定表現（「絶対に」「100%」「確実に動く」など）に対する過信ペナルティ
    const humilityNotes: string[] = [];
    let overconfidencePenalty = 0;
    if (text.includes('絶対') || text.includes('確実') || text.includes('完璧') || text.includes('100%')) {
      overconfidencePenalty += 15;
      humilityNotes.push('断定的な表現（絶対/確実）を検知したため、過信防止キャリブレーションペナルティを適用しました。');
    }

    if (!context.hasTestRun && (text.includes('コード') || text.includes('実装') || text.includes('マクロ'))) {
      overconfidencePenalty += 8;
      humilityNotes.push('未テストのコード推論であるため、慎重な検証前提のヘッジ（注記）を推奨します。');
    }

    // 生確信度 (Raw Confidence)
    const rawConfidence = Math.round(
      factualGroundingScore * 0.3 +
      syntaxValidityScore * 0.25 +
      constraintSatisfactionScore * 0.25 +
      domainFamiliarityScore * 0.2
    );

    // キャリブレーション後確信度 (Calibrated Confidence)
    const calibratedConfidence = Math.max(10, Math.min(100, rawConfidence - overconfidencePenalty));

    // 過信リスク判定
    let overconfidenceRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let calibrationAction: 'PROCEED' | 'ATTACH_HEDGE' | 'REQUEST_VERIFICATION' | 'FALLBACK_TO_SAFE' = 'PROCEED';

    if (overconfidencePenalty >= 15 || (rawConfidence > 85 && calibratedConfidence < 75)) {
      overconfidenceRisk = 'HIGH';
      calibrationAction = 'REQUEST_VERIFICATION';
      humilityNotes.push('過信リスクが高いため、ユーザーへの前提条件確認またはTDD実機検証を要請します。');
    } else if (overconfidencePenalty > 5 || calibratedConfidence < 80) {
      overconfidenceRisk = 'MEDIUM';
      calibrationAction = 'ATTACH_HEDGE';
      humilityNotes.push('適度なヘッジ（「〜の環境を前提としています」等）を付与して回答精度を担保します。');
    }

    const result: MetacognitiveCalibrationResult = {
      id: `calib_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      topic,
      rawConfidence,
      calibratedConfidence,
      overconfidenceRisk,
      calibrationAction,
      calibrationPenalty: overconfidencePenalty,
      factors: {
        factualGroundingScore,
        syntaxValidityScore,
        constraintSatisfactionScore,
        domainFamiliarityScore,
      },
      humilityNotes,
    };

    this.history.unshift(result);
    this.saveHistory();

    // 自律モジュール (chapter_38.ts) との決定論的同期
    try {
      chapter38MetacognitiveEngine.calibrate(claimOrCode, context.hasTestRun ?? false);
    } catch (e) {
      console.warn('Failed to sync with chapter38MetacognitiveEngine:', e);
    }

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `[第38章 メタ認知] 『${topic.slice(0, 25)}』 生確信度: ${rawConfidence}% ➔ 較正後: ${calibratedConfidence}% (リスク: ${overconfidenceRisk}, アクション: ${calibrationAction})`
    );

    return result;
  }

  public getCalibrationHistory(): MetacognitiveCalibrationResult[] {
    return [...this.history];
  }
}

export const metacognitiveCalibrationService = new MetacognitiveCalibrationService();
