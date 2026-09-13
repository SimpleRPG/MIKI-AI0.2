import { executionEventBusService, ExecutionEvent } from './executionEventBusService';
import { researchToRemediationService } from './researchToRemediationService';
import { componentRegressionService } from './componentRegressionService';
import { knowledgeGapService, KnowledgeGap } from './knowledgeGapService';
import { researchService, ResearchResult } from './researchService';
import { mikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';
import { verifiedKnowledgePromotionService } from './verifiedKnowledgePromotionService';
import { verifiedCapabilityPromotionService } from './verifiedCapabilityPromotionService';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';
import { counterexampleContractRefinementService } from './counterexampleContractRefinementService';
import { claimDatabaseService } from './claimDatabaseService';
import { ExecutionEnvironment } from './executionRunnerService';

export type RecoveryStatus = 'RESEARCHING' | 'REQUEUED' | 'KNOWLEDGE_ONLY' | 'QUARANTINED' | 'BLOCKED';

export interface RemediationFailureRecoveryRecord {
  recoveryId: string;
  sourceRemediationId: string;
  requestId: string;
  componentId: string;
  environment: string;
  failureSignature: string;
  gapId?: string;
  nextRemediationId?: string;
  status: RecoveryStatus;
  attempt: number;
  createdAt: number;
  updatedAt: number;
  reason: string;
}

/**
 * Regression failure -> cause re-research -> verified knowledge -> new safe validation.
 *
 * This service deliberately does NOT generate or apply arbitrary code. It only creates
 * a new Knowledge Gap and sends it through Evidence -> Claim -> Verifier -> existing
 * VERIFIED capability regression. Repeated failure is bounded and can enter quarantine.
 */
export class RemediationFailureRecoveryService {
  private static instance: RemediationFailureRecoveryService;
  private readonly storageKey = 'miki_remediation_failure_recovery_v1';
  private readonly cooldownMs = 60_000;
  private readonly maxAttempts = 3;
  private records: RemediationFailureRecoveryRecord[] = [];
  private recent = new Map<string, number>();
  private initialized = false;
  private unsubscribe?: () => void;

  private constructor() { this.load(); }
  public static getInstance(): RemediationFailureRecoveryService {
    return this.instance || (this.instance = new RemediationFailureRecoveryService());
  }

  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.unsubscribe = executionEventBusService.subscribe('execution.failed', event => { void this.onFailure(event); });
    systemLogger.info('SELF_IMPROVEMENT', '🛠️ [RemediationFailureRecovery] failure→research→revalidation loop initialized');
  }

  public dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.initialized = false;
  }

  public list(limit = 50): RemediationFailureRecoveryRecord[] {
    return this.records.slice(0, Math.max(1, limit)).map(r => ({ ...r }));
  }

  public async recover(remediationId: string, event: ExecutionEvent): Promise<RemediationFailureRecoveryRecord | undefined> {
    const source = researchToRemediationService.get(remediationId);
    if (!source) return undefined;

    const signature = this.signature(source.remediationId, event);
    const now = Date.now();
    const last = this.recent.get(signature) || 0;
    if (now - last < this.cooldownMs) return undefined;
    this.recent.set(signature, now);

    const previousAttempts = this.records
      .filter(r => r.sourceRemediationId === remediationId && r.failureSignature === signature)
      .reduce((max, r) => Math.max(max, r.attempt), 0);
    const attempt = previousAttempts + 1;

    if (attempt > this.maxAttempts) {
      const blocked = this.record({
        sourceRemediationId: remediationId,
        requestId: event.request_id,
        componentId: event.component_id,
        environment: event.environment,
        failureSignature: signature,
        status: 'QUARANTINED',
        attempt,
        reason: '同一Remediationの同一失敗が上限回数を超えたため、反復自己修復を停止しました。第142章の知識検疫を優先します。',
      });
      mikiUnifiedLearningContinuumService.observe({
        domain: 'execution', action: 'remediation_failure_quarantined',
        input: `${source.statement} ${event.error_message || event.output_summary || ''}`,
        outcome: 'FAILURE', verified: false,
        capabilityIds: source.candidateComponentIds,
        lesson: `recovery:${blocked.recoveryId}:quarantined`,
      });
      return blocked;
    }

    const error = String(event.error_message || event.output_summary || 'execution_failed');
    const gap: KnowledgeGap = knowledgeGapService.detect({
      query: this.buildQuery(source.statement, event, attempt),
      type: 'WEAK_COMPONENT',
      priority: Math.max(92 - (attempt - 1) * 8, 70),
      requiredEvidence: [
        '今回のRegression失敗原因を直接説明する公式または一次資料',
        '現在の実装hash・実行環境・依存条件との整合性',
        '前回の研究結果と異なる場合は差分と反例',
        '可能なら同一条件で再現可能な検証結果',
      ],
      sourceRequestId: event.request_id,
      reason: `研究後Regressionが失敗したため、前回知識を無条件に再利用せず原因を再調査する。attempt=${attempt}; error=${error}`,
    });

    const base = this.record({
      sourceRemediationId: remediationId,
      requestId: event.request_id,
      componentId: event.component_id,
      environment: event.environment,
      failureSignature: signature,
      gapId: gap.id,
      status: 'RESEARCHING',
      attempt,
      reason: 'Regression失敗を新しいKnowledge Gapへ戻し、独立したWeb再調査を開始します。',
    });

    try {
      const result: ResearchResult = await researchService.researchGap(gap, {
        forceRoute: 'WEB_SEARCH',
        requireFresh: true,
        maxAgeDays: 30,
        maxPasses: 3,
      });

      const next = await this.processResearch(gap, result, event, base);
      return next;
    } catch (errorCaught) {
      const blocked = this.update(base.recoveryId, {
        status: 'BLOCKED',
        reason: `再調査に失敗: ${String(errorCaught)}`,
      });
      return blocked;
    }
  }

  private async processResearch(
    gap: KnowledgeGap,
    result: ResearchResult,
    event: ExecutionEvent,
    base: RemediationFailureRecoveryRecord,
  ): Promise<RemediationFailureRecoveryRecord> {
    if (!result.resolved) {
      return this.update(base.recoveryId, {
        status: 'BLOCKED',
        reason: '再調査でVerifierによる解決条件を満たさなかったため、推測修正を行わず停止しました。',
      });
    }

    for (const verification of result.verification || []) {
      if (!verification.promoted) continue;
      const promotion = verifiedKnowledgePromotionService.promote({ gap, claimId: verification.claimId, sourceRequestId: event.request_id });
      if (promotion) {
        verifiedCapabilityPromotionService.promote(promotion);
        verifiedKnowledgePromotionService.recordIntoContinuum(promotion, mikiUnifiedLearningContinuumService);
      }
    }

    const promotedClaimIds = (result.verification || []).filter(v => v.promoted).map(v => v.claimId);
    const promotedV = (result.verification || []).find(v => v.promoted);
    const verifiedStatement = promotedV ? claimDatabaseService.getClaim(promotedV.claimId)?.statement : undefined;
    counterexampleContractRefinementService.refine({
      sourceFailureId: base.recoveryId,
      componentId: event.component_id,
      environment: event.environment,
      counterexample: `${event.error_message || event.output_summary || 'execution_failed'} / ${gap.query}`,
      claimIds: promotedClaimIds,
      verifiedStatement,
    });

    const remediation = researchToRemediationService.process(gap, result, event.environment);
    if (!remediation) {
      return this.update(base.recoveryId, {
        status: 'KNOWLEDGE_ONLY',
        reason: '再調査は検証済み知識を得たが、安全に対応付けられる既存VERIFIED能力がないため実行へ戻しません。',
      });
    }

    if (remediation.status === 'QUARANTINED') {
      return this.update(base.recoveryId, {
        nextRemediationId: remediation.remediationId,
        status: 'QUARANTINED',
        reason: '再調査結果が競合したため、第142章の知識検疫に入り実行再投入を停止しました。',
      });
    }

    if (remediation.status === 'VALIDATION_QUEUED') {
      mikiUnifiedLearningContinuumService.observe({
        domain: 'execution', action: 'remediation_failure_recovered_to_queue',
        input: `${gap.query} ${remediation.statement}`,
        outcome: 'SUCCESS', verified: true,
        capabilityIds: remediation.candidateComponentIds,
        lesson: `recovery:${base.recoveryId}:queued:${remediation.remediationId}`,
      });
      return this.update(base.recoveryId, {
        nextRemediationId: remediation.remediationId,
        status: 'REQUEUED',
        reason: `再調査で検証済み知識を得て、新しいRegression Suite ${remediation.regressionSuiteIds.length}件へ再投入待機しました。`,
      });
    }

    return this.update(base.recoveryId, {
      nextRemediationId: remediation.remediationId,
      status: 'KNOWLEDGE_ONLY',
      reason: '再調査結果は保存したが、現行環境で安全なRegression再投入条件を満たしませんでした。',
    });
  }

  private async onFailure(event: ExecutionEvent): Promise<void> {
    if (event.test_category !== 'REGRESSION' || !event.test_case_id) return;
    const remediations = researchToRemediationService.list(500).filter(r => r.regressionSuiteIds.length);
    for (const remediation of remediations) {
      const suiteMatch = remediation.regressionSuiteIds.some(suiteId => {
        // refresh() keeps the immutable suite/request binding; avoid treating unrelated failures as recovery triggers.
        const refreshed = researchToRemediationService.refresh(remediation.remediationId);
        return !!refreshed && refreshed.regressionSuiteIds.includes(suiteId) && this.requestBelongsToSuite(suiteId, event.request_id);
      });
      if (suiteMatch) {
        await this.recover(remediation.remediationId, event);
        return;
      }
    }
  }

  private requestBelongsToSuite(suiteId: string, requestId: string): boolean {
    const suite = componentRegressionService.get(suiteId);
    return !!suite && suite.request_ids.includes(requestId);
  }

  private buildQuery(statement: string, event: ExecutionEvent, attempt: number): string {
    const error = String(event.error_message || event.output_summary || 'execution_failed');
    return `Miki remediation failure re-research: statement=${statement} / component=${event.component_id} / environment=${event.environment} / error=${error} / attempt=${attempt} / 前回の対策がRegressionで失敗した原因、反例、現在の公式仕様、互換条件を再調査する`;
  }

  private record(input: Omit<RemediationFailureRecoveryRecord, 'recoveryId' | 'createdAt' | 'updatedAt'>): RemediationFailureRecoveryRecord {
    const now = Date.now();
    const recovery: RemediationFailureRecoveryRecord = {
      ...input,
      recoveryId: `RECOVERY-${this.hash(`${input.sourceRemediationId}|${input.requestId}|${input.failureSignature}|${input.attempt}`)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.records.unshift(recovery);
    this.records = this.records.slice(0, 500);
    this.save();
    return recovery;
  }

  private update(id: string, patch: Partial<RemediationFailureRecoveryRecord>): RemediationFailureRecoveryRecord {
    const found = this.records.find(r => r.recoveryId === id);
    if (!found) throw new Error(`recovery record not found: ${id}`);
    Object.assign(found, patch, { updatedAt: Date.now() });
    this.save();
    return { ...found };
  }

  private signature(remediationId: string, event: ExecutionEvent): string {
    return this.hash(`${remediationId}|${event.component_id}|${event.environment}|${event.error_message || event.output_summary || 'execution_failed'}`);
  }

  private hash(raw: string): string {
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  private load(): void {
    try {
      const raw = storageService.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.records = parsed;
      }
    } catch { this.records = []; }
  }

  private save(): void {
    try { storageService.setItem(this.storageKey, JSON.stringify(this.records.slice(0, 500))); } catch {}
  }
}

export const remediationFailureRecoveryService = RemediationFailureRecoveryService.getInstance();
