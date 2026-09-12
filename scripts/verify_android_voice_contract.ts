import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const plugin = path.join(root, 'android-native/src/main/java/com/miki/ai/MIKISpeechRecognitionPlugin.kt');
const installer = path.join(root, 'scripts/install_android_japanese_morphology.sh');
const service = path.join(root, 'src/services/speechRecognitionService.ts');

for (const file of [plugin, installer, service]) {
  if (!fs.existsSync(file)) throw new Error(`missing voice contract file: ${file}`);
}
const p = fs.readFileSync(plugin, 'utf8');
const s = fs.readFileSync(service, 'utf8');
const i = fs.readFileSync(installer, 'utf8');
for (const token of ['MIKISpeechRecognition', 'USER_TRIGGERED', 'continuousListening', 'EXTRA_RESULTS']) {
  if (!p.includes(token) && !s.includes(token) && !i.includes(token)) throw new Error(`voice contract token missing: ${token}`);
}
if (!s.includes('verified: false')) throw new Error('speech observations must not be treated as verified truth');
if (!i.includes('MIKISpeechRecognitionPlugin.kt')) throw new Error('voice plugin is not installed by Android preparation script');
console.log('ANDROID_VOICE_CONTRACT_PASS');
