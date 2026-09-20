import {
  MIKI_CATEGORIES,
  MikiCategory,
  MikiInteraction,
  mikiInteractionBusService,
} from './mikiInteractionBus';

import { coreResultService, CoreResult } from './services/coreResultService';
import { coreTaskIngressService } from './services/coreTaskIngressService';

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

    /* improvement.flow -> canonical CORE Task */
    if (category === 'improvement' && interaction.type === 'improvement.flow') {
      void this.runRealImprovementCycle(interaction);
      return;
    }

    /* conversation.request -> canonical CORE ingress */
    if (category === 'conversation' && interaction.type === 'conversation.request') {
      const payloadObj: Record<string, unknown> =
        typeof interaction.payload === 'object' && interaction.payload !== null
          ? { ...(interaction.payload as Record<string, unknown>) }
          : { text: interaction.payload };
      const requestId = typeof payloadObj.requestId === 'string' ? payloadObj.requestId : interaction.id;
      payloadObj.requestId = requestId;
      payloadObj.interactionId = interaction.id;
      void coreTaskIngressService.submit({
        kind: 'USER_REQUEST',
        goal: typeof payloadObj.text === 'string' && payloadObj.text.trim() ? payloadObj.text.trim() : 'conversation.request',
        source: 'conversation',
        payload: payloadObj,
        initialPayload: payloadObj,
      }).catch(error => {
        coreResultService.fail(requestId,error instanceof Error ? error.message : String(error),{route:['conversation'],processedCategories:['conversation']});
      });
      return;
    }

    /* legacy data/execution events are observation only; no fixed chaining */
    if (category === 'data' && interaction.type === 'category.interaction') {
      const payload = typeof interaction.payload === 'object' && interaction.payload !== null ? interaction.payload as Record<string,unknown> : {};
      const requestId = typeof payload.requestId === 'string' ? payload.requestId : interaction.id;
      coreResultService.recordCategoryStep(requestId,'data','processing');
      return;
    }

    if (category === 'execution' && interaction.type === 'category.interaction') {
      const payload = typeof interaction.payload === 'object' && interaction.payload !== null ? interaction.payload as Record<string,unknown> : {};
      const requestId = typeof payload.requestId === 'string' ? payload.requestId : interaction.id;
      coreResultService.recordCategoryStep(requestId,'execution',payload.error ? 'failed' : 'processing');
      if (payload.error) coreResultService.fail(requestId,String(payload.error),{route:['execution'],processedCategories:['execution']});
      return;
    }

    if (interaction.type === 'category.cycle') {
      const payload = typeof interaction.payload === 'object' && interaction.payload !== null ? interaction.payload as Record<string,unknown> : {cycleId:interaction.payload};
      const requestId = typeof payload.requestId === 'string' ? payload.requestId : undefined;
      if (requestId) coreResultService.recordCategoryStep(requestId,category,'processing');
      return;
    }
  }

  private async runRealImprovementCycle(
    interaction: MikiInteraction,
  ): Promise<void> {
    const payload = typeof interaction.payload === 'object' && interaction.payload !== null ? { ...(interaction.payload as Record<string, unknown>) } : {};
    const requestId = typeof payload.requestId === 'string' ? payload.requestId : interaction.id;
    payload.requestId = requestId;
    payload.interactionId = interaction.id;
    coreResultService.recordCategoryStep(requestId,'improvement','processing');
    try {
      const trigger = typeof payload.trigger === 'string' ? payload.trigger : 'miki-17-category-interaction';
      const result = await coreTaskIngressService.submit({
        kind:'SELF_IMPROVEMENT', goal:trigger, source:'improvement', payload:{...payload,trigger}, initialPayload:{...payload,trigger},
      });
      this.lastImprovementRunId = typeof result.coreResult?.runId === 'string' ? result.coreResult.runId : undefined;
      if (result.task.status === 'COMPLETED') coreResultService.recordCategoryStep(requestId,'improvement','completed');
      else if (result.task.status === 'PAUSED' || result.task.status === 'WAITING') coreResultService.waiting(requestId,{route:['improvement']});
      else if (result.task.status === 'FAILED') coreResultService.fail(requestId,'CORE_SELF_IMPROVEMENT_TASK_FAILED',{route:['improvement']});
    } catch (error) {
      const errMsg=error instanceof Error?error.message:String(error);
      coreResultService.fail(requestId,errMsg,{sourceCategory:'improvement',processedCategories:['improvement'],route:['improvement']});
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

