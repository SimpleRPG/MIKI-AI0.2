import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const files = [
  'src/services/autonomousGrowthGovernorService.ts',
  'src/services/simpleRpgCapabilityLearningService.ts',
  'src/services/simpleRpgRuleEngineService.ts',
  'server.ts'
];
for (const f of files) if (!fs.existsSync(path.join(root, f))) throw new Error(`missing ${f}`);
const governor = fs.readFileSync(path.join(root, 'src/services/autonomousGrowthGovernorService.ts'),'utf8');
const rpg = fs.readFileSync(path.join(root, 'src/services/simpleRpgRuleEngineService.ts'),'utf8');
if (/Math\.random\s*\(/.test(governor) || /eval\s*\(/.test(governor) || /new\s+Function\s*\(/.test(governor)) throw new Error('unsafe dynamic/random growth path');
if (/Math\.random\s*\(/.test(rpg) || /eval\s*\(/.test(rpg) || /new\s+Function\s*\(/.test(rpg)) throw new Error('unsafe RPG runtime');
if (!governor.includes('simpleRpgCapabilityLearningService.audit()')) throw new Error('missing RPG audit');
if (!governor.includes('capabilityGapService.getAllGaps()')) throw new Error('missing capability-gap observation');
if (!governor.includes('selfCodeArchitectService.runSelfCodeAudit()')) throw new Error('missing self-code audit');
if (!governor.includes('runAutonomousImprovementCycle')) throw new Error('missing gated improvement path');
console.log('PASS autonomous growth governor static boundary');
