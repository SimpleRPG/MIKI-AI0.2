import {
  MIKI_CATEGORIES,
  MikiCategory,
  MikiInteraction,
  mikiInteractionBusService,
} from './mikiInteractionBus';

import { storageService } from '../../services/storageService';
import { longTermMemoryService } from '../memory/services/longTermMemoryService';
import { coreResultService, CoreResult } from './services/coreResultService';

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
     * improvement に到達したイベントは、既存の正規自己改善司令塔へ接続する。
     */
    if (
      category === 'improvement' &&
      interaction.type === 'improvement.flow'
    ) {
      void this.runRealImprovementCycle(interaction);
      return;
    }

    /*
     * conversation.request: CORE Resultに登録し、次のdata分類へ送る。
     */
    if (
      category === 'conversation' &&
      interaction.type === 'conversation.request'
    ) {
      const payloadObj =
        typeof interaction.payload === 'object' && interaction.payload !== null
          ? (interaction.payload as Record<string, unknown>)
          : { text: interaction.payload };

      const requestId =
        typeof payloadObj.requestId === 'string'
          ? payloadObj.requestId
          : interaction.id;

      coreResultService.recordCategoryStep(requestId, 'conversation', 'processing');

      const next = NEXT_CATEGORY[category];
      if (next) {
        mikiInteractionBusService.publish(
          category,
          'category.interaction',
          {
            requestId,
            text: payloadObj.text,
            from: category,
            to: next,
          },
          next,
        );
      }
      return;
    }

    /*
     * data分類: 記憶検索を実行し、execution分類へ渡す。
     */
    if (
      category === 'data' &&
      interaction.type === 'category.interaction'
    ) {
      const payload =
        typeof interaction.payload === 'object' &&
        interaction.payload !== null
          ? (interaction.payload as { text?: unknown; requestId?: unknown })
          : {};

      const requestId =
        typeof payload.requestId === 'string' ? payload.requestId : interaction.id;
      coreResultService.recordCategoryStep(requestId, 'data', 'processing');

      const text = typeof payload.text === 'string' ? payload.text : '';

      if (text) {
        void longTermMemoryService
          .searchPipeline(text, storageService.getMemories())
          .then(result => {
            coreResultService.recordCategoryStep(requestId, 'execution', 'processing');
            mikiInteractionBusService.publish(
              category,
              'category.interaction',
              {
                requestId,
                text,
                memorySearch: result,
                from: category,
                to: 'execution',
              },
              'execution',
            );
          })
          .catch(error => {
            coreResultService.fail(
              requestId,
              error instanceof Error ? error.message : String(error),
              { route: ['conversation', 'data'] }
            );
            mikiInteractionBusService.publish(
              category,
              'category.interaction',
              {
                requestId,
                text,
                error: error instanceof Error ? error.message : String(error),
                from: category,
                to: 'execution',
              },
              'execution',
            );
          });
      }

      return;
    }

    /*
     * execution分類: 受信した結果をCORE Resultに反映
     */
    if (
      category === 'execution' &&
      interaction.type === 'category.interaction'
    ) {
      const payload =
        typeof interaction.payload === 'object' && interaction.payload !== null
          ? (interaction.payload as { requestId?: string; text?: string; memorySearch?: unknown; error?: string })
          : {};

      const requestId = payload.requestId || interaction.id;
      if (payload.error) {
        coreResultService.fail(requestId, payload.error, {
          route: ['conversation', 'data', 'execution'],
          processedCategories: ['conversation', 'data', 'execution'],
        });
      } else {
        coreResultService.complete(
          requestId,
          {
            text: payload.text,
            memorySearch: payload.memorySearch,
            status: 'executed',
          },
          {
            route: ['conversation', 'data', 'execution'],
            processedCategories: ['conversation', 'data', 'execution'],
          }
        );
      }
      return;
    }

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
    const payload =
      typeof interaction.payload === 'object' && interaction.payload !== null
        ? (interaction.payload as Record<string, unknown>)
        : {};
    const requestId =
      typeof payload.requestId === 'string' ? payload.requestId : interaction.id;

    coreResultService.recordCategoryStep(requestId, 'improvement', 'processing');

    try {
      const trigger =
        typeof payload.trigger === 'string' ? payload.trigger : 'miki-17-category-interaction';
      const { queuedRequest } = coreResultService.submitImprovementRequest({
        trigger,
        source: 'SYSTEM',
        runId: typeof payload.runId === 'string' ? payload.runId : undefined,
        directiveId: typeof payload.directiveId === 'string' ? payload.directiveId : undefined,
        payload: { ...payload, sourceInteractionId: interaction.id, requestId },
      });

      this.lastImprovementRunId = queuedRequest.runId;

      mikiInteractionBusService.publish(
        'improvement',
        'improvement.completed',
        {
          runId: queuedRequest.runId,
          trigger: queuedRequest.trigger,
          sourceInteractionId: interaction.id,
          requestId,
        },
        'learning',
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      coreResultService.fail(requestId, errMsg, {
        sourceCategory: 'improvement',
        processedCategories: ['improvement', 'verification'],
        route: ['improvement', 'verification'],
      });

      mikiInteractionBusService.publish(
        'improvement',
        'improvement.failed',
        {
          sourceInteractionId: interaction.id,
          requestId,
          error: errMsg,
        },
        'verification',
      );
    }
  }

  requestInteraction(
    type: string,
    payload: unknown,
    source: MikiCategory = 'conversation',
    target?: MikiCategory,
  ): MikiInteraction {
    if (!this.active) {
      this.start();
    }

    const payloadObj: Record<string, unknown> =
      typeof payload === 'object' && payload !== null
        ? { ...(payload as Record<string, unknown>) }
        : { raw: payload };

    const requestId =
      typeof payloadObj.requestId === 'string'
        ? payloadObj.requestId
        : coreResultService.generateRequestId();

    payloadObj.requestId = requestId;

    coreResultService.createRequest({
      requestId,
      sourceCategory: source,
      targetCategory: target || source,
      payload: payloadObj,
      createdAt: Date.now(),
    });

    return mikiInteractionBusService.publish(
      source,
      type,
      payloadObj,
      target,
    );
  }

  requestWithResult<T = unknown>(
    type: string,
    payload: unknown,
    source: MikiCategory = 'conversation',
    target?: MikiCategory,
  ): { interaction: MikiInteraction; requestId: string; promise: Promise<CoreResult<T>> } {
    const interaction = this.requestInteraction(type, payload, source, target);
    const requestId =
      typeof interaction.payload === 'object' &&
      interaction.payload !== null &&
      'requestId' in interaction.payload &&
      typeof (interaction.payload as any).requestId === 'string'
        ? (interaction.payload as any).requestId
        : interaction.id;

    const promise = new Promise<CoreResult<T>>((resolve) => {
      const unsubscribe = coreResultService.subscribe(requestId, (res) => {
        if (
          ['completed', 'failed', 'blocked', 'rejected', 'inconclusive'].includes(
            res.status
          )
        ) {
          unsubscribe();
          resolve(res as CoreResult<T>);
        }
      });
    });

    return { interaction, requestId, promise };
  }
}

export const mikiCategoryInteractionRuntime =
  new MikiCategoryInteractionRuntime();

