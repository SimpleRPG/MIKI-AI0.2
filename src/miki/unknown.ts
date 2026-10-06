/**
 * MIKI / unknown
 *
 * 18分類における「unknown」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 正規入口と主要パイプラインを公開し、既存専門サービスを互換維持する。
 */

export function unknown() {
  return { category: 'unknown' as const, canonicalEntry: 'unifiedUnknownResolutionCoordinatorService', pipeline: ['unknownResolutionService','unknownKnowledgeIntegrationService','unifiedUnknownResolutionCoordinatorService'] as const };
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// unknown 配下のサービスを、この17分類の管理入口から公開する。
export * from './unknown/services/counterexampleContractRefinementService';
export * from './unknown/services/counterfactualReasoningService';
export * from './unknown/services/counterfactualWorkSimulatorService';
export * from './unknown/services/knowledgeGapService';
export * from './unknown/services/latentIntentMiningService';
export * from './unknown/services/unknownResolutionService';
export * from './unknown/services/unknownTaskDecompositionService';
export * from './unknown/services/unknownKnowledgeIntegrationService';
export * from './unknown/services/unifiedUnknownResolutionCoordinatorService';
