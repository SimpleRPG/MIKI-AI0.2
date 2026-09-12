import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const service = read('src/services/remediationFailureRecoveryService.ts');
const failure = read('src/services/failureUnderstandingService.ts');
const server = read('server.ts');
const worker = read('src/services/backgroundWorkerService.ts');
const remediation = read('src/services/researchToRemediationService.ts');

const checks = [
  ['service exists', service.includes('class RemediationFailureRecoveryService')],
  ['failure creates new gap', service.includes("knowledgeGapService.detect") && service.includes("type: 'WEAK_COMPONENT'")],
  ['fresh web re-research', service.includes("forceRoute: 'WEB_SEARCH'") && service.includes('requireFresh: true') && service.includes('maxPasses: 3')],
  ['verified boundary retained', service.includes('verification.promoted') && service.includes('verifiedKnowledgePromotionService.promote')],
  ['research reconnects to remediation', service.includes('researchToRemediationService.process(gap, result, event.environment)')],
  ['quarantine after bounded retries', service.includes('maxAttempts = 3') && service.includes("status: 'QUARANTINED'")],
  ['regression request binding checked', service.includes('componentRegressionService.get(suiteId)') && service.includes('suite.request_ids.includes(requestId)')],
  ['unified learning feedback', service.includes('mikiUnifiedLearningContinuumService.observe')],
  ['no eval', !service.includes('eval(') && !service.includes('eval (')],
  ['no new Function', !service.includes('new Function')],
  ['no Math.random', !service.includes('Math.random')],
  ['server API wired', server.includes("/api/miki/remediation-recovery") && server.includes('remediationFailureRecoveryService.initialize()')],
  ['background wired', worker.includes('remediationFailureRecoveryService')],
  ['failure understanding feeds remediation', failure.includes('researchToRemediationService.process(gap, result, event.environment)')],
  ['remediation refuses unverified results', remediation.includes('if (!result.resolved || promoted.length === 0) return undefined;')],
];
let pass=0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if(ok) pass++; }
console.log(`RESULT ${pass}/${checks.length}`);
if(pass !== checks.length) process.exit(1);
