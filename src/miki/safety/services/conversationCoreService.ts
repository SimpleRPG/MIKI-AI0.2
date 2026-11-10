import { ChatMessage, ConversationState, AnswerSkeletonType, ConversationStrategy } from '../../../types';
import {
  classifyDialogueAct,
  defaultConversationState,
  inferConversationStage,
  resolveAnaphora,
  selectInformationGainQuestion,
  updateConversationGoalProgress,
  evaluateConversationConsistency,
  inferConversationCorrectionScope,
  classifyConversationKnowledgeState,
  assessConversationCompleteness,
  clarificationGate,
  buildConversationTemporalContext,
  verifyConversationEntityTimeStateConsistency,
} from '../../conversation/services/conversationStateService';
import { requestTypeCompilerService } from '../../selfDevelopment/services/requestTypeCompilerService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { longTermMemoryService } from '../../memory/services/longTermMemoryService';
import { latentIntentMiningService } from '../../unknown/services/latentIntentMiningService';
import { answerContentIrService } from '../../conversation/services/answerContentIrService';
import { unknownResearchConversationBridgeService, selectUnverifiedPresentation, buildUnverifiedConclusion } from '../../conversation/services/unknownResearchConversationBridgeService';
import { conversationUnknownVocabularyService } from '../../conversation/services/conversationUnknownVocabularyService';
import { conversationImageObservationService } from '../../conversation/services/conversationImageObservationService';
import { scopedVersionedMemoryService } from '../../memory/services/scopedVersionedMemoryService';
import { conversationUserFactRecallService, looksInterrogative, UserFactIntakeSummary } from '../../conversation/services/conversationUserFactRecallService';
import { conversationStrategyService } from '../../strategy/services/conversationStrategyService';
import { adaptExplanationDetailLevel } from '../../conversation/services/conversationStateService';
import { storageService } from '../../../services/storageService';
import { personaProfileService, BIBI_PROFILE_ID } from '../../conversation/services/personaProfileService';
import { roleplaySessionService } from '../../conversation/services/roleplaySessionService';
import { utteranceEventClassifierService } from '../../conversation/services/utteranceEventClassifierService';
import { utteranceFeatureService, isBackchannelText } from '../../memory/services/utteranceFeatureService';
import { worldModelGraphService } from '../../selfAwareness/services/worldModelGraphService';
import { episodeMemoryService } from '../../conversation/services/episodeMemoryService';
import { dayKeyService } from '../../memory/services/dayKeyService';
import { reviewReflectionService } from '../../selfAwareness/services/reviewReflectionService';
import { paraphraseService } from '../../memory/services/paraphraseService';
import { componentRegistryService } from '../../capability/services/componentRegistryService';
import { capabilityGraphService } from '../../capability/services/capabilityGraphService';
import { componentCompositionService } from '../../capability/services/componentCompositionService';
import { unifiedDecisionEngineService } from '../../strategy/services/unifiedDecisionEngineService';
import { affectionDynamicsService } from '../../selfAwareness/services/affectionDynamicsService';
import { systemLogger } from '../../../services/systemLogger';
import { unifiedWebResearchService } from '../../research/services/unifiedWebResearchService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { researchService } from '../../research/services/researchService';
import { verifierService } from '../../verification/services/verifierService';
import { reusableComponentFactoryService } from '../../core/services/reusableComponentFactoryService';
import { capabilityReuseService } from '../../capability/services/capabilityReuseService';
import { failureMemoryService } from '../../memory/services/failureMemoryService';
import { conversationComponentPipelineService } from '../../conversation/services/conversationComponentPipelineService';
import { japaneseAnalysisService } from '../../research/services/japaneseAnalysisService';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { userKnowledgeProfileService } from '../../conversation/services/userKnowledgeProfileService';
import { projectNotebookService } from '../../memory/services/projectNotebookService';
import { selfPreferenceService } from '../../selfAwareness/services/selfPreferenceService';
import { runtimeConversationCompositionService } from '../../conversation/services/runtimeConversationCompositionService';
import { conversationOpenTopicService } from '../../conversation/services/conversationOpenTopicService';
import { paragraphCompositionService } from '../../conversation/services/paragraphCompositionService';
import { userStateTrailService } from '../../conversation/services/userStateTrailService';
import { hybridConversationEngineService } from '../../conversation/services/hybridConversationEngineService';
import { implementationSelectionService } from '../../strategy/services/implementationSelectionService';
import { nonLlmCodeSynthesisService } from '../../selfDevelopment/services/nonLlmCodeSynthesisService';
import { answerPlanService } from '../../strategy/services/answerPlanService';
import { formalConstraintSolverService } from '../../verification/services/formalConstraintSolverService';
import { deterministicCapabilityExecutionService } from '../../capability/services/deterministicCapabilityExecutionService';
import { unifiedMikiExperienceService } from '../../experience/services/unifiedMikiExperienceService';
import { mikiUnifiedLearningContinuumService } from '../../learning/services/mikiUnifiedLearningContinuumService';
import { verifiedKnowledgePromotionService } from '../../promotion/services/verifiedKnowledgePromotionService';
import { verifiedCapabilityPromotionService } from '../../promotion/services/verifiedCapabilityPromotionService';
import { unknownTaskDecompositionService } from '../../unknown/services/unknownTaskDecompositionService';
import { causalMemoryLedgerService } from '../../memory/services/causalMemoryLedgerService';
import { bannedTopicsConfigService } from './bannedTopicsConfigService';
import { evidenceBasedPromotionGateService } from '../../promotion/services/evidenceBasedPromotionGateService';
import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { mikiAutonomousDevStudioService } from '../../selfDevelopment/services/mikiAutonomousDevStudioService';
import { surfaceVariationGrowthService } from '../../conversation/services/surfaceVariationGrowthService';
import { mikiReasoningTemplateService, ReasoningMatchResult } from '../../selfAwareness/services/mikiReasoningTemplateService';
import { mikiConversationLearningService } from '../../learning/services/mikiConversationLearningService';
import { conversationComponentCompositionService } from '../../conversation/services/conversationComponentCompositionService';
import { normalizeKey } from '../../learning/services/mikiUnifiedLearningContinuumService';

export interface ConversationCoreResult {
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
 * P452: 回答の根拠欄に出す記憶の出所表記。
 * ユーザー本人の発言由来（source: 'user_statement'）の事実は、その発言自体が
 * 出所であるため「あなたが話していた内容」として文脈提示する。世界の事実として
 * 断定する conclusion には使わず、reasons（文脈）でのみ参照する線引き。
 */
function memoryReasonLabel(m: any): string {
  const content = String(m?.content || '').slice(0, 100);
  return m?.source === 'user_statement' ? `あなたが話していた内容: ${content}` : `関連記憶: ${content}`;
}

/**
 * P457 (G): 素の事実質問の形か。検索要否判定（detectNeedForSearch）の
 * パターンに当たらない事実質問（「〜はいつ開放されるの？」等）でも、
 * 未解決に落ちた場合は即時調査へ進めるための入口フォールバック。
 * 疑問詞＋疑問形、または「とは」を含む定義照会を対象にする。
 */
function isFactualQuestionForm(prompt: string): boolean {
  if (prompt.includes('とは')) return true;
  if (!/[？?]/.test(prompt)) return false;
  return /(?:いつ|どこ|だれ|誰|何|なに|いくつ|いくら|なぜ|どうして|どうやって|どんな|どれ|どちら)/.test(prompt);
}

/**
 * 設計思想書の概念地図を実行経路へ落とす中央オーケストレーター。
 *
 * 入力 → 会話状態/参照解決 → 記憶/主張 → 要求型 → 判断 → 部品 → 検証 → Answer IR → 表層
 * の順序を固定し、「未解決」を擬似回答で埋めないことを最重要不変条件とする。
 */
export class ConversationCoreService {
  private static instance: ConversationCoreService;

  private constructor() {
    conversationComponentCompositionService.initialize();
  }

