/**
 * MIKI / selfAwareness
 *
 * 16分類における「selfAwareness」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function selfAwareness() {
  // TODO: selfAwareness 関連の既存機能を段階的に統合
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// selfAwareness 配下のサービスを、この17分類の管理入口から公開する。
export * from './selfAwareness/services/affectionDynamicsService';
export * from './selfAwareness/services/cognitiveEvidenceIntegrationService';
export * from './selfAwareness/services/cognitiveExecutionEvidenceService';
export * from './selfAwareness/services/integratedCognitionControllerService';
export * from './selfAwareness/services/intelligenceSnapshotService';
export * from './selfAwareness/services/knowledgeOperatingSystemService';
export * from './selfAwareness/services/metacognitiveCalibrationService';
export * from './selfAwareness/services/mikiCognitiveKernelService';
export * from './selfAwareness/services/mikiCognitiveVitalsService';
export * from './selfAwareness/services/mikiReasoningTemplateService';
export * from './selfAwareness/services/persistentPersonalityService';
export * from './selfAwareness/services/situationalAwarenessService';
export * from './selfAwareness/services/whyAnswerInspectorService';
export * from './selfAwareness/services/worldModelService';
