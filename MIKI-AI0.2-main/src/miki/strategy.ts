/**
 * MIKI / strategy
 *
 * 18分類における「strategy」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function strategy() {
  // TODO: strategy 関連の既存機能を段階的に統合
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// strategy 配下のサービスを、この17分類の管理入口から公開する。
export * from './strategy/services/answerPlanService';
export * from './strategy/services/changeImpactSimulatorService';
export * from './strategy/services/contextBudgetEngineService';
export * from './strategy/services/conversationStrategyService';
export * from './strategy/services/downstreamImpactService';
export * from './strategy/services/executionRouteRankingService';
export * from './strategy/services/frontierCriteriaService';
export * from './strategy/services/frontierGovernanceService';
export * from './strategy/services/implementationSelectionService';
export * from './strategy/services/longTermProjectManagerService';
export * from './strategy/services/minimalScopeService';
export * from './strategy/services/planOrchestratorService';
export * from './strategy/services/predictiveContextOsService';
export * from './strategy/services/proactiveContextOsService';
export * from './strategy/services/responseDesignService';
export * from './strategy/services/responseSurfacePolicyService';
export * from './strategy/services/samplingTuningService';
export * from './strategy/services/taskPlanService';
export * from './strategy/services/unifiedDecisionEngineService';
export * from './strategy/services/workingAgendaService';
