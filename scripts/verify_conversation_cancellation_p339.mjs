import assert from 'node:assert/strict';
import fs from 'node:fs';

class MemoryStorage {
  #map = new Map();
  get length() { return this.#map.size; }
  clear() { this.#map.clear(); }
  getItem(key) { return this.#map.has(String(key)) ? this.#map.get(String(key)) : null; }
  key(index) { return [...this.#map.keys()][index] ?? null; }
  removeItem(key) { this.#map.delete(String(key)); }
  setItem(key, value) { this.#map.set(String(key), String(value)); }
}
globalThis.localStorage = new MemoryStorage();

const { storageService } = await import('../src/services/storageService.ts');
await storageService.ready;
const { taskBlackboardService } = await import('../src/miki/core/services/taskBlackboardService.ts');
const { coreResultService } = await import('../src/miki/core/services/coreResultService.ts');
const { coreOrchestratorService } = await import('../src/miki/core/services/coreOrchestratorService.ts');
const { coreTaskIngressService } = await import('../src/miki/core/services/coreTaskIngressService.ts');

const checks = [];
const check = (ok, message) => {
  assert.ok(ok, message);
  checks.push(message);
};
const read = (path) => fs.readFileSync(path, 'utf8');

// 実際のCORE ingress経由でAbortSignalがBlackboardのタスクを取り消すことを検証する。
const originalContinueTask = coreOrchestratorService.continueTask;
let releasePendingTask;
const controller = new AbortController();
const goal = 'P339 conversation cancellation integration';
coreOrchestratorService.continueTask = (taskId) => new Promise((resolve) => {
  releasePendingTask = () => resolve({
    task: taskBlackboardService.get(taskId),
    cycles: 0,
    dispatched: 0,
    coreResult: coreResultService.get(taskId),
  });
});

let pending;
try {
  pending = coreTaskIngressService.submit({
    kind: 'USER_REQUEST',
    goal,
    source: 'conversation',
    payload: { text: goal, hasAttachments: false, entry: 'P339_VERIFIER' },
  }, controller.signal);

  const task = taskBlackboardService.list(50).find((item) => item.goal === goal);
  check(Boolean(task), 'CORE task identity is persisted while submit remains pending');
  if (!task) throw new Error('P339_TASK_NOT_CREATED');
  check(typeof releasePendingTask === 'function', 'CORE execution is held at a deterministic cancellation boundary');

  controller.abort();
  check(taskBlackboardService.get(task.taskId)?.status === 'CANCELLED', 'AbortSignal cancels the actual CORE Blackboard task');

  if (typeof releasePendingTask !== 'function') {
    throw new Error('P339_CONTINUE_TASK_RELEASE_MISSING');
  }
  releasePendingTask();
  const result = await pending;
  check(result.task.status === 'CANCELLED', 'cancelled state survives the delayed CORE execution return');
  check(
    !result.task.entries.some((entry) => entry.key === 'cognitiveContinuity:requestPlan'),
    'cancelled ingress returns before post-run learning and enrichment side effects'
  );
} finally {
  coreOrchestratorService.continueTask = originalContinueTask;
}

// 完了が先に確定したタスクをStopの遅延イベントで拒否状態へ戻さないことを検証する。
const completedGoal = 'P339 completed task cancellation race';
const completedTask = taskBlackboardService.create(
  completedGoal,
  'conversation',
  { kind: 'USER_REQUEST' }
);
coreResultService.createRequest({
  requestId: completedTask.taskId,
  goal: completedGoal,
  sourceCategory: 'conversation',
  payload: { kind: 'USER_REQUEST' },
});
coreResultService.complete(completedTask.taskId, {
  taskId: completedTask.taskId,
  status: 'COMPLETED',
});
taskBlackboardService.setStatus(completedTask.taskId, 'COMPLETED');

const lateCancel = coreOrchestratorService.cancel(completedTask.taskId);
check(lateCancel === undefined, 'completed CORE task rejects a late cancellation attempt without mutating state');
check(
  taskBlackboardService.get(completedTask.taskId)?.status === 'COMPLETED',
  'late cancellation cannot replace completed Blackboard status'
);
check(
  coreResultService.get(completedTask.taskId)?.status === 'completed',
  'late cancellation cannot replace a completed CoreResult with rejected'
);

// UIからCORE・P216最終化までの配線と、取消後の遅延UI更新ガードを確認する。
const app = read('src/App.tsx');
const gateway = read('src/miki/core/ui/typedCoreUiGatewayService.ts');
const ingress = read('src/miki/core/services/coreTaskIngressService.ts');
const orchestrator = read('src/miki/core/services/coreOrchestratorService.ts');
const workflow = read('.github/workflows/build-apk.yml');

const sendStart = app.indexOf('  const handleSendMessage = async (');
const sendEnd = app.indexOf('  // AI Auto Debug', sendStart);
check(sendStart >= 0 && sendEnd > sendStart, 'conversation handler range is present');
const sendBody = app.slice(sendStart, sendEnd);
const controllerIndex = sendBody.indexOf('const abortController = new AbortController();');
const submitIndex = sendBody.indexOf('await typedCoreUiGatewayService.submitConversation(');
const placeholderIndex = sendBody.indexOf("content: '⚡ CORE受付中…'");
check(controllerIndex >= 0 && submitIndex > controllerIndex, 'AbortController exists before awaiting CORE submission');
check(placeholderIndex >= 0 && submitIndex > placeholderIndex, 'user-facing waiting placeholder exists before CORE submission');
check(
  sendBody.includes('Boolean(attached?.length),\n        abortController.signal'),
  'UI forwards the request AbortSignal to the typed CORE gateway'
);
check(
  sendBody.includes('if (abortController.signal.aborted) return;'),
  'cancelled request checks its signal before applying delayed results'
);
check(
  sendBody.includes('if (abortControllerRef.current === abortController)'),
  'older request cannot clear a newer request loading state'
);
check(
  sendBody.includes('finalizeConversationResponse(coreTask.task.taskId'),
  'normal answer still passes through CORE conversation finalization / P216'
);

const stopStart = app.indexOf('const handleStopGeneration = () => {');
const stopEnd = app.indexOf('// 文書48章', stopStart);
check(stopStart >= 0 && stopEnd > stopStart, 'Stop handler range is present');
const stopBody = app.slice(stopStart, stopEnd);
check(stopBody.includes('abortControllerRef.current.abort()'), 'Stop handler aborts the active request signal');
check(stopBody.includes("content.includes('受付中')"), 'Stop handler recognizes CORE acceptance waiting state');

check(
  gateway.includes('submitConversation(text:string,hasAttachments=false,signal?:AbortSignal)'),
  'typed gateway accepts AbortSignal'
);
check(
  gateway.includes('},signal);'),
  'typed gateway forwards AbortSignal into CORE ingress'
);
check(
  ingress.includes('coreOrchestratorService.run(request.goal,request.source as MikiDomain,payload,maxCycles,signal)'),
  'CORE ingress forwards AbortSignal into Orchestrator'
);
check(
  ingress.includes("if(result.task.status==='CANCELLED')return result;"),
  'cancelled ingress skips post-run learning side effects'
);
check(
  orchestrator.includes("signal.addEventListener('abort',cancelFromSignal,{once:true})"),
  'Orchestrator registers one-shot real-task cancellation'
);
check(
  orchestrator.includes("if(taskBlackboardService.get(taskId)?.status==='CANCELLED')break coreCycle;"),
  'Orchestrator prevents cancelled task completion overwrite'
);
const dispatchAwaitIndex = orchestrator.indexOf('reply=await domainRouterService.dispatch(envelope);');
const dispatchCancelGuardIndex = orchestrator.indexOf(
  "if(taskBlackboardService.get(taskId)?.status==='CANCELLED')break coreCycle;",
  dispatchAwaitIndex
);
check(
  dispatchAwaitIndex >= 0 &&
  dispatchCancelGuardIndex > dispatchAwaitIndex &&
  dispatchCancelGuardIndex - dispatchAwaitIndex < 180,
  'cancelled CORE task stops before processing a delayed Domain dispatch reply'
);
check(
  orchestrator.includes(
    "await this.assessCoreMemoryContext(stateBase,currentPayload,cycles);\n   if(taskBlackboardService.get(taskId)?.status==='CANCELLED')break coreCycle;"
  ),
  'cancelled CORE task stops after asynchronous memory assessment'
);
check(
  orchestrator.includes(
    "const domainParticipation=await rustDomainParticipationKernelService.rank(routes);\n   if(taskBlackboardService.get(taskId)?.status==='CANCELLED')break coreCycle;"
  ),
  'cancelled CORE task stops after asynchronous Domain planning'
);
check(
  workflow.includes('Verify conversation CORE cancellation lifecycle P339') &&
  workflow.includes('run: npx tsx scripts/verify_conversation_cancellation_p339.mjs'),
  'GitHub Actions runs the P339 verifier through tsx'
);

console.log(JSON.stringify({
  phase: 'P339',
  status: 'PASS',
  checks: checks.length,
  verified: checks,
}, null, 2));
