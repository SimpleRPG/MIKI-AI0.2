/**
 * Legacy cognition API compatibility adapter.
 *
 * The legacy 7-area cognition controller is retired as an execution authority.
 * This adapter keeps the old HTTP surface usable while every request enters the
 * single CORE + 17 classification architecture and returns the CORE result.
 */
import { coreTaskIngressService } from '../../core/services/coreTaskIngressService';
import { operationalConformanceService } from '../../verification/services/operationalConformanceService';

export type CognitiveCycleDomain =
  | 'conversation' | 'rpg' | 'research' | 'code' | 'data' | 'system' | 'task';

export interface CognitiveCycleInput {
  domain: CognitiveCycleDomain;
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

export interface CognitiveDecision {
  authority: 'CORE';
  route: string[];
  taskId: string;
  status: string;
}

export interface CognitiveCycleResult {
  traceId: string;
  decision: CognitiveDecision;
  uncertaintyAction: string;
  recordedExperience: boolean;
  terminal: ReturnType<typeof operationalConformanceService.terminal>;
  coreResult?: unknown;
}

let seq = 0;
const id = (prefix: string) => `${prefix}-${++seq}-${Date.now().toString(36)}`;

class MikiCognitiveKernelService {
  async cycle(input: CognitiveCycleInput): Promise<CognitiveCycleResult> {
    if (!input.input || !input.input.trim()) throw new Error('COGNITIVE_CYCLE_INPUT_REQUIRED');

    const traceId = id('miki-trace');
    const core = await coreTaskIngressService.submit({
      kind: 'USER_REQUEST',
      source: 'core',
      goal: input.input.trim(),
      payload: {
        entry: 'LEGACY_COGNITION_API',
        legacyDomain: input.domain,
        importance: input.importance,
        uncertainty: input.uncertainty,
        irreversible: input.irreversible,
        privacy: input.privacy,
        hasCode: input.hasCode,
        hasData: input.hasData,
        needsFresh: input.needsFresh,
        capabilityIds: input.capabilityIds ?? [],
        traceId,
      },
    });

    const resultPayload = core.coreResult?.result as Record<string, unknown> | undefined;
    const route = Array.isArray(resultPayload?.selectedClassificationIds)
      ? resultPayload.selectedClassificationIds.map(String)
      : core.task.visitedDomains.map(String);
    const status = String(core.task.status);
    const uncertainty = Number(input.uncertainty ?? 0);
    const uncertaintyAction =
      uncertainty >= 0.8 && (status === 'WAITING' || status === 'PAUSED')
        ? 'ASK_MINIMAL'
        : status === 'completed'
          ? 'EXECUTE'
          : 'HOMEWORK';

    const recordedExperience = core.coreResult?.status === 'completed';
    const terminal = operationalConformanceService.terminal({
      traceId,
      budget: {
        maxSteps: 8,
        maxReplans: 2,
        maxToolRetries: 2,
        maxDuplicateSearches: 2,
        maxRuntimeMs: 30000,
        maxStateChanges: 16,
      },
      steps: Math.max(1, core.cycles),
      replans: Math.max(0, core.cycles - 1),
      toolRetries: 0,
      runtimeMs: 0,
      stateChanges: Math.max(1, core.dispatched),
      before: { evidence: 0, state: 0, artifacts: 0, candidatesReduced: 0 },
      after: {
        evidence: Array.isArray(resultPayload?.evidenceIds) ? resultPayload.evidenceIds.length : 0,
        state: 1,
        artifacts: 0,
        candidatesReduced: route.length > 1 ? 1 : 0,
      },
      userInput: uncertaintyAction === 'ASK_MINIMAL',
      capabilityLimit: uncertaintyAction === 'HOMEWORK',
    });

    return {
      traceId,
      decision: {
        authority: 'CORE',
        route,
        taskId: core.task.taskId,
        status,
      },
      uncertaintyAction,
      recordedExperience,
      terminal,
      coreResult: core.coreResult,
    };
  }

  status() {
    return {
      runtimePolicy: 'NON_LLM_ONLY',
      authority: 'CORE',
      unifiedDomains: [
        'core', 'autonomy', 'capability', 'conversation', 'data', 'execution',
        'experience', 'improvement', 'learning', 'memory', 'promotion', 'research',
        'safety', 'selfAwareness', 'selfDevelopment', 'strategy', 'unknown', 'verification',
      ],
      loop: ['core_ingress', 'plan', 'route', 'evidence', 'execute', 'evaluate', 'learn', 'core_result'],
      localLlmRuntime: false,
    };
  }
}

export const mikiCognitiveKernelService = new MikiCognitiveKernelService();
