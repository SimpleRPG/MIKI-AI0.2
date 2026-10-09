/**
 * Static native boundary checks. This is NOT device verification.
 * The android/app Native Runner is the canonical Rust-enabled plugin. The
 * android-native runner is only a limited seed/legacy adapter and must not
 * overwrite the canonical implementation during build preparation.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const js = read('src/miki/execution/services/androidNativeRunnerAdapterService.ts');
const template = read('android-native/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt');
const runtime = read('android/app/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt');
const nativeCore = read('android/app/src/main/java/com/miki/ai/MIKINativeCore.kt');
const main = read('android/app/src/main/java/com/miki/ai/MainActivity.java');
const reg = read('src/miki/capability/services/componentRegistryService.ts');
const morphologyInstaller = read('scripts/install_android_japanese_morphology.sh');
const runnerInstaller = read('scripts/install_android_native_runner.sh');
const workmanagerInstaller = read('scripts/install_android_workmanager.sh');
const workmanagerRuntime = read('android/app/src/main/java/com/miki/ai/MikiWorkManagerPlugin.kt');

const required: Array<[string, boolean]> = [
  ['JS artifact_snapshot_key input', js.includes('artifact_snapshot_key: string;')],
  ['JS native platform gate', js.includes('Capacitor.isNativePlatform()')],
  ['JS hash equality check', js.includes('normalized.implementation_hash !== request.implementation_hash')],
  ['JS artifact equality check', js.includes('normalized.artifact_snapshot_key !== request.artifact_snapshot_key')],
  ['Native Android environment gate', template.includes('environment != "ANDROID"')],
  ['Native adapter allow-list', template.includes('NativeTestAdapterRegistry.find(componentId)')],
  ['Native smoke adapter', template.includes('register("android.native_echo")')],
  ['No arbitrary process API', !/Runtime\.getRuntime\(\)|ProcessBuilder\(|\.exec\(/.test(template)],
  ['Smoke component starts ANALYZED', reg.includes("componentId = 'android.native_echo'") && reg.includes("status: 'ANALYZED'")],
  ['Canonical Android Runner has Rust decision bridge', runtime.includes('fun decideCoreGoals(call: PluginCall)')],
  ['Canonical Android Runner has route-ranking bridge', runtime.includes('fun rankDomainRoutes(call: PluginCall)')],
  ['Native Core exposes goal decision wrapper', nativeCore.includes('fun decideCoreGoals(requestJson: String)') && nativeCore.includes('nativeDecideCoreGoals')],
  ['MainActivity registers canonical Runner', main.includes('registerPlugin(MIKINativeRunnerPlugin.class)')],
  ['Morphology installer cannot overwrite Runner', !morphologyInstaller.includes('cp "$NATIVE_RUNNER_SRC" "$PACKAGE_DIR/MIKINativeRunnerPlugin.kt"')],
  ['Runner installer cannot overwrite Runner', !runnerInstaller.includes('cp "$PLUGIN_SRC" "$PACKAGE_DIR/MIKINativeRunnerPlugin.kt"')],
  ['Morphology installer guards canonical decision methods', morphologyInstaller.includes(`grep -Fq 'fun decideCoreGoals(call: PluginCall)' "$RUNNER_TARGET"`)],
  ['Canonical WorkManager preserves browser E2E endpoint', workmanagerRuntime.includes('fun runCandidateBrowserE2E(call: PluginCall)')],
  ['WorkManager installer does not overwrite canonical plugin', !workmanagerInstaller.includes('cp "$SRC_DIR/MikiWorkManagerPlugin.kt" "$PACKAGE_DIR/MikiWorkManagerPlugin.kt"')],
  ['WorkManager installer validates canonical plugin', workmanagerInstaller.includes('fun runCandidateBrowserE2E(call: PluginCall)') && workmanagerInstaller.includes('fun fetchRenderedPage(call: PluginCall)')],
];

const failed = required.filter(([, ok]) => !ok);
for (const [name, ok] of required) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) process.exit(1);
console.log('STATIC_CONTRACT_ONLY: no DEVICE_TESTED/VERIFIED status is inferred from this check.');
