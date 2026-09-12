# Local LLM removal — v51

v50 removed local generative execution from the server path. v51 extends that boundary into the UI/runtime selection path.

## Changes

- Added `src/services/nonLlmRuntimePolicyService.ts` as the single runtime policy boundary.
- Persisted legacy engine selections are normalized to:
  - `autonomous_rule` (deterministic non-LLM core)
  - `gemini_cloud` (optional external teacher)
- Selecting a retired local engine is normalized instead of activating a local model.
- The main chat execution path now enters `nonLlmCoreService.execute()` when the normalized runtime is `autonomous_rule`.
- Local model execution remains unreachable through the normal engine-selection boundary.

## Intent

This is not a local-LLM fallback. The deterministic non-LLM core is the runtime. Gemini remains an explicit external teacher path only.

## Remaining migration targets

Legacy service modules and UI components are still present as compatibility/dead-code migration targets. They must be removed only after their remaining imports and tests are migrated, to avoid ghost implementations and accidental build breakage.
