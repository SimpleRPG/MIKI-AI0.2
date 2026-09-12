import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const service = path.join(root, 'src/services/deterministicCapabilityExecutionService.ts');
const core = path.join(root, 'src/services/nonLlmCoreService.ts');
const text = fs.readFileSync(service, 'utf8');
const coreText = fs.readFileSync(core, 'utf8');

const required = [
  'composeFromComponentIds',
  'componentCompositionService.compose',
  "status !== 'VERIFIED'",
  'assessRisk',
  'startFromRequest',
];
for (const token of required) if (!text.includes(token)) throw new Error(`missing execution gate: ${token}`);
if (!coreText.includes('deterministicCapabilityExecutionService.prepareAndStart')) throw new Error('NonLlmCore is not wired to deterministic capability execution');
if (text.includes('eval(') || text.includes('new Function(')) throw new Error('dynamic code execution detected');
console.log('PASS: v59 deterministic capability execution boundary is wired and guarded.');
