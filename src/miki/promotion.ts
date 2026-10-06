/**
 * MIKI / promotion
 *
 * 18分類における「promotion」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 正規実行はCOREのdomainIntegrationBootstrapService Promotion Adapterが所有し、
 * このFacadeは専門Serviceの公開入口として使用する。
 */

export function promotion() {
  return { category: 'promotion' as const, canonicalEntry: 'domainIntegrationBootstrapService:APPROVE_REVIEWED_CANDIDATE', pipeline: ['formalAdoptionAuthorizationService','formalAdoptionAuthorizationLedgerService','promotion-domain-adapter'] as const };
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// promotion 配下のサービスを、この17分類の管理入口から公開する。
export * from './promotion/services/componentPromotionService';
export * from './promotion/services/evidenceBasedPromotionGateService';
export * from './promotion/services/heuristicGraduationService';
export * from './promotion/services/verifiedCapabilityPromotionService';
export * from './promotion/services/verifiedKnowledgePromotionService';
export * from './promotion/services/modelLifecycleService';
