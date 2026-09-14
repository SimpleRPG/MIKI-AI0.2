/**
 * MIKI / unknown
 *
 * 16分類における「unknown」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function unknown() {
  // TODO: unknown 関連の既存機能を段階的に統合
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
