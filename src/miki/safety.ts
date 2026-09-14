/**
 * MIKI / safety
 *
 * 16分類における「safety」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function safety() {
  // TODO: safety 関連の既存機能を段階的に統合
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// safety 配下のサービスを、この17分類の管理入口から公開する。
export * from './safety/services/abstractSanitizerService';
export * from './safety/services/bannedTopicsConfigService';
export * from './safety/services/canaryDeploymentSafetyService';
export * from './safety/services/cloudAiRestrictedGatewayService';
export * from './safety/services/failureRecoveryService';
export * from './safety/services/failureToleranceKernelService';
export * from './safety/services/featureFlagsService';
export * from './safety/services/llmMigrationProtocolService';
export * from './safety/services/modelLifecycleService';
export * from './safety/services/nonLlmCoreService';
export * from './safety/services/nonLlmHardwarePipelineService';
export * from './safety/services/nonLlmModelCatalog';
export * from './safety/services/nonLlmRuntimePolicyService';
export * from './safety/services/nonLlmRuntimeService';
export * from './safety/services/privacyGuardrailService';
export * from './safety/services/recoveryOrchestratorService';
export * from './safety/services/remediationFailureRecoveryService';
export * from './safety/services/resourceGovernanceService';
export * from './safety/services/reversibilityService';
export * from './safety/services/sandboxPermissionService';
export * from './safety/services/securityImmunityService';
