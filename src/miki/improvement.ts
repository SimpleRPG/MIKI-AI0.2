/**
 * MIKI / improvement
 *
 * 16分類における「improvement」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function improvement() {
  // TODO: improvement 関連の既存機能を段階的に統合
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// improvement 配下のサービスを、この17分類の管理入口から公開する。
export * from './improvement/services/componentImprovementCandidateService';
export * from './improvement/services/deterministicSelfImprovementLabService';
export * from './improvement/services/evidenceBasedSelfImprovementEngine';
export * from './improvement/services/hardeningRegressionCandidateService';
export * from './improvement/services/improvementCanaryRollbackService';
export * from './improvement/services/improvementProposalService';
export * from './improvement/services/improvementRegressionCoordinatorService';
export * from './improvement/services/improvementStaticGuardService';
export * from './improvement/services/safeImprovementPipelineService';
export * from './improvement/services/selfImprovementControllerService';
export * from './improvement/services/selfImprovementExperimentService';
export * from './improvement/services/selfImprovementMetricsService';
export * from './improvement/services/selfImprovementService';
export * from './improvement/services/selfImprovementSuiteService';
