import fs from 'fs';
const root = new URL('..', import.meta.url).pathname;
const svc = fs.readFileSync(`${root}/src/services/remediationExecutionCoordinatorService.ts`, 'utf8');
const server = fs.readFileSync(`${root}/server.ts`, 'utf8');
const bg = fs.readFileSync(`${root}/src/services/backgroundWorkerService.ts`, 'utf8');
const checks = [
 ['service exists', svc.includes('class RemediationExecutionCoordinatorService')],
 ['runner dispatch', svc.includes('executionRunnerService.markSubmitted')],
 ['regression only', svc.includes("event.test_category !== 'REGRESSION'")],
 ['event feedback', svc.includes("execution.completed") && svc.includes("execution.failed")],
 ['continuum feedback', svc.includes('mikiUnifiedLearningContinuumService.observe')],
 ['quarantine respected', svc.includes("record.status === 'QUARANTINED'")],
 ['no eval', !/\beval\s*\(/.test(svc)],
 ['no new Function', !/new\s+Function\s*\(/.test(svc)],
 ['no Math.random', !/Math\.random\s*\(/.test(svc)],
 ['dispatch API', server.includes("/api/miki/research-remediation/:id/dispatch")],
 ['queued dispatch API', server.includes('/api/miki/research-remediation/dispatch-queued')],
 ['startup wired', server.includes('remediationExecutionCoordinatorService.initialize()')],
 ['background wired', bg.includes('remediationExecutionCoordinatorService.dispatchQueued')],
];
let pass=0; for (const [name, ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(ok)pass++; }
console.log(`${pass}/${checks.length}`); process.exit(pass===checks.length?0:1);
