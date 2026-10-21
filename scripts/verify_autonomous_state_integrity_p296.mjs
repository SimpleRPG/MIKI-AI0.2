import assert from 'node:assert/strict';

class MemoryStorage {
  #map = new Map();
  get length() { return this.#map.size; }
  clear() { this.#map.clear(); }
  getItem(key) { return this.#map.has(String(key)) ? this.#map.get(String(key)) : null; }
  key(index) { return [...this.#map.keys()][index] ?? null; }
  removeItem(key) { this.#map.delete(String(key)); }
  setItem(key, value) { this.#map.set(String(key), String(value)); }
}

globalThis.localStorage = new MemoryStorage();
const { storageService } = await import('../src/services/storageService.ts');
await storageService.ready;
const ISSUE_KEY = 'miki_autonomous_issue_discovery_v1';
const LOOP_KEY = 'miki_autonomous_self_improvement_loop_v2';
const FAILURE_KEY = 'miki_failure_understanding_records_v1';
const check = (condition, label) => assert.ok(condition, label);
const checks = [];
const pass = label => checks.push(label);
const rawIssue = '{"snapshot":"broken"';

storageService.setItem(LOOP_KEY, JSON.stringify({ status: 'IDLE', queue: [], updatedAt: 0 }));
storageService.setItem(ISSUE_KEY, rawIssue);
const { autonomousIssueDiscoveryService: issues } = await import('../src/miki/core/services/autonomousIssueDiscoveryService.ts?p296-discovery-recovery');
check(issues.getPersistenceState().status === 'RECOVERED_QUARANTINED', 'discovery store reports successful quarantine');
check(JSON.parse(storageService.getItem(`${ISSUE_KEY}_quarantine_v1`)).raw === rawIssue, 'discovery snapshot raw bytes are preserved');
issues.recordContradiction('p296-claim', 'unresolved test contradiction');
check(JSON.parse(storageService.getItem(ISSUE_KEY)).some(item => item.sourceId === 'p296-claim'), 'discovery resumes only after quarantine has been verified');
pass('discovery snapshot quarantine and safe recovery');

const rawLoop = '{"queue":';
storageService.setItem(LOOP_KEY, rawLoop);
const { autonomousSelfImprovementLoopService: loop } = await import('../src/miki/core/services/autonomousSelfImprovementLoopService.ts?p296-loop-recovery');
check(loop.getPersistenceState().status === 'RECOVERED_QUARANTINED', 'loop queue reports successful quarantine');
check(JSON.parse(storageService.getItem(`${LOOP_KEY}_quarantine_v1`)).raw === rawLoop, 'queued improvement requests raw bytes are preserved');
check(loop.getState().queue.length === 0, 'malformed queue is never partially executed');
pass('improvement queue snapshot quarantine and no partial dispatch');

const rawFailure = '{"failureRecords":';
storageService.setItem(FAILURE_KEY, rawFailure);
const { failureUnderstandingService: failureMemory } = await import('../src/miki/memory/services/failureUnderstandingService.ts?p296-failure-recovery');
check(failureMemory.getPersistenceState().status === 'RECOVERED_QUARANTINED', 'failure memory reports successful quarantine');
check(JSON.parse(storageService.getItem(`${FAILURE_KEY}_quarantine_v1`)).raw === rawFailure, 'failure observation raw bytes are preserved');
pass('failure-understanding evidence history quarantine');

const originalSetItem = storageService.setItem.bind(storageService);
storageService.setItem = (key, value) => {
  if (String(key).startsWith(`${ISSUE_KEY}_quarantine_v1`)) throw new Error('P296_SIMULATED_QUARANTINE_FAILURE');
  originalSetItem(key, value);
};
try {
  storageService.setItem(ISSUE_KEY, '{"cannot-quarantine":');
  const { autonomousIssueDiscoveryService: blockedIssues } = await import('../src/miki/core/services/autonomousIssueDiscoveryService.ts?p296-discovery-blocked');
  check(blockedIssues.getPersistenceState().status === 'WRITE_BLOCKED', 'failed discovery quarantine blocks mutation');
  assert.throws(() => blockedIssues.recordContradiction('must-not-write', 'blocked'), /AUTONOMOUS_DISCOVERY_STORE_WRITE_BLOCKED/);
  await assert.rejects(() => blockedIssues.scan('DIAGNOSTIC'), /AUTONOMOUS_DISCOVERY_STORE_WRITE_BLOCKED/);
  pass('failed issue quarantine is fail-closed');
} finally {
  storageService.setItem = originalSetItem;
}

storageService.setItem(LOOP_KEY, '{"loop-state":');
storageService.setItem = (key, value) => {
  if (String(key).startsWith(`${LOOP_KEY}_quarantine_v1`)) throw new Error('P296_SIMULATED_LOOP_QUARANTINE_FAILURE');
  originalSetItem(key, value);
};
try {
  const { autonomousSelfImprovementLoopService: blockedLoop } = await import('../src/miki/core/services/autonomousSelfImprovementLoopService.ts?p296-loop-blocked');
  check(blockedLoop.getPersistenceState().status === 'WRITE_BLOCKED', 'failed loop quarantine blocks dispatch');
  assert.throws(() => blockedLoop.enqueue('must-not-dispatch', 'SYSTEM'), /AUTONOMOUS_LOOP_STORE_WRITE_BLOCKED/);
  pass('failed improvement queue quarantine prevents enqueue/dispatch');
} finally {
  storageService.setItem = originalSetItem;
}

storageService.setItem(FAILURE_KEY, '{"failure-history":');
storageService.setItem = (key, value) => {
  if (String(key).startsWith(`${FAILURE_KEY}_quarantine_v1`)) throw new Error('P296_SIMULATED_FAILURE_HISTORY_QUARANTINE_FAILURE');
  originalSetItem(key, value);
};
try {
  const { failureUnderstandingService: blockedFailureMemory } = await import('../src/miki/memory/services/failureUnderstandingService.ts?p296-failure-blocked');
  check(blockedFailureMemory.getPersistenceState().status === 'WRITE_BLOCKED', 'failed failure-history quarantine blocks event subscription');
  blockedFailureMemory.initialize();
  check(blockedFailureMemory.getPersistenceState().status === 'WRITE_BLOCKED', 'blocked failure history remains fail-closed');
  pass('failed failure-history quarantine is fail-closed');
} finally {
  storageService.setItem = originalSetItem;
}

storageService.removeItem(ISSUE_KEY);
const { autonomousIssueDiscoveryService: readbackIssues } = await import('../src/miki/core/services/autonomousIssueDiscoveryService.ts?p296-discovery-readback');
const originalGetItem = storageService.getItem.bind(storageService);
storageService.getItem = key => String(key) === ISSUE_KEY ? '__P296_READBACK_MISMATCH__' : originalGetItem(key);
try {
  assert.throws(() => readbackIssues.recordContradiction('readback-test', 'must block after mismatch'), /AUTONOMOUS_DISCOVERY_STORE_WRITE_VERIFY_FAILED/);
  check(readbackIssues.getPersistenceState().status === 'WRITE_BLOCKED', 'discovery write readback mismatch blocks further changes');
  pass('discovery persistence readback verification');
} finally {
  storageService.getItem = originalGetItem;
}

const fs = await import('node:fs');
const discoverySource = fs.readFileSync('src/miki/core/services/autonomousIssueDiscoveryService.ts', 'utf8');
const durableIntentAt = discoverySource.indexOf("issue.lastOutcome='DISPATCH_PENDING'");
const durableIntentSaveAt = discoverySource.indexOf('this.save();', durableIntentAt);
const coreDispatchAt = discoverySource.indexOf('await improvementIntakeRouterService.receive(', durableIntentAt);
check(durableIntentAt >= 0 && durableIntentSaveAt > durableIntentAt && durableIntentSaveAt < coreDispatchAt, 'autonomous issue dispatch intent is persisted before creating the CORE intake');
check(discoverySource.includes('if(now-queuedAt>=30*60*1000)') && discoverySource.includes("issue.lastOutcome='DISPATCH_PENDING'"), 'pending outbox intent has bounded reconciliation and retry after restart');
pass('durable outbox-before-dispatch contract');
const design = fs.readFileSync('MIKI-AI0.2_統合設計書_正本.txt', 'utf8');
for (const [path, source] of [
  ['src/miki/core/services/autonomousIssueDiscoveryService.ts', fs.readFileSync('src/miki/core/services/autonomousIssueDiscoveryService.ts', 'utf8')],
  ['src/miki/core/services/autonomousSelfImprovementLoopService.ts', fs.readFileSync('src/miki/core/services/autonomousSelfImprovementLoopService.ts', 'utf8')],
  ['src/miki/memory/services/failureUnderstandingService.ts', fs.readFileSync('src/miki/memory/services/failureUnderstandingService.ts', 'utf8')],
]) {
  const row = design.split(/\r?\n/).find(line => line.startsWith('- [') && line.includes(`| ${path} |`));
  const lineCount = source.split(/\r?\n/).length - (source.endsWith('\n') ? 1 : 0);
  check(Boolean(row && row.includes(`lines=${lineCount}`)), `design line-count index matches ${path}`);
}
const revisionHeader = design.match(/^正本Revision：(\d{4}-\d{2}-\d{2}-P\d+)$/m)?.[1];
const currentRevision = design.match(/^- 現行Revision: (\d{4}-\d{2}-\d{2}-P\d+)$/m)?.[1];
check(Boolean(revisionHeader && revisionHeader === currentRevision && design.includes('【2026-10-21-P296 自律エージェント永続状態の自己保全】')), 'canonical design revisions stay synchronized and P296 history remains');
pass('canonical design line-count and revision contract');
console.log(JSON.stringify({ phase: 'P296', status: 'PASS', checks: checks.length, checks }, null, 2));
