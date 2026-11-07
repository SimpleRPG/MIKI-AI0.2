import { storageService } from '../../../services/storageService';
import { systemLogger, errorHeadline } from '../../../services/systemLogger';
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
// P432: queue-length cap. Discovery re-derives its issues from the
// static state of the code on a later scan, so refusing one more
// unstarted discovery item at the cap loses nothing (same rationale
// as the P429 B1 purge); it only stops the queue growing without
// bound while the app is running.
const MAX_QUEUE_LENGTH = 100;
// P429 (B1): an AUTONOMOUS_DISCOVERY request that was never started
// (attempts===0) and is older than this TTL is purged at load.
// Discovery re-derives its issues from the static state of the code on
// every scan, so dropping the queue item loses nothing: a still-real
// issue is dispatched again by a later scan. 24h comfortably covers
// every discovery reconcile window that could still revive the item
// (missing-run release at queuedAt+30min, missing-task release at
// queuedAt+6h, release backoff ladder of 15/30/60 minutes up to
// exhaustion at 4 attempts), so the item is only dropped after all of
// them have passed without it ever being selected. The discovery
// service reuses the same TTL as its post-exhaustion re-dispatch
// guard (A1), keeping both sides on one horizon.
export const DISCOVERY_UNSTARTED_TTL_MS = 24 * 60 * 60 * 1000;
// P367: consecutive resource waits before a request is dropped
// visibly instead of stalling the queue forever (see waitForResource).
const MAX_RESOURCE_WAITS = 30;
const RECOVERY_POLL_MS = 60_000;
const RESOURCE_WAIT_MS = [2 * 60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000];
const EVIDENCE_WAIT_MS = [2 * 60_000, 10 * 60_000, 30 * 60_000, 60 * 60_000];

