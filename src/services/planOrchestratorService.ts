import { ComponentCompositionService, CompositionPlan, CompositionStep } from './componentCompositionService';
import { ExecutionEnvironment, ExecutionRequest, ExecutionRunnerService } from './executionRunnerService';
import { systemLogger } from './systemLogger';
import { failureRecoveryService, RecoveryDecision } from './failureRecoveryService';
import { componentRegistryService } from './componentRegistryService';
import { componentTestCaseService } from './componentTestCaseService';

const componentCompositionHash = (componentId: string): string => componentRegistryService.getComponent(componentId)?.implementation_hash || '';

export type OrchestratorStepStatus = 'WAITING' | 'QUEUED' | 'SUBMITTED' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'BLOCKED';

export interface OrchestratorStep {
  step_id: string;
  order: number;
  component_id: string;
  implementation_hash: string;
  status: OrchestratorStepStatus;
  request_id?: string;
  attempts: number;
  max_attempts: number;
  input_summary: string;
  output_summary?: string;
  error_message?: string;
  failure_policy: CompositionStep['failure_policy'];
}

export interface OrchestratorRun {
  run_id: string;
  plan_id: string;
  goal: string;
  environment: ExecutionEnvironment;
  status: 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
  steps: OrchestratorStep[];
  created_at: number;
  updated_at: number;
  reason?: string;
  recovery?: RecoveryDecision;
  /** 8.4: 実行結果を遅延評価へ接続する判断ID */
  decision_id?: string;
}

/**
 * CompositionPlanをRunnerのExecutionRequest列へ変換する実行制御層。
 * 実際のコード実行は行わず、依存完了→次Request発行→結果受領の順序だけを保証する。
 */
export class PlanOrchestratorService {
  private static instance: PlanOrchestratorService;
  private runs = new Map<string, OrchestratorRun>();
  private constructor() {}

  public static getInstance(): PlanOrchestratorService {
    if (!this.instance) this.instance = new PlanOrchestratorService();
    return this.instance;
  }

  public createRunFromPlan(plan: CompositionPlan, environment: ExecutionEnvironment, decisionId?: string): OrchestratorRun {
    const runId = `ORCH-${this.hash(`${plan.plan_id}|${environment}|${Date.now()}`)}`;
    if (!plan.executable) {
      const blocked: OrchestratorRun = { run_id: runId, plan_id: plan.plan_id, goal: plan.goal, environment, status: 'BLOCKED', steps: [], created_at: Date.now(), updated_at: Date.now(), reason: plan.blocked_reason || '実行可能なComposition Planがありません。', decision_id: decisionId };
      this.runs.set(runId, blocked);
      return blocked;
    }
    const steps = plan.steps.map(s => ({
      step_id: s.step_id, order: s.order, component_id: s.component_id,
      implementation_hash: componentCompositionHash(s.component_id),
      status: 'WAITING', attempts: 0,
      max_attempts: s.failure_policy === 'RETRY_ONCE' ? 2 : 1,
      input_summary: s.consumes_from.length ? `前段出力: ${s.consumes_from.join(', ')}` : '外部/計画入力',
      failure_policy: s.failure_policy,
    } as OrchestratorStep));
    const run: OrchestratorRun = { run_id: runId, plan_id: plan.plan_id, goal: plan.goal, environment, status: 'READY', steps, created_at: Date.now(), updated_at: Date.now(), decision_id: decisionId };
    this.runs.set(runId, run);
    return run;
  }

  public createRun(goal: string, environment: ExecutionEnvironment, maxComponents = 4): OrchestratorRun {
    const plan = ComponentCompositionService.getInstance().compose(goal, maxComponents);
    if (!plan) {
      const now = Date.now();
      const runId = `ORCH-${this.hash(`${goal}|${environment}|${now}`)}`;
      const blocked: OrchestratorRun = { run_id: runId, plan_id: '', goal, environment, status: 'BLOCKED', steps: [], created_at: now, updated_at: now, reason: '実行可能なComposition Planがありません。' };
      this.runs.set(runId, blocked);
      return blocked;
    }
    return this.createRunFromPlan(plan, environment);
  }

