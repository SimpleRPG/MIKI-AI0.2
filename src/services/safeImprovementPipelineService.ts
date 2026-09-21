import { componentRegistryService } from './componentRegistryService';
import { componentRegressionService, RegressionSuite } from './componentRegressionService';
import { componentPromotionService, ComponentPromotionResult } from './componentPromotionService';
import { ExecutionEnvironment } from './executionRunnerService';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { componentImprovementCandidateService } from './componentImprovementCandidateService';
import { improvementCanaryRollbackService } from './improvementCanaryRollbackService';
import { selfImprovementExperimentService } from './selfImprovementExperimentService';

export type SafeImprovementStage = 'PROPOSED' | 'REGRESSION_PLANNED' | 'WAITING_RESULTS' | 'PASSED' | 'CANARY' | 'REJECTED' | 'ADOPTED' | 'ROLLED_BACK';

export interface SafeImprovementRun {
  run_id: string;
  component_id: string;
  environment: ExecutionEnvironment;
  implementation_hash: string;
  suite_id?: string;
  stage: SafeImprovementStage;
  reason: string;
  created_at: number;
  updated_at: number;
  candidate_id?: string;
  base_component_id?: string;
  canary_id?: string;
  before_snapshot_at?: number;
}

/**
 * 自己改善の変更境界。
 * この層は「既存Componentの候補を回帰検証にかけ、条件を満たした場合だけ
 * Promotion Gateへ渡す」ことだけを担当する。コード生成・任意コード実行・
 * 直接VERIFIED化は行わない。
 */
export class SafeImprovementPipelineService {
  private static instance: SafeImprovementPipelineService;
  private readonly storageKey = 'miki_safe_improvement_pipeline_v1';
  private runs = new Map<string, SafeImprovementRun>();
  private constructor() { this.load(); }
  public static getInstance() { return this.instance || (this.instance = new SafeImprovementPipelineService()); }

  public proposeCandidate(candidateId: string, environment: ExecutionEnvironment): SafeImprovementRun | undefined {
    const candidate = componentImprovementCandidateService.get(candidateId);
    if (!candidate) return undefined;
    const run = this.propose(candidate.candidate_component_id, environment);
    run.candidate_id = candidateId;
    run.base_component_id = candidate.base_component_id;
    run.reason = `改善候補 ${candidateId} を安全検証します。差分行数=${candidate.changed_lines}`;
    componentImprovementCandidateService.markTesting(candidateId);
    this.runs.set(run.run_id, run); this.save();
    return run;
  }

  public propose(componentId: string, environment: ExecutionEnvironment): SafeImprovementRun {
    const component = componentRegistryService.getComponent(componentId);
    if (!component) throw new Error(`Componentが存在しません: ${componentId}`);
    const now = Date.now();
    const run: SafeImprovementRun = {
      run_id: `SIP-${this.hash(`${componentId}|${component.implementation_hash}|${environment}|${now}`)}`,
      component_id: componentId,
      environment,
      implementation_hash: component.implementation_hash,
      stage: 'PROPOSED',
      reason: component.status === 'DEVICE_TESTED'
        ? 'DEVICE_TESTED実装をRegression Gateへ送る候補として登録しました。'
        : `現在状態=${component.status}。Regression Gateへ進めるにはDEVICE_TESTEDが必要です。`,
      created_at: now,
      updated_at: now,
    };
    this.runs.set(run.run_id, run); this.save();
    return run;
  }

  public planRegression(runId: string): { run?: SafeImprovementRun; suite?: RegressionSuite; reason: string } {
    const run = this.runs.get(runId);
    if (!run) return { reason: 'Safe Improvement Runが存在しません。' };
    const component = componentRegistryService.getComponent(run.component_id);
    if (!component) return { run, reason: 'Componentが存在しません。' };
    if (component.implementation_hash !== run.implementation_hash) {
      run.stage = 'REJECTED'; run.reason = '候補登録後に実装ハッシュが変化したため無効化しました。'; run.updated_at = Date.now(); this.save();
      return { run, reason: run.reason };
    }
    const candidateRun = Boolean(run.candidate_id);
    if (component.status !== 'DEVICE_TESTED' && component.status !== 'VERIFIED' && !(candidateRun && component.status === 'ANALYZED')) {
      run.stage = 'REJECTED'; run.reason = `現在状態=${component.status}。候補はANALYZED、通常部品はDEVICE_TESTED/VERIFIEDが必要です。`; run.updated_at = Date.now(); this.save();
      return { run, reason: run.reason };
    }
    const suite = componentRegressionService.plan(run.component_id, run.environment);
    if (!suite) return { run, reason: 'Regression Suiteを作成できません。' };
    run.suite_id = suite.suite_id;
    run.stage = 'REGRESSION_PLANNED';
    run.reason = `Regression Suite ${suite.suite_id} を作成しました。実行結果待ちです。`;
    run.updated_at = Date.now(); this.save();
    return { run, suite, reason: run.reason };
  }

  public refresh(runId: string): SafeImprovementRun | undefined {
    const run = this.runs.get(runId);
    if (!run || !run.suite_id) return run;
    if (run.stage === 'CANARY' || run.stage === 'ADOPTED' || run.stage === 'ROLLED_BACK') return run;
    const suite = componentRegressionService.refresh(run.suite_id);
    if (!suite) return run;
    if (suite.status === 'PASSED') { run.stage = 'PASSED'; run.reason = 'Regression Suite全件PASS。Promotion Gate判定可能です。'; }
    else if (suite.status === 'FAILED' || suite.status === 'BLOCKED') { run.stage = 'REJECTED'; run.reason = `Regression ${suite.status} のため不採用です。`; }
    else { run.stage = 'WAITING_RESULTS'; run.reason = `Regression ${suite.status}。未完了テストがあります。`; }
    run.updated_at = Date.now(); this.save();
    return run;
  }