const DISCOVERY_ISSUE_KINDS=new Set(['EXECUTION_FAILURE','KNOWLEDGE_GAP','CAPABILITY_GAP','STALLED_TASK','DOMAIN_DISCONNECTED','CLAIM_CONTRADICTION','IMPROVEMENT_DEBT']);
// P428: log lines carry triggers and reasons inline so a single
// runtime log can be mined later; keep each value on one line and
// bounded in length.
function truncateForLog(text: string, max: number): string {
  const flat = String(text).replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}...` : flat;
}

// P429 (A1): identity keys of an AUTONOMOUS_DISCOVERY request, used to
// recognise a re-dispatch of an issue that is already queued. On the
// discovery path the router's sourceId is the issue id and the payload
// carries issueId / fingerprint; any of them identifies the issue.
// Returns an empty list for every other request kind, in which case
// only the exact (trigger, source, runId) duplicate check applies.
function discoveryIssueIdentities(
  source: AutonomousImprovementRequest['source'],
  carrier: { runType?: string; sourceId?: string; payload?: Record<string, unknown> }
): string[] {
  if (source !== 'SYSTEM' || carrier.runType !== 'AUTONOMOUS_DISCOVERY') return [];
  const identities: string[] = [];
  const payload = carrier.payload;
  if (payload && typeof payload.issueId === 'string' && payload.issueId.trim()) identities.push(`issue:${payload.issueId}`);
  if (payload && typeof payload.fingerprint === 'string' && payload.fingerprint.trim()) identities.push(`fp:${payload.fingerprint}`);
  if (typeof carrier.sourceId === 'string' && carrier.sourceId.trim()) identities.push(`issue:${carrier.sourceId}`);
  return identities;
}

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

// P453: 教師（外部AI）から返ってきた素材で生まれた run／キュー項目の
// 優先度帯。既存の分布（発見項目の矛盾95・実行失敗90・能力不足80…）の
// 上に置く。ユーザーが教師へ聞いて返ってきた＝人の手が入った素材は、
// 自動発見より先に処理する（きりあの意向「返されたものは優先度高めに
// していい」）。
export const TEACHER_RETURN_PRIORITY = 100;

// P453: 教師返却由来の項目の識別は payload の刻印で行う（供給受入が
// supplyIntakeId を、矛盾解決の受入が contradictionResolutionIntakeId
// を刻み、将来の受入は teacherReturn を刻む）。刻印が無い項目を推測で
// 返却由来扱いにはしない。
export function isTeacherReturnRequest(item:{payload?:Record<string,unknown>}):boolean{
  const payload=item.payload;
  if(!payload)return false;
  return payload.teacherReturn===true
    ||(typeof payload.supplyIntakeId==='string'&&payload.supplyIntakeId.length>0)
    ||(typeof payload.contradictionResolutionIntakeId==='string'&&payload.contradictionResolutionIntakeId.length>0);
}

// P453: キューの並び順（enqueue の再ソートと load の復元で共有）。
// 優先度 desc → 教師返却由来 desc → createdAt asc → id asc。
// 返却由来を同点で前へ出すのは、enqueue のたびの全体再ソートで古い
// 同点項目が常に前に戻り、新しい返却 run が実効的に後れ続けた実績
// （001 の受入 run が優先度95でも1時間以上未選択）への対処。
function compareQueueRequests(left:AutonomousImprovementRequest,right:AutonomousImprovementRequest):number{
  return (right.priority||0)-(left.priority||0)
    ||Number(isTeacherReturnRequest(right))-Number(isTeacherReturnRequest(left))
    ||left.createdAt-right.createdAt
    ||left.id.localeCompare(right.id);
}

class AutonomousSelfImprovementLoopService {
  private state: AutonomousLoopState = { status: 'IDLE', queue: [], updatedAt: 0 };
  private running = false;
  private sequence = 0;
  private lastDigestSignature = '';
  private lastLoadDroppedInvalid = 0;
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private lifecycleGeneration = 0;
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
    // P428: one digest at startup so the persisted queue a restart
    // recovered is visible in the log from the first screen on.
    this.logQueueDigest('startup');
    this.scheduleRecovery();
  }

  public dispose(): void {
    this.disposed = true;
    this.lifecycleGeneration += 1;
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }

  private isGenerationCurrent(generation: number): boolean {
    return !this.disposed && generation === this.lifecycleGeneration;
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
      this.save();
      void this.drain();
      return { ...duplicate };
    }
    // P429 (A1): a discovery issue that is released and re-dispatched
    // arrives with a fresh runId, so the exact-match check above cannot
    // see that the same issue is already queued. When the incoming
    // request carries the issue identity, a queued request for the same
    // issue is the duplicate, whatever its runId. Requests without a
    // readable identity keep the previous behavior only.
    const incomingIdentities = discoveryIssueIdentities(source, meta);
    if (incomingIdentities.length > 0) {
      const issueDuplicate = this.state.queue.find(item =>
        discoveryIssueIdentities(item.source, item).some(identity => incomingIdentities.includes(identity))
      );
      if (issueDuplicate) {
        this.save();
        void this.drain();
        return { ...issueDuplicate };
      }
    }
    // P371: never persist a request this service's own loader would
    // reject. A blank trigger can only produce a meaningless task, so
    // it is refused here; out-of-range optional fields are sanitized.
    if (!trigger || !trigger.trim()) throw new Error('AUTONOMOUS_LOOP_TRIGGER_REQUIRED');
    // P436: 上限で断る前に、drain と同じ述語で古い発見リクエストを
    // 先に掃除する。enqueue は同期のため drain() の完了は待てないが、
    // purgeStaleDiscoveryRequests は同期で、掃除時は自身で保存する。
    // 空きができればこのまま追加へ進み、上限到達の瞬間に来た発見
    // リクエストの取りこぼしを防ぐ。
    this.purgeStaleDiscoveryRequests(Date.now());
    // P432: at the cap, do not add another unstarted SYSTEM
    // AUTONOMOUS_DISCOVERY item; return an already-queued request
    // exactly like the duplicate path above. USER_REQUEST and other
    // non-discovery requests are never dropped by the cap.
    // P438: the claim-event direct submit (domainIntegrationBootstrap:
    // `claim.UNRESOLVED:<id>` / `claim.CONTRADICTED:<id>`, source SYSTEM,
    // no runType) is the same class — the claim is also recorded as a
    // discovery issue (recordContradiction), so refusing the direct
    // item loses nothing: the discovery service dispatches it later
    // as AUTONOMOUS_DISCOVERY. Without this, one VERIFY_RESEARCH_CLAIMS
    // run enqueues one item per claim event and the queue grows past
    // the cap in seconds (LOG_48: 197 -> 228 in ~16s).
    const isCapGated =
      source === 'SYSTEM' &&
      (meta.runType === 'AUTONOMOUS_DISCOVERY' || trigger.startsWith('claim.'));
    if (
      this.state.queue.length >= MAX_QUEUE_LENGTH &&
      isCapGated
    ) {
      const lowest = this.state.queue.reduce((best, item) =>
        !best || (item.priority ?? 0) < (best.priority ?? 0) ? item : best,
        undefined as AutonomousImprovementRequest | undefined);
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `[RUNTIME] AutonomousLoop enqueue refused at cap: trigger=${truncateForLog(trigger, 80)} source=${source} runType=${meta.runType ?? '-'} queue=${this.state.queue.length}`,
      );
      this.save();
      void this.drain();
      return { ...(lowest ?? this.state.queue[0]) };
    }
    const now = Date.now();
    this.sequence += 1;
    const normalizedPayload=normalizeDiscoveryIssuePayload(meta.payload);
    const item: AutonomousImprovementRequest = {
      id: `AIR-${now}-${String(this.sequence).padStart(6, '0')}`,
      trigger,
      source,
      runId: typeof meta.runId === 'string' ? meta.runId : undefined,
      changeSetId: typeof meta.changeSetId === 'string' ? meta.changeSetId : undefined,
      runType: typeof meta.runType === 'string' ? meta.runType : undefined,
      sourceId: typeof meta.sourceId === 'string' ? meta.sourceId : undefined,
      priority: typeof meta.priority === 'number' && Number.isFinite(meta.priority) ? Math.max(0, meta.priority) : undefined,
      payload: normalizedPayload ? { ...normalizedPayload } : undefined,
      createdAt: now,
      attempts: 0,
      resourceWaitCount: 0,
      evidenceWaitCount: 0,
      nextAttemptAt: undefined,
      waitKind: undefined,
      waitReason: undefined,
    };
    const orphanedTask=this.findRecoverableAutonomousTask(trigger,meta);
    const task=orphanedTask||taskBlackboardService.create(trigger,'core',{
      ...(normalizedPayload||{}),
      runId:meta.runId,
      changeSetId:meta.changeSetId,
      runType:meta.runType,
      sourceId:meta.sourceId,
      priority:meta.priority,
      orchestrationMode:'SELF_IMPROVEMENT_WORKER',
      kind:'SELF_IMPROVEMENT'
    });
    if(!orphanedTask||task.status==='OPEN'){
      taskBlackboardService.pause(task.taskId,'SELF_IMPROVEMENT_QUEUED');
    }
    item.taskId=task.taskId;
    this.state.queue.push(item);
    this.state.queue.sort(compareQueueRequests);
    this.state.status = 'IDLE';
    this.state.retryAt = undefined;
    this.save();
    // P428: enqueue record (the duplicate path above returns the
    // existing request and does not record a new arrival).
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `[RUNTIME] AutonomousLoop enqueue: ${item.id} task=${item.taskId || '-'} source=${item.source} priority=${item.priority ?? '-'} queue=${this.state.queue.length}`,
    );
    this.logQueueDigest('enqueue', true);
    void this.drain();
    return { ...item };
  }

  private findRecoverableAutonomousTask(trigger:string,meta:Partial<AutonomousImprovementRequest>){
    if(meta.runType!=='AUTONOMOUS_DISCOVERY'||typeof meta.runId!=='string'||!meta.runId)return undefined;
    return taskBlackboardService.list(200).find(task=>{
      if(task.goal.trim()!==trigger.trim())return false;
      if(task.status!=='OPEN'&&task.status!=='PAUSED')return false;
      if(task.status==='PAUSED'&&task.pausedReason!=='SELF_IMPROVEMENT_QUEUED')return false;
      const payloadEntry=task.entries.find(entry=>entry.kind==='INPUT'&&entry.key==='payload');
      const value=payloadEntry?.value;
      if(!value||typeof value!=='object'||Array.isArray(value))return false;
      const payload=value as Record<string,unknown>;
      return payload.runId===meta.runId&&
        payload.runType===meta.runType&&
        payload.sourceId===meta.sourceId&&
        payload.orchestrationMode==='SELF_IMPROVEMENT_WORKER'&&
        payload.kind==='SELF_IMPROVEMENT'&&
        payload.issueId===meta.payload?.issueId&&
        payload.fingerprint===meta.payload?.fingerprint;
    });
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

  /*
   * P453: 教師の回答（矛盾解決の取り込み）が対象 Claim に証拠を届けた
   * とき、その Claim を文脈に持つ park 中の項目の待ちを解く。「待って
   * いた証拠が届いた」状態であり、既存の回復経路（acquire→再評価→
   * 決着の消費→CORE 再評価）が即時に走るようにするための接続であって、
   * キュー全体の排出規則（試行回数・証拠待ちラダー）は変えない。
   * 待ちが解けるのは claimContext の claimId／矛盾相手が対象に含まれる
   * 項目だけ。戻り値は待ちを解いた件数。
   */
  public expediteRequestsForClaims(claimIds: string[]): number {
    this.assertWritable();
    const targets = new Set(claimIds.filter((id) => typeof id === 'string' && id.length > 0));
    if (targets.size === 0) return 0;
    let expedited = 0;
    for (const item of this.state.queue) {
      if (item.id === this.state.activeRequestId) continue;
      const context = item.payload?.claimContext as Record<string, unknown> | undefined;
      if (!context || typeof context.claimId !== 'string') continue;
      const linked: unknown[] = [context.claimId];
      if (Array.isArray(context.contradictedBy)) {
        for (const other of context.contradictedBy) {
          if (other && typeof other === 'object') linked.push((other as Record<string, unknown>).claimId);
        }
      }
      if (!linked.some((id) => typeof id === 'string' && targets.has(id))) continue;
      if (item.nextAttemptAt !== undefined || item.waitKind !== undefined || item.waitReason !== undefined) {
        item.nextAttemptAt = undefined;
        item.waitKind = undefined;
        item.waitReason = undefined;
        expedited += 1;
      }
    }
    if (expedited > 0) {
      this.state.status = 'IDLE';
      this.state.retryAt = undefined;
      this.save();
      systemLogger.info('SELF_IMPROVEMENT', `[矛盾解決] 教師回答の取り込みで証拠待ちを解除: ${expedited} 件`);
      void this.drain();
    }
    return expedited;
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
    const generation = this.lifecycleGeneration;
    this.recoveryTimer = setTimeout(() => {
      if (!this.isGenerationCurrent(generation)) return;
      this.recoveryTimer = null;
      void this.recoverIfReady();
    }, delay);
  }

  private async recoverIfReady(): Promise<void> {
    if (this.writesBlocked || this.disposed || this.running || this.state.queue.length === 0) {
      return;
    }
    const generation = this.lifecycleGeneration;
    if (this.state.queue.some(item => item.cancelRequested === true)) {
      try { this.reconcileCancellationRequests(); }
      catch (error) { systemLogger.warn('PERSISTENCE', '[AutonomousLoop] retrying durable cancellation reconciliation', { error: String(error instanceof Error ? error.message : error) }); this.scheduleRecovery(RECOVERY_POLL_MS); return; }
      if (this.writesBlocked || this.state.queue.length === 0) return;
    }
    if (this.state.status === 'WAITING_RESOURCE') {
      await resourceGovernanceService.refresh();
      if (!this.isGenerationCurrent(generation)) return;
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
    if (this.writesBlocked || this.disposed || this.running) return;
    const generation = this.lifecycleGeneration;
    if (this.state.queue.some(item => item.cancelRequested === true)) {
      try { this.reconcileCancellationRequests(); }
      catch (error) { systemLogger.warn('PERSISTENCE', '[AutonomousLoop] refusing dispatch while cancellation intent remains pending', { error: String(error instanceof Error ? error.message : error) }); this.scheduleRecovery(RECOVERY_POLL_MS); return; }
    }
    // P432: prune stale discovery requests at drain time too, with the
    // same predicate load() uses, so the queue cannot grow unbounded
    // while the app is running.
    this.purgeStaleDiscoveryRequests(Date.now());
    // P463: 選択の時点でも並べ直す。優先度は投入時に固定され、運転中の
    // expedite（待ち解除・引き上げ）が選択順に反映されなかった。
    this.state.queue.sort(compareQueueRequests);
    if (this.writesBlocked || this.state.queue.length === 0) return;
    this.running = true;
    let activeRequest: AutonomousImprovementRequest | undefined;
    try {
      while (this.state.queue.length > 0) {
        if (!this.isGenerationCurrent(generation)) return;
        const now=Date.now();
        // P428: read-only count for the selection record below --
        // how many queued requests are still inside their wait.
        const waitingCount=this.state.queue.filter(item=>item.nextAttemptAt&&item.nextAttemptAt>now).length;
        const eligibleIndex=this.state.queue.findIndex(item=>!item.nextAttemptAt||item.nextAttemptAt<=now);
        if(eligibleIndex<0){
          const earliest=this.state.queue.reduce((best,item)=>!best||Number(item.nextAttemptAt||0)<Number(best.nextAttemptAt||0)?item:best,undefined as AutonomousImprovementRequest|undefined);
          this.state.status=earliest?.waitKind==='RESOURCE'?'WAITING_RESOURCE':earliest?.waitKind==='EVIDENCE'?'WAITING_EVIDENCE':'PAUSED';
          this.state.lastReason=earliest?.waitReason||'QUEUE_WAITING_FOR_NEXT_ATTEMPT';
          this.state.retryAt=earliest?.nextAttemptAt;
          this.state.activeRequestId=undefined;
          this.save();
          this.logQueueDigest('waiting');
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
        // P428: the step record used to carry only the request id,
        // so a request that was never selected (queue starvation)
        // left no trace in the runtime log and its taskId never
        // appeared. Carry the identifiers and the queue shape at
        // selection time; the prefix and id keep their old form.
        systemLogger.info(
          'SELF_IMPROVEMENT',
          `[RUNTIME] AutonomousLoop step: ${request.id} task=${request.taskId || '-'} source=${request.source} trigger=${truncateForLog(request.trigger, 80)} queue=${this.state.queue.length} waiting=${waitingCount}`,
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
          if (!this.isGenerationCurrent(generation)) return;
          if (!preflight.passed) {
            // P366: preflight reasons are environment/registry preconditions
            // (persistent backend, snapshot presence, run registration),
            // never code debt. The previous route recorded UNEXECUTED_CHECK
            // debt for them; discovery re-queued that debt at priority 75
            // and starved user-requested work in a self-feeding loop.
            if (preflight.reasons.includes('RUN_NOT_FOUND')) {
              this.dropCurrent(`PREFLIGHT_RUN_NOT_FOUND:${request.runId || ''}`);
              continue;
            }
            this.waitForResource(request, preflight.reasons.join(','));
            continue;
          }
          // P366: a passing preflight settles PREFLIGHT debt that older
          // builds recorded for this run, so it stops being re-queued.
          for (const debt of improvementDebtService.listOpen()) {
            if (debt.runId === request.runId && debt.kind === 'UNEXECUTED_CHECK' && debt.detail.startsWith('PREFLIGHT:')) {
              improvementDebtService.resolve(debt.debtId);
            }
          }
        }

        await resourceGovernanceService.refresh();
        if (!this.isGenerationCurrent(generation)) return;
        if (!resourceGovernanceService.canRunComponentTests()) {
          this.waitForResource(request, 'RESOURCE_GOVERNANCE_BLOCKED');
          break;
        }

        this.replaceLegacyMisclassifiedTask(request);
        // P405: remember where this execution's blackboard entries
        // start; the budget-pause classification below may only look
        // at entries appended by THIS execution.
        const entriesBeforeExecution = request.taskId
          ? taskBlackboardService.get(request.taskId)?.entries.length ?? 0
          : 0;
        request.attempts += 1;
        request.resourceWaitCount = 0;
        const workflow = request.taskId
          ? await this.resumeOwnedTask(request.taskId)
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
        if (!this.isGenerationCurrent(generation)) return;
        if (!workflow) {
          const orphanTask = request.taskId ? taskBlackboardService.get(request.taskId) : undefined;
          if (orphanTask?.status === 'COMPLETED') {
            // P369: a task that completed while this loop was waiting
            // (evidence wait, restart) is finished work, not an
            // orphan. Re-evaluate the evidence gate once; if it
            // passes, record completion instead of dropping the
            // request as not resumable.
            const orphanQuality = evidenceQualityGateService.evaluate(orphanTask);
            const orphanHasBusinessResult = orphanTask.entries.some(entry => {
              if (entry.kind !== 'RESULT' || !entry.value || typeof entry.value !== 'object') return false;
              return (entry.value as Record<string, unknown>).operationClass === 'BUSINESS';
            });
            if (!orphanHasBusinessResult || orphanQuality.passed) {
              this.finishRecoverySubgoals(
                orphanTask.taskId,
                'RESOLVED',
                orphanHasBusinessResult ? 'EVIDENCE_QUALITY_GATE_PASSED' : 'PARENT_TASK_COMPLETED_GATE_NOT_REQUIRED',
                orphanQuality.evidenceIds,
              );
              this.completeCurrent('IMPROVEMENT_CYCLE_COMPLETED');
              continue;
            }
          }
          // P366: a task that is gone or already terminal can never be
          // resumed; drop the request instead of burning attempts on it.
          if (!orphanTask || orphanTask.status === 'COMPLETED' || orphanTask.status === 'FAILED' || orphanTask.status === 'CANCELLED') {
            this.dropCurrent(`BLACKBOARD_TASK_NOT_RESUMABLE:${request.taskId || ''}`);
            continue;
          }
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
          await this.acquireThenWaitForEvidence(request, quality.reasons.join(','), generation);
          if (!this.isGenerationCurrent(generation)) return;
          continue;
        }
        // P367: a PAUSED task is a resumable pause, not a failure. The
        // orchestrator records several pause checkpoints (cycle limit,
        // background budget window, foreground user activity); only the
        // cycle-limit key used to be recognized here, so healthy tasks
        // advancing one budget window at a time burned attempts and
        // were dropped after three windows.
        // P405: classify the pause by the entries THIS execution
        // appended, not by the task's whole history, and only when
        // the execution actually dispatched work. The previous
        // history-wide check treated every later PAUSED of a task
        // that had once recorded a budget checkpoint as a free
        // budget continuation: the attempt was refunded, no backoff
        // was set, and drain re-stepped the same request immediately
        // (device: TASK-1793625482881-000009 stepped 16 times in
        // ~11s with dispatched=0 while other queue items starved).
        // A plateau pause appends no budget checkpoint in its own
        // execution, so it now falls through to failOrRetry, which
        // backs off and keeps the attempt. A budget pause with zero
        // dispatches is not chunked progress either (absolute-cycle
        // budget trap, foreground block): it takes the same
        // failOrRetry path instead of spinning.
        const budgetPausedThisExecution = workflow.task.entries
          .slice(entriesBeforeExecution)
          .some(entry => entry.kind === 'CHECKPOINT' && (entry.key === 'coreCycleBudgetExhausted' || entry.key.startsWith('backgroundBudgetPause:') || entry.key.startsWith('backgroundBudgetCycle:')));
        const cycleBudgetPaused = workflow.task.status === 'PAUSED' && budgetPausedThisExecution && workflow.dispatched > 0;
        if (cycleBudgetPaused) {
          request.attempts -= 1;
          this.state.status = 'RUNNING';
          this.state.lastReason = 'CORE_CYCLE_BUDGET_CONTINUE';
          this.save();
          continue;
        }
        // P410 T4: if research dispatched during THIS execution came
        // back with no admissible evidence because the source backend
        // was unreachable (SearXNG down: outcome SOURCE_UNAVAILABLE /
        // NO_RESULT), the missing piece is evidence infrastructure,
        // not task progress. Parking the request in the existing
        // WAITING_EVIDENCE ladder (instead of failOrRetry) keeps the
        // attempt accounting honest, gives the outage a unique,
        // recorded, retryable reason, and stops the task from
        // accumulating plateau empty cycles until the backend returns.
        // Like the P405 budget classification, only entries appended
        // by THIS execution are inspected.
        const researchUnavailableOutcome = this.researchUnavailableOutcomeThisExecution(
          workflow.task,
          entriesBeforeExecution,
        );
        if (researchUnavailableOutcome) {
          this.waitForEvidence(request, `RESEARCH_SOURCE_UNAVAILABLE:${researchUnavailableOutcome}`);
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
      if (!this.isGenerationCurrent(generation)) return;
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
        // P410 T6: exception headline in the message itself; details
        // are omitted from exported logs when large.
        `[RUNTIME_FAILURE] AutonomousLoop cycle stopped (${errorHeadline(error)})`,
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
    // P367: nothing works behind a resource wait (only a periodic
    // sensor re-read), so it must not be unbounded. After
    // MAX_RESOURCE_WAITS consecutive waits the request is dropped
    // visibly instead of stalling the whole queue forever behind a
    // condition nobody is working to resolve.
    if (request.resourceWaitCount > MAX_RESOURCE_WAITS) {
      this.dropCurrent(`RESOURCE_WAIT_EXHAUSTED:${reason}`);
      return;
    }
    const index = Math.min(request.resourceWaitCount - 1, RESOURCE_WAIT_MS.length - 1);
    this.state.status = 'WAITING_RESOURCE';
    this.state.lastReason = reason;
    this.state.retryAt = Date.now() + RESOURCE_WAIT_MS[index];
    request.nextAttemptAt=this.state.retryAt;
    request.waitKind='RESOURCE';
    request.waitReason=reason;
    this.moveParkedRequestToTail(request);
    this.save();
    // P428: park record (see logQueueDigest).
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `[RUNTIME] AutonomousLoop park: ${request.id} kind=RESOURCE reason=${truncateForLog(reason, 120)} retryAt=${this.state.retryAt ?? '-'}`,
    );
    this.logQueueDigest('park-resource');
  }

  // P427: round-robin rotation for parked requests. drain selects
  // the first eligible request in array order, and the queue is only
  // sorted at enqueue time. A request that parks with a short wait
  // (notably the 5-second progressed evidence wait) becomes eligible
  // again during the next request's minutes-long execution, so
  // without rotation the same predecessors win every selection and a
  // later arrival starves without bound (device: the priority-70
  // knowledge-gap request behind six rotating predecessors was never
  // selected in 24 minutes; see キュー停滞_調査報告). Moving a
  // parked request to the tail bounds every queued request's wait by
  // the requests ahead of it: each predecessor that runs and parks
  // goes behind it, and removals only shorten the line. The enqueue
  // priority order still decides the first pass. Wait durations, the
  // ladders and attempt accounting are unchanged; only the array
  // position of the parked request moves.
  private moveParkedRequestToTail(request: AutonomousImprovementRequest): void {
    const index = this.state.queue.indexOf(request);
    if (index < 0 || index === this.state.queue.length - 1) return;
    this.state.queue.splice(index, 1);
    this.state.queue.push(request);
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

  /**
   * P410 T4: returns the research outcome ('SOURCE_UNAVAILABLE' /
   * 'NO_RESULT') when research dispatched at or after
   * `entriesBeforeExecution` produced no admissible evidence, else
   * undefined. Only the current execution's entries are inspected so
   * a stale outage in the task history cannot reclassify later pauses.
   */
  private researchUnavailableOutcomeThisExecution(
    task: { entries: Array<{ domain: string; kind: string; value: unknown; evidenceIds?: string[] }> },
    entriesBeforeExecution: number,
  ): string | undefined {
    return task.entries
      .slice(entriesBeforeExecution)
      .reduce<string | undefined>((found, entry) => {
        if (found) return found;
        if (entry.domain !== 'research') return undefined;
        if (entry.kind !== 'RESULT' && entry.kind !== 'OBSERVATION') return undefined;
        const value = entry.value && typeof entry.value === 'object'
          ? entry.value as Record<string, unknown>
          : undefined;
        if (!value) return undefined;
        const operation = String(value.operation || '');
        if (operation !== 'RUN_RESEARCH' && operation !== 'EXECUTE_AUTONOMOUS_SEARCH') return undefined;
        const reply = value.reply && typeof value.reply === 'object'
          ? value.reply as Record<string, unknown>
          : undefined;
        const data = reply?.data && typeof reply.data === 'object'
          ? reply.data as Record<string, unknown>
          : undefined;
        const outcome = String(data?.outcome || reply?.outcome || value.outcome || '').toUpperCase();
        if (outcome !== 'SOURCE_UNAVAILABLE' && outcome !== 'NO_RESULT') return undefined;
        const admissibleEvidence =
          (Array.isArray(data?.evidenceIds) ? data.evidenceIds.length : 0) +
          (Array.isArray(data?.evidence)
            ? data.evidence.filter(item => item && typeof item === 'object' && (item as Record<string, unknown>).status !== 'REJECTED').length
            : 0) +
          (entry.evidenceIds || []).length;
        if (admissibleEvidence > 0) return undefined;
        return outcome;
      }, undefined);
  }

  private async acquireThenWaitForEvidence(request: AutonomousImprovementRequest, reason: string, generation: number): Promise<void> {
    // P425 B1/B2: 矛盾イベント由来のリクエストでは、ingress payload
    // に運ばれた Claim 文脈を証拠取得へそのまま渡す。形が崩れて
    // いる場合は文脈なしとして従来経路に落とす。
    const rawClaimContext = request.payload?.claimContext as Record<string, unknown> | undefined;
    const claimContext = rawClaimContext
      && typeof rawClaimContext.claimId === 'string'
      && typeof rawClaimContext.statement === 'string'
      ? {
          claimId: rawClaimContext.claimId,
          statement: rawClaimContext.statement,
          scope: rawClaimContext.scope as Record<string, unknown> | undefined,
          source: typeof rawClaimContext.source === 'string' ? rawClaimContext.source : undefined,
          originSourceId: typeof rawClaimContext.originSourceId === 'string' ? rawClaimContext.originSourceId : undefined,
          contradictedBy: Array.isArray(rawClaimContext.contradictedBy)
            ? rawClaimContext.contradictedBy
                .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
                .map(item => ({
                  claimId: String(item.claimId || ''),
                  statement: String(item.statement || ''),
                }))
                .filter(item => item.claimId)
            : [],
        }
      : undefined;
    const acquired = await requiredAssetAcquisitionService.acquire({
      runId: request.runId,
      taskId: request.taskId,
      workspaceId: request.workspaceId,
      reasons: reason.split(',').filter(Boolean),
      objective: request.trigger,
      claimContext,
    });
    if (!this.isGenerationCurrent(generation)) return;

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
      // P427: this is a park (short wait, request stays queued), so
      // it takes the same round-robin rotation as the wait paths.
      this.moveParkedRequestToTail(request);
      this.save();
      // P428: this park bypasses the waitFor* paths, so it records
      // its own park line (see logQueueDigest).
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `[RUNTIME] AutonomousLoop park: ${request.id} kind=EVIDENCE reason=${truncateForLog(request.waitReason || '', 120)} retryAt=${request.nextAttemptAt ?? '-'}`,
      );
      this.logQueueDigest('park-acquired');
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

  private waitForEvidence(request: AutonomousImprovementRequest, reason: string): void {
    request.evidenceWaitCount = (request.evidenceWaitCount || 0) + 1;
    const index = Math.min(request.evidenceWaitCount - 1, EVIDENCE_WAIT_MS.length - 1);
    this.state.status = 'WAITING_EVIDENCE';
    this.state.lastReason = reason;
    // P431 R3: every evidence wait follows the P410 backoff ladder.
    // The previous short-circuit (progressed ? 5_000 : ladder) keyed
    // the 5-second retry on the acquisition's `progressed` flag, but
    // acquire() reports progress whenever the acquisition machinery
    // ran -- including a research dispatch that returned zero
    // evidence and changed nothing. On device that made an unchanged
    // failure re-run the same research -> same rejection cycle every
    // ~5 seconds (recordedAt -> retryAt was 5,063-5,392 ms for every
    // park), a hot loop wearing the shape of a wait. The one
    // legitimate short wait is the acquired case in
    // acquireThenWaitForEvidence (asset in hand, prompt CORE
    // re-evaluation), which keeps its own 5-second park and does not
    // pass through here.
    this.state.retryAt = Date.now() + EVIDENCE_WAIT_MS[index];
    request.nextAttemptAt=this.state.retryAt;
    request.waitKind='EVIDENCE';
    request.waitReason=reason;
    this.moveParkedRequestToTail(request);
    this.save();
    // P428: park record (see logQueueDigest).
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `[RUNTIME] AutonomousLoop park: ${request.id} kind=EVIDENCE reason=${truncateForLog(reason, 120)} retryAt=${this.state.retryAt ?? '-'}`,
    );
    this.logQueueDigest('park-evidence');
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
      // P428: attempt exhaustion removes the request; record it
      // like a drop so the end of a request is visible in the log.
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `[RUNTIME] AutonomousLoop drop: ${request.id} task=${request.taskId || '-'} reason=${truncateForLog(`${reason}:MAX_ATTEMPTS`, 120)}`,
      );
      // P458: 教師返却の材料が試行上限で落ちた場合は、行き先
      // （受入台帳の保全と再投入）が分かる行を別に残す。
      if (isTeacherReturnRequest(request)) {
        systemLogger.warn(
          'SELF_IMPROVEMENT',
          `[P458] 教師返却の材料がキューから落ちました: request=${request.id} run=${request.runId || '-'} intake=${typeof request.payload?.supplyIntakeId === 'string' ? request.payload.supplyIntakeId : '-'} reason=${truncateForLog(`${reason}:MAX_ATTEMPTS`, 120)} — 供給材料は受入台帳に保全されており、次回起動時の照合で再投入されます`,
        );
      }
      this.logQueueDigest('exhausted', true);
      return;
    }
    this.state.status = 'PAUSED';
    this.state.lastReason = reason;
    this.state.retryAt = Date.now() + EVIDENCE_WAIT_MS[Math.min(request.attempts, EVIDENCE_WAIT_MS.length - 1)];
    request.nextAttemptAt=this.state.retryAt;
    request.waitKind='RETRY';
    request.waitReason=reason;
    this.moveParkedRequestToTail(request);
    this.save();
    // P428: park record (see logQueueDigest).
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `[RUNTIME] AutonomousLoop park: ${request.id} kind=RETRY reason=${truncateForLog(reason, 120)} retryAt=${this.state.retryAt ?? '-'}`,
    );
    this.logQueueDigest('park-retry');
  }

  private async resumeOwnedTask(taskId: string) {
    // P366: loop-owned tasks can be left in ROUTING by an interrupted
    // cycle; the blackboard resumes those only when routing recovery is
    // explicitly allowed (the flag existed end-to-end but was never
    // passed). A task that no longer exists is reported as undefined so
    // the caller can drop the request instead of failing the whole drain.
    try {
      return await coreTaskIngressService.resume(taskId, coreCycleSettingsService.maxCyclesFor('SELF_IMPROVEMENT'), true);
    } catch (error) {
      if (String(error).includes('CORE_TASK_NOT_FOUND')) return undefined;
      throw error;
    }
  }

  private dropCurrent(reason: string): void {
    // P366: the head request can never proceed (its run or task is gone
    // or terminal). Remove it instead of retrying until MAX_ATTEMPTS.
    const request = this.state.queue[0];
    if (request?.taskId) {
      this.finishRecoverySubgoals(request.taskId, 'FAILED', reason);
    }
    this.state.queue.shift();
    this.state.status = 'IDLE';
    this.state.activeRequestId = undefined;
    this.state.lastReason = reason;
    this.state.retryAt = undefined;
    this.save();
    // P428: drops were previously invisible in the runtime log.
    if (request) {
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `[RUNTIME] AutonomousLoop drop: ${request.id} task=${request.taskId || '-'} reason=${truncateForLog(reason, 120)}`,
      );
      // P458: 教師返却の材料が落ちた場合は、行き先（受入台帳の保全と
      // 再投入）が分かる行を別に残す（LOG_6 の 001 はこの経路で、
      // 理由だけでは材料の喪失に気づけなかった）。
      if (isTeacherReturnRequest(request)) {
        systemLogger.warn(
          'SELF_IMPROVEMENT',
          `[P458] 教師返却の材料がキューから落ちました: request=${request.id} run=${request.runId || '-'} intake=${typeof request.payload?.supplyIntakeId === 'string' ? request.payload.supplyIntakeId : '-'} reason=${truncateForLog(reason, 120)} — 供給材料は受入台帳に保全されており、次回起動時の照合で再投入されます`,
        );
      }
    }
    this.logQueueDigest('drop', true);
  }

  private completeCurrent(reason: string): void {
    const request = this.state.queue[0];
    this.state.queue.shift();
    this.state.status = 'IDLE';
    this.state.activeRequestId = undefined;
    this.state.lastReason = reason;
    this.state.retryAt = undefined;
    this.save();
    // P428: completion was previously invisible in the runtime log
    // (only the removal of the request could be inferred).
    if (request) {
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `[RUNTIME] AutonomousLoop complete: ${request.id} task=${request.taskId || '-'} reason=${truncateForLog(reason, 120)}`,
      );
    }
    this.logQueueDigest('complete', true);
  }

  // P428: state digest for observability. The runtime log is the
  // user's one artefact a later analysis reads end to end, but queue
  // composition and per-task state used to live only in run-detail
  // exports -- a starved request that was never selected left no
  // trace at all (device: TASK-1793805094648-000336). The digest
  // rides on the state transitions that already persist (enqueue,
  // park, completion, drop, waiting, startup); it adds no timers and
  // no new persistence, and it is signature-suppressed: a snapshot
  // identical to the last emitted one is not repeated, so digest
  // lines are bounded by the number of distinct queue/task states,
  // never by elapsed time. Formatting only reads state already in
  // memory; a formatting failure must never disturb the loop.
  private logQueueDigest(context: string, force = false): void {
    try {
      const listed = this.state.queue.slice(0, 20).map(item => {
        const suffix = item.id.split('-').pop() || item.id;
        return `${suffix}:${item.source}${item.runType ? `/${item.runType}` : ''} a=${item.attempts} w=${item.waitKind || '-'} next=${item.nextAttemptAt ? 1 : 0}`;
      });
      const overflow = this.state.queue.length - listed.length;
      const activeRequest = this.state.activeRequestId
        ? this.state.queue.find(item => item.id === this.state.activeRequestId)
        : undefined;
      let taskPart = 'task=-';
      if (activeRequest?.taskId) {
        const task = taskBlackboardService.get(activeRequest.taskId);
        if (task) {
          const evidenceCount = new Set(task.entries.flatMap(entry => entry.evidenceIds || [])).size;
          taskPart = `task=${task.taskId} taskStatus=${task.status} cycle=${task.lastCycle} evidence=${evidenceCount}`;
        } else {
          taskPart = `task=${activeRequest.taskId} taskStatus=?`;
        }
      }
      const signature = `${this.state.status}|${listed.join('|')}|+${overflow}|${taskPart}`;
      if (!force && signature === this.lastDigestSignature) return;
      this.lastDigestSignature = signature;
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `[RUNTIME] AutonomousLoop digest (${context}): status=${this.state.status} queue=${this.state.queue.length} [${listed.join(' | ')}${overflow > 0 ? ` | +${overflow}` : ''}] ${taskPart}`,
      );
    } catch {
      // Observability only: never let digest formatting fail the loop.
    }
  }

  private assertWritable():void{if(this.writesBlocked)throw new Error('AUTONOMOUS_LOOP_STORE_WRITE_BLOCKED');}

  private blockPersistence(reason:string):void{this.writesBlocked=true;this.persistenceStatus='WRITE_BLOCKED';this.persistenceReason=reason.slice(0,700);if(this.recoveryTimer)clearTimeout(this.recoveryTimer);this.recoveryTimer=null;}

  private quarantine(sourceKey:string,raw:string,reason:string):boolean{const base=`${sourceKey}_quarantine_v1`;const envelope={version:1,sourceKey,quarantinedAt:Date.now(),reason:reason.slice(0,500),raw};try{let destination=base;const existing=storageService.getItem(base);if(existing!==null){try{const parsed=JSON.parse(existing) as Record<string,unknown>;if(parsed.version===1&&parsed.sourceKey===sourceKey&&parsed.raw===raw)return true;}catch{}let suffix=0;do{destination=`${base}_${Date.now()}_${suffix++}`;if(suffix>1000)return false;}while(storageService.getItem(destination)!==null);}storageService.setItem(destination,JSON.stringify(envelope));const saved=storageService.getItem(destination);if(saved===null)return false;const parsed=JSON.parse(saved) as Record<string,unknown>;return parsed.version===1&&parsed.sourceKey===sourceKey&&parsed.raw===raw;}catch{return false;}}

  private requestInvalidReason(item:unknown,ids:Set<string>):string|null{
    if(!item||typeof item!=='object'||Array.isArray(item))return 'AUTONOMOUS_LOOP_REQUEST_INVALID';
    const request=item as Record<string,unknown>;
    if(typeof request.id!=='string'||!request.id.trim()||ids.has(request.id))return 'AUTONOMOUS_LOOP_REQUEST_INVALID_ID';
    if(typeof request.trigger!=='string'||!request.trigger.trim()||!['AUTOPILOT','UI','EXECUTION','SYSTEM'].includes(String(request.source))||typeof request.createdAt!=='number'||!Number.isFinite(request.createdAt)||request.createdAt<0||typeof request.attempts!=='number'||!Number.isInteger(request.attempts)||request.attempts<0)return 'AUTONOMOUS_LOOP_REQUEST_INVALID_FIELDS';
    for(const key of ['runId','strategyId','strategyName','runType','sourceId','taskId','workspaceId','waitReason','changeSetId'])if(request[key]!==undefined&&typeof request[key]!=='string')return 'AUTONOMOUS_LOOP_REQUEST_INVALID_OPTIONAL_STRING';
    for(const key of ['priority','resourceWaitCount','evidenceWaitCount','nextAttemptAt'])if(request[key]!==undefined&&(typeof request[key]!=='number'||!Number.isFinite(request[key])||(request[key] as number)<0))return 'AUTONOMOUS_LOOP_REQUEST_INVALID_OPTIONAL_NUMBER';
    for(const key of ['resourceWaitCount','evidenceWaitCount'])if(request[key]!==undefined&&!Number.isInteger(request[key]))return 'AUTONOMOUS_LOOP_REQUEST_INVALID_WAIT_COUNT';
    if(request.waitKind!==undefined&&!['RESOURCE','EVIDENCE','RETRY'].includes(String(request.waitKind)))return 'AUTONOMOUS_LOOP_REQUEST_INVALID_WAIT_KIND';
    if(request.cancelRequested!==undefined&&typeof request.cancelRequested!=='boolean')return 'AUTONOMOUS_LOOP_REQUEST_INVALID_CANCEL_REQUEST';
    if(request.payload!==undefined&&(!request.payload||typeof request.payload!=='object'||Array.isArray(request.payload)))return 'AUTONOMOUS_LOOP_REQUEST_INVALID_PAYLOAD';
    ids.add(request.id);
    return null;
  }

  private parseState(raw:string):AutonomousLoopState{const value:unknown=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('AUTONOMOUS_LOOP_SNAPSHOT_INVALID_ROOT');const parsed=value as Record<string,unknown>;const validStatuses:AutonomousLoopStatus[]=['IDLE','RUNNING','WAITING_RESOURCE','WAITING_EVIDENCE','PAUSED','FAILED'];if(typeof parsed.status!=='string'||!validStatuses.includes(parsed.status as AutonomousLoopStatus)||!Array.isArray(parsed.queue)||parsed.queue.length>10000||typeof parsed.updatedAt!=='number'||!Number.isFinite(parsed.updatedAt)||parsed.updatedAt<0)throw new Error('AUTONOMOUS_LOOP_SNAPSHOT_INVALID_SHAPE');
    // P371: tolerate individual invalid queue items (for example a
    // record written by an older build) by dropping only those items
    // instead of quarantining the whole queue. Root/shape corruption
    // still rejects the entire snapshot: when the envelope itself is
    // untrustworthy there is nothing safe to salvage.
    const ids=new Set<string>();const validQueue:unknown[]=[];let droppedInvalid=0;for(const item of parsed.queue){if(this.requestInvalidReason(item,ids)!==null){droppedInvalid+=1;continue;}validQueue.push(item);}this.lastLoadDroppedInvalid=droppedInvalid;parsed.queue=validQueue;
    for(const key of ['activeRequestId','lastTaskId','lastReason'])if(parsed[key]!==undefined&&typeof parsed[key]!=='string')throw new Error('AUTONOMOUS_LOOP_STATE_INVALID_OPTIONAL_STRING');if(parsed.retryAt!==undefined&&(typeof parsed.retryAt!=='number'||!Number.isFinite(parsed.retryAt)||(parsed.retryAt as number)<0))throw new Error('AUTONOMOUS_LOOP_STATE_INVALID_RETRY_AT');return parsed as unknown as AutonomousLoopState;}

  private save(): void {
    this.assertWritable();
    const next:AutonomousLoopState={...this.state,updatedAt:Date.now()};
    const serialized=JSON.stringify(next);
    try{storageService.setItem(KEY,serialized);if(storageService.getItem(KEY)!==serialized)throw new Error('STORE_READBACK_MISMATCH');this.state.updatedAt=next.updatedAt;}catch(error){this.blockPersistence(`AUTONOMOUS_LOOP_STORE_WRITE_VERIFY_FAILED:${String(error instanceof Error?error.message:error)}`);throw new Error('AUTONOMOUS_LOOP_STORE_WRITE_VERIFY_FAILED');}
  }

  // P432: the load-time stale-discovery predicate (P429 B1), reused at
  // drain time so a queue that grows while the app is running is
  // pruned by the same rule without a new timer or persistence.
  private isStaleDiscoveryRequest(item: AutonomousImprovementRequest, now: number, activeRequestId?: string, lastTaskId?: string): boolean {
    return item.attempts === 0 &&
      item.source === 'SYSTEM' &&
      item.runType === 'AUTONOMOUS_DISCOVERY' &&
      item.createdAt <= now - DISCOVERY_UNSTARTED_TTL_MS &&
      item.id !== activeRequestId &&
      !(lastTaskId && item.taskId === lastTaskId) &&
      !(item.payload && item.payload.claimContext !== undefined);
  }

  // P438: load-time cap trim candidate — the same class the P432 cap
  // refuses at enqueue (unstarted SYSTEM discovery items), minus the
  // 24h age condition: a queue persisted by a pre-cap build can hold
  // young items above the cap, and discovery re-derives them on a
  // later scan. Attempted items, the active request and its task,
  // claim-context carriers, and non-discovery requests are never
  // trimmed.
  private isCapTrimmable(item: AutonomousImprovementRequest, activeRequestId?: string, lastTaskId?: string): boolean {
    return item.attempts === 0 &&
      item.source === 'SYSTEM' &&
      item.runType === 'AUTONOMOUS_DISCOVERY' &&
      item.id !== activeRequestId &&
      !(lastTaskId && item.taskId === lastTaskId) &&
      !(item.payload && item.payload.claimContext !== undefined);
  }

  private purgeStaleDiscoveryRequests(now: number): number {
    const before = this.state.queue.length;
    this.state.queue = this.state.queue.filter(item => !this.isStaleDiscoveryRequest(item, now, this.state.activeRequestId, this.state.lastTaskId));
    const purged = before - this.state.queue.length;
    if (purged > 0) {
      systemLogger.info('SELF_IMPROVEMENT', `[RUNTIME] AutonomousLoop purge: staleDiscovery=${purged} queue=${this.state.queue.length}`);
      try { this.save(); } catch { /* WRITE_BLOCKED is exposed and further execution is stopped. */ }
    }
    return purged;
  }

  private load(): void {
    let sourceKey=KEY;let raw:string|null;
    try{raw=storageService.getItem(KEY);if(raw===null){sourceKey=LEGACY_KEY;raw=storageService.getItem(LEGACY_KEY);}}catch(error){this.blockPersistence(`AUTONOMOUS_LOOP_STORE_READ_FAILED:${String(error instanceof Error?error.message:error)}`);return;}
    if(raw===null)return;
    let parsed:AutonomousLoopState;
    try{parsed=this.parseState(raw);}catch(error){const reason=String(error instanceof Error?error.message:error).slice(0,500);this.state={status:'IDLE',queue:[],updatedAt:0};if(this.quarantine(sourceKey,raw,reason)){this.persistenceStatus='RECOVERED_QUARANTINED';this.persistenceReason=`${sourceKey}_QUARANTINED:${reason}`;}else this.blockPersistence(`${sourceKey}_QUARANTINE_FAILED:${reason}`);return;}
    // P429 (C1): the blackboard persists only the newest 200 tasks
    // (taskBlackboardService MAX_TASKS), so a queued request whose task
    // overflowed that window can never resume -- the task record is
    // gone (enqueue creates the task before the request, so a missing
    // task breaks the request<->task invariant). Never-attempted
    // requests carrying such a taskId are purged here. Requests
    // without a taskId (direct-submit shapes) are not touched. Safe
    // side: if the persisted task set cannot be read, or reads empty,
    // C1 is skipped entirely rather than risking live requests.
    let persistedTaskIds:Set<string>|null=null;
    try{
      const ids=new Set<string>();
      for(const task of taskBlackboardService.list(100000))ids.add(task.taskId);
      if(ids.size>0)persistedTaskIds=ids;
    }catch{persistedTaskIds=null;}
    const loadNow=Date.now();
    let purgedCount=0;let orphanedPurgedCount=0;let staleDiscoveryPurgedCount=0;
    // P458: 起動時 purge で外れる教師返却項目は、件数の集計とは別に
    // 個別の行で残すため集めておく。
    const purgedTeacherReturns:AutonomousImprovementRequest[]=[];
    const activeQueue=parsed.queue.filter(item=>{
      if(item.attempts>=MAX_ATTEMPTS){purgedCount+=1;if(isTeacherReturnRequest(item))purgedTeacherReturns.push(item);return false;}
      if(persistedTaskIds&&item.attempts===0&&typeof item.taskId==='string'&&item.taskId&&!persistedTaskIds.has(item.taskId)){orphanedPurgedCount+=1;if(isTeacherReturnRequest(item))purgedTeacherReturns.push(item);return false;}
      // P429 (B1): unstarted discovery requests older than
      // DISCOVERY_UNSTARTED_TTL_MS. Never dropped: attempted requests,
      // the active request and its task, claim-context carriers, and
      // anything that is not a SYSTEM AUTONOMOUS_DISCOVERY request
      // (USER_REQUEST / EXTERNAL_DIRECTIVE keep their own lifetimes).
      if(this.isStaleDiscoveryRequest(item,loadNow,parsed.activeRequestId,parsed.lastTaskId)){staleDiscoveryPurgedCount+=1;return false;}
      return true;
    });
    const droppedInvalid=this.lastLoadDroppedInvalid;
    // P438: the P432 cap gates new enqueues, but a queue persisted by
    // an older (pre-cap) build can already exceed it — LOG_48 restored
    // 386 items and started at 196 after the purge above. Trim only
    // unstarted discovery items (the same class the cap refuses) from
    // the tail, so the restored queue starts at or under the cap when
    // enough trimmable items exist, without touching user requests,
    // attempted items, or in-flight work.
    let capTrimmedCount=0;
    if(activeQueue.length>MAX_QUEUE_LENGTH){
      let over=activeQueue.length-MAX_QUEUE_LENGTH;
      for(let i=activeQueue.length-1;i>=0&&over>0;i--){
        if(this.isCapTrimmable(activeQueue[i],parsed.activeRequestId,parsed.lastTaskId)){activeQueue.splice(i,1);over-=1;capTrimmedCount+=1;}
      }
    }
    // P453: 教師返却由来と刻印で識別できる既存項目は、優先度を返却帯
    // （TEACHER_RETURN_PRIORITY）へ引き上げ、enqueue と同じ比較で
    // 並べ直す。enqueue が毎回全体を再ソートする既存挙動と整合する
    // ため、復元順への依存は生まない。これにより、旧ビルドで滞留した
    // 返却 run（例: 001 の受入 run、payload に supplyIntakeId を持つ）
    // も、次回起動から同点の非返却項目より先に処理される。
    let teacherReturnLiftedCount=0;
    for(const item of activeQueue){
      if(isTeacherReturnRequest(item)&&(item.priority??0)<TEACHER_RETURN_PRIORITY){
        item.priority=TEACHER_RETURN_PRIORITY;
        teacherReturnLiftedCount+=1;
      }
    }
    activeQueue.sort(compareQueueRequests);
    this.state={...parsed,queue:activeQueue};
    if(purgedCount>0||droppedInvalid>0||orphanedPurgedCount>0||staleDiscoveryPurgedCount>0||capTrimmedCount>0||teacherReturnLiftedCount>0){this.state.status='IDLE';this.state.activeRequestId=undefined;this.state.retryAt=undefined;const parts:string[]=[];if(droppedInvalid>0)parts.push(`INVALID_REQUESTS_DROPPED:${droppedInvalid}`);if(purgedCount>0)parts.push(`EXHAUSTED_REQUESTS_PURGED:${purgedCount}`);if(orphanedPurgedCount>0)parts.push(`ORPHANED_REQUESTS_PURGED:${orphanedPurgedCount}`);if(staleDiscoveryPurgedCount>0)parts.push(`STALE_DISCOVERY_REQUESTS_PURGED:${staleDiscoveryPurgedCount}`);if(capTrimmedCount>0)parts.push(`CAP_TRIMMED:${capTrimmedCount}`);if(teacherReturnLiftedCount>0)parts.push(`TEACHER_RETURN_PRIORITY_LIFTED:${teacherReturnLiftedCount}`);this.state.lastReason=parts.join(':');if(orphanedPurgedCount>0||staleDiscoveryPurgedCount>0||capTrimmedCount>0){systemLogger.info('SELF_IMPROVEMENT',`[RUNTIME] AutonomousLoop purge: orphaned=${orphanedPurgedCount} staleDiscovery=${staleDiscoveryPurgedCount} capTrimmed=${capTrimmedCount} queue=${activeQueue.length}`);}if(teacherReturnLiftedCount>0){systemLogger.info('SELF_IMPROVEMENT',`[RUNTIME] AutonomousLoop teacher-return priority lifted: ${teacherReturnLiftedCount} 件 queue=${activeQueue.length}`);}try{this.save();}catch{/* WRITE_BLOCKED is exposed and further execution is stopped. */}}
    // P458: 起動時 purge で教師返却項目が外れた場合は、材料の行き先
    // （受入台帳の保全と、この後の保全照合での再投入）が分かる行を残す。
    for(const item of purgedTeacherReturns){
      systemLogger.warn('SELF_IMPROVEMENT',`[P458] 教師返却の材料が起動時の整理でキューから外れました: request=${item.id} run=${item.runId||'-'} intake=${typeof item.payload?.supplyIntakeId==='string'?item.payload.supplyIntakeId:'-'} — 供給材料は受入台帳に保全されており、この後の保全照合で再投入されます`);
    }
  }
}

export const autonomousSelfImprovementLoopService = new AutonomousSelfImprovementLoopService();
