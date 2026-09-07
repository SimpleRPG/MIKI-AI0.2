import { uncertaintyTeacherService } from './uncertaintyTeacherService';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';

const CALIBRATION_DRIFT_LOG_KEY = 'miki_calibration_drift_audit_logs_v1';

export interface DomainCalibrationStats {
  domain: string;
  totalEvaluated: number;
  lowUncertaintyCount: number; // 自信あり（不確実性低、教師送信不要と判定）
  laterConfirmedIncorrectCount: number; // 事後に誤りと判明した件数
  overconfidenceRate: number; // 0.0 - 1.0 (過信率)
  currentThreshold: number; // 現在の不確実性しきい値
  thresholdAdjusted: boolean;
  newThreshold?: number;
  driftWarning: boolean;
}

export interface CalibrationDriftReport {
  lastAuditedAt: number;
  totalLogsAnalyzed: number;
  domainStats: Record<string, DomainCalibrationStats>;
  driftDetectedCount: number;
  auditNotes: string[];
}

class CalibrationDriftService {
  /**
   * 深い睡眠時または定期監査時にキャリブレーションドリフトを検証 (第27.4章)
   */
  public runDriftAudit(): CalibrationDriftReport {
    const history = uncertaintyTeacherService.getHistory();
    const recentItems = history.slice(-50); // 直近50件

    const domainGroups: Record<string, typeof recentItems> = {};

    for (const item of recentItems) {
      const domain = item.domain || 'general';
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(item);
    }

    const domainStats: Record<string, DomainCalibrationStats> = {};
    let driftDetectedCount = 0;
    const auditNotes: string[] = [];

    for (const [domain, items] of Object.entries(domainGroups)) {
      const totalEvaluated = items.length;
      // 不確実性「低」（教師送信不要）と判定された件数
      const lowUncertaintyItems = items.filter((it) => !it.shouldSendToTeacher);
      const lowUncertaintyCount = lowUncertaintyItems.length;

      // その中で事後に誤りと判明した件数
      const incorrectCount = lowUncertaintyItems.filter((it) => it.laterConfirmedIncorrect === true).length;

      // 過信率 = (自信あり中の誤り数) / (自信あり総数)
      const overconfidenceRate = lowUncertaintyCount > 0 ? incorrectCount / lowUncertaintyCount : 0;

      const currentThreshold = uncertaintyTeacherService.getThresholdForDomain(domain);
      let thresholdAdjusted = false;
      let newThreshold = currentThreshold;

      // 閾値: 過信率が15% (0.15) を超えた場合
      const driftWarning = overconfidenceRate >= 0.15 && totalEvaluated >= 3;

      if (driftWarning) {
        driftDetectedCount++;
        // しきい値を厳しめ（教師起動が発生しやすいように低いスコアでも送信するように下げる）
        // 自動調整幅は既定±10%（約4〜5ポイント）を上限とする
        const adjustmentDelta = 4;
        newThreshold = Math.max(25, currentThreshold - adjustmentDelta);

        if (newThreshold !== currentThreshold) {
          uncertaintyTeacherService.setThresholdForDomain(domain, newThreshold);
          thresholdAdjusted = true;
          const note = `[第27.4章 キャリブレーションドリフト] ドメイン「${domain}」で過信率 ${(overconfidenceRate * 100).toFixed(
            1
          )}% (誤り ${incorrectCount}/${lowUncertaintyCount}件) を検知。不確実性しきい値を ${currentThreshold}点 から ${newThreshold}点 へ自律強化しました。`;
          auditNotes.push(note);
          systemLogger.warn('SELF_IMPROVEMENT', note);
        }
      } else {
        auditNotes.push(
          `[第27.4章 キャリブレーション監査] ドメイン「${domain}」は正常範囲内です (過信率: ${(overconfidenceRate * 100).toFixed(
            1
          )}%, しきい値: ${currentThreshold}点)`
        );
      }

      domainStats[domain] = {
        domain,
        totalEvaluated,
        lowUncertaintyCount,
        laterConfirmedIncorrectCount: incorrectCount,
        overconfidenceRate,
        currentThreshold,
        thresholdAdjusted,
        newThreshold,
        driftWarning,
      };
    }

    const report: CalibrationDriftReport = {
      lastAuditedAt: Date.now(),
      totalLogsAnalyzed: recentItems.length,
      domainStats,
      driftDetectedCount,
      auditNotes,
    };

    this.saveAuditReport(report);
    return report;
  }

  private saveAuditReport(report: CalibrationDriftReport): void {
    try {
      storageService.setItem(CALIBRATION_DRIFT_LOG_KEY, JSON.stringify(report));
    } catch (e) {
      console.warn('Failed to save calibration drift report:', e);
    }
  }

  public getLatestReport(): CalibrationDriftReport | null {
    try {
      const data = storageService.getItem(CALIBRATION_DRIFT_LOG_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }
}

export const calibrationDriftService = new CalibrationDriftService();
