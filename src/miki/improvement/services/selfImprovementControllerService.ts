import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { selfImprovementMetricsService } from './selfImprovementMetricsService';
import { selfImprovementIngressService } from '../../core/services/selfImprovementIngressService';
import type { ChangeSetID } from '../../../types/evidenceSelfImprovementTypes';

export type ImprovementAction =
  | 'EXECUTE_DIRECTIVE'
  | 'AUTONOMOUS_CODE_EVOLUTION'
  | 'PROMOTE_CASE'
  | 'RESEARCH_GAP'
  | 'OBSERVE_FAILURE'
  | 'RUN_REGRESSION'
  | 'REQUEST_CLOUD_PROPOSAL'
  | 'IDLE';

export interface ImprovementDecision {
  action: ImprovementAction;
  reason: string;
  strategyId?: string;
  strategyName?: string;
  directiveId?: string;
  caseId?: string;
  gapId?: string;
  targetChapter?: number;
  targetFile?: string;
}

export interface ImprovementRun {
  run_id: string;
  changeSetId?: ChangeSetID;
  trigger: string;
  decision: ImprovementDecision;
  result?: string;
  experiment_id?: string;
  verdict?: 'ADOPT' | 'HOLD' | 'REJECT';
  score_delta?: number;
  created_at: number;
}

export class SelfImprovementControllerService {
  private static instance: SelfImprovementControllerService;
  private initialized = false;
  private running = false;
  private readonly storageKey = 'miki_self_improvement_runs_v1';

  private constructor() {}

  public static getInstance() {
    return this.instance || (this.instance = new SelfImprovementControllerService());
  }

  public initialize() {
    if (this.initialized) return;
    this.initialized = true;
    selfImprovementMetricsService.initialize();
    systemLogger.info(
      'SELF_IMPROVEMENT',
      '[SelfImprovement: Compatibility Facade] initialized; CORE owns planning authority'
    );
  }

  public dispose() {
    selfImprovementMetricsService.dispose();
    this.initialized = false;
  }

  public isLocked(): boolean {
    return this.running;
  }

  public async executeDirective(directiveId: string): Promise<ImprovementRun> {
    return this.record(
      `directive-${directiveId}`,
      { action: 'IDLE', reason: 'CORE_INGRESS_REQUIRED', directiveId },
      'core-ingress-required'
    );
  }

  public async runOnce(trigger = 'manual'): Promise<ImprovementRun> {
    if (this.running) {
      return this.record(
        trigger,
        { action: 'IDLE', reason: '自己改善要求の受付処理中です。' },
        'busy'
      );
    }

    this.running = true;
    try {
      const queued = selfImprovementIngressService.submit({
        trigger,
        source: 'UI',
        runType: 'USER_REQUEST',
        sourceId: `self-improvement-controller:${trigger}`,
      });

      const decision: ImprovementDecision = {
        action: 'AUTONOMOUS_CODE_EVOLUTION',
        reason: '自己改善要求をCanonical IngressからCOREへ委譲しました。',
      };

      return this.record(
        trigger,
        decision,
        `queued-for-core:${queued.runId || queued.requestId || 'accepted'}`,
        queued.changeSetId
      );
    } catch (error) {
      return this.record(
        trigger,
        { action: 'IDLE', reason: `CORE_INGRESS_FAILED: ${String(error)}` },
        'core-ingress-failed'
      );
    } finally {
      this.running = false;
    }
  }

  public decide(): ImprovementDecision {
    return {
      action: 'IDLE',
      reason: 'CORE_AUTHORITY_ONLY: planner decision is owned by CORE.',
    };
  }

  public listRuns(): ImprovementRun[] {
    try {
      const raw = storageService.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private record(
    trigger: string,
    decision: ImprovementDecision,
    result: string,
    changeSetId?: ChangeSetID
  ): ImprovementRun {
    const run: ImprovementRun = {
      run_id: `SIR-${this.hash(`${trigger}|${decision.action}|${Date.now()}`)}`,
      changeSetId,
      trigger,
      decision,
      result,
      created_at: Date.now(),
    };

    const history = this.listRuns();
    history.unshift(run);
    history.splice(100);

    try {
      storageService.setItem(this.storageKey, JSON.stringify(history));
    } catch {}

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `[SelfImprovement Compatibility Facade] ${decision.action}: ${result}`
    );

    return run;
  }

  private hash(raw: string) {
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) {
      h ^= raw.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

export const selfImprovementControllerService = SelfImprovementControllerService.getInstance();
