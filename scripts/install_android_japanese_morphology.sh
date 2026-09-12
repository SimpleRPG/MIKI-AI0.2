#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
PLUGIN_SRC="$ROOT/android-native/src/main/java/com/miki/ai/MIKIJapaneseMorphologyPlugin.kt"
NATIVE_RUNNER_SRC="$ROOT/android-native/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt"
SPEECH_SRC="$ROOT/android-native/src/main/java/com/miki/ai/MIKISpeechRecognitionPlugin.kt"
ASSET_SRC="$ROOT/android-native/src/main/assets/system_core.dic"
PACKAGE_DIR="$ANDROID_DIR/app/src/main/java/com/miki/ai"
ASSET_DIR="$ANDROID_DIR/app/src/main/assets"
BUILD_GRADLE="$ANDROID_DIR/app/build.gradle"
BUILD_GRADLE_KTS="$ANDROID_DIR/app/build.gradle.kts"
[[ -d "$ANDROID_DIR" ]] || { echo "android/ がありません。先に npx cap add android"; exit 2; }
mkdir -p "$PACKAGE_DIR" "$ASSET_DIR"
cp "$PLUGIN_SRC" "$PACKAGE_DIR/MIKIJapaneseMorphologyPlugin.kt"
cp "$NATIVE_RUNNER_SRC" "$PACKAGE_DIR/MIKINativeRunnerPlugin.kt"
cp "$SPEECH_SRC" "$PACKAGE_DIR/MIKISpeechRecognitionPlugin.kt"
# The dictionary is a build input, not committed binary data. Pin the known
# SudachiDict release so APK builds remain reproducible.
DICT_VERSION="20260723"
DICT_SHA256="b3869ce6b12b4bfa09575dc19030703bb669ab41bac12a74cafcbb28c6be2498"
DICT_PACKAGE="sudachidict_core==${DICT_VERSION}"
if [[ ! -f "$ASSET_SRC" ]]; then
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  python3 -m pip download --no-deps --only-binary=:all: "$DICT_PACKAGE" -d "$TMP" >/dev/null
  WHEEL=$(find "$TMP" -maxdepth 1 -name "sudachidict_core-${DICT_VERSION}-*.whl" -print -quit)
  [[ -n "$WHEEL" ]] || { echo "SudachiDict wheel not found"; exit 3; }
  ACTUAL_SHA256=$(sha256sum "$WHEEL" | awk '{print $1}')
  [[ "$ACTUAL_SHA256" == "$DICT_SHA256" ]] || { echo "SudachiDict SHA-256 mismatch: $ACTUAL_SHA256"; exit 4; }
  unzip -j -o "$WHEEL" '*/resources/system_core.dic' -d "$TMP/extracted" >/dev/null
  cp "$TMP/extracted/system_core.dic" "$ASSET_SRC"
fi
cp "$ASSET_SRC" "$ASSET_DIR/system_core.dic"
DEP="com.worksap.nlp:sudachi:0.8.1"
if [[ -f "$BUILD_GRADLE" ]] && ! grep -q "$DEP" "$BUILD_GRADLE"; then
  python3 - "$BUILD_GRADLE" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read(); dep='    implementation "com.worksap.nlp:sudachi:0.8.1"\n'
if 'dependencies {' in s: s=s.replace('dependencies {','dependencies {\n'+dep,1)
else: raise SystemExit('dependencies block not found')
open(p,'w',encoding='utf-8').write(s)
PY
elif [[ -f "$BUILD_GRADLE_KTS" ]] && ! grep -q "$DEP" "$BUILD_GRADLE_KTS"; then
  python3 - "$BUILD_GRADLE_KTS" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read(); dep='    implementation("com.worksap.nlp:sudachi:0.8.1")\n'
