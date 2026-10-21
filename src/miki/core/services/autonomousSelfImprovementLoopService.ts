import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { coreTaskIngressService } from './coreTaskIngressService';
import { taskBlackboardService } from './taskBlackboardService';
import { evidenceQualityGateService } from './evidenceQualityGateService';
import { resourceGovernanceService } from '../../safety/services/resourceGovernanceService';
import { requiredAssetAcquisitionService } from './requiredAssetAcquisitionService';
import { selfImprovementPreflightService } from './selfImprovementPreflightService';
import { improvementDebtService } from './improvementDebtService';
import { coreCycleSettingsService } from './coreCycleSettingsService';
import type { ChangeSetID } from '../../../types/evidenceSelfImprovementTypes';

export type AutonomousLoopStatus = 'IDLE' | 'RUNNING' | 'WAITING_RESOURCE' | 'WAITING_EVIDENCE' | 'PAUSED' | 'FAILED';

export interface AutonomousImprovementRequest {
  id: string;
  trigger: string;
  source: 'AUTOPILOT' | 'UI' | 'EXECUTION' | 'SYSTEM';
  runId?: string;
  /** Canonical lineage: one ChangeSetID follows the whole improvement request. */
  changeSetId?: ChangeSetID;
  /** Existing Strategy Memory choice for this autonomous improvement request. */
  strategyId?: string;
  strategyName?: string;
  strategyFeedbackRecorded?: boolean;
  runType?: string;
  sourceId?: string;
  priority?: number;
  payload?: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  taskId?: string;
  /** Durable cancel intent; must be reconciled before this request can execute. */
  cancelRequested?: boolean;
  workspaceId?: string;
  resourceWaitCount?: number;
  evidenceWaitCount?: number;
  nextAttemptAt?: number;
  waitKind?: 'RESOURCE' | 'EVIDENCE' | 'RETRY';
  waitReason?: string;
}

type RecoverySubgoalStatus = 'WAITING_FOR_EVIDENCE' | 'RESOLVED' | 'FAILED';

interface RecoverySubgoalRecord {
  subgoalId: string;
  parentTaskId: string;
  kind: 'SOAR_IMPASSE_RECOVERY';
  goal: string;
  reason: string;
  requiredDomains: string[];
  evidenceIds: string[];
  attempt: number;
  status: RecoverySubgoalStatus;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  failedAt?: number;
  terminalReason?: string;
}

export interface AutonomousLoopState {
  status: AutonomousLoopStatus;
  queue: AutonomousImprovementRequest[];
  activeRequestId?: string;
  lastTaskId?: string;
  lastReason?: string;
  retryAt?: number;
  updatedAt: number;
}
export type AutonomousLoopPersistenceStatus='READY'|'RECOVERED_QUARANTINED'|'WRITE_BLOCKED';
export interface AutonomousLoopPersistenceState { status:AutonomousLoopPersistenceStatus; reason?:string; }

const KEY = 'miki_autonomous_self_improvement_loop_v2';
const LEGACY_KEY = 'miki_autonomous_self_improvement_loop_v1';
const MAX_ATTEMPTS = 3;
const RECOVERY_POLL_MS = 60_000;
const RESOURCE_WAIT_MS = [2 * 60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000];
const EVIDENCE_WAIT_MS = [2 * 60_000, 10 * 60_000, 30 * 60_000, 60 * 60_000];

const DISCOVERY_ISSUE_KINDS=new Set(['EXECUTION_FAILURE','KNOWLEDGE_GAP','CAPABILITY_GAP','STALLED_TASK','DOMAIN_DISCONNECTED','CLAIM_CONTRADICTION','IMPROVEMENT_DEBT']);
function normalizeDiscoveryIssuePayload(payload:Record<string,unknown>|undefined):Record<string,unknown>|undefined{
  if(!payload)return undefined;
  const normalized={...payload};
  const candidate=String(normalized.issueKind||normalized.kind||'');
  if(DISCOVERY_ISSUE_KINDS.has(candidate)&&typeof normalized.issueId==='string'&&normalized.issueId.trim()){
    normalized.issueKind=candidate;
    delete normalized.kind;
  }
  return normalized;
}

class AutonomousSelfImprovementLoopService {
  private state: AutonomousLoopState = { status: 'IDLE', queue: [], updatedAt: 0 };
  private running = false;
  private sequence = 0;
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private persistenceStatus:AutonomousLoopPersistenceStatus='READY';
  private persistenceReason?:string;
  private writesBlocked=false;

  public constructor() {
    this.load();
  }

  public initialize(): void {
    if(this.writesBlocked){systemLogger.error('PERSISTENCE','[AutonomousLoop] initialization blocked because queued requests could not be preserved',{reason:this.persistenceReason});return;}
    if (this.state.status === 'RUNNING') {
      this.state.status = 'PAUSED';
      this.state.lastReason = 'APPLICATION_RESTART_RECOVERY';
      this.state.retryAt = Date.now();
      try{this.save();}catch(error){systemLogger.error('PERSISTENCE','[AutonomousLoop] restart recovery stopped because state could not be verified',{error:String(error)});return;}
    }
    this.disposed = false;
    try{this.reconcileCancellationRequests();}catch(error){systemLogger.warn('PERSISTENCE','[AutonomousLoop] durable cancellation intent remains pending after restart',{error:String(error instanceof Error?error.message:error)});this.scheduleRecovery(RECOVERY_POLL_MS);return;}
    this.scheduleRecovery();
  }

  public dispose(): void {
    this.disposed = true;
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }

