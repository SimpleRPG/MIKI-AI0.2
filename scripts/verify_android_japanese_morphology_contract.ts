import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const script = read('scripts/install_android_japanese_morphology.sh');
const runnerInstaller = read('scripts/install_android_native_runner.sh');
const plugin = read('android-native/src/main/java/com/miki/ai/MIKIJapaneseMorphologyPlugin.kt');
const appPlugin = read('android/app/src/main/java/com/miki/ai/MIKIJapaneseMorphologyPlugin.kt');
const runner = read('android/app/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt');
const nativeCore = read('android/app/src/main/java/com/miki/ai/MIKINativeCore.kt');
const service = read('src/miki/research/services/japaneseMorphologyService.ts');
const guide = read('docs/JAPANESE_MORPHOLOGY_SUDACHI_ANDROID.md');

const required: Array<[string, boolean]> = [
  ['Sudachi Java 0.8.1', /sudachi:0\.8\.1/.test(script)],
  ['SudachiDict 20260723', /DICT_VERSION="20260723"/.test(script)],
  ['SudachiDict official core URL', /DICT_URL="https:\/\/d2ej7fkh96fzlu\.cloudfront\.net\/sudachidict\/sudachi-dictionary-\$\{DICT_VERSION\}-core\.zip"/.test(script)],
  ['Sudachi core dictionary extraction', /system_core\.dic/.test(script)],
  ['Native selfTest', /fun selfTest\(call: PluginCall\)/.test(plugin)],
  ['JS selfTest bridge', /selfTest\(\): Promise/.test(service)],
  ['Native Runner allow-list remains available', /NativeTestAdapterRegistry/.test(runner)],
  ['Native Runner smoke adapter remains available', /register\("android\.native_echo"/.test(runner)],
  ['Android morphology uses filesystem anchor', /PathAnchor\.filesystem\(context\.filesDir\.absolutePath\)/.test(plugin) && /PathAnchor\.filesystem\(context\.filesDir\.absolutePath\)/.test(appPlugin)],
  ['Neither morphology source uses PathAnchor.none', !plugin.includes('PathAnchor.none()') && !appPlugin.includes('PathAnchor.none()')],
  ['Empty dictionary is rejected/reacquired', plugin.includes('SUDACHI_SYSTEM_DICTIONARY_MISSING_OR_EMPTY') && appPlugin.includes('SUDACHI_SYSTEM_DICTIONARY_MISSING_OR_EMPTY')],
  ['Canonical Runner goal decision method exists', runner.includes('fun decideCoreGoals(call: PluginCall)') && nativeCore.includes('fun decideCoreGoals(requestJson: String)')],
  ['Morphology installer does not copy stale Runner template', !script.includes('NATIVE_RUNNER_SRC') && !script.includes('cp "$NATIVE_RUNNER_SRC" "$PACKAGE_DIR/MIKINativeRunnerPlugin.kt"')],
  ['Native Runner installer does not copy stale Runner template', !runnerInstaller.includes('cp "$PLUGIN_SRC" "$PACKAGE_DIR/MIKINativeRunnerPlugin.kt"')],
  ['Guide documents current pinned version', guide.includes('0.8.1') && guide.includes('20260723-core') && !guide.includes('20240409-core')],
];

const failed = required.filter(([, ok]) => !ok);
for (const [name, ok] of required) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) process.exit(1);
console.log('ANDROID_MORPHOLOGY_STATIC_CONTRACT_PASS');
