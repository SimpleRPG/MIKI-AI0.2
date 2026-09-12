import { executionEventBusService, ExecutionEvent } from './executionEventBusService';
import { executionRunnerService, ExecutionEnvironment } from './executionRunnerService';
import { componentRegressionService } from './componentRegressionService';
import { researchToRemediationService, RemediationRecord } from './researchToRemediationService';
import { mikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';
import { capabilityConfidenceService } from './capabilityConfidenceService';
import { systemLogger } from './systemLogger';

export interface RemediationDispatchResult {
  remediationId: string;
  submitted: string[];
  alreadySubmitted: string[];
  blocked: string[];
  status: RemediationRecord['status'] | 'UNKNOWN';
}

/**
 * Research→Remediationで作られたRegression SuiteをExecutionRunnerへ安全に配送し、
 * 実行イベントをRemediationへ戻す閉ループ調整層。
 * 実行そのものは外部Runnerの責務。ここでは任意コマンドを生成/実行しない。
 */
export class RemediationExecutionCoordinatorService {
  private static instance: RemediationExecutionCoordinatorService;
  private initialized = false;
  private unsubscribers: Array<() => void> = [];

  private constructor() {}
  public static getInstance(): RemediationExecutionCoordinatorService {
    if (!this.instance) this.instance = new RemediationExecutionCoordinatorService();
    return this.instance;
  }

  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.unsubscribers.push(
      executionEventBusService.subscribe('execution.completed', e => this.onExecution(e)),
      executionEventBusService.subscribe('execution.failed', e => this.onExecution(e)),
      executionEventBusService.subscribe('execution.rejected', e => this.onExecution(e)),
      executionEventBusService.subscribe('execution.inconclusive', e => this.onExecution(e)),
    );
    systemLogger.info('TOOLS', '🔁 [RemediationExecutionCoordinator] initialized');
  }

  public dispatch(remediationId: string): RemediationDispatchResult {
    const record = researchToRemediationService.get(remediationId);
    if (!record) return { remediationId, submitted: [], alreadySubmitted: [], blocked: ['remediation_not_found'], status: 'UNKNOWN' };
    if (record.status === 'QUARANTINED') return { remediationId, submitted: [], alreadySubmitted: [], blocked: ['quarantined'], status: record.status };

    const submitted: string[] = [], alreadySubmitted: string[] = [], blocked: string[] = [];
    for (const suiteId of record.regressionSuiteIds) {
      const suite = componentRegressionService.refresh(suiteId);
      if (!suite) { blocked.push(`${suiteId}:suite_not_found`); continue; }
      if (suite.status === 'PASSED' || suite.status === 'FAILED' || suite.status === 'BLOCKED') continue;
      for (const requestId of suite.request_ids) {
        const req = executionRunnerService.getRequest(requestId);
        if (!req) { blocked.push(`${requestId}:request_not_found`); continue; }
        if (req.status === 'SUBMITTED') { alreadySubmitted.push(requestId); continue; }
        if (req.status !== 'QUEUED') { blocked.push(`${requestId}:${req.status}`); continue; }
        const next = executionRunnerService.markSubmitted(requestId);
        if (next?.status === 'SUBMITTED') submitted.push(requestId);
        else blocked.push(`${requestId}:submit_rejected`);
      }
    }
    this.refreshRecord(record);
    return { remediationId, submitted, alreadySubmitted, blocked, status: researchToRemediationService.get(remediationId)?.status || record.status };
  }

  public dispatchQueued(limit = 10): RemediationDispatchResult[] {
    return researchToRemediationService.list(Math.max(1, limit))
      .filter(r => r.status === 'VALIDATION_QUEUED')
      .slice(0, Math.max(1, limit))
      .map(r => this.dispatch(r.remediationId));
  }

  public refresh(remediationId: string): RemediationRecord | undefined {
    const record = researchToRemediationService.refresh(remediationId);
    if (!record) return undefined;
    return this.refreshRecord(record);
  }

  private onExecution(event: ExecutionEvent): void {
    if (!event.test_case_id || event.test_category !== 'REGRESSION') return;
    for (const record of researchToRemediationService.list(200)) {
      if (!record.regressionSuiteIds.length) continue;
      const suite = record.regressionSuiteIds
        .map(id => componentRegressionService.get(id))
        .find(s => !!s && s.request_ids.includes(event.request_id));
      if (!suite) continue;
      const refreshed = this.refreshRecord(record);
      mikiUnifiedLearningContinuumService.observe({
        domain: 'execution',
        action: event.passed ? 'research_remediation_regression_pass' : 'research_remediation_regression_fail',
        input: `${record.statement} ${event.component_id} ${event.test_case_id}`,
        outcome: event.passed ? 'SUCCESS' : 'FAILURE',
        verified: !!event.passed,
        capabilityIds: [event.component_id],
        lesson: `remediation:${record.remediationId}:${refreshed?.status || record.status}`,
      });
      break;
    }
  }

  private refreshRecord(record: RemediationRecord): RemediationRecord {
    const refreshed = researchToRemediationService.refresh(record.remediationId) || record;
    if (refreshed.status === 'VALIDATION_PASSED') {
      for (const componentId of refreshed.candidateComponentIds) capabilityConfidenceService.evaluate(componentId, 'ANDROID');
    }
    return refreshed;
  }
}

export const remediationExecutionCoordinatorService = RemediationExecutionCoordinatorService.getInstance();
