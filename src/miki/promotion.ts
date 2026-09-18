/**
 * MIKI / promotion
 *
 * 16分類における「promotion」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function promotion() {
  // TODO: promotion 関連の既存機能を段階的に統合
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// promotion 配下のサービスを、この17分類の管理入口から公開する。
export * from './promotion/services/componentPromotionService';
export * from './promotion/services/evidenceBasedPromotionGateService';
export * from './promotion/services/heuristicGraduationService';
export * from './promotion/services/verifiedCapabilityPromotionService';
export * from './promotion/services/verifiedKnowledgePromotionService';
export * from './promotion/services/modelLifecycleService';
