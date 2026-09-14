/**
 * MIKI / selfDevelopment
 *
 * 16分類における「selfDevelopment」機能の統合入口。
 * 既存の専門サービスを段階的に接続する。
 *
 * 現段階では受け皿のみを定義し、
 * 既存機能の移動・削除は行わない。
 */

export function selfDevelopment() {
  // TODO: selfDevelopment 関連の既存機能を段階的に統合
}

// === MIKI CATEGORY SERVICE EXPORTS ===
// selfDevelopment 配下のサービスを、この17分類の管理入口から公開する。
export * from './selfDevelopment/services/aiderEngineService';
export * from './selfDevelopment/services/autonomousSoftwareFactoryService';
export * from './selfDevelopment/services/codeMapService';
export * from './selfDevelopment/services/codeSearchService';
export * from './selfDevelopment/services/codeSkeletonService';
export * from './selfDevelopment/services/codeUnderstandingService';
export * from './selfDevelopment/services/codebaseReflectionService';
export * from './selfDevelopment/services/mikiAutonomousDevStudioService';
export * from './selfDevelopment/services/mikiSelfCodingSuperchargerService';
export * from './selfDevelopment/services/nonLlmCodeSynthesisService';
export * from './selfDevelopment/services/requestTypeCompilerService';
export * from './selfDevelopment/services/selfCodeApiClient';
export * from './selfDevelopment/services/selfCodeArchitectService';
export * from './selfDevelopment/services/skillIrCompilerService';
export * from './selfDevelopment/services/softwareFactoryService';
export * from './selfDevelopment/services/specAstParserService';
export * from './selfDevelopment/services/specContractCompilerService';
export * from './selfDevelopment/services/vbaDesignAssistantService';
