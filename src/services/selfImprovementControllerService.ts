import { executionEventBusService, ExecutionEvent } from './executionEventBusService';
import { knowledgeGapService, KnowledgeGap } from './knowledgeGapService';
import { researchService, ResearchResult } from './researchService';
import { taskCaseMemoryService } from './taskCaseMemoryService';
import { memoryPromotionService } from './memoryPromotionService';
import { storageService } from './storageService';
import { MemoryItem } from '../types';
import { systemLogger } from './systemLogger';
import { selfImprovementMetricsService } from './selfImprovementMetricsService';
import { selfImprovementExperimentService } from './selfImprovementExperimentService';
import { safeImprovementPipelineService } from './safeImprovementPipelineService';
import { componentRegistryService } from './componentRegistryService';
import { ExecutionEnvironment } from './executionRunnerService';
import { improvementProposalService } from './improvementProposalService';
import { workDirectiveIngestionService } from './workDirectiveIngestionService';
import { evidenceBasedSelfImprovementEngine } from './evidenceBasedSelfImprovementEngine';
import { autonomousContinuousEvolutionService } from './autonomousContinuousEvolutionService';
import { StructuredDirective } from '../types/evidenceSelfImprovementTypes';

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
  directiveId?: string;
  caseId?: string;
  gapId?: string;
  targetChapter?: number;
  targetFile?: string;
}

export interface ImprovementRun {
  run_id: string;
  trigger: string;
  decision: ImprovementDecision;
  result?: string;
  experiment_id?: string;
  verdict?: 'ADOPT' | 'HOLD' | 'REJECT';
  score_delta?: number;
  created_at: number;
}

/**
 * 自己改善の「Canonical (正統) 司令塔」。
 * 作業指示テキスト (Directive)、知識Gap、安定ケース、自己コード進化 (Autonomous Evolution) を
 * 単一の正規経路 (Canonical Pipeline) として統率し、グローバル排他ロックで二重実行を防止します。
 */
export class SelfImprovementControllerService {
  private static instance: SelfImprovementControllerService;
  private initialized = false;
  private unsubscribe: (() => void)[] = [];
  private running = false;
  private lastRunAt = 0;
  private readonly cooldownMs = 15_000;
  private readonly storageKey = 'miki_self_improvement_runs_v1';
  private constructor() {}
  public static getInstance() {
    return this.instance || (this.instance = new SelfImprovementControllerService());
  }

  public initialize() {
    if (this.initialized) return;
    this.initialized = true;
    this.unsubscribe.push(
      executionEventBusService.subscribe('execution.completed', (e) => this.schedule('execution.completed', e))
    );
    this.unsubscribe.push(
      executionEventBusService.subscribe('execution.failed', (e) => this.schedule('execution.failed', e))
    );
    selfImprovementMetricsService.initialize();
    systemLogger.info('SELF_IMPROVEMENT', '🧭 [SelfImprovement: Canonical Controller] initialized');
  }

  public dispose() {
    this.unsubscribe.forEach((u) => u());
    this.unsubscribe = [];
    selfImprovementMetricsService.dispose();
    this.initialized = false;
  }

