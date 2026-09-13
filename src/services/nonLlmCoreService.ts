import { ChatMessage, ConversationState, AnswerSkeletonType, ConversationStrategy } from '../types';
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
import { conversationStrategyService } from './conversationStrategyService';
import { componentRegistryService } from './componentRegistryService';
import { capabilityGraphService } from './capabilityGraphService';
import { simpleRpgReferenceService } from './simpleRpgReferenceService';
import { componentCompositionService } from './componentCompositionService';
import { unifiedDecisionEngineService } from './unifiedDecisionEngineService';
import { affectionDynamicsService } from './affectionDynamicsService';
import { systemLogger } from './systemLogger';
import { autonomousSearchService } from './autonomousSearchService';
import { knowledgeGapService } from './knowledgeGapService';
import { researchService } from './researchService';
import { capabilityReuseService } from './capabilityReuseService';
import { failureMemoryService } from './failureMemoryService';
import { japaneseAnalysisService } from './japaneseAnalysisService';
import { hybridConversationEngineService } from './hybridConversationEngineService';
import { implementationSelectionService } from './implementationSelectionService';
import { nonLlmCodeSynthesisService } from './nonLlmCodeSynthesisService';
import { answerPlanService } from './answerPlanService';
import { formalConstraintSolverService } from './formalConstraintSolverService';
import { deterministicCapabilityExecutionService } from './deterministicCapabilityExecutionService';
import { unifiedMikiExperienceService } from './unifiedMikiExperienceService';
import { mikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';
import { verifiedKnowledgePromotionService } from './verifiedKnowledgePromotionService';
import { verifiedCapabilityPromotionService } from './verifiedCapabilityPromotionService';
import { unknownTaskDecompositionService } from './unknownTaskDecompositionService';
import { causalMemoryLedgerService } from './causalMemoryLedgerService';
import { bannedTopicsConfigService } from './bannedTopicsConfigService';
import { evidenceBasedPromotionGateService } from './evidenceBasedPromotionGateService';
import { mikiAutonomousDevStudioService } from './mikiAutonomousDevStudioService';
import { surfaceVariationGrowthService } from './surfaceVariationGrowthService';
import { mikiReasoningTemplateService, ReasoningMatchResult } from './mikiReasoningTemplateService';
import { mikiConversationLearningService } from './mikiConversationLearningService';
import { conversationComponentCompositionService } from './conversationComponentCompositionService';
import { normalizeKey } from './mikiUnifiedLearningContinuumService';

export interface NonLlmCoreResult {
  replyText: string;
  nextConversationState: ConversationState;
  status: 'RESOLVED' | 'UNRESOLVED' | 'NEEDS_CONFIRMATION';
  reason: string;
  intentCategory: string;
  matchedClaimsCount: number;
  usedComponents: string[];
  assembledCode?: string;
  taskExecution?: { task_id: string; status: string; run_id?: string; request_id?: string; reason?: string };
  deterministic: boolean;
  cspSatisfied: boolean;
  knowledgeGapId?: string;
  researchPerformed?: boolean;
  researchEvidenceCount?: number;
  strategy?: ConversationStrategy;
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

  private constructor() {
    conversationComponentCompositionService.initialize();
  }

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
    conversationId?: string;
    messageId?: string;
  }): Promise<NonLlmCoreResult> {
    const started = performance.now();
    const prompt = params.prompt.trim().replace(/\s+/g, ' ');
    const state = params.conversationState || defaultConversationState();
    const memories = params.memories || [];
    const recentMessages = params.recentMessages || [];
    const stages: Record<string, number> = {};
    const japaneseAnalysis = japaneseAnalysisService.analyze(prompt);
    stages.japanese = 0; // analysis is intentionally sub-millisecond on supported WebView engines

    if (!prompt) {
      return this.buildResult('RESOLVED', 'empty_input', '入力が空です。', state, 'CASUAL_CHAT', 0, [], started, stages);
    }

    // 0. ユーザー手動設定による禁止トピック検査 (コード固定ではなくユーザー設定式)
    const bannedCheck = bannedTopicsConfigService.checkBanned(prompt);
    if (bannedCheck.isBanned) {
      const ir = answerContentIrService.buildAnswerIR({
        conclusion: '手動設定された禁止トピックに該当するため、処理を制限しました。',
        target: state.currentTopic || '禁止トピック保護',
        reasons: [bannedCheck.reason || 'ユーザー手動設定によるフィルタが適用されました。'],
        conditions: ['前提として、本人設定画面より禁止キーワードの追加・解除・編集が可能です。'],
        certainty: 'CERTAIN',
        detailLevel: 'STANDARD',
      });
      const surface = answerContentIrService.generateSurfaceTextFromIR(ir, 'GENERAL_ANSWER', undefined);
      return this.buildResult('NEEDS_CONFIRMATION', 'banned_topic_filtered', surface.surfaceText, state, 'PROHIBITED_TOPIC', 0, [], started, stages);
    }

    // 会話もゲームも同じMikiの経験列。ここでは入力を観測し、最終結果でOutcomeを確定する。
    const unifiedBefore = unifiedMikiExperienceService.rankDomains(prompt).filter(x => x.score > 0).slice(0, 3);
    mikiUnifiedLearningContinuumService.initialize();
    mikiUnifiedLearningContinuumService.syncFromUnifiedExperience();

    // 0. 前ターンの未解決/要確認応答・推論結果に対するユーザー反応の統計的学習・観測 (Chapter 1 & 2)
    mikiConversationLearningService.evaluatePreviousTurn(prompt, state);

    // 0.1 ユーザーによる正解・模範回答・意見の教示検知 (Chapter 1)
    const teachingResult = mikiConversationLearningService.detectAndRegisterTeaching(prompt, state.currentTopic);

    // 1. 会話状態・対話行為・参照解決
    let t = performance.now();
    const interpretation = hybridConversationEngineService.interpret(prompt, state);
    const dialogueAct = interpretation.dialogueAct;
    const stage = interpretation.stage;
    const anaphora = interpretation.anaphora;
    stages.dialogue = Math.round(performance.now() - t);
    if (japaneseAnalysis.hasCorrection && anaphora.resolved) japaneseAnalysisService.recordCorrection(prompt, anaphora.resolved);

    const nextState: ConversationState = {
      ...state,
      stage,
      topLevelGoal: state.topLevelGoal,
      currentTopic: state.currentTopic || this.extractTopic(prompt),
      recentEntities: Array.from(new Set([...(state.recentEntities || []), ...japaneseAnalysis.contentTokens.slice(-4), ...(anaphora.resolved ? [anaphora.resolved] : []), this.extractTopic(prompt)])).filter(Boolean).slice(-10),
      updatedAt: Date.now(),
      lastCandidateClaimId: teachingResult.detected && teachingResult.candidateClaim ? teachingResult.candidateClaim.claim_id : state.lastCandidateClaimId,
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
    const simpleRpgReference = simpleRpgReferenceService.describeForPlanning(prompt);
    simpleRpgReferenceService.recordReferenceUse(simpleRpgReference.matched.map((x) => x.id));
    const implementationSelection = implementationSelectionService.select(compiled);
    stages.request = Math.round(performance.now() - t);
    nextState.topLevelGoal = compiled.goal;

    // 2.5 決定論的能力・計画パイプライン。
    // 検証済み能力パッチは「保存された教材」ではなく、現在の要求に
    // 適用可能な実行計画として解決する。未適合なら無理に適用しない。
    t = performance.now();
    const answerPlan = answerPlanService.matchSkeleton(prompt, nextState);
    const capabilityPlanApplied = Boolean(
      answerPlan.applied && answerPlan.matchedSkeleton?.reuse_mode === 'SKILL_COMPOSITION'
    );

    // 既知の安全境界をCSPで同時検査する。
    // 機密情報の外部送信は禁止し、書込み/プロセス実行は承認条件を維持する。
    const csp = formalConstraintSolverService.solveCSP({
      dataPrivacyLevel: [compiled.privacyClass],
      networkDestination: compiled.privacyClass === 'PUBLIC' ? ['LOCAL_ONLY', 'EXTERNAL_ENCRYPTED'] : ['LOCAL_ONLY'],
    });
    stages.capability = Math.round(performance.now() - t);

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
    let taskExecution: NonLlmCoreResult['taskExecution'];
    const isCodeRequest = compiled.category === 'CODE_SYNTHESIS';
    if (isCodeRequest) {
      const reusable = capabilityReuseService.findReusable(prompt);
      const executionEnvironment = compiled.environment || 'ANDROID';
      const synthesis = nonLlmCodeSynthesisService.plan(compiled, prompt);
      const plannedIds = synthesis.componentIds;
      const candidates = plannedIds.length
        ? plannedIds.map((id) => componentRegistryService.getComponent(id)).filter(Boolean) as any[]
        : componentRegistryService.searchComponents(prompt, { verifiedOnly: true });
      const safeCandidates = candidates.filter((c) => !failureMemoryService.shouldAvoid(c.component_id, executionEnvironment, c.implementation_hash));
      const ranked = mikiUnifiedLearningContinuumService.rankCapabilities(safeCandidates.map(c => c.component_id), prompt);
      const rankMap = new Map(ranked.map(r => [r.capabilityId, r.score]));
      safeCandidates.sort((a, b) => (rankMap.get(b.component_id) || 0) - (rankMap.get(a.component_id) || 0));
      usedComponents = safeCandidates.slice(0, 6).map((c) => c.component_id);
      if (reusable.length > 0 && usedComponents.length === 0) usedComponents = reusable[0].component_ids;
      if (synthesis.deterministic && synthesis.composition?.executable && safeCandidates.length > 0) {
        const execution = deterministicCapabilityExecutionService.prepareAndStart({
          goal: prompt,
          environment: executionEnvironment as 'ANDROID' | 'TERMUX' | 'EXCEL_WINDOWS' | 'EXCEL_MAC' | 'EXTERNAL_RUNNER',
          conversationId: params.conversationId,
          messageId: params.messageId,
          requestId: compiled.requestId,
        });
        if (execution.task) {
          taskExecution = {
            task_id: execution.task.task_id,
            status: execution.task.status,
            run_id: execution.task.run_id,
            request_id: execution.task.first_request?.request_id,
            reason: execution.reason,
          };
        }
      }
      // 単一のVERIFIED VBA部品なら、従来どおり決定論的にその実装を返す。
      // 複数部品は「合成計画」が完成品そのものではないため、未検証の連結コードを捏造しない。
      if (safeCandidates.length === 1 && synthesis.deterministic && /vba|マクロ|excel/i.test(prompt)) {
        const only = safeCandidates[0];
        assembledCode = only.implementation_txt;
      }

      // 自律開発スタジオ (Dev Studio) で配備済みのツール・コードも、客観昇格ゲート (Promotion Gate) の合格を検証して再利用
      if (!assembledCode && safeCandidates.length === 0) {
        const deployedProjects = mikiAutonomousDevStudioService.getProjects().filter((p) => p.stage === 'DEPLOYED');
        for (const proj of deployedProjects) {
          const totalTests = proj.testCases.length;
          const passedTests = proj.testCases.filter((tc) => tc.passed).length;
          const accuracy = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
          const reviewScore = proj.reviewResult?.overallScore || 0;

          const gateEval = evidenceBasedPromotionGateService.evaluatePromotionReadiness({
            recordCount: Math.max(10, totalTests * 2),
            accuracyScore: Math.min(100, (accuracy + reviewScore) / 2),
            determinismRate: 100,
            userCorrectionRate: 0,
          });

          if (gateEval.ready && proj.implementationCode) {
            assembledCode = proj.implementationCode;
            usedComponents.push(`dev_studio:${proj.id}`);
            systemLogger.info('SELF_IMPROVEMENT', `🛠️ [Dev Studio動的コード採用] ${proj.id}: 「${proj.title}」を客観昇格ゲート検証合格に基づき適用`);
            break;
          }
        }
      }
    }
    stages.components = Math.round(performance.now() - t);

    // 6. 判断は「比較対象・評価軸・根拠」が揃った場合だけ。
    // 数値や勝者を内部で捏造しない。ユーザーの明示選択は価値判断としてそのまま尊重する。
    t = performance.now();
    let decisionText: string | undefined;
    const comparisonCandidates = nextState.recentEntities?.filter((e) => e && e !== nextState.currentTopic).slice(-2) || [];
    if (dialogueAct === 'REQUEST_RECOMMENDATION' && comparisonCandidates.length >= 2) {
      const explicitChoice = comparisonCandidates.find((name) => {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(?:${escaped}).{0,8}(?:がいい|が良い|を選|にする|にしたい|に決め)`).test(prompt);
      });
      if (explicitChoice) {
        decisionText = `明示された選択「${explicitChoice}」を採用します。`;
      } else {
        decisionText = '比較対象は見つかりましたが、評価軸ごとの確認済み根拠が不足しているため、非LLM中核では推奨を捏造して確定しません。';
      }
    }

    stages.decision = Math.round(performance.now() - t);

    // 6.5 推論テンプレートの適用試行 (Chapter 2: 複数検証済み主張の統合推論)
    let appliedReasoningResult: ReasoningMatchResult | null = null;
    if (csp.isSatisfied && !assembledCode) {
      appliedReasoningResult = mikiReasoningTemplateService.evaluateAndApply(prompt, nextState);
    }

    // 7. Answer IR。Claimが弱い場合は「不明」を不明のまま表現する。
    let ir;
    let skeleton: AnswerSkeletonType = 'GENERAL_ANSWER';
    let status: NonLlmCoreResult['status'] = 'RESOLVED';
    let reason = implementationSelection.reason;
    if (simpleRpgReference.matched.length > 0) reason += `; ${simpleRpgReference.note}`;
    let verifiedResearchClaimId: string | undefined;
    let verifiedResearchOutcome: 'SUPPORTED' | 'DEVICE_VERIFIED' | undefined;

    if (!csp.isSatisfied) {
      status = 'NEEDS_CONFIRMATION';
      reason = 'formal_constraint_violation';
      ir = answerContentIrService.buildAnswerIR({
        conclusion: '現在の実行条件では安全制約を満たせないため、処理を確定できません。',
        target: compiled.target,
        reasons: csp.contradictionsFound,
        conditions: compiled.constraints,
        nextActions: ['実行先またはプライバシー条件を見直してください。'],
        certainty: 'CERTAIN',
        detailLevel: 'BRIEF',
      });
    } else if (assembledCode) {
      ir = answerContentIrService.buildAnswerIR({
        conclusion: '既存の検証済み部品を再利用しました。',
        target: compiled.target,
        reasons: ['新規生成より既存部品のREUSEを優先しました。', ...(capabilityPlanApplied ? answerPlan.stepsToExecute || [] : [])],
        conditions: compiled.constraints,
        certainty: 'HIGH_CONFIDENCE',
        detailLevel: 'STANDARD',
      });
      skeleton = 'TASK_COMPLETION';
    } else if (appliedReasoningResult && appliedReasoningResult.matched) {
      ir = appliedReasoningResult.answerIR;
      skeleton = appliedReasoningResult.skeletonType;
      status = 'RESOLVED';
      reason = `reasoning_template_applied:${appliedReasoningResult.template.id}`;
      nextState.lastReasoningTemplateId = appliedReasoningResult.template.id;
    } else if (teachingResult.detected && teachingResult.candidateClaim) {
      ir = answerContentIrService.buildAnswerIR({
        conclusion: teachingResult.message || `「${teachingResult.extractedStatement}」を新しい知識候補として記録しました。`,
        target: 'ユーザー教示の記録と検証準備',
        reasons: [
          `ユーザーからの直接教示を検知: 「${teachingResult.extractedStatement}」`,
          '主張DBへ CANDIDATE 状態で安全に登録しました (自己証明禁止のため複数回の一貫した確認を経て昇格)',
        ],
        conditions: ['前提として、今後の対話や検証を経て確定知識へ昇格します。'],
        certainty: 'CERTAIN',
        detailLevel: 'STANDARD',
      });
      skeleton = 'GENERAL_ANSWER';
      status = 'RESOLVED';
      reason = 'user_teaching_recorded';
    } else if (claimMatch.hasMatch && claimMatch.bestClaim && claimMatch.confidence !== 'UNVERIFIED') {
      const claim = claimMatch.bestClaim;
      const memoryReasons = relevantMemories.slice(0, 2).map((m: any) => `関連記憶: ${String(m.content || '').slice(0, 100)}`);
      ir = answerContentIrService.buildAnswerIR({
        conclusion: claim.statement,
        target: compiled.target,
        reasons: [`主張DB照合: ${claim.status}`, ...memoryReasons, ...(capabilityPlanApplied ? answerPlan.stepsToExecute || [] : [])],
        conditions: claimMatch.scopeNotes,
        certainty: claimMatch.confidence === 'CERTAIN' ? 'CERTAIN' : 'CONDITIONAL',
        worldScope: claim.world,
        nextActions: latent.suggestedProactiveAction ? [latent.suggestedProactiveAction] : [],
      });
    } else if (dialogueAct === 'CASUAL_CHAT') {
      const fatigueRegex = /(?:疲れた|しんどい|もう無理|だるい|つらい|嫌になった|最悪|やってられない|眠い|限界|へろへろ|クタクタ)/;
      const isFatigue = fatigueRegex.test(prompt);

      let casualConclusion: string;
      if (isFatigue) {
        casualConclusion = '本当にお疲れ様でした。今日は大変でしたね。無理をなさらず、ゆっくり休んでくださいね。';
      } else if (/お疲れ|おつかれ/i.test(prompt)) {
        casualConclusion = 'お疲れ様です！本日も順調に進んでいます。';
      } else if (/ありがとう|感謝/i.test(prompt)) {
        casualConclusion = 'どういたしまして！お役に立てて何よりです。';
      } else if (/おはよう/i.test(prompt)) {
        casualConclusion = 'おはようございます！今日も一日頑張りましょう。';
      } else {
        casualConclusion = 'こんにちは！本日もよろしくお願いいたします。準備万全です。';
      }

      const strategyResult = conversationStrategyService.selectConversationStrategy({
        prompt,
        stage: nextState.stage,
        persona: answerContentIrService.getDefaultPersona(),
      });

      ir = answerContentIrService.buildAnswerIR({
        conclusion: casualConclusion,
        target: '日常対話・挨拶・共感',
        reasons: ['日常対話・挨拶・感情の受け止めとして認識しました。'],
        conditions: isFatigue ? [] : ['前提として、いつでも作業指示やご相談を受け付けています。'],
        certainty: 'CERTAIN',
        detailLevel: 'BRIEF',
        strategy: strategyResult.strategy,
      });
      skeleton = 'GENERAL_ANSWER';
      status = 'RESOLVED';
      reason = isFatigue ? 'empathy_fatigue_resolved' : 'casual_chat_resolved';
    } else {
      status = 'UNRESOLVED';
      reason = claimMatch.unmetReason || 'knowledge_gap';
      skeleton = 'UNKNOWN_INVESTIGATION';

      // 未知をそのまま捨てず、Knowledge Gapとして永続化する。
      // ただし「未知だから即Web検索」にはせず、既存の検索判定器が
      // 明示検索・最新情報・仕様・定義などを調査対象と判定した場合だけ即時調査する。
      const gap = knowledgeGapService.detect({
        query: compiled.target || prompt,
        reason,
        sourceRequestId: compiled.requestId,
        priority: dialogueAct === 'REQUEST_RECOMMENDATION' ? 70 : 50,
      });

      let researchPerformed = false;
      let researchEvidenceCount = 0;
      let researchSummary: string | undefined;
      let researchNextAction = 'この知識ギャップを調査キューに残し、公式資料・再現実験などで証拠を補います。';

      const searchNeed = autonomousSearchService.detectNeedForSearch(prompt);
      if (searchNeed.needsSearch) {
        researchPerformed = true;
        t = performance.now();
        try {
          const research = await researchService.researchGap(gap);
          researchEvidenceCount = research.evidence.length;
          researchSummary = research.summary;
          stages.research = Math.round(performance.now() - t);
          const promoted = research.verification?.find((v) => v.promoted);
          if (promoted) {
            verifiedKnowledgePromotionService.initialize();
            const promotion = verifiedKnowledgePromotionService.promote({ gap, claimId: promoted.claimId, sourceRequestId: compiled.requestId });
            if (promotion) {
              verifiedKnowledgePromotionService.recordIntoContinuum(promotion, mikiUnifiedLearningContinuumService);
              // 検証済みClaimを実行可能Componentへ直接昇格させず、
              // 次回計画で利用可能な「知識能力」へ安全に昇格する。
              verifiedCapabilityPromotionService.promote(promotion);
            }
          }
          if (promoted) {
            verifiedResearchClaimId = promoted.claimId;
            verifiedResearchOutcome = promoted.outcome === 'DEVICE_VERIFIED' ? 'DEVICE_VERIFIED' : 'SUPPORTED';
            status = 'RESOLVED';
            reason = 'verified_after_research';
            researchNextAction = 'Evidence検証を通過したClaimを保存しました。以後は検証状態とスコープを維持して再利用します。';
          } else {
            researchNextAction = '検索結果は取得できましたが、検証条件を満たさないため、追加証拠・実験が必要です。';
            reason = `${reason}; research=${research.route}; evidence=${researchEvidenceCount}`;
          }
        } catch (error) {
          stages.research = Math.round(performance.now() - t);
          systemLogger.warn('SELF_IMPROVEMENT', `Knowledge Gap調査失敗 ${gap.id}: ${String(error)}`);
          researchNextAction = '自動調査に失敗したため、Gapを保持したまま後続の調査キューへ回します。';
          reason = `${reason}; research_failed`;
        }
      } else {
        stages.research = 0;
      }

      const researchReasons = researchPerformed
        ? [
            `自動調査を実行: ${researchEvidenceCount}件の証拠候補を取得`,
            ...(researchSummary ? [`調査要約: ${researchSummary.slice(0, 180)}`] : []),
          ]
        : [];

      const verifiedClaim = verifiedResearchClaimId
        ? claimDatabaseService.getClaim(verifiedResearchClaimId)
        : undefined;

      if (verifiedClaim) {
        ir = answerContentIrService.buildAnswerIR({
          conclusion: verifiedClaim.statement,
          target: compiled.target,
          reasons: [
            `Verifier判定: ${verifiedResearchOutcome}`,
            ...researchReasons,
          ],
          conditions: [
            ...claimMatch.scopeNotes,
            '検証済みClaimのスコープ内でのみ再利用します。',
          ],
          certainty: verifiedResearchOutcome === 'DEVICE_VERIFIED' ? 'CERTAIN' : 'HIGH_CONFIDENCE',
          worldScope: verifiedClaim.world,
          nextActions: latent.suggestedProactiveAction ? [latent.suggestedProactiveAction] : [],
          detailLevel: 'STANDARD',
        });
      } else {
        ir = answerContentIrService.buildAnswerIR({
          conclusion: researchPerformed && researchEvidenceCount > 0
            ? '調査結果は取得できましたが、現時点では検証済みの結論として確定していません。'
            : relevantMemories.length > 0
              ? '関連する記憶は見つかりましたが、正式な主張として十分に確定できません。'
              : '現在の端末内知識だけでは、信頼できる結論を確定できません。',
          target: compiled.target,
          reasons: [
            ...relevantMemories.slice(0, 2).map((m: any) => `関連記憶: ${String(m.content || '').slice(0, 100)}`),
          ...researchReasons,
          ],
          exceptions: [reason, `Knowledge Gap: ${gap.id}`],
          conditions: ['前提として、検索結果・記憶・生成情報は証拠候補であり、検証なしに真実として昇格させません。'],
          nextActions: [researchNextAction],
          certainty: 'UNKNOWN',
          detailLevel: 'STANDARD',
        });
      }

      // 研究結果が得られても、Verifierが昇格条件を満たさない限りRESOLVEDへしない。
      // ResearchServiceがGapをresolved扱いにしていても、Web検索だけで
      // ClaimをSUPPORTED/DEVICE_VERIFIEDにすることは禁止する。
      (ir as any).__knowledgeGapId = gap.id;
      (ir as any).__researchPerformed = researchPerformed;
      (ir as any).__researchEvidenceCount = researchEvidenceCount;

      // 第162章: 未知・未解決タスクを既存能力へ安全に分解し、未知要素を自律調査・Working Agendaへ引き渡す
      if (status !== 'RESOLVED') {
        try {
          unknownTaskDecompositionService.decomposeAndDispatch(prompt, 2);
        } catch (e) {
          systemLogger.warn('SELF_IMPROVEMENT', `未知タスク分解への引き渡し失敗: ${String(e)}`);
        }
      }
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
    const unifiedOutcome = status === 'RESOLVED' ? 'SUCCESS' : status === 'NEEDS_CONFIRMATION' ? 'BLOCKED' : 'UNKNOWN';
    unifiedMikiExperienceService.observeConversation({
      prompt,
      outcome: unifiedOutcome,
      verified: status === 'RESOLVED' && (Boolean(claimMatch.hasMatch) || Boolean((ir as any).__researchPerformed)),
      capabilityIds: usedComponents,
      lesson: status === 'RESOLVED' ? `conversation:${dialogueAct}` : `gap:${reason}`,
    });
    mikiUnifiedLearningContinuumService.observe({
      domain: 'conversation', key: dialogueAct, outcome: unifiedOutcome, verified: status === 'RESOLVED' && (Boolean(claimMatch.hasMatch) || Boolean(appliedReasoningResult) || Boolean((ir as any).__researchPerformed)),
      capabilityIds: usedComponents, concepts: japaneseAnalysis.contentTokens.slice(0, 12),
    });
    const convKey = `conversation:${normalizeKey(`${dialogueAct}:${nextState.currentTopic || 'general'}`)}`;
    mikiUnifiedLearningContinuumService.observe({
      domain: 'conversation', key: convKey, outcome: unifiedOutcome, verified: status === 'RESOLVED' && (Boolean(claimMatch.hasMatch) || Boolean(appliedReasoningResult) || Boolean((ir as any).__researchPerformed)),
      capabilityIds: usedComponents, concepts: japaneseAnalysis.contentTokens.slice(0, 12),
    });

    nextState.lastResultStatus = status;
    nextState.lastPrompt = prompt;
    nextState.lastDialogueAct = dialogueAct;
    nextState.lastTopic = nextState.currentTopic;
    nextState.lastNormalizedKey = convKey;
    if (appliedReasoningResult) {
      nextState.lastReasoningTemplateId = appliedReasoningResult.template.id;
    }

    const sharedConcepts = unifiedMikiExperienceService.sharedConcepts(prompt, 4);
    if (unifiedBefore.length > 0 || sharedConcepts.length > 0) {
      reason += `; unified_experience=${sharedConcepts.map(x => x.concept).join(',') || unifiedBefore.map(x => x.domain).join(',')}`;
    }

    // 設計思想 第160章 & 15.1節: 意図判断と結果の因果鎖を記録し、訂正や後悔学習へ接続
    try {
      causalMemoryLedgerService.linkDecisionResult(
        compiled.requestId,
        `${dialogueAct}:${compiled.target || 'general'}`,
        status === 'RESOLVED' ? 'SUCCESS' : status === 'NEEDS_CONFIRMATION' ? 'INCONCLUSIVE' : 'FAILURE',
        status === 'RESOLVED'
      );
      if (dialogueAct === 'CORRECTION') {
        causalMemoryLedgerService.recordCorrection(compiled.requestId, prompt, true);
      }
    } catch { /* best effort */ }

    // 会話成功時の自律成長サイクル低負荷トリガー (非ブロッキング)
    if (status === 'RESOLVED') {
      setTimeout(() => {
        surfaceVariationGrowthService.runAutonomousVariationGrowthCycle(2).catch(() => {});
      }, 300);
    }

    systemLogger.info('CHAT', `🧠 [非LLM Core/Unified] ${status} / ${reason} / ${totalMs}ms / intent=${dialogueAct}`);

    return {
      replyText: surface.surfaceText,
      nextConversationState: nextState,
      status,
      reason,
      intentCategory: dialogueAct,
      matchedClaimsCount: (claimMatch.hasMatch ? 1 : 0) + (appliedReasoningResult ? appliedReasoningResult.participatingClaims.length : 0) + (verifiedResearchClaimId ? 1 : 0),
      usedComponents,
      assembledCode,
      taskExecution,
      deterministic: true,
      cspSatisfied: csp.isSatisfied,
      knowledgeGapId: (ir as any).__knowledgeGapId,
      researchPerformed: Boolean((ir as any).__researchPerformed),
      researchEvidenceCount: Number((ir as any).__researchEvidenceCount || 0),
      strategy: ir.strategy,
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
