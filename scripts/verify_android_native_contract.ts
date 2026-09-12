/**
 * P0-5 static contract check. This is NOT device verification.
 * It checks that the source contains the required safety boundaries and
 * that the JS/native request fields are aligned before GitHub Actions builds Android.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const js = fs.readFileSync(path.join(root, 'src/services/androidNativeRunnerAdapterService.ts'), 'utf8');
const kt = fs.readFileSync(path.join(root, 'android-native/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt'), 'utf8');
const reg = fs.readFileSync(path.join(root, 'src/services/componentRegistryService.ts'), 'utf8');

const required = [
  ['JS artifact_snapshot_key input', js.includes('artifact_snapshot_key: string;')],
  ['JS native platform gate', js.includes('Capacitor.isNativePlatform()')],
  ['JS hash equality check', js.includes('normalized.implementation_hash !== request.implementation_hash')],
  ['JS artifact equality check', js.includes('normalized.artifact_snapshot_key !== request.artifact_snapshot_key')],
  ['Native Android environment gate', kt.includes('environment != "ANDROID"')],
  ['Native adapter allow-list', kt.includes('NativeTestAdapterRegistry.find(componentId)')],
  ['Native smoke adapter', kt.includes('register("android.native_echo")')],
  ['No arbitrary process API', !/Runtime\.getRuntime\(\)|ProcessBuilder\(|\.exec\(/.test(kt)],
  ['Smoke component starts ANALYZED', reg.includes("componentId = 'android.native_echo'") && reg.includes("status: 'ANALYZED'")],
];

const failed = required.filter(([, ok]) => !ok);
for (const [name, ok] of required) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) process.exit(1);
console.log('STATIC_CONTRACT_ONLY: no DEVICE_TESTED/VERIFIED status is inferred from this check.');
