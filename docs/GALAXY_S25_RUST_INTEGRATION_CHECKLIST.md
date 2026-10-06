# Galaxy S25 Rust Native Integration Checklist

## Build
- [ ] Install Rust stable, Android NDK, and `aarch64-linux-android` target.
- [ ] Run `scripts/rust/test_all.sh`.
- [ ] Run `android/scripts/build_arm64_v8a.sh`.
- [ ] Verify `android/app/src/main/jniLibs/arm64-v8a/libmiki_native_core.so` SHA-256.

## Installation
- [ ] Build signed debug APK without API keys in the package.
- [ ] Install on Galaxy S25.
- [ ] Confirm ABI is arm64-v8a and Native Core health is compatible.

## Domain checks
- [ ] Execute one success and one failure fixture for all 17 domains.
- [ ] Confirm `engine=RUST` and matching `owner_domain`.
- [ ] Confirm native failure performs safe stop and creates no receipt.
- [ ] Confirm deterministic SHA-256 on repeated identical input.
- [ ] Confirm interruption and relaunch preserve only committed receipts.

## Performance
- [ ] Run boundary fixtures at 10%, 50%, and configured maximum size.
- [ ] Record elapsed time, peak memory, thermal state, and cancellation latency.
- [ ] Confirm no ANR and no background execution policy violation.
