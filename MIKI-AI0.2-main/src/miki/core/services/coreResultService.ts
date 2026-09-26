import { MikiCategory } from '../mikiInteractionBus';
import { ExecutionEventBusService, ExecutionEvent } from '../../execution/services/executionEventBusService';
import { systemLogger } from '../../../services/systemLogger';
import { storageService } from '../../../services/storageService';
import { selfImprovementIngressService } from './selfImprovementIngressService';
import type { AutonomousImprovementRequest } from './autonomousSelfImprovementLoopService';

export type CoreResultStatus =
  | 'accepted'
  | 'processing'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'rejected'
  | 'inconclusive';

export interface CoreRequest {
  requestId: string;
  goal?: string;
  targetCategory?: MikiCategory;
  sourceCategory?: MikiCategory | 'core';
  payload?: Record<string, unknown> | unknown;
  directiveId?: string;
  runId?: string;
  interactionId?: string;
  createdAt: number;
}

export interface CoreResult<T = unknown> {
  requestId: string;
  status: CoreResultStatus;
  result?: T;
  error?: string;
  route: string[];
  processedCategories: MikiCategory[];
  sourceCategory: MikiCategory | 'core';
  interactionId?: string;
  runId?: string;
  directiveId?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export type CoreResultListener = (result: CoreResult) => void;

const CORE_RESULT_STORAGE_KEY = 'miki_core_results_v2';
const MAX_PERSISTED_CORE_RESULTS = 200;

class CoreResultService {
  private results = new Map<string, CoreResult>();
  private listeners = new Map<string, Set<CoreResultListener>>();
  private allListeners = new Set<CoreResultListener>();
  private executionUnsubscribers: Array<() => void> = [];
  private sequence = 0;

  constructor() {
    this.loadPersistedResults();
    this.initExecutionEventBridge();
  }

