import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const runtime=readFileSync('src/miki/core/mikiCategoryInteractionRuntime.ts','utf8');
assert.equal(runtime.includes('NEXT_CATEGORY'),false);
assert.match(runtime,/coreTaskIngressService\.submit/);
assert.match(runtime,/kind: 'SELF_IMPROVEMENT'/);
assert.match(runtime,/category\.cycle/);
console.log('PASS: fixed category chain retired; CORE is sole router V167');
