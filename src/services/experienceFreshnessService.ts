import { storageService } from './storageService';

export interface ExperienceFreshness {
  age_ms: number;
  freshness_score: number;
  stale: boolean;
  revalidation_priority: number;
  reason: string;
}

/** 8.4/13.5/14.4: 古い成功・失敗経験を無条件に現在の事実として扱わないための鮮度層。 */
export class ExperienceFreshnessService {
  private static instance: ExperienceFreshnessService;
  private readonly halfLifeMs = 30 * 24 * 60 * 60 * 1000;
  private constructor() {}
  public static getInstance(): ExperienceFreshnessService { return this.instance || (this.instance = new ExperienceFreshnessService()); }

  public evaluate(observedAt?: number, impactScore = 0): ExperienceFreshness {
    const age = observedAt ? Math.max(0, Date.now() - observedAt) : Number.POSITIVE_INFINITY;
    const freshness = Number.isFinite(age) ? Math.max(0, Math.min(100, 100 * Math.pow(0.5, age / this.halfLifeMs))) : 0;
    const stale = freshness < 35;
    const revalidationPriority = Math.max(0, Math.min(100, (100 - freshness) * 0.7 + impactScore * 0.3));
    return {
      age_ms: age,
      freshness_score: Math.round(freshness * 100) / 100,
      stale,
      revalidation_priority: Math.round(revalidationPriority * 100) / 100,
      reason: stale ? '経験が古いため再検証を優先' : '経験は現時点で利用可能な鮮度',
    };
  }

  public shouldRevalidate(observedAt?: number, impactScore = 0): boolean {
    return this.evaluate(observedAt, impactScore).stale || this.evaluate(observedAt, impactScore).revalidation_priority >= 70;
  }

  public markRevalidationRequest(key: string, reason: string): void {
    try { storageService.setItem(`miki_revalidation_${key}`, JSON.stringify({ key, reason, requested_at: Date.now() })); } catch {}
  }
}
export const experienceFreshnessService = ExperienceFreshnessService.getInstance();
