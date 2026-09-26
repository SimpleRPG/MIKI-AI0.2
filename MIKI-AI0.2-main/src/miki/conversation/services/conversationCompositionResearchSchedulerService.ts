import { ClaimRecord } from '../../../types';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { resourceGovernanceService } from '../../safety/services/resourceGovernanceService';
import { conversationComponentCompositionService } from './conversationComponentCompositionService';

export interface ConversationCompositionResearchConfig {
  enabled: boolean;
  intervalMinutes: number;
  maxCombinationsPerCycle: number;
  requireIdleOrCharging: boolean;
}

export interface ConversationCompositionResearchState {
  running: boolean;
  lastStartedAt?: number;
  lastCompletedAt?: number;
  lastReason?: string;
  researchedSignatures: string[];
  generatedCandidateIds: string[];
  totalExamined: number;
  totalGenerated: number;
}

export interface ConversationCompositionResearchCycleResult {
  started: boolean;
  reason: string;
  examined: number;
  generated: number;
  candidateIds: string[];
}

type TemplateId = 'conv.reasoning.comparison' | 'conv.reasoning.causality' | 'conv.reasoning.conditional';

const CONFIG_KEY = 'miki_conversation_composition_research_config_v1';
const STATE_KEY = 'miki_conversation_composition_research_state_v1';
const DEFAULT_CONFIG: ConversationCompositionResearchConfig = {
  enabled: true,
  intervalMinutes: 180,
  maxCombinationsPerCycle: 8,
  requireIdleOrCharging: true,
};
const TEMPLATES: TemplateId[] = ['conv.reasoning.comparison', 'conv.reasoning.causality', 'conv.reasoning.conditional'];
const SURFACES = ['conv.surface.variation.recommendation', 'conv.surface.variation.general_answer'];
const MAX_RESEARCHED_SIGNATURES = 10000;
const MAX_CANDIDATE_IDS = 1000;

function pairSignature(claimA: ClaimRecord, claimB: ClaimRecord, templateId: TemplateId, surfaceId: string): string {
  const claims = [claimA.claim_id, claimB.claim_id].sort();
  return `${claims[0]}|${claims[1]}|${templateId}|${surfaceId}`;
}

