import { ComponentTxtPackage } from '../types';
import { ExecutionEnvironment } from './executionRunnerService';
import { executionEventBusService, ExecutionEvent } from './executionEventBusService';
import { componentRegistryService } from './componentRegistryService';
import { downstreamImpactService, DownstreamImpact } from './downstreamImpactService';
import { selfImprovementExperimentService, ImprovementExperimentSnapshot } from './selfImprovementExperimentService';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

export type CanaryStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ROLLED_BACK';

export interface ImprovementCanaryRecord {
  canary_id: string;
  run_id: string;
  component_id: string;
  environment: ExecutionEnvironment;
  before_hash: string;
  canary_hash: string;
  baseline: ComponentTxtPackage;
  before: ImprovementExperimentSnapshot;
  adopted_at: number;
  min_samples: number;
  max_failure_rate: number;
  status: CanaryStatus;
  sample_count: number;
  success_count: number;
  failure_count: number;
  after?: ImprovementExperimentSnapshot;
  downstream_impact?: DownstreamImpact;
  rollback_reason?: string;
  rolled_back_at?: number;
  updated_at: number;
  observed_event_ids?: string[];
}

export interface CanaryEvaluation {
  status: CanaryStatus;
  sample_count: number;
  success_count: number;
  failure_count: number;
  failure_rate: number;
  downstream_impact: DownstreamImpact;
  ready: boolean;
  reason: string;
}

/**
 * P0-4: Before/After → Canary → downstream impact → Rollback の制御境界。
 * Canaryは「新実装の実利用結果」を観測するだけで、自己判断でコードを書き換えない。
 * Rollbackは保存済みの旧版ComponentスナップショットをRegistryへ明示的に復元する。
 */
