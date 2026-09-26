/**
 * MIKI / research
 *
 * 18分類における「research」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function research() {
  return { domain: 'research', entrypoint: 'researchQueryPlanningService' };
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
export * from './research/services/externalAiResearchBundleService';
export * from './research/services/researchQueryPlanningService';
export * from './research/services/researchQueryOutcomeLearningService';

export * from './research/services/queryPatternRepositoryService';

export { internalWebQueryLearningCycleService } from './research/services/internalWebQueryLearningCycleService';
export type { ResearchEnvironmentKind, WebContentKind, RenderedPageInput, RenderedPageSections, InternalResearchEvidence, InternalResearchClaim, LearnedTerm, InternalKnowledgeComponent, InternalWebQueryCycleResult } from './research/services/internalWebQueryLearningCycleService';

export * from "./research/services/webTermLearningService";
