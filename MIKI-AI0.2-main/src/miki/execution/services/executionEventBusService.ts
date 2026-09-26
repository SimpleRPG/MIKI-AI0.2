export type ExecutionEventType =
  | 'execution.queued'
  | 'execution.submitted'
  | 'execution.completed'
  | 'execution.failed'
  | 'execution.rejected'
  | 'execution.inconclusive';

export interface ExecutionEvent {
  event_id: string;
  type: ExecutionEventType;
  request_id: string;
  component_id: string;
  implementation_hash: string;
  environment: string;
  test_category: string;
  test_case_id: string;
  passed?: boolean;
  output_summary?: string;
  error_message?: string;
  runner_id?: string;
  duration_ms?: number;
  created_at: number;
  metadata?: Record<string, string | number | boolean>;
}

export type ExecutionEventHandler = (event: ExecutionEvent) => void;

/**
 * 実行結果を各学習・回復・再利用層へ一貫して配送する軽量Event Bus。
 * Event Bus自身は「真実判定」「昇格」「任意コード実行」を行わない。
 */
export class ExecutionEventBusService {
  private static instance: ExecutionEventBusService;
  private handlers = new Map<ExecutionEventType, Set<ExecutionEventHandler>>();
  private history: ExecutionEvent[] = [];
  private readonly maxHistory = 1000;

  private constructor() {}

  public static getInstance(): ExecutionEventBusService {
    if (!this.instance) this.instance = new ExecutionEventBusService();
    return this.instance;
  }

  public subscribe(type: ExecutionEventType, handler: ExecutionEventHandler): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set<ExecutionEventHandler>();
      this.handlers.set(type, set);
    }
    set.add(handler);
    return () => set?.delete(handler);
  }

  public publish(input: Omit<ExecutionEvent, 'event_id' | 'created_at'>): ExecutionEvent {
    const event: ExecutionEvent = {
      ...input,
      event_id: `EVT-${this.hash(`${input.request_id}|${input.type}|${input.component_id}|${input.test_case_id}|${this.history.length}`)}`,
      created_at: Date.now(),
    };
    this.history.unshift(event);
    if (this.history.length > this.maxHistory) this.history.length = this.maxHistory;

    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const handler of Array.from(handlers)) {
        try { handler(event); } catch { /* one subscriber must not break execution flow */ }
      }
    }
    return event;
  }

  public list(type?: ExecutionEventType): ExecutionEvent[] {
    return type ? this.history.filter(e => e.type === type) : [...this.history];
  }

  public clearHistory(): void { this.history = []; }

  private hash(raw: string): string {
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) {
      h ^= raw.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

export const executionEventBusService = ExecutionEventBusService.getInstance();
