import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const metrics=readFileSync('src/miki/improvement/services/selfImprovementMetricsService.ts','utf8');
const server=readFileSync('server.ts','utf8');
const design=readFileSync('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt','utf8');
for(const key of ['CognitiveObservabilitySnapshot','cognitiveObservabilitySnapshot','goal','research','unknowns','guards','search','learning','resource','reuseRate']) assert.match(metrics,new RegExp(key));
assert.match(metrics,/taskBlackboardService/);
assert.match(metrics,/domainReplyLedgerService/);
assert.match(metrics,/autonomousSearchService/);
assert.match(metrics,/mikiUnifiedLearningContinuumService/);
assert.match(metrics,/resourceGovernanceService/);
assert.match(server,/\/api\/miki\/cognitive-observability/);
assert.match(server,/cognitiveObservabilitySnapshot/);
assert.match(design,/【161\. P2 — 長期運転の観測性と構成変更の追跡】/);
console.log('PASS: unified cognitive observability V166');
