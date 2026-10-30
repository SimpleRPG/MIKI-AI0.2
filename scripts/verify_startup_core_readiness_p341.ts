import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CoreRoutingReadinessGate } from '../src/app/coreRoutingReadinessGate.ts';

const checks: string[] = [];
const check = (passed: boolean, message: string) => {
  assert.ok(passed, message);
  checks.push(message);
};
const read = (path: string) => fs.readFileSync(path, 'utf8');

const gate = new CoreRoutingReadinessGate();
let didResolve = false;
const pendingReady = gate.wait().then(() => { didResolve = true; });
await Promise.resolve();
check(gate.getStatus() === 'PENDING' && !didResolve, 'conversation readiness waits while CORE routing is pending');
gate.markReady();
await pendingReady;
check(gate.getStatus() === 'READY' && didResolve, 'conversation readiness opens only after routing is marked ready');
gate.markFailed(new Error('LATE_FAILURE_MUST_NOT_REVOKE_READY'));
check(gate.getStatus() === 'READY', 'late optional runtime failure does not revoke an already-ready CORE router');

const failedGate = new CoreRoutingReadinessGate();
const pendingFailure = failedGate.wait();
failedGate.markFailed(new Error('DOMAIN_BOOTSTRAP_FAILED'));
await assert.rejects(pendingFailure, /DOMAIN_BOOTSTRAP_FAILED/);
check(failedGate.getStatus() === 'FAILED', 'bootstrap failure rejects pending conversation readiness instead of waiting forever');
failedGate.reset();
const retryReady = failedGate.wait();
failedGate.markReady();
await retryReady;
check(failedGate.getStatus() === 'READY', 'a later lifecycle retry can reopen the readiness gate');

const cancelGate = new CoreRoutingReadinessGate();
const abort = new AbortController();
const pendingCancel = cancelGate.wait(abort.signal);
abort.abort();
await assert.rejects(
  pendingCancel,
  (error: unknown) => error instanceof Error &&
    error.name === 'AbortError' &&
    error.message === 'CORE_ROUTING_WAIT_CANCELLED'
);
check(cancelGate.getStatus() === 'PENDING', 'Stop cancels only the waiter and does not falsify router readiness');
const secondWaiter = cancelGate.wait();
cancelGate.markReady();
await secondWaiter;
check(cancelGate.getStatus() === 'READY', 'aborted waiter does not block a later request');

const main = read('src/main.tsx');
const app = read('src/App.tsx');
const lifecycle = read('src/app/appRuntimeLifecycleService.ts');
const domainBootstrap = read('src/miki/core/services/domainIntegrationBootstrapService.ts');
const domainRouter = read('src/miki/core/services/domainRouterService.ts');
const workflow = read('.github/workflows/build-apk.yml');

const renderAppStart = main.indexOf('const renderApp = async () => {');
const appImportIndex = main.indexOf("import('./App')", renderAppStart);
const storageReadyIndex = main.indexOf('void storageService.ready');
const storageReadyThenIndex = main.indexOf('  .then(() => {', storageReadyIndex);
const renderAfterStorageIndex = main.indexOf('return renderApp();', storageReadyThenIndex);
check(
  renderAppStart >= 0 &&
    appImportIndex > renderAppStart &&
    appImportIndex < storageReadyIndex &&
    storageReadyThenIndex > storageReadyIndex &&
    renderAfterStorageIndex > storageReadyThenIndex,
  'App import is invoked through renderApp only after storage hydration'
);

const seedIndex = app.indexOf('await selfCodeSpaceService.initializeBundledSeed();');
const runtimeInitIndex = app.indexOf('void appRuntimeLifecycleService.initialize().catch');
check(
  seedIndex >= 0 && runtimeInitIndex > seedIndex,
  'runtime lifecycle starts only after bundled seed initialization'
);

