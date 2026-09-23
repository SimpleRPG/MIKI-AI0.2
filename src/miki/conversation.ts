/**
 * MIKI / conversation
 *
 * 18分類における「conversation」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function conversation() {
  // TODO: conversation 関連の既存機能を段階的に統合
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// conversation 配下のサービスを、この17分類の管理入口から公開する。
export * from './conversation/services/answerContentIrService';
export * from './conversation/services/conversationBranchService';
export * from './conversation/services/conversationComponentCompositionService';
export * from './conversation/services/conversationEvaluationService';
export * from './conversation/services/conversationStateService';
export * from './conversation/services/conversationTaskboardService';
export * from './conversation/services/dialogueEvaluationService';
export * from './conversation/services/hybridConversationEngineService';
export * from './conversation/services/liveConversationRepairService';
export * from './conversation/services/speechRecognitionService';
export * from './conversation/services/surfaceGrammarAndStyleService';
export * from './conversation/services/surfaceVariationGrowthService';
export * from './conversation/services/surfaceVariationService';
export * from './conversation/services/japaneseAnalysisCompositionService';
export * from './conversation/services/runtimeConversationCompositionService';
export * from './conversation/services/conversationCompositionResearchSchedulerService';
export * from './conversation/services/conversationFeedbackEvidenceService';
export * from './conversation/services/conversationLearningEpisodeService';
export * from './conversation/services/coreResultAnswerContentIrService';
