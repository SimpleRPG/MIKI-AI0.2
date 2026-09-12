import fs from 'fs';
import path from 'path';
const root = process.argv[2] || process.cwd();
const svc = fs.readFileSync(path.join(root,'src/services/researchToRemediationService.ts'),'utf8');
const reval = fs.readFileSync(path.join(root,'src/services/autonomousRevalidationLoopService.ts'),'utf8');
const server = fs.readFileSync(path.join(root,'server.ts'),'utf8');
const checks = [
 ['service exists', svc.includes('class ResearchToRemediationService')],
 ['verified claim gate', svc.includes('result.resolved') && svc.includes('v.promoted')],
 ['no direct verified promotion', !svc.includes("status = 'VERIFIED'")],
 ['regression queue', svc.includes('componentRegressionService.plan')],
 ['confidence gate', svc.includes('confidence.revalidationRequired')],
 ['contradiction quarantine', svc.includes("'QUARANTINED'") && svc.includes('異なる検証済みClaim')],
 ['unified continuum feedback', svc.includes('mikiUnifiedLearningContinuumService.observe')],
 ['revalidation wired', reval.includes('researchToRemediationService.process')],
 ['API list', server.includes("/api/miki/research-remediation")],
 ['API refresh', server.includes("/api/miki/research-remediation/:id")],
 ['no eval', !svc.includes('eval(')],
 ['no new Function', !svc.includes('new Function')],
 ['no Math.random', !svc.includes('Math.random')],
];
let pass=0; for (const [n,ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${n}`); if(ok) pass++; }
console.log(`RESULT ${pass}/${checks.length}`); process.exit(pass===checks.length?0:1);
