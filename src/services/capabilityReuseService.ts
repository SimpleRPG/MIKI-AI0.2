import { componentRegistryService } from './componentRegistryService';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';
import { failureMemoryService } from './failureMemoryService';
import { componentVersionHistoryService } from './componentVersionHistoryService';

export interface CapabilityReuseRecord {
  reuse_id: string;
  goal: string;
  component_ids: string[];
  environment: string;
  implementation_hashes: Record<string, string>;
  output_summary: string;
  duration_ms?: number;
  runner_id: string;
  created_at: number;
}

/**
 * 成功した能力実行を「再利用可能な実績」として保持する層。
 * 真実性ではなく実行事実を保存し、現在のComponent hashが一致する場合だけ再利用候補にする。
 */
export class CapabilityReuseService {
  private static instance: CapabilityReuseService;
  private records: CapabilityReuseRecord[] = [];
  private readonly storageKey = 'miki_capability_reuse_v1';

  private constructor() { this.load(); }
  public static getInstance(): CapabilityReuseService {
    if (!this.instance) this.instance = new CapabilityReuseService();
    return this.instance;
  }

  public recordSuccess(input: Omit<CapabilityReuseRecord, 'reuse_id' | 'created_at'>): CapabilityReuseRecord {
    const record: CapabilityReuseRecord = {
      ...input,
      reuse_id: `REUSE-${this.hash(`${input.goal}|${input.environment}|${Object.entries(input.implementation_hashes).sort().join('|')}|${Date.now()}`)}`,
      created_at: Date.now(),
    };
    this.records.unshift(record);
    this.records = this.records.slice(0, 500);
    this.save();
    systemLogger.info('TOOLS', `♻️ [CapabilityReuse] success recorded: ${record.reuse_id}`);
    return record;
  }

  public findReusable(goal: string, environment?: string): CapabilityReuseRecord[] {
    const needle = goal.trim().toLowerCase();
    return this.records.filter(record => {
      if (environment && record.environment !== environment) return false;
      if (!record.component_ids.length) return false;
      if (!record.goal.toLowerCase().includes(needle) && !needle.includes(record.goal.toLowerCase())) return false;
      return record.component_ids.every(id => {
        const component = componentRegistryService.getComponent(id);
        return !!component && component.status === 'VERIFIED' && component.implementation_hash === record.implementation_hashes[id] && componentVersionHistoryService.isCurrent(id, component.version, record.implementation_hashes[id]) && !failureMemoryService.shouldAvoid(id, record.environment, record.implementation_hashes[id]);
      });
    }).slice(0, 5);
  }

  public getReusableByComponents(componentIds: string[], environment?: string): CapabilityReuseRecord[] {
    const wanted = new Set(componentIds);
    return this.records.filter(record => {
      if (environment && record.environment !== environment) return false;
      if (!record.component_ids.every(id => wanted.has(id))) return false;
      return record.component_ids.every(id => {
        const component = componentRegistryService.getComponent(id);
        return !!component && component.status === 'VERIFIED' && component.implementation_hash === record.implementation_hashes[id] && componentVersionHistoryService.isCurrent(id, component.version, record.implementation_hashes[id]) && !failureMemoryService.shouldAvoid(id, record.environment, record.implementation_hashes[id]);
      });
    }).slice(0, 5);
  }

  public list(): CapabilityReuseRecord[] { return [...this.records]; }

  private load(): void {
    try {
      const raw = storageService.getItem(this.storageKey);
      if (raw) this.records = JSON.parse(raw);
    } catch { this.records = []; }
  }
  private save(): void {
    try { storageService.setItem(this.storageKey, JSON.stringify(this.records)); } catch { /* storage is optional */ }
  }
  private hash(raw: string): string {
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

export const capabilityReuseService = CapabilityReuseService.getInstance();
