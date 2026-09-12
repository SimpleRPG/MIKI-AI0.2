import { executionEventBusService, ExecutionEvent } from './executionEventBusService';
import { capabilityReuseService } from './capabilityReuseService';
import { failureMemoryService } from './failureMemoryService';
import { recoveryOrchestratorService } from './recoveryOrchestratorService';
import { ExecutionEnvironment } from './executionRunnerService';
import { systemLogger } from './systemLogger';
import { taskExecutionOrchestratorService } from './taskExecutionOrchestratorService';
import { componentRegistryService } from './componentRegistryService';

export interface ExecutionLearningStats {
  completed: number;
  failed: number;
  rejected: number;
  reuseRecorded: number;
  failuresRecorded: number;
  recoveriesStarted: number;
}

/**
 * Execution Event Busの購読側を一本化する統合層。
 * Runnerは結果を発行するだけにし、学習・再利用・失敗回避・復旧をここから連携する。
 */
export class ExecutionLearningCoordinatorService {
  private static instance: ExecutionLearningCoordinatorService;
  private initialized = false;
  private unsubscribers: Array<() => void> = [];
  private stats: ExecutionLearningStats = {
    completed: 0, failed: 0, rejected: 0,
    reuseRecorded: 0, failuresRecorded: 0, recoveriesStarted: 0,
  };

  private constructor() {}

  public static getInstance(): ExecutionLearningCoordinatorService {
    if (!this.instance) this.instance = new ExecutionLearningCoordinatorService();
    return this.instance;
  }

  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.unsubscribers.push(
      executionEventBusService.subscribe('execution.completed', (event) => this.onCompleted(event)),
      executionEventBusService.subscribe('execution.failed', (event) => this.onFailed(event)),
      executionEventBusService.subscribe('execution.rejected', (event) => this.onRejected(event)),
    );
    systemLogger.info('TOOLS', '🔄 [ExecutionLearningCoordinator] initialized');
  }

  public dispose(): void {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    this.initialized = false;
  }

  public getStats(): ExecutionLearningStats { return { ...this.stats }; }

  private onCompleted(event: ExecutionEvent): void {
    this.stats.completed += 1;
    if (!event.passed) return;
    componentRegistryService.recordExecutionOutcome(event.component_id, event.implementation_hash, 'SUCCESS');
    capabilityReuseService.recordSuccess({
      goal: event.metadata?.goal?.toString() || event.component_id,
      component_ids: [event.component_id],
      environment: event.environment,
      implementation_hashes: { [event.component_id]: event.implementation_hash },
      output_summary: event.output_summary || '',
      duration_ms: event.duration_ms,
      runner_id: event.runner_id || 'event-bus',
    });
    this.stats.reuseRecorded += 1;
  }

  private onFailed(event: ExecutionEvent): void {
    this.stats.failed += 1;
    componentRegistryService.recordExecutionOutcome(event.component_id, event.implementation_hash, 'FAILURE');
    failureMemoryService.recordFailure({
      goal: event.metadata?.goal?.toString() || event.component_id,
      component_id: event.component_id,
      implementation_hash: event.implementation_hash,
      environment: event.environment,
      test_category: event.test_category,
      test_case_id: event.test_case_id,
      error_signature: event.error_message || event.output_summary || 'execution_failed',
      error_message: event.error_message,
      input_summary: event.metadata?.input_summary?.toString() || '',
      runner_id: event.runner_id || 'event-bus',
    });
    this.stats.failuresRecorded += 1;

    // 回帰試験そのものの失敗はPromotion Gateを閉じる材料なので、自動Recoveryは起動しない。
    if (event.test_category === 'REGRESSION') return;
    this.startRecovery(event).catch(() => undefined);
  }

  private onRejected(event: ExecutionEvent): void {
    this.stats.rejected += 1;
  }

  private async startRecovery(event: ExecutionEvent): Promise<void> {
    const environment = event.environment as ExecutionEnvironment;
    const run = recoveryOrchestratorService.start(
      event.metadata?.goal?.toString() || event.component_id,
      environment,
      3,
      taskExecutionOrchestratorService.findTaskByRequest(event.request_id)?.task_id,
    );
    const result = await recoveryOrchestratorService.recover({
      recoveryRunId: run.recovery_run_id,
      failedComponentId: event.component_id,
      implementationHash: event.implementation_hash,
      attempts: 0,
      maxAttempts: 2,
      errorMessage: event.error_message,
    });
    if (result.status !== 'FAILED' && result.status !== 'BLOCKED') this.stats.recoveriesStarted += 1;
  }
}

export const executionLearningCoordinatorService = ExecutionLearningCoordinatorService.getInstance();
