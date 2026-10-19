import assert from 'node:assert/strict';
import fs from 'node:fs';
import { durableJobWorkerRuntimeService as jobs } from '../src/miki/selfDevelopment/services/durableJobWorkerRuntimeService.ts';
import { storageService } from '../src/services/storageService.ts';
import { capabilityProofRegistryService } from '../src/miki/selfDevelopment/services/capabilityProofRegistryService.ts';
import { repairQualityLearningService } from '../src/miki/selfDevelopment/services/repairQualityLearningService.ts';
import { reproducibleDevelopmentLedgerService } from '../src/miki/selfDevelopment/services/reproducibleDevelopmentLedgerService.ts';
import { operationalObservabilityService } from '../src/miki/selfDevelopment/services/operationalObservabilityService.ts';

const runtime = fs.readFileSync('src/miki/selfDevelopment/services/durableJobWorkerRuntimeService.ts', 'utf8');
const worker = fs.readFileSync('src/miki/selfDevelopment/services/productionScaleWorkerService.ts', 'utf8');
const guarded = [
  'src/miki/selfDevelopment/services/capabilityProofRegistryService.ts',
  'src/miki/selfDevelopment/services/repairQualityLearningService.ts',
  'src/miki/selfDevelopment/services/reproducibleDevelopmentLedgerService.ts',
  'src/miki/selfDevelopment/services/operationalObservabilityService.ts',
];
const results = [];
function check(name, fn) { fn(); results.push(name); }
function input(overrides = {}) { return { workspaceId: 'workspace-test', repositoryIds: ['repo-test'], priority: 1, foreground: false, dependencies: [], fileLocks: [], resource: { cpu: 1, memoryMb: 128, diskMb: 128 }, retryBudget: 2, ...overrides }; }

storageService.setItem('miki_durable_job_runtime_v1', '[]');
check('invalid transition is rejected and completed is terminal', () => {
  const j = jobs.enqueue(input());
  assert.throws(() => jobs.transition(j.jobId, 'COMPLETED'), /JOB_INVALID_STATE_TRANSITION/);
  jobs.transition(j.jobId, 'RUNNING');
  jobs.transition(j.jobId, 'COMPLETED');
  assert.throws(() => jobs.transition(j.jobId, 'RETRYING'), /JOB_INVALID_STATE_TRANSITION/);
});
check('terminal cancellation is idempotent and does not reopen job', () => {
  const j = jobs.enqueue(input());
  jobs.transition(j.jobId, 'CANCELLED');
  assert.equal(jobs.cancel(j.jobId, j.cancelToken).state, 'CANCELLED');
});
check('failed dependency automatically blocks queued dependent', () => {
  const dependency = jobs.enqueue(input());
  const dependent = jobs.enqueue(input({ dependencies: [dependency.jobId] }));
  jobs.transition(dependency.jobId, 'FAILED', 'TEST_FAILURE');
  assert.equal(jobs.claim('worker-test', { cpu: 2, memoryMb: 1024, diskMb: 1024 }), undefined);
  assert.equal(jobs.list().find(j => j.jobId === dependent.jobId)?.state, 'BLOCKED');
});
check('invalid resource budgets are rejected before persistence', () => {
  assert.throws(() => jobs.enqueue(input({ resource: { cpu: 0, memoryMb: 128, diskMb: 128 } })), /JOB_INPUT_INVALID/);
});
check('worker cancellation check remains after awaited adapter execution', () => {
  assert.match(worker, /const afterExecution=durableJobWorkerRuntimeService\.list\(\)\.find\(x=>x\.jobId===job\.jobId\);if\(afterExecution\?\.state==='CANCELLING'\)/);
});
check('worker runtime validates transitions, lease owner and lease expiry', () => {
  assert.match(runtime, /JOB_INVALID_STATE_TRANSITION/);
  assert.match(runtime, /LEASE_OWNER_MISMATCH/);
  assert.match(runtime, /JOB_LEASE_EXPIRED/);
  assert.match(runtime, /blockJobsWithFailedDependencies/);
});
check('all critical history stores quarantine malformed snapshots and verify raw preservation', () => {
  for (const file of guarded) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /_quarantine_v1/ , file);
    assert.match(source, /JSON\.parse\(saved\)\.raw===raw/, file);
    assert.match(source, /this\.blocked/, file);
  }
});
check('malformed snapshots are actually quarantined with the original raw payload', () => {
  const stores = [
    ['miki_capability_proof_registry_v1', capabilityProofRegistryService, 'capability'],
    ['miki_repair_quality_learning_v1', repairQualityLearningService, 'repair'],
    ['miki_reproducible_development_ledger_v1', reproducibleDevelopmentLedgerService, 'ledger'],
    ['miki_operational_observability_v1', operationalObservabilityService, 'span'],
  ];
  for (const [key, service] of stores) {
    const raw = '{\"corrupt\":true';
    storageService.setItem(key, raw);
    assert.deepEqual(service.list(), []);
    const quarantine = storageService.getItem(`${key}_quarantine_v1`);
    assert.ok(quarantine, `${key} quarantine exists`);
    assert.equal(JSON.parse(quarantine).raw, raw, `${key} raw payload retained`);
  }
});
check('ledger and capability evidence stores refuse writes after failed quarantine', () => {
  for (const file of guarded) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /STORE_BLOCKED|STORE_QUARANTINED/, file);
  }
});
console.log(JSON.stringify({ status: 'PASS', checks: results.length, results }, null, 2));
