import { systemLogger } from './systemLogger';
import { storageService } from './storageService';

export interface TaskLineageRecord {
  lineage_id: string;
  conversation_id?: string;
  message_id?: string;
  request_id?: string;
  task_id: string;
  run_id?: string;
  goal: string;
  environment: string;
  created_at: number;
  updated_at: number;
}

/** 会話→要求→Task→Runの追跡だけを担当。実行や真偽判定は行わない。 */
export class TaskLineageService {
  private static instance: TaskLineageService;
  private records: TaskLineageRecord[] = [];
  private initialized = false;
  private readonly storageKey = 'miki_task_lineage_v1';
  private constructor() { this.load(); }
  public static getInstance(): TaskLineageService { return this.instance || (this.instance = new TaskLineageService()); }
  public initialize(): void { if (!this.initialized) { this.initialized = true; systemLogger.info('TOOLS', '🔗 [TaskLineage] initialized'); } }
  public dispose(): void { this.initialized = false; }
  public link(input: Omit<TaskLineageRecord, 'lineage_id'|'created_at'|'updated_at'>): TaskLineageRecord {
    const existing = this.records.find(r => r.task_id === input.task_id);
    const now = Date.now();
    if (existing) { Object.assign(existing, input, { updated_at: now }); this.save(); return existing; }
    const record: TaskLineageRecord = { ...input, lineage_id: `LINEAGE-${this.hash(`${input.task_id}|${input.request_id || ''}`)}`, created_at: now, updated_at: now };
    this.records.unshift(record); this.records = this.records.slice(0, 2000); this.save(); return record;
  }
  public updateTaskRun(taskId: string, runId: string, requestId?: string): TaskLineageRecord | undefined {
    const r = this.records.find(x => x.task_id === taskId); if (!r) return undefined;
    r.run_id = runId; if (requestId) r.request_id = requestId; r.updated_at = Date.now(); this.save(); return r;
  }
  public getByTask(taskId: string): TaskLineageRecord | undefined { return this.records.find(r => r.task_id === taskId); }
  public getByRequest(requestId: string): TaskLineageRecord | undefined { return this.records.find(r => r.request_id === requestId); }
  public list(): TaskLineageRecord[] { return [...this.records]; }
  private load(): void { try { const raw = storageService.getItem(this.storageKey); if (raw) this.records = JSON.parse(raw); } catch { this.records = []; } }
  private save(): void { try { storageService.setItem(this.storageKey, JSON.stringify(this.records)); } catch {} }
  private hash(raw: string): string { let h=2166136261; for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(16).padStart(8,'0'); }
}
export const taskLineageService = TaskLineageService.getInstance();
