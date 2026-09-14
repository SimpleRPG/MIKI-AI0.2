/**
 * MIKI / autonomy
 *
 * 16分類における「autonomy」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function autonomy() {
  // TODO: autonomy 関連の既存機能を段階的に統合
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// autonomy 配下のサービスを、この17分類の管理入口から公開する。
export * from './autonomy/services/autonomousContinuousEvolutionService';
export * from './autonomy/services/autonomousEvolutionService';
export * from './autonomy/services/autonomousGrowthGovernorService';
export * from './autonomy/services/autonomousHardeningService';
export * from './autonomy/services/autonomousQaService';
export * from './autonomy/services/autonomousRevalidationLoopService';
export * from './autonomy/services/collaborationSelfMaintenanceService';
export * from './autonomy/services/operationalGovernanceService';
