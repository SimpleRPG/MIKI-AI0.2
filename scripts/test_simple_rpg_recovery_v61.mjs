import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ref = path.join(root, 'reference', 'simple-rpg');
const adapter = path.join(root, 'src', 'services', 'simpleRpgReferenceService.ts');
const core = path.join(root, 'src', 'services', 'nonLlmCoreService.ts');

const required = ['index.html', 'game-core-1.js', 'game-core-5.js', 'craft-core.js', 'market-core1.js', 'save-system.js', 'teto-ai.js', 'teto-ai4.js'];
for (const f of required) {
  if (!fs.existsSync(path.join(ref, f))) throw new Error(`missing recovered SimpleRPG source: ${f}`);
}
const a = fs.readFileSync(adapter, 'utf8');
const c = fs.readFileSync(core, 'utf8');
for (const needle of ['executableInMiki: false', 'simple_rpg_market', 'simple_rpg_teto', 'recordReferenceUse']) {
  if (!a.includes(needle)) throw new Error(`adapter boundary missing: ${needle}`);
}
if (!c.includes("simpleRpgReferenceService.describeForPlanning(prompt)")) throw new Error('NonLlmCore is not connected to SimpleRPG reference planning');
if (!c.includes('simpleRpgReferenceService.recordReferenceUse')) throw new Error('SimpleRPG reference usage is not recorded');
if (/from ['\"]\.\/reference\/simple-rpg/.test(a)) throw new Error('reference sources must not be runtime-imported');
if (/eval\s*\(|new Function\s*\(/.test(a)) throw new Error('dynamic execution detected in reference adapter');
console.log('PASS: v61 recovered SimpleRPG assets are indexed as non-executable deterministic reference capabilities.');
