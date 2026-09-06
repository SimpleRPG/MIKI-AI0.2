import { ContextTier, ContextBudgetPlan, UnifiedDiagnosticLog } from '../types';
import { systemLogger } from './systemLogger';

export type ThermalState = 'normal' | 'warm' | 'hot' | 'critical';

export interface DeviceHealthState {
  thermalState: ThermalState;
  batteryLevel: number;      // 0.0〜1.0
  isCharging: boolean;
  lowPowerMode: boolean;
}

/**
 * 設計思想 Master v5.0 第4章: コンテキスト長自動調整エンジン (Context Budget Engine)
 * 
 * 3層防御モデル:
 * - A層: ロード時 nCtx ティア選定 (4096 / 8192 / 16384 / 32768)
 * - B層: ターン単位の動的予算配分 (①統合記憶 ➔ ②熱い体験 ➔ ③想起記憶 ➔ ④会話履歴)
 * - C層: 端末状態 (温度・バッテリー) によるセーフティ縮退
 * 
 * および第3章5節: 統合診断ログ (説明可能性) の生成と追跡
 */
class ContextBudgetEngineService {
  private currentTier: ContextTier = 4096;
  private diagnosticLogs: UnifiedDiagnosticLog[] = [];
  private healthState: DeviceHealthState = {
    thermalState: 'normal',
    batteryLevel: 1.0,
    isCharging: true,
    lowPowerMode: false,
  };

  constructor() {
    this.initDeviceMonitoring();
  }

  /**
   * バッテリーAPIおよびサーマル状態の安全な非同期監視
   */
  private async initDeviceMonitoring(): Promise<void> {
    if (typeof navigator !== 'undefined' && (navigator as any).getBattery) {
      try {
        const battery = await (navigator as any).getBattery();
        const updateBattery = () => {
          this.healthState.batteryLevel = battery.level;
          this.healthState.isCharging = battery.charging;
          this.healthState.lowPowerMode = !battery.charging && battery.level <= 0.2;
        };
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
      } catch (e) {
        // Battery API is optional
      }
    }
  }

  public getHealthState(): DeviceHealthState {
    return { ...this.healthState };
  }

  public setThermalState(state: ThermalState): void {
    this.healthState.thermalState = state;
    systemLogger.info('INFERENCE', `ContextBudgetEngine: thermalState updated to ${state}`);
  }

  /**
   * A層: ロード時 nCtx ティア選定 (4096 / 8192 / 16384 / 32768)
   */
  public selectInitialTier(deviceRamGB: number, vramMB: number, modelParamB: number): ContextTier {
    if (deviceRamGB >= 12 && vramMB >= 6000 && modelParamB <= 3) {
      this.currentTier = 32768;
    } else if (deviceRamGB >= 8 && vramMB >= 4000) {
      this.currentTier = 16384;
    } else if (deviceRamGB >= 6 || vramMB >= 2500) {
      this.currentTier = 8192;
    } else {
      this.currentTier = 4096;
    }
    return this.currentTier;
  }

  public getCurrentTier(): ContextTier {
    return this.currentTier;
  }

  public setCurrentTier(tier: ContextTier): void {
    this.currentTier = tier;
  }

  /**
   * B層 & C層: ターン単位の予算配分計画を計算
   * live_budget = nCtx - maxTokens(512) - 安全マージン
   */
  public calculateBudgetPlan(
    nCtxOverride?: number,
    isComplexTask: boolean = false
  ): ContextBudgetPlan {
    const baseCtx = nCtxOverride || this.currentTier;
    const maxGenerationTokens = 512;
    const safetyMarginTokens = 256;

    // C層: 端末状態によるセーフティ縮退
    let thermalReductionRatio = 1.0;
    let batteryReducedDepth = 3; // 通常リンク展開深さ

    if (this.healthState.thermalState === 'critical') {
      thermalReductionRatio = 0.5; // 50%に強制縮退
      batteryReducedDepth = 1;
    } else if (this.healthState.thermalState === 'hot') {
      thermalReductionRatio = 0.7; // 70%に縮退
      batteryReducedDepth = 2;
    }

    if (this.healthState.lowPowerMode || (this.healthState.batteryLevel < 0.15 && !this.healthState.isCharging)) {
      batteryReducedDepth = 1;
      thermalReductionRatio = Math.min(thermalReductionRatio, 0.75);
    }

    // 実効利用可能予算
    const rawBudget = Math.max(1024, baseCtx - maxGenerationTokens - safetyMarginTokens);
    const liveBudget = Math.floor(rawBudget * thermalReductionRatio);

    // 配分優先度:
    // ① 統合記憶 (Semantic Core / ペルソナ)
    // ② 熱い体験 (Episodic Buffer)
    // ③ 想起記憶 (RAG)
    // ④ 会話履歴 (History)
    const personaQuota = Math.floor(liveBudget * 0.25);
    const episodicBufferQuota = Math.floor(liveBudget * 0.15);
    const memoryRecallQuota = Math.floor(liveBudget * 0.25);
    const historyQuota = liveBudget - personaQuota - episodicBufferQuota - memoryRecallQuota;

    // 雑談時は最大8往復、重厚タスク時は4往復まで安全に縮小 (第4章1節)
    const recentTurnsToKeep = isComplexTask || thermalReductionRatio < 0.8 ? 4 : 8;

    return {
      tier: this.currentTier,
      liveBudget,
      personaQuota,
      episodicBufferQuota,
      memoryRecallQuota,
      historyQuota,
      headroomTokens: maxGenerationTokens + safetyMarginTokens,
      thermalReductionRatio,
      batteryReducedDepth,
      recentTurnsToKeep,
    };
  }

  /**
   * 第5章2節: 可変TTLの算出 (動的キープアライブ)
   * 通常対話時: 1800秒 (30分)
   * バッテリー低下時／端末高温時: 300秒 (5分)
   */
  public getVariableTtlSeconds(): number {
    if (
      this.healthState.thermalState === 'hot' ||
      this.healthState.thermalState === 'critical' ||
      this.healthState.lowPowerMode
    ) {
      return 300; // 5分で安全蒸発させて熱と電力を保護
    }
    return 1800; // 30分キャッシュ維持
  }

  /**
   * 第3章5節: 統合診断ログの記録
   */
  public recordDiagnosticLog(log: UnifiedDiagnosticLog): void {
    this.diagnosticLogs.unshift(log);
    // 最新50件のみ保持
    if (this.diagnosticLogs.length > 50) {
      this.diagnosticLogs.pop();
    }
  }

  public getDiagnosticLogs(): UnifiedDiagnosticLog[] {
    return [...this.diagnosticLogs];
  }

  public getLatestDiagnosticLog(): UnifiedDiagnosticLog | undefined {
    return this.diagnosticLogs[0];
  }
}

export const contextBudgetEngineService = new ContextBudgetEngineService();
