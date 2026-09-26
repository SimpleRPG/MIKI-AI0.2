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

  public async executePlannedSearch(query:string, options?:Parameters<typeof autonomousSearchService.executeSearch>[1]) {
    const normalized=String(query||"").trim();
    if(!normalized) throw new Error("RESEARCH_QUERY_REQUIRED");
    return autonomousSearchService.executeSearch(normalized, options);
  }

  public getConfig(): AutonomousSearchConfig {
    return autonomousSearchService.getConfig();
  }

  public saveConfig(config: Partial<AutonomousSearchConfig>) {
    return autonomousSearchService.saveConfig(config);
  }

  public updateConfig(config: Partial<AutonomousSearchConfig>) {
    return autonomousSearchService.updateConfig(config);
  }

  public getStats() {
    return autonomousSearchService.getStats();
  }

  public getRecentRecords(limit = 20) {
    return autonomousSearchService.getRecentRecords(limit);
  }

  public detectNeedForSearch(userText: string) {
    return autonomousSearchService.detectNeedForSearch(userText);
  }

  public learnFromSearch(
    ...args: Parameters<typeof autonomousSearchService.learnFromSearch>
  ) {
    return autonomousSearchService.learnFromSearch(...args);
  }

  public performIdleAutonomousLearning(
    ...args: Parameters<typeof autonomousSearchService.performIdleAutonomousLearning>
  ) {
    return autonomousSearchService.performIdleAutonomousLearning(...args);
  }

  public fetchRenderedPage(
    ...args: Parameters<typeof autonomousSearchService.fetchRenderedPage>
  ) {
    return autonomousSearchService.fetchRenderedPage(...args);
  }

  public readSearchResultPages(
    ...args: Parameters<typeof autonomousSearchService.readSearchResultPages>
  ) {
    return autonomousSearchService.readSearchResultPages(...args);
  }
}

export const unifiedWebResearchService =
  UnifiedWebResearchService.getInstance();
