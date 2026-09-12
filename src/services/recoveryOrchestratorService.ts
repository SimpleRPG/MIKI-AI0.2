import { CompositionPlan, componentCompositionService } from './componentCompositionService';
import { ExecutionEnvironment, ExecutionRequest } from './executionRunnerService';
import { failureRecoveryService, RecoveryDecision } from './failureRecoveryService';
import { planOrchestratorService, OrchestratorRun } from './planOrchestratorService';
import { researchService, ResearchResult } from './researchService';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';
import { executionEventBusService, ExecutionEvent } from './executionEventBusService';
import { taskCaseMemoryService } from './taskCaseMemoryService';

export type RecoveryRunStatus = 'READY' | 'RUNNING' | 'RESEARCHING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';

export interface RecoveryRun {
  recovery_run_id: string;
  goal: string;
  task_id?: string;
  environment: ExecutionEnvironment;
  status: RecoveryRunStatus;
  recovery_count: number;
  max_recoveries: number;
  failed_component_id?: string;
  decisions: RecoveryDecision[];
  orchestrator_run_ids: string[];
  research?: ResearchResult;
  reason?: string;
  created_at: number;
  updated_at: number;
}

/**
 * RecoveryDecisionを「実際の次経路」へ接続する統括層。
 * 自動で任意コードを実行せず、既存のOrchestrator/Research境界だけを呼び出す。
 */
export class RecoveryOrchestratorService {
  private static instance: RecoveryOrchestratorService;
  private runs = new Map<string, RecoveryRun>();
  private requestToRecovery = new Map<string, string>();
  private initialized = false;
  private readonly storageKey = 'miki_recovery_orchestrator_v2';
  private unsubs: Array<() => void> = [];
  private constructor() {}

  public static getInstance(): RecoveryOrchestratorService {
    if (!this.instance) this.instance = new RecoveryOrchestratorService();
    return this.instance;
  }

  public initialize(): void {
    if (this.initialized) return;
    this.load();
    this.initialized = true;
    this.unsubs.push(
      executionEventBusService.subscribe('execution.completed', e => this.onExecutionEvent(e)),
      executionEventBusService.subscribe('execution.failed', e => this.onExecutionEvent(e)),
      executionEventBusService.subscribe('execution.inconclusive', e => this.onExecutionEvent(e)),
      executionEventBusService.subscribe('execution.rejected', e => this.onExecutionEvent(e)),
    );
  }

  public dispose(): void { this.unsubs.forEach(u => u()); this.unsubs = []; this.initialized = false; }

  public start(goal: string, environment: ExecutionEnvironment, maxRecoveries = 3, taskId?: string): RecoveryRun {
    const id = `REC-${this.hash(`${goal}|${environment}|${Date.now()}`)}`;
    const run: RecoveryRun = {
      recovery_run_id: id, goal, task_id: taskId, environment, status: 'READY', recovery_count: 0,
      max_recoveries: Math.max(0, maxRecoveries), decisions: [], orchestrator_run_ids: [],
      created_at: Date.now(), updated_at: Date.now(),
    };
    this.runs.set(id, run);

    const initial = planOrchestratorService.createRun(goal, environment);
    run.orchestrator_run_ids.push(initial.run_id);
    this.initialize();
    const initialRequest = planOrchestratorService.dispatchNext(initial.run_id);
    if (initialRequest) this.requestToRecovery.set(initialRequest.request_id, id);
    run.status = initial.status === 'BLOCKED' ? 'BLOCKED' : 'RUNNING';
    run.reason = initial.reason;
    run.updated_at = Date.now();
    this.save();
    systemLogger.info('TOOLS', `🛡️ [RecoveryOrchestrator] ${id}: initial=${initial.run_id}`);
    return run;
  }

