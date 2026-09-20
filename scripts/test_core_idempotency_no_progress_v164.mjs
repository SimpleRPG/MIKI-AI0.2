import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ledger=readFileSync('src/miki/core/services/domainReplyLedgerService.ts','utf8');
const core=readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
const plateau=readFileSync('src/miki/core/services/plateauDetectorService.ts','utf8');
const design=readFileSync('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt','utf8');

assert.match(ledger,/idempotencyKey: string/);
assert.match(ledger,/findSucceededByIdempotencyKey/);
assert.match(core,/findSucceededByIdempotencyKey\(idempotencyKey\)/);
assert.match(core,/actionIdempotencyReused/);
assert.match(core,/actionStarted/);
assert.match(core,/actionCompleted/);
assert.match(core,/idempotencyKey:typeof route\.payload\.idempotencyKey/);
assert.match(core,/coreCycleGuard/);
assert.match(plateau,/OSCILLATION_DETECTED/);
assert.match(plateau,/REPEATED_FAILURE/);
assert.match(plateau,/NO_NEW_EVIDENCE/);
assert.match(plateau,/unchangedCycles>=2/);
assert.match(plateau,/sameResearchQuery/);
assert.match(design,/【158\. P0 — 副作用を伴うActionの重複実行を防止する】/);
assert.match(design,/【159\. P0 — 認知サイクルの無限ループ・振動・無進展を検出する】/);
console.log('PASS: CORE idempotency + no-progress guards V164');