  public async runOnce(trigger = 'manual'): Promise<ImprovementRun> {
    const now = Date.now();
    if (this.running) {
      return this.record(trigger, { action: 'IDLE', reason: '別の自己改善サイクルが実行中です。' }, 'busy');
    }
    if (now - this.lastRunAt < this.cooldownMs) {
      return this.record(trigger, { action: 'IDLE', reason: '自己改善サイクルのクールダウン中です。' }, 'cooldown');
    }

    // 12. Canonical Pipeline: グローバル排他ロックの獲得 (二重実行防止)
    const lock = evidenceBasedSelfImprovementEngine.acquireExecutionLock('CanonicalController');
    if (!lock.acquired) {
      return this.record(trigger, { action: 'IDLE', reason: lock.reason || '排他ロック取得不可' }, 'locked');
    }

    this.running = true;
    this.lastRunAt = now;
    const before = selfImprovementExperimentService.snapshot();

    try {
      // ── 指示書 v23 第2章 & ターゲット選定 ──
      // 1. 作業指示 (Work Directive) の最優先評価
      const activeDirective = workDirectiveIngestionService.getPendingDirective();
      if (activeDirective) {
        systemLogger.info(
          'SELF_IMPROVEMENT',
          `📋 [Canonical Target Selection] 作業指示書を最優先ターゲットとして選定: ${activeDirective.title}`
        );
        workDirectiveIngestionService.markStatus(activeDirective.directiveId, 'IN_PROGRESS');

        const decision: ImprovementDecision = {
          action: 'EXECUTE_DIRECTIVE',
          reason: `受領した作業指示「${activeDirective.title}」を最優先履行します。(要求: ${activeDirective.requirements.length}項目)`,
          directiveId: activeDirective.directiveId,
          targetFile: activeDirective.targets[0],
        };

        // 自律進化パイプラインを指示書ターゲットで実行
        try {
          const evoRecord = await autonomousContinuousEvolutionService.runFullAutonomousCycle({
            prompt: `作業指示履行: ${activeDirective.title} - ${activeDirective.goal}`,
            targetFile: activeDirective.targets[0] || 'src/services/evidenceBasedSelfImprovementEngine.ts',
            reason: activeDirective.goal,
          });

          workDirectiveIngestionService.markStatus(
            activeDirective.directiveId,
            evoRecord.applied ? 'COMPLETED' : 'PENDING',
            evoRecord.changeSetId,
            `配備結果: ${evoRecord.applied ? '成功' : '承認待ちまたは保留'} (スコア: ${evoRecord.newScore}点)`
          );

          return this.recordMeasured(
            trigger,
            decision,
            evoRecord.applied ? 'directive-completed' : 'directive-staged',
            before
          );
        } catch (dirErr: any) {
          workDirectiveIngestionService.markStatus(
            activeDirective.directiveId,
            'PENDING',
            undefined,
            `試行中エラー: ${dirErr?.message}`
          );
          return this.recordMeasured(trigger, decision, `directive-error: ${dirErr?.message}`, before);
        }
      }

      // 2. 既存Auditシグナルと通常改善候補
      const signals = selfImprovementMetricsService.rankWeaknesses();
      const stable = this.taskCaseMemoryServiceStable();
      const gap = knowledgeGapService.listOpen(1)[0];
      const deviceCandidate = componentRegistryService
        .getAllComponents()
        .find((c) => c.status === 'DEVICE_TESTED' && !!c.implementation_hash);

      if (stable && (signals[0]?.kind !== 'FAILURE_RATE' || signals[0].score < 70)) {
        const decision: ImprovementDecision = {
          action: 'PROMOTE_CASE',
          reason: `${signals[0]?.reason || '安定成功ケース'} 安定ケースを長期記憶へ昇格します。`,
          caseId: stable.case_id,
        };
        const memories = storageService.getMemories();
        const candidate = memoryPromotionService.createCandidate(stable, memories);
        if (candidate) {
          storageService.saveMemoryItem(candidate);
          return this.recordMeasured(trigger, decision, 'promoted', before);
        }
        return this.recordMeasured(trigger, decision, 'already-promoted-or-not-created', before);
      }

      if (deviceCandidate) {
        const environment = this.pickEnvironment(deviceCandidate.supported_environments);
        const topSignal = signals[0];
        if (topSignal?.kind === 'FAILURE_RATE' && topSignal.score >= 70) {
          const proposal = improvementProposalService.requestCloudProposal(
            deviceCandidate.component_id,
            `失敗率が高いため改善案を要求します。${topSignal.reason}`,
            topSignal.reason
          );
          const decision: ImprovementDecision = {
            action: 'REQUEST_CLOUD_PROPOSAL',
            reason: proposal
              ? `高失敗率を受け、${deviceCandidate.component_id} の改善案をCloud AIへ限定要求しました。`
              : `高失敗率ですが改善案要求を作成できませんでした。`,
            caseId: proposal?.proposal_id,
          };
          return this.recordMeasured(
            trigger,
            decision,
            proposal ? 'cloud-proposal-requested' : 'proposal-blocked',
            before
          );
        }
        const proposal = safeImprovementPipelineService.propose(deviceCandidate.component_id, environment);
        const planned = safeImprovementPipelineService.planRegression(proposal.run_id);
        const decision: ImprovementDecision = {
          action: 'RUN_REGRESSION',
          reason: `DEVICE_TESTED部品 ${deviceCandidate.component_id} の安全なRegressionを開始します。`,
          caseId: planned.suite?.suite_id,
        };
        return this.recordMeasured(trigger, decision, planned.suite ? 'regression-planned' : 'regression-blocked', before);
      }

      if (gap) {
        const decision: ImprovementDecision = {
          action: 'RESEARCH_GAP',
          reason: `未解決Knowledge Gapを優先調査します: ${gap.query}`,
          gapId: gap.id,
        };
        const result = await researchService.researchGap(gap);
        return this.recordMeasured(trigger, decision, result.resolved ? 'research-resolved' : 'research-not-resolved', before);
      }

      // 3. 仕様書ドリフトまたは未実装章の自律自己コード改善
      const nextTarget = autonomousContinuousEvolutionService.selectNextTarget();
      const decision: ImprovementDecision = {
        action: 'AUTONOMOUS_CODE_EVOLUTION',
        reason: nextTarget.reason,
        targetChapter: nextTarget.chapter?.chapterNumber,
        targetFile: nextTarget.targetFile,
      };
      const evoRecord = await autonomousContinuousEvolutionService.runFullAutonomousCycle({
        chapterNumber: nextTarget.chapter?.chapterNumber,
        targetFile: nextTarget.targetFile,
        prompt: nextTarget.prompt,
        reason: nextTarget.reason,
      });
      return this.recordMeasured(
        trigger,
        decision,
        evoRecord.applied ? 'evolution-applied' : 'evolution-staged',
        before
      );

      return this.recordMeasured(
        trigger,
        { action: 'IDLE', reason: '現在、自動改善を開始すべき安定ケース・未解決Gap・仕様ドリフトはありません。' },
        'no-op',
        before
      );
    } catch (error: any) {
      return this.recordMeasured(
        trigger,
        { action: 'IDLE', reason: `自己改善サイクル中のエラー: ${String(error)}` },
        'error',
        before
      );
    } finally {
      this.running = false;
      evidenceBasedSelfImprovementEngine.releaseExecutionLock('CanonicalController');
    }
  }