  /** 実行失敗を受け、RecoveryDecisionを次の実行/研究へ接続する。 */
  public async recover(input: {
    recoveryRunId: string;
    failedComponentId: string;
    implementationHash: string;
    attempts: number;
    maxAttempts: number;
    errorMessage?: string;
  }): Promise<{ decision?: RecoveryDecision; nextRun?: OrchestratorRun; nextRequest?: ExecutionRequest; research?: ResearchResult; status: RecoveryRunStatus; reason?: string }> {
    const run = this.runs.get(input.recoveryRunId);
    if (!run) return { status: 'BLOCKED', reason: 'Recovery Runが見つかりません。' };
    if (run.recovery_count >= run.max_recoveries) {
      run.status = 'FAILED'; run.reason = 'Recovery回数上限に達しました。'; run.updated_at = Date.now();
      return { status: run.status, reason: run.reason };
    }

    const decision = failureRecoveryService.decide({
      goal: run.goal, environment: run.environment, failedComponentId: input.failedComponentId,
      implementationHash: input.implementationHash, attempts: input.attempts, maxAttempts: input.maxAttempts,
    });
    run.decisions.push(decision);
    run.failed_component_id = input.failedComponentId;
    run.recovery_count += 1;
    this.save();

    if (decision.action === 'RETRY') {
      const currentId = run.orchestrator_run_ids[run.orchestrator_run_ids.length - 1];
      const current = planOrchestratorService.getRun(currentId);
      if (!current) return this.fail(run, 'Retry対象のOrchestrator Runがありません。');
      const nextRequest = planOrchestratorService.dispatchNext(current.run_id);
      run.status = 'RUNNING'; run.updated_at = Date.now();
      if (nextRequest) this.requestToRecovery.set(nextRequest.request_id, run.recovery_run_id);
      this.save();
      return { decision, nextRun: current, nextRequest, status: run.status };
    }

    if (decision.action === 'ALTERNATE_COMPONENT' || decision.action === 'ALTERNATE_COMPOSITION') {
      const plan: CompositionPlan | undefined = decision.alternate_plan ||
        componentCompositionService.compose(run.goal, 4, [input.failedComponentId], run.environment);
      if (!plan || !plan.executable) return this.fail(run, '代替Compositionを構成できませんでした。');
      const next = this.createOrchestratorFromPlan(plan, run.environment);
      run.orchestrator_run_ids.push(next.run_id);
      run.status = 'RUNNING'; run.reason = decision.reason; run.updated_at = Date.now();
      const nextRequest = planOrchestratorService.dispatchNext(next.run_id);
      if (nextRequest) this.requestToRecovery.set(nextRequest.request_id, run.recovery_run_id);
      this.save();
      return { decision, nextRun: next, nextRequest, status: run.status };
    }

    if (decision.action === 'RESEARCH') {
      run.status = 'RESEARCHING';
      // Researchは既存の検索境界だけを使う。ここでは新規の任意HTTPを実行しない。
      const research = await researchService.researchGap({
        id: `RECOVERY-${run.recovery_run_id}-${run.recovery_count}`,
        query: `${run.goal} / ${input.failedComponentId} の失敗を回避するための調査`,
        type: 'WEAK_COMPONENT',
        priority: 1,
        requiredEvidence: [],
        status: 'OPEN',
        reason: decision.reason,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attempts: 0,
      });
      run.research = research;
      run.status = research.resolved ? 'READY' : 'FAILED';
      run.reason = research.resolved ? 'Researchで検証済み情報が得られました。再計画が可能です。' : 'Researchだけでは検証済みの復旧経路を確立できませんでした。';
      run.updated_at = Date.now();
      this.save();
      return { decision, research, status: run.status, reason: run.reason };
    }

    return this.fail(run, decision.reason, decision);
  }

  /** Research成功後に、同じ目的で新しいCompositionを作る。 */
  public replanAfterResearch(recoveryRunId: string): { run?: OrchestratorRun; nextRequest?: ExecutionRequest; status: RecoveryRunStatus; reason?: string } {
    const run = this.runs.get(recoveryRunId);
    if (!run) return { status: 'BLOCKED', reason: 'Recovery Runが見つかりません。' };
    if (!run.research?.resolved) return { status: run.status, reason: '検証済みResearch結果がありません。' };
    const plan = componentCompositionService.compose(run.goal, 4, run.failed_component_id ? [run.failed_component_id] : [], run.environment);
    if (!plan?.executable) return this.fail(run, 'Research後も実行可能なCompositionがありません。');
    const next = this.createOrchestratorFromPlan(plan, run.environment);
    run.orchestrator_run_ids.push(next.run_id); run.status = 'RUNNING'; run.updated_at = Date.now();
    const nextRequest = planOrchestratorService.dispatchNext(next.run_id);
    if (nextRequest) this.requestToRecovery.set(nextRequest.request_id, recoveryRunId);
    this.save();
    return { run: next, nextRequest, status: run.status };
  }

