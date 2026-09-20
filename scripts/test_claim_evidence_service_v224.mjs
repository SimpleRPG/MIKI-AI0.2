import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('src/miki/research/services/claimEvidenceService.ts','utf8');
assert.match(source,/class ClaimEvidenceService/);
assert.match(source,/evidenceService/);
assert.match(source,/verifierService/);
assert.match(source,/independentEvidenceCount/);
assert.match(source,/UNREGISTERED/);
console.log('PASS: Claim/Evidence verification facade V224');
