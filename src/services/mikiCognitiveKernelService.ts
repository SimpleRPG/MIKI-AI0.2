/**
 * MIKI v85 — 共通認知カーネル
 *
 * 会話/RPG/研究/コード/システムを別AIとして扱わず、同一の認知ループへ束ねる。
 * 通常経路は完全NON_LLM_ONLY。外部Geminiは教師/証拠経路としてのみ別サービスから利用する。
 */
import { integratedCognitionControllerService, CognitiveDecision } from './chapter69_90PlatformServices';
import { unifiedMikiExperienceService, UnifiedExperienceDomain } from './unifiedMikiExperienceService';
import { mikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';
import { operationalConformanceService } from './operationalConformanceService';

export type MikiDomain = 'conversation'|'rpg'|'research'|'code'|'data'|'system'|'task';
export interface CognitiveCycleInput {
  domain: MikiDomain;
  input: string;
  importance?: number;
  uncertainty?: number;
  irreversible?: boolean;
  privacy?: boolean;
  hasCode?: boolean;
  hasData?: boolean;
  needsFresh?: boolean;
  capabilityIds?: string[];
}
export interface CognitiveCycleResult {
  traceId: string;
  decision: CognitiveDecision;
  uncertaintyAction: string;
  recordedExperience: boolean;
  terminal: ReturnType<typeof operationalConformanceService.terminal>;
}

let seq = 0;
const id = (prefix:string) => `${prefix}-${++seq}-${Date.now().toString(36)}`;

class MikiCognitiveKernelService {
  cycle(input: CognitiveCycleInput): CognitiveCycleResult {
    const traceId = id('miki-trace');
    const decision = integratedCognitionControllerService.decide(input);
    const uncertainty = operationalConformanceService.classifyUncertainty({
      kind: (input.uncertainty ?? 0) >= .8 ? 'INSUFFICIENT_EVIDENCE' : 'REQUIREMENT',
      magnitude: Math.max(0, Math.min(1, input.uncertainty ?? 0)),
      decisive: (input.uncertainty ?? 0) >= .8,
      evidence: input.input.trim() ? ['USER_INPUT'] : [],
    });

    operationalConformanceService.trace(traceId, {
      stage: 'INTENT', type: 'cognitive_cycle', referenceIds: input.capabilityIds ?? [],
      stateChanges: [`DOMAIN:${input.domain}`, `ACTION:${uncertainty.action}`],
      retry: 0, metrics: { uncertainty: input.uncertainty ?? 0 }, privacyMode: input.privacy ? 'REDACTED' : 'HASHED',
    });

    let recordedExperience = false;
    const unifiedDomain: UnifiedExperienceDomain =
      input.domain === 'data' || input.domain === 'task' ? 'execution' : input.domain;
    try {
      unifiedMikiExperienceService.observe({
        domain: unifiedDomain,
        action: 'cognitive_cycle',
        input: input.input.slice(0, 500),
        outcome: uncertainty.action === 'EXECUTE' ? 'SUCCESS' : 'BLOCKED',
        verified: false,
        capabilityIds: input.capabilityIds ?? [],
        lesson: `共通認知カーネル: ${decision.route.join('→')}; uncertainty=${uncertainty.action}`,
      });
      recordedExperience = true;
    } catch { /* 学習記録失敗は回答経路を停止させない */ }

    if (recordedExperience) {
      try {
        mikiUnifiedLearningContinuumService.observe({
          domain: unifiedDomain,
          action: 'cognitive_cycle',
          input: input.input.slice(0, 500),
          outcome: 'SUCCESS', verified: false,
          capabilityIds: input.capabilityIds ?? [],
          lesson: `同一Miki認知ループ: ${decision.route.join(',')}`,
        });
      } catch { /* best effort */ }
    }

    const terminal = operationalConformanceService.terminal({
      traceId,
      budget: { maxSteps: 8, maxReplans: 2, maxToolRetries: 2, maxDuplicateSearches: 2, maxRuntimeMs: 30000, maxStateChanges: 16 },
      steps: 1, replans: 0, toolRetries: 0, runtimeMs: 0, stateChanges: 1,
      before: { evidence: 0, state: 0, artifacts: 0, candidatesReduced: 0 },
      after: { evidence: recordedExperience ? 1 : 0, state: 1, artifacts: 0, candidatesReduced: decision.route.length > 1 ? 1 : 0 },
      userInput: uncertainty.action === 'ASK_MINIMAL',
      capabilityLimit: uncertainty.action === 'HOMEWORK',
    });
    return { traceId, decision, uncertaintyAction: uncertainty.action, recordedExperience, terminal };
  }

  status() {
    return { runtimePolicy: 'NON_LLM_ONLY', unifiedDomains: ['conversation','rpg','research','code','data','system','task'], loop: ['intent','route','evidence','execute','evaluate','learn'], localLlmRuntime: false };
  }
}

export const mikiCognitiveKernelService = new MikiCognitiveKernelService();
