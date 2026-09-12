import { componentRegistryService } from './componentRegistryService';
import { componentRegressionService, RegressionSuite } from './componentRegressionService';
import { evidenceService } from './evidenceService';
import { systemLogger } from './systemLogger';
import { ComponentStatus } from '../types';
import { componentArtifactStoreService } from './componentArtifactStoreService';

export interface ComponentPromotionResult {
  componentId: string;
  accepted: boolean;
  previousStatus?: ComponentStatus;
  nextStatus?: ComponentStatus;
  suiteId?: string;
  reason: string;
}

/**
 * Componentの正式昇格ゲート。
 *
 * Execution成功だけではVERIFIEDにしない。
 * 1) 実装ハッシュ一致
 * 2) Regression Suite全件PASS
 * 3) Suite作成後に実装変更なし
 * を満たした場合だけRegistryの明示的な状態遷移を行う。
 */
export class ComponentPromotionService {
  private static instance: ComponentPromotionService;
  private constructor() {}

  public static getInstance(): ComponentPromotionService {
    if (!this.instance) this.instance = new ComponentPromotionService();
    return this.instance;
  }

  public createGate(componentId: string, environment: RegressionSuite['environment']): RegressionSuite | undefined {
    const component = componentRegistryService.getComponent(componentId);
    if (!component) return undefined;
    if (!component.implementation_hash) return undefined;
    const artifact = componentArtifactStoreService.get(componentId, component.version);
    if (!artifact || artifact.implementation_hash !== component.implementation_hash) return undefined;
    return componentRegressionService.plan(componentId, environment);
  }

  /**
   * Regression PASSを「実機検証済み候補」として確定するだけのゲート。
   * 正式VERIFIEDにはせず、Canary/LIMITED運用へ渡す。
   * 設計思想13.1の CANDIDATE -> UNIT_TESTED/SHADOW_TESTED -> LIMITED -> STABLE
   * に対応する安全境界。
   */
  public validateForLimited(suiteId: string): ComponentPromotionResult {
    const suite = componentRegressionService.get(suiteId);
    if (!suite) return { componentId: '', accepted: false, suiteId, reason: 'Regression Suiteが存在しません。' };
    const component = componentRegistryService.getComponent(suite.component_id);
    if (!component) return { componentId: suite.component_id, accepted: false, suiteId, reason: 'Componentが存在しません。' };
    const previousStatus = component.status;
    const artifact = componentArtifactStoreService.get(component.component_id, component.version, component.implementation_hash);
    if (!artifact || artifact.implementation_hash !== suite.implementation_hash) {
      return { componentId: component.component_id, accepted: false, previousStatus, suiteId, reason: 'Regression対象のTXT正本とhashが一致しません。' };
    }
    const gate = componentRegressionService.isSafeToPromote(suiteId);
    if (!gate.safe) return { componentId: component.component_id, accepted: false, previousStatus, suiteId, reason: gate.reason };
    if (previousStatus !== 'ANALYZED' && previousStatus !== 'DEVICE_TESTED') {
      return { componentId: component.component_id, accepted: false, previousStatus, suiteId, reason: `LIMITED移行対象外の状態=${previousStatus}。` };
    }
    if (previousStatus === 'DEVICE_TESTED') {
      return { componentId: component.component_id, accepted: true, previousStatus, nextStatus: 'DEVICE_TESTED', suiteId, reason: 'Regression PASS。正式VERIFIEDにはせずLIMITED/Canaryへ進めます。' };
    }
    const changed = componentRegistryService.advanceComponentStatus(
      component.component_id, 'DEVICE_TESTED',
      'Regression Gate全件PASS、実装ハッシュ一致。LIMITED/Canary開始前の実機検証済み状態'
    );
    if (!changed) return { componentId: component.component_id, accepted: false, previousStatus, suiteId, reason: 'RegistryをDEVICE_TESTEDへ遷移できません。' };
    systemLogger.info('TOOLS', `🧪 [LimitedGate] ${component.component_id}: ${previousStatus} -> DEVICE_TESTED via ${suiteId}`);
    return { componentId: component.component_id, accepted: true, previousStatus, nextStatus: 'DEVICE_TESTED', suiteId, reason: 'Regression PASSを確認。正式昇格を保留してLIMITED/Canaryへ渡します。' };
  }

