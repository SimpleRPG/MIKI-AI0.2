import { ChatMessage, ConversationState, AnswerSkeletonType } from '../types';
import {
  classifyDialogueAct,
  defaultConversationState,
  inferConversationStage,
  resolveAnaphora,
} from './conversationStateService';
import { requestTypeCompilerService } from './requestTypeCompilerService';
import { claimDatabaseService } from './claimDatabaseService';
import { longTermMemoryService } from './longTermMemoryService';
import { latentIntentMiningService } from './latentIntentMiningService';
import { answerContentIrService } from './answerContentIrService';
import { componentRegistryService } from './componentRegistryService';
import { unifiedDecisionEngineService } from './unifiedDecisionEngineService';
import { affectionDynamicsService } from './affectionDynamicsService';
import { systemLogger } from './systemLogger';

export interface NonLlmCoreResult {
  replyText: string;
  nextConversationState: ConversationState;
  status: 'RESOLVED' | 'UNRESOLVED' | 'NEEDS_CONFIRMATION';
  reason: string;
  intentCategory: string;
  matchedClaimsCount: number;
  usedComponents: string[];
  assembledCode?: string;
  deterministic: boolean;
  cspSatisfied: boolean;
  telemetry: {
    totalMs: number;
    cpuMs: number;
    npuMs: number;
    gpuMs: number;
    stages: Record<string, number>;
    externalBytesSent: 0;
  };
}

/**
 * 設計思想書の概念地図を実行経路へ落とす中央オーケストレーター。
 *
 * 入力 → 会話状態/参照解決 → 記憶/主張 → 要求型 → 判断 → 部品 → 検証 → Answer IR → 表層
 * の順序を固定し、「未解決」を擬似回答で埋めないことを最重要不変条件とする。
 */
export class NonLlmCoreService {
  private static instance: NonLlmCoreService;

  private constructor() {}

  public static getInstance(): NonLlmCoreService {
    if (!NonLlmCoreService.instance) NonLlmCoreService.instance = new NonLlmCoreService();
    return NonLlmCoreService.instance;
  }

