import { capabilityConfidenceService, CapabilityConfidence } from './capabilityConfidenceService';
import { componentRegistryService } from './componentRegistryService';
import { knowledgeGapService } from './knowledgeGapService';
import { researchService, ResearchResult } from './researchService';
import { systemLogger } from './systemLogger';
import { verifiedKnowledgePromotionService } from './verifiedKnowledgePromotionService';
import { verifiedCapabilityPromotionService } from './verifiedCapabilityPromotionService';
import { mikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';
import { researchToRemediationService } from './researchToRemediationService';
import { ExecutionEnvironment } from './executionRunnerService';

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
        queued++;
        if (!gapsProcessed.includes(gap.id)) gapsProcessed.push(gap.id);
        if (gapsProcessed.length >= limit) break;
      }

      for (const gapId of gapsProcessed) {
        if (options?.signal?.aborted) throw new Error('ユーザー操作により中断');
        const gap = knowledgeGapService.getById(gapId);
        if (!gap || gap.status === 'RESOLVED' || gap.status === 'BLOCKED') continue;
        try {
          const result: ResearchResult = await researchService.researchGap(gap, { forceRoute: 'WEB_SEARCH', requireFresh: true, maxAgeDays: 30, maxPasses: 3 });
          if (result.performed) researched++;
          if (result.resolved) {
            resolved++;
            for (const verification of result.verification || []) {
              if (!verification.promoted) continue;
              const promotion = verifiedKnowledgePromotionService.promote({ gap, claimId: verification.claimId, sourceRequestId: gap.sourceRequestId });
              if (promotion) {
                verifiedCapabilityPromotionService.promote(promotion);
                verifiedKnowledgePromotionService.recordIntoContinuum(promotion, mikiUnifiedLearningContinuumService);
              }
            }
            const remediation = researchToRemediationService.process(gap, result, options?.environment || 'ANDROID');
            if (remediation) notes.push(`${gap.id}: 研究結果を${remediation.status}へ接続${remediation.regressionSuiteIds.length ? ` / Regression ${remediation.regressionSuiteIds.length}件` : ''}`);
          }
          if (!result.resolved) notes.push(`${gap.id}: 検証条件未達のため未解決のまま保持`);
        } catch (error) {
          blocked++;
          notes.push(`${gap.id}: 再検証研究エラー ${String(error)}`);
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
