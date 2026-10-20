import assert from 'node:assert/strict';

class MemoryStorage {
  #m = new Map();
  get length() { return this.#m.size; }
  clear() { this.#m.clear(); }
  getItem(key) { return this.#m.has(String(key)) ? this.#m.get(String(key)) : null; }
  key(index) { return [...this.#m.keys()][index] ?? null; }
  removeItem(key) { this.#m.delete(String(key)); }
  setItem(key, value) { this.#m.set(String(key), String(value)); }
}

globalThis.localStorage = new MemoryStorage();
const { storageService } = await import('../src/services/storageService.ts');
await storageService.ready;

const GRAPH_KEY = 'miki_capability_ledger_graph_v1';
const QUARANTINE_KEY = `${GRAPH_KEY}_quarantine_v1`;
const checks = [];
const check = (name) => checks.push(name);
const clearGraphKeys = () => {
  storageService.removeItem(GRAPH_KEY);
  storageService.removeItem(QUARANTINE_KEY);
};
const node = (id, label, time) => ({ id, label, detail: '', createdAt: time, updatedAt: time });
const edge = (id, from, to, label, time) => ({ id, from, to, label, createdAt: time, updatedAt: time });

// Duplicate edits must fail before changing the persisted graph.
clearGraphKeys();
const { capabilityLedgerGraphService: editable } = await import('../src/miki/capability/services/capabilityLedgerGraphService.ts?p295-duplicate-edit');
const a = editable.addNode('A');
const b = editable.addNode('B');
const ab = editable.addEdge(a.id, b.id, 'uses');
const ba = editable.addEdge(b.id, a.id, 'uses');
const savedBeforeRejectedEdit = storageService.getItem(GRAPH_KEY);
assert.throws(() => editable.updateEdge(ba.id, { from: a.id, to: b.id, label: 'uses' }), /GRAPH_DUPLICATE_EDGE_NOT_ALLOWED/);
assert.equal(storageService.getItem(GRAPH_KEY), savedBeforeRejectedEdit, 'rejected duplicate edit must not mutate persisted bytes');
check('duplicate edge edits fail before persistence');

// commit() revalidates the full snapshot even if a caller supplies an invalid graph.
const invalidCommit = JSON.parse(savedBeforeRejectedEdit);
invalidCommit.edges.push({ ...invalidCommit.edges[0], id: 'forced-duplicate-edge' });
const { capabilityLedgerGraphService: commitValidator } = await import('../src/miki/capability/services/capabilityLedgerGraphService.ts?p295-commit-validation');
assert.throws(() => commitValidator.commit(invalidCommit), /GRAPH_SNAPSHOT_DUPLICATE_EDGE/);
assert.equal(storageService.getItem(GRAPH_KEY), savedBeforeRejectedEdit, 'invalid full snapshot must not replace the previous graph');
check('commit rejects invalid whole-snapshot graph');

// A corrupt snapshot must be preserved byte-for-byte in quarantine.
clearGraphKeys();
const time = Date.now();
const corrupt = {
  version: 1, updatedAt: time,
  nodes: [node('n1', 'A', time), node('n2', 'B', time)],
  edges: [edge('e1', 'n1', 'n2', 'rel', time), edge('e2', 'n1', 'n2', 'rel', time)],
};
const corruptRaw = JSON.stringify(corrupt);
storageService.setItem(GRAPH_KEY, corruptRaw);
const { capabilityLedgerGraphService: corruptLoader } = await import('../src/miki/capability/services/capabilityLedgerGraphService.ts?p295-corrupt-quarantine');
assert.equal(corruptLoader.getSnapshot().nodes.length, 0);
assert.equal(corruptLoader.getStorageState().status, 'RECOVERED_QUARANTINED');
assert.equal(JSON.parse(storageService.getItem(QUARANTINE_KEY)).raw, corruptRaw);
check('corrupt snapshot is quarantined with exact raw preservation');

// Empty string is malformed saved data, not an absent key.
clearGraphKeys();
storageService.setItem(GRAPH_KEY, '');
const { capabilityLedgerGraphService: emptyRawLoader } = await import('../src/miki/capability/services/capabilityLedgerGraphService.ts?p295-empty-raw');
assert.equal(emptyRawLoader.getStorageState().status, 'RECOVERED_QUARANTINED');
assert.equal(JSON.parse(storageService.getItem(QUARANTINE_KEY)).raw, '');
check('empty raw snapshot is quarantined instead of silently discarded');

// If quarantine cannot be written and verified, all graph mutations fail closed.
clearGraphKeys();
storageService.setItem(GRAPH_KEY, '{"broken":');
const originalSetItem = storageService.setItem.bind(storageService);
storageService.setItem = (key, value) => {
  if (String(key).startsWith(QUARANTINE_KEY)) throw new Error('P295_SIMULATED_QUARANTINE_WRITE_FAILURE');
  originalSetItem(key, value);
};
try {
  const { capabilityLedgerGraphService: blockedLoader } = await import('../src/miki/capability/services/capabilityLedgerGraphService.ts?p295-quarantine-failure');
  assert.equal(blockedLoader.getStorageState().status, 'WRITE_BLOCKED');
  assert.throws(() => blockedLoader.addNode('must remain blocked'), /GRAPH_STORE_WRITE_BLOCKED_QUARANTINE_FAILED/);
  check('quarantine failure leaves graph mutations blocked');
} finally {
  storageService.setItem = originalSetItem;
}

// A failed readback must block later mutations without updating the service cache.
clearGraphKeys();
const { capabilityLedgerGraphService: readbackVerifier } = await import('../src/miki/capability/services/capabilityLedgerGraphService.ts?p295-readback-failure');
readbackVerifier.getSnapshot();
const originalGetItem = storageService.getItem.bind(storageService);
let sabotageReadback = true;
storageService.getItem = (key) => sabotageReadback && key === GRAPH_KEY ? '__P295_READBACK_MISMATCH__' : originalGetItem(key);
try {
  assert.throws(() => readbackVerifier.addNode('readback mismatch'), /GRAPH_STORE_WRITE_VERIFY_FAILED/);
  assert.equal(readbackVerifier.getStorageState().status, 'WRITE_BLOCKED');
  check('storage readback mismatch blocks writes');
} finally {
  sabotageReadback = false;
  storageService.getItem = originalGetItem;
}

console.log(JSON.stringify({ phase: 'P295', status: 'PASS', checks: checks.length, verified: checks }, null, 2));
