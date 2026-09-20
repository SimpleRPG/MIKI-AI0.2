import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const bb=readFileSync('src/miki/core/services/taskBlackboardService.ts','utf8');
const core=readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
const d=readFileSync('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt','utf8');
const checks={
  reusePauseResume:bb.includes('pauseBackgroundTasksForForeground')&&bb.includes('hasActiveForegroundTask')&&bb.includes("task.status='PAUSED'"),
  backgroundDetection:bb.includes("x.background===true")&&bb.includes("x.orchestrationMode==='SELF_IMPROVEMENT_WORKER'"),
  foregroundIngress:core.includes('pauseBackgroundTasksForForeground(created.taskId)'),
  cycleGuard:core.includes('hasActiveForegroundTask(taskId)'),
  failClosedPause:core.includes("taskBlackboardService.pause(taskId,'FOREGROUND_USER_REQUEST_ACTIVE')"),
  waitingResult:core.includes("coreResultService.waiting(reqId,{error:'Background task paused for foreground user request'})"),
  noNewTaskManager:!bb.includes('BackgroundTaskManager')&&!core.includes('ForegroundTaskManager'),
  design:d.includes('Foreground / Background干渉制御'),
};
const passed=Object.values(checks).every(Boolean);
console.log(JSON.stringify({version:'v203',passed,checks},null,2));
if(!passed)process.exit(1);
