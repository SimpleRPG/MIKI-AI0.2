import { coreTaskIngressService } from '../services/coreTaskIngressService';
import { autonomousSearchService, type AutonomousSearchConfig, type AutonomousSearchStats } from '../../research/services/autonomousSearchService';
import { bannedTopicsConfigService, type BannedTopicsConfig } from '../../safety/services/bannedTopicsConfigService';
import { nativeWorkManagerService } from '../../execution/services/nativeWorkManagerService';
import { getSearxngBaseUrlItem, setSearxngBaseUrlItem } from '../../../services/api';
import type { AutonomousSearchLearningRecord } from '../../../types';
import { externalAiResearchBundleService, type ExternalAiProvider, type ExternalAiResearchBundle } from '../../research/services/externalAiResearchBundleService';

export interface ResearchUiSnapshot {
  config: AutonomousSearchConfig;
  stats: AutonomousSearchStats;
  records: AutonomousSearchLearningRecord[];
  bannedTopics: BannedTopicsConfig;
  searxngUrl: string;
  androidNative: boolean;
}

class TypedResearchUiGatewayService {
  public snapshot(limit = 20): ResearchUiSnapshot {
    return {
      config: autonomousSearchService.getConfig(),
      stats: autonomousSearchService.getStats(),
      records: autonomousSearchService.getRecentRecords(limit),
      bannedTopics: bannedTopicsConfigService.getConfig(),
      searxngUrl: getSearxngBaseUrlItem(),
      androidNative: nativeWorkManagerService.isAndroidNative(),
    };
  }

  private async authorize(operation: string, payload: Record<string, unknown>): Promise<string> {
    const result = await coreTaskIngressService.submit({
      kind: 'USER_REQUEST',
      goal: `Research UI requested ${operation}`,
      source: 'conversation',
      payload: { operation, ...payload, sourceScreenId: 'AutonomousSearchTab' },
      maxCycles: 18,
    });
    if (result.task.status !== 'COMPLETED') {
      throw new Error(`CORE_COMPLETION_REQUIRED:${result.task.status}`);
    }
    return result.task.taskId;
  }

  public async saveSearchConfig(patch: Partial<AutonomousSearchConfig>): Promise<AutonomousSearchConfig> {
    await this.authorize('SAVE_AUTONOMOUS_SEARCH_CONFIG', { patch });
    return autonomousSearchService.saveConfig(patch);
  }

  public async setBannedTopicsEnabled(enabled: boolean): Promise<BannedTopicsConfig> {
    await this.authorize('SET_BANNED_TOPICS_ENABLED', { enabled });
    bannedTopicsConfigService.setEnabled(enabled);
    return bannedTopicsConfigService.getConfig();
  }

  public async addBannedTopic(topic: string): Promise<{ added: boolean; config: BannedTopicsConfig }> {
    await this.authorize('ADD_BANNED_TOPIC', { topic });
    const added = bannedTopicsConfigService.addTopic(topic);
    return { added, config: bannedTopicsConfigService.getConfig() };
  }

  public async removeBannedTopic(topic: string): Promise<BannedTopicsConfig> {
    await this.authorize('REMOVE_BANNED_TOPIC', { topic });
    bannedTopicsConfigService.removeTopic(topic);
    return bannedTopicsConfigService.getConfig();
  }

  public async resetBannedTopics(): Promise<BannedTopicsConfig> {
    await this.authorize('RESET_BANNED_TOPICS', {});
    bannedTopicsConfigService.resetToDefault();
    return bannedTopicsConfigService.getConfig();
  }

  public async saveSearxngUrl(url: string): Promise<void> {
    await this.authorize('SAVE_SEARXNG_URL', { configured: Boolean(url.trim()) });
    setSearxngBaseUrlItem(url.trim());
  }

  public async executeSearch(query: string, options: Parameters<typeof autonomousSearchService.executeSearch>[1]) {
    await this.authorize('EXECUTE_AUTONOMOUS_SEARCH', { query, options });
    return autonomousSearchService.executeSearch(query, options);
  }

  public async learnFromSearch(...args: Parameters<typeof autonomousSearchService.learnFromSearch>) {
    await this.authorize('LEARN_FROM_SEARCH_OUTCOME', { query: args[0] });
    return autonomousSearchService.learnFromSearch(...args);
  }

  public async performIdleLearning() {
    await this.authorize('RUN_IDLE_RESEARCH_LEARNING', {});
    return autonomousSearchService.performIdleAutonomousLearning();
  }

  public async fetchRenderedPage(url: string, options: Parameters<typeof autonomousSearchService.fetchRenderedPage>[1]) {
    await this.authorize('FETCH_RENDERED_RESEARCH_PAGE', { url, options });
    return autonomousSearchService.fetchRenderedPage(url, options);
  }
  public listExternalAiResearchBundles(): ExternalAiResearchBundle[] {
    return externalAiResearchBundleService.list();
  }

  public getExternalAiResearchBundle(bundleId: string): ExternalAiResearchBundle | undefined {
    return externalAiResearchBundleService.get(bundleId);
  }

  public async buildExternalAiResearchBundles(provider: ExternalAiProvider = 'GEMINI'): Promise<ExternalAiResearchBundle[]> {
    await this.authorize('BUILD_EXTERNAL_AI_RESEARCH_BUNDLES', { provider });
    return externalAiResearchBundleService.buildFromOpenGaps(provider);
  }

  public async sendExternalAiResearchBundle(bundleId: string): Promise<ExternalAiResearchBundle | undefined> {
    await this.authorize('SEND_EXTERNAL_AI_RESEARCH_BUNDLE', { bundleId });
    return externalAiResearchBundleService.sendAutomatically(bundleId);
  }

  public async importExternalAiResearchResponse(bundleId: string, responseText: string): Promise<ExternalAiResearchBundle | undefined> {
    await this.authorize('IMPORT_EXTERNAL_AI_RESEARCH_RESPONSE', {
      bundleId,
      responseLength: responseText.length,
    });
    return externalAiResearchBundleService.importResponse(bundleId, responseText, 'MANUAL');
  }

  public getExternalAiResearchPrompt(bundleId: string): string | undefined {
    return externalAiResearchBundleService.copyText(bundleId);
  }

  public exportExternalAiResearchPrompt(bundleId: string): { fileName: string; content: string } | undefined {
    return externalAiResearchBundleService.exportPromptText(bundleId);
  }

  public exportExternalAiResearchResponseTemplate(bundleId: string): { fileName: string; content: string } | undefined {
    return externalAiResearchBundleService.exportResponseTemplate(bundleId);
  }

}

export const typedResearchUiGatewayService = new TypedResearchUiGatewayService();
export type { AutonomousSearchConfig, AutonomousSearchStats, AutonomousSearchLearningRecord, BannedTopicsConfig };
