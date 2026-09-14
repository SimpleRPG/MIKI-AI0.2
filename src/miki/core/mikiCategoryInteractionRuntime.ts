import {
  MIKI_CATEGORIES,
  MikiCategory,
  MikiInteraction,
  mikiInteractionBusService,
} from './mikiInteractionBus';

import {
  selfImprovementControllerService,
} from '../improvement/services/selfImprovementControllerService';

const NEXT_CATEGORY: Record<MikiCategory, MikiCategory> = {
  autonomy: 'capability',
  capability: 'conversation',
  conversation: 'data',
  data: 'execution',
  execution: 'experience',
  experience: 'improvement',
  improvement: 'learning',
  learning: 'memory',
  memory: 'research',
  research: 'strategy',
  strategy: 'selfAwareness',
  selfAwareness: 'selfDevelopment',
  selfDevelopment: 'verification',
  verification: 'safety',
  safety: 'promotion',
  promotion: 'unknown',
  unknown: 'autonomy',
};

const CORE_IMPROVEMENT_FLOW: readonly MikiCategory[] = [
  'selfAwareness',
  'improvement',
  'strategy',
  'selfDevelopment',
  'verification',
  'safety',
  'promotion',
  'memory',
  'learning',
  'selfAwareness',
];

export interface MikiRuntimeState {
  active: boolean;
  registeredCategories: readonly MikiCategory[];
  lastInteraction?: MikiInteraction;
  lastImprovementRunId?: string;
}

class MikiCategoryInteractionRuntime {
  private active = false;
  private unsubscribers: Array<() => void> = [];
  private lastInteraction?: MikiInteraction;
  private lastImprovementRunId?: string;

  start(): void {
    if (this.active) return;

    this.active = true;

    for (const category of MIKI_CATEGORIES) {
      const unsubscribe = mikiInteractionBusService.subscribe(
        category,
        interaction => {
          this.handle(category, interaction);
        },
      );

      this.unsubscribers.push(unsubscribe);
    }
  }

  stop(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }

    this.unsubscribers = [];
    this.active = false;
  }

  getState(): MikiRuntimeState {
    return {
      active: this.active,
      registeredCategories: MIKI_CATEGORIES,
      lastInteraction: this.lastInteraction,
      lastImprovementRunId: this.lastImprovementRunId,
    };
  }

  private handle(
    category: MikiCategory,
    interaction: MikiInteraction,
  ): void {
    this.lastInteraction = interaction;

    /*
     * improvement に到達したイベントだけは、
     * ダミー処理ではなく既存の正規自己改善司令塔へ接続する。
     */
    if (
      category === 'improvement' &&
      interaction.type === 'improvement.flow'
    ) {
      void this.runRealImprovementCycle(interaction);
      return;
    }

    /*
     * category.cycle は17分類の基本連鎖を作る。
     */
    if (interaction.type !== 'category.cycle') {
      return;
    }

    const next = NEXT_CATEGORY[category];

    if (!next) {
      return;
    }

    mikiInteractionBusService.publish(
      category,
      'category.interaction',
      {
        cycleId: interaction.payload,
        from: category,
        to: next,
      },
      next,
    );
  }

  private async runRealImprovementCycle(
    interaction: MikiInteraction,
  ): Promise<void> {
    try {
      selfImprovementControllerService.initialize();

      const result =
        await selfImprovementControllerService.runOnce(
          'miki-17-category-interaction',
        );

      this.lastImprovementRunId = result.run_id;

      mikiInteractionBusService.publish(
        'improvement',
        'improvement.completed',
        {
          runId: result.run_id,
          trigger: result.trigger,
          decision: result.decision,
          result: result.result,
          verdict: result.verdict,
          scoreDelta: result.score_delta,
          sourceInteractionId: interaction.id,
        },
        'learning',
      );
    } catch (error) {
      mikiInteractionBusService.publish(
        'improvement',
        'improvement.failed',
        {
          sourceInteractionId: interaction.id,
          error: error instanceof Error
            ? error.message
            : String(error),
        },
        'verification',
      );
    }
  }

  runImprovementFlow(payload: unknown = {}): MikiInteraction[] {
    if (!this.active) {
      this.start();
    }

    const interactions: MikiInteraction[] = [];

    for (let i = 0; i < CORE_IMPROVEMENT_FLOW.length - 1; i++) {
      const source = CORE_IMPROVEMENT_FLOW[i];
      const target = CORE_IMPROVEMENT_FLOW[i + 1];

      interactions.push(
        mikiInteractionBusService.publish(
          source,
          'improvement.flow',
          {
            from: source,
            to: target,
            payload,
          },
          target,
        ),
      );
    }

    return interactions;
  }
}

export const mikiCategoryInteractionRuntime =
  new MikiCategoryInteractionRuntime();