const handlerStart = app.indexOf('const handleSendMessage = async (');
const handlerEnd = app.indexOf('  // AI Auto Debug', handlerStart);
check(handlerStart >= 0 && handlerEnd > handlerStart, 'canonical conversation handler is present');
const handler = app.slice(handlerStart, handlerEnd);
const preparingStatus = handler.indexOf("content: '⏳ MIKI起動準備を確認中…'");
const readyWait = handler.indexOf('await appRuntimeLifecycleService.waitForCoreRoutingReady(abortController.signal);');
const readyAbortCheck = handler.indexOf('if (abortController.signal.aborted) return;', readyWait);
const acceptedStatus = handler.indexOf("content: '⚡ CORE受付中…'", readyWait);
const submit = handler.indexOf('await typedCoreUiGatewayService.submitConversation(', readyWait);
check(
  preparingStatus >= 0 && readyWait > preparingStatus &&
    readyAbortCheck > readyWait && acceptedStatus > readyAbortCheck &&
    submit > acceptedStatus,
  'UI shows preparation status and gates CORE submission behind routing readiness'
);
check(
  handler.includes('finalizeConversationResponse(coreTask.task.taskId'),
  'ready conversation keeps the existing CORE/P216 finalization path'
);

const failureGuardStart = handler.indexOf(
  'const coreResultStatus = coreTask.coreResult?.status;'
);
const failureGuardEnd = handler.indexOf(
  "systemLogger.step(1, 10, 'チャット送信リクエスト受付 & 入力解析'",
  failureGuardStart
);
const failureGuardBody = failureGuardStart >= 0 && failureGuardEnd > failureGuardStart
  ? handler.slice(failureGuardStart, failureGuardEnd)
  : '';
const processingUpdateIndex = handler.indexOf(
  "coreResultService.updateStatus(coreRequestId, 'processing'"
);
const conversationExecuteIndex = handler.indexOf(
  'await conversationCoreService.execute({'
);
check(
  failureGuardStart >= 0 &&
    failureGuardEnd > failureGuardStart &&
    processingUpdateIndex > failureGuardEnd &&
    conversationExecuteIndex > failureGuardEnd &&
    failureGuardBody.includes("coreTask.task.status === 'FAILED'") &&
    failureGuardBody.includes("coreResultStatus === 'failed'") &&
    failureGuardBody.includes("coreResultStatus === 'blocked'") &&
    failureGuardBody.includes("coreResultStatus === 'rejected'") &&
    failureGuardBody.includes('return;'),
  'explicit CORE failures stop before processing downgrade and ConversationCore execution'
);
check(
  app.includes('appRuntimeLifecycleService.failCoreRoutingReady(error)'),
  'bootstrap failure rejects waiting requests'
);

const bootstrapRegistration = domainBootstrap.indexOf('for(const domain of MIKI_DOMAINS)domainRouterService.register');
const bootstrapAudit = domainBootstrap.indexOf('const connectivityAudit=await domainParticipationService.auditAll();');
check(
  bootstrapRegistration >= 0 && bootstrapAudit > bootstrapRegistration,
  'Domain bootstrap registers all handlers before connectivity audit completes'
);
check(
  domainRouter.includes('DOMAIN_ENTRY_NOT_REGISTERED'),
  'router rejects dispatch to an unregistered Domain rather than silently succeeding'
);

const bootstrapCall = lifecycle.indexOf('await domainIntegrationBootstrapService.initialize();');
const readySignal = lifecycle.indexOf('this.coreRoutingReadinessGate.markReady();', bootstrapCall);
check(
  bootstrapCall >= 0 && readySignal > bootstrapCall &&
    readySignal < lifecycle.indexOf('return;', readySignal),
  'runtime readiness is released after successful Domain integration initialization'
);
check(
  lifecycle.includes('this.coreRoutingReadinessGate.markFailed(error);') &&
    lifecycle.includes('waitForCoreRoutingReady(signal?: AbortSignal): Promise<void>'),
  'runtime startup failures are propagated to the conversation readiness gate'
);
check(
  workflow.includes('Verify startup chat routing readiness P341') &&
    workflow.includes('run: npx tsx scripts/verify_startup_core_readiness_p341.ts'),
  'GitHub Actions executes the P341 startup readiness verifier'
);

console.log(JSON.stringify({
  phase: 'P342',
  status: 'PASS',
  checks: checks.length,
  verified: checks,
}, null, 2));
