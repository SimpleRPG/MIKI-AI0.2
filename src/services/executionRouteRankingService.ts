import { componentRegistryService } from './componentRegistryService';
import { capabilityReuseService } from './capabilityReuseService';
import { failureMemoryService } from './failureMemoryService';
import { componentVersionHistoryService } from './componentVersionHistoryService';
import { downstreamImpactService } from './downstreamImpactService';
import { experienceFreshnessService } from './experienceFreshnessService';
import { executionEventBusService } from './executionEventBusService';

export interface ExecutionRouteScore {
  component_id: string;
  score: number;
  success_rate: number;
  risk_score: number;
  latency_score: number;
  reuse_score: number;
  stability_score: number;
  impact_score: number;
  reason: string;
}

/**
 * 実行経路を「実績・失敗・速度・再利用・安定性・下流影響」の6軸で決定論的に順位付けする。
 * これは予測値であり、検証済み/真実の判定には使わない。
 */
export class ExecutionRouteRankingService {
  private static instance: ExecutionRouteRankingService;
  private constructor() {}
  public static getInstance(): ExecutionRouteRankingService {
    return this.instance || (this.instance = new ExecutionRouteRankingService());
  }

  public rank(componentIds: string[], environment: string): ExecutionRouteScore[] {
    return componentIds.map(id => this.score(id, environment))
      .sort((a, b) => b.score - a.score || a.component_id.localeCompare(b.component_id));
  }

  public score(componentId: string, environment: string): ExecutionRouteScore {
    const component = componentRegistryService.getComponent(componentId);
    if (!component) {
      return { component_id: componentId, score: -1000, success_rate: 0, risk_score: 100, latency_score: 0, reuse_score: 0, stability_score: 0, impact_score: 0, reason: 'Component不存在' };
    }

    const total = Math.max(0, component.success_count + component.failure_count);
    const successRate = total ? component.success_count / total : 0.5;
    const risk = failureMemoryService.assessRisk(componentId, environment, component.implementation_hash).risk_score;

    const reuse = capabilityReuseService.list().filter(r =>
      r.environment === environment && r.component_ids.includes(componentId) &&
      r.implementation_hashes[componentId] === component.implementation_hash
    );
    const durations = reuse.map(r => r.duration_ms).filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0);
    const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : undefined;
    const latencyScore = avgDuration === undefined ? 50 : Math.max(0, Math.min(100, 100 - Math.log10(1 + avgDuration) * 25));
    const reuseScore = Math.min(100, reuse.length * 12);
    const stabilityScore = component.status === 'VERIFIED' && componentVersionHistoryService.isCurrent(componentId, component.version, component.implementation_hash) ? 100 : 25;

    // 下流影響の近似: 多く再利用されているComponentほど影響範囲が大きい。
    // 影響が大きい部品は安定性を強く要求するため、成功率に連動した保守的な補正を行う。
    const downstream = downstreamImpactService.assess(componentId, environment);
    const impactScore = downstream.impact_score;
    const latestObserved = Math.max(...executionRouteRankingServiceEvents(componentId), 0);
    const freshness = experienceFreshnessService.evaluate(latestObserved || undefined, impactScore);
    const impactPenalty = (impactScore / 100) * (1 - successRate) * 30;

    const score =
      successRate * 45 +
      (100 - risk) * 0.25 +
      latencyScore * 0.10 +
      reuseScore * 0.05 +
      stabilityScore * 0.10 +
      impactScore * 0.05 +
      freshness.freshness_score * 0.05 -
      impactPenalty;

    const reason = `鮮度=${freshness.freshness_score.toFixed(1)} 再検証優先度=${freshness.revalidation_priority.toFixed(1)} 下流失敗=${downstream.downstream_failure_count} 下流成功=${downstream.downstream_success_count} 成功率=${(successRate * 100).toFixed(1)}% risk=${risk} latency=${latencyScore.toFixed(1)} reuse=${reuse.length} stability=${stabilityScore} impact=${impactScore}`;
    return { component_id: componentId, score: Math.max(-100, Math.min(100, score)), success_rate: successRate, risk_score: risk, latency_score: latencyScore, reuse_score: reuseScore, stability_score: stabilityScore, impact_score: impactScore, reason };
  }
}

function executionRouteRankingServiceEvents(componentId: string): number[] {
  return executionEventBusService.list().filter(e => e.component_id === componentId && (e.type === 'execution.completed' || e.type === 'execution.failed')).map(e => e.created_at);
}

export const executionRouteRankingService = ExecutionRouteRankingService.getInstance();
