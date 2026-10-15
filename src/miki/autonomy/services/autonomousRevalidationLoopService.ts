import { capabilityConfidenceService, CapabilityConfidence } from '../../capability/services/capabilityConfidenceService';
import { componentRegistryService } from '../../capability/services/componentRegistryService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { coreTaskIngressService } from '../../core/services/coreTaskIngressService';
import { taskBlackboardService } from '../../core/services/taskBlackboardService';
import { systemLogger } from '../../../services/systemLogger';
import { ExecutionEnvironment } from '../../execution/services/executionRunnerService';

export interface RevalidationRun {
  runId: string;
  startedAt: number;
  completedAt: number;
  inspected: number;
  queued: number;
  researched: number;
  resolved: number;
  blocked: number;
  staleCapabilities: string[];
  gapsProcessed: string[];
  notes: string[];
}

/**
 * Deterministic closed loop for stale capability/knowledge evidence.
 *
 * Boundary:
 * - Does not promote a Component to VERIFIED.
 * - Web search produces Evidence/Claims; verifier remains the truth boundary.
 * - Stale executable capability is never silently reused as fresh.
 * - Revalidation is idempotent by open-gap matching.
 */
export class AutonomousRevalidationLoopService {
  private static instance: AutonomousRevalidationLoopService;
  private running = false;
  private history: RevalidationRun[] = [];
  private constructor() {}

  public static getInstance(): AutonomousRevalidationLoopService {
    return this.instance || (this.instance = new AutonomousRevalidationLoopService());
  }

  public isRunning(): boolean { return this.running; }
  public list(limit = 20): RevalidationRun[] { return this.history.slice(0, Math.max(1, limit)).map(r => ({ ...r, staleCapabilities: [...r.staleCapabilities], gapsProcessed: [...r.gapsProcessed], notes: [...r.notes] })); }

