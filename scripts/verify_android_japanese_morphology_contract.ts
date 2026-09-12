import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const script = fs.readFileSync(path.join(root, 'scripts/install_android_japanese_morphology.sh'), 'utf8');
const plugin = fs.readFileSync(path.join(root, 'android-native/src/main/java/com/miki/ai/MIKIJapaneseMorphologyPlugin.kt'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'android-native/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/services/japaneseMorphologyService.ts'), 'utf8');

const required = [
  ['Sudachi Java 0.8.1', /sudachi:0\.8\.1/],
  ['SudachiDict 20260723', /DICT_VERSION="20260723"/],
  ['SudachiDict SHA-256 pin', /DICT_SHA256="b3869ce6b12b4bfa09575dc19030703bb669ab41bac12a74cafcbb28c6be2498"/],
  ['Native selfTest', /fun selfTest\(call: PluginCall\)/],
  ['JS selfTest bridge', /selfTest\(\): Promise/],
  ['Native Runner allow-list', /NativeTestAdapterRegistry/],
  ['Native Runner smoke adapter', /register\(\"android\.native_echo\"/],
  ['Native Runner plugin copy', /MIKINativeRunnerPlugin\.kt/],
] as const;

const failures = required.filter(([, re]) => !re.test(script + '\n' + plugin + '\n' + runner + '\n' + service));
if (failures.length) {
  console.error('Android Japanese morphology contract FAILED');
  for (const [name] of failures) console.error(`- ${name}`);
  process.exit(1);
}
console.log('Android Japanese morphology contract PASS');
console.log('Pinned: Sudachi Java 0.8.1 / SudachiDict core 20260723');
console.log('Native smoke-test endpoint: MIKIJapaneseMorphology.selfTest');
