import { strict as assert } from 'node:assert';
import {
  isVerifiedTaskOutcome,
  type BlackboardEntry,
  type BlackboardTask,
} from '../src/miki/core/services/taskBlackboardService';
import { developmentLifecycleStateMachineService } from '../src/miki/selfDevelopment/services/developmentLifecycleStateMachineService';
import type { UnifiedDevelopmentRequest } from '../src/miki/selfDevelopment/services/unifiedDevelopmentRequestModel';

function entry(
  kind: BlackboardEntry['kind'],
  key: string,
  value: unknown,
  evidenceIds: string[] = [],
): BlackboardEntry {
  return {
    id: `ENTRY-${key}`,
    taskId: 'TASK-ROUTE-TEST',
    kind,
    domain: 'core',
    key,
    value,
    evidenceIds,
    createdAt: 1,
  };
}

function task(
  status: BlackboardTask['status'],
  entries: BlackboardEntry[],
): BlackboardTask {
  return {
    taskId: 'TASK-ROUTE-TEST',
    goal: 'verify task outcome policy',
    source: 'core',
    status,
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
    visitedDomains: ['core'],
    pendingDomains: [],
    entries,
    resumeCount: 0,
    lastCycle: 1,
  };
}

const passed = entry('RESULT', 'validation:browser-e2e', { passed: true }, ['evidence:test']);
const failed = entry('RESULT', 'validation:browser-e2e', { passed: false }, ['evidence:test']);
const nameOnly = entry('RESULT', 'validation:browser-e2e', 'PASSED', ['evidence:test']);

assert.equal(isVerifiedTaskOutcome(task('COMPLETED', [passed])), true);
assert.equal(isVerifiedTaskOutcome(task('COMPLETED', [failed])), false,
  'a validation result named validation must not be verified when passed=false');
assert.equal(isVerifiedTaskOutcome(task('COMPLETED', [nameOnly])), false,
  'a result label or free-text PASSED is not explicit structured validation');
assert.equal(isVerifiedTaskOutcome(task('ROUTING', [passed])), false,
  'a positive result cannot verify a task that has not completed');
assert.equal(isVerifiedTaskOutcome(task('COMPLETED', [
  entry('ERROR', 'validation:error', { message: 'unrecovered failure' }),
  passed,
])), false, 'an unresolved ERROR blocks verified outcome feedback');

const recoveredError = entry('ERROR', 'validation:error', {
  operationInstanceId: 'operation-1',
  message: 'first execution failed',
});
const recoveryReceipt = entry('RESULT', 'operation-recovery', {
  status: 'SUCCESS',
  operationInstanceId: 'operation-1',
}, ['evidence:recovery']);
assert.equal(
  isVerifiedTaskOutcome(task('COMPLETED', [recoveredError, recoveryReceipt, passed])),
  true,
  'a failed operation may be recovered by a later successful receipt for the same operation',
);

const failedInstruction = {
  instructionId: 'INST-RECOVERY-TEST',
  instructionText: 'Correct the failed implementation and retry validation.',
  instructionSource: 'WORK_INSTRUCTION',
  targetPaths: ['src/example.ts'],
  state: 'PROMOTION_FAILED',
  evidenceIds: [],
  createdAt: 1,
  updatedAt: 1,
} as UnifiedDevelopmentRequest;
assert.equal(
  developmentLifecycleStateMachineService.canDecide(failedInstruction, 'REQUEST_CHANGES'),
  true,
  'a failed instruction must permit a controlled revision request',
);
assert.equal(
  developmentLifecycleStateMachineService.canDecide(failedInstruction, 'ACCEPT'),
  false,
  'recovery must not bypass the review/approval gate',
);

console.log('PASS task outcome verification, unresolved error handling, instruction retry and approval boundary');
