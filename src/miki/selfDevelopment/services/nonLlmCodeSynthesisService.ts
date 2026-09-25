import { CompiledRequestType } from '../../../types';
import { capabilityGraphService } from '../../capability/services/capabilityGraphService';
import { componentCompositionService, CompositionPlan } from '../../capability/services/componentCompositionService';
import { componentRegistryService } from '../../capability/services/componentRegistryService';

export interface CodeSynthesisSource {
  existingComponentIds: string[];
  existingComposition?: CompositionPlan;
  existingCompositionUsable: boolean;
  unknownOrGapDetected: boolean;
  gapReason?: string;
}

export interface CodeSynthesisPlan {
  requestId: string;
  deterministic: boolean;
  composition?: CompositionPlan;
  componentIds: string[];
  source: CodeSynthesisSource;
  blockedReason?: string;
}

/**
 * 汎用合成機のコード合成入口。
 *
 * 既存部品の再利用と未知・不足探索を排他的な二択にしない。
 * 現在利用可能な既存Component集合とRegistry全体の能力構成を
 * 同一サイクルで評価し、不足があればgapとしてCOREへ返す。
 *
 * 未検証コードを完成品として生成・実行することはしない。
 * Research等から得られた新規CODE ComponentはVerification後に
 * Registryへ登録され、次の合成サイクルで既存Componentと同じ材料になる。
 */
export class NonLlmCodeSynthesisService {
  plan(
    request: CompiledRequestType,
    prompt: string,
    existingComponentIds: string[] = [],
  ): CodeSynthesisPlan {
    const environment = request.environment || 'ANDROID';
    const existingIds = [...new Set(existingComponentIds.filter(Boolean))];

    const existingComposition = existingIds.length > 0
      ? componentCompositionService.composeFromComponentIds(
          prompt,
          existingIds,
          environment,
        )
      : undefined;

    const graph = capabilityGraphService.plan(
      prompt,
      6,
      [],
      environment,
    );

    const graphComposition = graph
      ? componentCompositionService.composeFromCapabilityPlan(prompt, graph)
      : undefined;

    const existingUsable = Boolean(
      existingComposition?.executable === true &&
      existingComposition.verified === true,
    );

    const graphUsable = Boolean(
      graphComposition?.executable === true &&
      graphComposition.verified === true,
    );

    const composition = existingUsable
      ? existingComposition
      : graphUsable
        ? graphComposition
        : undefined;

    const componentIds = composition?.steps.map(
      step => step.component_id,
    ) || [];

    const registryComplete = componentIds.every(
      id => Boolean(componentRegistryService.getComponent(id)),
    );

    let gapReason: string | undefined;

    if (!graph) {
      gapReason = 'CAPABILITY_GRAPH_UNAVAILABLE';
    } else if (!existingUsable && !graphUsable) {
      gapReason = existingIds.length > 0
        ? 'EXISTING_AND_CAPABILITY_COMPOSITION_UNAVAILABLE'
        : 'VERIFIED_COMPOSITION_UNAVAILABLE';
    }

    const source: CodeSynthesisSource = {
      existingComponentIds: existingIds,
      existingComposition,
      existingCompositionUsable: existingUsable,
      unknownOrGapDetected: Boolean(gapReason),
      gapReason,
    };

    if (
      !composition ||
      componentIds.length === 0 ||
      !registryComplete
    ) {
      return {
        requestId: request.requestId,
        deterministic: false,
        composition,
        componentIds,
        source,
        blockedReason: gapReason || 'REGISTRY_COMPONENT_INCOMPLETE',
      };
    }

    return {
      requestId: request.requestId,
      deterministic: true,
      composition,
      componentIds,
      source,
    };
  }
}

export const nonLlmCodeSynthesisService =
  new NonLlmCodeSynthesisService();
