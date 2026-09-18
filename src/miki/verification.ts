/**
 * MIKI / verification
 *
 * 16分類における「verification」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function verification() {
  // TODO: verification 関連の既存機能を段階的に統合
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// verification 配下のサービスを、この17分類の管理入口から公開する。
export * from './verification/services/benchmarkFactoryService';
export * from './verification/services/calibrationDriftService';
export * from './verification/services/codeVerificationService';
export * from './verification/services/cognitiveDebuggerService';
export * from './verification/services/completionJudgeService';
export * from './verification/services/componentRegressionService';
export * from './verification/services/componentTestCaseService';
export * from './verification/services/componentVerificationService';
export * from './verification/services/deviceBenchmarkService';
export * from './verification/services/draftVerificationService';
export * from './verification/services/falsificationService';
export * from './verification/services/faultInjectionLabService';
export * from './verification/services/formalConstraintSolverService';
export * from './verification/services/formalProofService';
export * from './verification/services/formalSemanticsKernelService';
export * from './verification/services/operationalConformanceService';
export * from './verification/services/regressionBenchmarkService';
export * from './verification/services/schemaValidationService';
export * from './verification/services/testAssertionService';
export * from './verification/services/vbaStaticVerifierService';
export * from './verification/services/verifierService';
export * from './verification/services/claimVerificationEventService';
export * from './verification/services/externalReviewNormalizerService';
export * from './verification/services/projectTestRegistryService';
export * from './verification/services/unifiedValidationCoordinatorService';
export * from './verification/services/unknownVerificationSubscriberService';
export * from './verification/services/userFeedbackGovernanceService';
