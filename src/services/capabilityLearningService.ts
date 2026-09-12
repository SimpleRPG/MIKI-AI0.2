import { ExecutionEvent } from './executionEventBusService';
import { componentRegistryService } from './componentRegistryService';
import { failureMemoryService } from './failureMemoryService';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';

export type CapabilityLearningMaturity = 'OBSERVED' | 'REUSABLE' | 'STABLE';

export interface CapabilityLearningRecord {
  learning_id: string;
  task_id: string;
  request_id: string;
  goal: string;
  component_ids: string[];
  environment: string;
  implementation_hashes: Record<string, string>;
  evidence_event_id: string;
  outcome: 'SUCCESS' | 'FAILURE';
  maturity: CapabilityLearningMaturity;
  created_at: number;
  updated_at: number;
}

/**
 * 実行経験を「能力学習ケース」として昇格させる層。
 * CapabilityReuseとは分離し、実行事実→ケース成熟度だけを扱う。
 * VERIFIEDそのものを決めたり、任意コードを実行したりはしない。
 */
export class CapabilityLearningService {
  private static instance: CapabilityLearningService;
  private initialized = false;
  private records: CapabilityLearningRecord[] = [];
  private readonly storageKey = 'miki_capability_learning_v1';

  private constructor() { this.load(); }
  public static getInstance(): CapabilityLearningService {
    if (!this.instance) this.instance = new CapabilityLearningService();
    return this.instance;
  }

  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    systemLogger.info('TOOLS', '🧠 [CapabilityLearning] initialized');
  }

  public dispose(): void {
    this.initialized = false;
  }

  public list(): CapabilityLearningRecord[] { return [...this.records]; }
  public getForTask(taskId: string): CapabilityLearningRecord[] {
    return this.records.filter(r => r.task_id === taskId);
  }

  public recordCompletedExecution(input: {
    event: ExecutionEvent;
    taskId: string;
    goal: string;
    componentIds: string[];
  }): CapabilityLearningRecord | undefined {
    const event = input.event;
    if (event.passed !== true) return undefined;
    const componentIds = input.componentIds.length ? input.componentIds : [event.component_id];
    const hashes: Record<string, string> = {};
    for (const id of componentIds) {
      const component = componentRegistryService.getComponent(id);
      if (!component || component.status !== 'VERIFIED') return undefined;
      if (component.implementation_hash === event.implementation_hash) hashes[id] = component.implementation_hash;
      else if (id === event.component_id) return undefined;
      else hashes[id] = component.implementation_hash;
      if (failureMemoryService.shouldAvoid(id, event.environment, hashes[id])) return undefined;
    }
    const signature = componentIds.join('>');
    const prior = this.records.filter(r => r.outcome === 'SUCCESS' && r.goal.trim().toLowerCase() === input.goal.trim().toLowerCase() && r.environment === event.environment && r.component_ids.join('>') === signature);
    return this.record({
      task_id: input.taskId, request_id: event.request_id, goal: input.goal,
      component_ids: componentIds, environment: event.environment,
      implementation_hashes: hashes, evidence_event_id: event.event_id, outcome: 'SUCCESS',
      maturity: prior.length >= 2 ? 'STABLE' : 'REUSABLE',
    });
  }

  public recordFailedExecution(input: {
    event: ExecutionEvent;
    taskId: string;
    goal: string;
  }): CapabilityLearningRecord | undefined {
    const event = input.event;
    return this.record({
      task_id: input.taskId, request_id: event.request_id, goal: input.goal,
      component_ids: [event.component_id], environment: event.environment,
      implementation_hashes: { [event.component_id]: event.implementation_hash },
      evidence_event_id: event.event_id, outcome: 'FAILURE', maturity: 'OBSERVED',
    });
  }

  /** 次回計画で優先すべき、現在も有効な学習済みComponent集合。 */
  public findPreferredComponentSets(goal: string, environment?: string): Array<{ component_ids: string[]; maturity: CapabilityLearningMaturity; score: number; learning_id: string }> {
    const needle = goal.trim().toLowerCase();
    if (!needle) return [];
    return this.records.filter(r => {
      if (r.outcome !== 'SUCCESS') return false;
      if (environment && r.environment !== environment) return false;
      const rg = r.goal.toLowerCase();
      if (!(rg === needle || rg.includes(needle) || needle.includes(rg))) return false;
      return r.component_ids.every(id => {
        const c = componentRegistryService.getComponent(id);
        return !!c && c.status === 'VERIFIED' && c.implementation_hash === r.implementation_hashes[id] && !failureMemoryService.shouldAvoid(id, r.environment, r.implementation_hashes[id]);
      });
    }).sort((a,b) => this.maturityScore(b.maturity)-this.maturityScore(a.maturity) || b.updated_at-a.updated_at)
      .slice(0, 5)
      .map(r => ({ component_ids: [...r.component_ids], maturity: r.maturity, score: this.maturityScore(r.maturity), learning_id: r.learning_id }));
  }

  private maturityScore(m: CapabilityLearningMaturity): number {
    return m === 'STABLE' ? 300 : m === 'REUSABLE' ? 200 : 100;
  }


  private record(input: Omit<CapabilityLearningRecord, 'learning_id' | 'created_at' | 'updated_at'>): CapabilityLearningRecord {
    if (this.records.some(r => r.evidence_event_id === input.evidence_event_id)) return this.records.find(r => r.evidence_event_id === input.evidence_event_id)!;
    const now = Date.now();
    const record: CapabilityLearningRecord = {
      ...input,
      learning_id: `LEARN-${this.hash(`${input.task_id}|${input.request_id}|${input.evidence_event_id}`)}`,
      created_at: now,
      updated_at: now,
    };
    this.records.unshift(record);
    this.records = this.records.slice(0, 1000);
    this.save();
    systemLogger.info('TOOLS', `🧠 [CapabilityLearning] ${record.learning_id}: ${record.outcome}/${record.maturity}`);
    return record;
  }

  private load(): void {
    try {
      const raw = storageService.getItem(this.storageKey);
      if (raw) this.records = JSON.parse(raw);
    } catch { this.records = []; }
  }
  private save(): void {
    try { storageService.setItem(this.storageKey, JSON.stringify(this.records)); } catch { /* optional */ }
  }
  private hash(raw: string): string {
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

export const capabilityLearningService = CapabilityLearningService.getInstance();