  private onExecutionEvent(event: ExecutionEvent): void {
    const recoveryId = this.requestToRecovery.get(event.request_id);
    if (!recoveryId) return;
    const run = this.runs.get(recoveryId);
    if (!run) return;
    if (event.type === 'execution.completed' && event.passed === true) {
      run.status = 'COMPLETED';
      run.reason = 'Recovery経路の実行とAssertionが成功しました。';
      run.updated_at = Date.now();
      // Recoveryで得た成功経路を通常Taskと同じCase Memoryへ戻す。
      // Component/Hashの再検証に失敗した場合は、経験を再利用可能とは記録しない。
      if (run.task_id) {
        const finalRun = planOrchestratorService.getRun(run.orchestrator_run_ids[run.orchestrator_run_ids.length - 1]);
        const steps = finalRun?.steps.filter(s => s.status === 'COMPLETED') || [];
        const hashes: Record<string, string> = {};
        for (const step of steps) if (step.implementation_hash) hashes[step.component_id] = step.implementation_hash;
        if (steps.length) {
          taskCaseMemoryService.recordSuccess({
            taskId: run.task_id, goal: run.goal, environment: run.environment,
            componentIds: steps.map(s => s.component_id), hashes, requestId: event.request_id,
            evidenceEventId: event.event_id, outputSummary: event.output_summary,
          });
        }
      }
      this.save();
      return;
    }
    if (event.type === 'execution.failed' || event.type === 'execution.inconclusive' || event.type === 'execution.rejected' || event.passed === false) {
      void this.recover({
        recoveryRunId: recoveryId,
        failedComponentId: event.component_id,
        implementationHash: event.implementation_hash,
        attempts: run.recovery_count,
        maxAttempts: Math.max(2, run.max_recoveries),
        errorMessage: event.error_message || event.output_summary,
      }).then(result => {
        if (result.nextRequest) this.requestToRecovery.set(result.nextRequest.request_id, recoveryId);
      }).then(() => this.save()).catch(() => { run.status = 'FAILED'; run.reason = 'Recovery処理中に例外が発生しました。'; run.updated_at = Date.now(); this.save(); });
    }
  }

  public getRun(id: string): RecoveryRun | undefined { return this.runs.get(id); }
  public listRuns(): RecoveryRun[] { return [...this.runs.values()].sort((a, b) => b.created_at - a.created_at); }

  private createOrchestratorFromPlan(plan: CompositionPlan, environment: ExecutionEnvironment): OrchestratorRun {
    // Orchestratorの公開境界はgoalベースなので、planのgoalを再利用する。
    // Composition側で同一条件を再評価し、VERIFIED/依存/I-O安全性を再確認する。
    return planOrchestratorService.createRunFromPlan(plan, environment);
  }

  private fail(run: RecoveryRun, reason: string, decision?: RecoveryDecision) {
    if (decision && !run.decisions.includes(decision)) run.decisions.push(decision);
    run.status = 'FAILED'; run.reason = reason; run.updated_at = Date.now(); this.save();
    return { decision, status: run.status as RecoveryRunStatus, reason: run.reason };
  }

  private load(): void {
    try {
      const raw = storageService.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.runs)) {
        this.runs = new Map(parsed.runs.map((r: RecoveryRun) => [r.recovery_run_id, r]));
      }
      if (Array.isArray(parsed?.requestToRecovery)) this.requestToRecovery = new Map(parsed.requestToRecovery);
    } catch {
      this.runs = new Map();
      this.requestToRecovery = new Map();
    }
  }

  private save(): void {
    try {
      storageService.setItem(this.storageKey, JSON.stringify({
        runs: [...this.runs.values()].slice(0, 500),
        requestToRecovery: [...this.requestToRecovery.entries()].slice(0, 2000),
      }));
    } catch { /* persistence is best-effort; execution safety does not depend on it */ }
  }

  private hash(raw: string): string { let h=2166136261; for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(16).padStart(8,'0'); }
}

export const recoveryOrchestratorService = RecoveryOrchestratorService.getInstance();
