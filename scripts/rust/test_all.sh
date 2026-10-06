#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/native/miki-native-core"
command -v cargo >/dev/null 2>&1 || { echo 'CARGO_NOT_FOUND'; exit 127; }
cargo fmt --check
cargo test --all-targets
cargo clippy --all-targets -- -D warnings
cargo build --release