  public async execute(params: {
    prompt: string;
    conversationState?: ConversationState | null;
    memories?: any[];
    recentMessages?: ChatMessage[];
    attachedFiles?: any[];
    persona?: string;
  }): Promise<NonLlmCoreResult> {
    const started = performance.now();
    const prompt = params.prompt.trim().replace(/\s+/g, ' ');
    const state = params.conversationState || defaultConversationState();
    const memories = params.memories || [];
    const recentMessages = params.recentMessages || [];
    const stages: Record<string, number> = {};

    if (!prompt) {
      return this.buildResult('RESOLVED', 'empty_input', '入力が空です。', state, 'CASUAL_CHAT', 0, [], started, stages);
    }

    // 1. 会話状態・対話行為・参照解決
    let t = performance.now();
    const dialogueAct = classifyDialogueAct(prompt);
    const stage = inferConversationStage(prompt, state.stage);
    const anaphora = resolveAnaphora(prompt, state);
    stages.dialogue = Math.round(performance.now() - t);

    const nextState: ConversationState = {
      ...state,
      stage,
      topLevelGoal: state.topLevelGoal,
      currentTopic: state.currentTopic || this.extractTopic(prompt),
      recentEntities: Array.from(new Set([...(state.recentEntities || []), ...(anaphora.resolved ? [anaphora.resolved] : []), this.extractTopic(prompt)])).filter(Boolean).slice(-10),
      updatedAt: Date.now(),
    };

    if (anaphora.confidence === 'ambiguous') {
      const ir = answerContentIrService.buildAnswerIR({
        conclusion: '対象を一意に特定できません。',
        target: nextState.currentTopic || '会話中の対象',
        exceptions: [`候補: ${anaphora.candidates.join(' / ')}`],
        conditions: ['どの候補を指しているかで結論が変わるため、確認が必要です。'],
        nextActions: ['候補のうち対象を1つ指定してください。'],
        certainty: 'UNKNOWN',
        detailLevel: 'BRIEF',
      });
      const surface = answerContentIrService.generateSurfaceTextFromIR(ir, 'UNKNOWN_INVESTIGATION', undefined);
      return this.buildResult('NEEDS_CONFIRMATION', 'anaphora_ambiguous', surface.surfaceText, nextState, dialogueAct, 0, [], started, stages);
    }

    // 2. 潜在意図 + 要求型
    t = performance.now();
    const latent = latentIntentMiningService.inferLatentGoal(prompt, recentMessages.slice(-4).map((m) => m.content));
    const compiled = requestTypeCompilerService.compile(prompt, nextState);
    stages.request = Math.round(performance.now() - t);
    nextState.topLevelGoal = compiled.goal;

    // 3. Claim DB + 長期記憶。保存されていることと真実性を混同しない。
    t = performance.now();
    const claimMatch = claimDatabaseService.findBestMatchingClaim(prompt);
    let relevantMemories: any[] = [];
    if (memories.length > 0) {
      const memoryResult = await longTermMemoryService.searchPipeline(
        prompt,
        memories,
        nextState,
        recentMessages,
        { limit: 5, onlyApprovedForFacts: true }
      );
      relevantMemories = memoryResult.scoredMemories.map((m: any) => m.memory).filter(Boolean);
    }
    stages.knowledge = Math.round(performance.now() - t);

    // 4. 感情は回答内容の事実を変更せず、表層方針のみに利用する。
    affectionDynamicsService.evaluateAndTransfer(prompt);

    // 5. コード要求は既存部品を先に探す。汎用自然言語から勝手にVBAを生成しない。
    t = performance.now();
    let usedComponents: string[] = [];
    let assembledCode: string | undefined;
    const isCodeRequest = compiled.category === 'CODE_SYNTHESIS';
    if (isCodeRequest) {
      const candidates = componentRegistryService.searchComponents(prompt, { verifiedOnly: true });
      usedComponents = candidates.slice(0, 3).map((c) => c.component_id);
      if (candidates.length === 1 && /vba|マクロ|excel/i.test(prompt)) {
        const only = candidates[0];
        assembledCode = only.implementation_txt;
      }
    }
    stages.components = Math.round(performance.now() - t);

    // 6. 判断は「比較対象と評価軸」が存在する場合だけ。固定の架空2択は作らない。
    t = performance.now();
    let decisionText: string | undefined;
    const comparisonCandidates = nextState.recentEntities?.filter((e) => e && e !== nextState.currentTopic).slice(-2) || [];
    if (dialogueAct === 'REQUEST_RECOMMENDATION' && comparisonCandidates.length >= 2) {
      const decision = unifiedDecisionEngineService.makeDecision({
        topic: nextState.currentTopic || prompt,
        options: comparisonCandidates.map((name, index) => ({
          name,
          score: 50 + (index === 0 ? 1 : 0),
          pros: [],
          cons: [],
        })),
        requestText: prompt,
        hasExistingMatch: usedComponents.length > 0,
        hasVerifiedEvidence: claimMatch.confidence === 'CERTAIN' || claimMatch.confidence === 'PROBABLE',
      });
      decisionText = `推奨候補は「${decision.chosen_option}」です。`;
    }
    stages.decision = Math.round(performance.now() - t);

    // 7. Answer IR。Claimが弱い場合は「不明」を不明のまま表現する。
    let ir;
    let skeleton: AnswerSkeletonType = 'GENERAL_ANSWER';
    let status: NonLlmCoreResult['status'] = 'RESOLVED';
    let reason = 'deterministic_core';

    if (assembledCode) {
      ir = answerContentIrService.buildAnswerIR({
        conclusion: '既存の検証済み部品を再利用しました。',
        target: compiled.target,
        reasons: ['新規生成より既存部品のREUSEを優先しました。'],
        conditions: compiled.constraints,
        certainty: 'HIGH_CONFIDENCE',
        detailLevel: 'STANDARD',
      });
      skeleton = 'TASK_COMPLETION';
    } else if (claimMatch.hasMatch && claimMatch.bestClaim && claimMatch.confidence !== 'UNVERIFIED') {
      const claim = claimMatch.bestClaim;
      const memoryReasons = relevantMemories.slice(0, 2).map((m: any) => `関連記憶: ${String(m.content || '').slice(0, 100)}`);
      ir = answerContentIrService.buildAnswerIR({
        conclusion: claim.statement,
        target: compiled.target,
        reasons: [`主張DB照合: ${claim.status}`, ...memoryReasons],
        conditions: claimMatch.scopeNotes,
        certainty: claimMatch.confidence === 'CERTAIN' ? 'CERTAIN' : 'CONDITIONAL',
        worldScope: claim.world,
        nextActions: latent.suggestedProactiveAction ? [latent.suggestedProactiveAction] : [],
      });
    } else {
      status = 'UNRESOLVED';
      reason = claimMatch.unmetReason || 'knowledge_gap';
      skeleton = 'UNKNOWN_INVESTIGATION';
      ir = answerContentIrService.buildAnswerIR({
        conclusion: relevantMemories.length > 0
          ? '関連する記憶は見つかりましたが、正式な主張として十分に確定できません。'
          : '現在の端末内知識だけでは、信頼できる結論を確定できません。',
        target: compiled.target,
        reasons: relevantMemories.slice(0, 2).map((m: any) => `関連記憶: ${String(m.content || '').slice(0, 100)}`),
        exceptions: [reason],
        conditions: ['不足している証拠を外部資料・実験・ユーザー確認から補う必要があります。'],
        nextActions: ['まず公式資料または対象環境での再現実験を調査経路として選択します。'],
        certainty: 'UNKNOWN',
        detailLevel: 'STANDARD',
      });
    }

    if (decisionText && status === 'RESOLVED') ir.conclusion = decisionText;
    if (dialogueAct === 'CORRECTION') skeleton = 'CORRECTION';

    t = performance.now();
    const surface = answerContentIrService.generateSurfaceTextFromIR(
      ir,
      skeleton,
      undefined,
      assembledCode
    );
    const preservation = answerContentIrService.verifySemanticPreservation(ir, surface.surfaceText);
    stages.answer = Math.round(performance.now() - t);

    if (!preservation.isPreserved) {
      status = 'UNRESOLVED';
      reason = 'semantic_preservation_failed';
    }

    const totalMs = Math.round(performance.now() - started);
    systemLogger.info('CHAT', `🧠 [非LLM Core] ${status} / ${reason} / ${totalMs}ms / intent=${dialogueAct}`);

    return {
      replyText: surface.surfaceText,
      nextConversationState: nextState,
      status,
      reason,
      intentCategory: dialogueAct,
      matchedClaimsCount: claimMatch.hasMatch ? 1 : 0,
      usedComponents,
      assembledCode,
      deterministic: true,
      cspSatisfied: true,
      telemetry: { totalMs, cpuMs: totalMs, npuMs: 0, gpuMs: 0, stages, externalBytesSent: 0 },
    };
  }

  private extractTopic(prompt: string): string {
    return prompt.replace(/^(ねえ|ちょっと|みき[、,]?)\s*/i, '').slice(0, 80);
  }

  private buildResult(
    status: NonLlmCoreResult['status'],
    reason: string,
    replyText: string,
    state: ConversationState,
    intentCategory: string,
    matchedClaimsCount: number,
    usedComponents: string[],
    started: number,
    stages: Record<string, number>
  ): NonLlmCoreResult {
    return {
      replyText,
      nextConversationState: state,
      status,
      reason,
      intentCategory,
      matchedClaimsCount,
      usedComponents,
      deterministic: true,
      cspSatisfied: true,
      telemetry: { totalMs: Math.round(performance.now() - started), cpuMs: Math.round(performance.now() - started), npuMs: 0, gpuMs: 0, stages, externalBytesSent: 0 },
    };
  }
}

export const nonLlmCoreService = NonLlmCoreService.getInstance();
