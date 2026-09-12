import fs from 'fs';
const svc = fs.readFileSync('src/services/counterexampleContractRefinementService.ts','utf8');
const recovery = fs.readFileSync('src/services/remediationFailureRecoveryService.ts','utf8');
const server = fs.readFileSync('server.ts','utf8');
const checks = [
 ['service exists', svc.includes('CounterexampleContractRefinementService')],
 ['counterexample extraction', svc.includes('extractMinimalClauses')],
 ['precondition invariant postcondition', svc.includes("'PRECONDITION'") && svc.includes("'INVARIANT'") && svc.includes("'POSTCONDITION'")],
 ['quarantine gate', svc.includes('QUARANTINED') && svc.includes('hasOverBroadClause')],
 ['normal compatibility regression gate', svc.includes('normalCasePassed') && svc.includes('compatibilityPassed') && svc.includes('regressionPassed')],
 ['learning continuum', svc.includes('mikiUnifiedLearningContinuumService.observe')],
 ['recovery wired', recovery.includes('counterexampleContractRefinementService.refine')],
 ['api list', server.includes("/api/miki/contract-refinement")],
 ['api validate', server.includes("/api/miki/contract-refinement/:id/validate")],
 ['no eval', !svc.includes('eval(')],
 ['no new Function', !svc.includes('new Function')],
 ['no Math.random', !svc.includes('Math.random')],
 ['deterministic hash', svc.includes('2166136261')],
 ['no direct component mutation', !svc.includes('componentRegistryService.registerComponent')],
 ['no automatic verified promotion', !svc.includes('status = \'VERIFIED\'')],
];
let pass=0; for(const [n,ok] of checks){ console.log(`${ok?'PASS':'FAIL'} ${n}`); if(ok) pass++; }
console.log(`RESULT ${pass}/${checks.length}`); process.exit(pass===checks.length?0:1);
