import {
  MIKI_CATEGORIES,
  MikiCategory,
  MikiInteraction,
  mikiInteractionBusService,
} from './mikiInteractionBus';

export interface MikiCategoryCycle {
  cycleId: string;
  startedAt: number;
  interactions: MikiInteraction[];
  categories: readonly MikiCategory[];
}

class MikiCategoryCoordinator {
  private cycleSequence = 0;

  runCycle(payload: unknown = {}): MikiCategoryCycle {
    const cycleId = `miki_cycle_${++this.cycleSequence}`;
    const startedAt = Date.now();
    const before = mikiInteractionBusService.recent(500).length;

    for (const category of MIKI_CATEGORIES) {
      mikiInteractionBusService.publish(
        category,
        'category.cycle',
        {
          cycleId,
          payload,
          category,
        },
      );
    }

    const after = mikiInteractionBusService.recent(500);
    const interactions = after.slice(before);

    return {
      cycleId,
      startedAt,
      interactions,
      categories: MIKI_CATEGORIES,
    };
  }

  emit(
    source: MikiCategory,
    type: string,
    payload: unknown,
    target?: MikiCategory,
  ): MikiInteraction {
    return mikiInteractionBusService.publish(
      source,
      type,
      payload,
      target,
    );
  }
}

export const mikiCategoryCoordinator =
  new MikiCategoryCoordinator();
