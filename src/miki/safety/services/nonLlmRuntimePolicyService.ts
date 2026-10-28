/**
 * MIKI-AI local runtime boundary.
 *
 * Local generative runtimes are retired. The application runtime must use the
 * Miki CORE basic processing; Gemini is an explicit optional external path.
 * This module never loads, calls, downloads, or streams a local model.
 */
export type NonLlmRuntimeKind = 'NON_LLM_CORE' | 'EXTERNAL_TEACHER';

export interface NonLlmRuntimeStatus {
  policy: 'NON_LLM_ONLY';
  localGenerativeModels: 'REMOVED';
  runtime: NonLlmRuntimeKind;
  reason: string;
}

export const nonLlmRuntimePolicyService = {
  getStatus(runtime: NonLlmRuntimeKind = 'NON_LLM_CORE'): NonLlmRuntimeStatus {
    return {
      policy: 'NON_LLM_ONLY',
      localGenerativeModels: 'REMOVED',
      runtime,
      reason:
        runtime === 'NON_LLM_CORE'
          ? '端末内の生成モデル実行は終了しています。Miki COREの基本処理を利用してください。'
          : '外部生成AIへの接続は任意であり、アプリの基本実行には必須ではありません。',
    };
  },

  isLocalGenerativeRuntimeAvailable(): false {
    return false;
  },

  /** Normalize persisted/legacy engine selections at the runtime boundary. */
  normalizeEngineMode(mode: string | null | undefined): 'autonomous_rule' | 'gemini_cloud' {
    return mode === 'gemini_cloud' ? 'gemini_cloud' : 'autonomous_rule';
  },

  assertNonLlmRuntime(): void {
    // Intentionally a no-op: Miki CORE basic processing is the normal path.
  },

  blockedOperation(operation: string): never {
    throw new Error(
      `旧ローカル生成モデルの操作「${operation}」はブロックされました。` +
        'Miki COREの基本処理として実装するか、既存部品を利用してください。'
    );
  },
};

export default nonLlmRuntimePolicyService;