  /** 最初に実行可能なStepのRequestを発行する。 */
  public dispatchNext(runId: string): ExecutionRequest | undefined {
    const run = this.runs.get(runId);
    if (!run || ['COMPLETED', 'FAILED', 'BLOCKED'].includes(run.status)) return undefined;
    const step = this.nextDispatchable(run);
    if (!step) {
      if (run.steps.every(s => ['COMPLETED', 'SKIPPED'].includes(s.status))) run.status = 'COMPLETED';
      run.updated_at = Date.now();
      return undefined;
    }

    const component = componentRegistryService.getComponent(step.component_id);
    if (!component) {
      step.status = 'BLOCKED';
      run.status = 'BLOCKED';
      run.reason = `Component ${step.component_id} が存在しません。`;
      run.updated_at = Date.now();
      return undefined;
    }
    const normalCase = componentTestCaseService.generateForComponent(step.component_id)
      .find(testCase => testCase.enabled && testCase.category === 'NORMAL' && testCase.implementation_hash === step.implementation_hash);
    if (!normalCase) {
      step.status = 'BLOCKED';
      run.status = 'BLOCKED';
      run.reason = `NORMAL Test Caseが対象implementation hashに存在しません: ${step.component_id}`;
      run.updated_at = Date.now();
      return undefined;
    }

    const request = ExecutionRunnerService.getInstance().createRequest({
      componentId: step.component_id,
      environment: run.environment,
      testCategory: normalCase.category,
      testCaseId: normalCase.test_case_id,
      inputSummary: step.input_summary,
      expectedSummary: normalCase.expected_summary,
      decisionId: run.decision_id,
    });
    step.attempts += 1;
    step.request_id = request.request_id;
    step.status = request.status === 'QUEUED' ? 'QUEUED' : 'BLOCKED';
    run.status = request.status === 'QUEUED' ? 'RUNNING' : 'BLOCKED';
    run.updated_at = Date.now();
    if (request.status === 'QUEUED') ExecutionRunnerService.getInstance().markSubmitted(request.request_id);
    systemLogger.info('TOOLS', `▶️ [Orchestrator] ${run.run_id}: ${step.component_id} request=${request.request_id}`);
    return request;
  }

  /** Runnerが既にExecution Eventを発行した後、その結果だけをOrchestratorへ反映する。 */
  public applyExecutionEventResult(input: {
    request_id: string;
    passed: boolean;
    output_summary?: string;
    error_message?: string;
    implementation_hash: string;
    environment: ExecutionEnvironment;
  }): { accepted: boolean; reason?: string; nextRequest?: ExecutionRequest; recovery?: RecoveryDecision } {
    const run = [...this.runs.values()].find(r => r.steps.some(s => s.request_id === input.request_id));
    if (!run) return { accepted: false, reason: 'Orchestrator Runに紐づくRequestではありません。' };
    const step = run.steps.find(s => s.request_id === input.request_id)!;
    if (!['QUEUED', 'SUBMITTED'].includes(step.status)) {
      if (step.status === 'COMPLETED' && input.passed) return { accepted: true };
      return { accepted: false, reason: `Stepは既に確定済みです: ${step.status}` };
    }
    if (run.environment !== input.environment) return { accepted: false, reason: 'Execution Eventの環境がRunと一致しません。' };
    if (input.passed) {
      step.status = 'COMPLETED';
      step.output_summary = input.output_summary;
      this.refreshWaitingInputs(run, step);
      run.status = 'RUNNING';
    } else if (step.attempts < step.max_attempts) {
      step.status = 'WAITING';
      step.error_message = input.error_message || '実行失敗';
      run.status = 'RUNNING';
    } else if (step.failure_policy === 'SKIP_OPTIONAL') {
      step.status = 'SKIPPED';
      step.error_message = input.error_message || '失敗したため任意Stepをスキップ';
    } else {
      const recovery = failureRecoveryService.decide({
        goal: run.goal, environment: run.environment,
        failedComponentId: step.component_id,
        implementationHash: input.implementation_hash,
        attempts: step.attempts, maxAttempts: step.max_attempts,
      });
      run.recovery = recovery;
      step.status = 'FAILED';
      run.status = 'FAILED';
      run.reason = recovery.reason;
    }
    run.updated_at = Date.now();
    const nextRequest = run.status === 'FAILED' ? undefined : this.dispatchNext(run.run_id);
    return { accepted: true, nextRequest, recovery: run.recovery };
  }


