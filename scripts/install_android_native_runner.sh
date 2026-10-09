#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
PACKAGE_DIR="$ANDROID_DIR/app/src/main/java/com/miki/ai"
RUNNER="$PACKAGE_DIR/MIKINativeRunnerPlugin.kt"
CORE="$PACKAGE_DIR/MIKINativeCore.kt"

if [[ ! -d "$ANDROID_DIR" ]]; then
  echo "android/ がありません。Androidプロジェクトを先に用意してください。" >&2
  exit 2
fi

# The checked-in android/app source is the canonical Rust-enabled runner.
# android-native/MIKINativeRunnerPlugin.kt is a smaller legacy adapter and
# must never overwrite this file.
[[ -f "$RUNNER" ]] || { echo "CANONICAL_NATIVE_RUNNER_MISSING: $RUNNER" >&2; exit 3; }
[[ -f "$CORE" ]] || { echo "CANONICAL_NATIVE_CORE_MISSING: $CORE" >&2; exit 4; }
grep -Fq 'fun decideCoreGoals(call: PluginCall)' "$RUNNER" || { echo "CORE_DECISION_PLUGIN_METHOD_MISSING" >&2; exit 5; }
grep -Fq 'fun rankDomainRoutes(call: PluginCall)' "$RUNNER" || { echo "DOMAIN_ROUTE_PLUGIN_METHOD_MISSING" >&2; exit 6; }
grep -Fq 'fun decideCoreGoals(requestJson: String)' "$CORE" || { echo "CORE_DECISION_NATIVE_BRIDGE_MISSING" >&2; exit 7; }

MAIN_KT=$(find "$ANDROID_DIR/app/src/main/java" -name MainActivity.kt -print -quit || true)
MAIN_JAVA=$(find "$ANDROID_DIR/app/src/main/java" -name MainActivity.java -print -quit || true)
MAIN="${MAIN_KT:-$MAIN_JAVA}"
[[ -n "$MAIN" && -f "$MAIN" ]] || { echo "MAIN_ACTIVITY_NOT_FOUND" >&2; exit 8; }
if ! grep -Fq 'registerPlugin(MIKINativeRunnerPlugin.class)' "$MAIN" \
  && ! grep -Fq 'registerPlugin(MIKINativeRunnerPlugin::class.java)' "$MAIN"; then
  echo "MIKINativeRunnerPlugin is not registered in MainActivity: $MAIN" >&2
  exit 9
fi

echo "MIKINativeRunner verified: canonical Rust-enabled implementation preserved; no legacy overwrite performed."
echo "Run npx cap sync android after updating Web assets if required."
