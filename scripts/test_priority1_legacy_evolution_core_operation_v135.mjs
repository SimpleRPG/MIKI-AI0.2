import fs from 'node:fs';

const controller = fs.readFileSync('src/miki/improvement/services/selfImprovementControllerService.ts', 'utf8');
const coreOperation = fs.readFileSync('src/miki/core/services/legacyEvolutionCoreOperationService.ts', 'utf8');
const sourceFiles = fs.readdirSync('src/miki/core/services');

const checks = [
  ['controller does not import legacy evolution runtime', !controller.includes("autonomy/services/autonomousContinuousEvolutionService")],
  ['controller does not call runFullAutonomousCycle', !controller.includes('runFullAutonomousCycle')],
  ['controller delegates to core operation', controller.includes('legacyEvolutionCoreOperationService.execute')],
  ['core operation owns the legacy runtime bridge', coreOperation.includes('autonomousContinuousEvolutionService.runFullAutonomousCycle')],
  ['core operation file is registered in core services', sourceFiles.includes('legacyEvolutionCoreOperationService.ts')],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}
if (failed) process.exit(1);
