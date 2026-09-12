/**
 * MIKI-AI non-LLM runtime boundary.
 *
 * Local generative runtimes are retired. The application runtime must use the
 * deterministic non-LLM core; Gemini is an explicit external teacher path.
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
          ? 'Local generative model execution is retired. Use deterministic non-LLM components.'
          : 'External teacher access is optional and is not an application runtime dependency.',
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
    // Intentionally a no-op: deterministic non-LLM execution is the normal path.
  },

  blockedOperation(operation: string): never {
    throw new Error(
      `Blocked local generative runtime operation: ${operation}. ` +
        'Implement or use a deterministic non-LLM component instead.'
    );
  },
};

export default nonLlmRuntimePolicyService;
