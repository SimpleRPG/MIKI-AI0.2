#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CRATE="$ROOT/native/miki-native-core"
OUT="$ROOT/android/app/src/main/jniLibs"
: "${ANDROID_NDK_HOME:?ANDROID_NDK_HOME is required}"
command -v cargo >/dev/null 2>&1 || { echo 'cargo is required' >&2; exit 1; }
HOST_TAG=${HOST_TAG:-linux-x86_64}
TOOLCHAIN="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/$HOST_TAG/bin"
for item in "aarch64-linux-android:arm64-v8a:aarch64-linux-android24-clang" "x86_64-linux-android:x86_64:x86_64-linux-android24-clang"; do
  target=${item%%:*}; rest=${item#*:}; abi=${rest%%:*}; linker=${rest#*:}
  rustup target add "$target"
  env "CARGO_TARGET_$(printf '%s' "$target" | tr '[:lower:]-' '[:upper:]_')_LINKER=$TOOLCHAIN/$linker" cargo build --manifest-path "$CRATE/Cargo.toml" --release --target "$target"
  mkdir -p "$OUT/$abi"
  cp "$CRATE/target/$target/release/libmiki_native_core.so" "$OUT/$abi/libmiki_native_core.so"
done