  public enqueue(
    trigger: string,
    source: AutonomousImprovementRequest['source'],
    meta: Partial<AutonomousImprovementRequest> = {}
  ): AutonomousImprovementRequest {
    this.assertWritable();
    const duplicate = this.state.queue.find(item =>
      item.trigger === trigger &&
      item.source === source &&
      item.runId === meta.runId
    );
    if (duplicate) {
      return { ...duplicate };
    }
    const now = Date.now();
    this.sequence += 1;
    const normalizedPayload=normalizeDiscoveryIssuePayload(meta.payload);
    const item: AutonomousImprovementRequest = {
      id: `AIR-${now}-${String(this.sequence).padStart(6, '0')}`,
      trigger,
      source,
      runId: meta.runId,
      changeSetId: meta.changeSetId,
      runType: meta.runType,
      sourceId: meta.sourceId,
      priority: meta.priority,
      payload: normalizedPayload ? { ...normalizedPayload } : undefined,
      createdAt: now,
      attempts: 0,
      resourceWaitCount: 0,
      evidenceWaitCount: 0,
      nextAttemptAt: undefined,
      waitKind: undefined,
      waitReason: undefined,
    };
    const task=taskBlackboardService.create(trigger,'core',{
      ...(normalizedPayload||{}),
      runId:meta.runId,
      changeSetId:meta.changeSetId,
      runType:meta.runType,
      sourceId:meta.sourceId,
      priority:meta.priority,
      orchestrationMode:'SELF_IMPROVEMENT_WORKER',
      kind:'SELF_IMPROVEMENT'
    });
    taskBlackboardService.pause(task.taskId,'SELF_IMPROVEMENT_QUEUED');
    item.taskId=task.taskId;
    this.state.queue.push(item);
    this.state.queue.sort((left, right) =>
      (right.priority || 0) - (left.priority || 0) ||
      left.createdAt - right.createdAt ||
      left.id.localeCompare(right.id)
    );
    this.state.status = 'IDLE';
    this.state.retryAt = undefined;
    this.save();
    void this.drain();
    return { ...item };
  }

  public getState(): AutonomousLoopState {
    return JSON.parse(JSON.stringify(this.state));
  }

  public getPersistenceState():AutonomousLoopPersistenceState{return {status:this.persistenceStatus,...(this.persistenceReason?{reason:this.persistenceReason}:{})};}

  public cancelByRunId(runId: string): { cancelled: boolean; active: boolean; pending?: boolean } {
    this.assertWritable();
    const active = this.state.queue.find((item) => item.runId === runId && item.id === this.state.activeRequestId);
    if (active) return { cancelled: false, active: true };
    const selected = this.state.queue.filter(item => item.runId === runId);
    if (selected.length === 0) return { cancelled: false, active: false };

    // Persist intent before TaskBlackboard side effects so restart recovery can replay it safely.
    const previousState = JSON.parse(JSON.stringify(this.state)) as AutonomousLoopState;
    for (const request of this.state.queue) {
      if (request.runId === runId) request.cancelRequested = true;
    }
    this.state.lastReason = 'CANCELLATION_INTENT_PERSISTED:' + runId;
    try {
      this.save();
    } catch (error) {
      this.state = previousState;
      throw error;
    }

    try {
      this.reconcileCancellationRequests();
      return { cancelled: true, active: false };
    } catch (error) {
      systemLogger.warn('PERSISTENCE', '[AutonomousLoop] cancellation intent remains durable; reconciliation will retry', {
        runId, error: String(error instanceof Error ? error.message : error),
      });
      this.scheduleRecovery(RECOVERY_POLL_MS);
      return { cancelled: true, active: false, pending: true };
    }
  }

  private reconcileCancellationRequests(): void {
    this.assertWritable();
    const pending = this.state.queue.filter(item => item.cancelRequested === true);
    if (pending.length === 0) return;
    const priorState = JSON.parse(JSON.stringify(this.state)) as AutonomousLoopState;
    const pendingIds = new Set(pending.map(item => item.id));

    // Repeated reconciliation is idempotent: terminal tasks are never reopened.
    for (const request of pending) {
      if (!request.taskId) continue;
      const task = taskBlackboardService.get(request.taskId);
      if (task && !['COMPLETED', 'CANCELLED'].includes(task.status)) {
        taskBlackboardService.cancel(request.taskId);
      }
    }

    this.state.queue = this.state.queue.filter(item => !pendingIds.has(item.id));
    if (this.state.queue.length === 0) {
      this.state.status = 'IDLE';
      this.state.activeRequestId = undefined;
      this.state.retryAt = undefined;
    }
    const lineage = [...new Set(pending.map(item => item.runId || item.id))].join(',').slice(0, 180);
    this.state.lastReason = 'DIRECTIVE_CANCELLED:' + lineage;
    try {
      this.save();
    } catch (error) {
      // Preserve the intent in memory when the durable queue cannot acknowledge completion.
      this.state = priorState;
      throw error;
    }
  }

  public resume(): void {
    this.assertWritable();
    if (!['PAUSED', 'WAITING_RESOURCE', 'WAITING_EVIDENCE', 'FAILED'].includes(this.state.status)) {
      return;
    }
    this.state.status = 'IDLE';
    this.state.lastReason = undefined;
    this.state.retryAt = undefined;
    this.save();
    void this.drain();
  }

