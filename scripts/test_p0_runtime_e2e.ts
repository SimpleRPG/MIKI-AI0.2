import fs from 'node:fs';
import path from 'node:path';
import { domainIntegrationBootstrapService } from '../src/miki/core/services/domainIntegrationBootstrapService';
import { coreTaskIngressService } from '../src/miki/core/services/coreTaskIngressService';
import { taskBlackboardService } from '../src/miki/core/services/taskBlackboardService';
import { mikiSelfCodingSuperchargerService } from '../src/miki/selfDevelopment/services/mikiSelfCodingSuperchargerService';

const root = process.cwd();
const reportPath = path.join(root, 'artifacts', 'p0_runtime_e2e_report.json');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`P0_ASSERTION_FAILED:${message}`);
}

async function run() {
  const report: Record<string, unknown> = {
    schemaVersion: 1,
    test: 'P0_RUNTIME_E2E',
    startedAt: new Date().toISOString(),
    checks: [],
  };
  const checks = report.checks as Array<Record<string, unknown>>;

  await domainIntegrationBootstrapService.initialize();
  try {
    const registrations = domainIntegrationBootstrapService.getStatus().registered;
    const missing = domainIntegrationBootstrapService.getStatus().missing;
    assert(registrations.length === 18, `18_DOMAIN_REGISTRATION_REQUIRED:${registrations.length}`);
    assert(missing.length === 0, `DOMAIN_REGISTRATION_MISSING:${missing.join(',')}`);
    checks.push({ name: 'domain_registration', passed: true, registered: registrations.length });

    const result = await coreTaskIngressService.submit({
      kind: 'USER_REQUEST',
      goal: 'P0 CORE runtime E2E conversation verification',
      source: 'conversation',
      payload: {
        entry: 'TYPED_CONVERSATION_UI_GATEWAY',
        input: 'P0 runtime verification',
      },
      maxCycles: 6,
    });

    assert(result.task.taskId.length > 0, 'TASK_ID_MISSING');
    assert(result.task.revision >= 1, 'TASK_REVISION_MISSING');
    assert(result.task.visitedDomains.includes('conversation'), 'CONVERSATION_DOMAIN_NOT_VISITED');
    assert(result.dispatched > 0, 'NO_DOMAIN_DISPATCH');

    const taskBeforeFinalize = taskBlackboardService.get(result.task.taskId);
    assert(taskBeforeFinalize, 'TASK_NOT_RELOADABLE');
    const beforeRevision = taskBeforeFinalize.revision;
    const acceptedWrite = taskBlackboardService.appendIfRevision(
      result.task.taskId,
      beforeRevision,
      'CHECKPOINT',
      'core',
      'p0E2ERevisionWrite',
      { source: 'P0_RUNTIME_E2E' },
    );
    assert(acceptedWrite, 'EXPECTED_REVISION_WRITE_REJECTED');
    const staleWrite = taskBlackboardService.appendIfRevision(
      result.task.taskId,
      beforeRevision,
      'CHECKPOINT',
      'core',
      'p0E2EStaleWrite',
      { source: 'P0_RUNTIME_E2E' },
    );
    assert(!staleWrite, 'STALE_WRITE_WAS_ACCEPTED');

    const finalized = coreTaskIngressService.finalizeConversationResponse(
      result.task.taskId,
      { text: 'P0 runtime E2E finalized' },
    );
    assert(finalized?.task.status === 'COMPLETED', `CORE_FINALIZATION_NOT_COMPLETED:${finalized?.task.status}`);
    assert(finalized?.coreResult?.status === 'completed', `CORE_RESULT_NOT_COMPLETED:${finalized?.coreResult?.status}`);
    checks.push({
      name: 'core_runtime_e2e',
      passed: true,
      taskId: result.task.taskId,
      cycles: result.cycles,
      dispatched: result.dispatched,
      status: finalized?.task.status,
      revision: finalized?.task.revision,
    });

    const guarded = await mikiSelfCodingSuperchargerService.runAutonomousImplementation(
      'P0 fail-closed guard verification',
      'src/p0-runtime-guard-probe.ts',
      true,
      'export const p0GuardProbe = 1;\n',
      'NONE',
    );
    assert(guarded.success === false, `UNAUTHORIZED_APPLY_RETURNED_SUCCESS:${JSON.stringify(guarded)}`);
    assert(guarded.applied === false, `UNAUTHORIZED_APPLY_MUTATED_CODE:${JSON.stringify(guarded)}`);
    assert(guarded.error === 'CORE_PROMOTION_AUTHORITY_REQUIRED', `WRONG_GUARD_ERROR:${guarded.error}`);
    checks.push({ name: 'self_improvement_fail_closed', passed: true, error: guarded.error, applied: guarded.applied });

    report.passed = true;
  } finally {
    domainIntegrationBootstrapService.dispose();
  }

  report.finishedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

run().catch(error => {
  const payload = {
    schemaVersion: 1,
    test: 'P0_RUNTIME_E2E',
    passed: false,
    finishedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  process.stderr.write(JSON.stringify(payload, null, 2) + '\n');
  process.exit(1);
});
