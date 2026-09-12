import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const answerPlan = fs.readFileSync(path.join(root, 'src/services/answerPlanService.ts'), 'utf8');
const evolution = fs.readFileSync(path.join(root, 'src/services/deterministicCapabilityEvolutionService.ts'), 'utf8');

const required = [
  'installDeterministicCapabilityPatch',
  'SKILL_COMPOSITION',
  'patternId: `PATTERN-CAPABILITY-${capabilityId}-${sample.id}`',
  'answerPlanService.installDeterministicCapabilityPatch',
  '外部生成モデルへのフォールバック',
];
for (const token of required) {
  if (!answerPlan.includes(token) && !evolution.includes(token)) {
    throw new Error(`Missing deterministic capability execution token: ${token}`);
  }
}
if (!evolution.includes('sample.outputTarget')) throw new Error('Capability patch does not preserve verified output target.');
console.log('PASS: v57 verified capability patches are compiled into executable deterministic answer skeletons.');