  generateRequestId(prefix = 'req'): string {
    const timestamp = Date.now().toString(36);
    const counter = (++this.sequence).toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${prefix}_${timestamp}_${counter}_${random}`;
  }

  createRequest(input: Partial<CoreRequest> = {}): CoreResult {
    const requestId = input.requestId || this.generateRequestId();
    const now = Date.now();

    const resultRecord: CoreResult = {
      requestId,
      status: 'accepted',
      route: [input.sourceCategory || 'core'],
      processedCategories: input.targetCategory ? [input.targetCategory] : [],
      sourceCategory: input.sourceCategory || 'core',
      interactionId: input.interactionId,
      runId: input.runId,
      directiveId: input.directiveId,
      createdAt: now,
      updatedAt: now,
    };

    this.results.set(requestId, resultRecord);
    this.persistResults();
    this.notify(resultRecord);
    return resultRecord;
  }

  updateStatus(
    requestId: string,
    status: CoreResultStatus,
    patch: Partial<CoreResult> = {}
  ): CoreResult {
    const existing = this.results.get(requestId) || this.createRequest({ requestId });
    const now = Date.now();

    const updated: CoreResult = {
      ...existing,
      ...patch,
      requestId,
      status,
      updatedAt: now,
      completedAt:
        ['completed', 'failed', 'blocked', 'rejected', 'inconclusive'].includes(status)
          ? now
          : existing.completedAt,
    };

    if (patch.processedCategories) {
      const mergedCategories = Array.from(
        new Set([...existing.processedCategories, ...patch.processedCategories])
      );
      updated.processedCategories = mergedCategories;
    }

    if (patch.route) {
      const mergedRoute = Array.from(new Set([...existing.route, ...patch.route]));
      updated.route = mergedRoute;
    }

    this.results.set(requestId, updated);
    this.persistResults();
    this.notify(updated);
    return updated;
  }

  recordCategoryStep(
    requestId: string,
    category: MikiCategory,
    status: CoreResultStatus = 'processing'
  ): CoreResult {
    const existing = this.results.get(requestId) || this.createRequest({ requestId });
    const processed = Array.from(new Set([...existing.processedCategories, category]));
    const route = Array.from(new Set([...existing.route, category]));

    return this.updateStatus(requestId, status, {
      processedCategories: processed,
      route,
    });
  }

  complete<T = unknown>(
    requestId: string,
    payload: T,
    patch: Partial<CoreResult> = {}
  ): CoreResult<T> {
    return this.updateStatus(requestId, 'completed', {
      ...patch,
      result: payload,
    }) as CoreResult<T>;
  }

  submitImprovementRequest(params: {
    trigger: string;
    source?: AutonomousImprovementRequest['source'];
    payload?: Record<string, unknown>;
    directiveId?: string;
    runId?: string;
    goal?: string;
  }): { coreResult: CoreResult; queuedRequest: AutonomousImprovementRequest } {
    const trigger = (params.trigger || '').trim();
    if (!trigger) throw new Error('SELF_IMPROVEMENT_TRIGGER_REQUIRED');

    const coreResult = this.createRequest({
      sourceCategory: 'core',
      targetCategory: 'improvement',
      directiveId: params.directiveId,
      runId: params.runId,
      goal: params.goal || trigger,
      payload: { ...params.payload, trigger, source: params.source || 'UI' },
    });

    this.recordCategoryStep(coreResult.requestId, 'improvement', 'processing');

    const queuedRequest = selfImprovementIngressService.submit({
      trigger,
      source: params.source || 'UI',
      runId: params.runId,
      payload: {
        ...(params.payload || {}),
        requestId: coreResult.requestId,
      },
    });

    this.recordCategoryStep(coreResult.requestId, 'execution', 'accepted');

    return { coreResult, queuedRequest };
  }

  fail(requestId: string, error: string, patch: Partial<CoreResult> = {}): CoreResult {
    return this.updateStatus(requestId, 'failed', {
      ...patch,
      error,
    });
  }

  waiting(requestId: string, patch: Partial<CoreResult> = {}): CoreResult {
    return this.updateStatus(requestId, 'waiting', patch);
  }

  rejected(requestId: string, error: string, patch: Partial<CoreResult> = {}): CoreResult {
    return this.updateStatus(requestId, 'rejected', {
      ...patch,
      error,
    });
  }

  inconclusive(requestId: string, error?: string, patch: Partial<CoreResult> = {}): CoreResult {
    return this.updateStatus(requestId, 'inconclusive', {
      ...patch,
      ...(error ? { error } : {}),
    });
  }

  blocked(requestId: string, error: string, patch: Partial<CoreResult> = {}): CoreResult {
    return this.updateStatus(requestId, 'blocked', {
      ...patch,
      error,
    });
  }

  get(requestId: string): CoreResult | undefined {
    return this.results.get(requestId);
  }

  list(limit = 100): CoreResult[] {
    return Array.from(this.results.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  subscribe(requestId: string, listener: CoreResultListener): () => void {
    let set = this.listeners.get(requestId);
    if (!set) {
      set = new Set<CoreResultListener>();
      this.listeners.set(requestId, set);
    }
    set.add(listener);

    const existing = this.results.get(requestId);
    if (existing) {
      try {
        listener(existing);
      } catch (err) {
        systemLogger.error('SYSTEM', 'coreResultService: listener initial error', { err });
      }
    }

    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        this.listeners.delete(requestId);
      }
    };
  }

  subscribeAll(listener: CoreResultListener): () => void {
    this.allListeners.add(listener);
    return () => {
      this.allListeners.delete(listener);
    };
  }

  private notify(result: CoreResult): void {
    const specificListeners = this.listeners.get(result.requestId);
    if (specificListeners) {
      specificListeners.forEach((fn) => {
        try {
          fn(result);
        } catch (e) {
          systemLogger.error('SYSTEM', 'coreResultService: specific listener failed', { e });
        }
      });
    }

    this.allListeners.forEach((fn) => {
      try {
        fn(result);
      } catch (e) {
        systemLogger.error('SYSTEM', 'coreResultService: global listener failed', { e });
      }
    });
  }

  private persistResults(): void {
    try {
      const records = Array.from(this.results.values())
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_PERSISTED_CORE_RESULTS);
      storageService.setItem(CORE_RESULT_STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
      systemLogger.warn('SYSTEM', 'coreResultService: result persistence failed', { error });
    }
  }

  private loadPersistedResults(): void {
    try {
      const raw = storageService.getItem(CORE_RESULT_STORAGE_KEY);
      const records: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(records)) return;
      for (const record of records) {
        if (!this.isPersistedCoreResult(record)) continue;
        this.results.set(record.requestId, record);
      }
    } catch (error) {
      this.results.clear();
      systemLogger.warn('SYSTEM', 'coreResultService: result restore failed', { error });
    }
  }

  private isPersistedCoreResult(value: unknown): value is CoreResult {
    if (typeof value !== 'object' || value === null) return false;
    const record = value as Partial<CoreResult>;
    return typeof record.requestId === 'string'
      && typeof record.status === 'string'
      && Array.isArray(record.route)
      && Array.isArray(record.processedCategories)
      && typeof record.createdAt === 'number'
      && typeof record.updatedAt === 'number';
  }

  private initExecutionEventBridge(): void {
    try {
      const bus = ExecutionEventBusService.getInstance();
      const onCompleted = (event: ExecutionEvent) => {
        if (!event.request_id) return;
        this.updateStatus(event.request_id, 'completed', {
          result: {
            outputSummary: event.output_summary,
            componentId: event.component_id,
            runnerId: event.runner_id,
            durationMs: event.duration_ms,
            passed: event.passed,
          },
          route: ['execution'],
          processedCategories: ['execution'],
        });
      };

      const onFailed = (event: ExecutionEvent) => {
        if (!event.request_id) return;
        this.updateStatus(event.request_id, 'failed', {
          error: event.error_message || 'Execution failed',
          route: ['execution'],
          processedCategories: ['execution'],
        });
      };

      const onRejected = (event: ExecutionEvent) => {
        if (!event.request_id) return;
        this.updateStatus(event.request_id, 'rejected', {
          error: event.error_message || 'Execution rejected',
          route: ['execution'],
          processedCategories: ['execution'],
        });
      };

      const onInconclusive = (event: ExecutionEvent) => {
        if (!event.request_id) return;
        this.updateStatus(event.request_id, 'inconclusive', {
          error: event.error_message || 'Execution inconclusive',
          route: ['execution'],
          processedCategories: ['execution'],
        });
      };

      this.executionUnsubscribers.push(
        bus.subscribe('execution.completed', onCompleted),
        bus.subscribe('execution.failed', onFailed),
        bus.subscribe('execution.rejected', onRejected),
        bus.subscribe('execution.inconclusive', onInconclusive)
      );
    } catch (e) {
      systemLogger.warn('SYSTEM', 'coreResultService: ExecutionEventBus bridge initialization skipped', { e });
    }
  }
}

export const coreResultService = new CoreResultService();
