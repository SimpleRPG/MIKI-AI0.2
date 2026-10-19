import assert from 'node:assert/strict';
import { storageService } from '../src/services/storageService.ts';

const mainKey = 'miki_task_blackboard_v1';
const quarantineKey = `${mainKey}_quarantine_v1`;
const corruptRaw = '{"taskId":"truncated"';
storageService.setItem(mainKey, corruptRaw);
const { taskBlackboardService } = await import('../src/miki/core/services/taskBlackboardService.ts?p291-corrupt-snapshot-test');
const quarantinedRaw = storageService.getItem(quarantineKey);
assert.ok(quarantinedRaw, 'corrupt snapshot should be quarantined before writes');
assert.equal(JSON.parse(quarantinedRaw).raw, corruptRaw, 'quarantine must preserve exact original bytes');
const created = taskBlackboardService.create('P291 recovery probe', 'core');
const saved = storageService.getItem(mainKey);
assert.ok(saved, 'new snapshot should be writable after successful quarantine');
assert.ok(JSON.parse(saved).some((task) => task.taskId === created.taskId), 'new task should be persisted');
assert.equal(JSON.parse(storageService.getItem(quarantineKey)).raw, corruptRaw, 'normal save must not overwrite quarantined original');
console.log(JSON.stringify({ status: 'PASS', checks: 4, corruptSnapshotPreserved: true, futureWritesSafe: true }, null, 2));