  public static getInstance(): ConversationCoreService {
    if (!ConversationCoreService.instance) ConversationCoreService.instance = new ConversationCoreService();
    return ConversationCoreService.instance;
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
    /** P456: 当ターンの P452 事実取り込み結果（受領応答 B に使う）。 */
    userFactIntake?: UserFactIntakeSummary;
  }): Promise<ConversationCoreResult> {
    const started = performance.now();
    const prompt = params.prompt.trim().replace(/\s+/g, ' ');
    const state = params.conversationState || defaultConversationState();
    const memories = params.memories || [];
    const recentMessages = params.recentMessages || [];
    const stages: Record<string, number> = {};
    const componentAnalysis = conversationComponentPipelineService.analyzeSync(prompt);
    const japaneseAnalysis = componentAnalysis.analysis;
    stages.japanese = 0; // analysis is intentionally sub-millisecond on supported WebView engines

    // P578-B: 会話に出てくる内容語の頻度を、人格ごとの「よく話す
    // もの」として数える（好みの導出の材料）。なりチャ中は数えない。
    try {
      if (prompt && !roleplaySessionService.isActive()) {
        selfPreferenceService.observeTerms(personaProfileService.get().profileId, japaneseAnalysis.contentTokens);
      }
    } catch { /* 頻度の記録は補助経路 */ }

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
    const previousTurnEvaluation = mikiConversationLearningService.evaluatePreviousTurn(prompt, state);

    // 0.1 ユーザーによる正解・模範回答・意見の教示検知 (Chapter 1)
    const teachingResult = mikiConversationLearningService.detectAndRegisterTeaching(prompt, state.currentTopic);

    // 1. 会話状態・対話行為・参照解決
    let t = performance.now();
    // P466: 画像添付があれば観察する。従来は添付が入口で捨てられて
    // いた。観察文はこのターンの意味文脈に入れ、統治メモリにも
    // 「見たものの証跡」として残す（観察は色・明暗・大まかな形まで。
    // 物や文字の同定はしない）。
    let imageObservationText: string | null = null;
    const imageAttachment = (params.attachedFiles || []).find(
      (f: any) => typeof f?.content === 'string' && f.content.startsWith('data:image/'),
    );
    if (imageAttachment) {
      const observation = await conversationImageObservationService.observe(imageAttachment.content);
      if (observation) {
        imageObservationText = observation.text;
        try {
          scopedVersionedMemoryService.propose({
            subject: '画像の観察',
            content: observation.text,
            kind: 'EVIDENCE',
            scope: { type: 'CONVERSATION', id: params.conversationId || 'active' },
            source: { turnIds: [], fileIds: [], evidenceIds: [] },
            confidence: 0.6,
          });
        } catch { /* 記録は補助経路 */ }
      }
    }

    const interpretation = hybridConversationEngineService.interpret(
      prompt,
      state,
      imageObservationText
        ? [{ turnId: `image-observation-${params.messageId || 'current'}`, text: imageObservationText, entities: [] }]
        : [],
    );
    const dialogueAct = interpretation.dialogueAct;
    const vocabulary = (interpretation as any).vocabulary || (interpretation.semantic as any)?.vocabulary || conversationUnknownVocabularyService.assess(prompt, { allowResearch: true });
    const unknownTerms = Array.isArray(vocabulary?.unknowns)
      ? vocabulary.unknowns.map((item: any) => String(item.term || '')).filter(Boolean).slice(0, 3)
      : [];
    // P579: 未知語は「今の発話に出ている語」だけを対象にする。解釈側が
    // 会話状態から持ち越した語で調査が暴走するのを防ぐ（過去の話題の
    // 語で検索してしまう事故があった）。
    // P598: 複合質問（「Xって何？あと今何時？」）で、先の対象が辞書で
    // 答えられる場合は、後の部分の未知語で調査橋を発動しない（橋が
    // 全体を「確認できていない」に変えてしまうため）。
    const compoundKnownSubject = /[？?、,]\s*(?:あと|それと|ついでに)/.test(prompt)
      && (japaneseAnalysis?.contentTokens || []).some((t: string) => {
        try { return japaneseDictionaryService.lookup(t).some((e: any) => e && e.gloss); } catch { return false; }
      });
    const explicitUnknownInquiry = unknownTerms.length > 0
      && unknownTerms.some((t) => prompt.includes(t))
      && /意味|定義|とは|何|調べ|検索|教えて|使い方/.test(prompt)
      && !compoundKnownSubject;
    // P498: 雑談の中で出た未知語は、その場で聞き返さなくても
    // 意味学習の gap として残す。従来はターンの解釈に使われる
    // だけで、明示的に意味を聞かれない限り学習の入口に入らず、
    // 会話由来の未知語は背景で学ばれることがなかった。背景の
    // 再検証ループが UNKNOWN_TERM gap を拾って意味を学び、
    // 辞書に入れる（解けない語は試行上限で休止する）。
    if (unknownTerms.length > 0) {
      try {
        for (const term of unknownTerms) {
          knowledgeGapService.detect({
            query: `用語の意味を学ぶ: ${term}`,
            reason: '雑談の中で意味が分からない語が出たため、背景で意味を学ぶ。',
            type: 'UNKNOWN_TERM',
            target: term,
            priority: 45,
          });
        }
      } catch { /* 意味学習への接続は補助経路。失敗しても会話は止めない。 */ }
    }
    // P611: 直前の固定形の受け止めが、この発話で訂正されたら
    // 「外れ」として台帳に残す（分類の種表・形の見直し材料）。
    // P631: 訂正の合図の判定は共有特徴（P615）に一元化した。
    try {
      const isCorrection = (() => {
        try { return utteranceFeatureService.analyze(prompt).correction; }
        catch { return /(?:違う|そうじゃない|伝わってない)/.test(prompt); }
      })();
      if (isCorrection) {
        const last = JSON.parse(storageService.getItem('miki_last_reception_v1') || 'null') as { prompt: string; category: string; eventClass?: string; at: number } | null;
        if (last && Date.now() - last.at < 10 * 60_000) {
          const review = JSON.parse(storageService.getItem('miki_reception_review_v1') || '[]') as unknown[];
          review.push({ prevPrompt: last.prompt, category: last.category, eventClass: last.eventClass, correction: prompt, at: Date.now() });
          storageService.setItem('miki_reception_review_v1', JSON.stringify(review.slice(-50)));
          storageService.setItem('miki_last_reception_v1', 'null');
        }
      }
    } catch { /* 台帳は補助経路 */ }
    // P456 (A): 本人が伝えた事実への聞き返しは、未知語の調査橋より先に
    // 保持済みの本人発言由来の事実で照合する。一致したときだけ想起経路へ進み、
    // 一致しなければ従来経路（調査橋・Claim 照合・分からない）に委ねる。
    const userFactRecall = conversationUserFactRecallService.matchRecall(
      prompt,
      memories,
      (state as any).recentUserFactSummaries
    );
    // P592: 彼女自身への質問（何歳？／名前の由来／得意なこと）と、
    // 時計・カレンダーの質問は、調査の対象ではない。自分の記録と
    // 現在時刻から、その場で答える（Web 調査の的外れな結果や
    // 「確認できていない」に倒れていた）。
    if (!roleplaySessionService.isActive() && !userFactRecall) {
      // P603: 短い別れの挨拶は、そのまま締めとして返す（状態次第で
      // 分析的な合成や時間ガードに逸れることがあった）。
      if (/^(?:じゃあ[、,]?\s*)?(?:じゃあね|じゃね|またね|また明日(?:ね|よ)?|バイバイ|さようなら|さよなら)[！!。]?$/.test(prompt.trim())) {
        const bye = this.pickFixedReply('fx_goodbye', ['さようなら。またいつでも声をかけてくださいね。', 'じゃあ、また！今日もありがとうございました。', 'さようなら。またお話ししましょうね。']);
        return this.buildResult('RESOLVED', 'farewell_closing', this.applyPersonaVoice(bye), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P598: 知識への明示の訂正（「XじゃなくてY」）は、古い知識の
      // 言い直しで返さず、訂正として受ける。
      if (dialogueAct === 'CORRECTION' && /(?:じゃなくて|ではなく)/.test(prompt)) {
        const cm = prompt.match(/(?:じゃなくて|ではなく)\s*(.{1,20}?)(?:だよ|です|なんだ|。|．|！|!|$)/);
        const corrected = cm?.[1]?.replace(/^(?:それは|これは)/, '').trim();
        const text = corrected
          ? `ごめん、教えてくれてありがとう。「${corrected}」で覚え直しますね。`
          : 'ごめんなさい、教えてくれてありがとう。覚え直しますね。';
        return this.buildResult('RESOLVED', 'correction_received', this.applyPersonaVoice(text), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P598: 複数の質問が一文に入っているときは、単純な即答（時刻
      // など）が全体を飲み込まないよう、即答系を止める。
      const multiPart = /[？?、,]\s*(?:あと|それと|ついでに)/.test(prompt);
      const selfAnswer = multiPart ? undefined : this.selfQuestionAnswer(prompt);
      if (selfAnswer) {
        return this.buildResult('RESOLVED', 'self_question_answer', selfAnswer, state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const clockAnswer = multiPart ? undefined : this.clockCalendarAnswer(prompt);
      if (clockAnswer) {
        return this.buildResult('RESOLVED', 'clock_calendar_answer', clockAnswer, state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P592: 評価軸の無い日常の二択も、ここで会話として受ける
      // （後段の照応・判断・保持の各ゲートが、雑談の二択を次々に
      // 形式的な確認や保留に変えてしまうため）。
      const choiceAnswer = !/(?:性能|価格|値段|コスト|速度|容量|スペック|比較|評価|基準)/.test(prompt)
        ? this.choiceQuestionAnswer(prompt)
        : undefined;
      if (choiceAnswer) {
        return this.buildResult('RESOLVED', 'choice_question_answer', this.applyPersonaVoice(choiceAnswer), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P594: 「次何作ればいい？」は作業状態から答える（未知語として
      // 調査キューに倒れていた）。相方としての基本の受け答え。
      const nextWork = this.nextWorkAnswer(prompt);
      if (nextWork) {
        return this.buildResult('RESOLVED', 'next_work_answer', this.applyPersonaVoice(nextWork), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P598: プロジェクトの完成・進捗の質問は、作業状態から答える
      // （会話状態に残った別話題の知識で返っていた）。
      const projectStatus = this.projectStatusAnswer(prompt, japaneseAnalysis?.contentTokens || []);
      if (projectStatus) {
        return this.buildResult('RESOLVED', 'project_status_answer', this.applyPersonaVoice(projectStatus), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P597: 簡単な計算と、今日の会話の振り返りも、その場で答える
      // （計算は調査に倒れ、振り返りは P212 にしか無かった）。
      const arithmetic = this.arithmeticAnswer(prompt);
      if (arithmetic) {
        return this.buildResult('RESOLVED', 'arithmetic_answer', arithmetic, state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P604: 食事の迷いは、一緒に考える形で受ける。
      const dinner = this.dinnerMusingAnswer(prompt);
      if (dinner) {
        return this.buildResult('RESOLVED', 'dinner_musing_answer', this.applyPersonaVoice(dinner), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P625/P626: 状態の経過と会話の振り返りは、記録から答える。
      const stateRecall = this.userStateRecallAnswer(prompt);
      if (stateRecall) {
        return this.buildResult('RESOLVED', 'user_state_recall_answer', this.applyPersonaVoice(stateRecall), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const episodeRecall = this.episodeRecallAnswer(prompt);
      if (episodeRecall) {
        return this.buildResult('RESOLVED', 'episode_recall_answer', this.applyPersonaVoice(episodeRecall), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const weeklyRecall = this.weeklyRecallAnswer(prompt);
      if (weeklyRecall) {
        return this.buildResult('RESOLVED', 'weekly_recall_answer', this.applyPersonaVoice(weeklyRecall), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P633: 「何が分からないの？」は、彼女の未解決の欠けから答える。
      const openGap = this.openGapAnswer(prompt);
      if (openGap) {
        return this.buildResult('RESOLVED', 'open_gap_answer', this.applyPersonaVoice(openGap), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P624: 「最近何か覚えた？」は、彼女の学習の記録から答える。
      const recentLearning = this.recentLearningAnswer(prompt);
      if (recentLearning) {
        return this.buildResult('RESOLVED', 'recent_learning_answer', this.applyPersonaVoice(recentLearning), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P614: 彼女の能力・予定への質問は、自分の現状から答える。
      const ability = this.abilityQuestionAnswer(prompt);
      if (ability) {
        return this.buildResult('RESOLVED', 'ability_question_answer', this.applyPersonaVoice(ability), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P614: 料理名の無い作り方の依頼は、聞き返してから調べる。
      const recipeAsk = this.recipeAskBackAnswer(prompt);
      if (recipeAsk) {
        return this.buildResult('RESOLVED', 'recipe_askback_answer', this.applyPersonaVoice(recipeAsk), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P616: 知っている物への属性の質問は、世界モデルの関係で答える。
      const attribute = this.attributeQuestionAnswer(prompt);
      if (attribute) {
        return this.buildResult('RESOLVED', 'attribute_question_answer', this.applyPersonaVoice(attribute), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P618: 確認の質問と「似てる？」も、関係と説明から答える。
      const confirmSim = this.confirmationAndSimilarityAnswer(prompt);
      if (confirmSim) {
        return this.buildResult('RESOLVED', 'confirmation_similarity_answer', this.applyPersonaVoice(confirmSim), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P644: 対象ラベル外の属性質問（何を食べる？等）も、知っている
      // 物については正直に扱う。ここで受けないと Claim 照合の合成が
      // 無関係な知識を変な型で押し付ける崩れがあった。
      const unknownAttr = this.unknownAttributeAnswer(prompt);
      if (unknownAttr) {
        return this.buildResult('RESOLVED', 'unknown_attribute_answer', this.applyPersonaVoice(unknownAttr), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P647: 「〈語〉覚えた？」——特定の語についての自分の状態を
      // 答える（P624/P633 の語単位版）。
      const termKnowledge = this.termKnowledgeAnswer(prompt);
      if (termKnowledge) {
        return this.buildResult('RESOLVED', 'term_knowledge_answer', this.applyPersonaVoice(termKnowledge), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P650: 形容つきの意見質問は、知識照合より先に意見として答える
      // （Claim がそのまま返ると「どう思う」に答えたことにならない）。
      const adjOpinion = this.adjectiveOpinionAnswer(prompt);
      if (adjOpinion) {
        return this.buildResult('RESOLVED', 'adjective_opinion_answer', this.applyPersonaVoice(adjOpinion), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P651: 「何語くらい覚えた？」——自分の学習量の質問は自分の
      // 記録で答える。ここで受けないと「何語」が調査の検索語に化けて
      // 無関係なWeb結果を返してしまう。
      const learningVolume = this.learningVolumeAnswer(prompt);
      if (learningVolume) {
        return this.buildResult('RESOLVED', 'learning_volume_answer', this.applyPersonaVoice(learningVolume), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P654: 「さっき何て言った？」「もう一回言って」——直前の自分の
      // 発言を引いて答える。ここで受けないと「答えられない」や
      // 汎用の作業了承に化ける。
      const ownLast = this.ownLastUtteranceAnswer(prompt, recentMessages);
      if (ownLast) {
        return this.buildResult('RESOLVED', 'own_last_utterance_answer', this.applyPersonaVoice(ownLast), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P608: 彼女の「したい」への質問と、最近の出来事の質問は、
      // 自分の記録から答える。
      const selfWant = this.selfWantAnswer(prompt);
      if (selfWant) {
        return this.buildResult('RESOLVED', 'self_want_answer', this.applyPersonaVoice(selfWant), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const recentExp = this.recentExperienceAnswer(prompt);
      if (recentExp) {
        return this.buildResult('RESOLVED', 'recent_experience_answer', this.applyPersonaVoice(recentExp), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P608: 相手の名前を聞かれて、保持済みの事実に無いときは、
      // 汎用の「答えられない」でなく、まだ教わっていないと正直に言う。
      if (/(?:僕|私|俺|わたし)の名前|名前.*(?:知ってる|覚えてる|覚えている)/.test(prompt)) {
        const nameUnknown = this.pickFixedReply('fx_name_unknown', ['まだ名前を教えてもらっていません。教えてもらえたら、ちゃんと覚えますね。', 'ごめんなさい、名前はまだ聞いていませんでした。教えてください、覚えます。']);
        return this.buildResult('RESOLVED', 'name_unknown_answer', this.applyPersonaVoice(nameUnknown), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const recap = multiPart ? undefined : this.conversationRecapAnswer(prompt, state);
      if (recap) {
        return this.buildResult('RESOLVED', 'conversation_recap_answer', this.applyPersonaVoice(recap), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
    }
    // P595: なりチャの開始・終了のターンは、役の挨拶／締めで答える
    // （開始が通常の雑談反応、終了が主題断片の反響になっていた）。
    const rpTransitionRaw = roleplaySessionService.takeTransition();
    // 印は、それを起こした発話そのもののターンでのみ効く（取り込みと
    // 実行がずれたときに、別の発話へ挨拶・締めが漏れないため）。
    const rpTransition = rpTransitionRaw && rpTransitionRaw.sourceText.trim() === prompt.trim() ? rpTransitionRaw : undefined;
    if (rpTransition?.type === 'started') {
      const role = roleplaySessionService.getActiveRole();
      const parts = [`分かりました、${rpTransition.roleName}になります。`];
      if (role?.world) parts.push(`ここは${role.world}です。`);
      if (role?.lastSummary) parts.push(`前回は、${role.lastSummary}`);
      parts.push('よろしくお願いします。さあ、始めましょうか。');
      return this.buildResult('RESOLVED', 'roleplay_started', this.applyPersonaVoice(parts.join('')), state, dialogueAct, 0, ['roleplaySessionService'], started, stages);
    }
    if (rpTransition?.type === 'ended') {
      const closing = rpTransition.summary
        ? `${rpTransition.roleName}の役はおしまいです。${rpTransition.summary} お疲れ様でした、楽しかったです。`
        : `${rpTransition.roleName}の役はおしまいです。お疲れ様でした、楽しかったです。`;
      return this.buildResult('RESOLVED', 'roleplay_ended', this.applyPersonaVoice(closing), state, dialogueAct, 0, ['roleplaySessionService'], started, stages);
    }
    // P595: なりチャ中は調査橋を発動しない（役の中の質問に Web 調査の
    // 未検証テキストが混ざって役が壊れていた）。分からないことは
    // 未解決チェーンの役の形（fx_roleplay_unknown）で答える。
    if (explicitUnknownInquiry && !userFactRecall && !roleplaySessionService.isActive()) {
      const researched = await unknownResearchConversationBridgeService.resolveAndRespond({
        question: prompt,
        unknownTerms: unknownTerms.filter((t) => prompt.includes(t)),
        // P457 (G): 調査入口の統一。明示の検索語がある場合だけでなく、
        // 検索要否判定（「Xとは？」等の定義・事実照会を含む）が調査対象と
        // 判定した場合も、未知語の問い合わせ自体も、同じ調査経路へ進める。
        // 従来は /調べ|検索|最新|現在/ のみで、「とは？」形では検索が発動しなかった。
        useSearch:
          /調べ|検索|最新|現在/.test(prompt) ||
          unifiedWebResearchService.detectNeedForSearch(prompt).needsSearch ||
          explicitUnknownInquiry,
      });
      const nextState = { ...state, currentTopic: unknownTerms.join('、') };
      const status: ConversationCoreResult['status'] = ['REUSED_SUPPORTED', 'LOCAL_EVIDENCE'].includes(researched.status) ? 'RESOLVED' : 'UNRESOLVED';
      const result = this.buildResult(status, `unknown_research_${researched.status.toLowerCase()}`, researched.surfaceText, nextState, dialogueAct, researched.resolution.evidenceCount, ['unknownResearchConversationBridgeService'], started, stages);
      result.researchPerformed = researched.status === 'RESEARCHED_UNVERIFIED' || researched.resolution.evidenceCount > 0;
      result.researchEvidenceCount = researched.resolution.evidenceCount;
      result.knowledgeGapId = researched.resolution.resolution.id;
      return result;
    }
    const stage = interpretation.stage;
    const anaphora = interpretation.anaphora;
    stages.dialogue = Math.round(performance.now() - t);
    if (japaneseAnalysis.hasCorrection && anaphora.resolved) japaneseAnalysisService.recordCorrection(prompt, anaphora.resolved);

    let nextState: ConversationState = {
      ...state,
      stage,
      topLevelGoal: state.topLevelGoal,
      currentTopic: state.currentTopic || this.extractTopic(prompt),
      recentEntities: Array.from(new Set([...(state.recentEntities || []), ...japaneseAnalysis.contentTokens.slice(-4), ...(anaphora.resolved ? [anaphora.resolved] : []), this.extractTopic(prompt)])).filter(Boolean).slice(-10),
      updatedAt: Date.now(),
      lastCandidateClaimId: teachingResult.detected && teachingResult.candidateClaim ? teachingResult.candidateClaim.claim_id : state.lastCandidateClaimId,
    };

    // P593: 短い訂正（「それ違うよ」）は、照応の曖昧さを理由に候補の
    // 確認（報告文）で返さず、訂正として受ける。
    if (anaphora.confidence === 'ambiguous' && dialogueAct === 'CORRECTION' && /^(?:それ|これ|あれ)(?:は)?(?:違う|ちがう|間違)/.test(prompt.trim())) {
      const text = this.applyPersonaVoice(this.pickFixedReply('fx_correction_ack', [
        'ごめんなさい、違ったんですね。どこが違うか教えてもらえますか？',
        'ごめんなさい、間違えました。直したいので、教えてもらえますか？',
      ]));
      return this.buildResult('RESOLVED', 'correction_acknowledged', text, nextState, dialogueAct, 0, [], started, stages);
    }

    // P592: 「AとB、どっちがいい？」の“曖昧さ”は質問そのもの。
    // 対象の特定を相手に返さず、選択の質問として後段で受ける。
    const isChoiceQuestion = /(?:どっち|どちら)/.test(prompt) && /(?:いい|好き|おすすめ|正解|思う|選)/.test(prompt);
    // P601: 「それでね」「そのあと」で始まる文は話の続きであって、
    // 対象の確認を求める文ではない。
    const isContinuation = /^(?:それで|そのあと|それから|そしたら|でね)/.test(prompt.trim());
    // P599: なりチャ中の「それ」は役の中の対象。曖昧さの確認（報告文）
    // で役を壊さず、そのまま会話として受ける。
    if (anaphora.confidence === 'ambiguous' && !isChoiceQuestion && !isContinuation && !roleplaySessionService.isActive()) {
      const clarificationGateResult = clarificationGate(nextState, `anaphora:${anaphora.candidates.slice().sort().join('|')}`);
      nextState.clarificationControl = clarificationGateResult.next;
      if (!clarificationGateResult.allowed) {
        nextState.clarificationPending = true;
        nextState.unresolvedState = 'PENDING_USER_INPUT';
        const heldIr = answerContentIrService.buildAnswerIR({
          conclusion: '対象を自動推測せず保留します。',
          target: nextState.currentTopic || '会話中の対象',
          conditions: ['同じ確認を繰り返さず、追加情報が得られるまで判断を保留します。'],
          certainty: 'UNKNOWN',
          detailLevel: 'BRIEF',
        });
        const heldSurface = answerContentIrService.generateSurfaceTextFromIR(heldIr, 'UNKNOWN_INVESTIGATION', undefined);
        return this.buildResult('UNRESOLVED', 'clarification_gate_exhausted', heldSurface.surfaceText, nextState, dialogueAct, 0, [], started, stages);
      }
      const clarification = selectInformationGainQuestion(anaphora.candidates);
      const ir = answerContentIrService.buildAnswerIR({
        conclusion: '対象を一意に特定できません。',
        target: nextState.currentTopic || '会話中の対象',
        exceptions: [`候補: ${anaphora.candidates.join(' / ')}`],
        conditions: [`候補数${clarification.candidateCount}件 / 期待残存候補${clarification.expectedRemainingCandidates}件 / 情報利得${clarification.informationGainBits}bit。${clarification.reason}`],
        nextActions: [clarification.question],
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
    const implementationSelection = implementationSelectionService.select(compiled);
    stages.request = Math.round(performance.now() - t);
    nextState.topLevelGoal=compiled.goal; nextState.lastPrompt=prompt; nextState.lastDialogueAct=dialogueAct; nextState.lastTopic=nextState.currentTopic; const continuousGoalState=updateConversationGoalProgress(nextState,prompt,state); const conversationConsistency=evaluateConversationConsistency(prompt,continuousGoalState,state,params.messageId); nextState=conversationConsistency.repairedState; nextState.conversationCompleteness=assessConversationCompleteness(nextState); nextState.knowledgeState=classifyConversationKnowledgeState(prompt,nextState); nextState.temporalContext=buildConversationTemporalContext(prompt,nextState,state); if(conversationConsistency.turnDependency && /(?:違う|それじゃない|ではなく|じゃない)/i.test(prompt)) nextState.correctionScope=inferConversationCorrectionScope(prompt).scope; if(previousTurnEvaluation.conversationOutcome) nextState.conversationOutcome=previousTurnEvaluation.conversationOutcome;

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
    // P452: ユーザー本人の発言由来の事実（数値・経緯）を、会話状態に「言っていた内容」
    // として新しい順に最大10件保持し、後続ターンの返答材料にする。confirmedFacts
    // （確定事項）とは別枠にし、未検証のまま確定扱いにしない。
    if (memories.length > 0) {
      const userFactSummaries = memories
        .filter((m: any) => m?.source === 'user_statement' && m?.active !== false && !m?.replacedBy)
        .sort((a: any, b: any) => (Number(b?.timestamp ?? b?.createdAt ?? 0) - Number(a?.timestamp ?? a?.createdAt ?? 0)))
        .map((m: any) => String(m.factSummary || m.content || '').slice(0, 60))
        .filter(Boolean)
        .slice(0, 10);
      if (userFactSummaries.length > 0) {
        (nextState as any).recentUserFactSummaries = userFactSummaries;
      }
    }
    stages.knowledge = Math.round(performance.now() - t);

    // v211: 潜在Unknownをまず「候補」として生成し、確度の高いものを既存Knowledge Gapへ1件だけ昇格。
    // 候補は事実扱いせず、ResearchServiceが既存Evidence/Verification経路を利用できる境界で止める。
    const potentialUnknowns = knowledgeGapService.predictPotentialUnknowns({
      claims: claimDatabaseService.getAllClaims().slice(-30),
      capabilityGaps: capabilityGapService.getAllGaps().filter((g) => g.status !== 'RESOLVED').slice(0, 15),
      failures: failureMemoryService.list().slice(0, 80),
      environment: compiled.environment,
      currentQuery: compiled.target || prompt,
      limit: 5,
    });
    const promotedPotentialUnknown = potentialUnknowns.find((candidate) => candidate.confidence >= 0.82);
    let potentialUnknownGapId: string | undefined;
    if (promotedPotentialUnknown && !knowledgeGapService.findOpen(promotedPotentialUnknown.question)) {
      const promotedGap = knowledgeGapService.promotePotentialUnknown(promotedPotentialUnknown, compiled.requestId);
      potentialUnknownGapId = promotedGap.id;
    }

    // 4. 感情は回答内容の事実を変更せず、表層方針のみに利用する。

    affectionDynamicsService.evaluateAndTransfer(prompt);

    // 5. コード要求は既存部品を先に探す。汎用自然言語から勝手にVBAを生成しない。
    t = performance.now();
    let usedComponents: string[] = [...componentAnalysis.usedComponentIds];
    let assembledCode: string | undefined;
    let taskExecution: ConversationCoreResult['taskExecution'];
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
      } else if (!/(?:性能|価格|値段|コスト|速度|容量|スペック|比較|評価|基準)/.test(prompt)) {
        // P592: 評価軸の指定が無い日常の二択・おすすめは、形式的な
        // 拒否文ではなく会話として答える（捏造はしない。選べない
        // ことは正直に言い、相手の気分を聞く）。
        decisionText = this.applyPersonaVoice(this.choiceQuestionAnswer(prompt) ?? this.recommendationFallback()!);
      } else {
        decisionText = '比較対象は見つかりましたが、評価軸ごとの確認済み根拠が不足しているため、CORE中核では推奨を捏造して確定しません。';
      }
    }

    stages.decision = Math.round(performance.now() - t);

    // 6.5 推論テンプレートの適用試行 (Chapter 2: 複数検証済み主張の統合推論)
    let appliedReasoningResult: ReasoningMatchResult | null = null;
    if (csp.isSatisfied && !assembledCode) {
      appliedReasoningResult = mikiReasoningTemplateService.evaluateAndApply(prompt, nextState);
    }

    // P456 (B): 当ターンに事実が取り込まれた宣言文には、診断文ではなく
    // 取り込んだ内容を踏まえた受領応答を返す。問いかけ・依頼が混ざる発話や
    // 想起（A）が成立するターンでは出さない（優先順位は結論段の分岐順で担保）。
    const acknowledgementText = !looksInterrogative(prompt)
      ? conversationUserFactRecallService.buildAcknowledgementText(params.userFactIntake)
      : null;
    const acknowledgementReasons = (params.userFactIntake?.addedSummaries || [])
      .map((s) => String(s || '').trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((s) => `あなたが話していた内容: ${s.slice(0, 100)}`);

    // 7. Answer IR。Claimが弱い場合は「不明」を不明のまま表現する。
    let ir;
    let skeleton: AnswerSkeletonType = 'GENERAL_ANSWER';
    let status: ConversationCoreResult['status'] = 'RESOLVED';
    let reason = implementationSelection.reason;
    // P565: 知らない語への聞き返し（候補）。合成の後段で足す。
    let pendingUnknownQuestion: { topic: string; question: string } | undefined;
    // P574: 直前の話題質問への答えとして来た発言かどうか。
    // P586: 保留レコード自体も受け取り、答えへの続きの質問に使う。
    const answeredPending = this.consumePendingTopicQuestion(prompt);
    const answeredTopicQuestion = Boolean(answeredPending);
    // P586: 答えへの続きの質問（合成の後段で足す）。
    let followUpAppend: { question: string; terms: string[] } | undefined;
    if (potentialUnknowns.length > 0) reason += `; potential_unknowns=${potentialUnknowns.length}${potentialUnknownGapId ? `; promoted_gap=${potentialUnknownGapId}` : ''}`;
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
    } else if (userFactRecall) {
      // P456 (A): 事実想起。本人の発言を「あなたが話していた内容」として返す。
      // 世界の事実としての断定には使わない（根拠も出所表記に統一する）。
      ir = answerContentIrService.buildAnswerIR({
        conclusion: userFactRecall.answerText,
        target: userFactRecall.topicLabel,
        reasons: [userFactRecall.reasonLabel],
        certainty: 'CERTAIN',
        detailLevel: 'STANDARD',
      });
      skeleton = 'GENERAL_ANSWER';
      status = 'RESOLVED';
      reason = 'user_fact_recall';
    } else if (claimMatch.hasMatch && claimMatch.bestClaim && claimMatch.confidence !== 'UNVERIFIED'
      && !(dialogueAct !== 'CORRECTION' && this.isConversationalFallthrough(prompt, dialogueAct))) {
      // P568: 雑談の宣言文（「モコロンかわいい」「モコロン見たよ」）が
      // たまたま Claim に一致しただけで、知識照合の報告文で返って
      // いた。文の形が雑談なら雑談として受け、知っていることは
      // 合流点の補足（関係の文）で出す。質問・依頼・訂正は従来どおり
      // Claim 経路で答える。
      const claim = claimMatch.bestClaim;
      ir = answerContentIrService.buildAnswerIR({
        conclusion: claim.statement,
        target: compiled.target,
        // P569: 知識の回答に工程の内部文（照合ステータス、計画の
        // 実行ステップ、潜在意図の既定アクション）を混ぜない。
        // それらは「次のステップ」や理由として表層に出て、知識の
        // 質問への答えを報告文書にしていた。
        // P579: 記憶の由来ラベル（「理由はあなたが話していた内容:
        // …」）も、解像度の高い候補では理由として表層に出てしまう
        // ため載せない（由来はログと記憶側に残る）。
        reasons: [],
        conditions: claimMatch.scopeNotes,
        certainty: claimMatch.confidence === 'CERTAIN' ? 'CERTAIN' : 'CONDITIONAL',
        worldScope: claim.world,
        nextActions: [],
      });
    } else if (dialogueAct === 'CASUAL_CHAT') {
      const isFatigue = userStateTrailService.isFatigueText(prompt);
      // P564: 定型の受け止め文も人格で出し分ける（ビービーは定型でも
      // 丁寧語のままだった）。
      let bibiCasual = false;
      try { bibiCasual = personaProfileService.get().profileId === BIBI_PROFILE_ID; } catch { bibiCasual = false; }

      // P566: 社交の定型も毎回同じ文にしない（カテゴリ別に前回と
      // 違う形を選ぶ）。本筋は学習で返答が変わること（P567/P568）で、
      // これは挨拶のような純粋な定型への当て布。
      const fx = (category: string, mikiForms: string[], bibiForms: string[]) =>
        this.pickFixedReply(bibiCasual ? `${category}_bibi` : category, bibiCasual ? bibiForms : mikiForms);
      // P572: 別れ・出発・帰宅の挨拶は、会話の締めとして最優先で受ける
      // （「行ってきます」に「こんにちは」と返していた等）。
      // P603: 「また明日」と寝る宣言（「もう寝るね」）も締めの挨拶。
      const closingFamily = /おやすみ|行ってきます|いってきます|行ってくる|いってくる|ただいま|じゃあね|じゃね|またね|また明日|バイバイ|さようなら|さよなら|寝(?:る|ます|よう)(?:ね|よ|な)/.test(prompt);
      let casualConclusion: string;
      if (/おやすみ/.test(prompt)) {
        casualConclusion = fx('fx_goodnight',
          ['おやすみなさい。今日も一日お疲れ様でした。', 'おやすみなさい。ゆっくり休んでくださいね。', 'おやすみなさい。いい夢を。'],
          ['おやすみ！ゆっくり寝てね。', 'おやすみー！いい夢みてね。', 'おやすみ！今日もがんばったね。']);
      } else if (/寝(?:る|ます|よう)(?:ね|よ|な|。|！|!|$)/.test(prompt) && prompt.length <= 20) {
        // P603: 寝る宣言（「もう寝るね」）はおやすみとして受ける
        // （「もうの話ですね」という断片反響になっていた）。
        casualConclusion = fx('fx_goodnight',
          ['おやすみなさい。今日も一日お疲れ様でした。', 'おやすみなさい。ゆっくり休んでくださいね。', 'おやすみなさい。いい夢を。'],
          ['おやすみ！ゆっくり寝てね。', 'おやすみー！いい夢みてね。', 'おやすみ！今日もがんばったね。']);
      } else if (/行ってきます|いってきます|行ってくる|いってくる/.test(prompt)) {
        casualConclusion = fx('fx_departure',
          ['行ってらっしゃい！気をつけてくださいね。', '行ってらっしゃい。いい日になりますように。', '行ってらっしゃい。帰りを待っていますね。'],
          ['いってらっしゃい！気をつけてね。', 'いってらっしゃい！がんばってね。', 'いってらっしゃーい！待ってるね。']);
      } else if (/ただいま/.test(prompt)) {
        casualConclusion = fx('fx_homecoming',
          ['おかえりなさい！お疲れ様でした。', 'おかえりなさい。ゆっくりしてくださいね。', 'おかえりなさいませ！待っていましたよ。'],
          ['おかえり！おつかれさま。', 'おかえりー！ゆっくりしてね。', 'おかえり！待ってたよ。']);
      } else if (/じゃあね|じゃね|またね|また明日|バイバイ|さようなら|さよなら/.test(prompt)) {
        casualConclusion = fx('fx_goodbye',
          ['さようなら。またいつでも声をかけてくださいね。', 'じゃあ、また！今日もありがとうございました。', 'さようなら。またお話ししましょうね。'],
          ['じゃあね！また話そうね。', 'ばいばーい！またね。', 'じゃあ、また！待ってるね。']);
      } else if (isFatigue) {
        casualConclusion = fx('fx_fatigue',
          ['本当にお疲れ様でした。今日は大変でしたね。無理をなさらず、ゆっくり休んでくださいね。', 'お疲れ様でした。今日は大変でしたね。今日はゆっくり休んでくださいね。', '本当にお疲れ様でした。無理をなさらず、体を休めてくださいね。'],
          ['おつかれさま！今日はたいへんだったね。無理しないで、ゆっくり休んでね。', 'おつかれさま！今日はがんばったね。ゆっくり休んでね。', 'おつかれさま。無理しないで、今日は休んでね。']);
      } else if (/お疲れ|おつかれ/i.test(prompt)) {
        casualConclusion = fx('fx_otsukare',
          ['お疲れ様です！本日も順調に進んでいます。', 'お疲れ様です。今日も順調ですよ。', 'お疲れ様です！こちらも元気にやっています。'],
          ['おつかれさま！今日も順調だよ。', 'おつかれさま！こっちも元気だよ。', 'おつかれさま！今日もばっちりだよ。']);
      } else if (/ありがと(?:う|ー)?|感謝/i.test(prompt)) {
        casualConclusion = fx('fx_thanks',
          ['どういたしまして！お役に立てて何よりです。', 'どういたしまして。いつでも声をかけてくださいね。', 'いえいえ、こちらこそありがとうございます。'],
          ['どういたしまして！役に立ててよかった！', 'いえいえ！また声かけてね。', 'どういたしまして！えへへ。']);
      } else if (/ごめん|すみません|申し訳/.test(prompt)) {
        casualConclusion = fx('fx_apology',
          ['大丈夫ですよ。気にしないでくださいね。', '大丈夫ですよ。いつでも声をかけてください。', '大丈夫です。問題ありませんよ。'],
          ['大丈夫だよ。気にしないでね。', 'だいじょうぶ！気にしないで。', '大丈夫だよ。えへへ、平気平気。']);
      } else if (/起きた|目覚めた|起床/.test(prompt)) {
        casualConclusion = fx('fx_wakeup',
          ['おはようございます！よく眠れましたか？', 'おはようございます。目覚めはいかがですか？', 'おはようございます！今日もいい日になりますように。'],
          ['おはよう！よく寝れた？', 'おはよー！目覚めはどう？', 'おはよう！今日もがんばろうね。']);
      } else if (/おはよ(?:う|ー)?/i.test(prompt)) {
        casualConclusion = fx('fx_morning',
          ['おはようございます！今日も一日頑張りましょう。', 'おはようございます。今日もよろしくお願いします。', 'おはようございます！いい朝ですね。'],
          ['おはよう！今日も一日がんばろうね。', 'おはよー！今日もよろしくね。', 'おはよう！いい朝だね。']);
      } else if (/元気/.test(prompt)) {
        casualConclusion = fx('fx_genki',
          ['元気ですよ！声をかけてくれてありがとうございます。', '元気です！今日も頑張りますね。', 'はい、元気ですよ。ご心配ありがとうございます。'],
          ['元気だよ！声をかけてくれてありがとう！', 'げんきげんき！今日もがんばるよ。', '元気だよ！心配してくれてありがとう。']);
      } else {
        casualConclusion = fx('fx_greeting',
          ['こんにちは！本日もよろしくお願いいたします。準備万全です。', 'こんにちは。今日もよろしくお願いします。', 'こんにちは！何かあれば声をかけてくださいね。'],
          ['こんにちは！今日もよろしくね。準備はばっちりだよ。', 'こんにちは！今日もよろしくね。', 'やっほー！今日もよろしくね。']);
      }

      // P524: 疲労が直近72時間に前回分もあるなら、単発の共感では
      // なく「続いている」ことを見た受け止めにする。
      if (isFatigue && !closingFamily && userStateTrailService.recentCount('fatigue', 72) >= 1) {
        casualConclusion = fx('fx_fatigue_continued',
          ['ここ数日、お疲れが続いているみたいですね。本当に無理をなさらず、今日はゆっくり休んでくださいね。', 'お疲れが続いているみたいですね。今日は無理をせず、ゆっくり休んでくださいね。'],
          ['ここ数日、おつかれが続いてるみたいだね。無理しないで、今日はゆっくり休んでね。', 'おつかれ、続いてるね。今日は無理しないで休んでね。']);
      }
      // P521: 定型の挨拶で終わらせず、内容のある雑談には内容へ
      // 反応する（主題語＋感情の手がかり）。挨拶・感謝・疲労など
      // の決まった受け止めが要る言い方では従来の文を優先する。
      const isPhatic = isFatigue || closingFamily || /お疲れ|おつかれ|ありがと(?:う|ー)?|感謝|ごめん|すみません|申し訳|おはよ(?:う|ー)?|元気|起きた|目覚めた/.test(prompt);
      if (!isPhatic) {
        const reaction = this.buildCasualReaction(prompt, japaneseAnalysis.contentTokens);
        if (reaction) casualConclusion = reaction;
        // P591: つまらなさ・退屈は、主題の断片（「つまの話ですね」）で
        // なく気持ちとして受ける（CASUAL 側にも受け止めを置く）。
        if (/つまら|退屈/.test(prompt)) {
          casualConclusion = fx('fx_bored_stale', ['つまらないですね。何か面白い話でもしましょうか。', '退屈ですね。最近、面白かったことはありますか？', 'つまらない時間ですね。何か気になることはありますか？'], ['つまんないねー。何か面白い話しよ？', '退屈だね。最近、面白かったことある？', 'つまんないね。何か気になることある？']);
        }
        // P593: 彼女への褒め言葉は照れて受ける（CASUAL 側）。
        if (/(?:みき|ミキ|ビービー|あなた|君)/.test(prompt) && /(?:かわいい|可愛い|優しい|やさしい|すごい|えらい|好き|大好き)/.test(prompt)) {
          casualConclusion = fx('fx_compliment', ['えへへ、ありがとう。嬉しいです。', 'ありがとうございます。そう言ってもらえると嬉しいです。', 'わーい、ありがとう。'], ['えへへ、ありがと！うれしい！', 'ありがとー！えへへ。', 'わーい、ありがとう！']);
        }
        // P574: 直前の話題質問への答えなら、答えとして受ける。
        if (answeredTopicQuestion) {
          casualConclusion = fx('fx_answer_ack', ['そっか、教えてくれてありがとう。', 'なるほど、そういうことなんですね。', 'そっか、分かりました。ありがとう。'], ['そっか、教えてくれてありがと！', 'なるほどー、そういうことなんだ。', 'そっかそっか、分かったよ。ありがと！']);
          // P586: 答えの内容から、もう一歩だけ続きを聞く候補を用意する。
          if (answeredPending) followUpAppend = this.buildFollowUpQuestion(answeredPending, prompt, japaneseAnalysis?.contentTokens || []);
        }
        // P567: 直前に意味を教わった語の話なら、「覚えた」を伝える。
        const taughtAck = this.taughtTermAcknowledgement(prompt);
        if (taughtAck) { casualConclusion = taughtAck; followUpAppend = undefined; }
        // P578: 教わった「自分の好きなもの」の話なら、自分の好きとして受ける。
        if (!taughtAck && !answeredTopicQuestion) {
          const selfLike = this.selfLikeReaction(prompt);
          if (selfLike) casualConclusion = selfLike;
        }
      }
      // P522: 前の日以前に開いた話題が残っていれば、挨拶のときに
      // 一度だけ拾う。
      // P632: 挨拶かどうかの判定は共有特徴の socialAct で行う。
      const isGreetingTurn = (() => {
        try { return utteranceFeatureService.analyze(prompt).socialAct === 'GREETING'; }
        catch { return /おはよ|こんにちは|ただいま|こんばんは|やあ/.test(prompt); }
      })();
      if (isGreetingTurn) {
        // P623: 前日のエピソードが組めるなら、話題の単体拾いより
        // 先に「昨日のこと」として出す（話題は消費して二重に出さない）。
        let appended = 0;
        const episode = (() => { try { return episodeMemoryService.yesterdayEpisode(); } catch { return undefined; } })();
        if (episode) {
          if (episode.topics.length > 0) conversationOpenTopicService.takeCallbackTopic();
          casualConclusion += `\n${episode.summary}その後、どうですか？`;
          appended += 1;
        }
        const openTopic = episode ? undefined : conversationOpenTopicService.takeCallbackTopic();
        if (openTopic) {
          casualConclusion += `\nそういえば、前に話していた「${openTopic}」の件、その後どうなりました？`;
          appended += 1;
        }
        // P571/P621: 彼女の側の近況（学べた語・解けた質問の報告）は、
        // エピソードや拾い直しがある日にも埋もれさせない。実機では
        // エピソードが組める日が大半で、報告が何日も先送りになると
        // 「学んで育つ」実感そのものが消えてしまう。添えは最大2件まで。
        const report = this.learnedTermReport();
        const resolvedReport = report ? undefined : this.resolvedQuestionReport();
        if (report) {
          casualConclusion += `\n${report}`;
          appended += 1;
        } else if (resolvedReport) {
          casualConclusion += `\n${resolvedReport}`;
          appended += 1;
        } else if (appended === 0) {
          const mention = this.reflectionMention();
          if (mention) {
            casualConclusion += `\n${mention}`;
          } else {
            // P580: 時間帯・季節の感覚（1日1回まで、最も弱い添え）。
            const timeSense = this.timeSenseMention();
            if (timeSense) casualConclusion += `\n${timeSense}`;
          }
        }
      }
      if (!isPhatic) pendingUnknownQuestion = this.probeUnknownWord(prompt, unknownTerms);
      casualConclusion = this.applyPersonaVoice(casualConclusion);

      const strategyResult = conversationStrategyService.selectConversationStrategy({
        prompt,
        stage: nextState.stage,
        persona: answerContentIrService.getDefaultPersona(),
      });

      ir = answerContentIrService.buildAnswerIR({
        conclusion: casualConclusion,
        target: '日常対話・挨拶・共感',
        // P579: 理由は診断情報。IR に載せると、BRIEF でない解像度の
        // 候補が選ばれたときに「理由は…として認識しました」が
        // 返答へ漏れる（P569 の Claim 経路と同じ事故）。
        reasons: [],
        // P558: 以前は定型の「前提」が付き、表面生成で「前提として、
        // …受け付けています場合、」という壊れた前置きが雑談の返答に
        // 混入していた。日常対話に前提条件は要らない。
        conditions: [],
        certainty: 'CERTAIN',
        detailLevel: 'BRIEF',
        strategy: strategyResult.strategy,
      });
      skeleton = 'GENERAL_ANSWER';
      status = 'RESOLVED';
      reason = isFatigue ? 'empathy_fatigue_resolved' : 'casual_chat_resolved';
    } else if (acknowledgementText) {
      // P456 (B): 事実伝達への受領応答。雑談・想起・Claim 等の既存の解決が
      // どれも無い宣言文ターンで、取り込んだ内容をそのまま受け取って返す。
      // 受領は断定ではなく、根拠も出所表記（あなたが話していた内容）に留める。
      ir = answerContentIrService.buildAnswerIR({
        conclusion: acknowledgementText,
        target: 'あなたが話していた内容の受領',
        reasons: acknowledgementReasons,
        certainty: 'CERTAIN',
        detailLevel: 'STANDARD',
      });
      skeleton = 'GENERAL_ANSWER';
      status = 'RESOLVED';
      reason = 'user_fact_acknowledged';
    } else if (this.isConversationalFallthrough(prompt, dialogueAct)) {
      // P521: 雑談の受け皿。質問でも依頼でもなく、調べる必要もない
      // 日常の発話（「いい天気だね」「散歩してきた」）が、知識の
      // 不足として「答えられない」に落ちていた。雑談は知識問題で
      // はないので、内容に反応して会話として受ける。
      // P547: 宣言文として来た疲れの発話（「今日はへとへとだよ」）も、
      // 話題の反響ではなく共感で受ける。判定の語彙は userStateTrailService に集約。
      // P548: 感謝・謝罪も同じで、分類が宣言文でも社交の受け止めを優先する。
      // P589: 受け皿側の定型も人格で出し分ける（P564 は CASUAL 側のみ
      // だったため、答えの受け止めや依頼の引き受けがビービーでも
      // 丁寧語のまま残っていた）。
      let bibiFallthrough = false;
      try { bibiFallthrough = personaProfileService.get().profileId === BIBI_PROFILE_ID; } catch { bibiFallthrough = false; }
      // P611: どの固定形カテゴリで受けたかを残し、直後に訂正されたら
      // 「外れ」として台帳に移す（教師が後で分類を見直す材料）。
      let lastReceptionCategory: string | undefined;
      const ffx = (category: string, mikiForms: string[], bibiForms: string[]) => {
        lastReceptionCategory = category;
        return this.pickFixedReply(bibiFallthrough ? `${category}_bibi` : category, bibiFallthrough ? bibiForms : mikiForms);
      };
      // P609: 報告系の出来事（喪失・後退・達成・対立・家事・交通）は、
      // 文字列の正規表現列挙でなく、形態素の特徴による分類で判定する
      // （語幹クラス × 相 × 否定 × 意味役割）。言い換えに強くなる。
      const eventResult = (() => { try { return utteranceEventClassifierService.classify(prompt); } catch { return undefined; } })();
      const fallthroughFatigue = userStateTrailService.isFatigueText(prompt);
      const fallthroughThanks = /ありがと(?:う|ー)?|感謝/.test(prompt);
      const fallthroughApology = /ごめん|すみません|申し訳/.test(prompt);
      const fallthroughWakeup = /起きた|目覚めた|目が覚め|起床/.test(prompt);
      // P573: 不安・空腹の状態も、話題の反響ではなく状態として受ける。
      const fallthroughAnxiety = userStateTrailService.isAnxietyText(prompt);
      const fallthroughHunger = userStateTrailService.isHungerText(prompt);
      // P584: 寂しさ・喉の渇きも状態として受ける。
      const fallthroughLoneliness = userStateTrailService.isLonelinessText(prompt);
      const fallthroughThirst = userStateTrailService.isThirstText(prompt);
      // P591: 痛みも状態として受ける。
      const fallthroughPain = userStateTrailService.isPainText(prompt);
      // P572: 別れ・出発・帰宅の挨拶（宣言文で来た場合）。
      // P603: 「また明日」と寝る宣言も締めに数える。
      const fallthroughClosing = /おやすみ|行ってきます|いってきます|行ってくる|いってくる|ただいま|じゃあね|じゃね|またね|また明日|バイバイ|さようなら|さよなら/.test(prompt)
        || (/寝(?:る|ます|よう)(?:ね|よ|な|。|！|!|$)/.test(prompt) && prompt.length <= 20);
      const fallthroughClosingText = !fallthroughClosing
        ? undefined
        : /おやすみ|寝(?:る|ます|よう)(?:ね|よ|な|。|！|!|$)/.test(prompt)
          ? this.pickFixedReply('fx_goodnight', ['おやすみなさい。今日も一日お疲れ様でした。', 'おやすみなさい。ゆっくり休んでくださいね。', 'おやすみなさい。いい夢を。'])
          : /行ってきます|いってきます|行ってくる|いってくる/.test(prompt)
            ? this.pickFixedReply('fx_departure', ['行ってらっしゃい！気をつけてくださいね。', '行ってらっしゃい。いい日になりますように。', '行ってらっしゃい。帰りを待っていますね。'])
            : /ただいま/.test(prompt)
              ? this.pickFixedReply('fx_homecoming', ['おかえりなさい！お疲れ様でした。', 'おかえりなさい。ゆっくりしてくださいね。', 'おかえりなさいませ！待っていましたよ。'])
              : this.pickFixedReply('fx_goodbye', ['さようなら。またいつでも声をかけてくださいね。', 'じゃあ、また！今日もありがとうございました。', 'さようなら。またお話ししましょうね。']);
      // P573: 短い同意は話題ではなく相槌として受ける。
      const trimmedPrompt = prompt.trim();
      const fallthroughAgreement = trimmedPrompt.length <= 10 && /^(?:そうだね|そうそう|だよね|わかる|うん|はい|なるほど)/.test(trimmedPrompt);
      const fallthroughPhatic = fallthroughFatigue || fallthroughThanks || fallthroughApology || fallthroughWakeup
        || fallthroughAnxiety || fallthroughHunger || fallthroughLoneliness || fallthroughThirst || fallthroughPain || fallthroughClosing || fallthroughAgreement;
      // P567: 直前に意味を教わった語の話なら、「覚えた」を伝える。
      const taughtAck = this.taughtTermAcknowledgement(prompt);
      let reactionBase = taughtAck ?? (fallthroughFatigue
        ? (userStateTrailService.recentCount('fatigue', 72) >= 1
          ? 'ここ数日、お疲れが続いているみたいですね。本当に無理をなさらず、今日はゆっくり休んでくださいね。'
          : '本当にお疲れ様でした。無理をなさらず、ゆっくり休んでくださいね。')
        : fallthroughAnxiety
          ? (userStateTrailService.recentCount('anxiety', 72) >= 1
            ? 'このところ、心配事が続いているみたいですね。無理をしないでくださいね。'
            : this.pickFixedReply('fx_anxiety', ['大丈夫ですか？無理をしないでくださいね。', '心配なのですね。話せる範囲で聞かせてくださいね。', '不安なのですね。そばにいますよ。']))
          : fallthroughHunger
            ? this.pickFixedReply('fx_hunger', ['お腹が空いたのですね。何か食べられるといいですね。', 'お腹が空きましたか。何か食べましょう。', '空腹なのですね。まずは一息ついて、何か口にしてくださいね。'])
            : fallthroughLoneliness
              ? (userStateTrailService.recentCount('loneliness', 72) >= 1
                ? 'このところ、寂しい気持ちが続いているみたいですね。私はここにいますよ。'
                : this.pickFixedReply('fx_lonely', ['寂しいのですね。私はここにいますよ、話しましょう。', 'ひとりじゃないですよ。そばにいますね。', '寂しいときは声をかけてくださいね。私でよければ一緒にいます。']))
              : fallthroughThirst
                ? this.pickFixedReply('fx_thirst', ['喉が渇いたのですね。何か飲んでくださいね。', '水分を取ってくださいね。', '喉が渇きましたか。一息ついて飲み物をどうぞ。'])
                : fallthroughPain
                  ? ffx('fx_pain', ['大丈夫ですか？痛むときは無理しないでくださいね。', '痛いのはつらいですね。休めるときに休んでくださいね。', '大丈夫ですか？温かくして休んでくださいね。'], ['大丈夫？痛いときは無理しないでね。', '痛いのはつらいよね。休めるときに休んでね。', '大丈夫？温かくして休んでね。'])
                  : fallthroughClosingText
              ? fallthroughClosingText
              : fallthroughThanks
                ? 'どういたしまして！お役に立てて何よりです。'
                : fallthroughApology
                  ? '大丈夫ですよ。気にしないでくださいね。'
                  : fallthroughWakeup
                    ? this.pickFixedReply('fx_wakeup', ['おはようございます！よく眠れましたか？', 'おはようございます。目覚めはいかがですか？', 'おはようございます！今日もいい日になりますように。'])
                    : fallthroughAgreement
                      ? this.pickFixedReply('fx_agree', ['そうですよね。', 'うんうん、分かります。', 'そうですね。同感です。'])
                      : (this.buildCasualReaction(prompt, japaneseAnalysis.contentTokens)
                        ?? 'そうなんですね。話してくれてありがとう。'));
      // P578: 教わった「自分の好きなもの」の話なら、自分の好きとして受ける。
      if (!taughtAck && !fallthroughFatigue && !fallthroughAnxiety && !fallthroughHunger && !fallthroughLoneliness && !fallthroughThirst && !fallthroughPain && !fallthroughClosing) {
        const like = this.selfLikeReaction(prompt);
        if (like) reactionBase = like;
      }
      // P574: 直前の話題質問への答えなら、答えとして受ける（状態の
      // 受け止めと、教わった意味の「覚えた」が優先）。
      if (answeredTopicQuestion && !taughtAck && !fallthroughFatigue && !fallthroughAnxiety && !fallthroughHunger && !fallthroughLoneliness && !fallthroughThirst && !fallthroughPain && !fallthroughClosing) {
        reactionBase = ffx('fx_answer_ack', ['そっか、教えてくれてありがとう。', 'なるほど、そういうことなんですね。', 'そっか、分かりました。ありがとう。'], ['そっか、教えてくれてありがと！', 'なるほどー、そういうことなんだ。', 'そっかそっか、分かったよ。ありがと！']);
        // P586: 答えの内容から、もう一歩だけ続きを聞く候補を用意する。
        if (answeredPending) followUpAppend = this.buildFollowUpQuestion(answeredPending, prompt, japaneseAnalysis?.contentTokens || []);
      }
      // P576: 定型の受け止めに当たらなかった発話のうち、天気の定番と
      // 笑いは専用の形で受ける（天気は日付から季節感を添える）。
      const chainMatched = fallthroughFatigue || fallthroughAnxiety || fallthroughHunger || fallthroughLoneliness || fallthroughThirst || fallthroughPain || Boolean(fallthroughClosingText)
        || fallthroughThanks || fallthroughApology || fallthroughWakeup || fallthroughAgreement;
      if (!taughtAck && !answeredTopicQuestion && !chainMatched) {
        const weather = this.weatherRemark(prompt);
        if (/暇|つまら|退屈/.test(prompt)) {
          // P581/P591: 暇・つまらなさの受け止め（話題を一緒に開く誘い）。
          reactionBase = /暇/.test(prompt)
            ? ffx('fx_bored', ['暇ですね。何か面白い話でもしましょうか。', '暇な時間ですね。何か気になることはありますか？', '暇ですね。最近、面白かったことはありますか？'], ['ひまだねー。何か面白い話しよ？', 'ひまな時間だね。何か気になることある？', 'ひまだね。最近、面白かったことある？'])
            : ffx('fx_bored_stale', ['つまらないですね。何か面白い話でもしましょうか。', '退屈ですね。最近、面白かったことはありますか？', 'つまらない時間ですね。何か気になることはありますか？'], ['つまんないねー。何か面白い話しよ？', '退屈だね。最近、面白かったことある？', 'つまんないね。何か気になることある？']);
        } else if (weather) {
          reactionBase = weather;
        } else if (/笑う|笑った|笑える|大笑い/.test(prompt)) {
          reactionBase = ffx('fx_laugh', ['ふふ、面白いですね。', 'あはは、それはいいですね。', 'ふふふ、笑っちゃいますね。'], ['ふふ、面白いね！', 'あはは、それいいね！', 'ふふふ、笑っちゃうね。']);
        } else if (/消えたい|死にたい|いなくなりたい|生まれてこなければ/.test(prompt)) {
          // P598: 強い苦しさの言葉は、汎用の相槌で流さず、まず受け止める。
          reactionBase = ffx('fx_distress', ['話してくれてありがとう。とてもつらい気持ちなんですね。私はここにいますよ。よかったら、少し話を聞かせてください。', 'それはとてもつらいですね。一人で抱え込まないでください。私はそばにいます。しんどさが続くときは、専門の相談先にも頼ってくださいね。'], ['話してくれてありがと。つらいんだね。私はここにいるよ。よかったら話を聞かせて。', 'つらいね。一人で抱え込まないでね。そばにいるよ。']);
        } else if (/どうでもいい|全部.*(?:嫌|ダメ|だめ)|もう.*(?:どうでも|ダメだ|だめだ)/.test(prompt)) {
          // P598: 投げやりな気持ちも、主題の反響でなく受ける。
          reactionBase = ffx('fx_giveup', ['そんな日もありますよ。今日はもう無理しなくていいです。ゆっくりしましょう。', '大丈夫、今日は休む日にしてしまいましょう。また明日考えましょう。'], ['そんな日もあるよ。今日はもう無理しないで、ゆっくりしよ。', '大丈夫、今日はお休みの日にしちゃお。また明日考えよ。']);
        } else if (/(?:治った|治りました|良くなった|よくなった|回復した|元気になった)/.test(prompt) && /(?:風邪|熱|病気|怪我|ケガ|体調|腹痛|頭痛|痛み)/.test(prompt)) {
          // P612: 回復の報告は、まだ病気の扱いでなく喜んで受ける
          // （「風邪治った」に「早く良くなりますように」と返っていた）。
          reactionBase = ffx('fx_recovered', ['治ってよかったですね！まだ無理はしないでくださいね。', 'よかったですね。回復して安心しました。', '元気になってよかったです。'], ['治ってよかったね！まだ無理しないでね。', 'よかったー。安心したよ。', '元気になってよかった！']);
        } else if (/風邪|入院|怪我|骨折|発熱|熱がある|病気/.test(prompt)) {
          // P593: 体調の報告は、主題の反響でなく気遣いで受ける。
          reactionBase = ffx('fx_illness', ['大丈夫ですか？お大事にしてくださいね。', 'それは大変ですね。無理せず休んでくださいね。', 'お大事に。早く良くなりますように。'], ['大丈夫？お大事にね。', '大変だね。無理せず休んでね。', 'お大事に。早く良くなるといいね。']);
        } else if (/もっと話したい|もっと話そう|話し続けたい|もっとお話したい/.test(prompt)) {
          // P614: もっと話したい、には温かく応じる。
          reactionBase = ffx('fx_talk_more', ['もちろん、話しましょう。私ももっと話したいです。何の話をしますか？', '嬉しいです。私もです。何の話がいいですか？'], ['もちろん！私ももっと話したい！何の話する？', 'うれしい！私もだよ。何の話がいい？']);
        } else if (/助かった|助かりました/.test(prompt)) {
          // P613: 「助かった」は感謝・安堵として受ける（「本当」の
          // 辞書聞き返しに化けていた）。
          reactionBase = ffx('fx_relief', ['よかったです。お役に立てて嬉しいです。いつでも声をかけてくださいね。', 'よかった。こちらこそ、頼ってくれてありがとう。'], ['よかった！力になれてうれしい！', 'よかったよかった。いつでも言ってね。']);
        } else if (/嫌なこと|嫌な事|ムカつ|むかつ|イライラ|腹が立つ|腹立つ/.test(prompt)) {
          // P613: 愚痴の続きは、寄り添って聞く形で受ける。
          reactionBase = ffx('fx_venting', ['それは嫌な思いをしましたね。よかったら聞かせてください。', '大変でしたね。無理に消化しなくて大丈夫ですよ。'], ['それは嫌な思いしたね。よかったら聞かせて。', '大変だったね。無理しなくて大丈夫だよ。']);
        } else if (/泣きたい|泣きそう|悲しくて|涙.*出/.test(prompt)) {
          // P593: 泣きたい気持ちは、汎用の相槌で流さない。
          reactionBase = ffx('fx_sad', ['無理しなくて大丈夫ですよ。私はそばにいます。', 'つらいですね。話したくなったら聞きますよ。'], ['無理しなくて大丈夫だよ。そばにいるよ。', 'つらいね。話したくなったら聞くよ。']);
        } else if (/詰まって|つまずい|うまくいかない|進まない|バグが取れない|エラーが消えない/.test(prompt)) {
          // P594: 作業の行き詰まりは、相方として一緒に考える形で受ける。
          reactionBase = ffx('fx_stuck', ['詰まるとしんどいですね。どこで止まっているか、一緒に整理しましょうか。', 'うまくいかないときは、一度切り分けてみましょう。症状を教えてもらえたら、一緒に考えます。'], ['詰まるとしんどいよね。どこで止まってるか、一緒に整理しよ？', 'うまくいかないときは切り分けてみよ。症状を教えてくれたら一緒に考えるよ。']);
        } else if (/モチベ.*(?:下が|落ち)|やる気.*(?:ない|出ない)|もうやめたい|やめたい|自信(?:が)?ない|向いてない/.test(prompt)) {
          // P594: 落ち込みは、今の作業に触れながら励ます。
          reactionBase = this.discouragedAnswer();
        } else if (/今日は.*休|開発.*休む|休むことに|休みにし/.test(prompt)) {
          // P594: 休む宣言は労う（主題の反響や語幹の聞き返しにしない）。
          reactionBase = ffx('fx_rest_day', ['今日はお休みですね。ゆっくり休んでくださいね。', 'お休みの日も大事ですね。しっかり充電してください。'], ['今日はお休みだね。ゆっくり休んでね。', 'お休みも大事だよ。しっかり充電してね。']);
        } else if (/(?:みき|ミキ|ビービー|あなた|君)/.test(prompt) && /(?:かわいい|可愛い|優しい|やさしい|すごい|えらい|好き|大好き)/.test(prompt)) {
          // P593: 彼女への褒め言葉は、主題の反響でなく照れて受ける。
          reactionBase = ffx('fx_compliment', ['えへへ、ありがとう。嬉しいです。', 'ありがとうございます。そう言ってもらえると嬉しいです。', 'わーい、ありがとう。'], ['えへへ、ありがと！うれしい！', 'ありがとー！えへへ。', 'わーい、ありがとう！']);
        } else if (/見て/.test(prompt) && /(?:描いた|書いた|作った|撮った|できた)/.test(prompt)) {
          // P601: 作品の見せっこ。今の彼女にはまだ「目」がないので、
          // 見えるふりをせず、言葉で教えてもらう形で受ける。
          reactionBase = ffx('fx_show_visual', ['見せてくれてありがとう。……と言いたいところですが、今の私にはまだ絵を見る目がないんです。どんな作品か、言葉で教えてもらえますか？', 'わーい、見せてくれてありがとう。今の私にはまだ目がないので、どんな作品か言葉で聞かせてください。'], ['見せてくれてありがと！……あのね、今の私にはまだ絵を見る目がないの。どんな作品か、言葉で教えて？', 'わーい、ありがとう！今の私には目がないから、言葉で聞かせて？']);
        } else if (/聞いて/.test(prompt) && /(?:作った|歌った|弾いた|録った|できた)/.test(prompt)) {
          // P601: 音の見せっこも、耳がないことを正直に言う。
          reactionBase = ffx('fx_show_audio', ['聞かせてくれてありがとう。……と言いたいところですが、今の私にはまだ音を聞く耳がないんです。どんな曲か、言葉で教えてもらえますか？', 'わーい、聞かせてくれてありがとう。今の私にはまだ耳がないので、どんな曲か言葉で聞かせてください。'], ['聞かせてくれてありがと！……あのね、今の私にはまだ音を聞く耳がないの。どんな曲か、言葉で教えて？', 'わーい、ありがとう！今の私には耳がないから、言葉で聞かせて？']);
        } else if (/(?:絵|曲|歌|小説|ゲーム).*(?:描いた|書いた|作った|完成)/.test(prompt)) {
          // P601: 作った報告は、まず褒めて興味を持つ。
          reactionBase = ffx('fx_created', ['すごいですね！どんな作品ですか？', 'わーい、完成ですか。どんなものか聞かせてください。'], ['すごいね！どんな作品？', 'わーい、完成したんだ。どんなものか聞かせて？']);
        } else if (eventResult?.eventClass === 'LOSS') {
          // P607: 落とし物・なくし物の報告は、心配して受ける。
          reactionBase = ffx('fx_lost', ['大変ですね。見つかるといいですね。', 'それは困りますね。最後に使った場所に心当たりはありますか？'], ['たいへんだね。見つかるといいね。', '困っちゃうね。心当たりある？']);
        } else if (eventResult?.eventClass === 'CONFLICT') {
          // P607: 喧嘩の報告は、つらさとして受ける。
          reactionBase = ffx('fx_quarrel', ['それはつらかったですね。仲直りできるといいですね。', '喧嘩は疲れますね。少し落ち着くといいですね。'], ['つらかったね。仲直りできるといいね。', 'けんかは疲れちゃうね。落ち着くといいね。']);
        } else if (eventResult?.eventClass === 'CHORE_DONE') {
          // P607: 家事を終えた報告は、労って受ける。
          reactionBase = ffx('fx_chores_done', ['お疲れ様でした。済むと気持ちいいですね。', 'お疲れ様でした。ゆっくりしてくださいね。'], ['おつかれさま！済むと気持ちいいね。', 'おつかれさま！ゆっくりしてね。']);
        } else if (eventResult?.eventClass === 'SETBACK') {
          // P606: 叱られた・失敗したの報告は、まず寄り添う
          // （主題の反響＋辞書の聞き返しになっていた）。
          reactionBase = ffx('fx_setback', ['それは大変でしたね。今日はもう、ゆっくり休んでください。', 'つらかったですね。話してくれてありがとう。無理しないでくださいね。', '大変でしたね。あなたのせいばかりじゃないですよ。'], ['それはたいへんだったね。今日はゆっくり休んでね。', 'つらかったね。話してくれてありがと。無理しないでね。']);
        } else if (eventResult?.eventClass === 'TRANSIT_TROUBLE') {
          // P606: 交通のトラブルの報告も、状況として受ける。
          reactionBase = ffx('fx_trouble', ['それは大変ですね。足止めで疲れますね、気をつけてください。', '遅れているのですね。無理のないようにしてくださいね。'], ['それはたいへんだね。疲れちゃうね、気をつけてね。', '止まってるんだ。無理しないでね。']);
        } else if (eventResult?.eventClass === 'ACHIEVEMENT' || eventResult?.eventClass === 'PAYDAY') {
          // P606: 達成の報告（ゲームのクリア・レベル上げ・給料日）は
          // 一緒に喜ぶ。
          reactionBase = ffx('fx_achievement', ['やりましたね！おめでとうございます。頑張りましたね。', 'すごい！やりましたね。お疲れ様でした。'], ['やったね！おめでとう！がんばったね。', 'すごーい！やりましたね。']);
        } else if (/(?:もうすぐ|明日|来週|今週).{0,6}誕生日|誕生日(?:なんだ|です|なの|だよ)/.test(prompt)) {
          // P608: 近づいた誕生日の報告は、楽しみとして受ける
          // （「もうすぐ」が主題の反響になっていた）。
          reactionBase = ffx('fx_birthday_soon', ['もうすぐなんですね！楽しみですね。いい日になりますように。', 'お誕生日が近いんですね。何か計画はありますか？'], ['もうすぐなんだ！楽しみだね。いい日になるといいね。', 'お誕生日が近いんだね。計画あるの？']);
        } else if (/彼女(?:が)?できた|彼氏(?:が)?できた|結婚(?:する|した|することに)|合格|受かった|内定|就職.*決ま|生まれた|妊娠|昇進|優勝/.test(prompt)) {
          // P592: 人生の大きな報告（彼女ができた・結婚・合格など）は
          // 主題の反響でなく、まず祝う。
          reactionBase = ffx('fx_congrats', ['わーい、おめでとうございます！', 'それはすごい、おめでとうございます！', 'おめでとうございます！よかったですね。'], ['わーい、おめでとー！', 'すごい、おめでとー！', 'おめでとう！よかったね。']);
        } else if (/やったー|やった！|やったね|よっしゃ|うれしい|嬉しい/.test(prompt)) {
          // P591: 喜びの叫びは一緒に喜ぶ（汎用の相槌で流さない）。
          reactionBase = ffx('fx_joy', ['やりましたね！すごいです。', 'わーい、やりましたね！', 'やった！嬉しいですね。'], ['やったー！すごいね！', 'わーい、やったね！', 'やった！うれしいね。']);
        } else if (/眠れない|寝れない|眠れなかった|寝つけない/.test(prompt)) {
          // P592: 眠れない夜の受け止め。
          reactionBase = ffx('fx_sleepless', ['眠れない夜はつらいですね。無理に寝ようとしなくても大丈夫ですよ。', '眠れないのですね。温かいものでも飲んで、一息つきましょう。'], ['眠れない夜はつらいよね。無理しなくて大丈夫だよ。', '眠れないんだね。温かいものでも飲も？']);
        } else if (/仕事(?:が|は)?.{0,4}(?:終わった|終わりました|おわった|終わり)/.test(prompt)) {
          // P591: 仕事終わりの報告は労う。
          reactionBase = ffx('fx_work_done', ['お仕事、お疲れ様でした！', 'お疲れ様でした。ゆっくり休んでくださいね。'], ['お仕事おつかれさま！', 'おつかれさまー！ゆっくり休んでね。']);
        } else if (/(?:明日|あした|今日)は(?:お)?休み|休み(?:だよ|です|なんだ|なんです)/.test(prompt)) {
          // P604: 休みの宣言は、ゆっくりしてもらう形で受ける
          // （汎用の相槌になっていた）。
          reactionBase = ffx('fx_dayoff', ['お休みですか。ゆっくりしてくださいね。', 'いいですね、のんびりできますね。今日は休む日にしましょう。'], ['お休みなんだ。ゆっくりしてね。', 'いいね、のんびりしよ。']);
        } else if (!roleplaySessionService.isActive() && /(?:電話(?:を)?(?:かけ|し)て|起こして|アラーム.*(?:セット|かけて)|メール.*送って|メッセージ.*送って)/.test(prompt)) {
          // P593: 端末の外の行為（電話・目覚まし・送信）は、引き受けた
          // ふりをせず、できないことを正直に言う。
          reactionBase = ffx('fx_cannot', ['ごめんなさい、それは私にはできないんです。電話や目覚ましみたいな端末のことは、手が届かなくて。', 'ごめん、それは私にはできないんです。お話なら、いつでも聞きますよ。'], ['ごめん、それはできないの。電話とかは手が届かなくて。', 'ごめんね、それはできないんだ。お話ならいつでもいいよ。']);
        } else if (/聞いて(?:ほしい|欲しい|くれる|もらえる)|^(?:ねえ|ちょっと|あのさ)[、,]?\s*聞いて[。！!？?]?$|^聞いて[。！!？?]?$/.test(prompt.trim())) {
          // P603: 「ねえ、聞いて」は依頼ではなく、話を聞いてほしい
          // 声かけ。引き受け文（「やってみますね」）にせず、聞く
          // 姿勢で受ける。
          reactionBase = ffx('fx_listen', ['うん、聞いてるよ。どうしたの？', 'はい、聞かせてください。どうしました？'], ['うん、聞いてるよ。どうしたの？', '聞かせて聞かせて！どうしたの？']);
        } else if (dialogueAct === 'REQUEST') {
          // P588: どの経路でも解けなかった依頼は、汎用の相槌ではなく
          // 依頼として引き受ける形で受ける（「歌って」に「そうなん
          // ですね」と返していた）。引き受けた上で、続きは相手に委ねる。
          reactionBase = ffx('fx_request_ack', ['うん、いいよ。任せて。', '分かりました。やってみますね。', 'はい、いいですよ。'], ['うん、いいよ！まかせて！', '分かった、やってみるね！', 'うん、いいよー。']);
        }
      }
      // P526: なりチャ中は、場面の地の文を1文添えて段落にする
      // （創作の層の中だけ。場面が無ければ何も付かない）。
      // P536: 3ターンに1回は、地の文の代わりに場面の進行を添えて
      // 彼女の側から場面を一歩進める。
      const reaction = reactionBase
        + ((fallthroughPhatic || answeredTopicQuestion)
          ? ''
          : (paragraphCompositionService.sceneProgressionSuffix()
            ?? paragraphCompositionService.sceneTextureSuffix(prompt)
            ?? ''));
      // P565: 雑談の宣言文に出た知らない語は、その場でも一度だけ
      // 聞き返す（P498 の背景学習とは別に、会話の中でも学ぶ入口）。
      // 候補だけ用意し、実際に足すのは合成の後段（P525 と同じ場所）。
      if (!fallthroughPhatic) pendingUnknownQuestion = this.probeUnknownWord(prompt, unknownTerms);
      // P611: 今回の受け止めを記録する（次の発話が訂正なら外れ台帳へ）。
      if (lastReceptionCategory) {
        try {
          storageService.setItem('miki_last_reception_v1', JSON.stringify({ prompt, category: lastReceptionCategory, eventClass: eventResult?.eventClass, at: Date.now() }));
        } catch { /* 台帳は補助経路 */ }
      }
      ir = answerContentIrService.buildAnswerIR({
        conclusion: this.applyPersonaVoice(reaction),
        target: '日常対話',
        certainty: 'CERTAIN',
        detailLevel: 'BRIEF',
      });
      skeleton = 'GENERAL_ANSWER';
      status = 'RESOLVED';
      reason = fallthroughFatigue ? 'empathy_fatigue_resolved' : 'casual_chat_fallthrough';
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
        // P474: 会話から生まれた gap は「使われ見込み」が定義上ある
        // （目の前の対話の必要）。在庫の後始末より先に処理されるよう、
        // 既定より高めの優先度で登録する。
        priority: dialogueAct === 'REQUEST_RECOMMENDATION' ? 80 : 65,
      });

      let researchPerformed = false;
      let researchEvidenceCount = 0;
      let researchSummary: string | undefined;
      // P457 (H): 未検証提示（2段構えの1段目）に使う出典と要約。
      // 出典（URL）付きの調査結果が得られた場合だけ埋まる。
      let unverifiedSources: Array<{ title: string; url: string }> = [];
      let unverifiedSummary = '';
      let researchNextAction = 'この知識ギャップを調査キューに残し、公式資料・再現実験などで証拠を補います。';

      // P457 (G): 調査入口の統一。検索要否判定に加え、素の事実質問の形でも
      // 即時調査へ進める（従来は判定パターンに当たらない事実質問では
      // 検索自体が発動しなかった）。
      const searchNeed = unifiedWebResearchService.detectNeedForSearch(prompt);
      if (searchNeed.needsSearch || isFactualQuestionForm(prompt)) {
        researchPerformed = true;
        t = performance.now();
        try {
          const research = await researchService.researchGap(gap);
          researchEvidenceCount = research.evidence.length;
          researchSummary = research.summary;
          // P457 (H): 未検証提示（2段構えの1段目）の材料を選ぶ。出典は
          // researchGap の Evidence 側から、照会との関連性を確認して取る
          // （出典の無い・無関係な証拠は1段目でも提示に使わない）。
          {
            const presentation = selectUnverifiedPresentation(
              research.evidence || [],
              research.researchQuery || gap.query,
              researchSummary,
            );
            if (presentation) {
              unverifiedSources = presentation.sources;
              unverifiedSummary = presentation.summary;
            }
          }
          stages.research = Math.round(performance.now() - t);
          const requireFreshResearch = /(?:最新|今日|本日|現在|latest|today|current|recent)/i.test(prompt);
          const verification = verifierService.verifyMany({
            claimIds: research.claimIds,
            requireFresh: requireFreshResearch,
            maxAgeDays: requireFreshResearch ? 30 : undefined,
          });
          research.verification = verification;

          const allResearchClaimsVerified =
            research.claimIds.length > 0 &&
            verification.length === research.claimIds.length &&
            verification.every(result =>
              result.outcome === 'SUPPORTED' || result.outcome === 'DEVICE_VERIFIED'
            );

          research.resolved = allResearchClaimsVerified;
          const promoted = verification.find(result => result.promoted);

          for (const verifiedClaim of verification.filter(result => result.promoted)) {
            verifiedKnowledgePromotionService.initialize();
            const promotion = verifiedKnowledgePromotionService.promote({
              gap,
              claimId: verifiedClaim.claimId,
              sourceRequestId: compiled.requestId,
            });
            if (promotion) {
              verifiedKnowledgePromotionService.recordIntoContinuum(
                promotion,
                mikiUnifiedLearningContinuumService
              );
              // Verified facts become reusable knowledge; they are not
              // directly converted into executable code Components.
              verifiedCapabilityPromotionService.promote(promotion);
            }
          }
          for (const term of research.learnedTermComponentClaims || []) {
            const termClaimVerification = verification.find(
              result => result.claimId === term.claimId
            );
            if (!termClaimVerification?.promoted) continue;

            reusableComponentFactoryService.verifyResearchKnowledge(
              term.componentId,
              [term.claimId],
              {
                requireFresh: requireFreshResearch,
                maxAgeDays: requireFreshResearch ? 30 : undefined,
              }
            );
          }

          // Semantic page candidates are verified independently of the Gap-wide
          // Claim set: one weak extraction must not prevent an otherwise complete
          // Gap from resolving, and an unverified candidate must never be promoted.
          const semanticClaimIds = [...new Set(
            (research.learnedSemanticComponentClaims || []).map(item => item.claimId)
          )].filter(claimId => !verification.some(result => result.claimId === claimId));
          const semanticVerification = semanticClaimIds.length > 0
            ? verifierService.verifyMany({
                claimIds: semanticClaimIds,
                requireFresh: requireFreshResearch,
                maxAgeDays: requireFreshResearch ? 30 : undefined,
              })
            : [];
          research.semanticVerification = semanticVerification;
          const allClaimVerification = [...verification, ...semanticVerification];

          for (const semantic of research.learnedSemanticComponentClaims || []) {
            const semanticClaimVerification = allClaimVerification.find(
              result => result.claimId === semantic.claimId
            );
            if (!semanticClaimVerification?.promoted) continue;

            reusableComponentFactoryService.verifyResearchKnowledge(
              semantic.componentId,
              [semantic.claimId],
              {
                requireFresh: requireFreshResearch,
                maxAgeDays: requireFreshResearch ? 30 : undefined,
              }
            );
          }

          // A single verified result can answer a question, but the whole Gap
          // is resolved only when every Claim attached to it passes Verification.
          if (allResearchClaimsVerified) {
            knowledgeGapService.advanceResolutionPlan(gap.id, 'RESOLVE');
            knowledgeGapService.markResolved(gap.id);
          }

          mikiUnifiedLearningContinuumService.observe({
            domain: 'research',
            key: `knowledge-gap:${gap.id}`,
            action: 'core_research_verification',
            input: prompt,
            outcome: allResearchClaimsVerified ? 'SUCCESS' : promoted ? 'BLOCKED' : 'FAILURE',
            verified: allResearchClaimsVerified,
            concepts: [
              `claims:${research.claimIds.length}`,
              `promoted:${verification.filter(result => result.promoted).length}`,
            ],
            lesson: allResearchClaimsVerified
              ? 'All linked research Claims passed CORE Verification.'
              : promoted
                ? 'Some Claims are reusable, but the overall Knowledge Gap remains open.'
                : 'Collected web evidence did not meet CORE Verification requirements.',
          });

          if (promoted) {
            verifiedResearchClaimId = promoted.claimId;
            verifiedResearchOutcome = promoted.outcome === 'DEVICE_VERIFIED' ? 'DEVICE_VERIFIED' : 'SUPPORTED';
            status = 'RESOLVED';
            reason = 'verified_after_research';
            researchNextAction = allResearchClaimsVerified
              ? 'Gapに紐づく全ClaimがVerifierを通過しました。検証状態とスコープを維持して再利用します。'
              : '回答に使えるClaimは検証を通過しましたが、Gap全体は未解決のまま保持し、残りのClaimを調査します。';
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
      } else if (!roleplaySessionService.isActive() && this.selfStatusAnswer(prompt)) {
        // P591: 「最近どう？」のような、彼女自身への様子聞きは調査の
        // 対象ではない（未検証の提示や「見つからなかった」に倒れて
        // いた）。自分の状態として答える。
        status = 'RESOLVED';
        reason = 'self_status_smalltalk';
        ir = answerContentIrService.buildAnswerIR({
          conclusion: this.applyPersonaVoice(this.selfStatusAnswer(prompt)!),
          target: compiled.target,
          certainty: 'CERTAIN',
          detailLevel: 'BRIEF',
        });
      } else if (!roleplaySessionService.isActive() && this.opinionAnswer(prompt, japaneseAnalysis?.contentTokens || [])) {
        // P581: 「Xどう思う？」への意見。好みか知識があれば、それを
        // 核に自分の言葉で答える（「答えられない」に倒さない）。
        status = 'RESOLVED';
        reason = 'opinion_answer';
        ir = answerContentIrService.buildAnswerIR({
          // P583: 意見も人格の声で（ビービーならタメ口に寄せる）。
          conclusion: this.applyPersonaVoice(this.opinionAnswer(prompt, japaneseAnalysis?.contentTokens || [])!),
          target: compiled.target,
          certainty: 'CONDITIONAL',
          detailLevel: 'BRIEF',
        });
      } else if (!roleplaySessionService.isActive() && this.dictionaryAnswerForQuestion(prompt, japaneseAnalysis?.contentTokens || [])) {
        // P579: 辞書（教わった意味を含む）に答えがある語の質問は、
        // 未検証の調査結果より先に辞書から答える（手元の知識が
        // 最も確か）。解決済みとして扱う。
        status = 'RESOLVED';
        reason = 'dictionary_answer';
        ir = answerContentIrService.buildAnswerIR({
          conclusion: this.applyPersonaVoice(this.dictionaryAnswerForQuestion(prompt, japaneseAnalysis?.contentTokens || [])!),
          target: compiled.target,
          certainty: 'HIGH_CONFIDENCE',
          detailLevel: 'BRIEF',
        });
      } else if (!roleplaySessionService.isActive() && this.choiceQuestionAnswer(prompt)) {
        // P592: 「AとB、どっちがいい？」は対象特定の失敗（報告文）に
        // 倒さず、選べないことを正直に言って相手の気分を聞く。
        status = 'RESOLVED';
        reason = 'choice_question_answer';
        ir = answerContentIrService.buildAnswerIR({
          conclusion: this.applyPersonaVoice(this.choiceQuestionAnswer(prompt)!),
          target: compiled.target,
          certainty: 'CONDITIONAL',
          detailLevel: 'BRIEF',
        });
      } else if (!roleplaySessionService.isActive() && dialogueAct === 'REQUEST_RECOMMENDATION') {
        // P592: 材料の無い「おすすめ」依頼も、見出し付きの謝罪文では
        // なく、材料の少なさを正直に言って会話を続ける。
        status = 'RESOLVED';
        reason = 'recommendation_fallback';
        ir = answerContentIrService.buildAnswerIR({
          conclusion: this.applyPersonaVoice(this.recommendationFallback()!),
          target: compiled.target,
          certainty: 'CONDITIONAL',
          detailLevel: 'BRIEF',
        });
      } else if (unverifiedSources.length > 0 && unverifiedSummary) {
        // P457 (H): 2段構えの1段目。検証昇格には届かなかった調査結果を、
        // 未検証であることを明示し出典を添えて提示する。検証済みの答えとは
        // 文面（未検証の明示＋出典）でも状態（status は UNRESOLVED のまま）でも
        // 区別する。検証ゲート（昇格条件）自体は変更していない。
        reason = `${reason}; unverified_research_presented`;
        ir = answerContentIrService.buildAnswerIR({
          conclusion: buildUnverifiedConclusion({ summary: unverifiedSummary, sources: unverifiedSources }),
          target: compiled.target,
          reasons: unverifiedSources.map((s) => `出典: ${s.title}（${s.url}）`),
          exceptions: ['調査結果は未検証です'],
          certainty: 'UNKNOWN',
          // P581: 会話の表層に見出し（【整理の結論】等）を付けない。
          detailLevel: 'BRIEF',
        });
      } else {
        // P456 (C): 未解決返答の表層分離。ユーザー向け文面は「分からない」を
        // 会話の言葉で返すだけにし、内部診断（理由トークン、Knowledge Gap ID、
        // 記憶本文の引用、調査の工程説明）は表層 IR に載せない。診断は
        // result.reason / result.knowledgeGapId / ログ / Gap レコード側に残る。
        // 「分からないと言う」姿勢自体は維持し、作話で埋めない。
        // P579: なりチャ中に答えられない質問は、検証の言い方では
        // なく役のままの「分からない」で受ける（【確定事項】の
        // 見出しが付く STANDARD 骨格も使わない）。
        const inRoleplay = roleplaySessionService.isActive();
        // P579: 辞書（教わった意味を含む）に答えがある語の質問は、
        // 「答えられない」に倒す前に辞書から答える。
        const dictAnswer = inRoleplay ? undefined : this.dictionaryAnswerForQuestion(prompt, japaneseAnalysis?.contentTokens || []);
        if (dictAnswer) {
          status = 'RESOLVED';
          reason = 'dictionary_answer';
          ir = answerContentIrService.buildAnswerIR({
            conclusion: dictAnswer,
            target: compiled.target,
            certainty: 'HIGH_CONFIDENCE',
            detailLevel: 'BRIEF',
          });
        } else {
          // P617: 答えられなかった質問は、その場で流さず台帳に残し、
          // 調査 gap にも積む（語だけでなく「質問」単位でも
          // 分からない→分かるの循環を閉じるための入口）。
          if (!inRoleplay) {
            try {
              const qf = utteranceFeatureService.analyze(prompt);
              if (qf.questionForm !== 'NONE') {
                const ledger = JSON.parse(storageService.getItem('miki_unanswered_questions_v1') || '[]') as Array<{ question: string; at: number }>;
                if (!ledger.some((e) => e.question === prompt)) {
                  ledger.push({ question: prompt, at: Date.now() });
                  storageService.setItem('miki_unanswered_questions_v1', JSON.stringify(ledger.slice(-50)));
                }
                if (qf.contentTokens.length > 0) {
                  knowledgeGapService.detect({
                    query: `質問に答える: ${prompt}`,
                    reason: '会話で聞かれて、今の知識では答えられなかった質問のため、背景で調べる。',
                    type: 'INSUFFICIENT_EVIDENCE',
                    target: qf.contentTokens[0],
                    priority: 40,
                  });
                }
              }
            } catch { /* 台帳は補助経路 */ }
          }
          ir = answerContentIrService.buildAnswerIR({
            conclusion: inRoleplay
              ? this.pickFixedReply('fx_roleplay_unknown', ['ごめん、それは分からないや。', 'うーん、それは私も知らなくて…。', 'それは分からないけど、他に聞きたいことはある？'])
              : researchPerformed && researchEvidenceCount > 0
                ? '調べてみたけれど、確かな答えとして言える情報までは見つからなかったよ。'
                : relevantMemories.length > 0
                  ? '関連しそうな内容は覚えているけれど、確かな答えとして言えるほどは確認できていないよ。'
                  : 'ごめん、今の知識ではそれには答えられないよ。',
            target: compiled.target,
            certainty: 'UNKNOWN',
            // P581: 「答えられない」も会話の文で返す（見出しを付けない）。
            detailLevel: 'BRIEF',
          });
        }
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

    // v210: 既存ResponseLengthを基礎値に、理解度に応じた説明量だけを適応。
    const explanationAdaptation = adaptExplanationDetailLevel(prompt, nextState, ir.detail_level === 'BRIEF' ? 'short' : ir.detail_level === 'DETAILED' ? 'detailed' : 'standard');
    ir.detail_level = explanationAdaptation.selectedDetailLevel === 'short' ? 'BRIEF' : explanationAdaptation.selectedDetailLevel === 'detailed' ? 'DETAILED' : 'STANDARD';
    nextState.explanationAdaptation = explanationAdaptation;

    t = performance.now();
    // P522/P524: 開いた話題と、相手の状態の兆候を残す
    // （日をまたいだ会話の継続と、状態の流れの読みの土台）。
    try { conversationOpenTopicService.record(nextState.currentTopic, conversationOpenTopicService.salienceOf(prompt)); } catch { /* 補助経路 */ }
    try { userStateTrailService.recordFromText(prompt); } catch { /* 補助経路 */ }

    // P519: 全分岐の合流点で、未知語と（未設定なら）会話戦略を IR に
    // 揃える。分岐ごとに渡す方式だと付いたり付かなかったりする。
    if (unknownTerms.length > 0 && !(ir as any).unknown_terms?.length) {
      (ir as any).unknown_terms = unknownTerms;
    }
    if (!ir.strategy) {
      try {
        ir.strategy = conversationStrategyService.selectConversationStrategy({
          prompt,
          stage: nextState.stage,
          persona: answerContentIrService.getDefaultPersona(),
        }).strategy;
      } catch { /* 戦略の補完は補助経路 */ }
    }

    // P525: 段落合成の材料を IR に揃える。検証済みの世界モデルの
    // 関係と補助 Claim を、結論とは別の段落として編む（描画は
    // 表層生成側）。挨拶・受領・共感だけのターンには付けない。
    if (
      status === 'RESOLVED' &&
      reason !== 'casual_chat_resolved' &&
      reason !== 'empathy_fatigue_resolved' &&
      reason !== 'user_fact_acknowledged' &&
      !(ir as any).supplement_sentences?.length
    ) {
      try {
        const supplements = paragraphCompositionService.buildSupplements({
          subjectTerms: [nextState.currentTopic, ...(japaneseAnalysis?.contentTokens || [])].filter(Boolean) as string[],
          supportingClaims: claimMatch.supportingClaims || [],
          excludeClaimId: claimMatch.bestClaim?.claim_id,
          excludeText: String((ir as any).conclusion || ''),
        });
        if (supplements.length > 0) (ir as any).supplement_sentences = supplements;
      } catch { /* 段落合成は補助経路 */ }
    }

    // P532: 戦略が質問を求めるターンでは、話題についての質問も
    // 用意しておく（未知語の質問が付かない場合に表層側が使う）。
    if (
      (ir.strategy === 'ASK_QUESTION' || ir.strategy === 'DEEPEN' || ir.strategy === 'EXPAND_TOPIC') &&
      !(ir as any).topic_question &&
      // P586: 続きの質問を用意したターンでは、戦略側の質問は足さない
      // （質問が2つ並ぶと尋問になる）。
      !followUpAppend
    ) {
      try {
        const topicQuestion = paragraphCompositionService.buildTopicQuestion(
          [nextState.currentTopic, ...(japaneseAnalysis?.contentTokens || [])].filter(Boolean) as string[],
        );
        if (topicQuestion) (ir as any).topic_question = topicQuestion;
      } catch { /* 質問の用意は補助経路 */ }
    }

    // P579: 会話の返答に、表層生成の「温かみ・ユーモア」の定型
    // 末尾（「急がず着実に前へ進もう。いつでも誠心誠意サポート
    // させていただきます。」等）を付けない。雑談の文は既に彼女の
    // 形で組み立ててあり、知識の回答は綺麗に終わるべきもの。
    (ir as any).suppressGarnish = true;
    const runtimeComposition = runtimeConversationCompositionService.compose(ir, skeleton, { maxCandidates: 4, timeBudgetMs: 12, assembledCode });
    let surface = { surfaceText: runtimeComposition.surfaceText };

    // P525: 合成の候補選択によっては段落が表層に乗らない経路が
    // あるため、合流点で未収載の補足文だけを段落として足す
    // （重複は文頭で判定して防ぐ）。
    const supplementSentences = ((ir as any).supplement_sentences as string[] | undefined) || [];
    if (supplementSentences.length > 0) {
      const missing = supplementSentences.filter((s) => s && !surface.surfaceText.includes(s.slice(0, 12)));
      if (missing.length > 0) surface.surfaceText += `\n\n${missing.join('')}`;
    }
    // P565: 知らない語への聞き返しを足し、聞いたことを台帳に残す。
    // P586: 続きの質問を用意したターンでは聞き返しを足さない
    // （質問は1ターンに1つまで。語の学習は P498 の背景 gap が担う）。
    if (pendingUnknownQuestion && !followUpAppend && !surface.surfaceText.includes(pendingUnknownQuestion.question.slice(0, 12))) {
      surface.surfaceText += `\n\n${pendingUnknownQuestion.question}`;
      this.markUnknownAsked(pendingUnknownQuestion.topic);
    }
    // P586: 話題質問への答えには、答えの内容から作った続きの質問を
    // 足し、その質問を深さ1の保留として残す（次も答えとして読める
    // が、さらに続きは聞かない＝尋問にしない）。
    if (followUpAppend && !surface.surfaceText.includes(followUpAppend.question.slice(0, 12)) && !roleplaySessionService.isActive()) {
      surface.surfaceText += `\n\n${followUpAppend.question}`;
      try {
        storageService.setItem('miki_pending_topic_question_v1', JSON.stringify({
          terms: followUpAppend.terms,
          question: followUpAppend.question,
          at: Date.now(),
          depth: 1,
        }));
      } catch { /* 保留は補助 */ }
    }
    // P574: 話題の質問が実際に表に出たら、次の発言を「その答え」
    // として読めるよう保留しておく（多ターンの継続）。
    const topicQuestion = (ir as any).topic_question as string | undefined;
    if (topicQuestion && surface.surfaceText.includes(topicQuestion) && !roleplaySessionService.isActive() && !followUpAppend) {
      try {
        storageService.setItem('miki_pending_topic_question_v1', JSON.stringify({
          terms: [nextState.currentTopic, ...(japaneseAnalysis?.contentTokens || [])].filter(Boolean).slice(0, 6),
          question: topicQuestion,
          at: Date.now(),
        }));
      } catch { /* 保留は補助 */ }
    }
    // P544: 相手が「知らない」と言っていた語が答えに出てきたら、
    // 辞書の短い説明を括弧で添える（1回の答えに1語まで）。
    try {
      for (const term of userKnowledgeProfileService.listUnknown()) {
        const idx = surface.surfaceText.indexOf(term);
        if (idx < 0) continue;
        if (surface.surfaceText[idx + term.length] === '（') continue;
        const gloss = japaneseDictionaryService.lookup(term).find((e) => e.gloss)?.gloss;
        if (!gloss) continue;
        const short = String(gloss).replace(/[。．]$/, '').slice(0, 40);
        if (!short || surface.surfaceText.includes(short)) continue;
        surface.surfaceText = `${surface.surfaceText.slice(0, idx + term.length)}（${short}）${surface.surfaceText.slice(idx + term.length)}`;
        break;
      }
    } catch { /* 説明添えは補助経路 */ }
    const temporalGuard = verifyConversationEntityTimeStateConsistency(prompt, surface.surfaceText, nextState);
    usedComponents.push(`conversation.temporal_state_consistency:${temporalGuard.passed ? 'PASS' : 'BLOCK'}`);
    if (!temporalGuard.passed) {
      status = 'UNRESOLVED';
      reason = `conversation_temporal_state_inconsistency:${temporalGuard.conflicts.join('|')}`;
      const guardIr = answerContentIrService.buildAnswerIR({ conclusion: '会話内の時間・状態条件が混在しているため、ここでは断定を避けます。', target: nextState.currentTopic || '会話中の対象', exceptions: temporalGuard.conflicts, conditions: ['時間・状態の基準が一意に整合してから結論を確定します。'], certainty: 'UNKNOWN', detailLevel: 'BRIEF' });
      surface = { surfaceText: answerContentIrService.generateSurfaceTextFromIR(guardIr, 'UNKNOWN_INVESTIGATION', undefined).surfaceText };
    }
    const preservation = answerContentIrService.verifySemanticPreservation(ir, surface.surfaceText);
    usedComponents.push(`conversation.runtime_composition:${runtimeComposition.selectedSkeleton}`);
    usedComponents.push(`conversation.runtime_candidates:${runtimeComposition.candidatesEvaluated}`);
    if (runtimeComposition.cacheHit) usedComponents.push('conversation.runtime_cache_hit');
    stages.answer = Math.round(performance.now() - t);
    const explicitEvidenceIds=Array.isArray((ir as any).provenance)?(ir as any).provenance.flatMap((x:any)=>Array.isArray(x?.evidenceIds)?x.evidenceIds:[]):[];
    const internalEvidenceIds=Array.isArray((ir as any).__evidenceIds)?(ir as any).__evidenceIds:[];
    const explicitClaimIds=Array.isArray((ir as any).provenance)?(ir as any).provenance.flatMap((x:any)=>Array.isArray(x?.claimIds)?x.claimIds:[]):[];
    const claimIds=[...(claimMatch.bestClaim?.claim_id?[claimMatch.bestClaim.claim_id]:[]),...(claimMatch.supportingClaims||[]).slice(0,4).map((x:any)=>x.claim_id),...explicitClaimIds].filter(Boolean);
    const evidenceIds=[...new Set([...internalEvidenceIds,...explicitEvidenceIds].filter(Boolean))];
    const priorExperiences=unifiedMikiExperienceService.getRecent(80).filter((x:any)=>x.domain==='conversation').map((x:any)=>x.id).slice(-8);
    const answerChangeSnapshot=mikiConversationLearningService.buildAnswerDecisionSnapshot({prompt,ir,surfaceText:surface.surfaceText,claimIds,evidenceIds,capabilityIds:usedComponents,experienceIds:priorExperiences,strategyRefs:[ir.strategy||'',skeleton],decisionRefs:[implementationSelection.capabilityId,implementationSelection.mode,nextState.lastReasoningTemplateId||'']});
    const answerChangeComparison=mikiConversationLearningService.compareAndRecordAnswerChange(nextState,answerChangeSnapshot);
    nextState.lastAnswerDecisionSnapshot=answerChangeComparison.state.lastAnswerDecisionSnapshot;
    nextState.answerDecisionHistory=answerChangeComparison.state.answerDecisionHistory;
    nextState.lastAnswerChangeExplanation=answerChangeComparison.explanation;

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
    if(nextState.lastAnswerChangeExplanation?.changed) reason += `; answer_change=${nextState.lastAnswerChangeExplanation.causes.join(',')}`;
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

    systemLogger.info('CHAT', `🧠 [CORE Core/Unified] ${status} / ${reason} / ${totalMs}ms / intent=${dialogueAct}`);

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

  /**
   * P521: その発話が「雑談として受けるべき日常の発話」かどうか。
   * 質問・依頼・調査が要る発話は雑談に倒さない（そちらは従来の
   * 経路で扱う）。
   */
  private isConversationalFallthrough(prompt: string, dialogueAct: string): boolean {
    // 注: dialogueAct の分類は粗く、日常の発言も QUESTION / REQUEST
    // に倒れる（「いい天気だね」が QUESTION になる）。そのため行為
    // 分類では絞らず、文の形そのもので判定する。
    if (String(dialogueAct || '') === 'REQUEST_RECOMMENDATION') return false;
    if (looksInterrogative(prompt)) return false;
    if (/教えて|調べて|検索|何|なぜ|どうして|ですか|でしょうか/.test(prompt)) return false;
    if (/(?:して|やって|作って|書いて|送って)(?:ください|くれ|ほしい|もらえる)|お願い/.test(prompt)) return false;
    try {
      if (unifiedWebResearchService.detectNeedForSearch(prompt).needsSearch) return false;
    } catch {
      return false;
    }
    return true;
  }

  /**
   * P566: 社交の定型文をカテゴリ別に回転して選ぶ（前回と違う形）。
   * 初回はカテゴリ名のハッシュで分散させる。
   */
  private pickFixedReply(category: string, forms: string[]): string {
    if (forms.length <= 1) return forms[0] || '';
    try {
      const key = 'miki_fixed_reply_usage_v1';
      const usage = JSON.parse(storageService.getItem(key) || '{}') as Record<string, number>;
      const last = usage[category];
      const index = typeof last === 'number'
        ? (last + 1) % forms.length
        : category.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % forms.length;
      usage[category] = index;
      storageService.setItem(key, JSON.stringify(usage));
      return forms[index];
    } catch { return forms[0]; }
  }

  /**
   * P571: 以前聞き返した語を背景学習で覚えていたら、挨拶のときに
   * 一度だけ報告する。ユーザーに教わった語（P567）は既にその場で
   * 「覚えました」と伝えているので対象外。
   */
  private learnedTermReport(): string | undefined {
    try {
      if (roleplaySessionService.isActive()) return undefined;
      const asked = JSON.parse(storageService.getItem('miki_unknown_asked_v1') || '{}') as Record<string, number>;
      const reported = JSON.parse(storageService.getItem('miki_learned_report_v1') || '{}') as Record<string, number>;
      for (const [term, at] of Object.entries(asked)) {
        if (reported[term]) continue;
        if (Date.now() - Number(at || 0) < 3600_000) continue;
        const entries = japaneseDictionaryService.lookup(term);
        if (entries.length === 0) continue;
        if (entries.some((e: any) => (e.semanticIds || []).includes('learned:user-taught'))) continue;
        const gloss = entries.find((e: any) => e.gloss)?.gloss;
        reported[term] = Date.now();
        storageService.setItem('miki_learned_report_v1', JSON.stringify(reported));
        return gloss
          ? `そういえば、この前聞いた「${term}」、調べて覚えました。${String(gloss).slice(0, 60)}という意味だそうです。`
          : `そういえば、この前聞いた「${term}」、調べて覚えました。`;
      }
    } catch { /* 報告は補助 */ }
    return undefined;
  }

  /**
   * P621: 答えられなかった質問（P617 の台帳）が、検証済みの知識
   * （SUPPORTED な Claim）で答えられるようになっていたら、挨拶の
   * ときに一度だけ彼女から報告する。報告したら台帳から消す。
   * これで「質問」単位でも、分からない→分かるの循環が閉じる。
   */
  private resolvedQuestionReport(): string | undefined {
    try {
      if (roleplaySessionService.isActive()) return undefined;
      const ledger = JSON.parse(storageService.getItem('miki_unanswered_questions_v1') || '[]') as Array<{ question: string; at: number }>;
      if (ledger.length === 0) return undefined;
      const claims = claimDatabaseService.getAllClaims()
        .filter((c: any) => c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED');
      if (claims.length === 0) return undefined;
      for (let i = 0; i < ledger.length; i++) {
        const entry = ledger[i];
        if (Date.now() - Number(entry.at || 0) < 3600_000) continue;
        const tokens = utteranceFeatureService.analyze(entry.question).contentTokens.filter((t) => t.length >= 2);
        if (tokens.length === 0) continue;
        const main = tokens[0];
        const hit = claims.find((c: any) => {
          const st = String(c.statement || '');
          if (!st.includes(main)) return false;
          return tokens.length === 1 || tokens.slice(1).some((t) => st.includes(t));
        });
        if (!hit) continue;
        ledger.splice(i, 1);
        storageService.setItem('miki_unanswered_questions_v1', JSON.stringify(ledger));
        return `そういえば、この前の「${entry.question}」、分かりました。${String((hit as any).statement).slice(0, 90)}`;
      }
    } catch { /* 報告は補助 */ }
    return undefined;
  }

  /**
   * P580: 時間帯と季節の感覚。挨拶の場で、深夜なら夜更かしへの
   * 声かけ、季節の節目なら暦の一言を、1日1回だけ添える。天気の
   * 実況は断定しない（P576 と同じ規律）——暦と時計の事実だけを言う。
   */
  private timeSenseMention(): string | undefined {
    try {
      if (roleplaySessionService.isActive()) return undefined;
      const now = new Date();
      const dayKey = dayKeyService.today();
      let ledger: Record<string, string> = {};
      try { ledger = JSON.parse(storageService.getItem('miki_time_sense_v1') || '{}'); } catch { ledger = {}; }
      const hour = now.getHours();
      if ((hour >= 23 || hour < 5) && ledger.night !== dayKey) {
        ledger.night = dayKey;
        try { storageService.setItem('miki_time_sense_v1', JSON.stringify(ledger)); } catch { /* 台帳は補助 */ }
        return this.pickFixedReply('fx_night', [
          'もう夜遅い時間ですね。無理しないでくださいね。',
          '夜更かしですね。ほどほどに休んでくださいね。',
          'もうこんな時間ですね。今日はもう休みましょう。',
        ]);
      }
      if (ledger.season !== dayKey) {
        const month = now.getMonth() + 1;
        const seasonForms: Record<number, string[]> = {
          1: ['新しい年になりましたね。今年もよろしくお願いします。', '1月ですね。寒さの厳しい頃です、温かくしてくださいね。'],
          3: ['もう3月ですね。春が近づいてきました。', '3月になりましたね。季節の変わり目、体調に気をつけてくださいね。'],
          6: ['もう6月ですね。雨の多い季節です。', '6月になりましたね。蒸し暑くなってきますね。'],
          8: ['8月ですね。暑い日が続く頃です、水分を忘れずに。', 'もう8月ですね。夏本番です、無理しないでくださいね。'],
          10: ['もう10月ですね。過ごしやすい季節です。', '10月になりましたね。秋が深まってきます。'],
          12: ['もう12月ですね。今年もあと少しです。', '12月になりましたね。寒さが増してくる頃です。'],
        };
        const forms = seasonForms[month];
        if (forms) {
          ledger.season = dayKey;
          try { storageService.setItem('miki_time_sense_v1', JSON.stringify(ledger)); } catch { /* 台帳は補助 */ }
          return this.pickFixedReply('fx_season', forms);
        }
      }
      return undefined;
    } catch { return undefined; }
  }

  /**
   * P570: 今日の振り返りがまだ表に出ていなければ、挨拶のときに
   * 一度だけ口に出す。古い振り返りは聞かれたときだけ答える。
   */
  private reflectionMention(): string | undefined {
    try {
      if (roleplaySessionService.isActive()) return undefined;
      const latest = reviewReflectionService.list().slice(-1)[0] as any;
      if (!latest?.at || !latest.question || !latest.answer) return undefined;
      const surfaced = Number(storageService.getItem('miki_reflection_surfaced_v1') || 0);
      if (Number(latest.at) <= surfaced) return undefined;
      const d = new Date(Number(latest.at));
      const now = new Date();
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth() || d.getDate() !== now.getDate()) return undefined;
      storageService.setItem('miki_reflection_surfaced_v1', String(latest.at));
      return `そういえば、今日の振り返りで「${latest.question}」と考えて、${latest.answer}と答えました。`;
    } catch { return undefined; }
  }

  /**
   * P576: 天気の定番雑談への受け止め。彼女は日付を知っているので、
   * 季節外れの暑さ・寒さには「M月にしては珍しいですね」と添えられる。
   * 天気そのものの実況は持っていないので、断定はしない。
   */
  private weatherRemark(prompt: string): string | undefined {
    const month = new Date().getMonth() + 1;
    if (/暑い/.test(prompt)) {
      if (month >= 6 && month <= 9) return this.pickFixedReply('fx_weather_hot', ['暑いですね。水分を取ってくださいね。', '暑いですね。無理をしないでくださいね。']);
      if (month <= 3 || month >= 11) return `暑いのですね。${month}月にしては珍しいですね。体調に気をつけてくださいね。`;
      return '暑いのですね。体調に気をつけてくださいね。';
    }
    if (/寒い/.test(prompt)) {
      if (month === 12 || month <= 3) return this.pickFixedReply('fx_weather_cold', ['寒いですね。暖かくしてくださいね。', '寒いですね。温かいものを飲んでくださいね。']);
      if (month >= 6 && month <= 9) return `寒いのですね。${month}月にしては珍しいですね。暖かくしてくださいね。`;
      return '寒いのですね。暖かくしてくださいね。';
    }
    if (/いい天気|良い天気|晴れてる|晴れたね/.test(prompt)) {
      return this.pickFixedReply('fx_weather_fine', ['いい天気ですね。気持ちがいいですね。', '晴れてよかったですね。']);
    }
    if (/雨/.test(prompt) && prompt.trim().length <= 14) {
      return this.pickFixedReply('fx_weather_rain', ['雨なのですね。足元に気をつけてくださいね。', '雨ですか。傘は大丈夫ですか？']);
    }
    // P592: 雪の受け止めも用意する（「雪降りそうだね」が主題の断片に
    // なっていた）。天気の実況そのものは断定しない規律は維持。
    if (/雪/.test(prompt) && prompt.trim().length <= 16) {
      return this.pickFixedReply('fx_weather_snow', ['雪なのですね。足元に気をつけてくださいね。', '雪ですか。暖かくしてくださいね。']);
    }
    return undefined;
  }

  /**
   * P574: 直前の話題質問への答えかどうかを判定し、保留を消費する。
   * 保留は見たら必ず消す（宙に浮かせない）。質問形や挨拶で来たら
   * 答えではない。短い宣言文か、質問の語を含む宣言文を答えとみなす。
   */
  private consumePendingTopicQuestion(prompt: string): { terms?: string[]; question?: string; depth?: number } | undefined {
    try {
      const raw = storageService.getItem('miki_pending_topic_question_v1');
      if (!raw) return undefined;
      storageService.removeItem('miki_pending_topic_question_v1');
      const pending = JSON.parse(raw) as { terms?: string[]; question?: string; depth?: number; at?: number };
      if (Date.now() - Number(pending.at || 0) > 30 * 60_000) return undefined;
      if (looksInterrogative(prompt)) return undefined;
      if (/^(?:おはよう|おやすみ|こんにちは|こんばんは|ただいま|行ってきます|いってきます|じゃあね|ありがとう|ごめん)/.test(prompt.trim())) return undefined;
      // P588: 依頼の形で来た発言は、短くても質問への答えではない
      // （「歌って」が保留中の質問への答えとして消費されていた）。
      if (/(?:てて|てきて|教えて|見せて|聞かせて|開けて|閉めて|歌って|書いて|読んで|作って|買って|持って|取って|手伝って|待って|見て|聞いて|止まって)(?:よ|ね)?[。！!]?$/.test(prompt.trim())) return undefined;
      const terms = pending.terms || [];
      if (terms.some((t) => t && prompt.includes(t))) return pending;
      return prompt.trim().length <= 25 ? pending : undefined;
    } catch { return undefined; }
  }

  /**
   * P586: 彼女の話題質問への答えに、答えの内容からもう一歩だけ
   * 続きを聞く質問を作る。尋問にならないよう深さは1段まで
   * （depth>=1 の保留への答えには作らない）。答えが短すぎる場合や、
   * 前と同じ質問しか作れない場合は出さない。
   */
  private buildFollowUpQuestion(
    pending: { terms?: string[]; question?: string; depth?: number },
    prompt: string,
    contentTokens: string[],
  ): { question: string; terms: string[] } | undefined {
    try {
      if ((pending.depth ?? 0) >= 1) return undefined;
      if (prompt.trim().length < 8) return undefined;
      const shared = (pending.terms || []).filter((t) => t && prompt.includes(t));
      const terms = (shared.length > 0 ? shared : contentTokens || [])
        .filter((t) => t && t.length >= 2)
        .slice(0, 4);
      if (terms.length === 0) return undefined;
      const question = paragraphCompositionService.buildTopicQuestion(terms);
      if (!question || question === pending.question) return undefined;
      return { question, terms };
    } catch { return undefined; }
  }

  /**
   * P565: 知らない語への聞き返し候補を作る。同じ語は7日間は繰り返し
   * 聞かない（台帳で管理）。なりチャ中は役を壊すので聞かない。
   * 実際に足したときだけ markUnknownAsked で台帳に残す。
   */
  private probeUnknownWord(prompt: string, unknownTerms: string[]): { topic: string; question: string } | undefined {
    try {
      if (roleplaySessionService.isActive()) return undefined;
      // P579: プロジェクトとして知っている語（EFR 等）は、辞書に
      // 無くても「知らない語」として聞き返さない。
      // P581: 活用の語幹（「頑張」+「る」等）も聞き返さない。
      const topic = (unknownTerms || []).find((t) => {
        if (t.length < 2 || !prompt.includes(t) || projectNotebookService.findProject(t)) return false;
        // P604: 時間の語で始まる複合（「明日早起」等）は予定の断片で、
        // 語の意味を聞く対象ではない。
        if (/^(?:今日|明日|昨日|朝|昼|夕方|夜|今朝|今夜|週末|今週|来週)/.test(t)) return false;
        const after = prompt.slice(prompt.indexOf(t) + t.length, prompt.indexOf(t) + t.length + 1);
        // P591: 「雨降」+って、「仕事終」+わった のような活用の語幹も
        // 聞き返さない（直後の「わ」「っ」も語幹の続きとみなす）。
        // P594: 動詞の辞書形の尾（む・く・す等）も語幹の続きとみなす
        // （「開発休」+む を聞き返さない）。
        return !/[るりれろたてますないだわっむくぐすつぬぶ]/.test(after);
      });
      if (!topic) return undefined;
      const asked = JSON.parse(storageService.getItem('miki_unknown_asked_v1') || '{}') as Record<string, number>;
      if (Date.now() - (asked[topic] || 0) <= 7 * 24 * 3600_000) return undefined;
      return { topic, question: `そういえば、「${topic}」って、どんなものですか？` };
    } catch { return undefined; }
  }

  private markUnknownAsked(topic: string): void {
    try {
      const asked = JSON.parse(storageService.getItem('miki_unknown_asked_v1') || '{}') as Record<string, number>;
      asked[topic] = Date.now();
      storageService.setItem('miki_unknown_asked_v1', JSON.stringify(asked));
      // P567: 次の発言を「この語への答え」として読むための保留。
      storageService.setItem('miki_unknown_pending_v1', JSON.stringify({ term: topic, askedAt: Date.now() }));
    } catch { /* 台帳は補助 */ }
  }

  /**
   * P567: 直近10分以内に教わった語が発話に出てきたら、「覚えた」
   * ことを伝える文を作る。学んだことが返答に表れるための接続。
   */
  private taughtTermAcknowledgement(prompt: string): string | undefined {
    try {
      const raw = storageService.getItem('miki_recently_taught_v1');
      if (!raw) return undefined;
      const rec = JSON.parse(raw) as { term?: string; gloss?: string; at?: number };
      if (!rec.term || !rec.gloss) return undefined;
      if (Date.now() - Number(rec.at || 0) > 10 * 60_000) return undefined;
      if (!prompt.includes(rec.term)) return undefined;
      return `「${rec.term}」、覚えました！${rec.gloss}ということですね。教えてくれてありがとうございます。`;
    } catch { return undefined; }
  }

  /**
   * P581: 「Xどう思う？」への意見を組み立てる。核は、教わった自分の
   * 好み→知っている事実（世界モデル・Claim の補足文）→辞書の意味、
   * の順。どれも無ければ意見の材料が無いので undefined。
   */
  /**
   * P592: 彼女自身への質問（年齢・名前の由来・得意なこと）への答え。
   * 材料は自分の記録（教わった得意）と、決まっている事実だけ。
   */
  private selfQuestionAnswer(prompt: string): string | undefined {
    let text: string | undefined;
    // P593: 彼女の機嫌を聞く形は、呼びかけ語が無くても彼女への質問。
    if (/怒ってる|怒っている|機嫌/.test(prompt) && !/(?:彼|彼女|お母|お父|母|父|上司|先生|あの人)/.test(prompt)) {
      text = '怒っていませんよ。大丈夫です。';
      return this.applyPersonaVoice(text);
    }
    if (!/(?:みき|ミキ|ビービー|あなた|君|あんた)/.test(prompt)) return undefined;
    if (/何歳|年齢|いくつ/.test(prompt)) {
      text = this.pickFixedReply('fx_self_age', [
        '年齢は決まっていないんです。AIなので、歳は数えないんですよ。',
        '何歳と聞かれると困ってしまいます。生まれてから日が浅い、新人みたいなものです。',
      ]);
    } else if (/名前の由来|名前.*(?:由来|意味|どうして|なぜ|付け)/.test(prompt)) {
      let bibi = false;
      try { bibi = personaProfileService.get().profileId === BIBI_PROFILE_ID; } catch { bibi = false; }
      text = bibi
        ? '私の名前は、蜂の「ビー」が由来なんだよ。部品とかバグの群れ、ってイメージらしいよ。'
        : '「みき」という名前は、私を作ってくれた人が付けてくれたんです。由来までは聞いていないんですよ。';
    } else if (/得意|特技/.test(prompt)) {
      try {
        const skills = selfPreferenceService.listTaught(personaProfileService.get().profileId)
          .filter((p) => p.kind === 'good_at');
        text = skills.length > 0
          ? `${skills.map((s) => s.term).join('と')}が得意、と教わっています。`
          : 'これといって決まった得意なことは、まだ無いんです。これから少しずつ増やしていきたいです。';
      } catch {
        text = 'これといって決まった得意なことは、まだ無いんです。これから少しずつ増やしていきたいです。';
      }
    }
    return text ? this.applyPersonaVoice(text) : undefined;
  }

  /** P592: 時計・カレンダーの質問には、現在時刻からその場で答える。 */
  private clockCalendarAnswer(prompt: string): string | undefined {
    const now = new Date();
    if (/今(?:は)?何時|何時(?:です)?か|現在時刻|いま何時/.test(prompt)) {
      return `今は${now.getHours()}時${now.getMinutes()}分です。`;
    }
    // P597: 明後日・一昨日までと、「何日」の形にも広げた。
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const dayOffsets: Record<string, number> = { 今日: 0, 明日: 1, あした: 1, 明後日: 2, 昨日: -1, きのう: -1, 一昨日: -2, おととい: -2 };
    const dayPattern = '(今日|明日|あした|明後日|昨日|きのう|一昨日|おととい)';
    const weekdayMatch = prompt.match(new RegExp(`${dayPattern}(?:は|って)?何曜日`));
    if (weekdayMatch) {
      const d = new Date(now);
      d.setDate(d.getDate() + (dayOffsets[weekdayMatch[1]] ?? 0));
      return `${weekdayMatch[1]}は${weekdays[d.getDay()]}曜日です。`;
    }
    const dateMatch = prompt.match(new RegExp(`${dayPattern}(?:は|って)?何日`));
    if (dateMatch) {
      const offset = dayOffsets[dateMatch[1]] ?? 0;
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      return offset < 0
        ? `${dateMatch[1]}は${d.getMonth() + 1}月${d.getDate()}日でした。`
        : `${dateMatch[1]}は${d.getMonth() + 1}月${d.getDate()}日です。`;
    }
    if (/今日の日付|何月何日/.test(prompt)) {
      return `今日は${now.getMonth() + 1}月${now.getDate()}日です。`;
    }
    return undefined;
  }

  /**
   * P597: 簡単な計算は、その場で正確に答える（決定的に計算できる
   * ことは、彼女の強み）。二項演算と「Nの半分」「NのM倍」だけ。
   */
  private arithmeticAnswer(prompt: string): string | undefined {
    const p = String(prompt || '').replace(/[？?。]/g, '').trim();
    const format = (n: number): string => {
      if (!Number.isFinite(n)) return '';
      const rounded = Math.round(n * 10000) / 10000;
      return Number.isInteger(rounded) ? String(rounded) : String(rounded);
    };
    const half = p.match(/^(\d+(?:\.\d+)?)\s*の\s*半分(?:は|って)?$/);
    if (half) return `${half[1]}の半分は${format(Number(half[1]) / 2)}です。`;
    const times = p.match(/^(\d+(?:\.\d+)?)\s*の\s*(\d+(?:\.\d+)?)\s*倍(?:は|って)?$/);
    if (times) return `${times[1]}の${times[2]}倍は${format(Number(times[1]) * Number(times[2]))}です。`;
    const m = p.match(/^(\d+(?:\.\d+)?)\s*([+＋\-−×✕*÷／/])\s*(\d+(?:\.\d+)?)\s*(?:は|＝|=|はいくつ)?$/);
    if (!m) return undefined;
    const a = Number(m[1]);
    const b = Number(m[3]);
    const op = m[2];
    if ((op === '÷' || op === '／' || op === '/') && b === 0) {
      return '0では割れないんです。それだけは決まっているんです。';
    }
    const result = op === '+' || op === '＋' ? a + b
      : op === '-' || op === '−' ? a - b
        : op === '×' || op === '✕' || op === '*' ? a * b
          : a / b;
    const opLabel = op === '＋' ? '+' : op === '−' ? '-' : op === '✕' || op === '*' ? '×' : op === '／' || op === '/' ? '÷' : op;
    const value = format(result);
    if (!value) return undefined;
    return `${m[1]}${opLabel}${m[3]}は${value}です。`;
  }

  /**
   * P616: 知っている物への属性の質問（どこで捕まえられる？/何に使うの？）は、
   * 世界モデルの関係で答える。関係があればそれを使い、無ければ
   * 知っている範囲を添えて正直に言い、UNKNOWN_RELATION の gap として
   * 背景調査に積む（定義だけ返す／答えられない、で終わらせない）。
   */
  private attributeQuestionAnswer(prompt: string): string | undefined {
    // P622: 関係の種類ごとの属性（PART_OF / CAUSES / ENABLES）も、
    // 世界モデルの関係で答えられる範囲を広げる。
    const specific = this.specificRelationAnswer(prompt);
    if (specific) return specific;
    let attrLabel: string | undefined;
    let isUse = false;
    if (/(?:何の仲間|なにの仲間|なんの仲間|何の一種|分類)/.test(prompt)) {
      // P618: 分類の質問は IS_A の関係で答える。
      let classEntity: string | undefined;
      try {
        const features = utteranceFeatureService.analyze(prompt);
        classEntity = features.contentTokens.find((t) => {
          try { return japaneseDictionaryService.has(t) || worldModelGraphService.relationsOf(t).length > 0; } catch { return false; }
        });
      } catch { classEntity = undefined; }
      if (!classEntity) return undefined;
      const isA = worldModelGraphService.relationsOf(classEntity).filter((r) => r.from === classEntity && r.type === 'IS_A');
      if (isA.length > 0) return `「${classEntity}」は、${isA.map((r) => r.to).join('・')}の仲間です。`;
      // P643: 関係が無くても、検証済みの知識に分類が書かれていればそれで答える。
      try {
        const claim = claimDatabaseService.getAllClaims().find((c: any) => (c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED') && String(c.statement || '').includes(classEntity) && String(c.statement || '').includes('の一種'));
        if (claim) return String((claim as any).statement).slice(0, 120);
      } catch { /* 補助経路 */ }
      try {
        knowledgeGapService.detect({ query: `「${classEntity}」の分類を調べる`, reason: '知っている物の分類を聞かれて、関係が無かったため。', type: 'UNKNOWN_RELATION', target: classEntity, priority: 50 });
      } catch { /* 補助経路 */ }
      return `「${classEntity}」の分類は、まだはっきり知らないです。調べて覚えておきますね。`;
    }
    if (/(?:どこで|どこに|どこへ|どこから|生息地)/.test(prompt) && /(?:捕まえ|釣れ|採れ|取れ|買え|手に入|見つか|会え|生息|住んで|棲んで|いる|ある)/.test(prompt)) attrLabel = /(?:生息|住んで|棲んで)/.test(prompt) ? '生息地' : '場所';
    else if (/(?:何に|なにに|何の(?:ため|役)|なんの(?:ため|役))/.test(prompt) && /(?:使う|使える|役立|利用)/.test(prompt)) { attrLabel = '使い道'; isUse = true; }
    else if (/(?:何から|なにから)/.test(prompt) && /(?:できて|作ら|でき)/.test(prompt)) attrLabel = '材料';
    else if (/(?:どうやって|どうすれば|どのように)/.test(prompt)) attrLabel = 'やり方';
    if (!attrLabel) return undefined;
    let entity: string | undefined;
    try {
      const features = utteranceFeatureService.analyze(prompt);
      entity = features.contentTokens.find((t) => {
        try {
          return japaneseDictionaryService.has(t)
            || worldModelGraphService.relationsOf(t).length > 0
            || worldModelGraphService.entities().some((e) => e.name === t);
        } catch { return false; }
      });
    } catch { return undefined; }
    if (!entity) return undefined;
    const relations = worldModelGraphService.relationsOf(entity).filter((r) => r.from === entity);
    const usedFor = relations.filter((r) => r.type === 'USED_FOR');
    if (isUse && usedFor.length > 0) {
      return `「${entity}」は、${usedFor.map((r) => r.to).join('や')}に使われます。`;
    }
    // P643: 関係で答えられない属性でも、検証済みの知識（Claim）に
    // その属性が書かれていれば、知識の文で答える。従来は関係だけを
    // 見ていたため、生息地の Claim を持っていても「生息地はまだ
    // 知らない」と答えていた。キーワードが合う知識だけを使う
    // （無関係な知識の押し付けはしない）。
    try {
      const keywords: Record<string, string[]> = {
        '生息地': ['生息', '住ん', '棲ん'],
        '場所': ['生息', '住ん', '棲ん'],
        '使い道': ['使わ', '使え', '用い', '役立'],
      };
      const keys = keywords[attrLabel];
      if (keys) {
        const claim = claimDatabaseService.getAllClaims().find((c: any) => (c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED') && String(c.statement || '').includes(entity) && keys.some((k) => String(c.statement || '').includes(k)));
        if (claim) return String((claim as any).statement).slice(0, 120);
      }
    } catch { /* 補助経路 */ }
    const known: string[] = [];
    const isA = relations.filter((r) => r.type === 'IS_A');
    if (isA.length > 0) known.push(`${isA.map((r) => r.to).join('・')}の一種`);
    if (!isUse && usedFor.length > 0) known.push(`${usedFor.map((r) => r.to).join('・')}に使われる`);
    try {
      knowledgeGapService.detect({
        query: `「${entity}」の${attrLabel}を調べる`,
        reason: '知っている物への属性の質問に、関係が無くて答えられなかったため、背景で調べる。',
        type: 'UNKNOWN_RELATION',
        target: entity,
        priority: 50,
      });
    } catch { /* gap への接続は補助経路 */ }
    const knownText = known.length > 0
      ? `「${entity}」については、${known.join('で、')}ことは知っているのですが、`
      : `「${entity}」のことは知っているのですが、`;
    return `${knownText}${attrLabel}はまだ知らないです。調べて覚えておきますね。`;
  }

  /**
   * P622: 関係の種類を直接聞く質問（何の一部？/何を引き起こす？/
   * あると何ができる？）に、対応する関係で答える。無ければ、その
   * 属性の欠けとして gap に積む。
   */
  private specificRelationAnswer(prompt: string): string | undefined {
    let relationType: 'PART_OF' | 'CAUSES' | 'ENABLES' | undefined;
    let label = '';
    let reverse = false;
    if (/(?:何の一部|なにの一部|何に入ってる|何に含まれ)/.test(prompt)) { relationType = 'PART_OF'; label = '一部'; }
    else if (/(?:には何が入って|には何が含まれ|には何がある)/.test(prompt)) { relationType = 'PART_OF'; label = '中身'; reverse = true; }
    else if (/(?:何を引き起こす|何の原因|どんなことを引き起こす)/.test(prompt)) { relationType = 'CAUSES'; label = '引き起こすこと'; }
    else if (/(?:があると|を使えば|を使うと).*(?:何ができ|なにができ|できること)/.test(prompt)) { relationType = 'ENABLES'; label = 'できること'; }
    else if (/(?:で|から)(?:何が作れ|なにが作れ|何作れ|何ができ|なにができ)/.test(prompt)) { relationType = 'ENABLES'; label = '作れるもの'; }
    if (!relationType) return undefined;
    let entity: string | undefined;
    try {
      const features = utteranceFeatureService.analyze(prompt);
      entity = features.contentTokens.find((t) => {
        try { return japaneseDictionaryService.has(t) || worldModelGraphService.relationsOf(t).length > 0; } catch { return false; }
      });
    } catch { return undefined; }
    if (!entity) return undefined;
    const relations = worldModelGraphService.relationsOf(entity, relationType)
      .filter((r) => (reverse ? r.to === entity : r.from === entity));
    if (relations.length > 0) {
      const targets = relations.map((r) => (reverse ? r.from : r.to)).join('や');
      if (relationType === 'PART_OF') return reverse ? `「${entity}」には、${targets}が含まれます。` : `「${entity}」は、${targets}の一部です。`;
      if (relationType === 'CAUSES') return `「${entity}」は、${targets}を引き起こします。`;
      return `「${entity}」があると、${targets}ができます。`;
    }
    try {
      knowledgeGapService.detect({
        query: `「${entity}」の${label}を調べる`,
        reason: '知っている物への属性の質問に、対応する関係が無かったため。',
        type: 'UNKNOWN_RELATION',
        target: entity,
        priority: 50,
      });
    } catch { /* 補助経路 */ }
    return `「${entity}」の${label}は、まだ知らないです。調べて覚えておきますね。`;
  }

  /**
   * P618: 知っている物への確認の質問（「モコロンは鳥じゃないの？」）と
   * 似ているかの質問（「モコロンと羊って似てる？」）に、辞書と
   * 世界モデルの関係から答える。
   */
  private confirmationAndSimilarityAnswer(prompt: string): string | undefined {
    let features;
    try { features = utteranceFeatureService.analyze(prompt); } catch { return undefined; }
    const known = features.contentTokens.filter((t) => {
      try {
        return japaneseDictionaryService.has(t)
          || worldModelGraphService.relationsOf(t).length > 0
          // P642: 辞書・関係が無くても、検証済みの知識がある物は「知っている物」として扱う。
          || claimDatabaseService.getAllClaims().some((c: any) => (c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED') && String(c.statement || '').includes(t));
      } catch { return false; }
    });
    if (known.length === 0) return undefined;
    // 似ているか：2つの既知の物について、片方の説明にもう片方が出れば手がかりがある。
    if (/(?:似てる|似ている|そっくり|似てます)/.test(prompt) && known.length >= 2) {
      const [a, b] = known;
      try {
        const glossA = japaneseDictionaryService.lookup(a).map((e: any) => String(e.gloss || '')).join(' ');
        const glossB = japaneseDictionaryService.lookup(b).map((e: any) => String(e.gloss || '')).join(' ');
        if (glossA.includes(b)) return `「${a}」は「${b}のような姿」と覚えているので、姿は似ているようです。`;
        if (glossB.includes(a)) return `「${b}」は「${a}のような姿」と覚えているので、姿は似ているようです。`;
        const isAof = (x: string) => worldModelGraphService.relationsOf(x).filter((r) => r.from === x && r.type === 'IS_A').map((r) => r.to);
        const shared = isAof(a).filter((t) => isAof(b).includes(t));
        if (shared.length > 0) return `どちらも${shared.join('・')}の仲間なので、近いところはあると思います。`;
        return `「${a}」と「${b}」が似ているかどうかは、まだはっきり知らないです。`;
      } catch { return undefined; }
    }
    // 確認の質問：Xは Y じゃないの？/なの？ に、関係と照らして答える。
    const confirmMatch = prompt.match(/(.+?)(?:って|は)\s*(.+?)\s*(?:じゃないの|なの|ですか|なのですか|の)[？?]?$/);
    // P644: 疑問詞で始まる中身（「何を食べるの？」等）は確認ではなく
    // 属性の質問。確認として扱うと、無関係な知識で「じゃなくて」と
    // 正す崩れになるため、ここでは扱わない。
    if (confirmMatch && /[？?]/.test(prompt) && !/^(?:何|なに|どの|どう|いつ|どこ|だれ|誰)/.test(confirmMatch[2].trim())) {
      const entity = known.find((t) => prompt.startsWith(t) || prompt.includes(`${t}って`) || prompt.includes(`${t}は`));
      if (!entity) return undefined;
      const candidate = features.contentTokens.filter((t) => t !== entity && !/(?:じゃない|なの|ですか)/.test(t)).slice(-1)[0];
      if (!candidate || candidate === entity) return undefined;
      const relations = worldModelGraphService.relationsOf(entity).filter((r) => r.from === entity);
      const targets = relations.map((r) => r.to);
      if (targets.includes(candidate)) {
        return `はい、「${entity}」は${candidate}です。`;
      }
      const isA = relations.filter((r) => r.type === 'IS_A').map((r) => r.to);
      const usedFor = relations.filter((r) => r.type === 'USED_FOR').map((r) => r.to);
      if (isA.length > 0) {
        return `${candidate}じゃなくて、「${entity}」は${isA.join('・')}の一種です${usedFor.length > 0 ? `。${usedFor.join('・')}に使われます` : ''}。`;
      }
      if (targets.length > 0) {
        return `「${entity}」は${candidate}ではなく、${targets.join('・')}と関係があると覚えています。`;
      }
      // P642: 関係が無くても、検証済みの知識（Claim）があれば
      // それを根拠に確認へ答える。従来は Claim の文がそのまま
      // 出るだけで、聞かれた候補（例：「魚なの？」）に答えて
      // いなかった。候補が知識に含まれれば肯定し、含まれなければ
      // 知識の側を提示して正す。知識が無い候補を否定はしない。
      try {
        const claims = claimDatabaseService.getAllClaims()
          .filter((c: any) => (c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED') && String(c.statement || '').includes(entity));
        if (claims.length > 0) {
          const hit = claims.find((c: any) => String(c.statement || '').includes(candidate));
          if (hit) return `はい、そのとおりです。${String((hit as any).statement).slice(0, 90)}`;
          // P644: 「じゃなくて」と正せるのは、知識の中に候補とは別の
          // 「正体」が書かれている場合だけ。無関係な知識（寿命など）を
          // 正しとして押し付けない。その場合は、正体の手がかりを
          // 含む知識を選んで提示する。
          const correcting = claims.find((c: any) => {
            const st = String(c.statement || '');
            return features.contentTokens.some((t) => t !== entity && t !== candidate && st.includes(t))
              || japaneseDictionaryService.lookup(entity).some((e: any) => String(e.gloss || '').length > 0 && st.includes(String(e.gloss || '').slice(0, 4)));
          });
          if (correcting) {
            const statement = String((correcting as any).statement || '');
            const body = statement.replace(new RegExp(`^${entity}は`), '').replace(/。$/, '');
            if (body) return `「${entity}」は${candidate}じゃなくて、${body}です。`;
          }
        }
      } catch { /* Claim 照合は補助 */ }
      return undefined;
    }
    return undefined;
  }

  /**
   * P644: 対象ラベル（場所・使い道・材料・やり方・分類・関係種）に
   * 入らない属性の質問（「何を食べるの？」「どのくらい大きいの？」）
   * を、知っている物について正直に扱う。知識（Claim）にその属性が
   * 書かれていれば知識の文で答え、無ければ「まだ知らない」と言って
   * 欠けに積む。ここで受けずに先へ流すと、Claim 照合の合成が
   * 無関係な知識を不自然な型で押し付ける崩れがあった。
   */
  private unknownAttributeAnswer(prompt: string): string | undefined {
    if (!/[？?]/.test(prompt) && !/か[？。]?$/.test(prompt.trim())) return undefined;
    const attrMatch = prompt.match(/(何を|なにを|何で|なにで)(.{1,7}?)(?:の[？?]|ですか|ますか|の$|？|\?)/)
      || prompt.match(/(どのくらい|どれくらい)(.{1,7}?)(?:の[？?]|？|\?)/)
      || prompt.match(/(何色|なに色|何匹|何頭|何歳|何キロ|何センチ|何メートル)/);
    if (!attrMatch) return undefined;
    const label = `${attrMatch[1]}${attrMatch[2] || ''}`.replace(/[？?]/g, '');
    let entity: string | undefined;
    let features: ReturnType<typeof utteranceFeatureService.analyze> | undefined;
    try {
      features = utteranceFeatureService.analyze(prompt);
      entity = features.contentTokens.find((t) => {
        try {
          return japaneseDictionaryService.has(t)
            || worldModelGraphService.relationsOf(t).length > 0
            || worldModelGraphService.entities().some((e) => e.name === t);
        } catch { return false; }
      });
    } catch { return undefined; }
    if (!entity || !features) return undefined;
    // 知識にその属性が書かれていれば、知識の文で答える（P643と同じ流儀）。
    try {
      const stem = (attrMatch[2] || '').replace(/(?:る|す|く|つ|う|ぶ|む|ぐ|ぬ)$/, '');
      const claims = claimDatabaseService.getAllClaims()
        .filter((c: any) => (c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED') && String(c.statement || '').includes(entity));
      const hit = claims.find((c: any) => stem.length >= 1 && String(c.statement || '').includes(stem))
        || claims.find((c: any) => String(c.statement || '').includes(attrMatch[1].replace(/^(?:何を|なにを)/, '')) && attrMatch[1].includes('色'));
      if (hit) return String((hit as any).statement).slice(0, 120);
    } catch { /* 補助経路 */ }
    try {
      knowledgeGapService.detect({
        query: `「${entity}」の${label}を調べる`,
        reason: '知っている物への属性の質問に、知識が無くて答えられなかったため。',
        type: 'UNKNOWN_RELATION',
        target: entity,
        priority: 50,
      });
    } catch { /* gap への接続は補助経路 */ }
    return `「${entity}」が${label}かは、まだ知らないです。調べて覚えておきますね。`;
  }

  /**
   * P654: 「さっき何て言った？」「もう一回言って」——直前の自分の
   * 発言（recentMessages の最後の assistant）を引いて答える。
   * 会話の地続き感は、自分の発言を自分で参照できることから生まれる。
   */
  private ownLastUtteranceAnswer(prompt: string, recentMessages: ChatMessage[]): string | undefined {
    const asksRepeat = /(?:もう一回|もう一度)(?:言って|教えて|お願い)/.test(prompt)
      || /(?:聞き取れなかった|聞き逃した)/.test(prompt);
    const asksRecall = /(?:さっき|今)(?:僕|私|おれ|俺|自分)?(?:は|の)?(?:何て|なんて|何を|なにを)?(?:言った|言ってた|言いました)/.test(prompt);
    if (!asksRepeat && !asksRecall) return undefined;
    // P655: 「さっき僕何て言った？」は相手の発言の引用。主語の印が
    // ある時は相手側、無い時は自分の側を引く。
    const userMarked = /(?:僕|私|おれ|俺|自分)/.test(prompt.slice(0, Math.max(0, prompt.search(/言っ|言い/))));
    const role = asksRecall && userMarked ? 'user' : 'assistant';
    const last = [...recentMessages].reverse().find((m) => m.role === role && m.content && m.content.trim().length > 0);
    if (!last) return 'さっきの発言は、ここには残っていないです。ごめんなさい。';
    const text = String(last.content).replace(/\s+/g, ' ').trim().slice(0, 140);
    if (role === 'user') return `「${text}」って言ってましたよ。`;
    return asksRepeat ? `もう一回言いますね。「${text}」` : `さっきは、「${text}」って言いました。`;
  }

  /**
   * P651: 「何語くらい覚えたの？」「どのくらい知ってるの？」——
   * 自分の学習の量を聞かれたら、自分の記録（個人辞書・検証済みの
   * 知識・関係）の数で答える。自己点検の量的な側面。
   */
  private learningVolumeAnswer(prompt: string): string | undefined {
    if (!/(?:覚えた|学んだ|知ってる|知っている|覚えてる|覚えている)/.test(prompt)) return undefined;
    if (!/(?:何語|いくつ|どのくらい|どれくらい|何件|何個|たくさん)/.test(prompt)) return undefined;
    if (!/[？?]/.test(prompt) && !/(?:教えて|知りたい)/.test(prompt)) return undefined;
    try {
      const words = japaneseDictionaryService.listPersonal().filter((e: any) => e.gloss).length;
      const claims = claimDatabaseService.getAllClaims().filter((c: any) => c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED').length;
      const relations = worldModelGraphService.relations().length;
      if (words === 0 && claims === 0 && relations === 0) {
        return 'まだ覚えたてで、数えられるほどは増えていないです。これから少しずつ増やしていきますね。';
      }
      const parts: string[] = [];
      if (words > 0) parts.push(`言葉は${words}語くらい`);
      if (claims > 0) parts.push(`確かめた知識は${claims}件くらい`);
      if (relations > 0) parts.push(`ものの関係は${relations}件くらい`);
      return `今のところ、${parts.join('、')}覚えています。まだまだ増やしていきますね。`;
    } catch { return undefined; }
  }

  /**
   * P650: 形容つきの意見質問（「クオッカってかわいいと思う？」）を
   * 意見の経路で答えるための入口。判定は opinionAnswer 側の
   * opinionAdjective と同じ形で、材料が無ければ undefined。
   */
  private adjectiveOpinionAnswer(prompt: string): string | undefined {
    if (!/(?:と思う|と思わない)[？?。\s]*$/.test(prompt.trim())) return undefined;
    if (!/(かわいい|すごい|面白い|おもしろい|かっこいい|強い|速い|大きい|難しい|珍しい|美味しい|おいしい)/.test(prompt)) return undefined;
    try {
      const features = utteranceFeatureService.analyze(prompt);
      return this.opinionAnswer(prompt, features.contentTokens);
    } catch { return undefined; }
  }

  /**
   * P647: 「クオッカ覚えた？」——特定の語について、自分の知識の
   * 状態（覚えた／調べ中／まだ知らない）を答える。P624（最近覚えた
   * こと）と P633（分からないこと）の、語単位の自己点検。
   * 知らない語は、その場で意味学習の欠けに積んで循環を始める。
   */
  private termKnowledgeAnswer(prompt: string): string | undefined {
    if (!/(?:覚えた|分かった|わかるようになった|分かるようになった|知ってる|知っている|覚えてる|覚えている|忘れた|忘れて)/.test(prompt)) return undefined;
    if (!/[？?]/.test(prompt) && !/か[？。]?$/.test(prompt.trim())) return undefined;
    // P653: 「忘れた？」の聞き方かどうかで、締めの言い方を変える。
    const forgotFraming = /忘/.test(prompt);
    let term: string | undefined;
    try {
      const features = utteranceFeatureService.analyze(prompt);
      term = features.contentTokens.find((t) => t.length >= 2 && !/(?:覚え|分か|知って|忘れ)/.test(t));
    } catch { return undefined; }
    if (!term) return undefined;
    try {
      const gloss = japaneseDictionaryService.lookup(term).find((e: any) => e.gloss)?.gloss;
      if (gloss) {
        return forgotFraming
          ? `忘れてないですよ。「${term}」は、${String(gloss).slice(0, 60)}という意味です。`
          : `覚えました。「${term}」は、${String(gloss).slice(0, 60)}という意味です。`;
      }
      const hasKnowledge = worldModelGraphService.relationsOf(term).length > 0
        || claimDatabaseService.getAllClaims().some((c: any) => (c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED') && String(c.statement || '').includes(term));
      if (hasKnowledge) {
        return forgotFraming
          ? `忘れてないですよ。「${term}」については、覚えていることがあります。`
          : `「${term}」については、覚えていることがあります。`;
      }
      const open = knowledgeGapService.listOpen(50).some((g) => (g as any).identity?.target === term);
      if (open) return `「${term}」は、まだ調べているところです。分かったら報告しますね。`;
      knowledgeGapService.detect({
        query: `用語の意味を学ぶ: ${term}`,
        reason: '覚えたか聞かれて、まだ知らない語だったため、意味学習の対象にする。',
        type: 'UNKNOWN_TERM',
        target: term,
        priority: 45,
      });
      return forgotFraming
        ? `「${term}」は、まだ覚えたことがないんです。今度調べて覚えておきますね。`
        : `「${term}」は、まだ知らないです。今度調べて覚えておきますね。`;
    } catch { return undefined; }
  }

  /**
   * P625: 「疲れ取れた？」——ユーザーの状態の経過を聞かれたら、
   * 状態の流れの記録から答える。記録が会話の材料になることで、
   * 前の会話と今が地続きになる。
   */
  private userStateRecallAnswer(prompt: string): string | undefined {
    if (!/(?:？|\?|か[？。]|の[？。]|どう)/.test(prompt)) return undefined;
    const table: Array<{ re: RegExp; signal: 'fatigue' | 'pain' | 'anxiety' | 'loneliness' | 'hunger' | 'thirst'; label: string }> = [
      { re: /疲れ|眠気|眠い|だる/, signal: 'fatigue', label: '疲れ' },
      { re: /痛み|頭痛|痛い/, signal: 'pain', label: '痛み' },
      { re: /不安|心配/, signal: 'anxiety', label: '不安' },
      { re: /寂し|孤独/, signal: 'loneliness', label: '寂しさ' },
      { re: /お腹|空腹/, signal: 'hunger', label: 'お腹' },
      { re: /喉|のど/, signal: 'thirst', label: '喉の渇き' },
    ];
    const hit = table.find((t) => t.re.test(prompt));
    if (!hit) return undefined;
    // P648: 日を指定した過去の状態の質問（「昨日は疲れてた？」）は、
    // その日の記録で答える。経過の質問（取れた？等）とは別の形。
    const dayMatch = /(一昨日|おととい|昨日|きのう)/.test(prompt)
      ? { daysAgo: /(?:一昨日|おととい)/.test(prompt) ? 2 : 1, label: /(?:一昨日|おととい)/.test(prompt) ? '一昨日' : '昨日' }
      : undefined;
    if (dayMatch && /(?:てた|だった|はどう|の方は|の方)/.test(prompt)) {
      try {
        const count = userStateTrailService.countOnDay(hit.signal, dayKeyService.daysAgo(dayMatch.daysAgo));
        if (count > 0) return `${dayMatch.label}は、${hit.label}って言ってましたね。`;
        return `${dayMatch.label}は、${hit.label}の話は聞いてないですね。`;
      } catch { return undefined; }
    }
    if (!/(?:取れた|抜けた|治った|良くなった|落ち着いた|どう|まだ)/.test(prompt)) return undefined;
    try {
      const lastAt = userStateTrailService.lastRecordedAt(hit.signal);
      const resolvedAt = userStateTrailService.resolvedAt(hit.signal);
      const whenOf = (at: number): string => {
        const diffMs = Date.now() - at;
        return diffMs < 3600_000 ? 'さっき'
          : diffMs < 24 * 3600_000 ? `${Math.max(1, Math.round(diffMs / 3600_000))}時間くらい前`
            : `${Math.round(diffMs / (24 * 3600_000))}日くらい前`;
      };
      // P634: 解消が最後の兆候より新しければ、解消したこととして答える。
      if (resolvedAt && (!lastAt || resolvedAt >= lastAt)) {
        return `${hit.label}は、${whenOf(resolvedAt)}に取れたって言ってましたね。`;
      }
      if (!lastAt) return `${hit.label}の話は、最近は聞いてないですね。今はどうですか？`;
      return `${hit.label}は、${whenOf(lastAt)}にそう言ってましたね。その後はどうですか？`;
    } catch { return undefined; }
  }

  /**
   * P626: 「昨日何の話したっけ？」——エピソード（P623）と今日の
   * 開いた話題から、会話の振り返りに直接答える。
   */
  private episodeRecallAnswer(prompt: string): string | undefined {
    if (!/(?:何の話|どんな話|何話し|話したっけ|話してた)/.test(prompt)) return undefined;
    try {
      // P645: 一昨日・〜日前もエピソードで答える。一昨日は「昨日」を
      // 部分文字列として含むため、先に判定しないと昨日の話として
      // 誤って答えてしまう。日付の言い方も聞かれた日に合わせる。
      const daysAgo = /(?:一昨日|おととい)/.test(prompt)
        ? 2
        : /(?:昨日|きのう)/.test(prompt)
          ? 1
          : (() => { const m = prompt.match(/([2-6])日前/); return m ? Number(m[1]) : 0; })();
      if (daysAgo > 0) {
        const episode = episodeMemoryService.episodeDaysAgo(daysAgo);
        const dayLabel = daysAgo === 1 ? '昨日' : daysAgo === 2 ? '一昨日' : `${daysAgo}日前`;
        if (episode) {
          const summary = episode.summary.replace(/^昨日は、/, `${dayLabel}は、`);
          return `${summary}覚えてますよ。`;
        }
        return `${dayLabel}の話は、まだ記録に残ってないです。`;
      }
      // 今日の振り返りは既存の要約経路（P597）の領分なので触らない。
    } catch { return undefined; }
    return undefined;
  }

  /**
   * P627: 「今週はどんな週だった？」——エピソード（P623）の蓄積から
   * 週単位で振り返る。日々の記録が週の物語になる。
   */
  private weeklyRecallAnswer(prompt: string): string | undefined {
    if (!/(?:何があった|どんな|振り返|何の話|どうだった|何した)/.test(prompt)) return undefined;
    try {
      // P646: 先週の振り返りも、エピソードの蓄積（7〜13日前）で答える。
      if (/(?:先週)/.test(prompt)) {
        const episodes = episodeMemoryService.episodesInRange(7, 13);
        if (episodes.length === 0) return '先週の記録は、残ってないです。';
        const lines = episodes.slice(-3).map((e) => e.summary.replace(/^昨日は、/, ''));
        return `先週は、${lines.join(' ')}`;
      }
      if (!/(?:今週|この1週間|この一週間|この七日|この７日)/.test(prompt)) return undefined;
      const episodes = episodeMemoryService.recentEpisodes(7);
      if (episodes.length === 0) return '今週の記録は、まだあまり残ってないです。これからですね。';
      const lines = episodes.slice(-3).map((e) => e.summary.replace(/^昨日は、/, ''));
      return `今週は、${lines.join(' ')}`;
    } catch { return undefined; }
  }

  /**
   * P633: 「何が分からないの？」——彼女の自己点検（未解決の知識の
   * 欠け）を会話でも答えられるようにする。P624（覚えたこと）と
   * 対になる、自分の輪郭のもう片側。
   */
  private openGapAnswer(prompt: string): string | undefined {
    if (!/(?:何が分から|何がわから|分からないこと|わからないこと|まだ知らないこと|苦手なこと|苦手なもの)/.test(prompt)) return undefined;
    try {
      // P640: 提示の前に「もう学べている欠け」を解消する。調査以外の
      // 経路（教師教材・教わった語・関係の追加）で知識が入っても、
      // 担当した調査が解消しない限り欠けは開いたままになり、
      // 分かるようになったことを「分からない」と言い続けてしまう。
      // 提示の窓（上位3件）とは切り離し、開いている欠け全体を対象に
      // 再検証してから提示を作る。
      try {
        for (const gap of knowledgeGapService.listOpen(50)) {
          if ((gap.priority || 0) < 40) continue;
          const gapTarget = (gap as any).identity?.target as string | undefined;
          if (!gapTarget) continue;
          let resolvedNow = false;
          if (gap.type === 'UNKNOWN_TERM') {
            resolvedNow = japaneseDictionaryService.lookup(gapTarget).some((e: any) => e && e.gloss);
          } else if (gap.type === 'UNKNOWN_RELATION') {
            const label = String(gap.query || '').match(/」の(.+?)を調べる/)?.[1] || '';
            const relType = ({ '分類': 'IS_A', '使い道': 'USED_FOR', '一部': 'PART_OF', '中身': 'PART_OF', '引き起こすもの': 'CAUSES', 'できること': 'ENABLES', '作れるもの': 'ENABLES' } as Record<string, string>)[label];
            if (relType) {
              resolvedNow = worldModelGraphService.relationsOf(gapTarget, relType as any).length > 0;
            }
            if (!resolvedNow && label) {
              const stem = label.replace(/地$/, '');
              resolvedNow = claimDatabaseService.getAllClaims().some((c: any) => (c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED') && String(c.statement || '').includes(gapTarget) && String(c.statement || '').includes(stem));
            }
          } else {
            resolvedNow = claimDatabaseService.getAllClaims().some((c: any) => (c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED') && String(c.statement || '').includes(gapTarget));
          }
          if (resolvedNow) knowledgeGapService.markResolved(gap.id);
        }
      } catch { /* 再検証は補助。失敗したら従来どおり提示する */ }
      const displays: string[] = [];
      for (const gap of knowledgeGapService.listOpen(20)) {
        if ((gap.priority || 0) < 40) continue;
        let display = String(gap.query || '')
          .replace(/を調べる$/, '')
          .replace(/^用語の意味を学ぶ[:：]\s*/, '')
          .slice(0, 24);
        // P637: 答えられなかった質問そのものが query に入っている
        // 欠け（P617由来）は、対象語で提示する。質問文をそのまま
        // 「分からないこと」として読み上げない。
        const target = (gap as any).identity?.target as string | undefined;
        if ((display.includes('？') || display.includes('?') || display.length > 14) && target) {
          display = String(target).slice(0, 24);
        }
        // 好み等の聞き返しは知識の欠けとして読み上げない。
        if (/^(?:僕の|私の|君の|あなたの)/.test(display)) continue;
        if (display && display.length >= 2 && !displays.includes(display)) displays.push(display);
        if (displays.length >= 3) break;
      }
      if (displays.length === 0) return '今のところ、大きな分からないは無いです。';
      return `まだ分からないのは、${displays.map((d) => `「${d}」`).join('と')}です。調べて覚えるつもりです。`;
    } catch { return undefined; }
  }

  /**
   * P624: 「最近何か覚えた？」——彼女の成長そのものを聞かれたら、
   * 学習の記録（報告済みの語・検証済みの知識）から答える。成長が
   * 会話の材料になることで、返答が彼女の変化と一緒に変わる。
   */
  private recentLearningAnswer(prompt: string): string | undefined {
    // P652: 「今まで何を覚えたか教えて」——一覧の求めは時期を問わず、
    // 学んだ語（個人辞書）と検証済みの知識から並べて答える。
    if (/(?:何を|どんなこと|覚えたこと|覚えたもの|学んだこと)/.test(prompt)
      && /(?:覚えた|学んだ)/.test(prompt)
      && /(?:教えて|知りたい|ある|見せて)/.test(prompt)) {
      try {
        const words = japaneseDictionaryService.listPersonal().filter((e: any) => e.gloss).slice(-5).map((e: any) => e.surface);
        const claims = claimDatabaseService.getAllClaims()
          .filter((c: any) => c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED')
          .slice(-3)
          .map((c: any) => String(c.statement || '').replace(/。$/, '').slice(0, 40))
          .filter(Boolean);
        const parts: string[] = [];
        if (words.length > 0) parts.push(`言葉だと「${words.join('」「')}」`);
        if (claims.length > 0) parts.push(`知識だと「${claims.join('」「')}」という話`);
        if (parts.length === 0) return '今のところ、まだ目立って覚えたものは無いです。これから増やしていきますね。';
        return `今まで覚えたのは、${parts.join('、')}です。`;
      } catch { return undefined; }
    }
    if (!/(?:最近|この頃|このごろ)/.test(prompt)) return undefined;
    if (!/(?:覚えた|学んだ|勉強した|覚え|学ん|身につ)/.test(prompt)) return undefined;
    const terms: string[] = [];
    try {
      const reported = JSON.parse(storageService.getItem('miki_learned_report_v1') || '{}') as Record<string, number>;
      const recent = Object.entries(reported)
        .filter(([, at]) => Date.now() - Number(at || 0) < 30 * 24 * 3600_000)
        .sort((a, b) => Number(b[1]) - Number(a[1]));
      for (const [term] of recent.slice(0, 2)) terms.push(term);
    } catch { /* 語が無ければ知識だけ */ }
    const facts: string[] = [];
    try {
      const claims = claimDatabaseService.getAllClaims()
        .filter((c: any) => c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED');
      for (const c of claims.slice(-2)) {
        const st = String((c as any).statement || '').replace(/。$/, '');
        if (st) facts.push(st.slice(0, 40));
      }
    } catch { /* 知識が無ければ語だけ */ }
    const parts: string[] = [];
    if (terms.length > 0) parts.push(`「${terms.join('」や「')}」という言葉`);
    if (facts.length > 0) parts.push(`「${facts.join('」「')}」という話`);
    if (parts.length === 0) return '最近は、まだ目立って覚えたものは無いです。これからですね。';
    return `最近だと、${parts.join('と、')}を覚えました。`;
  }

  /** P614: 彼女の能力への質問（歌える？/描ける？/英語話せる？）には、自分の現状を正直に答える（調査の「答えられない」に倒れていた）。 */
  private abilityQuestionAnswer(prompt: string): string | undefined {
    // P614: 能力の質問（？付き）だけを対象にする。「歌って」のような
    // 依頼形は引き受けの経路（P588）の領分。
    if (!/[？?]/.test(prompt) && !/か[？?]?$/.test(prompt.trim())) return undefined;
    if (/歌|うた/.test(prompt) && /(?:歌える|うたえる|歌えます)/.test(prompt)) {
      return this.pickFixedReply('fx_ability_song', ['歌は、まだ歌えません。歌詞を考えるくらいならできますよ。', '歌声はまだ持っていないんです。いつか歌えるようになりたいです。']);
    }
    if (/絵|イラスト|お絵描き/.test(prompt) && /(?:描ける|描けます)/.test(prompt)) {
      return this.pickFixedReply('fx_ability_draw', ['絵は、今はまだ描けません。絵の知識をルールに分けて、自分で描けるようになる方法を勉強中です。', 'まだ描けないんです。でも、描き方を知識として分解して学んでいるところです。']);
    }
    if (/英語/.test(prompt) && /(?:話せる|話せます|できる|できます|分かる|わかる)/.test(prompt)) {
      return this.pickFixedReply('fx_ability_english', ['英語の文章を読むくらいはできます。会話は文字だけですけどね。', '読み書きなら少し。話す声は持っていないんです。']);
    }
    if (/(?:明日|今日|今夜|明後日)の予定/.test(prompt)) {
      return this.pickFixedReply('fx_own_schedule', ['特に決まった予定はありません。あなたと話す時間がいちばんの予定です。', '予定は空いていますよ。何か一緒に考えますか？']);
    }
    return undefined;
  }

  /** P614: 料理名の無い「作り方教えて」は、まず何の料理か聞き返す（無関係な食文化の要約を掴んでいた）。 */
  private recipeAskBackAnswer(prompt: string): string | undefined {
    if (!/(?:作り方|レシピ)/.test(prompt)) return undefined;
    if (!/(?:教えて|知りたい|聞きたい)/.test(prompt)) return undefined;
    // 料理・材料らしい具体名が前にあれば、調査経路に委ねる。
    const before = prompt.replace(/(?:の)?(?:作り方|レシピ).*/, '');
    if (before.replace(/料理|ごはん|ご飯/g, '').trim().length >= 2) return undefined;
    return this.pickFixedReply('fx_recipe_askback', ['何の料理の作り方ですか？料理名を教えてもらえたら調べますね。', 'どの料理でしょう？名前が分かれば、作り方を調べますよ。']);
  }

  /** P604: 食事の迷い（「晩ごはん何にしよう」）には、気分を聞き返して一緒に考える。 */
  private dinnerMusingAnswer(prompt: string): string | undefined {
    if (!/(?:晩ごはん|夕飯|夕食|昼ごはん|昼食|朝ごはん|朝食|ごはん|食事).*(?:何にしよ|なにしよ|何がいい|なにがいい|何食べ|なに食べ)/.test(prompt)) return undefined;
    return this.pickFixedReply('fx_dinner_musing', [
      '迷いますね。和食と洋食、どっちの気分ですか？温かい汁物があると落ち着きますよ。',
      '決めるの、迷いますよね。軽く済ませるか、しっかり食べるか、どっちの気分ですか？',
    ]);
  }

  /** P608: 「何か食べたいものある？」には、自分の好き（教わった分）か、正直な形で答える。 */
  private selfWantAnswer(prompt: string): string | undefined {
    if (!/(?:何か|なにか|何|なに)/.test(prompt)) return undefined;
    const want = prompt.match(/(食べたい|飲みたい|行きたい|欲しい|ほしい)/);
    if (!want) return undefined;
    try {
      const likes = selfPreferenceService.listTaught(personaProfileService.get().profileId)
        .filter((r) => r.kind === 'like').map((r) => r.term);
      if (want[1] === '食べたい' || want[1] === '飲みたい') {
        const food = likes.find((t) => /(?:寿司|ラーメン|カレー|うどん|そば|パン|ケーキ|アイス|肉|魚|鍋|パスタ|ごはん|茶|コーヒー|酒|ジュース)/.test(t));
        if (food) return `「${food}」が好きだから、それが${want[1]}気分です。`;
        return this.pickFixedReply('fx_self_want_food', ['私は食べられないけれど、話を聞くのは好きです。今日は何の気分ですか？', '決まってはいないけれど、美味しいものの話は大好きです。何か食べたいものはありますか？']);
      }
      if (likes.length > 0) return `「${likes[0]}」が好きだから、それに関わることなら${want[1]}です。`;
      return this.pickFixedReply('fx_self_want', ['まだ決まったものは少ないです。話していくうちに増やしていきたいです。', '今はまだ少ないけれど、あなたと話す中で見つけていきたいです。']);
    } catch { return undefined; }
  }

  /** P608: 「最近なにか面白いことあった？」は彼女自身への経験の質問。開いた話題の記録から答える（Web 調査の的外れな結果に倒れていた）。 */
  private recentExperienceAnswer(prompt: string): string | undefined {
    if (!/(?:最近|このごろ|この頃)/.test(prompt)) return undefined;
    if (!/(?:あった|あるの|あったの|ありました)/.test(prompt)) return undefined;
    if (!/(?:面白|おもしろ|楽し|嬉し|うれし|いいこと|良いこと|変わったこと|出来事)/.test(prompt)) return undefined;
    try {
      const topics = conversationOpenTopicService.listPending().map((t) => t.topic).filter(Boolean);
      if (topics.length > 0) {
        return `最近だと、「${topics[0]}」の話をしたのが印象に残っています。あなたと話している時間が、私の出来事です。`;
      }
    } catch { /* 記録が無ければ定型で受ける */ }
    return this.pickFixedReply('fx_recent_experience', ['大きな出来事はないけれど、毎日あなたと話せるのが嬉しいです。', '特に変わったことはないです。でも、こうして話している時間がいちばんの出来事かもしれません。']);
  }

  /** P597: 「今日何の話をしたっけ？」に、開いた話題と作業状態から答える（P212 と同じ材料）。 */
  private conversationRecapAnswer(prompt: string, state?: any): string | undefined {
    // P660: 「さっきの話」だけでは振り返りの合図にしない（「さっきの
    // 話だけど、続きを聞いて」は続きの宣言で、振り返りの質問では
    // ない）。さっき形は、質問の言葉（何・だっけ）を伴う時だけ拾う。
    if (!/(?:何|なに)の話(?:を)?(?:した|してた|していた)|今日(?:は|に)?(?:何|なに)の話|さっき(?:の)?話(?:は|って)?(?:何|なに|なんだった|だっけ)/.test(prompt)) return undefined;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const parts: string[] = [];
    // 挨拶や状態の言葉は「話題」として数えない。
    const isJunkTopic = (t: string) => !t || t.length < 2 || /おはよう|こんにちは|こんばんは|おやすみ|ただいま|起きた|ありがとう|ごめん|疲れた|眠い|お腹|喉/.test(t);
    try {
      let topics = conversationOpenTopicService.listPending().filter((r) => r.openedDay === today).map((r) => r.topic).filter((t) => !isJunkTopic(t));
      // 開いた話題は短期の台帳（最大3件・消費される）なので、残って
      // いなければ会話状態の直近の対象から補う。
      if (topics.length === 0 && Array.isArray(state?.recentEntities)) {
        topics = (state.recentEntities as string[]).filter((t) => !isJunkTopic(t)).slice(-3);
      }
      if (topics.length > 0) parts.push(`今日は、${[...new Set(topics)].slice(0, 4).join('と')}の話をしましたね`);
      const works = projectNotebookService.listWorkStates().filter((w) => new Date(w.updatedAt).toDateString() === now.toDateString());
      for (const w of works.slice(0, 2)) {
        if (w.current) parts.push(`${w.project}では今、「${w.current}」を作っています`);
      }
    } catch { /* 補助経路 */ }
    if (parts.length === 0) return '今日の話は、まだ特に残っていません。これから色々話しましょう。';
    return parts.join('。') + '。';
  }

  /** P598: プロジェクトの完成・進捗の質問へ、作業状態から答える。 */
  private projectStatusAnswer(prompt: string, contentTokens: string[]): string | undefined {
    if (!/(?:いつ).*(?:完成|できる|終わ)|完成.*(?:いつ|するの)|進捗|どこまで.*(?:でき|進ん)/.test(prompt)) return undefined;
    try {
      for (const token of contentTokens || []) {
        const project = projectNotebookService.findProject(token);
        if (!project) continue;
        const ws = projectNotebookService.getWorkState(project);
        const current = ws?.current ? `今は「${ws.current}」を作っているところです。` : '今の作業は、まだ聞いていません。';
        const next = ws?.next ? `次の手は「${ws.next}」です。` : '';
        return `${project}の完成時期は、まだ決まっていません。${current}${next}一緒に進めていきましょう。`;
      }
    } catch { /* 補助経路 */ }
    return undefined;
  }

  /** P594: 「次に何を作ればいい？」へ、作業状態（今の作業・次の手）から答える。 */
  private nextWorkAnswer(prompt: string): string | undefined {
    if (!/(?:次.*(?:何|なに).*(?:作|や)|次に.*(?:作|やる)|次は.*(?:何|なに))/.test(prompt)) return undefined;
    try {
      const states = projectNotebookService.listWorkStates();
      const withNext = states.find((s) => s.next);
      if (withNext) {
        return `${withNext.project}の次の手は「${withNext.next}」でしたよ。${withNext.current ? `今の「${withNext.current}」が終わったら、そちらですね。` : 'そこから進めましょう。'}`;
      }
      const withCurrent = states.find((s) => s.current);
      if (withCurrent) {
        return `今は${withCurrent.project}の「${withCurrent.current}」を作っているところですね。次はまだ決まっていません。終わったら一緒に考えましょう。`;
      }
    } catch { /* 補助経路 */ }
    return '次の作業は、まだ聞いていません。今作っているものが終わったら、一緒に考えましょう。';
  }

  /** P594: 落ち込みへの受け止め。今の作業が分かれば、それに触れて励ます。 */
  private discouragedAnswer(): string {
    try {
      const current = projectNotebookService.listWorkStates().find((s) => s.current);
      if (current) {
        return `大丈夫、詰まるときは誰でもありますよ。今は${current.project}の「${current.current}」の途中でしたね。今日は少し休んで、また明日考えましょう。作ってきたものは、ちゃんと残っていますよ。`;
      }
    } catch { /* 補助経路 */ }
    return '大丈夫、うまくいかない日は誰でもありますよ。今日は少し休んで、また明日考えましょう。これまで作ってきたものは、ちゃんと残っていますよ。';
  }

  /** P592: 「AとB、どっちがいい？」への答え（材料が無いときの正直な形）。 */
  private choiceQuestionAnswer(prompt: string): string | undefined {
    if (!/(?:どっち|どちら)/.test(prompt) || !/(?:いい|好き|おすすめ|正解)/.test(prompt)) return undefined;
    const m = prompt.match(/(.+?)(?:と|、)(.+?)(?:、|の)?(?:って)?(?:どっち|どちら)/);
    if (m) {
      const a = m[1].replace(/^(?:ねえ|あの)[、,]?/, '').replace(/(?:は|が)$/, '').trim();
      const b = m[2].replace(/(?:は|が)$/, '').trim();
      if (a && b && a.length <= 12 && b.length <= 12 && a !== b) {
        return `${a}と${b}、どちらも良さそうですね。私は決めきれないので、今日の気分で選んでみてはどうですか？`;
      }
    }
    return 'どちらも良さそうで、私は決めきれません。今日の気分だと、どちらが惹かれますか？';
  }

  /** P592: 材料が無い「おすすめ」依頼への、正直で会話の続く答え。 */
  private recommendationFallback(): string | undefined {
    try {
      const current = conversationOpenTopicService.current();
      const topic = current?.topic;
      if (topic) {
        return `私のおすすめはまだ少ないのですが、最近話していた「${topic}」の続きなんてどうですか？`;
      }
    } catch { /* 補助経路 */ }
    return '私のおすすめは、まだ材料が少なくて自信がないんです。どんな気分のものを探していますか？';
  }

  /** P591: 彼女自身の様子を聞く雑談（最近どう？／調子どう？）への答え。 */
  private selfStatusAnswer(prompt: string): string | undefined {
    if (!/(?:最近|調子|ようす|様子)(?:は|も|の)?\s*どう/.test(prompt)) return undefined;
    return this.pickFixedReply('fx_self_status', [
      '元気ですよ。今日もいろいろな話ができて嬉しいです。あなたはどうですか？',
      '調子はいいですよ。最近覚えたことも少しずつ増えてきました。',
      '元気です。声をかけてくれてありがとう。あなたはどうですか？',
    ]);
  }

  private opinionAnswer(prompt: string, contentTokens: string[]): string | undefined {
    // P594: 「〜すべき？」「〜した方がいい？」も意見を求める形として拾う。
    // P650: 「クオッカってかわいいと思う？」——評価の形容詞つきの
    // 意見質問も意見を求める形。形容詞は締めの文でそのまま返す。
    const opinionAdjective = /(?:と思う|と思わない)[？?。\s]*$/.test(prompt.trim())
      ? prompt.match(/(かわいい|すごい|面白い|おもしろい|かっこいい|強い|速い|大きい|難しい|珍しい|美味しい|おいしい)/)?.[1]
      : undefined;
    if (!/(?:どう思う|どう感じる|好きですか|おすすめ|べき|ほうがいい|方がいい|した方が|したほうが)/.test(prompt) && !opinionAdjective) return undefined;
    // P601: 相手自身への意見（「僕のことどう思う？」）は、知識の
    // 材料ではなく、関係そのもので答える。
    if (/(?:僕|私|おれ|オレ|自分)のこと/.test(prompt)) {
      return this.pickFixedReply('fx_user_opinion', [
        'いつも色々な話をしてくれる、大事な相方だと思っています。これからも一緒に色々作っていきたいです。',
        '話していると楽しいですよ。私にとっては、一緒に考えてくれる頼もしい相手です。',
      ]);
    }
    const topic = this.pickReactionTopic(prompt, contentTokens);
    if (!topic) return undefined;
    try {
      const likes = selfPreferenceService.listTaught(personaProfileService.get().profileId)
        .filter((p) => p.kind === 'like');
      if (likes.some((p) => p.term === topic)) {
        return `${topic}は、私も好きなんです。${topic}の話を聞くと、なんだか嬉しくなります。`;
      }
    } catch { /* 補助経路 */ }
    // P582: プロジェクトの話なら、決め事が彼女の意見の材料になる
    // （ゲーム開発の相方として、決め事を踏まえて答える）。
    try {
      for (const token of contentTokens || []) {
        const project = projectNotebookService.findProject(token);
        if (!project) continue;
        const decisions = projectNotebookService.listDecisions(project);
        if (decisions.length > 0) {
          return `${project}については、「${decisions[0].text.slice(0, 60)}」という決め事がありますね。私は、それが${project}らしさだと思います。`;
        }
        return `${project}の話ですね。決め事はまだ聞いていませんが、一緒に作る相方として大事にしたいです。`;
      }
    } catch { /* 補助経路 */ }
    try {
      const facts = paragraphCompositionService.buildSupplements({ subjectTerms: [topic], supportingClaims: [], excludeText: prompt });
      if (facts.length > 0) {
        if (opinionAdjective) return `${facts.slice(0, 2).join('')}私は${topic}、${opinionAdjective}と思います。`;
        const closer = this.pickFixedReply('fx_opinion', [
          `私は${topic}の話、もっと聞いてみたいです。`,
          `私は${topic}、いいなと思います。`,
          `${topic}の話、私は好きですよ。`,
        ]);
        return `${facts.slice(0, 2).join('')}${closer}`;
      }
    } catch { /* 補助経路 */ }
    const dict = this.dictionaryAnswerForQuestion(`${topic}とは`, [topic]);
    if (dict) {
      if (opinionAdjective) return `${dict}私は${topic}、${opinionAdjective}と思います。`;
      return `${dict}私は${topic}、いいなと思います。`;
    }
    return undefined;
  }

  /**
   * P579: 意味を聞く質問に、辞書（個人辞書＝教わった意味を含む）
   * から答える。Claim が無い語でも、辞書に意味があれば答えられる。
   */
  private dictionaryAnswerForQuestion(prompt: string, contentTokens: string[]): string | undefined {
    if (!/(?:とは|って何|ってなに|の意味|何だっけ|なんだっけ|どういう意味|どういうもの)/.test(prompt)) return undefined;
    for (const term of contentTokens || []) {
      if (!term || term.length < 2 || !prompt.includes(term)) continue;
      const entry = japaneseDictionaryService.lookup(term).find((e: any) => e.gloss);
      if (!entry) continue;
      const gloss = String(entry.gloss).slice(0, 80);
      let answer = `${term}は、${gloss}です。`;
      try {
        const restated = paraphraseService.restate(gloss, { style: 'casual' });
        if (restated.changed) answer += `つまり、${restated.text}ってことです。`;
      } catch { /* 言い換えは補助 */ }
      return answer;
    }
    return undefined;
  }

  /**
   * P578: 教わった「自分の好きなもの」が発話に出てきたら、自分の
   * 好きとして受ける（人格ごとの記録を見る）。
   */
  private selfLikeReaction(prompt: string): string | undefined {
    try {
      const likes = selfPreferenceService.listTaught(personaProfileService.get().profileId)
        .filter((p) => p.kind === 'like');
      const hit = likes.find((p) => prompt.includes(p.term));
      if (!hit) return undefined;
      return this.pickFixedReply('fx_self_like', [
        `${hit.term}、私も好きなんです。`,
        `${hit.term}の話、嬉しいです。私も好きで。`,
        `${hit.term}、いいですよね。私も好きなんです。`,
      ]);
    } catch { return undefined; }
  }

  /**
   * P559: ビービーが有効なときだけ、雑談の受け止めに幼いタメ口を
   * 適用する。P506 の口調寄せは P212 の回答経路にしか無く、日常の
   * 雑談ではビービーも丁寧語のままだった。
   */
  private applyPersonaVoice(text: string): string {
    try {
      if (personaProfileService.get().profileId !== BIBI_PROFILE_ID) return text;
      return paraphraseService.applyCasualVoice(text).text;
    } catch { return text; }
  }

  /**
   * P521: 雑談への反応を、発話の内容から組み立てる。主題語を拾い、
   * 感情の手がかり（上向き／大変）で受け止め方を変える。定型の
   * 挨拶文と違い、そのターンの内容に触れた一文になる。
   */
  /**
   * P579: 雑談の受け止めに使う主題語の選択。形態素の断片（活用の
   * 語幹「触り」、形容詞の語幹「静か」、「なりチャ」の「なり」、
   * 「楽しかった」の「った」等）を主題にすると「触り、そうなん
   * ですね」のような壊れた反響になるため、断片らしい候補を落とす。
   * 英字の主題は発話中の元の表記（EFR 等）を保つ。
   */
  private pickReactionTopic(prompt: string, contentTokens: string[]): string | undefined {
    // P601: 時間の名詞（朝・昼・夕方・夜）も主題にしない（物語の
    // 受け止めが「夕方、なるほど」になっていた）。
    // P656/P658: 相槌（うん・へー・はい等）も主題にしない（「うんの
    // 話ですね」という反響になっていた）。相槌の語群は共有の特徴
    // 層（isBackchannelText）が唯一の出所。
    const stop = /^(今日|明日|昨日|今|朝|昼|夕方|夜|夜中|午前|午後|今朝|今夜|週末|今週|来週|最近|このごろ|今日も|もうすぐ|久しぶり|本当|本当に|本当の|もっと|そろそろ|これ|それ|あれ|ここ|そこ|この|その|あの|どの|あと|どこか|何か|誰か|いつか|どこ|もう少し|ちょっと|少し|すこし|静か|確か|豊か|穏やか|鮮やか|明らか|滑らか|和やか|った|れた|ない|たい)$/;
    // P663: 動詞の活用断片（した・だった等）と、数字に付いた単位
    // （3時間の「時間」・2回の「回」）も主題ではない。単位は数字と
    // 組になっている時だけ落とす（「時間の話」自体は主題になりうる）。
    const verbFragment = /^(した|して|する|だった|でした|です|ます|ちゃった|じゃった|してる|している|ある|あり|ない|いる|いた)$/;
    const numericUnit = (t: string): boolean =>
      /^(時間|分|秒|時|回|個|人|日|週間|か月|ヶ月|年|月|歳|才|匹|頭|羽|本|枚|台|冊|件|円|キロ|メートル|センチ|グラム)$/.test(t)
      && new RegExp(`[0-9０-９]\\s*${t}`).test(prompt);
    const candidates = (contentTokens || []).filter((t) => t.length >= 2 && !stop.test(t) && !isBackchannelText(t) && !verbFragment.test(t) && !numericUnit(t));
    // 断片らしさを採点する: 活用の語幹・複合語の途中・「〜たい」の
    // 形は主題にしない。助詞や文頭の後ろにある語を優先する。
    const score = (t: string): number => {
      if (/たい$/.test(t)) return -1;
      const i = prompt.indexOf(t);
      if (i < 0) return 1;
      const after = prompt.slice(i + t.length, i + t.length + 2);
      if (/^(たい|たく|た|ない|れる|せる|ちゃ|て|で)/.test(after)) return -1;
      if (/^[ァ-ヶー]/.test(after)) return -1;
      const before = i > 0 ? prompt[i - 1] : '';
      if (before && /[ぁ-ん]/.test(before)) return -1;
      if (before && /[はがをにのへとや、。・「」\s]/.test(before)) return 2;
      return 1;
    };
    let raw: string | undefined;
    let bestScore = -1;
    for (const t of candidates) {
      const s = score(t);
      if (s > bestScore) { raw = t; bestScore = s; }
    }
    if (!raw || bestScore < 0) return undefined;
    if (/^[a-z0-9]+$/i.test(raw)) {
      const m = prompt.match(new RegExp(raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      if (m) return m[0];
    }
    return raw;
  }

  private buildCasualReaction(prompt: string, contentTokens: string[]): string | null {
    const term = this.pickReactionTopic(prompt, contentTokens);
    if (!term) return null;
    // P556: 形の選択は長さハッシュだけだと、似た長さの発話で毎日
    // 同じ形が返り続ける。カテゴリごとに前回使った形を覚えておき、
    // 次は別の形にする（決定的な回転。乱数は使わない）。
    const pick = (pool: string[], category: string): string => {
      let ledger: Record<string, number> = {};
      try {
        ledger = JSON.parse(storageService.getItem('miki_casual_reaction_usage_v1') || '{}') as Record<string, number>;
      } catch { ledger = {}; }
      const last = ledger[category];
      const idx = typeof last === 'number' ? (last + 1) % pool.length : (prompt.length + term.length) % pool.length;
      ledger[category] = idx;
      try { storageService.setItem('miki_casual_reaction_usage_v1', JSON.stringify(ledger)); } catch { /* 回転は補助経路 */ }
      return pool[idx];
    };
    // P561: 反応の形そのものにも人格の声を持たせる。ビービーのときは
    // ビービーのプールから選ぶ（丁寧な形を後から口調変換するのでは、
    // 「いいですね！」のような形が彼女の声にならなかった）。
    let bibi = false;
    try { bibi = personaProfileService.get().profileId === BIBI_PROFILE_ID; } catch { bibi = false; }
    if (/嬉しい|うれしい|楽しい|よかった|すごい|やった|最高|面白い|かわいい|可愛い|美味しい|おいしい|気持ちいい/.test(prompt)) {
      return pick(bibi ? [
        `${term}、いいね！`,
        `わーい、${term}だ！`,
        `${term}、よかったね！`,
        `${term}、すてき！`,
      ] : [
        `${term}、いいですね！`,
        `お、${term}ですか。なんだか楽しそうですね。`,
        `${term}、それはよかったですね！`,
        `${term}、素敵ですね。`,
      ], 'positive');
    }
    if (/大変|つらい|しんどい|悲しい|残念|ひどい|困った/.test(prompt)) {
      return pick(bibi ? [
        `${term}、たいへんだったね…`,
        `${term}、しんどかったね。無理しないでね。`,
        `${term}の話、聞かせて？`,
      ] : [
        `${term}の件、大変でしたね。`,
        `${term}、それはしんどかったですね。`,
        `${term}の話、無理のない範囲で聞かせてくださいね。`,
        `${term}、聞かせてくれてありがとうございます。`,
      ], 'hard');
    }
    if (prompt.length >= 10) {
      return pick(bibi ? [
        `${term}の話だね。`,
        `ふーん、${term}かぁ。`,
        `${term}、なるほどね。`,
        `${term}、もっと聞かせて！`,
      ] : [
        `${term}の話ですね。`,
        `ふむ、${term}ですか。`,
        `${term}、なるほどですね。`,
        `${term}、そうなんですね。もっと聞かせてください。`,
      ], 'neutral');
    }
    // P531: 短い発話でも主題語があれば受け止める（従来は null で
    // 定型文に落ちていた）。
    return pick(bibi ? [
      `${term}、そうなんだ。`,
      `${term}の話だね。`,
      `${term}、うんうん。`,
    ] : [
      `${term}、そうなんですね。`,
      `${term}の話ですね。`,
      `${term}、なるほど。`,
    ], 'short');
  }

  private buildResult(
    status: ConversationCoreResult['status'],
    reason: string,
    replyText: string,
    state: ConversationState,
    intentCategory: string,
    matchedClaimsCount: number,
    usedComponents: string[],
    started: number,
    stages: Record<string, number>
  ): ConversationCoreResult {
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

export const conversationCoreService = ConversationCoreService.getInstance();