  /**
   * Canaryを通過した現在版を、元のRegression Suiteの証拠とhashを照合して
   * LIMITED/DEVICE_TESTED -> VERIFIEDへ正式昇格する。Canary前には呼べない。
   */
  public promoteIfSafeForCanary(runId: string, baseComponentId: string, suiteId: string): ComponentPromotionResult {
    const suite = componentRegressionService.get(suiteId);
    if (!suite) return { componentId: baseComponentId, accepted: false, reason: `Canary通過後の対応Regression Suiteを確認できません (run=${runId}, suite=${suiteId})。` };
    const component = componentRegistryService.getComponent(baseComponentId);
    if (!component) return { componentId: baseComponentId, accepted: false, suiteId: suite.suite_id, reason: 'Canary対象の基底Componentが存在しません。' };
    if (component.implementation_hash !== suite.implementation_hash) return { componentId: baseComponentId, accepted: false, suiteId: suite.suite_id, reason: 'Canary hashとRegression hashが一致しません。正式昇格を停止します。' };
    const artifact = componentArtifactStoreService.get(component.component_id, component.version, component.implementation_hash);
    if (!artifact || artifact.implementation_hash !== suite.implementation_hash) return { componentId: baseComponentId, accepted: false, suiteId: suite.suite_id, reason: 'Canary後の現在TXT正本とRegression hashが一致しません。' };
    const previousStatus = component.status;
    if (previousStatus !== 'DEVICE_TESTED') return { componentId: baseComponentId, accepted: false, previousStatus, suiteId: suite.suite_id, reason: `Canary後の正式昇格対象状態=${previousStatus}。DEVICE_TESTEDが必要です。` };
    const changed = componentRegistryService.advanceComponentStatus(component.component_id, 'VERIFIED', 'LIMITED/Canary実利用を通過し、Regression Evidenceと実装hashが一致');
    if (!changed || !changed.success) return { componentId: baseComponentId, accepted: false, previousStatus, suiteId: suite.suite_id, reason: changed?.message || 'Canary後のRegistry正式昇格に失敗しました。' };
    evidenceService.recordExecutionEvidence({
      title: `Canary promotion: ${component.component_id}`,
      snippet: `Canary run=${runId} PASSED; Regression Suite=${suite.suite_id}; implementation_hash=${suite.implementation_hash}; DEVICE_TESTED -> VERIFIED`,
      source: 'canary_promotion_gate', sourceId: runId, independenceClusterId: `cluster_canary_promotion_${runId}`,
      metadata: { component_id: component.component_id, implementation_hash: suite.implementation_hash, test_category: 'REGRESSION', passed: true, environment: suite.environment, runner: 'canary_promotion_gate', observed_at: Date.now(), result_summary: 'Canary passed after Regression Gate' },
    });
    systemLogger.info('TOOLS', `🏁 [CanaryPromotion] ${component.component_id}: DEVICE_TESTED -> VERIFIED via ${runId}`);
    return { componentId: baseComponentId, accepted: true, previousStatus, nextStatus: 'VERIFIED', suiteId: suite.suite_id, reason: 'Canaryを通過し、正式VERIFIEDへ昇格しました。' };
  }

  /**
   * 旧API互換。Regression PASSだけでVERIFIEDにしてしまう抜け道を閉じる。
   * 正式昇格は必ずCanary通過後のpromoteIfSafeForCanary()だけが担当する。
   */
  public promoteIfSafe(suiteId: string): ComponentPromotionResult {
    return this.validateForLimited(suiteId);
  }

  public planAndPromote(componentId: string, environment: RegressionSuite['environment']): ComponentPromotionResult {
    const suite = this.createGate(componentId, environment);
    if (!suite) return { componentId, accepted: false, reason: 'Promotion Gateを作成できません。' };
    return this.validateForLimited(suite.suite_id);
  }
}

export const componentPromotionService = ComponentPromotionService.getInstance();
