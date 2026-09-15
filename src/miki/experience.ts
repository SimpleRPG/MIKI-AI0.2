/**
 * MIKI / experience
 *
 * 16分類における「experience」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function experience() {
  // TODO: experience 関連の既存機能を段階的に統合
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// experience 配下のサービスを、この17分類の管理入口から公開する。
export * from './experience/services/digitalTwinService';
export * from './experience/services/experienceFreshnessService';
export * from './experience/services/experienceLinkService';
export * from './experience/services/experienceRouterService';
export * from './experience/services/unifiedMikiExperienceService';
export * from './experience/services/virtualExperienceGeneratorService';
export * from './experience/services/unifiedExperienceImprovementBridgeService';