  /** 外部Runner結果を受け、成功なら次Stepへ、失敗ならRetry/STOPへ進める。 */
  public submitStepResult(input: Parameters<ExecutionRunnerService['submitResult']>[0]): ReturnType<ExecutionRunnerService['submitResult']> & { nextRequest?: ExecutionRequest; recovery?: RecoveryDecision } {
    const run = [...this.runs.values()].find(r => r.steps.some(s => s.request_id === input.request_id));
    if (!run) return { accepted: false, reason: 'Orchestrator Runに紐づくRequestではありません。' };
    const step = run.steps.find(s => s.request_id === input.request_id)!;
    const result = ExecutionRunnerService.getInstance().submitResult(input);
    if (!result.accepted) return result;

    if (input.passed) {
      step.status = 'COMPLETED';
      step.output_summary = input.output_summary;
      this.refreshWaitingInputs(run, step);
      run.status = 'RUNNING';
    } else if (step.attempts < step.max_attempts) {
      step.status = 'WAITING';
      step.error_message = input.error_message || '実行失敗';
    } else if (step.failure_policy === 'SKIP_OPTIONAL') {
      step.status = 'SKIPPED';
      step.error_message = input.error_message || '失敗したため任意Stepをスキップ';
    } else {
      const recovery = failureRecoveryService.decide({
        goal: run.goal,
        environment: run.environment,
        failedComponentId: step.component_id,
        implementationHash: input.implementation_hash,
        attempts: step.attempts,
        maxAttempts: step.max_attempts,
      });
      run.recovery = recovery;
      if (recovery.action === 'RETRY' && step.attempts < step.max_attempts) {
        step.status = 'WAITING';
        step.error_message = input.error_message || '実行失敗。RecoveryがRetryを許可。';
        run.status = 'RUNNING';
      } else if (recovery.action === 'ALTERNATE_COMPONENT' || recovery.action === 'ALTERNATE_COMPOSITION' || recovery.action === 'RESEARCH') {
        step.status = 'FAILED';
        run.status = 'FAILED';
        run.reason = recovery.reason;
      } else {
        step.status = 'FAILED';
        run.status = 'FAILED';
        run.reason = recovery.reason;
      }
    }
    run.updated_at = Date.now();
    const nextRequest = run.status === 'FAILED' ? undefined : this.dispatchNext(run.run_id);
    return { ...result, nextRequest, recovery: run.recovery };
  }

  public getRun(runId: string): OrchestratorRun | undefined { return this.runs.get(runId); }
  public listRuns(): OrchestratorRun[] { return [...this.runs.values()].sort((a,b) => b.created_at-a.created_at); }

  private nextDispatchable(run: OrchestratorRun): OrchestratorStep | undefined {
    const active = run.steps.find(s => ['QUEUED','SUBMITTED'].includes(s.status));
    if (active) return undefined;
    const waiting = run.steps.find(s => s.status === 'WAITING' && run.steps.filter(x => x.order < s.order).every(x => ['COMPLETED','SKIPPED'].includes(x.status)));
    if (waiting) return waiting;
    if (run.steps.some(s => s.status === 'FAILED' || s.status === 'BLOCKED')) run.status = 'FAILED';
    return undefined;
  }

  private refreshWaitingInputs(run: OrchestratorRun, completed: OrchestratorStep): void {
    for (const step of run.steps.filter(s => s.status === 'WAITING' && s.order > completed.order)) {
      const outputs = run.steps.filter(s => s.order < step.order && s.output_summary).map(s => `${s.component_id}: ${s.output_summary}`);
      if (outputs.length) step.input_summary = outputs.join(' | ');
    }
  }

  private hash(raw: string): string { let h=2166136261; for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(16).padStart(8,'0'); }
}

export const planOrchestratorService = PlanOrchestratorService.getInstance();
