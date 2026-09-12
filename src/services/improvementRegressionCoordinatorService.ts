import { componentImprovementCandidateService } from './componentImprovementCandidateService';
import { safeImprovementPipelineService, SafeImprovementRun } from './safeImprovementPipelineService';
import { componentRegressionService } from './componentRegressionService';
import { executionEventBusService, ExecutionEvent } from './executionEventBusService';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { ExecutionEnvironment, executionRunnerService, ExecutionRequest } from './executionRunnerService';
import { externalRunnerAdapterService } from './externalRunnerAdapterService';
import { androidNativeRunnerAdapterService } from './androidNativeRunnerAdapterService';

export type ImprovementRegressionCoordinatorStatus = 'WAITING' | 'RUNNING' | 'CANARY' | 'ADOPTED' | 'REJECTED' | 'ROLLED_BACK';

export interface ImprovementRegressionCoordinatorRecord {
  coordinator_id: string;
  candidate_id: string;
  run_id: string;
  suite_id: string;
  component_id: string;
  environment: ExecutionEnvironment;
  implementation_hash: string;
  status: ImprovementRegressionCoordinatorStatus;
  last_event_id?: string;
  created_at: number;
  updated_at: number;
}

/**
 * Candidate Regressionの結果をSafeImprovementPipelineへ反映する専用調整層。
 * Runnerを直接起動せず、Promotionを直接行わず、既存Gateだけを順に呼び出す。
 */
export class ImprovementRegressionCoordinatorService {
  private static instance: ImprovementRegressionCoordinatorService;
  private readonly storageKey = 'miki_improvement_regression_coordinator_v1';
  private records = new Map<string, ImprovementRegressionCoordinatorRecord>();
  private unsubCompleted?: () => void;
  private unsubFailed?: () => void;
  private unsubInconclusive?: () => void;
  private busy = new Set<string>();

  private constructor() { this.load(); }
  public static getInstance() {
    if (!this.instance) this.instance = new ImprovementRegressionCoordinatorService();
    return this.instance;
  }

  public initialize(): void {
    if (this.unsubCompleted || this.unsubFailed || this.unsubInconclusive) return;
    // storageServiceのhydration後に再読込し、再起動前のRUNNING状態を安全に再駆動する。
    this.load();
    this.unsubCompleted = executionEventBusService.subscribe('execution.completed', e => { void this.onExecutionEvent(e); });
    this.unsubFailed = executionEventBusService.subscribe('execution.failed', e => { void this.onExecutionEvent(e); });
    this.unsubInconclusive = executionEventBusService.subscribe('execution.inconclusive', e => { void this.onExecutionEvent(e); });
    for (const record of this.list()) {
      if (record.status === 'ADOPTED' || record.status === 'REJECTED' || record.status === 'ROLLED_BACK') continue;
      // ExecutionRunnerは再起動時にSUBMITTEDをQUEUEDへ復旧するため、
      // coordinatorはSuiteの先頭未完了Requestから安全に再投入できる。
      void this.processRun(record.run_id);
    }
  }

  public dispose(): void {
    this.unsubCompleted?.();
    this.unsubFailed?.();
    this.unsubInconclusive?.();
    this.unsubCompleted = undefined;
    this.unsubFailed = undefined;
    this.unsubInconclusive = undefined;
    this.busy.clear();
  }

  public register(run: SafeImprovementRun): ImprovementRegressionCoordinatorRecord | undefined {
    if (!run.candidate_id || !run.suite_id) return undefined;
    const existing = this.records.get(run.run_id);
    if (existing) return existing;
    const now = Date.now();
    const record: ImprovementRegressionCoordinatorRecord = {
      coordinator_id: `IRC-${this.hash(`${run.run_id}|${now}`)}`,
      candidate_id: run.candidate_id,
      run_id: run.run_id,
      suite_id: run.suite_id,
      component_id: run.component_id,
      environment: run.environment,
      implementation_hash: run.implementation_hash,
      status: 'WAITING',
      created_at: now,
      updated_at: now,
    };
    this.records.set(run.run_id, record);
    this.save();

    // 計画直後にSuite全体を一度集計し、最初の1件だけRunner境界へ投入する。
    // UNSUPPORTED等もここで即座にREJECTEDとして確定する。
    this.processRun(run.run_id);
    return this.records.get(run.run_id) || record;
  }

  public registerByRunId(runId: string): ImprovementRegressionCoordinatorRecord | undefined {
    const existing = this.records.get(runId);
    if (existing) return existing;
    const run = safeImprovementPipelineService.list().find(r => r.run_id === runId);
    return run ? this.register(run) : undefined;
  }

