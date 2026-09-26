/**
 * MIKI-AI non-GENERATIVE_RUNTIME runtime boundary.
 *
 * Local generative runtimes are retired. The application runtime must use the
 * deterministic non-GENERATIVE_RUNTIME core; Gemini is an explicit external teacher path.
 * This module never loads, calls, downloads, or streams a local model.
 */
export type DeterministicRuntimeKind = 'DETERMINISTIC_CORE' | 'EXTERNAL_TEACHER';

export interface DeterministicRuntimeStatus {
  policy: 'DETERMINISTIC_ONLY';
  localGenerativeModels: 'REMOVED';
  runtime: DeterministicRuntimeKind;
  reason: string;
}

export const deterministicRuntimePolicyService = {
  getStatus(runtime: DeterministicRuntimeKind = 'DETERMINISTIC_CORE'): DeterministicRuntimeStatus {
    return {
      policy: 'DETERMINISTIC_ONLY',
      localGenerativeModels: 'REMOVED',
      runtime,
      reason:
        runtime === 'DETERMINISTIC_CORE'
          ? 'Local generative model execution is retired. Use deterministic non-GENERATIVE_RUNTIME components.'
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

  assertDeterministicRuntime(): void {
    // Intentionally a no-op: deterministic non-GENERATIVE_RUNTIME execution is the normal path.
  },

  blockedOperation(operation: string): never {
    throw new Error(
      `Blocked local generative runtime operation: ${operation}. ` +
        'Implement or use a deterministic non-GENERATIVE_RUNTIME component instead.'
    );
  },
};

export default deterministicRuntimePolicyService;
