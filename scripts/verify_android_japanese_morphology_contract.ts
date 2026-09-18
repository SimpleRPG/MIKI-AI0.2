import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const script = fs.readFileSync(
  path.join(root, 'scripts/install_android_japanese_morphology.sh'),
  'utf8',
);

const plugin = fs.readFileSync(
  path.join(
    root,
    'android-native/src/main/java/com/miki/ai/MIKIJapaneseMorphologyPlugin.kt',
  ),
  'utf8',
);

const runner = fs.readFileSync(
  path.join(
    root,
    'android-native/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt',
  ),
  'utf8',
);

const service = fs.readFileSync(
  path.join(
    root,
    'src/miki/research/services/japaneseMorphologyService.ts',
  ),
  'utf8',
);

const required = [
  ['Sudachi Java 0.8.1', /sudachi:0\.8\.1/],
  ['SudachiDict 20260723', /DICT_VERSION="20260723"/],
  [
    'SudachiDict official core URL',
    /DICT_URL="https:\/\/d2ej7fkh96fzlu\.cloudfront\.net\/sudachidict\/sudachi-dictionary-\$\{DICT_VERSION\}-core\.zip"/,
  ],
  ['Sudachi core dictionary extraction', /system_core\.dic/],
  ['Native selfTest', /fun selfTest\(call: PluginCall\)/],
  ['JS selfTest bridge', /selfTest\(\): Promise/],
  ['Native Runner allow-list', /NativeTestAdapterRegistry/],
  ['Native Runner smoke adapter', /register\("android\.native_echo"/],
  ['Native Runner plugin copy', /MIKINativeRunnerPlugin\.kt/],
] as const;

const combined = `${script}\n${plugin}\n${runner}\n${service}`;

const failures = required.filter(([, re]) => !re.test(combined));

if (failures.length) {
  console.error('Android Japanese morphology contract FAILED');

  for (const [name] of failures) {
    console.error(`- ${name}`);
  }

  process.exit(1);
}

console.log('Android Japanese morphology contract PASS');
console.log('Pinned: Sudachi Java 0.8.1 / SudachiDict core 20260723');
console.log(
  'Native smoke-test endpoint: MIKIJapaneseMorphology.selfTest',
);
