import assert from 'node:assert/strict';
import fs from 'node:fs';
import { unresolvedTaskErrors } from '../src/miki/core/services/taskBlackboardService.ts';

const read = (path) => fs.readFileSync(path, 'utf8');
const gate = read('src/miki/core/services/coreCompletionGateService.ts');
const planner = read('src/miki/core/services/adaptiveRoutePlannerService.ts');
const orchestrator = read('src/miki/core/services/coreOrchestratorService.ts');
const ingress = read('src/miki/core/services/coreTaskIngressService.ts');
const blackboard = read('src/miki/core/services/taskBlackboardService.ts');

function task(entries) {
  return { taskId: 'TASK-P291-TEST', goal: 'test', source: 'core', status: 'ROUTING', revision: 1,
    createdAt: 1, updatedAt: 1, visitedDomains: [], pendingDomains: [], entries,
    resumeCount: 0, lastCycle: 1 };
}
let entrySequence = 0;
function entry(kind, value, domain = 'research') {
  entrySequence += 1;
  return { id: `E-${entrySequence}`, taskId: 'TASK-P291-TEST', kind, domain, key: 'test', value,
    evidenceIds: [], createdAt: Date.now() };
}

// An error without an operation identity is not silently forgiven.
assert.equal(unresolvedTaskErrors(task([entry('ERROR', { error: 'unknown operation' })])).length, 1);
// A failed attempt stays unresolved until a later successful result explicitly supersedes it.
assert.equal(unresolvedTaskErrors(task([
  entry('ERROR', { operation: 'RUN_RESEARCH', operationInstanceId: 'OPI-1' }),
])).length, 1);
assert.equal(unresolvedTaskErrors(task([
  entry('ERROR', { operation: 'RUN_RESEARCH', operationInstanceId: 'OPI-1' }),
  entry('RESULT', { operation: 'RUN_RESEARCH', operationInstanceId: 'OPI-2',
    supersedesOperationInstanceIds: ['OPI-1'], reply: { status: 'SUCCEEDED', operationClass: 'BUSINESS' } }),
])).length, 0);
assert.equal(unresolvedTaskErrors(task([
  entry('ERROR', { operation: 'RUN_RESEARCH', operationInstanceId: 'OPI-1' }),
  entry('RESULT', { operation: 'OTHER', operationInstanceId: 'OPI-2',
    reply: { status: 'SUCCEEDED', operationClass: 'BUSINESS' } }),
])).length, 1);
assert.equal(unresolvedTaskErrors(task([
  entry('ERROR', { operation: 'RUN_RESEARCH', operationInstanceId: 'OPI-1' }),
  entry('RESULT', { operation: 'RUN_RESEARCH', operationInstanceId: 'OPI-1',
    reply: { status: 'SUCCEEDED', operationClass: 'BUSINESS' } }),
])).length, 0);

assert.match(gate, /const reviewPackageRequired=requiredOperations\.some\(operation=>operation\.operation==='CREATE_REVIEW_PACKAGE'\)/);
assert.match(gate, /businessCompletion:reasons\.length===0&&reviewPackageSatisfied/);
assert.match(planner, /operation==='EXECUTE_AUTONOMOUS_SEARCH'&&!this\.latestBusinessResult\(task,'RUN_RESEARCH'\)/);
assert.match(planner, /coreOwnedResearchOperations\.has\(operation\)&&!this\.latestBusinessResult\(task,'RUN_RESEARCH'\)/);
assert.match(planner, /supersedesOperationInstanceIds/);
assert.match(planner, /failedScope===operationScopeKey/);
assert.match(orchestrator, /finalizeConversationResponse\(taskId:string,response:unknown,validation:\{passed:boolean;failedReasons:string\[\]\}\)/);
assert.match(orchestrator, /const completed=validation\.passed&&completion\.businessCompletion/);
assert.match(orchestrator, /taskBlackboardService\.append\(taskId,'RESULT','core','conversationFinalResponse'/);
assert.match(orchestrator, /if\(!validation\.passed\)\{[\s\S]*?coreResultService\.fail/);
assert.match(ingress, /finalizeConversationResponse\(taskId,finalResponse,\{passed:answerValidationPassed,failedReasons:/);
assert.match(blackboard, /if\(this\.persistenceBlocked\)return/);
assert.match(blackboard, /BLACKBOARD_SNAPSHOT_NOT_ARRAY/);
assert.match(blackboard, /BLACKBOARD_ENTRY_RECORD_INVALID/);
assert.match(blackboard, /quarantineValue=.*raw/);

console.log(JSON.stringify({
  status: 'PASS',
  checks: 19,
  unresolvedErrorCases: 5,
  adaptiveCompletionRequiresReviewPackageOnlyWhenDeclared: true,
  successfulResearchDoesNotReenterInitialSearchRoute: true,
  answerFinalizationRequiresValidationAndCompletionGate: true,
}, null, 2));
