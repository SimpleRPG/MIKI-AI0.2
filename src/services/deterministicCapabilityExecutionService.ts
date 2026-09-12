import { ExecutionEnvironment } from './executionRunnerService';
import { componentCompositionService, CompositionPlan } from './componentCompositionService';
import { componentRegistryService } from './componentRegistryService';
import { taskExecutionOrchestratorService, TaskExecutionHandle } from './taskExecutionOrchestratorService';
import { failureMemoryService } from './failureMemoryService';
import { systemLogger } from './systemLogger';

export interface DeterministicCapabilityExecutionResult {
  accepted: boolean;
  status: 'READY' | 'WAITING_FOR_RUNNER' | 'BLOCKED';
  task?: TaskExecutionHandle;
  composition?: CompositionPlan;
  reason: string;
  componentIds: string[];
}

/**
 * 能力を「回答骨格」ではなく実行可能なComponent Compositionへ落とす最終境界。
 * 任意コードや生成器は呼ばず、RegistryのVERIFIED Componentと固定I/Oだけを許可する。
 */
export class DeterministicCapabilityExecutionService {
  private static instance: DeterministicCapabilityExecutionService;
  private constructor() {}

  public static getInstance(): DeterministicCapabilityExecutionService {
    if (!this.instance) this.instance = new DeterministicCapabilityExecutionService();
    return this.instance;
  }

  public prepareAndStart(input: {
    goal: string;
    environment: ExecutionEnvironment;
    conversationId?: string;
    messageId?: string;
    requestId?: string;
    decisionId?: string;
    preferredComponentIds?: string[];
  }): DeterministicCapabilityExecutionResult {
    const goal = input.goal.trim();
    if (!goal) return this.block('実行対象のgoalが空です。');

    const composition = input.preferredComponentIds?.length
      ? componentCompositionService.composeFromComponentIds(goal, input.preferredComponentIds, input.environment)
      : componentCompositionService.compose(goal, 4, [], input.environment);

    if (!composition?.executable || !composition.verified) {
      return {
        accepted: false,
        status: 'BLOCKED',
        composition,
        reason: composition?.blocked_reason || 'VERIFIED Componentだけでは実行計画を構成できません。',
        componentIds: composition?.steps.map(s => s.component_id) || [],
      };
    }

    const components = composition.steps.map(step => componentRegistryService.getComponent(step.component_id));
    if (components.some(c => !c || c.status !== 'VERIFIED')) {
      return this.block('実行直前のRegistry再検証でVERIFIED条件を満たしませんでした。', composition);
    }
    const unsafe = components.find(c => {
      if (!c) return false;
      const risk = failureMemoryService.assessRisk(c.component_id, input.environment, c.implementation_hash);
      return risk.risk_score >= 60;
    });
    if (unsafe) {
      return this.block(`既知の失敗リスクが高いComponentを停止しました: ${unsafe.component_id}`, composition);
    }

    const task = taskExecutionOrchestratorService.startFromRequest(goal, input.environment, {
      conversationId: input.conversationId,
      messageId: input.messageId,
      requestId: input.requestId,
      decisionId: input.decisionId,
    });

    const accepted = task.status !== 'BLOCKED';
    systemLogger.info('TOOLS', `🧠 [DeterministicCapabilityExecution] ${goal} -> ${task.status}`);
    return {
      accepted,
      status: task.status === 'READY' ? 'READY' : task.status === 'WAITING_FOR_RUNNER' ? 'WAITING_FOR_RUNNER' : 'BLOCKED',
      task,
      composition,
      reason: task.reason || (accepted ? '検証済みComponent CompositionからExecution Requestを発行しました。' : '実行を開始できませんでした。'),
      componentIds: composition.steps.map(s => s.component_id),
    };
  }

  private block(reason: string, composition?: CompositionPlan): DeterministicCapabilityExecutionResult {
    return {
      accepted: false,
      status: 'BLOCKED',
      composition,
      reason,
      componentIds: composition?.steps.map(s => s.component_id) || [],
    };
  }
}

export const deterministicCapabilityExecutionService = DeterministicCapabilityExecutionService.getInstance();
