import { ExecutionEvent, executionEventBusService } from './executionEventBusService';
import { planOrchestratorService } from './planOrchestratorService';
import { taskExecutionOrchestratorService } from './taskExecutionOrchestratorService';
import { taskCaseMemoryService } from './taskCaseMemoryService';
import { taskLineageService } from './taskLineageService';
import { componentRegistryService } from './componentRegistryService';
import { systemLogger } from './systemLogger';

export interface TaskFeedbackSnapshot {
  task_id: string;
  status: 'WAITING_FOR_RUNNER' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
  request_id: string;
  component_id: string;
  output_summary?: string;
  error_message?: string;
  next_request_id?: string;
  updated_at: number;
}

/**
 * Execution Event BusからTaskへ結果を戻すフィードバック境界。
 * Runnerの結果を直接会話へ流さず、Orchestratorの状態→Task状態の順に確定する。
 */
export class TaskResultFeedbackService {
  private static instance: TaskResultFeedbackService;
  private initialized = false;
  private snapshots = new Map<string, TaskFeedbackSnapshot>();
  private unsubs: Array<() => void> = [];
  private constructor() {}

  public static getInstance(): TaskResultFeedbackService {
    if (!this.instance) this.instance = new TaskResultFeedbackService();
    return this.instance;
  }

  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.unsubs.push(executionEventBusService.subscribe('execution.completed', e => this.onEvent(e)));
    this.unsubs.push(executionEventBusService.subscribe('execution.failed', e => this.onEvent(e)));
    this.unsubs.push(executionEventBusService.subscribe('execution.rejected', e => this.onEvent(e)));
  }

  public dispose(): void {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
    this.initialized = false;
  }

  public getFeedback(taskId: string): TaskFeedbackSnapshot | undefined { return this.snapshots.get(taskId); }

  private onEvent(event: ExecutionEvent): void {
    const task = taskExecutionOrchestratorService.findTaskByRequest(event.request_id);
    if (!task || !task.run_id) return;

    const runBefore = planOrchestratorService.getRun(task.run_id);
    if (!runBefore) return;

    const result = planOrchestratorService.applyExecutionEventResult({
      request_id: event.request_id,
      passed: event.passed === true,
      output_summary: event.output_summary,
      error_message: event.error_message,
      environment: event.environment as import('./executionRunnerService').ExecutionEnvironment,
      implementation_hash: event.implementation_hash,
    });

    if (!result.accepted) {
      systemLogger.warn('TOOLS', `⚠️ [TaskResultFeedback] result rejected: ${result.reason}`);
      return;
    }

    const run = planOrchestratorService.getRun(task.run_id);
    if (!run) return;
    const updatedTask = taskExecutionOrchestratorService.updateFromOrchestrator(run) || task;
    taskLineageService.updateTaskRun(task.task_id, task.run_id, event.request_id);

    if (event.type === 'execution.completed' && event.passed === true && run.status === 'COMPLETED') {
      const steps = run.steps.filter(s => s.status === 'COMPLETED');
      const hashes: Record<string, string> = {};
      for (const step of steps) { if (step.implementation_hash) hashes[step.component_id] = step.implementation_hash; }
      taskCaseMemoryService.recordSuccess({ taskId: task.task_id, goal: task.goal, environment: task.environment, componentIds: steps.map(s => s.component_id), hashes, requestId: event.request_id, evidenceEventId: event.event_id, outputSummary: event.output_summary });
    } else if (event.type === 'execution.failed') {
      taskCaseMemoryService.recordFailure({ taskId: task.task_id, goal: task.goal, environment: task.environment, componentId: event.component_id, implementationHash: event.implementation_hash, requestId: event.request_id, evidenceEventId: event.event_id, errorMessage: event.error_message });
    }

    const snapshot: TaskFeedbackSnapshot = {
      task_id: task.task_id,
      status: updatedTask.status === 'READY' ? 'WAITING_FOR_RUNNER' : updatedTask.status,
      request_id: event.request_id,
      component_id: event.component_id,
      output_summary: event.output_summary,
      error_message: event.error_message,
      next_request_id: result.nextRequest?.request_id,
      updated_at: Date.now(),
    };
    this.snapshots.set(task.task_id, snapshot);
    systemLogger.info('TOOLS', `🔄 [TaskResultFeedback] ${task.task_id} <- ${event.request_id} (${snapshot.status})`);
  }
}

export const taskResultFeedbackService = TaskResultFeedbackService.getInstance();