  /**
   * 次回の改善アクション・ターゲット選定の判定 (Read-only Preview)
   */
  public decide(): ImprovementDecision {
    // 1. 作業指示 (Work Directive) の確認
    const activeDirective = workDirectiveIngestionService.getPendingDirective();
    if (activeDirective) {
      return {
        action: 'EXECUTE_DIRECTIVE',
        reason: `作業指示「${activeDirective.title}」が最優先ターゲットに指定されています。(要件: ${activeDirective.requirements.length}件)`,
        directiveId: activeDirective.directiveId,
        targetFile: activeDirective.targets[0],
      };
    }

    const signals = selfImprovementMetricsService.rankWeaknesses();
    const stable = this.taskCaseMemoryServiceStable();
    if (stable && (signals[0]?.kind !== 'FAILURE_RATE' || signals[0].score < 70)) {
      return {
        action: 'PROMOTE_CASE',
        reason: `${signals[0]?.reason || '安定成功ケース'} 安定成功ケースを長期記憶へ昇格可能。`,
        caseId: stable.case_id,
      };
    }
    const gap = knowledgeGapService.listOpen(1)[0];
    if (gap) {
      return { action: 'RESEARCH_GAP', reason: `${signals[0]?.reason || '未解決Gap'}: ${gap.query}`, gapId: gap.id };
    }
    if (signals[0]?.kind === 'FAILURE_RATE' && signals[0].score >= 70) {
      return {
        action: 'REQUEST_CLOUD_PROPOSAL',
        reason: `高失敗率を検出しました。Cloud AIには改善案の提案だけを限定要求し、Candidate/Regression Gateで隔離検証します。 ${signals[0].reason}`,
      };
    }

    const nextTarget = autonomousContinuousEvolutionService.selectNextTarget();
    if (nextTarget) {
      return {
        action: 'AUTONOMOUS_CODE_EVOLUTION',
        reason: nextTarget.reason,
        targetChapter: nextTarget.chapter?.chapterNumber,
        targetFile: nextTarget.targetFile,
      };
    }

    if (signals[0]?.kind === 'FAILURE_RATE') return { action: 'OBSERVE_FAILURE', reason: signals[0].reason };
    return { action: 'IDLE', reason: signals[0]?.reason || '改善対象なし' };
  }

  public listRuns(): ImprovementRun[] {
    try {
      const raw = storageService.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private pickEnvironment(envs: string[]): ExecutionEnvironment {
    if (envs.some((e) => /termux/i.test(e))) return 'TERMUX';
    if (envs.some((e) => /android/i.test(e))) return 'ANDROID';
    if (envs.some((e) => /excel.*windows|windows/i.test(e))) return 'EXCEL_WINDOWS';
    if (envs.some((e) => /excel.*mac|mac/i.test(e))) return 'EXCEL_MAC';
    return 'EXTERNAL_RUNNER';
  }

  private taskCaseMemoryServiceStable() {
    return taskCaseMemoryService.list().find((c) => c.outcome === 'SUCCESS' && c.maturity === 'STABLE' && c.component_ids.length > 0);
  }

  private schedule(trigger: string, _event: ExecutionEvent) {
    setTimeout(() => {
      void this.runOnce(trigger);
    }, 0);
  }

  private recordMeasured(
    trigger: string,
    decision: ImprovementDecision,
    result: string,
    before: ReturnType<typeof selfImprovementExperimentService.snapshot>
  ): ImprovementRun {
    const after = selfImprovementExperimentService.snapshot();
    const experiment = selfImprovementExperimentService.evaluate(decision.action, before, after, result);
    return this.record(trigger, decision, result, experiment);
  }

  private record(
    trigger: string,
    decision: ImprovementDecision,
    result: string,
    experiment?: ReturnType<typeof selfImprovementExperimentService.evaluate>
  ): ImprovementRun {
    const run: ImprovementRun = {
      run_id: `SIR-${this.hash(`${trigger}|${decision.action}|${Date.now()}`)}`,
      trigger,
      decision,
      result,
      experiment_id: experiment?.experiment_id,
      verdict: experiment?.verdict,
      score_delta: experiment?.scoreDelta,
      created_at: Date.now(),
    };
    const history = this.listRuns();
    history.unshift(run);
    history.splice(100);
    try {
      storageService.setItem(this.storageKey, JSON.stringify(history));
    } catch {}
    systemLogger.info('SELF_IMPROVEMENT', `🧭 [SelfImprovement] ${decision.action}: ${result}`);
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