export class ImprovementCanaryRollbackService {
  private static instance: ImprovementCanaryRollbackService;
  private readonly storageKey = 'miki_improvement_canary_rollback_v1';
  private records = new Map<string, ImprovementCanaryRecord>();
  private initialized = false;
  private unsub: (() => void)[] = [];
  private constructor() { this.load(); }
  public static getInstance() { return this.instance || (this.instance = new ImprovementCanaryRollbackService()); }

  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.unsub.push(executionEventBusService.subscribe('execution.completed', e => this.observe(e)));
    this.unsub.push(executionEventBusService.subscribe('execution.failed', e => this.observe(e)));
    // 再起動後もEvent Busに残っている直近イベントを一度だけ取り込む。
    for (const e of executionEventBusService.list()) this.observe(e);
  }

  public dispose(): void { this.unsub.forEach(u => u()); this.unsub = []; this.initialized = false; this.save(); }

  public begin(params: {
    runId: string;
    component: ComponentTxtPackage;
    environment: ExecutionEnvironment;
    before: ImprovementExperimentSnapshot;
    minSamples?: number;
    maxFailureRate?: number;
  }): ImprovementCanaryRecord {
    const now = Date.now();
    const record: ImprovementCanaryRecord = {
      canary_id: `CAN-${this.hash(`${params.runId}|${params.component.component_id}|${params.component.implementation_hash}|${now}`)}`,
      run_id: params.runId,
      component_id: params.component.component_id,
      environment: params.environment,
      before_hash: params.component.implementation_hash,
      // beginはadoption前に旧版を保存する。canary_hashはadoption後にsetCandidateHashで確定する。
      canary_hash: '',
      baseline: JSON.parse(JSON.stringify(params.component)),
      before: params.before,
      adopted_at: now,
      min_samples: Math.max(1, params.minSamples ?? 3),
      max_failure_rate: Math.max(0, Math.min(1, params.maxFailureRate ?? 0.20)),
      status: 'PENDING',
      sample_count: 0,
      success_count: 0,
      failure_count: 0,
      updated_at: now,
      observed_event_ids: [],
    };
    this.records.set(record.run_id, record);
    this.save();
    return record;
  }

  public setCanaryHash(runId: string, canaryHash: string): ImprovementCanaryRecord | undefined {
    const r = this.records.get(runId);
    if (!r || !canaryHash || canaryHash === r.before_hash) return r;
    r.canary_hash = canaryHash;
    r.adopted_at = Date.now();
    r.status = 'RUNNING';
    r.updated_at = Date.now();
    this.save();
    return r;
  }

  public evaluate(runId: string): CanaryEvaluation | undefined {
    const r = this.records.get(runId);
    if (!r || !r.canary_hash) return undefined;
    for (const e of executionEventBusService.list()) this.observe(e);
    const failureRate = r.sample_count ? r.failure_count / r.sample_count : 0;
    const impact = downstreamImpactService.assess(r.component_id, r.environment);
    r.downstream_impact = impact;
    const ready = r.sample_count >= r.min_samples;
    if (!ready) r.status = 'RUNNING';
    else if (failureRate <= r.max_failure_rate && impact.propagation_risk < 60) r.status = 'PASSED';
    else r.status = 'FAILED';
    r.after = selfImprovementExperimentService.snapshot();
    r.updated_at = Date.now();
    this.save();
    return {
      status: r.status,
      sample_count: r.sample_count,
      success_count: r.success_count,
      failure_count: r.failure_count,
      failure_rate: failureRate,
      downstream_impact: impact,
      ready,
      reason: ready
        ? (r.status === 'PASSED'
          ? `Canary PASS: ${r.sample_count}件、失敗率 ${(failureRate * 100).toFixed(1)}%、伝播リスク ${impact.propagation_risk.toFixed(1)}。`
          : `Canary FAIL: ${r.sample_count}件、失敗率 ${(failureRate * 100).toFixed(1)}%、伝播リスク ${impact.propagation_risk.toFixed(1)}。`)
        : `Canary継続: ${r.sample_count}/${r.min_samples}件。`,
    };
  }

  public rollback(runId: string, reason: string): { accepted: boolean; reason: string } {
    const r = this.records.get(runId);
    if (!r) return { accepted: false, reason: 'Canary記録が存在しません。' };
    const current = componentRegistryService.getComponent(r.component_id);
    if (!current) return { accepted: false, reason: 'Rollback対象Componentが存在しません。' };
    if (current.implementation_hash !== r.canary_hash) {
      return { accepted: false, reason: '現在版hashがCanary hashと一致しません。別変更が入ったため自動Rollbackを停止します。' };
    }
    const restored = componentRegistryService.rollbackToSnapshot(r.baseline, reason);
    if (!restored.success) return { accepted: false, reason: restored.message };
    r.status = 'ROLLED_BACK';
    r.rollback_reason = reason;
    r.rolled_back_at = Date.now();
    r.updated_at = Date.now();
    this.save();
    systemLogger.warn('SELF_IMPROVEMENT', `🛡️ [Canary] ${r.component_id} rollback: ${reason}`);
    return { accepted: true, reason: restored.message };
  }

  private observe(e: ExecutionEvent): void {
    if (e.type !== 'execution.completed' && e.type !== 'execution.failed') return;
    for (const r of this.records.values()) {
      if (!r.canary_hash || r.status === 'PASSED' || r.status === 'ROLLED_BACK') continue;
      if (e.component_id !== r.component_id || e.environment !== r.environment || e.implementation_hash !== r.canary_hash || e.created_at < r.adopted_at) continue;
      if (!r.observed_event_ids) r.observed_event_ids = [];
      if (r.observed_event_ids.includes(e.event_id)) continue;
      r.observed_event_ids.unshift(e.event_id);
      r.observed_event_ids = r.observed_event_ids.slice(0, 200);
      r.sample_count += 1;
      if (e.type === 'execution.completed') r.success_count += 1;
      else r.failure_count += 1;
      r.updated_at = Date.now();
      this.save();
    }
  }

  public get(runId: string) { return this.records.get(runId); }
  public list() { return Array.from(this.records.values()).sort((a, b) => b.updated_at - a.updated_at); }

  private load() { try { const raw = storageService.getItem(this.storageKey); if (raw) for (const r of JSON.parse(raw) as ImprovementCanaryRecord[]) this.records.set(r.run_id, r); } catch {} }
  private save() { try { storageService.setItem(this.storageKey, JSON.stringify(this.list().slice(0, 200))); } catch {} }
  private hash(raw: string) { let h = 2166136261; for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }
}

export const improvementCanaryRollbackService = ImprovementCanaryRollbackService.getInstance();
