#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
PLUGIN_SRC="$ROOT/android-native/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt"
PACKAGE_DIR="$ANDROID_DIR/app/src/main/java/com/miki/ai"
MAIN="$PACKAGE_DIR/MainActivity.java"
MAIN_KT="$PACKAGE_DIR/MainActivity.kt"

if [[ ! -d "$ANDROID_DIR" ]]; then
  echo "android/ がありません。先に npm run android:add を実行してください。"
  exit 2
fi
if [[ ! -f "$PLUGIN_SRC" ]]; then
  echo "Native Runner plugin source not found: $PLUGIN_SRC"
  exit 2
fi

mkdir -p "$PACKAGE_DIR"
cp "$PLUGIN_SRC" "$PACKAGE_DIR/MIKINativeRunnerPlugin.kt"

if [[ -f "$MAIN_KT" ]]; then
  if ! grep -q 'MIKINativeRunnerPlugin' "$MAIN_KT"; then
    python3 - "$MAIN_KT" <<'PY'
import sys
p=sys.argv[1]
s=open(p,encoding='utf-8').read()
if 'import com.getcapacitor.BridgeActivity' not in s:
    raise SystemExit('MainActivity.kt is not a standard Capacitor BridgeActivity; patch manually.')
s=s.replace('import com.getcapacitor.BridgeActivity', 'import com.getcapacitor.BridgeActivity\nimport com.miki.ai.MIKINativeRunnerPlugin')
s=s.replace('class MainActivity : BridgeActivity()', 'class MainActivity : BridgeActivity() {\n    override fun onCreate(savedInstanceState: android.os.Bundle?) {\n        super.onCreate(savedInstanceState)\n        registerPlugin(MIKINativeRunnerPlugin::class.java)\n    }\n}')
open(p,'w',encoding='utf-8').write(s)
PY
  fi
elif [[ -f "$MAIN" ]]; then
  if ! grep -q 'MIKINativeRunnerPlugin' "$MAIN"; then
    python3 - "$MAIN" <<'PY'
import sys
p=sys.argv[1]
s=open(p,encoding='utf-8').read()
if 'import com.getcapacitor.BridgeActivity;' not in s:
    raise SystemExit('MainActivity.java is not a standard Capacitor BridgeActivity; patch manually.')
s=s.replace('import com.getcapacitor.BridgeActivity;', 'import com.getcapacitor.BridgeActivity;\nimport com.miki.ai.MIKINativeRunnerPlugin;')
s=s.replace('public class MainActivity extends BridgeActivity {', 'public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        registerPlugin(MIKINativeRunnerPlugin.class);\n    }')
open(p,'w',encoding='utf-8').write(s)
PY
  fi
else
  echo "MainActivity.kt/java が見つかりません。pluginはコピーしましたが登録は手動で行ってください。"
  exit 3
fi

echo "MIKINativeRunnerPlugin installed. Run: npx cap sync android"
