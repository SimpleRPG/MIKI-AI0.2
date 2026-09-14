import {
  MIKI_CATEGORIES,
  mikiInteractionBusService,
} from './mikiInteractionBus';
import {
  mikiCategoryInteractionRuntime,
} from './mikiCategoryInteractionRuntime';

export function runMiki17CategorySmokeTest() {
  mikiInteractionBusService.clear();
  mikiCategoryInteractionRuntime.start();

  const received = new Map<string, number>();

  for (const category of MIKI_CATEGORIES) {
    received.set(category, 0);

    mikiInteractionBusService.subscribe(
      category,
      interaction => {
        if (interaction.type === 'category.interaction') {
          received.set(
            category,
            (received.get(category) ?? 0) + 1,
          );
        }
      },
    );
  }

  const interactions =
    mikiCategoryInteractionRuntime.runImprovementFlow({
      reason: '17-category-smoke-test',
    });

  return {
    categoryCount: MIKI_CATEGORIES.length,
    categories: [...MIKI_CATEGORIES],
    interactionCount: interactions.length,
    received: Object.fromEntries(received),
    active: mikiCategoryInteractionRuntime.getState().active,
  };
}