class ConversationCompositionResearchSchedulerService {
  private config: ConversationCompositionResearchConfig = { ...DEFAULT_CONFIG };
  private state: ConversationCompositionResearchState = {
    running: false,
    researchedSignatures: [],
    generatedCandidateIds: [],
    totalExamined: 0,
    totalGenerated: 0,
  };
  private timerId: ReturnType<typeof setInterval> | undefined;
  private initialized = false;

  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.load();
    conversationComponentCompositionService.initialize();
    resourceGovernanceService.initialize();
    this.restartTimer();
    setTimeout(() => { void this.runCycle('INITIAL_BACKGROUND_SCAN'); }, 30000);
  }

  public dispose(): void {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = undefined;
    this.initialized = false;
  }

  public getConfig(): ConversationCompositionResearchConfig {
    return { ...this.config };
  }

  public setConfig(update: Partial<ConversationCompositionResearchConfig>): ConversationCompositionResearchConfig {
    this.config = {
      enabled: update.enabled ?? this.config.enabled,
      intervalMinutes: Math.max(15, Math.min(10080, update.intervalMinutes ?? this.config.intervalMinutes)),
      maxCombinationsPerCycle: Math.max(1, Math.min(50, update.maxCombinationsPerCycle ?? this.config.maxCombinationsPerCycle)),
      requireIdleOrCharging: update.requireIdleOrCharging ?? this.config.requireIdleOrCharging,
    };
    storageService.setItem(CONFIG_KEY, JSON.stringify(this.config));
    this.restartTimer();
    return this.getConfig();
  }

  public getState(): ConversationCompositionResearchState {
    return { ...this.state, researchedSignatures: [...this.state.researchedSignatures], generatedCandidateIds: [...this.state.generatedCandidateIds] };
  }

  public async runCycle(trigger = 'SCHEDULED'): Promise<ConversationCompositionResearchCycleResult> {
    if (!this.config.enabled) return this.skip('DISABLED');
    if (this.state.running) return this.skip('ALREADY_RUNNING');
    await resourceGovernanceService.refresh();
    if (!resourceGovernanceService.canRunComponentTests() || !resourceGovernanceService.canRunBackgroundIndexing()) return this.skip('RESOURCE_GOVERNANCE_BLOCKED');
    if (this.config.requireIdleOrCharging && !(await this.isIdleOrCharging())) return this.skip('NOT_IDLE_OR_CHARGING');

    this.state.running = true;
    this.state.lastStartedAt = Date.now();
    this.state.lastReason = trigger;
    this.saveState();
    try {
      conversationComponentCompositionService.syncComponentsToRegistry();
      const claims = claimDatabaseService.listClaims({ excludeSuperseded: true })
        .filter(claim => claim.status === 'SUPPORTED' || claim.status === 'DEVICE_VERIFIED' || (claim.maturity === 'MATURE' && claim.status !== 'FALSE'))
        .sort((left, right) => left.claim_id.localeCompare(right.claim_id));
      const researched = new Set(this.state.researchedSignatures);
      const candidateIds: string[] = [];
      let examined = 0;
      let generated = 0;

      outer: for (let leftIndex = 0; leftIndex < claims.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < claims.length; rightIndex += 1) {
          for (const templateId of TEMPLATES) {
            for (const surfaceId of SURFACES) {
              const signature = pairSignature(claims[leftIndex], claims[rightIndex], templateId, surfaceId);
              if (researched.has(signature)) continue;
              researched.add(signature);
              examined += 1;
              const result = conversationComponentCompositionService.composeConversation({
                goal: `background-conversation-research:${claims[leftIndex].claim_id}:${claims[rightIndex].claim_id}`,
                claimA: claims[leftIndex],
                claimB: claims[rightIndex],
                templateId,
                surfaceId,
              });
              if (result.success && result.composedResponse) {
                generated += 1;
                candidateIds.push(result.composedResponse.id);
              }
              if (examined >= this.config.maxCombinationsPerCycle) break outer;
            }
          }
        }
      }

      this.state.researchedSignatures = [...researched].slice(-MAX_RESEARCHED_SIGNATURES);
      this.state.generatedCandidateIds = [...new Set([...this.state.generatedCandidateIds, ...candidateIds])].slice(-MAX_CANDIDATE_IDS);
      this.state.totalExamined += examined;
      this.state.totalGenerated += generated;
      this.state.lastCompletedAt = Date.now();
      this.state.lastReason = examined === 0 ? 'NO_UNRESEARCHED_COMBINATIONS' : `COMPLETED:${trigger}`;
      this.saveState();
      systemLogger.info('SELF_IMPROVEMENT', `[ConversationResearch] examined=${examined}, generated=${generated}, trigger=${trigger}`);
      return { started: true, reason: this.state.lastReason, examined, generated, candidateIds };
    } catch (error) {
      this.state.lastReason = `FAILED:${error instanceof Error ? error.message : String(error)}`;
      this.saveState();
      systemLogger.error('SELF_IMPROVEMENT', `[ConversationResearch] ${this.state.lastReason}`);
      return { started: true, reason: this.state.lastReason, examined: 0, generated: 0, candidateIds: [] };
    } finally {
      this.state.running = false;
      this.saveState();
    }
  }

  private restartTimer(): void {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = undefined;
    if (!this.config.enabled) return;
    this.timerId = setInterval(() => { void this.runCycle('SCHEDULED'); }, this.config.intervalMinutes * 60000);
  }

  private async isIdleOrCharging(): Promise<boolean> {
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (hidden) return true;
    try {
      const getBattery = (navigator as unknown as { getBattery?: () => Promise<{ charging?: boolean }> }).getBattery;
      if (getBattery) return Boolean((await getBattery.call(navigator)).charging);
    } catch {
      return false;
    }
    return false;
  }

  private skip(reason: string): ConversationCompositionResearchCycleResult {
    this.state.lastReason = reason;
    this.saveState();
    return { started: false, reason, examined: 0, generated: 0, candidateIds: [] };
  }

  private load(): void {
    try {
      const config = storageService.getItem(CONFIG_KEY);
      if (config) this.config = { ...DEFAULT_CONFIG, ...JSON.parse(config) };
      const state = storageService.getItem(STATE_KEY);
      if (state) this.state = { ...this.state, ...JSON.parse(state), running: false };
    } catch {
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  private saveState(): void {
    storageService.setItem(STATE_KEY, JSON.stringify(this.state));
  }
}

export const conversationCompositionResearchSchedulerService = new ConversationCompositionResearchSchedulerService();
