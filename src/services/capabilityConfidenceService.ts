import { componentRegistryService } from './componentRegistryService';
import { executionEventBusService, ExecutionEvent } from './executionEventBusService';
import { experienceFreshnessService } from './experienceFreshnessService';
import { failureMemoryService } from './failureMemoryService';

export interface CapabilityConfidence {
  componentId: string;
  environment?: string;
  confidence: number;
  successRate: number;
  verificationScore: number;
  freshnessScore: number;
  environmentScore: number;
  implementationHashScore: number;
  failureRisk: number;
  stale: boolean;
  revalidationRequired: boolean;
  sampleCount: number;
  successes: number;
  failures: number;
  latestObservedAt?: number;
  currentImplementationHash?: string;
  observedImplementationHash?: string;
  reason: string;
}

/**
 * Ability trust layer: execution history, verification state, environment,
 * implementation hash and time freshness are combined without changing
 * Component VERIFIED state. Stale evidence loses its ranking influence.
 */
export class CapabilityConfidenceService {
  private static instance: CapabilityConfidenceService;
  private readonly halfLifeMs = 30 * 24 * 60 * 60 * 1000;

  private constructor() {}
  public static getInstance(): CapabilityConfidenceService {
    return this.instance || (this.instance = new CapabilityConfidenceService());
  }

  public evaluate(componentId: string, environment?: string): CapabilityConfidence {
    const component = componentRegistryService.getComponent(componentId);
    const events = executionEventBusService.list()
      .filter(e => e.component_id === componentId && (e.type === 'execution.completed' || e.type === 'execution.failed'))
      .sort((a, b) => b.created_at - a.created_at);
    const scoped = environment ? events.filter(e => this.environmentMatches(e.environment, environment)) : events;
    const samples = scoped.length ? scoped : events;
    const successes = samples.filter(e => e.type === 'execution.completed' && e.passed !== false).length;
    const failures = samples.filter(e => e.type === 'execution.failed' || e.passed === false).length;
    const sampleCount = successes + failures;
    const successRate = sampleCount ? successes / sampleCount : 0.5;
    const latest = samples[0];
    const freshness = experienceFreshnessService.evaluate(latest?.created_at, failures > successes ? 70 : 20);
    const currentHash = component?.implementation_hash;
    const observedHash = latest?.implementation_hash;
    const hashCurrent = !!currentHash && !!observedHash && currentHash === observedHash;
    const hashScore = !latest ? 50 : hashCurrent ? 100 : 0;
    const verificationScore = component?.status === 'VERIFIED' ? 100 : (component?.status as string) === 'DEVICE_VERIFIED' ? 90 : 0;
    const environmentScore = environment
      ? (samples.length > 0 ? 100 : events.length > 0 ? 20 : 50)
      : 100;
    const risk = environment && component
      ? failureMemoryService.assessRisk(componentId, environment, currentHash || '').risk_score
      : 0;

    // Weighted confidence is intentionally conservative: verification alone
    // cannot compensate for a stale hash or a high observed failure risk.
    let confidence = successRate * 45 + verificationScore * 0.2 + freshness.freshness_score * 0.15 + environmentScore * 0.1 + hashScore * 0.1;
    if (risk >= 60) confidence -= Math.min(35, (risk - 59) * 0.8);
    if (latest && !hashCurrent) confidence = Math.min(confidence, 35);
    if (freshness.stale) confidence = Math.min(confidence, 45);
    confidence = Math.max(0, Math.min(100, confidence));

    const stale = freshness.stale || (!!latest && !hashCurrent);
    const revalidationRequired = stale || freshness.revalidation_priority >= 70 || risk >= 60;
    if (revalidationRequired) {
      experienceFreshnessService.markRevalidationRequest(
        this.key(componentId, environment),
        !hashCurrent && latest ? 'implementation hash changed since observed evidence' : freshness.reason,
      );
    }

    return {
      componentId,
      environment,
      confidence: Math.round(confidence * 100) / 100,
      successRate: Math.round(successRate * 10000) / 10000,
      verificationScore,
      freshnessScore: freshness.freshness_score,
      environmentScore,
      implementationHashScore: hashScore,
      failureRisk: risk,
      stale,
      revalidationRequired,
      sampleCount,
      successes,
      failures,
      latestObservedAt: latest?.created_at,
      currentImplementationHash: currentHash,
      observedImplementationHash: observedHash,
      reason: revalidationRequired
        ? '検証状態は保持したまま、古い証拠・環境差・実装変更・失敗リスクを理由に再検証を要求'
        : '検証状態、成功実績、環境、実装hash、経験鮮度が現在の再利用条件を満たす',
    };
  }

  public rank(componentIds: string[], environment?: string): Map<string, CapabilityConfidence> {
    const result = new Map<string, CapabilityConfidence>();
    for (const id of componentIds) result.set(id, this.evaluate(id, environment));
    return result;
  }

  public boost(componentId: string, environment?: string): number {
    const c = this.evaluate(componentId, environment);
    if (c.revalidationRequired) return 0;
    return Math.max(0, (c.confidence - 50) * 0.8);
  }

  public findRelevant(query: string, environment?: string, limit = 12): CapabilityConfidence[] {
    const tokens = this.tokens(query);
    return componentRegistryService.getAllComponents()
      .filter(c => c.status === 'VERIFIED')
      .map(c => ({ c, score: this.overlap(tokens, this.tokens(`${c.component_id} ${c.purpose} ${c.entry_point}`)), confidence: this.evaluate(c.component_id, environment) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.confidence.confidence - a.confidence.confidence || b.score - a.score)
      .slice(0, limit)
      .map(x => x.confidence);
  }

  private environmentMatches(observed: string, requested: string): boolean {
    const a = observed.toLowerCase();
    const b = requested.toLowerCase();
    if (a === b) return true;
    if (b === 'android') return /android|galaxy/.test(a);
    if (b === 'termux') return /termux|android/.test(a);
    if (b === 'excel_windows') return /excel|windows/.test(a) && !/mac/.test(a);
    if (b === 'excel_mac') return /excel|mac/.test(a) && /mac/.test(a);
    if (b === 'external_runner') return /external|runner|http/.test(a);
    return a.includes(b) || b.includes(a);
  }

  private key(id: string, environment?: string): string { return `${id}|${environment || 'any'}`; }
  private tokens(text: string): string[] { return text.toLowerCase().split(/[^a-z0-9_\u3040-\u30ff\u3400-\u9fff]+/).filter(x => x.length >= 2).slice(0, 60); }
  private overlap(a: string[], b: string[]): number { const set = new Set(b); return a.reduce((n, x) => n + (set.has(x) ? 1 : 0), 0); }
}

export const capabilityConfidenceService = CapabilityConfidenceService.getInstance();
