import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { coreTaskIngressService } from './coreTaskIngressService';
import { taskBlackboardService } from './taskBlackboardService';
import { evidenceQualityGateService } from './evidenceQualityGateService';
import { resourceGovernanceService } from '../../safety/services/resourceGovernanceService';
import { candidateCodeGenerationService } from './candidateCodeGenerationService';
import { candidateConstraintValidationService } from './candidateConstraintValidationService';
import { candidateValidationRunnerService } from './candidateValidationRunnerService';
import { reviewZipExportService } from './reviewZipExportService';
import { requiredAssetAcquisitionService } from './requiredAssetAcquisitionService';
import { selfImprovementPreflightService } from './selfImprovementPreflightService';
import { runIntegrityAuditorService } from './runIntegrityAuditorService';
import { complexityCostGateService } from './complexityCostGateService';
import { cumulativeRevalidationService } from './cumulativeRevalidationService';
import { improvementDebtService } from './improvementDebtService';
import { isolatedCandidateWorkspaceService } from './isolatedCandidateWorkspaceService';
import { improvementIntakeRouterService } from './improvementIntakeRouterService';

export type AutonomousLoopStatus = 'IDLE' | 'RUNNING' | 'WAITING_RESOURCE' | 'WAITING_EVIDENCE' | 'PAUSED' | 'FAILED';

export interface AutonomousImprovementRequest {
  id: string;
  trigger: string;
  source: 'AUTOPILOT' | 'UI' | 'EXECUTION' | 'SYSTEM';
  runId?: string;
  runType?: string;
  sourceId?: string;
  priority?: number;
  payload?: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  taskId?: string;
  workspaceId?: string;
  resourceWaitCount?: number;
  evidenceWaitCount?: number;
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

const KEY = 'miki_autonomous_self_improvement_loop_v2';
const LEGACY_KEY = 'miki_autonomous_self_improvement_loop_v1';
const MAX_ATTEMPTS = 3;
const RECOVERY_POLL_MS = 60_000;
const RESOURCE_WAIT_MS = [2 * 60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000];
const EVIDENCE_WAIT_MS = [2 * 60_000, 10 * 60_000, 30 * 60_000, 60 * 60_000];

class AutonomousSelfImprovementLoopService {
  private state: AutonomousLoopState = { status: 'IDLE', queue: [], updatedAt: 0 };
  private running = false;
  private sequence = 0;
  private recoveryTimer: ReturnType<typeof setInterval> | null = null;

  public constructor() {
    this.load();
  }

  public initialize(): void {
    if (this.state.status === 'RUNNING') {
      this.state.status = 'PAUSED';
      this.state.lastReason = 'APPLICATION_RESTART_RECOVERY';
      this.state.retryAt = Date.now();
      this.save();
    }
    if (!this.recoveryTimer) {
      this.recoveryTimer = setInterval(() => {
        void this.recoverIfReady();
      }, RECOVERY_POLL_MS);
    }
    void this.recoverIfReady();
  }

  public dispose(): void {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }

  public enqueue(
    trigger: string,
    source: AutonomousImprovementRequest['source'],
    meta: Partial<AutonomousImprovementRequest> = {}
  ): AutonomousImprovementRequest {
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
    const item: AutonomousImprovementRequest = {
      id: `AIR-${now}-${String(this.sequence).padStart(6, '0')}`,
      trigger,
      source,
      runId: meta.runId,
      runType: meta.runType,
      sourceId: meta.sourceId,
      priority: meta.priority,
      payload: meta.payload ? { ...meta.payload } : undefined,
      createdAt: now,
      attempts: 0,
      resourceWaitCount: 0,
      evidenceWaitCount: 0,
    };
    this.state.queue.push(item);
    this.state.queue.sort((left, right) => (right.priority || 0) - (left.priority || 0) || left.createdAt - right.createdAt);
    this.state.status = 'IDLE';
    this.state.retryAt = undefined;
    this.save();
    void this.drain();
    return { ...item };
  }

  public getState(): AutonomousLoopState {
    return JSON.parse(JSON.stringify(this.state));
  }

  public resume(): void {
    if (!['PAUSED', 'WAITING_RESOURCE', 'WAITING_EVIDENCE', 'FAILED'].includes(this.state.status)) {
      return;
    }
    this.state.status = 'IDLE';
    this.state.lastReason = undefined;
    this.state.retryAt = undefined;
    this.save();
    void this.drain();
  }

