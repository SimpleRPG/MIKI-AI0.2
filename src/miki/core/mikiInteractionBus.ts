/**
 * MIKI 17分類 共通相互作用バス
 *
 * 各カテゴリ同士を直接importで結び付けず、
 * 共通イベント経由で17分類を1つのシステムとして接続する。
 */

export const MIKI_CATEGORIES = [
  'autonomy',
  'capability',
  'conversation',
  'data',
  'execution',
  'experience',
  'improvement',
  'learning',
  'memory',
  'promotion',
  'research',
  'safety',
  'selfAwareness',
  'selfDevelopment',
  'strategy',
  'unknown',
  'verification',
] as const;

export type MikiCategory = typeof MIKI_CATEGORIES[number];

export interface MikiInteraction {
  id: string;
  source: MikiCategory;
  target?: MikiCategory;
  type: string;
  payload: unknown;
  timestamp: number;
}

export type MikiInteractionHandler =
  (interaction: MikiInteraction) => void;

class MikiInteractionBusService {
  private readonly handlers =
    new Map<MikiCategory, Set<MikiInteractionHandler>>();

  private readonly history: MikiInteraction[] = [];

  private sequence = 0;

  subscribe(
    category: MikiCategory,
    handler: MikiInteractionHandler,
  ): () => void {
    let handlers = this.handlers.get(category);

    if (!handlers) {
      handlers = new Set();
      this.handlers.set(category, handlers);
    }

    handlers.add(handler);

    return () => {
      handlers?.delete(handler);
    };
  }

  publish(
    source: MikiCategory,
    type: string,
    payload: unknown,
    target?: MikiCategory,
  ): MikiInteraction {
    const interaction: MikiInteraction = {
      id: `miki_interaction_${++this.sequence}`,
      source,
      target,
      type,
      payload,
      timestamp: Date.now(),
    };

    this.history.push(interaction);

    if (this.history.length > 500) {
      this.history.shift();
    }

    if (target) {
      this.handlers
        .get(target)
        ?.forEach(handler => handler(interaction));

      return interaction;
    }

    MIKI_CATEGORIES.forEach(category => {
      if (category === source) return;

      this.handlers
        .get(category)
        ?.forEach(handler => handler(interaction));
    });

    return interaction;
  }

  recent(limit = 50): MikiInteraction[] {
    return this.history.slice(-Math.max(0, limit));
  }

  clear(): void {
    this.history.length = 0;
  }
}

export const mikiInteractionBusService =
  new MikiInteractionBusService();
