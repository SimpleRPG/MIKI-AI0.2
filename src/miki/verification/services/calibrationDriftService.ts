import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { uncertaintyTeacherService } from '../../learning/services/uncertaintyTeacherService';

const CALIBRATION_DRIFT_LOG_KEY = 'miki_calibration_drift_audit_logs_v1';

export interface CalibrationDriftReport {
  lastAuditedAt: number;
  totalLogsAnalyzed: number;
  domainStats: Record<string, unknown>;
  driftDetectedCount: number;
  auditNotes: string[];
}

export class CalibrationDriftService {
  /**
   * 深い睡眠時または定期監査時にキャリブレーションドリフトを検証 (第27.4章)
   */
  public runDriftAudit(): CalibrationDriftReport {
    const history = uncertaintyTeacherService.getHistory();
    const recentItems = history.slice(-50);
    const domainGroups: Record<string, any[]> = {};

    for (const item of recentItems) {
      const domain = item.domain || 'general';
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(item);
    }

    const domainStats: Record<string, any> = {};
    let driftDetectedCount = 0;
    const auditNotes: string[] = [];

    for (const [domain, items] of Object.entries(domainGroups)) {
      const totalEvaluated = items.length;
      const lowUncertaintyItems = items.filter((it: any) => !it.shouldSendToTeacher);
      const lowUncertaintyCount = lowUncertaintyItems.length;
      const incorrectCount = lowUncertaintyItems.filter((it: any) => it.laterConfirmedIncorrect === true).length;
      const overconfidenceRate = lowUncertaintyCount > 0 ? incorrectCount / lowUncertaintyCount : 0;
      const currentThreshold = uncertaintyTeacherService.getThresholdForDomain(domain);
      let thresholdAdjusted = false;
      let newThreshold = currentThreshold;

      const driftWarning = overconfidenceRate >= 0.15 && totalEvaluated >= 3;
      if (driftWarning) {
        driftDetectedCount++;
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

  public saveAuditReport(report: CalibrationDriftReport): void {
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
