import { strict as assert } from 'node:assert';
import { complexityCostGateService } from '../src/miki/core/services/complexityCostGateService';
import type { CandidateWorkspace } from '../src/miki/core/services/isolatedCandidateWorkspaceService';

function workspace(
  files: Array<{ path: string; baselineContent: string; candidateContent: string }>,
): CandidateWorkspace {
  return {
    workspaceId: 'CWS-COMPLEXITY-GATE-FIXTURE',
    issueId: 'complexity-gate-behavior-test',
    writeGuardId: 'guard-fixture',
    baseSnapshotSha256: 'base-fixture',
    candidateRevisionSha256: 'candidate-fixture',
    status: 'ISOLATED',
    files: files.map(file => ({
      ...file,
      baselineSha256: '0'.repeat(64),
      candidateSha256: '1'.repeat(64),
      evidenceIds: [],
    })),
    createdAt: 1,
    updatedAt: 1,
  };
}

function evaluateOne(baselineContent: string, candidateContent: string) {
  return complexityCostGateService.evaluate(workspace([
    { path: 'fixture.ts', baselineContent, candidateContent },
  ]));
}

const unchanged = evaluateOne('const value = 1;\n', 'const value = 1;\n');
assert.equal(unchanged.passed, true);
assert.equal(unchanged.metrics.addedLines, 0);
assert.equal(unchanged.metrics.publicApis, 0);

const replacement = evaluateOne('const before = 1;', 'const after = 1;');
assert.equal(replacement.metrics.addedLines, 1, 'replacing a line must count as an addition');

const exportForms = [
  'export async function asyncApi() { return 1; }',
  'export default class DefaultApi {}',
  'export enum PublicState { READY }',
  "export { internal as reexportedApi } from './internal';",
  "export * as namespaceApi from './namespace';",
].join('\n');
const exportDecision = evaluateOne('', exportForms);
assert.equal(
  exportDecision.metrics.publicApis,
  5,
  'async/default/enum/named/namespace exports must be counted',
);

const wildcardDecision = evaluateOne('', "export * from './starred-module';");
assert.equal(wildcardDecision.metrics.publicApis, 13, 'an unresolved wildcard must fail closed');
assert.ok(wildcardDecision.reasons.includes('TOO_MANY_NEW_PUBLIC_APIS'));

const multipleVariables = evaluateOne('', 'export const firstApi = 1,\n  secondApi = 2;');
assert.equal(multipleVariables.metrics.publicApis, 2, 'each exported variable declarator must be counted');

const destructuringExport = evaluateOne('', 'export const { firstApi, secondApi } = source;');
assert.equal(destructuringExport.metrics.publicApis, 13, 'unresolved destructuring exports must fail closed');
assert.ok(destructuringExport.reasons.includes('TOO_MANY_NEW_PUBLIC_APIS'));

const api12 = Array.from(
  { length: 12 },
  (_, index) => `export async function publicApi${index}() { return ${index}; }`,
).join('\n');
const api13 = `${api12}\nexport async function publicApi12() { return 12; }`;
assert.equal(evaluateOne('', api12).metrics.publicApis, 12);
assert.equal(evaluateOne('', api12).passed, true, 'the public API limit is inclusive at 12');
const apiOverflow = evaluateOne('', api13);
assert.equal(apiOverflow.metrics.publicApis, 13);
assert.ok(apiOverflow.reasons.includes('TOO_MANY_NEW_PUBLIC_APIS'));

const imports24 = Array.from(
  { length: 24 },
  (_, index) => `import value${index} from './module-${index}';`,
).join('\n');
const imports25 = `${imports24}\nimport value24 from './module-24';`;
assert.equal(evaluateOne('', imports24).metrics.imports, 24);
assert.equal(evaluateOne('', imports24).passed, true, 'the import limit is inclusive at 24');
assert.ok(evaluateOne('', imports25).reasons.includes('TOO_MANY_NEW_IMPORTS'));

const events24 = Array.from(
  { length: 24 },
  (_, index) => `eventBus.publish('event-${index}', { id: ${index} });`,
).join('\n');
const events25 = `${events24}\neventBus.publish('event-24', { id: 24 });`;
assert.equal(evaluateOne('', events24).metrics.events, 24);
assert.equal(evaluateOne('', events24).passed, true, 'the event limit is inclusive at 24');
assert.ok(evaluateOne('', events25).reasons.includes('TOO_MANY_NEW_EVENTS'));

const keys8 = Array.from(
  { length: 8 },
  (_, index) => `const key${index} = 'miki_storage_key_${index}';`,
).join('\n');
const keys9 = `${keys8}\nconst key8 = 'miki_storage_key_8';\nconst duplicate = 'miki_storage_key_0';`;
assert.equal(evaluateOne('', keys8).metrics.storageKeys, 8);
assert.equal(evaluateOne('', keys8).passed, true, 'the storage key limit is inclusive at 8');
const keyOverflow = evaluateOne('', keys9);
assert.equal(keyOverflow.metrics.storageKeys, 9, 'repeated uses of one key must not count as a new key');
assert.ok(keyOverflow.reasons.includes('TOO_MANY_NEW_STORAGE_KEYS'));

const files12 = Array.from(
  { length: 12 },
  (_, index) => ({
    path: `file-${index}.ts`,
    baselineContent: '',
    candidateContent: `const changed${index} = ${index};`,
  }),
);
assert.equal(complexityCostGateService.evaluate(workspace(files12)).metrics.files, 12);
assert.equal(complexityCostGateService.evaluate(workspace(files12)).passed, true);

const files13 = [
  ...files12,
  { path: 'file-12.ts', baselineContent: '', candidateContent: 'const changed12 = 12;' },
];
assert.ok(
  complexityCostGateService.evaluate(workspace(files13)).reasons.includes('TOO_MANY_CHANGED_FILES'),
);

const lines2000 = Array.from(
  { length: 2000 },
  (_, index) => `const line${index} = ${index};`,
).join('\n');
const lines2001 = `${lines2000}\nconst line2000 = 2000;`;
assert.equal(evaluateOne('', lines2000).metrics.addedLines, 2000);
assert.equal(evaluateOne('', lines2000).passed, true, 'the added line limit is inclusive at 2000');
assert.ok(evaluateOne('', lines2001).reasons.includes('TOO_MANY_ADDED_LINES'));

console.log('PASS complexity-cost gate behavior: all six limits, inclusive boundaries, changed lines and export forms verified');
