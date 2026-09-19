import {
  AnswerSkeletonType,
} from '../../../types';
import { JapaneseAnalysisCompositionResult, japaneseAnalysisCompositionService } from './japaneseAnalysisCompositionService';
import { componentRegistryService } from '../../capability/services/componentRegistryService';
import { componentCompositionService, CompositionPlan } from '../../capability/services/componentCompositionService';
import { JapaneseAnalysisResult } from '../../research/services/japaneseAnalysisService';

export type ConversationAnalysisComponentId =
  | 'conversation.analysis.sudachi'
  | 'conversation.analysis.intl_segmenter'
  | 'conversation.analysis.dictionary_ngram'
  | 'conversation.analysis.composed';

export interface ConversationAnalysisComponentRun {
  componentId: ConversationAnalysisComponentId;
  available: boolean;
  verified: boolean;
  reason: string;
}

export interface ConversationComponentPipelineResult {
  analysis: JapaneseAnalysisResult;
  compositionPlan?: CompositionPlan;
  components: ConversationAnalysisComponentRun[];
  usedComponentIds: string[];
  conflicts: JapaneseAnalysisCompositionResult['conflicts'];
  mode: 'SYNCHRONOUS_COMPOSITION' | 'PARALLEL_COMPOSITION';
}

/**
 * 会話解析の共通Component入口。
 *
 * 日本語解析器そのものは言語固有の実装Componentだが、実行経路は
 * 日本語専用オーケストレータを持たず、Component Registry/Compositionの
 * 共通契約で扱う。将来別言語・別解析方式を追加する場合も同じ境界を使う。
 */
export class ConversationComponentPipelineService {
  private readonly analysisComponentIds: ConversationAnalysisComponentId[] = [
    'conversation.analysis.sudachi',
    'conversation.analysis.intl_segmenter',
    'conversation.analysis.dictionary_ngram',
  ];

  public analyzeSync(text: string): ConversationComponentPipelineResult {
    const composition = japaneseAnalysisCompositionService.analyzeSync(text);
    return this.buildResult(composition, 'SYNCHRONOUS_COMPOSITION');
  }

  public async analyze(
    text: string,
    mode: 'A' | 'B' | 'C' = 'C',
  ): Promise<ConversationComponentPipelineResult> {
    const composition = await japaneseAnalysisCompositionService.analyze(text, mode);
    return this.buildResult(composition, 'PARALLEL_COMPOSITION');
  }

  /**
   * CompositionPlanは「解析Component群を同じ共通Composition契約で扱えるか」の
   * 実行前検査。実際の解析は各Component実装へ委譲し、未検証Componentを
   * VERIFIEDへ偽装しない。
   */
  private buildResult(
    composition: JapaneseAnalysisCompositionResult,
    mode: ConversationComponentPipelineResult['mode'],
  ): ConversationComponentPipelineResult {
    const componentRuns: ConversationAnalysisComponentRun[] = this.analysisComponentIds.map((componentId) => {
      const registry = componentRegistryService.getComponent(componentId);
      const rawId = this.mapRegistryIdToRawId(componentId);
      const raw = composition.components.find(component => component.componentId === rawId);
      return {
        componentId,
        available: Boolean(raw?.available),
        verified: Boolean(raw?.verified && registry?.status === 'VERIFIED'),
        reason: raw?.reason || `${componentId} unavailable`,
      };
    });

    const availableIds = componentRuns
      .filter(component => component.available)
      .map(component => component.componentId);

    const compositionPlan = componentCompositionService.composeRuntimeComponentIds(
      'conversation-analysis',
      availableIds,
      'conversation',
      ['String'],
    );

    const composedRegistry = componentRegistryService.getComponent('conversation.analysis.composed');

    componentRuns.push({
      componentId: 'conversation.analysis.composed',
      available: Boolean(compositionPlan?.executable && composedRegistry),
      verified: Boolean(compositionPlan?.verified && composedRegistry?.status === 'VERIFIED'),
      reason: compositionPlan
        ? 'Available analysis Components were validated through the common Component Composition contract.'
        : 'No executable analysis Component composition plan was available.',
    });

    return {
      analysis: composition.analysis,
      compositionPlan,
      components: componentRuns,
      usedComponentIds: componentRuns.filter(component => component.available).map(component => component.componentId),
      conflicts: composition.conflicts,
      mode,
    };
  }

  private mapRegistryIdToRawId(
    componentId: Exclude<ConversationAnalysisComponentId, 'conversation.analysis.composed'>,
  ): 'SUDACHI_NATIVE' | 'INTL_SEGMENTER' | 'DETERMINISTIC_DICTIONARY_NGRAM' {
    switch (componentId) {
      case 'conversation.analysis.sudachi':
        return 'SUDACHI_NATIVE';
      case 'conversation.analysis.intl_segmenter':
        return 'INTL_SEGMENTER';
      case 'conversation.analysis.dictionary_ngram':
        return 'DETERMINISTIC_DICTIONARY_NGRAM';
    }
  }

  public selectAnswerSkeleton(dialogueAct: string): AnswerSkeletonType {
    if (dialogueAct === 'CORRECTION') return 'CORRECTION';
    if (dialogueAct === 'REQUEST_ARTIFACT') return 'TASK_COMPLETION';
    if (dialogueAct === 'REQUEST_RECOMMENDATION') return 'RECOMMENDATION';
    return 'GENERAL_ANSWER';
  }
}

export const conversationComponentPipelineService = new ConversationComponentPipelineService();
