import fs from 'node:fs';
const registry=fs.readFileSync('src/miki/core/services/coreOperationRegistryService.ts','utf8');
const bridge=fs.readFileSync('src/miki/core/services/legacyEvolutionCoreOperationService.ts','utf8');
const checks=[
 ['registry owns operation contracts',registry.includes('CoreOperationContract')&&registry.includes('register<Input, Output>')],
 ['duplicate registration fails closed',registry.includes('CORE_OPERATION_ALREADY_REGISTERED')],
 ['missing operation fails closed',registry.includes('CORE_OPERATION_NOT_REGISTERED')],
 ['legacy operation has stable id',bridge.includes("core.selfImprovement.legacyEvolution")],
 ['legacy operation is registered',bridge.includes('coreOperationRegistryService.register(legacyEvolutionContract)')],
 ['controller-facing execute resolves registry',bridge.includes('coreOperationRegistryService.get<LegacyEvolutionOperationInput, LegacyEvolutionOperationOutput>')],
 ['contract declares owner domain',bridge.includes("ownerDomain: 'self_improvement'")],
 ['contract requires receipt',bridge.includes('receiptRequired: true')],
 ['contract declares failure and resume',bridge.includes("failureState: 'FAILED'")&&bridge.includes('resumeCondition:')],
 ['runtime call exists only in registered contract', (bridge.match(/runFullAutonomousCycle\(/g)||[]).length===1],
];
let failed=0;for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)failed++;}if(failed)process.exit(1);
