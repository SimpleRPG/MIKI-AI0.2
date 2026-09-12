import { ContextTier, ContextBudgetPlan, UnifiedDiagnosticLog } from '../types';
import { systemLogger } from './systemLogger';

export type ThermalState = 'normal' | 'warm' | 'hot' | 'critical';

export interface DeviceHealthState {
  thermalState: ThermalState;
  batteryLevel: number;
  isCharging: boolean;
  lowPowerMode: boolean;
}

/**
 * Non-LLM構造予算エンジン。
 * 生成モデルのコンテキスト長ではなく、文字数・構造要素・記憶件数・コード単位を
 * 実行予算として扱う。ContextTier は既存UI/API互換のため残すが、モデル容量を意味しない。
 */
class ContextBudgetEngineService {
  private currentTier: ContextTier = 4096;
  private diagnosticLogs: UnifiedDiagnosticLog[] = [];
  private healthState: DeviceHealthState = {
    thermalState: 'normal', batteryLevel: 1.0, isCharging: true, lowPowerMode: false,
  };

  constructor() { this.initDeviceMonitoring(); }

  private async initDeviceMonitoring(): Promise<void> {
    if (typeof navigator !== 'undefined' && (navigator as any).getBattery) {
      try {
        const battery = await (navigator as any).getBattery();
        const update = () => {
          this.healthState.batteryLevel = battery.level;
          this.healthState.isCharging = battery.charging;
          this.healthState.lowPowerMode = !battery.charging && battery.level <= 0.2;
        };
        update();
        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
      } catch { /* optional */ }
    }
  }

  public getHealthState(): DeviceHealthState { return { ...this.healthState }; }
  public setThermalState(state: ThermalState): void {
    this.healthState.thermalState = state;
    systemLogger.info('INFERENCE', `StructuralBudget: thermalState=${state}`);
  }

  /** 端末のモデル容量ではなく、実行単位の上限を決める互換API。 */
  public selectInitialTier(deviceRamGB: number, _hardwareHintA: number, _hardwareHintB: number): ContextTier {
    if (deviceRamGB >= 12) this.currentTier = 32768;
    else if (deviceRamGB >= 8) this.currentTier = 16384;
    else if (deviceRamGB >= 6) this.currentTier = 8192;
    else this.currentTier = 4096;
    return this.currentTier;
  }

  public getCurrentTier(): ContextTier { return this.currentTier; }
  public setCurrentTier(tier: ContextTier): void { this.currentTier = tier; }

  public calculateBudgetPlan(
    structuralBudgetOverride?: number,
    isComplexTask = false,
    isCodeTask = false,
  ): ContextBudgetPlan {
    const base = structuralBudgetOverride || this.currentTier;
    let reduction = 1;
    let depth = 3;
    if (this.healthState.thermalState === 'hot') { reduction = 0.7; depth = 2; }
    if (this.healthState.thermalState === 'critical') { reduction = 0.5; depth = 1; }
    if (this.healthState.lowPowerMode || (this.healthState.batteryLevel < 0.15 && !this.healthState.isCharging)) {
      reduction = Math.min(reduction, 0.75); depth = 1;
    }

    const liveBudget = Math.max(1024, Math.floor(base * reduction));
    const headroom = Math.floor(liveBudget * 0.1);
    const usable = liveBudget - headroom;
    let personaQuota = Math.floor(usable * 0.20);
    let episodicBufferQuota = Math.floor(usable * 0.15);
    let memoryRecallQuota = Math.floor(usable * 0.25);
    let codeQuota = isCodeTask ? Math.floor(usable * 0.50) : 0;
    let historyQuota = usable - personaQuota - episodicBufferQuota - memoryRecallQuota - codeQuota;
    if (isCodeTask) {
      personaQuota = Math.floor(usable * 0.10);
      episodicBufferQuota = Math.floor(usable * 0.08);
      memoryRecallQuota = Math.floor(usable * 0.12);
      historyQuota = Math.max(256, usable - personaQuota - episodicBufferQuota - memoryRecallQuota - codeQuota);
    }

    return {
      tier: this.currentTier,
      liveBudget,
      personaQuota,
      episodicBufferQuota,
      memoryRecallQuota,
      historyQuota,
      codeQuota,
      headroomTokens: headroom,
      thermalReductionRatio: reduction,
      batteryReducedDepth: depth,
      recentTurnsToKeep: isCodeTask ? 3 : isComplexTask || reduction < 0.8 ? 4 : 8,
    };
  }

  public getVariableTtlSeconds(): number {
    return this.healthState.thermalState === 'normal' && !this.healthState.lowPowerMode ? 1800 : 300;
  }
  public recordDiagnosticLog(log: UnifiedDiagnosticLog): void {
    this.diagnosticLogs.unshift(log);
    if (this.diagnosticLogs.length > 50) this.diagnosticLogs.pop();
  }
  public getDiagnosticLogs(): UnifiedDiagnosticLog[] { return [...this.diagnosticLogs]; }
  public getLatestDiagnosticLog(): UnifiedDiagnosticLog | undefined { return this.diagnosticLogs[0]; }
}

export const contextBudgetEngineService = new ContextBudgetEngineService();
