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

`android/app/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt` paired with `MIKINativeCore.kt` is the canonical Rust-enabled runtime bridge used by the checked-in Android application. The `android-native/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt` file is a limited legacy/seed adapter and does not include the Rust goal-decision and route-ranking endpoints. Never copy it over the canonical Android app file; the installer validates the canonical bridge and fails closed if it is missing. The runner remains allow-listed and does not execute arbitrary shell/code.
