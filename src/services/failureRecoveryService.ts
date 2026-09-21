import { failureMemoryService, FailureMemoryRecord } from './failureMemoryService';
import { componentRegistryService } from './componentRegistryService';
import { componentCompositionService, CompositionPlan } from './componentCompositionService';
import { ExecutionEnvironment } from './executionRunnerService';
import { systemLogger } from './systemLogger';

export type RecoveryAction = 'RETRY' | 'ALTERNATE_COMPONENT' | 'ALTERNATE_COMPOSITION' | 'RESEARCH' | 'STOP';

export interface RecoveryDecision {
  action: RecoveryAction;
  reason: string;
  failed_component_id?: string;
  known_failures: FailureMemoryRecord[];
  alternate_component_ids: string[];
  alternate_plan?: CompositionPlan;
}

/**
 * 失敗時の復旧戦略を決定する。自動で危険な実行を行わず、次に許可される経路だけを返す。
 * 優先順: Retry → 別Component → 別Composition → Research → Stop
 */
export class FailureRecoveryService {
  private static instance: FailureRecoveryService;
  private constructor() {}
  public static getInstance(): FailureRecoveryService {
    if (!this.instance) this.instance = new FailureRecoveryService();
    return this.instance;
  }

  public decide(input: {
    goal: string;
    environment: ExecutionEnvironment;
    failedComponentId: string;
    implementationHash: string;
    attempts: number;
    maxAttempts: number;
  }): RecoveryDecision {
    const known = failureMemoryService.findKnownFailures(input.goal, [input.failedComponentId], input.environment);

    if (input.attempts < input.maxAttempts) {
      return this.decision('RETRY', '同一実装・同一環境で既知の失敗がないため、Retryを1回だけ許可。', input, known, []);
    }

    const alternates = componentRegistryService.searchComponents(input.goal, { verifiedOnly: true })
      .filter(c => c.status === 'VERIFIED')
      .filter(c => c.component_id !== input.failedComponentId)
      .filter(c => c.implementation_hash !== input.implementationHash)
      .filter(c => !failureMemoryService.shouldAvoid(c.component_id, input.environment, c.implementation_hash))
      .map(c => c.component_id)
      .slice(0, 5);

    if (alternates.length) {
      return this.decision('ALTERNATE_COMPONENT', '既知の失敗部品を避け、別のVERIFIED部品候補へ切り替え可能。', input, known, alternates);
    }

    const alternatePlan = componentCompositionService.compose(input.goal, 4, [input.failedComponentId], input.environment);
    if (alternatePlan?.executable && !alternatePlan.steps.some(s => s.component_id === input.failedComponentId)) {
      return this.decision('ALTERNATE_COMPOSITION', '失敗部品を含まない別Compositionを構成できたため切替可能。', input, known, [], alternatePlan);
    }

    if (known.length || alternates.length === 0) {
      return this.decision('RESEARCH', '既知失敗を回避できる安全な部品/Compositionが見つからないため、実行を増やさずResearchへ送る。', input, known, []);
    }

    return this.decision('STOP', '安全な復旧経路がありません。', input, known, []);
  }

  private decision(action: RecoveryAction, reason: string, input: { failedComponentId: string }, known: FailureMemoryRecord[], alternateComponentIds: string[], alternatePlan?: CompositionPlan): RecoveryDecision {
    const result: RecoveryDecision = { action, reason, failed_component_id: input.failedComponentId, known_failures: known, alternate_component_ids: alternateComponentIds, alternate_plan: alternatePlan };
    systemLogger.warn('TOOLS', `🛟 [Recovery] ${input.failedComponentId}: ${action} - ${reason}`);
    return result;
  }
}

export const failureRecoveryService = FailureRecoveryService.getInstance();