if 'dependencies {' in s: s=s.replace('dependencies {','dependencies {\n'+dep,1)
else: raise SystemExit('dependencies block not found')
open(p,'w',encoding='utf-8').write(s)
PY
fi
# Capacitor generates MainActivity under the application package (which may not be com/miki/ai).
# Discover it instead of assuming the plugin package equals the app package.
MAIN_KT=$(find "$ANDROID_DIR/app/src/main/java" -name MainActivity.kt -print -quit || true)
MAIN_JAVA=$(find "$ANDROID_DIR/app/src/main/java" -name MainActivity.java -print -quit || true)
if [[ -n "$MAIN_KT" ]]; then
python3 - "$MAIN_KT" <<'PY2'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
if 'import com.miki.ai.MIKINativeRunnerPlugin' not in s:
    s=s.replace('import com.getcapacitor.BridgeActivity','import com.getcapacitor.BridgeActivity\nimport com.miki.ai.MIKINativeRunnerPlugin')
if 'import com.miki.ai.MIKIJapaneseMorphologyPlugin' not in s:
    s=s.replace('import com.getcapacitor.BridgeActivity','import com.getcapacitor.BridgeActivity\nimport com.miki.ai.MIKIJapaneseMorphologyPlugin')
if 'import com.miki.ai.MIKISpeechRecognitionPlugin' not in s:
    s=s.replace('import com.getcapacitor.BridgeActivity','import com.getcapacitor.BridgeActivity\nimport com.miki.ai.MIKISpeechRecognitionPlugin')
for needle in ['registerPlugin(MIKINativeRunnerPlugin::class.java)','registerPlugin(MIKIJapaneseMorphologyPlugin::class.java)','registerPlugin(MIKISpeechRecognitionPlugin::class.java)']:
    if needle not in s:
        s=s.replace('super.onCreate(savedInstanceState)', 'super.onCreate(savedInstanceState)\n        '+needle)
open(p,'w',encoding='utf-8').write(s)
PY2
elif [[ -n "$MAIN_JAVA" ]]; then
python3 - "$MAIN_JAVA" <<'PY2'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
if 'import com.miki.ai.MIKINativeRunnerPlugin' not in s:
    s=s.replace('import com.getcapacitor.BridgeActivity;', 'import com.getcapacitor.BridgeActivity;\nimport com.miki.ai.MIKINativeRunnerPlugin;')
if 'import com.miki.ai.MIKIJapaneseMorphologyPlugin' not in s:
    s=s.replace('import com.getcapacitor.BridgeActivity;', 'import com.getcapacitor.BridgeActivity;\nimport com.miki.ai.MIKIJapaneseMorphologyPlugin;')
if 'import com.miki.ai.MIKISpeechRecognitionPlugin' not in s:
    s=s.replace('import com.getcapacitor.BridgeActivity;', 'import com.getcapacitor.BridgeActivity;\nimport com.miki.ai.MIKISpeechRecognitionPlugin;')
for needle in ['registerPlugin(MIKINativeRunnerPlugin.class);','registerPlugin(MIKIJapaneseMorphologyPlugin.class);','registerPlugin(MIKISpeechRecognitionPlugin.class);']:
    if needle not in s:
        s=s.replace('super.onCreate(savedInstanceState);', 'super.onCreate(savedInstanceState);\n        '+needle)
open(p,'w',encoding='utf-8').write(s)
PY2
else
  echo "WARNING: Capacitor MainActivity was not found; plugin registration must be verified after cap add android."
fi

# Voice input uses Android Speech Recognition only after an explicit user tap.
MANIFEST="$ANDROID_DIR/app/src/main/AndroidManifest.xml"
if [[ -f "$MANIFEST" ]] && ! grep -q 'android.permission.RECORD_AUDIO' "$MANIFEST"; then
  python3 - "$MANIFEST" <<'PYMANIFEST'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
needle='<manifest '
idx=s.find('>', s.find(needle))
if idx < 0: raise SystemExit('manifest tag not found')
s=s[:idx+1]+'\n    <uses-permission android:name="android.permission.RECORD_AUDIO" />'+s[idx+1:]
open(p,'w',encoding='utf-8').write(s)
PYMANIFEST
fi
echo "MIKI Japanese morphology + voice input plugins installed. Sudachi 0.8.1 + SudachiDict 20260723-core required."
