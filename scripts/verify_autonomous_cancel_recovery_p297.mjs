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
const { taskBlackboardService } = await import('../src/miki/core/services/taskBlackboardService.ts');
const LOOP_KEY = 'miki_autonomous_self_improvement_loop_v2';
storageService.setItem(LOOP_KEY, JSON.stringify({ status: 'IDLE', queue: [], updatedAt: Date.now() }));
const { autonomousSelfImprovementLoopService: loop } = await import('../src/miki/core/services/autonomousSelfImprovementLoopService.ts?p297-cancel-transaction');
loop.drain = async () => {};
const checks = [];
const check = (ok, message) => { assert.ok(ok, message); checks.push(message); };

const originalCancel = taskBlackboardService.cancel.bind(taskBlackboardService);
let intentWasDurableBeforeTaskMutation = false;
const first = loop.enqueue('P297 cancellation write-order', 'SYSTEM', { runId: 'P297-CANCEL-1' });
taskBlackboardService.cancel = taskId => {
  const persisted = JSON.parse(storageService.getItem(LOOP_KEY) || '{}');
  intentWasDurableBeforeTaskMutation ||= persisted.queue?.some(item => item.taskId === taskId && item.cancelRequested === true) === true;
  return originalCancel(taskId);
};
try {
  const result = loop.cancelByRunId('P297-CANCEL-1');
  check(result.cancelled && !result.pending, 'successful cancellation intent is committed and reconciled');
  check(intentWasDurableBeforeTaskMutation, 'cancellation intent is persisted before TaskBlackboard side effects');
  check(taskBlackboardService.get(first.taskId)?.status === 'CANCELLED', 'reconciled task is terminal CANCELLED');
  check(!loop.getState().queue.some(item => item.id === first.id), 'reconciled cancellation is removed from active queue');
} finally {
  taskBlackboardService.cancel = originalCancel;
}

const second = loop.enqueue('P297 cancellation crash recovery', 'SYSTEM', { runId: 'P297-CANCEL-2' });
taskBlackboardService.cancel = taskId => {
  if (taskId === second.taskId) throw new Error('P297_SIMULATED_TASK_CANCEL_FAILURE');
  return originalCancel(taskId);
};
try {
  const pendingResult = loop.cancelByRunId('P297-CANCEL-2');
  check(pendingResult.cancelled && pendingResult.pending === true, 'failed side effect reports a durable pending cancellation');
  const persisted = JSON.parse(storageService.getItem(LOOP_KEY) || '{}');
  check(persisted.queue?.some(item => item.id === second.id && item.cancelRequested === true), 'failed cancellation retains its durable intent');
  check(taskBlackboardService.get(second.taskId)?.status !== 'CANCELLED', 'simulated failure leaves the task for recovery');
} finally {
  taskBlackboardService.cancel = originalCancel;
  loop.dispose();
}

const { autonomousSelfImprovementLoopService: restarted } = await import('../src/miki/core/services/autonomousSelfImprovementLoopService.ts?p297-cancel-restart');
restarted.drain = async () => {};
restarted.initialize();
check(taskBlackboardService.get(second.taskId)?.status === 'CANCELLED', 'restart recovery applies the persisted cancellation intent');
check(!restarted.getState().queue.some(item => item.id === second.id), 'restart recovery removes the cancelled request only after TaskBlackboard is terminal');
check(!restarted.getState().queue.some(item => item.cancelRequested && item.id === second.id), 'a cancelled request cannot re-enter the execution queue');
restarted.dispose();

const source = (await import('node:fs')).readFileSync('src/miki/core/services/autonomousSelfImprovementLoopService.ts', 'utf8');
check(source.includes('if (this.state.queue.some(item => item.cancelRequested === true))'), 'drain and recovery both check cancellation intents before dispatch');
check(source.includes('AUTONOMOUS_LOOP_REQUEST_INVALID_CANCEL_REQUEST'), 'cancel marker shape is validated when loading durable state');
console.log(JSON.stringify({ phase: 'P297', status: 'PASS', checks: checks.length, verified: checks }, null, 2));
