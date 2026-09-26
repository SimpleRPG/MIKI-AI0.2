/**
 * MIKI / capability
 *
 * 18分類における「capability」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function capability() {
  // TODO: capability 関連の既存機能を段階的に統合
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// capability 配下のサービスを、この17分類の管理入口から公開する。
export * from './capability/services/capabilityCompositionProofService';
export * from './capability/services/capabilityConfidenceService';
export * from './capability/services/capabilityCouncilService';
export * from './capability/services/capabilityDependencyService';
export * from './capability/services/capabilityGapService';
export * from './capability/services/capabilityGraphService';
export * from './capability/services/capabilityImplementationRegistryService';
export * from './capability/services/capabilityLearningService';
export * from './capability/services/capabilityPluginService';
export * from './capability/services/capabilityReuseService';
export * from './capability/services/capabilityTraceabilityService';
export * from './capability/services/componentArtifactStoreService';
export * from './capability/services/componentCompositionService';
export * from './capability/services/componentRegistryService';
export * from './capability/services/componentVersionHistoryService';
export * from './capability/services/deterministicCapabilityEvolutionService';
export * from './capability/services/deterministicCapabilityExecutionService';
export * from './capability/services/dynamicToolFactoryService';
export * from './capability/services/skillsService';
export * from './capability/services/toolsService';
