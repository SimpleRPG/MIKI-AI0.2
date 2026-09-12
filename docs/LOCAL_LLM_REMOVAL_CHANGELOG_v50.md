# v50 — Local LLM removal

This cumulative version changes the architectural direction from **migration-by-promotion** to **removal-by-default** for local generative models.

### Implemented
- Removed `server.ts` local LLM HTTP fallback (`LOCAL_LLM_ENDPOINT`, llama-server/llama-swap call path).
- Removed local LLM as the autonomous implementation generator.
- `/api/self-code/autonomous-implement` now accepts explicit source for verification or deterministic VERIFIED-component composition only.
- Missing non-LLM capability returns a deterministic `409` instead of invoking a model.
- Added a static regression gate: `scripts/test_no_local_llm_boundary.mjs`.
- Rewrote the runtime/model manifests to declare local generative model execution retired.
- Marked legacy local-model registry chapters as `RETIRED` and added the status to the chapter status type.
- Updated chapter 0 registry ownership from `nativeLlmService.ts` to `nonLlmCoreService.ts`.

### Deliberately not claimed yet
The React engine UI and several legacy services still contain compatibility references to `nativeLlmService` / `webLlmService`. They are the next deletion target. They are not part of the server execution path after this change.
