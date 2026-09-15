/**
 * MIKI / research
 *
 * 16分類における「research」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function research() {
  // TODO: research 関連の既存機能を段階的に統合
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// research 配下のサービスを、この17分類の管理入口から公開する。
export * from './research/services/autonomousSearchService';
export * from './research/services/causalInvestigationService';
export * from './research/services/dataFactoryService';
export * from './research/services/dataUnderstandingService';
export * from './research/services/digitalResearchNoteService';
export * from './research/services/embeddingService';
export * from './research/services/japaneseAnalysisService';
export * from './research/services/japaneseDictionaryService';
export * from './research/services/japaneseMorphologyService';
export * from './research/services/offlineKnowledgePackService';
export * from './research/services/researchStrategyService';
export * from './research/services/researchToRemediationService';
export * from './research/services/scienceExperimentService';
export * from './research/services/syntheticDataService';
export * from './research/services/virtualExpertService';
export * from './research/services/webMaterialPatternExtractor';
export * from './research/services/unknownResearchControlService';
