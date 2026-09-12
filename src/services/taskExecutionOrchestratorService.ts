import { ExecutionEnvironment, ExecutionRequest } from './executionRunnerService';
import { planOrchestratorService, OrchestratorRun } from './planOrchestratorService';
import { componentCompositionService } from './componentCompositionService';
import { capabilityGraphService } from './capabilityGraphService';
import { failureMemoryService } from './failureMemoryService';
import { systemLogger } from './systemLogger';
import { executionEventBusService, ExecutionEvent } from './executionEventBusService';
import { capabilityLearningService } from './capabilityLearningService';
import { taskLineageService } from './taskLineageService';
import { taskCaseMemoryService } from './taskCaseMemoryService';
import { componentRegistryService } from './componentRegistryService';
import { decisionLearningService } from './decisionLearningService';
import { deterministicCapabilityEvolutionService } from './deterministicCapabilityEvolutionService';
import { unifiedMikiExperienceService } from './unifiedMikiExperienceService';
import { mikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';

export type TaskExecutionStatus = 'READY' | 'WAITING_FOR_RUNNER' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';

export interface TaskExecutionHandle {
  task_id: string;
  goal: string;
  environment: ExecutionEnvironment;
  status: TaskExecutionStatus;
  run_id?: string;
  first_request?: ExecutionRequest;
  reason?: string;
  component_ids: string[];
  created_at: number;
  conversation_id?: string;
  message_id?: string;
  source_request_id?: string;
  decision_id?: string;
}

/**
 * 会話要求を実行系へ橋渡しする境界。
 * 自動実行はせず、検証済みCompositionから安全なExecutionRequestを発行するだけ。
 */
export class TaskExecutionOrchestratorService {
  private static instance: TaskExecutionOrchestratorService;
  private tasks = new Map<string, TaskExecutionHandle>();
  private initialized = false;
  private unsubs: Array<() => void> = [];
  private constructor() {}

  public static getInstance(): TaskExecutionOrchestratorService {
    if (!this.instance) this.instance = new TaskExecutionOrchestratorService();
    return this.instance;
  }


  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.unsubs.push(executionEventBusService.subscribe('execution.completed', e => this.onExecutionCompleted(e)));
    this.unsubs.push(executionEventBusService.subscribe('execution.failed', e => this.onExecutionFailed(e)));
    systemLogger.info('TOOLS', '🧩 [TaskExecutionOrchestrator] initialized');
  }

  public dispose(): void {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
    this.initialized = false;
  }

  private evaluateLinkedDecision(task: TaskExecutionHandle, event: ExecutionEvent, outcome: 'SUCCESS' | 'FAILURE'): void {
    if (!task.decision_id) return;
    const run = task.run_id ? planOrchestratorService.getRun(task.run_id) : undefined;
    // 多段Compositionでは中間Stepの成功/失敗を判断全体の結果にしない。最終状態だけを評価する。
    if (run && !['COMPLETED', 'FAILED', 'BLOCKED'].includes(run.status)) return;
    const checkpoint = 'NEXT_USE';
    const ok = decisionLearningService.evaluateDecision(
      task.decision_id,
      checkpoint,
      outcome,
      outcome === 'SUCCESS'
        ? `実行結果PASS: ${event.output_summary || '出力あり'}`
        : `実行結果FAIL: ${event.error_message || event.output_summary || '実行失敗'}`,
      outcome === 'SUCCESS' ? undefined : 'IMPLEMENTATION_ERROR',
    );
    if (ok) systemLogger.info('SELF_IMPROVEMENT', `🧠 [8.4 自動遅延評価] decision=${task.decision_id} outcome=${outcome}`);
  }

  private onExecutionCompleted(event: ExecutionEvent): void {
    const task = this.findTaskByRequest(event.request_id);
    if (!task || event.passed !== true) return;
    this.evaluateLinkedDecision(task, event, 'SUCCESS');
    const run = task.run_id ? planOrchestratorService.getRun(task.run_id) : undefined;
    // 多段Compositionは最終Run完了時だけ学習へ戻す。中間PASSを成功能力として固定しない。
    if (run && run.status !== 'COMPLETED') return;
    const componentIds = run?.steps.map(s => s.component_id) || task.component_ids;
    const learning = capabilityLearningService.recordCompletedExecution({
      event, taskId: task.task_id, goal: task.goal, componentIds,
    });
    if (!learning) return;
    const hashes = learning.implementation_hashes;
    mikiUnifiedLearningContinuumService.observe({ domain: 'execution', key: task.goal, outcome: 'SUCCESS', verified: true, capabilityIds: componentIds, concepts: task.goal.split(/[^\p{L}\p{N}_-]+/u).filter(Boolean).slice(0, 12) });
    unifiedMikiExperienceService.observeExecution({ action: 'completed', goal: task.goal, outcome: 'SUCCESS', verified: true, capabilityIds: componentIds, lesson: 'verified execution became reusable experience' });
    taskCaseMemoryService.recordSuccess({
      taskId: task.task_id,
      goal: task.goal,
      environment: task.environment,
      componentIds,
      hashes,
      requestId: event.request_id,
      evidenceEventId: event.event_id,
      outputSummary: event.output_summary,
    });
    deterministicCapabilityEvolutionService.compileExecutionEvidence({
      taskId: task.task_id,
      requestId: event.request_id,
      goal: task.goal,
      environment: task.environment,
      componentIds,
      implementationHashes: hashes,
      evidenceEventId: event.event_id,
      outputSummary: event.output_summary,
    });
  }

  private onExecutionFailed(event: ExecutionEvent): void {
    const task = this.findTaskByRequest(event.request_id);
    if (!task) return;
    this.evaluateLinkedDecision(task, event, 'FAILURE');
    capabilityLearningService.recordFailedExecution({
      event, taskId: task.task_id, goal: task.goal,
    });
    mikiUnifiedLearningContinuumService.observe({ domain: 'execution', key: task.goal, outcome: 'FAILURE', verified: false, capabilityIds: [event.component_id], concepts: task.goal.split(/[^\p{L}\p{N}_-]+/u).filter(Boolean).slice(0, 12) });
    unifiedMikiExperienceService.observeExecution({ action: 'failed', goal: task.goal, outcome: 'FAILURE', verified: false, capabilityIds: [event.component_id], lesson: event.error_message || 'execution failed' });
    taskCaseMemoryService.recordFailure({
      taskId: task.task_id,
      goal: task.goal,
      environment: task.environment,
      componentId: event.component_id,
      implementationHash: event.implementation_hash,
      requestId: event.request_id,
      evidenceEventId: event.event_id,
      errorMessage: event.error_message || event.output_summary,
    });
  }

  public startFromRequest(goal: string, environment: ExecutionEnvironment = 'ANDROID', context?: { conversationId?: string; messageId?: string; requestId?: string; decisionId?: string }): TaskExecutionHandle {
    const now = Date.now();
    // まず過去に同じ目的で成功した現在有効なCaseを再利用する。
    // Caseは絶対視せず、Composition層で現行Componentの安全条件を再検証する。
    const reusableCase = taskCaseMemoryService.findReusable(goal, environment).find(candidate => candidate.component_ids.every(id => {
      const c = componentRegistryService.getComponent(id);
      return !!c && failureMemoryService.assessRisk(id, environment, c.implementation_hash).risk_score < 60;
    }));
    const remembered = reusableCase
      ? componentCompositionService.composeFromComponentIds(goal, reusableCase.component_ids, environment)
      : undefined;
    const graph = remembered?.executable ? undefined : capabilityGraphService.plan(goal, 4, [], environment);
    const composition = remembered?.executable
      ? remembered
      : (graph ? componentCompositionService.composeFromCapabilityPlan(goal, graph) : undefined);
    const components = composition?.executable ? composition.steps.map(s => s.component_id) : [];

    if (!composition?.executable || components.length === 0) {
      const task: TaskExecutionHandle = {
        task_id: `TASK-${this.hash(`${goal}|${environment}|${now}`)}`,
        goal, environment, status: 'BLOCKED',
        reason: composition?.blocked_reason || '検証済み部品だけでは実行可能なCompositionを構成できません。',
        component_ids: components, created_at: now, conversation_id: context?.conversationId, message_id: context?.messageId, source_request_id: context?.requestId, decision_id: context?.decisionId,
      };
      this.tasks.set(task.task_id, task);
      return task;
    }

    const avoid = components.filter(id => {
      const component = composition.steps.find(s => s.component_id === id);
      const current = componentRegistryService.getComponent(id);
      return current ? failureMemoryService.shouldAvoid(id, environment, current.implementation_hash) : true;
    });
    if (avoid.length) {
      const task: TaskExecutionHandle = {
        task_id: `TASK-${this.hash(`${goal}|${environment}|${now}`)}`,
        goal, environment, status: 'BLOCKED',
        reason: `既知の失敗履歴がある部品を検出: ${avoid.join(', ')}`,
        component_ids: components, created_at: now, conversation_id: context?.conversationId, message_id: context?.messageId, source_request_id: context?.requestId, decision_id: context?.decisionId,
      };
      this.tasks.set(task.task_id, task);
      return task;
    }

    const run: OrchestratorRun = planOrchestratorService.createRunFromPlan(composition, environment, context?.decisionId);
    if (run.status === 'BLOCKED') {
      const task: TaskExecutionHandle = {
        task_id: `TASK-${this.hash(`${goal}|${environment}|${now}`)}`,
        goal, environment, status: 'BLOCKED', run_id: run.run_id,
        reason: run.reason, component_ids: components, created_at: now, conversation_id: context?.conversationId, message_id: context?.messageId, source_request_id: context?.requestId, decision_id: context?.decisionId,
      };
      this.tasks.set(task.task_id, task);
      return task;
    }

    const firstRequest = planOrchestratorService.dispatchNext(run.run_id);
    const task: TaskExecutionHandle = {
      task_id: `TASK-${this.hash(`${goal}|${environment}|${now}`)}`,
      goal, environment,
      status: firstRequest ? 'WAITING_FOR_RUNNER' : 'READY',
      run_id: run.run_id, first_request: firstRequest,
      component_ids: components, created_at: now, conversation_id: context?.conversationId, message_id: context?.messageId, source_request_id: context?.requestId, decision_id: context?.decisionId,
    };
    this.tasks.set(task.task_id, task);
    taskLineageService.link({ task_id: task.task_id, goal: task.goal, environment: task.environment, run_id: task.run_id, request_id: context?.requestId || firstRequest?.request_id, conversation_id: context?.conversationId, message_id: context?.messageId });
    systemLogger.info('TOOLS', `🧩 [TaskExecutionOrchestrator] ${task.task_id} -> ${run.run_id}`);
    return task;
  }

  public updateFromOrchestrator(run: OrchestratorRun): TaskExecutionHandle | undefined {
    const task = [...this.tasks.values()].find(t => t.run_id === run.run_id);
    if (!task) return undefined;
    task.status = run.status === 'COMPLETED' ? 'COMPLETED'
      : run.status === 'FAILED' ? 'FAILED'
      : run.status === 'BLOCKED' ? 'BLOCKED'
      : run.status === 'RUNNING' ? 'RUNNING'
      : task.first_request ? 'WAITING_FOR_RUNNER' : 'READY';
    task.reason = run.reason;
    return task;
  }

  public findTaskByRequest(requestId: string): TaskExecutionHandle | undefined {
    return [...this.tasks.values()].find(task => task.first_request?.request_id === requestId || task.run_id && planOrchestratorService.getRun(task.run_id)?.steps.some(s => s.request_id === requestId));
  }

  public getTask(taskId: string): TaskExecutionHandle | undefined { return this.tasks.get(taskId); }
  public listTasks(): TaskExecutionHandle[] { return [...this.tasks.values()].sort((a,b) => b.created_at - a.created_at); }

  private hash(raw: string): string {
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

export const taskExecutionOrchestratorService = TaskExecutionOrchestratorService.getInstance();
