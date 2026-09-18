# MIKI Android native plugins

This directory contains native Android bridges used by MIKI.

## Japanese morphology

`MIKIJapaneseMorphologyPlugin.kt` exposes the pinned Sudachi Java tokenizer through Capacitor. The plugin expects `system_core.dic` in Android app assets. The build preparation script downloads the pinned dictionary rather than committing the binary into this repository.

Install during an Android build:

```bash
npx cap add android
bash scripts/install_android_japanese_morphology.sh
npx cap sync android
```

The plugin provides:

- `status()` — dictionary/plugin availability
- `tokenize({text, mode})` — A/B/C Sudachi tokenization

The JavaScript service falls back to `Intl.Segmenter` and then to the deterministic parser if the native plugin is unavailable.

## Native runner

`MIKINativeRunnerPlugin.kt` remains a separate allow-listed execution bridge. It does not execute arbitrary shell/code.
