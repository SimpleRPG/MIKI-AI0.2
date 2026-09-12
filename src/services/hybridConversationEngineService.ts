import { AnswerSkeletonType, ConversationState } from '../types';
import { classifyDialogueAct, inferConversationStage, resolveAnaphora } from './conversationStateService';
import { japaneseAnalysisService } from './japaneseAnalysisService';
import { answerContentIrService } from './answerContentIrService';

export interface ConversationInterpretation {
  dialogueAct: ReturnType<typeof classifyDialogueAct>;
  stage: ReturnType<typeof inferConversationStage>;
  anaphora: ReturnType<typeof resolveAnaphora>;
  tokens: string[];
  skeleton: AnswerSkeletonType;
  deterministic: boolean;
  llmFallbackNeeded: boolean;
  reason: string;
}

/** 第92/94章: 会話を意味処理と表層生成へ分解し、既知領域ではLLMを呼ばない。 */
export class HybridConversationEngineService {
  interpret(input: string, state: ConversationState): ConversationInterpretation {
    const text = input.trim();
    const dialogueAct = classifyDialogueAct(text);
    const stage = inferConversationStage(text, state.stage);
    const anaphora = resolveAnaphora(text, state);
    const analysis = japaneseAnalysisService.analyze(text);
    let skeleton: AnswerSkeletonType = 'GENERAL_ANSWER';
    if (dialogueAct === 'CORRECTION') skeleton = 'CORRECTION';
    else if (dialogueAct === 'REQUEST_ARTIFACT') skeleton = 'TASK_COMPLETION';
    else if (dialogueAct === 'REQUEST_RECOMMENDATION') skeleton = 'RECOMMENDATION';
    const blocking = anaphora.confidence === 'ambiguous';
    const known = dialogueAct !== 'CASUAL_CHAT' || analysis.contentTokens.length > 0;
    return { dialogueAct, stage, anaphora, tokens: analysis.contentTokens, skeleton, deterministic: known && !blocking, llmFallbackNeeded: blocking || !known, reason: blocking ? '参照解決が曖昧' : known ? '規則・辞書・状態から解釈可能' : '未知表現のためフォールバック候補' };
  }

  render(ir: Parameters<typeof answerContentIrService.generateSurfaceTextFromIR>[0], skeleton: AnswerSkeletonType) {
    const result = answerContentIrService.generateSurfaceTextFromIR(ir, skeleton);
    const inspection = answerContentIrService.verifySemanticPreservation(ir, result.surfaceText);
    return { ...result, inspection };
  }
}
export const hybridConversationEngineService = new HybridConversationEngineService();
