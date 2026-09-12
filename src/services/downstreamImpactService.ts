import { executionEventBusService } from './executionEventBusService';
import { taskCaseMemoryService } from './taskCaseMemoryService';
import { capabilityReuseService } from './capabilityReuseService';
import { experienceFreshnessService } from './experienceFreshnessService';

export interface DownstreamImpact {
  component_id: string;
  usage_count: number;
  downstream_failure_count: number;
  downstream_success_count: number;
  rework_signal: number;
  propagation_risk: number;
  impact_score: number;
}

/** 13.5: 単体成功率ではなく、その部品を使った後工程の実績を選択へ反映する。 */
export class DownstreamImpactService {
  private static instance: DownstreamImpactService;
  private constructor() {}
  public static getInstance(): DownstreamImpactService { return this.instance || (this.instance = new DownstreamImpactService()); }

  public assess(componentId: string, environment: string): DownstreamImpact {
    const relevant = executionEventBusService.list().filter(e => e.component_id === componentId && e.environment === environment);
    const reuse = capabilityReuseService.list().filter(r => r.environment === environment && r.component_ids.includes(componentId));
    const cases = taskCaseMemoryService.list().filter(c => c.environment === environment && c.component_ids.includes(componentId));
    const downstreamFailures = relevant.filter(e => e.type === 'execution.failed').length + cases.filter(c => c.outcome === 'FAILURE').length;
    const downstreamSuccesses = relevant.filter(e => e.type === 'execution.completed').length + cases.filter(c => c.outcome === 'SUCCESS').length;
    const usage = Math.max(relevant.length, reuse.length, cases.length);
    const failureRate = (downstreamFailures + downstreamSuccesses) ? downstreamFailures / (downstreamFailures + downstreamSuccesses) : 0;
    const reworkSignal = Math.min(100, cases.filter(c => c.outcome === 'FAILURE').length * 15);
    const propagationRisk = Math.min(100, failureRate * 70 + reworkSignal * 0.3);
    const freshness = experienceFreshnessService.evaluate(relevant.reduce((m, e) => Math.max(m, e.created_at), 0) || undefined, propagationRisk);
    const impactScore = Math.min(100, usage * 8 + propagationRisk * 0.35 + (100 - freshness.freshness_score) * 0.15);
    return { component_id: componentId, usage_count: usage, downstream_failure_count: downstreamFailures, downstream_success_count: downstreamSuccesses, rework_signal: reworkSignal, propagation_risk: Math.round(propagationRisk * 100) / 100, impact_score: Math.round(impactScore * 100) / 100 };
  }
}
export const downstreamImpactService = DownstreamImpactService.getInstance();
