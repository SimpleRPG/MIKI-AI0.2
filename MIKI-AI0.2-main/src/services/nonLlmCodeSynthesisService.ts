import { CompiledRequestType } from '../types';
import { capabilityGraphService } from './capabilityGraphService';
import { componentCompositionService, CompositionPlan } from './componentCompositionService';
import { componentRegistryService } from './componentRegistryService';

export interface CodeSynthesisPlan {
  requestId: string;
  deterministic: boolean;
  composition?: CompositionPlan;
  componentIds: string[];
  blockedReason?: string;
}

/** 第93/95章: コード生成を要求IR→部品→合成へ分解する。未検証コードを完成品として返さない。 */
export class NonLlmCodeSynthesisService {
  plan(request: CompiledRequestType, prompt: string): CodeSynthesisPlan {
    const environment = request.environment || 'ANDROID';
    const graph = capabilityGraphService.plan(prompt, 6, [], environment);
    if (!graph) return { requestId: request.requestId, deterministic: false, componentIds: [], blockedReason: '能力グラフから候補を構成できない' };
    const composition = componentCompositionService.composeFromCapabilityPlan(prompt, graph);
    if (!composition || !composition.executable || !composition.verified) return { requestId: request.requestId, deterministic: false, composition, componentIds: [], blockedReason: composition?.blocked_reason || 'VERIFIED部品だけで合成できない' };
    const ids = composition.steps.map(s => s.component_id);
    const allPresent = ids.every(id => Boolean(componentRegistryService.getComponent(id)));
    return { requestId: request.requestId, deterministic: allPresent, composition, componentIds: ids, blockedReason: allPresent ? undefined : 'Registry部品が不足' };
  }
}
export const nonLlmCodeSynthesisService = new NonLlmCodeSynthesisService();