  private scheduleRecovery(delayOverrideMs?: number): void {
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.recoveryTimer = null;
    if (this.writesBlocked || this.disposed || this.running || this.state.queue.length === 0) return;

    const now = Date.now();
    const nextAttemptAtValues = this.state.queue
      .map(item => item.nextAttemptAt)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const hasImmediatelyEligibleRequest = this.state.queue.some(
      item => typeof item.nextAttemptAt !== 'number' || !Number.isFinite(item.nextAttemptAt),
    );
    const fallbackAt = typeof this.state.retryAt === 'number' && Number.isFinite(this.state.retryAt)
      ? this.state.retryAt
      : now + RECOVERY_POLL_MS;
    const nextAt = hasImmediatelyEligibleRequest
      ? now
      : nextAttemptAtValues.length > 0
        ? Math.min(...nextAttemptAtValues)
        : fallbackAt;
    const delay = delayOverrideMs === undefined
      ? Math.max(0, nextAt - now)
      : Math.max(0, delayOverrideMs);
    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null;
      void this.recoverIfReady();
    }, delay);
  }

  private async recoverIfReady(): Promise<void> {
    if (this.writesBlocked || this.running || this.state.queue.length === 0) {
      return;
    }
    if (this.state.queue.some(item => item.cancelRequested === true)) {
      try { this.reconcileCancellationRequests(); }
      catch (error) { systemLogger.warn('PERSISTENCE', '[AutonomousLoop] retrying durable cancellation reconciliation', { error: String(error instanceof Error ? error.message : error) }); this.scheduleRecovery(RECOVERY_POLL_MS); return; }
      if (this.writesBlocked || this.state.queue.length === 0) return;
    }
    if (this.state.status === 'WAITING_RESOURCE') {
      await resourceGovernanceService.refresh();
      if (!resourceGovernanceService.canRunComponentTests()) {
        this.scheduleRecovery(RECOVERY_POLL_MS);
        return;
      }
    }
    const hasReadyRequest=this.state.queue.some(item=>!item.nextAttemptAt||item.nextAttemptAt<=Date.now());
    if (this.state.retryAt && Date.now() < this.state.retryAt && !hasReadyRequest) {
      this.scheduleRecovery();
      return;
    }
    if (['WAITING_RESOURCE', 'WAITING_EVIDENCE', 'PAUSED'].includes(this.state.status)) {
      this.state.status = 'IDLE';
      this.state.lastReason = `AUTO_RECOVERY:${this.state.lastReason || 'READY'}`;
      this.state.retryAt = undefined;
      this.save();
    }
    await this.drain();
  }

  private async drain(): Promise<void> {
    if (this.writesBlocked || this.running) return;
    if (this.state.queue.some(item => item.cancelRequested === true)) {
      try { this.reconcileCancellationRequests(); }
      catch (error) { systemLogger.warn('PERSISTENCE', '[AutonomousLoop] refusing dispatch while cancellation intent remains pending', { error: String(error instanceof Error ? error.message : error) }); this.scheduleRecovery(RECOVERY_POLL_MS); return; }
    }
    if (this.writesBlocked || this.state.queue.length === 0) return;
    this.running = true;
    let activeRequest: AutonomousImprovementRequest | undefined;
    try {
      while (this.state.queue.length > 0) {
        const now=Date.now();
        const eligibleIndex=this.state.queue.findIndex(item=>!item.nextAttemptAt||item.nextAttemptAt<=now);
        if(eligibleIndex<0){
          const earliest=this.state.queue.reduce((best,item)=>!best||Number(item.nextAttemptAt||0)<Number(best.nextAttemptAt||0)?item:best,undefined as AutonomousImprovementRequest|undefined);
          this.state.status=earliest?.waitKind==='RESOURCE'?'WAITING_RESOURCE':earliest?.waitKind==='EVIDENCE'?'WAITING_EVIDENCE':'PAUSED';
          this.state.lastReason=earliest?.waitReason||'QUEUE_WAITING_FOR_NEXT_ATTEMPT';
          this.state.retryAt=earliest?.nextAttemptAt;
          this.state.activeRequestId=undefined;
          this.save();
          break;
        }
        if(eligibleIndex>0)this.state.queue.unshift(this.state.queue.splice(eligibleIndex,1)[0]);
        const request = this.state.queue[0];
        request.nextAttemptAt=undefined;
        request.waitKind=undefined;
        request.waitReason=undefined;
        activeRequest = request;
        this.state.retryAt=undefined;
        const normalizedPayload=normalizeDiscoveryIssuePayload(request.payload);
        if(normalizedPayload)request.payload=normalizedPayload;
        systemLogger.info(
          'SELF_IMPROVEMENT',
          `[RUNTIME] AutonomousLoop step: ${request.id}`,
        );
        this.state.status = 'RUNNING';
        this.state.activeRequestId = request.id;
        this.save();

        // Persisted requests can come from an older implementation with an
        // already-exhausted attempt count. Never execute them again.
        if (!Number.isFinite(request.attempts) || request.attempts >= MAX_ATTEMPTS) {
          this.failOrRetry(request, 'MAX_ATTEMPTS_REACHED');
          if (this.state.queue.length === 0) {
            break;
          }
          continue;
        }

        if (request.runId) {
          const preflight = await selfImprovementPreflightService.evaluate(request.runId);
          if (!preflight.passed) {
            if (preflight.reasons.includes('PERSISTENT_BACKEND_REQUIRED')) {
              this.waitForResource(request, 'PERSISTENT_BACKEND_REQUIRED');
              continue;
            }
            improvementDebtService.record('UNEXECUTED_CHECK', `PREFLIGHT:${preflight.reasons.join(',')}`, request.runId);
            await this.acquireThenWaitForEvidence(request, preflight.reasons.join(','));
            continue;
          }
        }

        await resourceGovernanceService.refresh();
        if (!resourceGovernanceService.canRunComponentTests()) {
          this.waitForResource(request, 'RESOURCE_GOVERNANCE_BLOCKED');
          break;
        }

        this.replaceLegacyMisclassifiedTask(request);
        request.attempts += 1;
        const workflow = request.taskId
          ? await coreTaskIngressService.resume(request.taskId, coreCycleSettingsService.maxCyclesFor('SELF_IMPROVEMENT'))
          : await coreTaskIngressService.submit({
              kind: 'SELF_IMPROVEMENT',
              goal: request.trigger,
              source: 'core',
              payload: {
              ...(request.payload || {}),
              trigger: request.trigger,
              source: request.source,
              runId: request.runId,
              changeSetId: request.changeSetId,
              runType: request.runType,
              sourceId: request.sourceId,
              priority: request.priority,
              orchestrationMode: 'SELF_IMPROVEMENT_WORKER',
              kind: 'SELF_IMPROVEMENT',
              },
            });
        if (!workflow) {
          this.failOrRetry(request, 'BLACKBOARD_TASK_RESUME_FAILED');
          continue;
        }
        request.taskId = workflow.task.taskId;
        this.state.lastTaskId = workflow.task.taskId;
        systemLogger.info(
          'SELF_IMPROVEMENT',
          `[RUNTIME] AutonomousLoop CORE result: ${workflow.task.status}`,
        );

        const quality = evidenceQualityGateService.evaluate(workflow.task);
        const hasBusinessResult = workflow.task.entries.some(entry => {
          if (entry.kind !== 'RESULT' || !entry.value || typeof entry.value !== 'object') return false;
          const value = entry.value as Record<string, unknown>;
          return value.operationClass === 'BUSINESS';
        });
        const evidenceGateRequired = hasBusinessResult;
        if (workflow.task.status === 'COMPLETED' && (!evidenceGateRequired || quality.passed)) {
          this.finishRecoverySubgoals(
            workflow.task.taskId,
            'RESOLVED',
            evidenceGateRequired ? 'EVIDENCE_QUALITY_GATE_PASSED' : 'PARENT_TASK_COMPLETED_GATE_NOT_REQUIRED',
            quality.evidenceIds,
          );
          this.completeCurrent('IMPROVEMENT_CYCLE_COMPLETED');
          continue;
        }
        if (evidenceGateRequired && !quality.passed) {
          const domainsForReason = (reason: string): string[] => {
            const normalized = reason.toUpperCase();
            if (normalized.includes('INDEPENDENT_EVIDENCE_CONFIRMATION_MISSING')) return ['research', 'verification'];
            if (normalized.includes('EVIDENCE_ID_MISSING') || normalized.includes('EVIDENCE_REFERENCE_UNRESOLVED') || normalized.includes('EVIDENCE_NOT_ADMISSIBLE')) return ['research', 'unknown', 'verification'];
            if (normalized.includes('OBSERVED_RESULT_MISSING') || normalized.includes('UNRESOLVED_ERROR_PRESENT')) return ['verification', 'core'];
            return ['research', 'verification'];
          };
          const recoverySubgoals = this.upsertRecoverySubgoals(
            workflow.task.taskId,
            quality.reasons,
            quality.evidenceIds,
            request.attempts,
            domainsForReason,
          );
          const activeRecoverySubgoals = recoverySubgoals.filter(item => item.status === 'WAITING_FOR_EVIDENCE');
          const requestedDomains = [...new Set(activeRecoverySubgoals.flatMap(item => item.requiredDomains))];
          taskBlackboardService.append(
            workflow.task.taskId,
            'DECISION',
            'core',
            'evidence-recovery-required',
            {
              kind: 'SOAR_IMPASSE_RECOVERY',
              parentTaskId: workflow.task.taskId,
              reasons: quality.reasons,
              requestedDomains,
              activeSubgoalIds: activeRecoverySubgoals.map(item => item.subgoalId),
              subgoals: recoverySubgoals,
              nextStep: 'REQUIRED_ASSET_ACQUISITION_THEN_WAIT',
              updatedAt: Date.now(),
            },
            quality.evidenceIds,
          );
          await this.acquireThenWaitForEvidence(request, quality.reasons.join(','));
          continue;
        }
        const cycleBudgetPaused = workflow.task.status === 'PAUSED' && workflow.task.entries.some(entry => entry.kind === 'CHECKPOINT' && entry.key === 'coreCycleBudgetExhausted');
        if (cycleBudgetPaused) {
          request.attempts -= 1;
          this.state.status = 'RUNNING';
          this.state.lastReason = 'CORE_CYCLE_BUDGET_CONTINUE';
          this.save();
          continue;
        }
        this.failOrRetry(request, `WORKFLOW_${workflow.task.status}`);
        continue;
      }
      if (this.state.queue.length === 0) {
        this.state.status = 'IDLE';
        this.state.activeRequestId = undefined;
        this.state.retryAt = undefined;
        this.save();
      }
    } catch (error) {
      this.state.status = 'FAILED';
      this.state.lastReason = String(error);
      this.state.retryAt = undefined;
      if(!this.writesBlocked){try{this.save();}catch(persistenceError){systemLogger.error('PERSISTENCE','[AutonomousLoop] failed to persist failure state',{error:String(persistenceError)});}}

      const task = activeRequest?.taskId
        ? taskBlackboardService.get(activeRequest.taskId)
        : undefined;

      const unknowns=[...new Set(task?.entries.flatMap(entry=>{
        const value=entry.value;
        if(!value || typeof value!=='object') return [];
        const candidate=(value as Record<string,unknown>).unknowns;
        return Array.isArray(candidate) ? candidate.map(String) : [];
      }) || [])];

      systemLogger.error(
        'SELF_IMPROVEMENT',
        '[RUNTIME_FAILURE] AutonomousLoop cycle stopped',
        {
          requestId:activeRequest?.id,
          runId:activeRequest?.runId,
          trigger:activeRequest?.trigger,
          source:activeRequest?.source,
          attempts:activeRequest?.attempts,
          taskId:activeRequest?.taskId,
          loopStatus:this.state.status,
          lastReason:this.state.lastReason,
          retryAt:this.state.retryAt,
          error:error instanceof Error?`${error.name}: ${error.message}`:String(error),
          stack:error instanceof Error?error.stack:undefined,
          taskStatus:task?.status,
          taskRevision:task?.revision,
          taskLastCycle:task?.lastCycle,
          visitedDomains:task ? [...task.visitedDomains]:[],
          pendingDomains:task ? [...task.pendingDomains]:[],
          evidenceIds:task ? [...new Set(task.entries.flatMap(entry=>entry.evidenceIds||[]))]:[],
          unknowns,
          lastEntries:task?.entries.slice(-20).map(entry=>({
            kind:entry.kind,
            domain:entry.domain,
            key:entry.key,
            evidenceIds:entry.evidenceIds,
            value:entry.value,
          })),
        },
      );
    } finally {
      this.running = false;
      this.scheduleRecovery();
    }
  }

  private replaceLegacyMisclassifiedTask(request:AutonomousImprovementRequest):void{
    if(!request.taskId)return;
    const task=taskBlackboardService.get(request.taskId);
    if(!task)return;
    const inputEntry=task.entries.find(entry=>entry.kind==='INPUT'&&entry.key==='payload');
    const stored=inputEntry?.value&&typeof inputEntry.value==='object'&&!Array.isArray(inputEntry.value)
      ? inputEntry.value as Record<string,unknown>
      : undefined;
    if(!stored)return;
    const legacyKind=String(stored.kind||'');
    if(stored.orchestrationMode!=='SELF_IMPROVEMENT_WORKER'
      ||!DISCOVERY_ISSUE_KINDS.has(legacyKind)
      ||typeof stored.issueId!=='string'
      ||task.status==='COMPLETED'
      ||task.status==='CANCELLED')return;
    const normalizedPayload=normalizeDiscoveryIssuePayload({...stored,...(request.payload||{})});
    if(normalizedPayload)request.payload=normalizedPayload;
    taskBlackboardService.append(task.taskId,'CHECKPOINT','core','legacyWorkerTaskReplaced',{
      schemaVersion:1,
      originalTaskId:task.taskId,
      originalPayloadKind:legacyKind,
      issueId:String(stored.issueId),
      replacementKind:'SELF_IMPROVEMENT',
      reason:'DISCOVERY_ISSUE_KIND_OVERRODE_SELF_IMPROVEMENT_KIND',
      replacedAt:Date.now()
    });
    taskBlackboardService.cancel(task.taskId);
    request.taskId=undefined;
    this.state.lastReason=`LEGACY_WORKER_TASK_REPLACED:${task.taskId}`;
    this.save();
  }

  private waitForResource(request: AutonomousImprovementRequest, reason: string): void {
    request.resourceWaitCount = (request.resourceWaitCount || 0) + 1;
    const index = Math.min(request.resourceWaitCount - 1, RESOURCE_WAIT_MS.length - 1);
    this.state.status = 'WAITING_RESOURCE';
    this.state.lastReason = reason;
    this.state.retryAt = Date.now() + RESOURCE_WAIT_MS[index];
    request.nextAttemptAt=this.state.retryAt;
    request.waitKind='RESOURCE';
    request.waitReason=reason;
    this.save();
  }

  private readRecoverySubgoals(taskId: string): RecoverySubgoalRecord[] {
    const task = taskBlackboardService.get(taskId);
    if (!task) return [];

    const latestById = new Map<string, RecoverySubgoalRecord>();
    const lifecycleEventKeys = new Set([
      'evidence-recovery-required',
      'evidence-recovery-resolved',
      'evidence-recovery-failed',
    ]);

    for (const entry of task.entries) {
      if (entry.kind !== 'DECISION' || !lifecycleEventKeys.has(entry.key)) continue;
      if (!entry.value || typeof entry.value !== 'object' || Array.isArray(entry.value)) continue;
      const rawSubgoals = (entry.value as Record<string, unknown>).subgoals;
      if (!Array.isArray(rawSubgoals)) continue;

      for (const raw of rawSubgoals) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const item = raw as Record<string, unknown>;
        const subgoalId = item.subgoalId;
        const reason = item.reason;
        const status = item.status;
        if (typeof subgoalId !== 'string' || typeof reason !== 'string') continue;
        if (status !== 'WAITING_FOR_EVIDENCE' && status !== 'RESOLVED' && status !== 'FAILED') continue;

        const requiredDomains = Array.isArray(item.requiredDomains)
          ? item.requiredDomains.filter((value): value is string => typeof value === 'string')
          : [];
        const evidenceIds = Array.isArray(item.evidenceIds)
          ? item.evidenceIds.filter((value): value is string => typeof value === 'string')
          : [];
        const createdAt = typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
          ? item.createdAt
          : entry.createdAt;
        const updatedAt = typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt)
          ? item.updatedAt
          : createdAt;

        const record: RecoverySubgoalRecord = {
          subgoalId,
          parentTaskId: typeof item.parentTaskId === 'string' ? item.parentTaskId : taskId,
          kind: 'SOAR_IMPASSE_RECOVERY',
          goal: typeof item.goal === 'string' ? item.goal : `Resolve CORE evidence-quality blocker: ${reason}`,
          reason,
          requiredDomains: [...new Set(requiredDomains)],
          evidenceIds: [...new Set(evidenceIds)],
          attempt: typeof item.attempt === 'number' && Number.isFinite(item.attempt) ? item.attempt : 0,
          status,
          createdAt,
          updatedAt,
          resolvedAt: typeof item.resolvedAt === 'number' && Number.isFinite(item.resolvedAt) ? item.resolvedAt : undefined,
          failedAt: typeof item.failedAt === 'number' && Number.isFinite(item.failedAt) ? item.failedAt : undefined,
          terminalReason: typeof item.terminalReason === 'string' ? item.terminalReason : undefined,
        };
        latestById.set(record.subgoalId, record);
      }
    }

    return [...latestById.values()].sort((a, b) => a.createdAt - b.createdAt || a.subgoalId.localeCompare(b.subgoalId));
  }

  private upsertRecoverySubgoals(
    taskId: string,
    reasons: string[],
    evidenceIds: string[],
    attempt: number,
    domainsForReason: (reason: string) => string[],
  ): RecoverySubgoalRecord[] {
    const now = Date.now();
    const activeReasons = [...new Set(reasons.map(reason => reason.trim()).filter(Boolean))];
    const activeReasonSet = new Set(activeReasons);
    const byId = new Map<string, RecoverySubgoalRecord>();
    for (const subgoal of this.readRecoverySubgoals(taskId)) byId.set(subgoal.subgoalId, subgoal);

    for (const [subgoalId, subgoal] of byId.entries()) {
      if (subgoal.status === 'WAITING_FOR_EVIDENCE' && !activeReasonSet.has(subgoal.reason)) {
        byId.set(subgoalId, {
          ...subgoal,
          status: 'RESOLVED',
          updatedAt: now,
          resolvedAt: now,
          failedAt: undefined,
          terminalReason: 'BLOCKER_NO_LONGER_REPORTED',
        });
      }
    }

    for (const reason of activeReasons) {
      const subgoalId = `${taskId}:impasse:${encodeURIComponent(reason)}`;
      const previous = byId.get(subgoalId);
      const next: RecoverySubgoalRecord = {
        ...(previous || {}),
        subgoalId,
        parentTaskId: taskId,
        kind: 'SOAR_IMPASSE_RECOVERY',
        goal: `Resolve CORE evidence-quality blocker: ${reason}`,
        reason,
        requiredDomains: [...new Set(domainsForReason(reason))],
        evidenceIds: [...new Set([...(previous?.evidenceIds || []), ...evidenceIds])],
        attempt,
        status: 'WAITING_FOR_EVIDENCE',
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        resolvedAt: undefined,
        failedAt: undefined,
        terminalReason: undefined,
      };
      byId.set(subgoalId, next);
    }

    return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt || a.subgoalId.localeCompare(b.subgoalId));
  }

  private finishRecoverySubgoals(
    taskId: string,
    status: 'RESOLVED' | 'FAILED',
    terminalReason: string,
    evidenceIds: string[] = [],
  ): void {
    const current = this.readRecoverySubgoals(taskId);
    const pending = current.filter(subgoal => subgoal.status === 'WAITING_FOR_EVIDENCE');
    if (pending.length === 0) return;

    const now = Date.now();
    const subgoals = current.map(subgoal => {
      if (subgoal.status !== 'WAITING_FOR_EVIDENCE') return subgoal;
      const terminal: RecoverySubgoalRecord = {
        ...subgoal,
        status,
        updatedAt: now,
        evidenceIds: [...new Set([...subgoal.evidenceIds, ...evidenceIds])],
        terminalReason,
      };
      if (status === 'RESOLVED') return { ...terminal, resolvedAt: now, failedAt: undefined };
      return { ...terminal, failedAt: now, resolvedAt: undefined };
    });
    const key = status === 'RESOLVED' ? 'evidence-recovery-resolved' : 'evidence-recovery-failed';
    taskBlackboardService.append(
      taskId,
      'DECISION',
      'core',
      key,
      {
        kind: 'SOAR_IMPASSE_RECOVERY',
        parentTaskId: taskId,
        status,
        terminalReason,
        terminalSubgoalIds: pending.map(subgoal => subgoal.subgoalId),
        subgoals,
        recordedAt: now,
      },
      [...new Set([...subgoals.flatMap(subgoal => subgoal.evidenceIds), ...evidenceIds])],
    );
  }

  private async acquireThenWaitForEvidence(request: AutonomousImprovementRequest, reason: string): Promise<void> {
    const acquired = await requiredAssetAcquisitionService.acquire({
      runId: request.runId,
      taskId: request.taskId,
      workspaceId: request.workspaceId,
      reasons: reason.split(',').filter(Boolean),
      objective: request.trigger,
    });

    /*
     * progressed !== acquired.
     *
     * Research may have made progress while still failing to acquire the
     * required asset. Only the unresolved case should enter WAITING_EVIDENCE.
     * If the required asset was acquired, return to the normal CORE cycle.
     */
    if (acquired.acquired) {
      request.evidenceWaitCount = 0;
      request.nextAttemptAt = Date.now() + 5_000;
      request.waitKind = 'EVIDENCE';
      request.waitReason = acquired.reasons.join(',') || 'REQUIRED_ASSET_ACQUIRED_CORE_REEVALUATION';
      this.state.status = 'IDLE';
      this.state.lastReason = request.waitReason;
      this.state.retryAt = request.nextAttemptAt;
      this.save();
      return;
    }

    const evidenceWaitBefore= request.evidenceWaitCount || 0;
    const evidenceDecision={
      schemaVersion:1,
      requestId:request.id,
      runId:request.runId,
      taskId:request.taskId,
      workspaceId:request.workspaceId,
      originalReason:reason,
      acquired:acquired.acquired,
      progressed:acquired.progressed,
      evidenceCount:acquired.evidenceIds.length,
      evidenceIds:[...acquired.evidenceIds],
      reasons:[...acquired.reasons],
      diagnostics:acquired.diagnostics,
      evidenceWaitCountBefore:evidenceWaitBefore,
      recordedAt:Date.now(),
    };

    systemLogger.info(
      'SELF_IMPROVEMENT',
      '[AutonomousLoop] WAITING_EVIDENCE decision',
      JSON.stringify(evidenceDecision),
    );

    if(request.taskId){
      taskBlackboardService.append(
        request.taskId,
        'CHECKPOINT',
        'core',
        'evidenceRecoveryDiagnostic',
        evidenceDecision,
        acquired.evidenceIds,
      );
    }

    this.waitForEvidence(
      request,
      acquired.reasons.join(',') || reason,
      acquired.progressed,
    );

    if(request.taskId){
      const retryAt=this.state.retryAt;
      taskBlackboardService.append(
        request.taskId,
        'CHECKPOINT',
        'core',
        'evidenceRecoveryWaitScheduled',
        {
          schemaVersion:1,
          requestId:request.id,
          runId:request.runId,
          taskId:request.taskId,
          acquired:acquired.acquired,
          progressed:acquired.progressed,
          evidenceWaitCountBefore:evidenceWaitBefore,
          evidenceWaitCountAfter:request.evidenceWaitCount || 0,
          retryAt,
          waitDurationMs:retryAt ? Math.max(0,retryAt-Date.now()) : 0,
          reason:acquired.reasons.join(',') || reason,
        },
        acquired.evidenceIds,
      );
    }
  }

  private waitForEvidence(request: AutonomousImprovementRequest, reason: string, progressed = false): void {
    request.evidenceWaitCount = (request.evidenceWaitCount || 0) + 1;
    const index = Math.min(request.evidenceWaitCount - 1, EVIDENCE_WAIT_MS.length - 1);
    this.state.status = 'WAITING_EVIDENCE';
    this.state.lastReason = reason;
    this.state.retryAt = Date.now() + (progressed ? 5_000 : EVIDENCE_WAIT_MS[index]);
    request.nextAttemptAt=this.state.retryAt;
    request.waitKind='EVIDENCE';
    request.waitReason=reason;
    this.save();
  }

  private failOrRetry(request: AutonomousImprovementRequest, reason: string): void {
    if (request.attempts >= MAX_ATTEMPTS) {
      if (request.taskId) {
        this.finishRecoverySubgoals(request.taskId, 'FAILED', reason);
      }
      this.state.queue.shift();
      this.state.status = 'FAILED';
      this.state.lastReason = `${reason}:MAX_ATTEMPTS`;
      this.state.activeRequestId = undefined;
      this.state.retryAt = undefined;
      this.save();
      return;
    }
    this.state.status = 'PAUSED';
    this.state.lastReason = reason;
    this.state.retryAt = Date.now() + EVIDENCE_WAIT_MS[Math.min(request.attempts, EVIDENCE_WAIT_MS.length - 1)];
    request.nextAttemptAt=this.state.retryAt;
    request.waitKind='RETRY';
    request.waitReason=reason;
    this.save();
  }

  private completeCurrent(reason: string): void {
    this.state.queue.shift();
    this.state.status = 'IDLE';
    this.state.activeRequestId = undefined;
    this.state.lastReason = reason;
    this.state.retryAt = undefined;
    this.save();
  }

  private assertWritable():void{if(this.writesBlocked)throw new Error('AUTONOMOUS_LOOP_STORE_WRITE_BLOCKED');}

  private blockPersistence(reason:string):void{this.writesBlocked=true;this.persistenceStatus='WRITE_BLOCKED';this.persistenceReason=reason.slice(0,700);if(this.recoveryTimer)clearTimeout(this.recoveryTimer);this.recoveryTimer=null;}

  private quarantine(sourceKey:string,raw:string,reason:string):boolean{const base=`${sourceKey}_quarantine_v1`;const envelope={version:1,sourceKey,quarantinedAt:Date.now(),reason:reason.slice(0,500),raw};try{let destination=base;const existing=storageService.getItem(base);if(existing!==null){try{const parsed=JSON.parse(existing) as Record<string,unknown>;if(parsed.version===1&&parsed.sourceKey===sourceKey&&parsed.raw===raw)return true;}catch{}let suffix=0;do{destination=`${base}_${Date.now()}_${suffix++}`;if(suffix>1000)return false;}while(storageService.getItem(destination)!==null);}storageService.setItem(destination,JSON.stringify(envelope));const saved=storageService.getItem(destination);if(saved===null)return false;const parsed=JSON.parse(saved) as Record<string,unknown>;return parsed.version===1&&parsed.sourceKey===sourceKey&&parsed.raw===raw;}catch{return false;}}

  private parseState(raw:string):AutonomousLoopState{const value:unknown=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('AUTONOMOUS_LOOP_SNAPSHOT_INVALID_ROOT');const parsed=value as Record<string,unknown>;const validStatuses:AutonomousLoopStatus[]=['IDLE','RUNNING','WAITING_RESOURCE','WAITING_EVIDENCE','PAUSED','FAILED'];if(typeof parsed.status!=='string'||!validStatuses.includes(parsed.status as AutonomousLoopStatus)||!Array.isArray(parsed.queue)||parsed.queue.length>10000||typeof parsed.updatedAt!=='number'||!Number.isFinite(parsed.updatedAt)||parsed.updatedAt<0)throw new Error('AUTONOMOUS_LOOP_SNAPSHOT_INVALID_SHAPE');const ids=new Set<string>();for(const item of parsed.queue){if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('AUTONOMOUS_LOOP_REQUEST_INVALID');const request=item as Record<string,unknown>;if(typeof request.id!=='string'||!request.id.trim()||ids.has(request.id)||typeof request.trigger!=='string'||!request.trigger.trim()||!['AUTOPILOT','UI','EXECUTION','SYSTEM'].includes(String(request.source))||typeof request.createdAt!=='number'||!Number.isFinite(request.createdAt)||request.createdAt<0||typeof request.attempts!=='number'||!Number.isInteger(request.attempts)||request.attempts<0)throw new Error('AUTONOMOUS_LOOP_REQUEST_INVALID_FIELDS');ids.add(request.id);for(const key of ['runId','strategyId','strategyName','runType','sourceId','taskId','workspaceId','waitReason','changeSetId'])if(request[key]!==undefined&&typeof request[key]!=='string')throw new Error('AUTONOMOUS_LOOP_REQUEST_INVALID_OPTIONAL_STRING');for(const key of ['priority','resourceWaitCount','evidenceWaitCount','nextAttemptAt'])if(request[key]!==undefined&&(typeof request[key]!=='number'||!Number.isFinite(request[key])||(request[key] as number)<0))throw new Error('AUTONOMOUS_LOOP_REQUEST_INVALID_OPTIONAL_NUMBER');for(const key of ['resourceWaitCount','evidenceWaitCount'])if(request[key]!==undefined&&!Number.isInteger(request[key]))throw new Error('AUTONOMOUS_LOOP_REQUEST_INVALID_WAIT_COUNT');if(request.waitKind!==undefined&&!['RESOURCE','EVIDENCE','RETRY'].includes(String(request.waitKind)))throw new Error('AUTONOMOUS_LOOP_REQUEST_INVALID_WAIT_KIND');if(request.cancelRequested!==undefined&&typeof request.cancelRequested!=='boolean')throw new Error('AUTONOMOUS_LOOP_REQUEST_INVALID_CANCEL_REQUEST');if(request.payload!==undefined&&(!request.payload||typeof request.payload!=='object'||Array.isArray(request.payload)))throw new Error('AUTONOMOUS_LOOP_REQUEST_INVALID_PAYLOAD');}for(const key of ['activeRequestId','lastTaskId','lastReason'])if(parsed[key]!==undefined&&typeof parsed[key]!=='string')throw new Error('AUTONOMOUS_LOOP_STATE_INVALID_OPTIONAL_STRING');if(parsed.retryAt!==undefined&&(typeof parsed.retryAt!=='number'||!Number.isFinite(parsed.retryAt)||(parsed.retryAt as number)<0))throw new Error('AUTONOMOUS_LOOP_STATE_INVALID_RETRY_AT');return parsed as unknown as AutonomousLoopState;}

  private save(): void {
    this.assertWritable();
    const next:AutonomousLoopState={...this.state,updatedAt:Date.now()};
    const serialized=JSON.stringify(next);
    try{storageService.setItem(KEY,serialized);if(storageService.getItem(KEY)!==serialized)throw new Error('STORE_READBACK_MISMATCH');this.state.updatedAt=next.updatedAt;}catch(error){this.blockPersistence(`AUTONOMOUS_LOOP_STORE_WRITE_VERIFY_FAILED:${String(error instanceof Error?error.message:error)}`);throw new Error('AUTONOMOUS_LOOP_STORE_WRITE_VERIFY_FAILED');}
  }

  private load(): void {
    let sourceKey=KEY;let raw:string|null;
    try{raw=storageService.getItem(KEY);if(raw===null){sourceKey=LEGACY_KEY;raw=storageService.getItem(LEGACY_KEY);}}catch(error){this.blockPersistence(`AUTONOMOUS_LOOP_STORE_READ_FAILED:${String(error instanceof Error?error.message:error)}`);return;}
    if(raw===null)return;
    let parsed:AutonomousLoopState;
    try{parsed=this.parseState(raw);}catch(error){const reason=String(error instanceof Error?error.message:error).slice(0,500);this.state={status:'IDLE',queue:[],updatedAt:0};if(this.quarantine(sourceKey,raw,reason)){this.persistenceStatus='RECOVERED_QUARANTINED';this.persistenceReason=`${sourceKey}_QUARANTINED:${reason}`;}else this.blockPersistence(`${sourceKey}_QUARANTINE_FAILED:${reason}`);return;}
    const activeQueue=parsed.queue.filter(item=>item.attempts<MAX_ATTEMPTS);const purgedCount=parsed.queue.length-activeQueue.length;this.state={...parsed,queue:activeQueue};
    if(purgedCount>0){this.state.status='IDLE';this.state.activeRequestId=undefined;this.state.retryAt=undefined;this.state.lastReason=`EXHAUSTED_REQUESTS_PURGED:${purgedCount}`;try{this.save();}catch{/* WRITE_BLOCKED is exposed and further execution is stopped. */}}
  }
}

export const autonomousSelfImprovementLoopService = new AutonomousSelfImprovementLoopService();
