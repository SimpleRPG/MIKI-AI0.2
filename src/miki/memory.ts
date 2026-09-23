/**
 * MIKI / memory
 *
 * 18分類における「memory」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function memory() {
  // TODO: memory 関連の既存機能を段階的に統合
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// memory 配下のサービスを、この17分類の管理入口から公開する。
export * from './memory/services/causalMemoryLedgerService';
export * from './memory/services/claimDatabaseService';
export * from './memory/services/evidenceLineageGraphService';
export * from './memory/services/evidenceService';
export * from './memory/services/failureCatalogService';
export * from './memory/services/failureMemoryService';
export * from './memory/services/failureUnderstandingService';
export * from './memory/services/knowledgeHalfLifeService';
export * from './memory/services/longTermMemoryService';
export * from './memory/services/memoryAuditService';
export * from './memory/services/memoryPromotionService';
export * from './memory/services/metaMemoryService';
export * from './memory/services/mikiBrainCapsuleService';
export * from './memory/services/mikiIntrospectionJournalService';
export * from './memory/services/semanticCacheService';
export * from './memory/services/structuralMemoryService';
export * from './memory/services/taskCaseMemoryService';
export * from './memory/services/wordAssociationGraphService';
export * from './memory/services/memoryEligibilityPolicyService';
export * from './memory/services/memoryRecordRepositoryService';
export * from './memory/services/strictMemoryPromotionGateService';
