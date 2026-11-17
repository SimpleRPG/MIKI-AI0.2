import { storageService } from '../../../services/storageService';
import { componentRegistryService } from '../../capability/services/componentRegistryService';
import { componentArtifactStoreService } from '../../capability/services/componentArtifactStoreService';
import { componentPromotionService } from '../../promotion/services/componentPromotionService';
import { componentRegressionService } from '../../verification/services/componentRegressionService';

/**
 * P921: 供給部品（P919）の昇格パイプライン接続。
 *
 * 供給で登録された部品は Artifact 正本が無く、昇格ゲート
 * （componentPromotionService.createGate）が作れなかった。
 * 本サービスが「Artifact 保存 → 回帰ゲート作成」を担い、
 * 実行ランナーが全件 PASS を返した後に validateForLimited で
 * ANALYZED → DEVICE_TESTED へ進める入口を提供する。
 * 正式 VERIFIED は従来どおり Canary 通過後の
 * promoteIfSafeForCanary だけが担当し、ここでは作らない。
 */

const STORAGE_KEY = 'miki_code_promotion_gates_v1';
const ENVIRONMENT = 'EXTERNAL_RUNNER';

interface GateRecord { suiteId: string; implementationHash: string; preparedAt: number }

export interface PrepareGateResult {
  ok: boolean;
  componentId: string;
  suiteId?: string;
  caseCount?: number;
  reason?: string;
}

class CodeComponentPromotionBridgeService {
  private static instance: CodeComponentPromotionBridgeService;
  private constructor() {}
  public static getInstance(): CodeComponentPromotionBridgeService {
    if (!this.instance) this.instance = new CodeComponentPromotionBridgeService();
    return this.instance;
  }

  private load(): Record<string, GateRecord> {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
  }

  private save(map: Record<string, GateRecord>): void {
    try { storageService.setItem(STORAGE_KEY, JSON.stringify(map)); } catch { /* 保存失敗でも昇格処理は続行する */ }
  }

  /**
   * 部品の Artifact 正本を保存し、回帰ゲートを作成する。
   * 同じ実装ハッシュで作成済みなら既存の Suite を返す（冪等）。
   */
  public prepare(componentId: string): PrepareGateResult {
    const component: any = componentRegistryService.getComponent(componentId);
    if (!component) return { ok: false, componentId, reason: 'COMPONENT_NOT_FOUND' };
    const map = this.load();
    const existing = map[componentId];
    if (existing && existing.implementationHash === component.implementation_hash) {
      const suite: any = componentRegressionService.get(existing.suiteId);
      if (suite) return { ok: true, componentId, suiteId: suite.suite_id, caseCount: suite.test_case_ids?.length ?? 0 };
    }
    try { componentArtifactStoreService.save(component); } catch { /* 下のゲート作成で不足が表面化する */ }
    const suite: any = componentPromotionService.createGate(componentId, ENVIRONMENT as any);
    if (!suite) return { ok: false, componentId, reason: 'GATE_UNAVAILABLE' };
    map[componentId] = { suiteId: suite.suite_id, implementationHash: component.implementation_hash, preparedAt: Date.now() };
    this.save(map);
    return { ok: true, componentId, suiteId: suite.suite_id, caseCount: suite.test_case_ids?.length ?? 0 };
  }

  /**
   * 回帰 Suite が全件 PASS していれば LIMITED ゲートを通し、
   * ANALYZED → DEVICE_TESTED へ進める。未 PASS なら理由を返す。
   */
  public promoteIfPassed(componentId: string): { accepted: boolean; componentId: string; previousStatus?: string; nextStatus?: string; reason: string } {
    const map = this.load();
    const record = map[componentId];
    if (!record) return { accepted: false, componentId, reason: 'GATE_NOT_PREPARED' };
    const result: any = componentPromotionService.validateForLimited(record.suiteId);
    return {
      accepted: Boolean(result?.accepted),
      componentId,
      previousStatus: result?.previousStatus,
      nextStatus: result?.nextStatus,
      reason: String(result?.reason || ''),
    };
  }

  public summary(): { prepared: number; deviceTested: number } {
    const map = this.load();
    let deviceTested = 0;
    for (const componentId of Object.keys(map)) {
      const status = (componentRegistryService.getComponent(componentId) as any)?.status;
      if (status === 'DEVICE_TESTED' || status === 'VERIFIED') deviceTested++;
    }
    return { prepared: Object.keys(map).length, deviceTested };
  }
}

export const codeComponentPromotionBridgeService = CodeComponentPromotionBridgeService.getInstance();
