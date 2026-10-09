# Japanese morphology: Sudachi Android boundary

## Purpose

The Japanese analysis layer now has a real native Sudachi adapter boundary. The Web/JS path remains deterministic and safe when native analysis is unavailable; Android can use Sudachi with a pinned system dictionary.

## Runtime order

1. Android native `MIKIJapaneseMorphology` plugin
2. `Intl.Segmenter('ja')`
3. deterministic fallback

The fallback is never presented as Sudachi-compatible.

## Pinned build inputs

- Sudachi Java: `0.8.1`
- SudachiDict core: `20260723-core`
- dictionary asset: `system_core.dic`

The dictionary binary is intentionally **not committed to the source ZIP**. GitHub Actions downloads the pinned dictionary during APK preparation. This keeps the source artifact small and makes the binary provenance explicit.

Android stores the dictionary under the app-private `filesDir` and resolves the relative `system_core.dic` path with `PathAnchor.filesystem(context.filesDir.absolutePath)`. Do not use `PathAnchor.none()` for this configuration: Sudachi 0.8.x changed `None` so it does not resolve configured resources.

Sudachi exposes A/B/C split modes and morpheme metadata including surface, normalized form, dictionary form, reading, POS, offsets, OOV status and synonym groups. The adapter preserves these fields before the higher-level dictionary layer enriches them.

## Personal dictionary

Personal entries remain in the application storage layer and are not silently merged into the Sudachi system dictionary. This prevents an unverified user correction or web result from changing the morphological analyzer itself.

## License/provenance

SudachiDict is Apache License 2.0 and includes UniDic/NEologd-derived material; the APK build must retain the corresponding notices. JMdict is governed by the EDRDG dictionary licence and should be distributed/used with the required acknowledgement. Do not copy JMdict or other large third-party datasets into the repository without preserving their licence metadata.

## Verification boundary

A successful native `status()` only means that the pinned dictionary can be loaded. It does not make a linguistic claim VERIFIED. Tokenization tests must be recorded separately as execution evidence.
