/**
 * MIKI / execution
 *
 * 16分類における「execution」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function execution() {
  // TODO: execution 関連の既存機能を段階的に統合
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// execution 配下のサービスを、この17分類の管理入口から公開する。
export * from './execution/services/androidNativeRunnerAdapterService';
export * from './execution/services/automationStudioService';
export * from './execution/services/backgroundWorkerService';
export * from './execution/services/executableExplanationService';
export * from './execution/services/executionEventBusService';
export * from './execution/services/executionRunnerService';
export * from './execution/services/externalRunnerAdapterService';
export * from './execution/services/nativeBackgroundService';
export * from './execution/services/nativeWorkManagerService';
export * from './execution/services/personalApiGatewayService';
export * from './execution/services/remediationExecutionCoordinatorService';
export * from './execution/services/simpleRpgRuleEngineService';
export * from './execution/services/storagePlanningService';
export * from './execution/services/taskExecutionOrchestratorService';
export * from './execution/services/taskLineageService';
export * from './execution/services/universalIoService';
export * from './execution/services/workDirectiveIngestionService';
export * from './execution/services/workManagerService';
export * from './execution/services/workflowSynthesisService';
