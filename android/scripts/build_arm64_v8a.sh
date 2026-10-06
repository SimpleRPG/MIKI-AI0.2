#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CRATE="$ROOT/native/miki-native-core"
TARGET=aarch64-linux-android
API="${ANDROID_API:-28}"
: "${ANDROID_NDK_HOME:?ANDROID_NDK_HOME is required}"
HOST_TAG="${HOST_TAG:-linux-x86_64}"
TOOLCHAIN="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/$HOST_TAG/bin"
export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER="$TOOLCHAIN/aarch64-linux-android${API}-clang"
rustup target add "$TARGET"
cd "$CRATE"
cargo build --release --target "$TARGET"
OUT="$ROOT/android/app/src/main/jniLibs/arm64-v8a"
mkdir -p "$OUT"
cp "target/$TARGET/release/libmiki_native_core.so" "$OUT/libmiki_native_core.so"
sha256sum "$OUT/libmiki_native_core.so" > "$OUT/libmiki_native_core.so.sha256"
