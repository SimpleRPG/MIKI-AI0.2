#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
SRC_DIR="$ROOT/android-native/src/main/java/com/miki/ai"
PACKAGE_DIR="$ANDROID_DIR/app/src/main/java/com/miki/ai"
MAIN_JAVA="$PACKAGE_DIR/MainActivity.java"
MAIN_KT="$PACKAGE_DIR/MainActivity.kt"
BUILD_GRADLE="$ANDROID_DIR/app/build.gradle"
MANIFEST="$ANDROID_DIR/app/src/main/AndroidManifest.xml"

if [[ ! -d "$ANDROID_DIR" ]]; then
  echo "android/ がありません。先に npx cap add android を実行してください。"
  exit 2
fi

mkdir -p "$PACKAGE_DIR"

# 1. プラグインおよびWorkerのソースをコピー
cp "$SRC_DIR/MikiBackgroundWorker.kt" "$PACKAGE_DIR/MikiBackgroundWorker.kt"
cp "$SRC_DIR/MikiWorkManagerPlugin.kt" "$PACKAGE_DIR/MikiWorkManagerPlugin.kt"
echo "Copied MikiBackgroundWorker.kt and MikiWorkManagerPlugin.kt to $PACKAGE_DIR"

# 2. MainActivity へのプラグイン登録
if [[ -f "$MAIN_KT" ]]; then
  if ! grep -q 'MikiWorkManagerPlugin' "$MAIN_KT"; then
    python3 - "$MAIN_KT" <<'PY'
import sys
p=sys.argv[1]
s=open(p,encoding='utf-8').read()
if 'import com.miki.ai.MikiWorkManagerPlugin' not in s:
    s=s.replace('import com.getcapacitor.BridgeActivity', 'import com.getcapacitor.BridgeActivity\nimport com.miki.ai.MikiWorkManagerPlugin')
if 'registerPlugin(MikiWorkManagerPlugin::class.java)' not in s:
    if 'override fun onCreate' in s:
        s=s.replace('super.onCreate(savedInstanceState)', 'super.onCreate(savedInstanceState)\n        registerPlugin(MikiWorkManagerPlugin::class.java)')
    else:
        s=s.replace('class MainActivity : BridgeActivity() {', 'class MainActivity : BridgeActivity() {\n    override fun onCreate(savedInstanceState: android.os.Bundle?) {\n        super.onCreate(savedInstanceState)\n        registerPlugin(MikiWorkManagerPlugin::class.java)\n    }\n}')
open(p,'w',encoding='utf-8').write(s)
PY
  fi
elif [[ -f "$MAIN_JAVA" ]]; then
  if ! grep -q 'MikiWorkManagerPlugin' "$MAIN_JAVA"; then
    python3 - "$MAIN_JAVA" <<'PY'
import sys
p=sys.argv[1]
s=open(p,encoding='utf-8').read()
if 'import com.miki.ai.MikiWorkManagerPlugin;' not in s:
    s=s.replace('import com.getcapacitor.BridgeActivity;', 'import com.getcapacitor.BridgeActivity;\nimport com.miki.ai.MikiWorkManagerPlugin;')
if 'registerPlugin(MikiWorkManagerPlugin.class);' not in s:
    if 'onCreate' in s:
        s=s.replace('super.onCreate(savedInstanceState);', 'super.onCreate(savedInstanceState);\n        registerPlugin(MikiWorkManagerPlugin.class);')
    else:
        s=s.replace('public class MainActivity extends BridgeActivity {', 'public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        registerPlugin(MikiWorkManagerPlugin.class);\n    }')
        s=s.replace('public class MainActivity extends BridgeActivity {}', 'public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        registerPlugin(MikiWorkManagerPlugin.class);\n    }\n}')
open(p,'w',encoding='utf-8').write(s)
PY
  fi
fi
echo "Registered MikiWorkManagerPlugin in MainActivity."

# 3. WorkManager 依存関係を app/build.gradle に追加
WORK_DEP='    implementation "androidx.work:work-runtime-ktx:2.10.0"'
if [[ -f "$BUILD_GRADLE" ]] && ! grep -q "androidx.work:work-runtime" "$BUILD_GRADLE"; then
  python3 - "$BUILD_GRADLE" <<'PY'
import sys
p=sys.argv[1]
s=open(p,encoding='utf-8').read()
dep='    implementation "androidx.work:work-runtime-ktx:2.10.0"\n'
if 'dependencies {' in s:
    s=s.replace('dependencies {', 'dependencies {\n' + dep, 1)
    open(p,'w',encoding='utf-8').write(s)
PY
  echo "Added androidx.work:work-runtime-ktx to build.gradle"
fi

# 4. AndroidManifest.xml にパーミッションを追加
if [[ -f "$MANIFEST" ]]; then
  python3 - "$MANIFEST" <<'PY'
import sys
p=sys.argv[1]
s=open(p,encoding='utf-8').read()
perms = [
    '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
    '<uses-permission android:name="android.permission.WAKE_LOCK" />',
    '<uses-permission android:name="android.permission.BATTERY_STATS" />'
]
added = False
for perm in perms:
    if perm not in s:
        s = s.replace('</manifest>', '    ' + perm + '\n</manifest>')
        added = True
if added:
    open(p,'w',encoding='utf-8').write(s)
PY
  echo "Updated AndroidManifest.xml with required WorkManager permissions."
fi

echo "MikiWorkManagerPlugin installation completed successfully."
