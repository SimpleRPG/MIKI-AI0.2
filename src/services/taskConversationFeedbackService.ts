import { ExecutionEvent, executionEventBusService } from './executionEventBusService';
import { taskExecutionOrchestratorService } from './taskExecutionOrchestratorService';
import { taskResultFeedbackService, TaskFeedbackSnapshot } from './taskResultFeedbackService';
import { systemLogger } from './systemLogger';

export type TaskConversationFeedbackKind = 'STARTED' | 'PROGRESS' | 'COMPLETED' | 'FAILED' | 'BLOCKED';

export interface TaskConversationFeedback {
  task_id: string;
  kind: TaskConversationFeedbackKind;
  text: string;
  status: string;
  request_id?: string;
  created_at: number;
}

/**
 * Task/Executionの結果を「会話で返せる事実」に変換する最終境界。
 * 任意コードを実行せず、Event/Orchestratorの状態だけを表層文へ変換する。
 */
export class TaskConversationFeedbackService {
  private static instance: TaskConversationFeedbackService;
  private initialized = false;
  private listeners = new Set<(feedback: TaskConversationFeedback) => void>();
  private emittedRequests = new Set<string>();
  private latest = new Map<string, TaskConversationFeedback>();
  private unsubs: Array<() => void> = [];

  private constructor() {}

  public static getInstance(): TaskConversationFeedbackService {
    if (!this.instance) this.instance = new TaskConversationFeedbackService();
    return this.instance;
  }

  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.unsubs.push(executionEventBusService.subscribe('execution.completed', e => this.onExecutionEvent(e)));
    this.unsubs.push(executionEventBusService.subscribe('execution.failed', e => this.onExecutionEvent(e)));
    this.unsubs.push(executionEventBusService.subscribe('execution.rejected', e => this.onExecutionEvent(e)));
  }

  public dispose(): void {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
    this.initialized = false;
    this.listeners.clear();
  }

  public subscribe(listener: (feedback: TaskConversationFeedback) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getLatest(taskId: string): TaskConversationFeedback | undefined {
    return this.latest.get(taskId);
  }

  /** 初回Task作成直後にUIへ返す。 */
  public publishStarted(taskId: string): TaskConversationFeedback | undefined {
    const task = taskExecutionOrchestratorService.getTask(taskId);
    if (!task) return undefined;
    const feedback: TaskConversationFeedback = {
      task_id: task.task_id,
      kind: task.status === 'BLOCKED' ? 'BLOCKED' : 'STARTED',
      status: task.status,
      text: task.status === 'BLOCKED'
        ? `実行タスクを作れませんでした。${task.reason || ''}`.trim()
        : `実行タスクを開始しました。現在は${this.statusLabel(task.status)}です。`,
      request_id: task.first_request?.request_id,
      created_at: Date.now(),
    };
    return this.emit(feedback);
  }

  private onExecutionEvent(event: ExecutionEvent): void {
    if (this.emittedRequests.has(event.request_id)) return;

    const task = taskExecutionOrchestratorService.findTaskByRequest(event.request_id);
    if (!task) return;

    // TaskResultFeedbackServiceが先にOrchestrator状態を確定している前提で読む。
    const snapshot: TaskFeedbackSnapshot | undefined = taskResultFeedbackService.getFeedback(task.task_id);
    const current = taskExecutionOrchestratorService.getTask(task.task_id);
    if (!current) return;

    this.emittedRequests.add(event.request_id);

    const status = snapshot?.status || current.status;
    const nextRequestId = snapshot?.next_request_id;
    const verificationPromoted = event.metadata?.verification_promoted === true;

    let kind: TaskConversationFeedbackKind;
    let text: string;

    if (event.type === 'execution.completed' && event.passed === true) {
      if (current.status === 'COMPLETED') {
        kind = 'COMPLETED';
        text = verificationPromoted
          ? `タスクが完了しました。実行結果を確認し、部品は検証済み状態への昇格条件も通過しました。`
          : `タスクが完了しました。実行結果を受け取りました。`;
      } else {
        kind = 'PROGRESS';
        text = nextRequestId
          ? `Step ${event.component_id} の実行が完了しました。次の実行要求 ${nextRequestId} を発行しました。`
          : `Step ${event.component_id} の実行が完了しました。次の処理を待っています。`;
      }
    } else if (event.type === 'execution.failed') {
      kind = 'FAILED';
      text = `Step ${event.component_id} の実行に失敗しました。失敗履歴を記録し、代替・再調査などの復旧判断へ渡しました。`;
      if (event.error_message) text += ` 原因: ${event.error_message}`;
    } else {
      kind = 'BLOCKED';
      text = `実行要求 ${event.request_id} は受理されませんでした。${event.error_message || ''}`.trim();
    }

    this.emit({
      task_id: task.task_id,
      kind,
      status,
      text,
      request_id: event.request_id,
      created_at: Date.now(),
    });
  }

  private emit(feedback: TaskConversationFeedback): TaskConversationFeedback {
    this.latest.set(feedback.task_id, feedback);
    for (const listener of this.listeners) {
      try { listener(feedback); } catch (error) {
        systemLogger.warn('CHAT', `[TaskConversationFeedback] listener failed: ${String(error)}`);
      }
    }
    return feedback;
  }

  private statusLabel(status: string): string {
    switch (status) {
      case 'WAITING_FOR_RUNNER': return 'Runnerの実行待ち';
      case 'RUNNING': return '実行中';
      case 'COMPLETED': return '完了';
      case 'FAILED': return '失敗';
      case 'BLOCKED': return 'ブロック';
      default: return status;
    }
  }
}

export const taskConversationFeedbackService = TaskConversationFeedbackService.getInstance();
