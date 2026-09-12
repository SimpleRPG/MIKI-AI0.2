import { componentRegistryService } from './componentRegistryService';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';

export interface FailureRiskAssessment {
  component_id: string;
  implementation_hash: string;
  environment: string;
  risk_score: number;
  failure_count: number;
  recent_failure_count: number;
  reason: string;
}

export interface FailureMemoryRecord {
  failure_id: string;
  goal: string;
  component_id: string;
  implementation_hash: string;
  environment: string;
  test_category: string;
  test_case_id?: string;
  error_signature: string;
  error_message?: string;
  input_summary?: string;
  runner_id: string;
  count: number;
  first_seen_at: number;
  last_seen_at: number;
}

/** 失敗を「真実」ではなく再発防止用の実行事実として保持する。 */
export class FailureMemoryService {
  private static instance: FailureMemoryService;
  private records: FailureMemoryRecord[] = [];
  private readonly storageKey = 'miki_failure_memory_v1';
  private constructor() { this.load(); }
  public static getInstance(): FailureMemoryService {
    if (!this.instance) this.instance = new FailureMemoryService();
    return this.instance;
  }

  public recordFailure(input: Omit<FailureMemoryRecord, 'failure_id'|'count'|'first_seen_at'|'last_seen_at'>): FailureMemoryRecord {
    const now = Date.now();
    const signature = this.normalize(input.error_signature || input.error_message || 'unknown_failure');
    const existing = this.records.find(r =>
      r.component_id === input.component_id &&
      r.implementation_hash === input.implementation_hash &&
      r.environment === input.environment &&
      r.test_category === input.test_category &&
      r.test_case_id === input.test_case_id &&
      r.error_signature === signature
    );
    if (existing) {
      existing.count += 1;
      existing.last_seen_at = now;
      this.save();
      return existing;
    }
    const record: FailureMemoryRecord = {
      ...input, error_signature: signature,
      failure_id: `FAIL-${this.hash(`${input.component_id}|${input.implementation_hash}|${input.environment}|${signature}|${now}`)}`,
      count: 1, first_seen_at: now, last_seen_at: now,
    };
    this.records.unshift(record);
    this.records = this.records.slice(0, 1000);
    this.save();
    systemLogger.info('TOOLS', `⚠️ [FailureMemory] recorded: ${record.failure_id}`);
    return record;
  }

  public findKnownFailures(goal: string, componentIds: string[] = [], environment?: string): FailureMemoryRecord[] {
    const needle = goal.trim().toLowerCase();
    const wanted = new Set(componentIds);
    return this.records.filter(r => {
      if (environment && r.environment !== environment) return false;
      if (wanted.size && !wanted.has(r.component_id)) return false;
      const text = `${r.goal} ${r.component_id} ${r.error_signature}`.toLowerCase();
      return !needle || text.includes(needle) || needle.includes(r.goal.toLowerCase());
    }).slice(0, 10);
  }

  /** 現在の実装に紐づく失敗だけを「回避候補」として返す。 */
  /**
   * 実行前の失敗リスクを推定する。
   * 過去に一度失敗しただけで永久除外せず、再発回数・新しさ・同一hashを考慮する。
   * これは予測であり、実行結果やVERIFIED判定ではない。
   */
  public assessRisk(componentId: string, environment: string, implementationHash: string, now = Date.now()): FailureRiskAssessment {
    const matches = this.records.filter(r =>
      r.component_id === componentId &&
      r.environment === environment &&
      r.implementation_hash === implementationHash
    );
    const recentWindow = 7 * 24 * 60 * 60 * 1000;
    const recent = matches.filter(r => now - r.last_seen_at <= recentWindow);
    const countScore = Math.min(45, matches.reduce((sum, r) => sum + Math.min(5, r.count * 2), 0));
    const recentScore = Math.min(40, recent.reduce((sum, r) => sum + Math.min(8, r.count * 3), 0));
    const risk = Math.min(100, countScore + recentScore);
    const reason = matches.length
      ? `同一Component/hash/環境の失敗履歴 ${matches.length}件、直近7日 ${recent.length}件`
      : '同一Component/hash/環境の失敗履歴なし';
    return { component_id: componentId, implementation_hash: implementationHash, environment, risk_score: risk, failure_count: matches.length, recent_failure_count: recent.length, reason };
  }

  public isHighRisk(componentId: string, environment: string, implementationHash: string, threshold = 60): boolean {
    return this.assessRisk(componentId, environment, implementationHash).risk_score >= threshold;
  }

  public shouldAvoid(componentId: string, environment: string, implementationHash: string): boolean {
    const component = componentRegistryService.getComponent(componentId);
    if (!component || component.implementation_hash !== implementationHash) return false;
    return this.records.some(r => r.component_id === componentId && r.environment === environment && r.implementation_hash === implementationHash);
  }

  public list(): FailureMemoryRecord[] { return [...this.records]; }
  private normalize(value: string): string { return value.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 240); }
  private hash(raw: string): string { let h=2166136261; for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(16).padStart(8,'0'); }
  private load(): void { try { const raw=storageService.getItem(this.storageKey); if(raw) this.records=JSON.parse(raw); } catch { this.records=[]; } }
  private save(): void { try { storageService.setItem(this.storageKey,JSON.stringify(this.records)); } catch { /* optional */ } }
}
export const failureMemoryService = FailureMemoryService.getInstance();