  public processRun(runId: string, event?: ExecutionEvent): ImprovementRegressionCoordinatorRecord | undefined {
    const record = this.registerByRunId(runId);
    if (!record) return undefined;
    if (record.status === 'ADOPTED' || record.status === 'REJECTED' || record.status === 'ROLLED_BACK') return record;

    const refreshed = safeImprovementPipelineService.refresh(record.run_id);
    if (!refreshed) return record;
    record.last_event_id = event?.event_id || record.last_event_id;
    record.updated_at = Date.now();

    if (refreshed.stage === 'CANARY') {
      const evaluation = safeImprovementPipelineService.evaluateCanary(record.run_id);
      if (evaluation?.status === 'PASSED') {
        record.status = 'ADOPTED';
        systemLogger.info('SELF_IMPROVEMENT', `🟢 [Canary] ${record.candidate_id}: ADOPTED`);
      } else if (evaluation?.status === 'ROLLED_BACK') {
        record.status = 'ROLLED_BACK';
        componentImprovementCandidateService.markRolledBack(record.candidate_id, evaluation.reason);
        systemLogger.warn('SELF_IMPROVEMENT', `↩️ [Canary] ${record.candidate_id}: ROLLED_BACK`);
      } else {
        record.status = 'CANARY';
      }
    } else if (refreshed.stage === 'PASSED') {
      if (this.busy.has(record.run_id)) return record;
      this.busy.add(record.run_id);
      try {
        const result = safeImprovementPipelineService.adopt(record.run_id);
        if (result.accepted) {
          const latest = safeImprovementPipelineService.list().find(r => r.run_id === record.run_id);
          record.status = latest?.stage === 'CANARY' ? 'CANARY' : 'ADOPTED';
          systemLogger.info('SELF_IMPROVEMENT', `🛡️ [RegressionCoordinator] ${record.candidate_id}: ${record.status}`);
        } else {
          record.status = 'REJECTED';
          componentImprovementCandidateService.markRejected(record.candidate_id, result.reason);
          systemLogger.warn('SELF_IMPROVEMENT', `🛑 [RegressionCoordinator] ${record.candidate_id}: Promotion rejected: ${result.reason}`);
        }
      } finally {
        this.busy.delete(record.run_id);
      }
    } else if (refreshed.stage === 'REJECTED') {
      record.status = 'REJECTED';
      componentImprovementCandidateService.markRejected(record.candidate_id, refreshed.reason);
      systemLogger.warn('SELF_IMPROVEMENT', `🛑 [RegressionCoordinator] ${record.candidate_id}: Regression rejected`);
    } else {
      record.status = 'RUNNING';
      // 直前のテストが完了した後だけ、次の1件をRunner境界へ投入する。
      // 同時実行を避け、Regression Suiteの順序と監査性を維持する。
      this.dispatchNext(record.run_id);
    }
    record.updated_at = Date.now();
    this.save();
    return record;
  }

  /**
   * Regression Suite内の未実行Requestを先頭から1件だけSUBMITTEDへ進める。
   * 実際のテスト実行は外部Runnerが担当し、このサービスは投入順序だけを管理する。
   */
  public dispatchNext(runId: string): ExecutionRequest | undefined {
    const record = this.records.get(runId);
    if (!record || record.status === 'ADOPTED' || record.status === 'REJECTED' || record.status === 'ROLLED_BACK') return undefined;
    const suite = componentRegressionService.get(record.suite_id);
    if (!suite) return undefined;

    // 同一Suiteで既に実行中のRequestがある場合は新規投入しない。
    const active = suite.request_ids
      .map(id => executionRunnerService.getRequest(id))
      .find(req => req?.status === 'SUBMITTED');
    if (active) return active;

    const next = suite.request_ids
      .map(id => executionRunnerService.getRequest(id))
      .find(req => req?.status === 'QUEUED');
    if (!next) return undefined;

    const submitted = executionRunnerService.markSubmitted(next.request_id);
    if (submitted) {
      record.status = 'RUNNING';
      record.updated_at = Date.now();
      this.save();
      systemLogger.info('SELF_IMPROVEMENT', `▶️ [RegressionCoordinator] ${record.suite_id}: dispatched ${submitted.request_id}`);
      // Android本体ではNative Runner Bridgeを第一選択。
      // Termuxは廃止予定のため、通常経路には使用しない。
      if (submitted.environment === 'ANDROID' && androidNativeRunnerAdapterService.isAvailable()) {
        void androidNativeRunnerAdapterService.dispatch(submitted);
      } else if (submitted.environment !== 'TERMUX' && externalRunnerAdapterService.isEnabled()) {
        // PC/Excel等の外部RunnerだけHTTP Adapterへフォールバックする。
        void externalRunnerAdapterService.dispatch(submitted);
      }
    }
    return submitted;
  }

  public list(): ImprovementRegressionCoordinatorRecord[] {
    return Array.from(this.records.values()).sort((a, b) => b.created_at - a.created_at);
  }

  private async onExecutionEvent(event: ExecutionEvent): Promise<void> {
    const candidates = this.list().filter(r =>
      r.component_id === event.component_id &&
      r.environment === event.environment &&
      r.implementation_hash === event.implementation_hash &&
      r.status !== 'ADOPTED' && r.status !== 'REJECTED' && r.status !== 'ROLLED_BACK'
    );
    for (const record of candidates) {
      const suite = componentRegressionService.get(record.suite_id);
      if (!suite || !suite.request_ids.includes(event.request_id)) continue;
      this.processRun(record.run_id, event);
    }
  }

  private save() {
    try { storageService.setItem(this.storageKey, JSON.stringify(this.list().slice(0, 200))); } catch {}
  }
  private load() {
    try {
      const raw = storageService.getItem(this.storageKey);
      if (raw) for (const r of JSON.parse(raw) as ImprovementRegressionCoordinatorRecord[]) this.records.set(r.run_id, r);
    } catch {}
  }
  private hash(raw: string) {
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

export const improvementRegressionCoordinatorService = ImprovementRegressionCoordinatorService.getInstance();
