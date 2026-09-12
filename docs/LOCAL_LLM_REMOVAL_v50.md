# Local LLM Removal — v50 direction

## Decision

MIKI-AI no longer treats a local LLM as a fallback, executor, code generator, or required runtime component.

The target is not gradual promotion from `LLM_ONLY` to `NON_LLM_DEFAULT`. That migration protocol remains useful as historical evidence, but the runtime architecture now assumes that local LLM is **removed**.

## Runtime rules

1. `server.ts` must never call `llama-server`, `llama-swap`, WebLLM, Qwen, SmolLM, or another local generative model.
2. `/api/self-code/autonomous-implement` accepts explicit code for verification or composes existing `VERIFIED` components. It does not invent source code with an LLM.
3. If a required implementation is missing, the system returns a deterministic `409` block instead of fabricating a solution.
4. External Gemini remains only for legacy teacher/knowledge workflows until those workflows are themselves replaced by deterministic knowledge transformations.
5. New features must be added to the non-LLM pipeline rather than adding another model fallback.

## Next removal targets

- Remove `nativeLlmService.ts`, `webLlmService.ts`, and `ggufModels.ts` after their UI/service consumers are migrated to non-LLM hardware/runtime diagnostics.
- Remove `@mlc-ai/web-llm` from `package.json` once the UI consumers are gone.
- Remove local-model engine modes from `EngineMode` and the engine modal.
- Replace local-LLM-dependent evaluation/embedding paths with deterministic token/feature representations or the existing non-LLM knowledge services.
- Remove stale Qwen/LLM claims from generated help text, registries, and specification maps.

## Invariant

> If the non-LLM system cannot perform a requested operation deterministically and safely, it must say that the capability is missing. It must not silently resurrect a local LLM.
