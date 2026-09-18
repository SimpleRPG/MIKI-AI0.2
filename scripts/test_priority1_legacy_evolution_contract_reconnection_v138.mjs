import fs from 'node:fs';
const bridge=fs.readFileSync('src/miki/core/services/legacyEvolutionCoreOperationService.ts','utf8');
const controller=fs.readFileSync('src/miki/improvement/services/selfImprovementControllerService.ts','utf8');
const checks=[
 ['input type derives from canonical method',bridge.includes('Parameters<typeof autonomousContinuousEvolutionService.runFullAutonomousCycle>[0]')],
 ['bridge forwards complete input unchanged',bridge.includes('runFullAutonomousCycle(input)')],
 ['bridge does not discard prompt',!bridge.includes('input.prompt')],
 ['bridge does not synthesize incompatible trigger',!bridge.includes('input.trigger')],
 ['controller forwards prompt',controller.includes('prompt: nextTarget.prompt')],
 ['controller forwards targetFile',controller.includes('targetFile: nextTarget.targetFile')],
 ['controller forwards reason',controller.includes('reason: nextTarget.reason')],
 ['controller has two bridge call sites',(controller.match(/legacyEvolutionCoreOperationService\.execute\(/g)||[]).length===2],
];
let failed=0;for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)failed++;}if(failed)process.exit(1);
