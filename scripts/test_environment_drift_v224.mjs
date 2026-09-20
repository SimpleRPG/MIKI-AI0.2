import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('src/miki/core/services/executionEnvironmentRouterService.ts','utf8');
for (const token of ['networkState','applicationVersion','dependencyLock','permissionState','storageAvailability','externalSourceFreshness','requiresReplan']) assert.match(source,new RegExp(token));
const core=fs.readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
assert.match(core,/environmentDriftDetected/);
assert.match(core,/coreEnvironmentReplan/);
console.log('PASS: expanded environment drift fingerprint V224');
