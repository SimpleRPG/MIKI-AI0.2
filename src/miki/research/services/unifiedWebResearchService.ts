import { autonomousSearchService } from './autonomousSearchService';
import type { AutonomousSearchConfig } from './autonomousSearchService';
import { researchQueryPlanningService } from './researchQueryPlanningService';

export * from './autonomousSearchService';

export class UnifiedWebResearchService {
  private static instance: UnifiedWebResearchService;

  private constructor() {}

  public static getInstance(): UnifiedWebResearchService {
    if (!this.instance) this.instance = new UnifiedWebResearchService();
    return this.instance;
  }

  public async executeSearch(
    query: string,
    options?: Parameters<typeof autonomousSearchService.executeSearch>[1],
  ) {
    const normalized = String(query || '').trim();
    if (!normalized) throw new Error('RESEARCH_QUERY_REQUIRED');

    const plan = researchQueryPlanningService.buildPlan(normalized);
    const plannedQuery =
      plan.status === 'READY'
        ? plan.queries.find(q => q.intentType === 'BASELINE')?.queryText ||
          plan.queries[0]?.queryText ||
          normalized
        : normalized;

    return autonomousSearchService.executeSearch(plannedQuery, options);
  }

  public getConfig(): AutonomousSearchConfig {
    return autonomousSearchService.getConfig();
  }

  public setConfig(config: AutonomousSearchConfig) {
    return autonomousSearchService.setConfig(config);
  }

  public learnFromSearch(
    ...args: Parameters<typeof autonomousSearchService.learnFromSearch>
  ) {
    return autonomousSearchService.learnFromSearch(...args);
  }

  public getStats() {
    return autonomousSearchService.getStats();
  }
}

export const unifiedWebResearchService =
  UnifiedWebResearchService.getInstance();