  public async run(options?: { limit?: number; environment?: ExecutionEnvironment; signal?: AbortSignal }): Promise<RevalidationRun> {
    if (this.running) throw new Error('revalidation loop is already running');
    this.running = true;
    const startedAt = Date.now();
    const limit = Math.max(1, Math.min(20, options?.limit ?? 8));
    const staleCapabilities: string[] = [];
    const gapsProcessed: string[] = [];
    const staleGapIds = new Set<string>();
    const notes: string[] = [];
    let queued = 0;
    let researched = 0;
    let resolved = 0;
    let blocked = 0;

    try {
      const components = componentRegistryService.getAllComponents().filter(c => c.status === 'VERIFIED');
      for (const component of components.slice(0, limit * 2)) {
        if (options?.signal?.aborted) throw new Error('ユーザー操作により中断');
        const confidence = capabilityConfidenceService.evaluate(component.component_id, options?.environment);
        if (!confidence.revalidationRequired) continue;
        staleCapabilities.push(component.component_id);
        const gap = knowledgeGapService.detect({
          query: this.buildQuery(component.component_id, confidence, options?.environment),
          type: confidence.stale ? 'STALE_INFORMATION' : 'WEAK_COMPONENT',
          priority: Math.max(75, Math.min(100, Math.round(100 - confidence.confidence + confidence.failureRisk * 0.25))),
          requiredEvidence: [
            '現在の実装・環境条件に適合する一次資料または公式資料',
            '古い成功経験を現在も適用できることを確認できる証拠',
            '必要なら再現可能な実行検証結果',
          ],
          reason: confidence.reason,
        });
        staleGapIds.add(gap.id);
      }

      // 未解決Knowledge Gapを既存COREで有界に調査する。
      const now = Date.now();
      const maxGapTasksPerRun = limit >= 6 ? 3 : 1;

      const eligibleGaps = knowledgeGapService.listOpen(500)
        .filter(gap => {
          const exponent = Math.min(7, Math.max(0, gap.attempts - 1));
          const retryDelayMs = Math.min(
            24 * 60 * 60 * 1000,
            15 * 60 * 1000 * (2 ** exponent)
          );
          return now - (gap.lastResearchAt || 0) >= retryDelayMs;
        })
        .sort((a, b) =>
          Number(staleGapIds.has(b.id)) - Number(staleGapIds.has(a.id)) ||
          (a.lastResearchAt || a.createdAt) -
            (b.lastResearchAt || b.createdAt) ||
          b.priority - a.priority ||
          a.id.localeCompare(b.id)
        );

      const recentTasks = taskBlackboardService.list(200);
      let startedGapTasks = 0;

      for (const gap of eligibleGaps) {
        if (options?.signal?.aborted) {
          throw new Error('ユーザー操作により中断');
        }
        if (startedGapTasks >= maxGapTasksPerRun) break;

        // 最近のBlackboard Taskに同じGapがあれば二重投入しない。
        const existingTask = recentTasks.find(task => {
          const payloadValue = task.entries.find(
            entry => entry.kind === 'INPUT' && entry.key === 'payload'
          )?.value;

          if (
            !payloadValue ||
            typeof payloadValue !== 'object' ||
            Array.isArray(payloadValue)
          ) return false;

          const payload = payloadValue as Record<string, unknown>;
          const linkedGapId = String(
            payload.autonomousKnowledgeGapId || payload.gapId || ''
          );

          return linkedGapId === gap.id &&
            !['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.status);
        });

        if (existingTask) {
          if (existingTask.status === 'PAUSED') {
            // CoreOrchestratorの実装で確認したリソース予算停止だけ再開する。
            // ユーザー停止・外部実行待ち等を自動で解除しない。
            const budgetPaused =
              (existingTask.pausedReason || '').startsWith('BACKGROUND_BUDGET:') ||
              existingTask.entries.some(entry =>
                entry.kind === 'CHECKPOINT' &&
                entry.key === 'coreCycleBudgetExhausted'
              );

            if (!budgetPaused) {
              notes.push(
                `${gap.id}: 既存CORE Task ${existingTask.taskId} は停止状態を維持`
              );
              continue;
            }

            const dispatchStartedAt = Date.now();
            const previousEntryCount = existingTask.entries.length;

            try {
              const resumed = await coreTaskIngressService.resume(
                existingTask.taskId,
                6
              );

              if (!resumed) {
                const currentGap = knowledgeGapService.getById(gap.id);
                if ((currentGap?.lastResearchAt || 0) < dispatchStartedAt) {
                  knowledgeGapService.markResearching(gap.id);
                }
                blocked++;
                notes.push(`${gap.id}: 予算停止Taskを再開できなかった`);
                continue;
              }

              const updatedTask = taskBlackboardService.get(
                existingTask.taskId
              );
              const newResearchResult = (updatedTask?.entries || [])
                .slice(previousEntryCount)
                .some(entry =>
                  entry.domain === 'research' && entry.kind === 'RESULT'
                );

              if (newResearchResult) researched++;

              const currentGap = knowledgeGapService.getById(gap.id);
              if ((currentGap?.lastResearchAt || 0) < dispatchStartedAt) {
                // COREがResearchを実行しなかった場合も即時再投入を防ぐ。
                knowledgeGapService.markResearching(gap.id);
              }

              gapsProcessed.push(gap.id);
              startedGapTasks++;

              if (knowledgeGapService.getById(gap.id)?.status === 'RESOLVED') {
                resolved++;
              }

              notes.push(`${gap.id}: 既存CORE Task ${existingTask.taskId} を再開`);
            } catch (error) {
              const currentGap = knowledgeGapService.getById(gap.id);
              if ((currentGap?.lastResearchAt || 0) < dispatchStartedAt) {
                knowledgeGapService.markResearching(gap.id);
              }
              blocked++;
              notes.push(`${gap.id}: CORE Task再開エラー ${String(error)}`);
            }
            continue;
          }

          notes.push(
            `${gap.id}: CORE Task ${existingTask.taskId} が進行中のため二重投入しない`
          );
          continue;
        }

        const dispatchStartedAt = Date.now();

        try {
          const started = await coreTaskIngressService.submit({
            kind: 'SYSTEM_TASK',
            goal:
              `未解決Knowledge GapをCOREで調査し、EvidenceとClaimを集めてVerifierで検証する: ${gap.query}`,
            source: 'core',
            payload: {
              operation: 'EXECUTE_AUTONOMOUS_SEARCH',
              gapId: gap.id,
              autonomousKnowledgeGapId: gap.id,
              query: gap.query,
              useSearch: true,
              requiredEvidence: [...gap.requiredEvidence],
              background: true,
              executionPriority: 'BACKGROUND',
              orchestrationMode: 'AUTONOMOUS_KNOWLEDGE_GAP',
              sourceRequestId: gap.sourceRequestId || '',
            },
            maxCycles: 6,
          });

          queued++;

          const updatedTask = taskBlackboardService.get(
            started.task.taskId
          );
          if ((updatedTask?.entries || []).some(entry =>
            entry.domain === 'research' && entry.kind === 'RESULT'
          )) {
            researched++;
          }

          // ResearchServiceが更新済みなら再度attemptsを増やさない。
          const currentGap = knowledgeGapService.getById(gap.id);
          if ((currentGap?.lastResearchAt || 0) < dispatchStartedAt) {
            knowledgeGapService.markResearching(gap.id);
          }

          gapsProcessed.push(gap.id);
          startedGapTasks++;

          if (knowledgeGapService.getById(gap.id)?.status === 'RESOLVED') {
            resolved++;
          }

          notes.push(`${gap.id}: CORE Task ${started.task.taskId} へ調査を委譲`);
        } catch (error) {
          const currentGap = knowledgeGapService.getById(gap.id);
          if ((currentGap?.lastResearchAt || 0) < dispatchStartedAt) {
            knowledgeGapService.markResearching(gap.id);
          }
          blocked++;
          notes.push(`${gap.id}: COREによる調査投入エラー ${String(error)}`);
        }
      }

      notes.push('検索結果だけでは能力のVERIFIED状態を変更せず、Evidence→Claim→Verifier境界を維持');
      const completedAt = Date.now();
      const run: RevalidationRun = {
        runId: `REVALIDATE-${this.hash(`${startedAt}|${staleCapabilities.join(',')}|${gapsProcessed.join(',')}`)}`,
        startedAt,
        completedAt,
        inspected: components.length,
        queued,
        researched,
        resolved,
        blocked,
        staleCapabilities,
        gapsProcessed,
        notes,
      };
      this.history.unshift(run);
      this.history = this.history.slice(0, 50);
      systemLogger.info('SELF_IMPROVEMENT', `🔁 [自動再検証] inspected=${run.inspected} stale=${run.staleCapabilities.length} researched=${run.researched} resolved=${run.resolved}`);
      return run;
    } finally {
      this.running = false;
    }
  }

  private buildQuery(componentId: string, confidence: CapabilityConfidence, environment?: string): string {
    return [
      `Miki capability revalidation: ${componentId}`,
      environment ? `environment=${environment}` : '',
      `successRate=${confidence.successRate}`,
      `failures=${confidence.failures}`,
      confidence.currentImplementationHash ? `currentHash=${confidence.currentImplementationHash}` : '',
      '現在の仕様・公式資料・既知の失敗原因・互換性を調査し、古い経験を現在へ適用できる条件を確認する',
    ].filter(Boolean).join(' / ');
  }

  private hash(raw: string): string {
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

export const autonomousRevalidationLoopService = AutonomousRevalidationLoopService.getInstance();
