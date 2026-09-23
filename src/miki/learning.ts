/**
 * MIKI / learning
 *
 * 18分類における「learning」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function learning() {
  // TODO: learning 関連の既存機能を段階的に統合
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// learning 配下のサービスを、この17分類の管理入口から公開する。
export * from './learning/services/autonomousCurriculumService';
export * from './learning/services/codeComprehensionQuizService';
export * from './learning/services/decisionLearningService';
export * from './learning/services/executionLearningCoordinatorService';
export * from './learning/services/goalBacksolvingLearningService';
export * from './learning/services/mikiConversationLearningService';
export * from './learning/services/mikiUnifiedLearningContinuumService';
export * from './learning/services/simpleRpgCapabilityLearningService';
export * from './learning/services/taskConversationFeedbackService';
export * from './learning/services/taskResultFeedbackService';
export * from './learning/services/teacherDriftService';
export * from './learning/services/teacherRequestService';
export * from './learning/services/uncertaintyTeacherService';
export * from './learning/services/userProficiencyService';
export * from './learning/services/virtualTrainingService';