  private async recoverIfReady(): Promise<void> {
    if (this.running || this.state.queue.length === 0) {
      return;
    }
    if (this.state.status === 'WAITING_RESOURCE') {
      await resourceGovernanceService.refresh();
      if (!resourceGovernanceService.canRunComponentTests()) {
        return;
      }
    }
    if (this.state.retryAt && Date.now() < this.state.retryAt) {
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
    if (this.running || this.state.queue.length === 0) {
      return;
    }
    this.running = true;
    try {
      while (this.state.queue.length > 0) {
        const request = this.state.queue[0];
        this.state.status = 'RUNNING';
        this.state.activeRequestId = request.id;
        this.save();

        if (request.runId) {
          const preflight = selfImprovementPreflightService.evaluate(request.runId);
          if (!preflight.passed) {
            improvementDebtService.record('UNEXECUTED_CHECK', `PREFLIGHT:${preflight.reasons.join(',')}`, request.runId);
            await this.acquireThenWaitForEvidence(request, preflight.reasons.join(','));
            break;
          }
        }

        await resourceGovernanceService.refresh();
        if (!resourceGovernanceService.canRunComponentTests()) {
          this.waitForResource(request, 'RESOURCE_GOVERNANCE_BLOCKED');
          break;
        }

        if (request.workspaceId && request.runId) {
          const completed = await this.retryValidationAndExport(request);
          if (completed) {
            continue;
          }
          break;
        }

        request.attempts += 1;
        const workflow = request.taskId
          ? await coreTaskIngressService.resume(request.taskId)
          : await coreTaskIngressService.submit({
              kind: 'SELF_IMPROVEMENT',
              goal: request.trigger,
              source: 'core',
              payload: {
              trigger: request.trigger,
              source: request.source,
              runId: request.runId,
              runType: request.runType,
              sourceId: request.sourceId,
              priority: request.priority,
              orchestrationMode: 'SELF_IMPROVEMENT_WORKER',
              ...(request.payload || {}),
              },
              maxCycles: 18,
            });
        if (!workflow) {
          this.failOrRetry(request, 'BLACKBOARD_TASK_RESUME_FAILED');
          if (this.state.status !== 'RUNNING') {
            break;
          }
          continue;
        }
        request.taskId = workflow.task.taskId;
        this.state.lastTaskId = workflow.task.taskId;

        if (request.runId) {
          const generation = await candidateCodeGenerationService.generate(request.runId);
          if (generation.accepted && generation.workspaceId) {
            request.workspaceId = generation.workspaceId;
            const workspace = isolatedCandidateWorkspaceService.get(generation.workspaceId);
            if (!workspace) {
              this.failOrRetry(request, 'WORKSPACE_NOT_FOUND_AFTER_GENERATION');
              continue;
            }
            const complexity = complexityCostGateService.evaluate(workspace);
            if (!complexity.passed) {
              isolatedCandidateWorkspaceService.setStatus(generation.workspaceId, 'REJECTED');
              improvementDebtService.record('CUMULATIVE_REGRESSION', `COMPLEXITY:${complexity.reasons.join(',')}`, request.runId);
              this.failOrRetry(request, complexity.reasons.join(','));
              continue;
            }
            const constraint = candidateConstraintValidationService.validate(request.runId, generation.workspaceId);
            if (!constraint.passed) {
              this.failOrRetry(request, constraint.reasons.join(','));
              if (this.state.status !== 'RUNNING') {
                break;
              }
              continue;
            }
            const completed = await this.retryValidationAndExport(request);
            if (completed) {
              continue;
            }
            break;
          }
          if (generation.reasons.some(reason => reason.includes('HTTP_') || reason.includes('FAILED') || reason.includes('REQUIRED'))) {
            await this.acquireThenWaitForEvidence(request, generation.reasons.join(','));
            break;
          }
        }

        const quality = evidenceQualityGateService.evaluate(workflow.task);
        if (workflow.task.status === 'COMPLETED' && quality.passed) {
          this.completeCurrent('IMPROVEMENT_CYCLE_COMPLETED');
          continue;
        }
        if (!quality.passed) {
          taskBlackboardService.append(
            workflow.task.taskId,
            'DECISION',
            'core',
            'evidence-recovery-required',
            { reasons: quality.reasons, requestedDomains: ['research', 'verification', 'memory'] },
            quality.evidenceIds
          );
          await this.acquireThenWaitForEvidence(request, quality.reasons.join(','));
          break;
        }
        this.failOrRetry(request, `WORKFLOW_${workflow.task.status}`);
        if (this.state.status !== 'RUNNING') {
          break;
        }
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
      this.save();
      systemLogger.warn('SELF_IMPROVEMENT', '[AutonomousLoop] cycle failed', String(error));
    } finally {
      this.running = false;
    }
  }

  private async retryValidationAndExport(request: AutonomousImprovementRequest): Promise<boolean> {
    if (!request.workspaceId || !request.runId) {
      return false;
    }
    const validation = await candidateValidationRunnerService.run(request.workspaceId);
    if (!validation.passed) {
      await this.acquireThenWaitForEvidence(request, validation.reasons.join(','));
      return false;
    }
    const artifact = await reviewZipExportService.create(request.runId, request.workspaceId);
    if (!artifact.ok || !artifact.artifact) {
      await this.acquireThenWaitForEvidence(request, `REVIEW_EXPORT_NOT_READY:${artifact.code}:${request.workspaceId}`);
      return false;
    }
    const integrity = runIntegrityAuditorService.audit(request.runId, request.workspaceId);
    if (!integrity.passed) {
      improvementDebtService.record('UNEXECUTED_CHECK', `RUN_INTEGRITY:${integrity.reasons.join(',')}`, request.runId);
      this.failOrRetry(request, `RUN_INTEGRITY_FAILED:${integrity.reasons.join(',')}`);
      return false;
    }
    const exportedWorkspaceIds = isolatedCandidateWorkspaceService.list().filter(item => item.status === 'EXPORTED').map(item => item.workspaceId);
    const cumulative = await cumulativeRevalidationService.run(exportedWorkspaceIds);
    if (!cumulative.passed) {
      improvementDebtService.record('CUMULATIVE_REGRESSION', cumulative.reasons.join(','), request.runId);
      this.failOrRetry(request, `CUMULATIVE_REVALIDATION_FAILED:${cumulative.reasons.join(',')}`);
      return false;
    }
    isolatedCandidateWorkspaceService.setStatus(request.workspaceId, 'EXPORTED');
    improvementIntakeRouterService.update(request.runId, { status: 'AWAITING_EXTERNAL_REVIEW', workspaceId: request.workspaceId });
    this.completeCurrent(`SELF_IMPROVEMENT_COMPLETED:${artifact.fileName}:${artifact.sha256}`);
    return true;
  }

  private waitForResource(request: AutonomousImprovementRequest, reason: string): void {
    request.resourceWaitCount = (request.resourceWaitCount || 0) + 1;
    const index = Math.min(request.resourceWaitCount - 1, RESOURCE_WAIT_MS.length - 1);
    this.state.status = 'WAITING_RESOURCE';
    this.state.lastReason = reason;
    this.state.retryAt = Date.now() + RESOURCE_WAIT_MS[index];
    this.save();
  }

  private async acquireThenWaitForEvidence(request: AutonomousImprovementRequest, reason: string): Promise<void> {
    const acquired = await requiredAssetAcquisitionService.acquire({
      runId: request.runId,
      taskId: request.taskId,
      workspaceId: request.workspaceId,
      reasons: reason.split(',').filter(Boolean),
      objective: request.trigger,
    });
    this.waitForEvidence(request, acquired.reasons.join(',') || reason, acquired.progressed);
  }

  private waitForEvidence(request: AutonomousImprovementRequest, reason: string, progressed = false): void {
    request.evidenceWaitCount = (request.evidenceWaitCount || 0) + 1;
    const index = Math.min(request.evidenceWaitCount - 1, EVIDENCE_WAIT_MS.length - 1);
    this.state.status = 'WAITING_EVIDENCE';
    this.state.lastReason = reason;
    this.state.retryAt = Date.now() + (progressed ? 5_000 : EVIDENCE_WAIT_MS[index]);
    this.save();
  }

  private failOrRetry(request: AutonomousImprovementRequest, reason: string): void {
    if (request.attempts >= MAX_ATTEMPTS) {
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

  private save(): void {
    this.state.updatedAt = Date.now();
    storageService.setItem(KEY, JSON.stringify(this.state));
  }

  private load(): void {
    try {
      const raw = storageService.getItem(KEY) || storageService.getItem(LEGACY_KEY);
      if (raw) {
        this.state = { ...this.state, ...JSON.parse(raw) };
      }
    } catch {
      this.state = { status: 'IDLE', queue: [], updatedAt: 0 };
    }
  }
}

export const autonomousSelfImprovementLoopService = new AutonomousSelfImprovementLoopService();
