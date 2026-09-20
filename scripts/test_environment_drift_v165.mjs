import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const env=readFileSync('src/miki/core/services/executionEnvironmentRouterService.ts','utf8');
const core=readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
const design=readFileSync('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt','utf8');

assert.match(env,/EnvironmentFingerprint/);
assert.match(env,/capture\(/);
assert.match(env,/compare\(/);
assert.match(env,/storageBackend/);
assert.match(env,/miki_searxng_base_url/);
assert.match(env,/miki_web_research_policy_v1/);
assert.match(env,/miki_research_query_planning_policy_v1/);
assert.match(core,/executionEnvironmentRouterService\.capture/);
assert.match(core,/environmentDriftDetected/);
assert.match(core,/ENVIRONMENT_DRIFT_REPEATED/);
assert.match(core,/coreEnvironmentReplan/);
assert.match(core,/Permission\/Safety\/Evidence must be reconsidered/);
assert.match(design,/【160\. P1 — 実行中のEnvironment Driftを検出し、計画を再検証する】/);
console.log('PASS: Environment Drift plan-to-execution guard V165');