  public adopt(runId: string): ComponentPromotionResult {
    const run = this.refresh(runId);
    if (!run) return { componentId: '', accepted: false, reason: 'Safe Improvement Runが存在しません。' };
    if (!run.suite_id) return { componentId: run.component_id, accepted: false, reason: 'Regression Suiteが未作成です。' };
    if (run.stage !== 'PASSED') return { componentId: run.component_id, accepted: false, suiteId: run.suite_id, reason: `現在stage=${run.stage}。Regression PASSが必要です。` };
    // Regression PASSは正式VERIFIEDではなくLIMITED/Canary開始資格として扱う。
    const result = componentPromotionService.validateForLimited(run.suite_id);
    if (result.accepted && run.candidate_id) {
      const before = selfImprovementExperimentService.snapshot();
      const base = componentRegistryService.getComponent(run.base_component_id || '');
      if (!base) {
        run.stage = 'REJECTED';
        run.reason = 'Canary開始前の基底Componentを取得できません。';
        run.updated_at = Date.now(); this.save();
        return { ...result, accepted: false, reason: run.reason };
      }
      const canary = improvementCanaryRollbackService.begin({
        runId: run.run_id,
        component: base,
        environment: run.environment,
        before,
        minSamples: 3,
        maxFailureRate: 0.20,
      });
      const committed = componentImprovementCandidateService.commitForLimited(run.candidate_id);
      if (!committed.accepted) {
        run.stage = 'REJECTED';
        run.reason = `候補Promotion後のCommitを中止: ${committed.reason}`;
        run.updated_at = Date.now(); this.save();
        return { ...result, accepted: false, reason: run.reason };
      }
      const adopted = componentRegistryService.getComponent(run.base_component_id || '');
      if (!adopted || adopted.implementation_hash === base.implementation_hash) {
        run.stage = 'REJECTED';
        run.reason = '採用後の新実装hashを確認できないためCanaryを開始しません。';
        run.updated_at = Date.now(); this.save();
        return { ...result, accepted: false, reason: run.reason };
      }
      improvementCanaryRollbackService.setCanaryHash(run.run_id, adopted.implementation_hash);
      run.canary_id = canary.canary_id;
      run.before_snapshot_at = before.createdAt;
      run.stage = 'CANARY';
      run.reason = `Regression PASS後にLIMITED/Canaryへ移行しました。Before/Afterを保存し、${canary.min_samples}件以上の実利用Canaryを待機します。正式VERIFIEDはCanary通過後に行います。`;
    } else {
      run.stage = result.accepted ? 'ADOPTED' : 'REJECTED';
      run.reason = result.reason;
    }
    run.updated_at = Date.now(); this.save();
    systemLogger.info('SELF_IMPROVEMENT', `🛡️ [SafeImprovement] ${run.component_id}: ${run.stage}`);
    return result;
  }

  public evaluateCanary(runId: string): { status: string; ready: boolean; reason: string; failure_rate?: number; sample_count?: number } | undefined {
    const run = this.runs.get(runId);
    if (!run || run.stage !== 'CANARY') return undefined;
    const evaluation = improvementCanaryRollbackService.evaluate(runId);
    if (!evaluation) return undefined;
    if (evaluation.status === 'PASSED') {
      const promoted = componentPromotionService.promoteIfSafeForCanary(run.run_id, run.base_component_id || run.component_id, run.suite_id || '');
      if (!promoted.accepted) {
        run.stage = 'REJECTED';
        run.reason = `${evaluation.reason} Canaryは通過しましたが正式昇格を停止: ${promoted.reason}`;
      } else {
        run.stage = 'ADOPTED';
        run.reason = `${evaluation.reason} Canary通過。正式VERIFIEDへ昇格しました。`;
      }
    } else if (evaluation.status === 'FAILED') {
      const rollback = improvementCanaryRollbackService.rollback(runId, evaluation.reason);
      run.stage = rollback.accepted ? 'ROLLED_BACK' : 'REJECTED';
      run.reason = rollback.accepted ? `${evaluation.reason} ${rollback.reason}` : `Canary失敗。Rollback停止: ${rollback.reason}`;
    } else {
      run.reason = evaluation.reason;
    }
    run.updated_at = Date.now(); this.save();
    return { status: evaluation.status, ready: evaluation.ready, reason: run.reason, failure_rate: evaluation.failure_rate, sample_count: evaluation.sample_count };
  }

  public list(): SafeImprovementRun[] { return Array.from(this.runs.values()).sort((a,b)=>b.created_at-a.created_at); }

  private load() { try { const raw=storageService.getItem(this.storageKey); if(raw) for(const r of JSON.parse(raw) as SafeImprovementRun[]) this.runs.set(r.run_id,r); } catch {} }
  private save() { try { storageService.setItem(this.storageKey, JSON.stringify(this.list().slice(0,100))); } catch {} }
  private hash(raw:string){ let h=2166136261; for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(16).padStart(8,'0'); }
}
export const safeImprovementPipelineService = SafeImprovementPipelineService.getInstance();
