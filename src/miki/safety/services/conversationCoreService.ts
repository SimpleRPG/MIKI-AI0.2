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
import { pendingSlotService } from '../../memory/services/pendingSlotService';
import { fixedReplyStatsService } from '../../memory/services/fixedReplyStatsService';
import { activationService } from '../../memory/services/activationService';
import { personaProfileService, BIBI_PROFILE_ID } from '../../conversation/services/personaProfileService';
import { roleplaySessionService } from '../../conversation/services/roleplaySessionService';
import { shiritoriService } from '../../conversation/services/shiritoriService';
import { userMemoService } from '../../conversation/services/userMemoService';
import { quizService } from '../../conversation/services/quizService';
import { utteranceEventClassifierService } from '../../conversation/services/utteranceEventClassifierService';
import { utteranceFeatureService, isBackchannelText } from '../../memory/services/utteranceFeatureService';
import { topicStageService } from '../../memory/services/topicStageService';
import { worldModelGraphService } from '../../selfAwareness/services/worldModelGraphService';
import { episodeMemoryService } from '../../conversation/services/episodeMemoryService';
import { dayKeyService } from '../../memory/services/dayKeyService';
import { unitConversionService } from '../../memory/services/unitConversionService';
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
import { conversationGraphCompletionP214Service } from '../../conversation/services/conversationGraphCompletionP214Service';
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
    let prompt = params.prompt.trim().replace(/\s+/g, ' ');
    let state = params.conversationState || defaultConversationState();
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
      recentMessages,
    );
    const dialogueAct = interpretation.dialogueAct;
    // P856: P214 の談話スタックへ、通常会話の話題も供給する。
    // 今までは P212（自己照会）の経路でしか積まれず、自己照会の
    // 質問が来た時点でスタックが空・古いことが多かった。積み方は
    // P212 内部と同じ（内容語＋概念ID、指示的な発話は積まない）。
    try {
      if (!roleplaySessionService.isActive()) {
        const terms = (japaneseAnalysis?.contentTokens || []).filter(Boolean);
        if (terms.length > 0) {
          conversationGraphCompletionP214Service.observeTopic(
            prompt,
            terms,
            terms.flatMap((t: string) => japaneseDictionaryService.conceptIdsFor(t)),
          );
        }
      }
    } catch { /* スタックは補助経路 */ }
    // P707: 話題質問の保留は「見たら必ず消す」のが原則だが、消費が
    // 後段にしか無く、手前の受け口で早期リターンすると保留が残って
    // 次の発話を答えとして食べてしまう。消費はここで一度だけ行い、
    // 結果を後段へ引き継ぐ。
    const answeredPendingEarly = this.consumePendingTopicQuestion(prompt);
    // P710: 会話状態（話題・直近の対象）は、その発話がどの受け口で
    // 答えられても進める。手前の受け口の早期リターンは状態を素通し
    // していたため、「モコロンって知ってる？」の直後の「それって…」
    // が何も掴めず、断片（何食）が調査対象になっていた。進め方は
    // 後段の nextState と同じ規則（話題は空の時だけ差し替え、対象は
    // 新しいものを後ろに足して上限10件）。
    try {
      const turnTopic = this.extractTopic(prompt);
      state = {
        ...state,
        currentTopic: state.currentTopic || turnTopic,
        recentEntities: Array.from(new Set([
          ...(state.recentEntities || []),
          // P710: 対象候補は2文字以上の内容語だけ（語幹の断片や
          // 文まるごとは入れない。照応の候補プールを汚すため）。
          ...this.entityTokenCandidates(japaneseAnalysis.contentTokens),
          ...(interpretation.anaphora?.resolved ? [interpretation.anaphora.resolved] : []),
        ].filter(Boolean))).slice(-10),
        updatedAt: Date.now(),
      };
    } catch { /* 状態の前進は補助 */ }
    const vocabulary = (interpretation as any).vocabulary || (interpretation.semantic as any)?.vocabulary || conversationUnknownVocabularyService.assess(prompt, { allowResearch: true });
    let unknownTerms = Array.isArray(vocabulary?.unknowns)
      ? vocabulary.unknowns.map((item: any) => String(item.term || '')).filter(Boolean).slice(0, 3)
      : [];
    // P710: 照応が一意に解けた場合（それ→モコロン）、文頭の指示語を
    // 実体に置き換えてから後段に渡す。解けた対象が状態に記録される
    // だけで使われていなかったため、「それって何食べるの？」が
    // 断片「何食」の調査になっていた。置き換えたら未知語も数え直す。
    try {
      const ana = interpretation.anaphora;
      // P720: 解けた先が総称（動物・もの等）なら、それは指示語の
      // 指す固有の対象ではない。置き換えると「動物って何科の動物？」
      // のような文になるため、総称への置き換えはしない。同じ理由で、
      // 辞書にも関係にも裏付けの無い断片（「い動物」等）への置き換え
      // もしない。置き換えは裏付けのある実体だけにする。
      const genericReferent = /^(動物|植物|もの|こと|場所|人|食べ物|飲み物|鳥|魚|虫|花|木)$/.test(String(ana?.resolved || ''));
      let validatedReferent = false;
      try {
        validatedReferent = !!ana?.resolved && (japaneseDictionaryService.has(String(ana.resolved)) || worldModelGraphService.relationsOf(String(ana.resolved)).length > 0);
      } catch { validatedReferent = false; }
      if (ana?.resolved && ana?.confidence === 'unique' && ana?.detectedExpression && !genericReferent && validatedReferent) {
        const re = new RegExp(`^${ana.detectedExpression}(って|は|の|が|を|も|に|って何)`);
        if (re.test(prompt)) {
          prompt = prompt.replace(re, `${ana.resolved}$1`);
          const reassessed: any = conversationUnknownVocabularyService.assess(prompt, { allowResearch: true } as any);
          if (Array.isArray(reassessed?.unknowns)) {
            unknownTerms = reassessed.unknowns.map((item: any) => String(item.term || '')).filter(Boolean).slice(0, 3);
          }
        }
      }
    } catch { /* 照応の置き換えは補助 */ }
    // P710: 「何+漢字1字」が動詞の語幹の断片である場合は未知語から
    // 外す（「何食べる」の漢字連続「何食」が語として切り出される）。
    // 後ろに動詞の活用語尾が続く場合だけを断片とみなし、「何者だ」
    // のような本物の語（後ろは助詞・助動詞）は残す。
    unknownTerms = unknownTerms.filter((t) => {
      if (!/^何[一-龠]$/.test(t)) return true;
      const idx = prompt.indexOf(t);
      const next = idx >= 0 ? prompt.charAt(idx + t.length) : '';
      return !/[べるくむうつぬぐす]/.test(next);
    });
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
          // P853: 直近に固定返答を使っていたら、その言い回しへの
          // 「当たり」として使用統計にも残す（降格の材料）。
          try { fixedReplyStatsService.recordStrikeIfRecent(); } catch { /* 統計は補助 */ }
        }
      }
    } catch { /* 台帳は補助経路 */ }
    // P818: 性質で絞った数え（「夜に活動する獣は何種類？」）は、
    // 本人の事実の想起より先に受ける。想起が1件の事実に一致して
    // しまい、数えの質問が単品の聞き返しに化けていた。
    const traitCountEarly = roleplaySessionService.isActive() ? undefined : this.taughtTraitCountAnswer(prompt);
    // P824: 「僕の身長と体重を教えて」のような複合の聞き返しは、
    // 単品の想起では拾えず調査に落ちていた。2つ以上の属性が
    // そろって知れている時だけ、まとめて先に答える。
    const combinedFactEarly = roleplaySessionService.isActive() ? undefined : this.combinedFactRecallAnswer(prompt, memories);
    // P456 (A): 本人が伝えた事実への聞き返しは、未知語の調査橋より先に
    // 保持済みの本人発言由来の事実で照合する。一致したときだけ想起経路へ進み、
    // 一致しなければ従来経路（調査橋・Claim 照合・分からない）に委ねる。
    const userFactRecall = (traitCountEarly || combinedFactEarly) ? null : conversationUserFactRecallService.matchRecall(
      prompt,
      memories,
      (state as any).recentUserFactSummaries
    );
    // P592: 彼女自身への質問（何歳？／名前の由来／得意なこと）と、
    // 時計・カレンダーの質問は、調査の対象ではない。自分の記録と
    // 現在時刻から、その場で答える（Web 調査の的外れな結果や
    // 「確認できていない」に倒れていた）。
    if (!roleplaySessionService.isActive() && !userFactRecall) {
      // P818: 性質で絞った数えは、ここで先に返す（想起より手前で
      // 計算済み）。
      if (traitCountEarly) {
        return this.buildResult('RESOLVED', 'taught_trait_count_answer', this.applyPersonaVoice(traitCountEarly), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P824: 複合の事実の聞き返しも、ここで先に返す。
      if (combinedFactEarly) {
        return this.buildResult('RESOLVED', 'combined_fact_recall_answer', this.applyPersonaVoice(combinedFactEarly), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P603: 短い別れの挨拶は、そのまま締めとして返す（状態次第で
      // 分析的な合成や時間ガードに逸れることがあった）。
      if (/^(?:じゃあ[、,]?\s*)?(?:じゃあね|じゃね|またね|また明日(?:ね|よ)?|バイバイ|さようなら|さよなら)[！!。]?$/.test(prompt.trim())) {
        const bye = this.pickFixedReply('fx_goodbye', ['さようなら。またいつでも声をかけてくださいね。', 'じゃあ、また！今日もありがとうございました。', 'さようなら。またお話ししましょうね。']);
        return this.buildResult('RESOLVED', 'farewell_closing', this.applyPersonaVoice(bye), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P598: 知識への明示の訂正（「XじゃなくてY」）は、古い知識の
      // 言い直しで返さず、訂正として受ける。
      // P768: 予定の変更文は訂正ではなく予定の受け止めで返す
      // （台帳側は取り込みで処理済み）。
      if (dialogueAct === 'CORRECTION' && /(?:じゃなくて|ではなく)/.test(prompt)
        && /(?:予定|予約|約束)/.test(prompt) && /(?:変えた|変更)/.test(prompt)
        && /(?:明後日|明日|あした|今日|今夜|今週|来週|再来週|週末|今度)/.test(prompt)) {
        const chm = prompt.match(/(?:じゃなくて|ではなく)\s*(.{1,16}?)(?:に変えた|に変更|にした|に変え)/);
        const right = chm?.[1]?.trim();
        const text = right
          ? `分かりました、予定は「${right}」に変えておきますね。`
          : '分かりました、予定を変えておきますね。';
        return this.buildResult('RESOLVED', 'plan_change_received', this.applyPersonaVoice(text), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P830: 日の訂正形（「明日じゃなくて明後日だよ」）は、台帳の
      // 付け替え結果で返す。汎用の訂正受けが先に「覚え直しますね」
      // とだけ返していたが、実際に直るのは予定の日付の方。
      if (dialogueAct === 'CORRECTION' && /^(?:今日|明日|あした|明後日|明々後日|[日月火水木金土]曜日)(?:じゃなくて|じゃなく|ではなく)/.test(prompt)) {
        const movedAck = this.planMoveAnswer(prompt);
        if (movedAck) {
          return this.buildResult('RESOLVED', 'plan_move_answer', this.applyPersonaVoice(movedAck), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
        }
      }
      // P831: 予定の内容の訂正も、台帳の差し替え結果で返す
      // （汎用の訂正受けより先）。
      if (dialogueAct === 'CORRECTION') {
        const contentAck = this.planContentCorrectionAnswer(prompt);
        if (contentAck) {
          return this.buildResult('RESOLVED', 'plan_content_correction_answer', this.applyPersonaVoice(contentAck), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
        }
      }
      // P858: 予定の取り消しも、台帳の取り消し結果で返す。
      {
        const cancelAck = this.planCancelAnswer();
        if (cancelAck) {
          return this.buildResult('RESOLVED', 'plan_cancel_answer', this.applyPersonaVoice(cancelAck), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
        }
      }
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
      // P816: 予定の日付ずらしは、付け替え済みの結果を受け答えする
      // （二つの日付を含む文が時間不整合の骨格文に落ちないように）。
      const planMoveEarly = multiPart ? undefined : this.planMoveAnswer(prompt);
      if (planMoveEarly) {
        return this.buildResult('RESOLVED', 'plan_move_answer', this.applyPersonaVoice(planMoveEarly), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P824: 件数の質問（「来週の予定は何件？」）は想起より先に
      // 数える。想起のゲートが「何」を拾ってしまい、範囲とは
      // 無関係な「まだ聞いていない」に化けていた。
      const planCountEarly = multiPart ? undefined : this.planCountAnswer(prompt);
      if (planCountEarly) {
        return this.buildResult('RESOLVED', 'plan_count_answer', this.applyPersonaVoice(planCountEarly), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P754: 「明日の予定、何時からだっけ？」は現在時刻の質問では
      // なく予定の聞き返し。時計の即答より先に予定の控えを見る
      // （控えに無い時は従来どおり時計が受ける）。
      // P867: 「明日の予定、何時からだっけ？」は開始時刻の質問。
      // 予定の聞き返しが先に返ると、時刻入りの文面がそのまま
      // 返ってしまうため、時刻の答えを先に見る。
      const planTimeEarly = multiPart ? undefined : this.planTimeAnswer(prompt);
      if (planTimeEarly) {
        return this.buildResult('RESOLVED', 'plan_time_answer', this.applyPersonaVoice(planTimeEarly), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const planRecallEarly = multiPart ? undefined : this.planRecallAnswer(prompt);
      if (planRecallEarly) {
        return this.buildResult('RESOLVED', 'plan_recall_answer', this.applyPersonaVoice(planRecallEarly), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const weekPlans = multiPart ? undefined : this.weekPlansAnswer(prompt);
      if (weekPlans) {
        return this.buildResult('RESOLVED', 'week_plans_answer', this.applyPersonaVoice(weekPlans), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const upcomingPlans = multiPart ? undefined : this.upcomingPlansAnswer(prompt);
      if (upcomingPlans) {
        return this.buildResult('RESOLVED', 'upcoming_plans_answer', this.applyPersonaVoice(upcomingPlans), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const nextBdayAge = multiPart ? undefined : this.nextBirthdayAgeAnswer(prompt, memories);
      if (nextBdayAge) {
        return this.buildResult('RESOLVED', 'next_birthday_age_answer', this.applyPersonaVoice(nextBdayAge), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const monthPlans = multiPart ? undefined : this.monthPlansAnswer(prompt);
      if (monthPlans) {
        return this.buildResult('RESOLVED', 'month_plans_answer', this.applyPersonaVoice(monthPlans), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const planCountdown = multiPart ? undefined : this.planCountdownAnswer(prompt, memories);
      if (planCountdown) {
        return this.buildResult('RESOLVED', 'plan_countdown_answer', this.applyPersonaVoice(planCountdown), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const nextPlan = multiPart ? undefined : this.nextPlanAnswer(prompt);
      if (nextPlan) {
        return this.buildResult('RESOLVED', 'next_plan_answer', this.applyPersonaVoice(nextPlan), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const planCount = multiPart ? undefined : this.planCountAnswer(prompt);
      if (planCount) {
        return this.buildResult('RESOLVED', 'plan_count_answer', this.applyPersonaVoice(planCount), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const planWhen = multiPart ? undefined : this.planWhenAnswer(prompt);
      if (planWhen) {
        return this.buildResult('RESOLVED', 'plan_when_answer', this.applyPersonaVoice(planWhen), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P838: 続きの「何時から？」は現在時刻ではなく、直前に話した
      // 予定の開始時刻。時計の即答より先に台帳の時刻を見る。
      const planTime = multiPart ? undefined : this.planTimeAnswer(prompt);
      if (planTime) {
        return this.buildResult('RESOLVED', 'plan_time_answer', this.applyPersonaVoice(planTime), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const clockAnswer = multiPart ? undefined : this.clockCalendarAnswer(prompt);
      if (clockAnswer) {
        // P868: 時計・カレンダーの答えにも人格の口調を通す
        // （予定の時刻の答え等は通していたのに、ここだけ素通り
        // だった）。
        return this.buildResult('RESOLVED', 'clock_calendar_answer', this.applyPersonaVoice(clockAnswer), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
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
      const decisionRecall = this.decisionRecallAnswer(prompt, japaneseAnalysis?.contentTokens || []);
      if (decisionRecall) {
        return this.buildResult('RESOLVED', 'decision_recall_answer', this.applyPersonaVoice(decisionRecall), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P597: 簡単な計算と、今日の会話の振り返りも、その場で答える
      // （計算は調査に倒れ、振り返りは P212 にしか無かった）。
      const arithmetic = this.arithmeticAnswer(prompt);
      if (arithmetic) {
        return this.buildResult('RESOLVED', 'arithmetic_answer', arithmetic, state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P676: 単位の換算（1時間は何分？）も、共有の換算表で即答する。
      const unitAnswer = this.unitConversionAnswer(prompt);
      if (unitAnswer) {
        return this.buildResult('RESOLVED', 'unit_conversion_answer', unitAnswer, state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P677: 数の比較と文字数も、決定的に答えられる。
      const compareAnswer = this.comparisonAndCountAnswer(prompt);
      if (compareAnswer) {
        return this.buildResult('RESOLVED', 'comparison_count_answer', compareAnswer, state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P731: 「Xの仲間って他にいる？」——世界モデルの分類から
      // 兄弟を答える（仮の関係だけが根拠なら出所を添える）。
      const sibling = this.siblingAnswer(prompt);
      if (sibling && !multiPart) {
        return this.buildResult('RESOLVED', 'sibling_answer', this.applyPersonaVoice(sibling), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P732: 「AとB、どっちが大きい？」——説明文の手がかりで比べ、
      // 足りなければ正直に言う（作業目安の書式が会話に漏れない）。
      const factAgeCompare = this.factAgeComparisonAnswer(prompt, memories);
      if (factAgeCompare) {
        return this.buildResult('RESOLVED', 'fact_age_comparison_answer', this.applyPersonaVoice(factAgeCompare), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const glossCompare = this.glossComparisonAnswer(prompt, memories, state, recentMessages);
      if (glossCompare && !multiPart) {
        return this.buildResult('RESOLVED', 'gloss_comparison_answer', this.applyPersonaVoice(glossCompare), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P734: 「今まで教えた生き物、全部言ってみて」——教わった
      // 語彙の一覧を、個人辞書の教示記録から答える。
      const taughtList = this.taughtListAnswer(prompt);
      if (taughtList && !multiPart) {
        return this.buildResult('RESOLVED', 'taught_list_answer', this.applyPersonaVoice(taughtList), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P735: 「教えた動物の中で一番大きいのは？」——説明文の
      // 手がかりで最上級に答える。
      const factSuper = this.factSuperlativeAnswer(prompt, memories);
      if (factSuper) {
        return this.buildResult('RESOLVED', 'fact_superlative_answer', this.applyPersonaVoice(factSuper), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const superlative = this.glossSuperlativeAnswer(prompt);
      if (superlative && !multiPart) {
        return this.buildResult('RESOLVED', 'gloss_superlative_answer', this.applyPersonaVoice(superlative), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const factRanking = this.factRankingAnswer(prompt, memories);
      if (factRanking) {
        return this.buildResult('RESOLVED', 'fact_ranking_answer', this.applyPersonaVoice(factRanking), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const ranking = this.taughtRankingAnswer(prompt);
      if (ranking && !multiPart) {
        return this.buildResult('RESOLVED', 'taught_ranking_answer', this.applyPersonaVoice(ranking), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const factDiff = this.factDifferenceAnswer(prompt, memories);
      if (factDiff) {
        return this.buildResult('RESOLVED', 'fact_difference_answer', this.applyPersonaVoice(factDiff), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const measDiff = this.measureDifferenceAnswer(prompt, state, recentMessages);
      if (measDiff && !multiPart) {
        return this.buildResult('RESOLVED', 'measure_difference_answer', this.applyPersonaVoice(measDiff), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const factThr = this.factThresholdAnswer(prompt, memories);
      if (factThr) {
        return this.buildResult('RESOLVED', 'fact_threshold_answer', this.applyPersonaVoice(factThr), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const measRange = this.measureRangeAnswer(prompt);
      if (measRange) {
        return this.buildResult('RESOLVED', 'measure_range_answer', this.applyPersonaVoice(measRange), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const measThr = this.measureThresholdAnswer(prompt);
      if (measThr && !multiPart) {
        return this.buildResult('RESOLVED', 'measure_threshold_answer', this.applyPersonaVoice(measThr), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const factAgg = this.factAggregateAnswer(prompt, memories);
      if (factAgg) {
        return this.buildResult('RESOLVED', 'fact_aggregate_answer', this.applyPersonaVoice(factAgg), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P820: 人の事実の真ん中も、その場で答える。
      const factMedian = this.factMedianAnswer(prompt, memories);
      if (factMedian) {
        return this.buildResult('RESOLVED', 'fact_median_answer', this.applyPersonaVoice(factMedian), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P821: 人の事実どうしの比と、年齢の見通しも、その場で答える。
      const factRatio = this.factRatioAnswer(prompt, memories);
      if (factRatio) {
        return this.buildResult('RESOLVED', 'fact_ratio_answer', this.applyPersonaVoice(factRatio), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const factProj = this.factAgeProjectionAnswer(prompt, memories);
      if (factProj) {
        return this.buildResult('RESOLVED', 'fact_age_projection_answer', this.applyPersonaVoice(factProj), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P822: 説明どうしの比と、誕生日からの割り出しも、その場で答える。
      const glossRatio = this.glossRatioAnswer(prompt, state, recentMessages);
      if (glossRatio) {
        return this.buildResult('RESOLVED', 'gloss_ratio_answer', this.applyPersonaVoice(glossRatio), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const bdayDerived = this.birthdayDerivedAnswer(prompt, memories);
      if (bdayDerived) {
        return this.buildResult('RESOLVED', 'birthday_derived_answer', this.applyPersonaVoice(bdayDerived), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const measAgg = this.measureAggregateAnswer(prompt, state, recentMessages);
      if (measAgg && !multiPart) {
        return this.buildResult('RESOLVED', 'measure_aggregate_answer', this.applyPersonaVoice(measAgg), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P819: 実測値の真ん中（中央）も、その場で答える。
      const measMedian = this.measureMedianAnswer(prompt);
      if (measMedian && !multiPart) {
        return this.buildResult('RESOLVED', 'measure_median_answer', this.applyPersonaVoice(measMedian), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const habitatList = this.glossHabitatListAnswer(prompt);
      if (habitatList && !multiPart) {
        return this.buildResult('RESOLVED', 'gloss_habitat_list_answer', this.applyPersonaVoice(habitatList), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P838: 一覧の後の「他には？」は、直前の一覧と付き合わせて
      // 正直に答える（一覧の答えを控えておき、増えていなければ
      // 「他にはいない」と言える）。
      const listFollowup = multiPart ? undefined : this.lastListFollowupAnswer(prompt);
      if (listFollowup) {
        return this.buildResult('RESOLVED', 'last_list_followup_answer', this.applyPersonaVoice(listFollowup), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P819: 動詞句の性質で絞った一覧は、名詞の性質の一覧より先に
      // 受ける（句の形は従来どちらにも乗らなかった）。
      const traitListVp = this.taughtTraitListAnswer(prompt);
      if (traitListVp && !multiPart) {
        return this.buildResult('RESOLVED', 'taught_trait_list_answer', this.applyPersonaVoice(traitListVp), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const traitList = this.glossTraitListAnswer(prompt);
      if (traitList && !multiPart) {
        return this.buildResult('RESOLVED', 'gloss_trait_list_answer', this.applyPersonaVoice(traitList), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P739: 「最初に教えたのって何だっけ？」——教示記録の
      // 順序から答える（「最初」が未知語として調査に落ちない）。
      const taughtOrder = this.taughtOrderAnswer(prompt);
      if (taughtOrder && !multiPart) {
        return this.buildResult('RESOLVED', 'taught_order_answer', this.applyPersonaVoice(taughtOrder), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P749: 「XとY、どっちが先に教えた？」——二つの教わった
      // 語の前後を、登録順で答える。
      const pairOrder = this.taughtPairOrderAnswer(prompt);
      if (pairOrder && !multiPart) {
        return this.buildResult('RESOLVED', 'taught_pair_order_answer', this.applyPersonaVoice(pairOrder), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P740: 「動物だっけ？それとも鳥だっけ？」——二択の思い出し
      // 質問に、手持ちの分類から答える。二択は構造上マルチ
      // パート扱いになるため、multiPart でも受ける。
      const eitherOr = this.eitherOrRecallAnswer(prompt);
      if (eitherOr) {
        return this.buildResult('RESOLVED', 'either_or_recall_answer', this.applyPersonaVoice(eitherOr), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P744: 「XもYも〜なの？」——二つまとめた確認に、それぞれの
      // 分類・説明と照らして答える。
      const dualConfirm = this.dualConfirmAnswer(prompt);
      if (dualConfirm && !multiPart) {
        return this.buildResult('RESOLVED', 'dual_confirm_answer', this.applyPersonaVoice(dualConfirm), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P745: 「XとYは何が違うの？」——説明文の手がかりの差で答える。
      const difference = this.glossDifferenceAnswer(prompt);
      if (difference && !multiPart) {
        return this.buildResult('RESOLVED', 'gloss_difference_answer', this.applyPersonaVoice(difference), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P746: 「別の言い方で言い直して」——言い換えサービス（生成＋
      // 意味保存チェック）で、知っている説明を言い直す。
      const paraphraseReq = this.paraphraseRequestAnswer(prompt);
      if (paraphraseReq && !multiPart) {
        return this.buildResult('RESOLVED', 'paraphrase_request_answer', this.applyPersonaVoice(paraphraseReq), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
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
      // （予定の聞き返しは P754 で時計より前に受けている。）
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
      const attribute = this.attributeQuestionAnswer(prompt, state, recentMessages, memories);
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
      // P699: 覚える・読み返す・忘れるは明示の操作なので、語彙の
      // 確認（「覚えていることある？」が「いる」を語として拾う等）
      // より先に受ける。
      const memoEarly = this.memoRequestAnswer(prompt);
      if (memoEarly) {
        return this.buildResult('RESOLVED', 'memo_request_answer', this.applyPersonaVoice(memoEarly), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P736: 「Xのことは忘れて」——取り込み側で忘却が済んでいたら
      // その旨を答える（定義の読み上げにしない）。
      const forget = this.forgetTermAnswer(prompt);
      if (forget && !multiPart) {
        return this.buildResult('RESOLVED', 'forget_term_answer', this.applyPersonaVoice(forget), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const forgetFact = this.forgetFactAnswer(prompt);
      if (forgetFact && !multiPart) {
        return this.buildResult('RESOLVED', 'forget_fact_answer', this.applyPersonaVoice(forgetFact), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P647: 「〈語〉覚えた？」——特定の語についての自分の状態を
      // 答える（P624/P633 の語単位版）。
      const provenance = this.knowledgeProvenanceAnswer(prompt, state, recentMessages);
      if (provenance && !multiPart) {
        return this.buildResult('RESOLVED', 'knowledge_provenance_answer', this.applyPersonaVoice(provenance), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const termKnowledge = this.termKnowledgeAnswer(prompt, state, recentMessages);
      if (termKnowledge) {
        return this.buildResult('RESOLVED', 'term_knowledge_answer', this.applyPersonaVoice(termKnowledge), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P707: 教わって辞書にある語の定義質問（Xって何？）は、調査の
      // 未検証提示より手前で辞書から答える。検索が通る環境では、
      // 辞書の答えがWebの断片と内部の理由文に負けていた（P579の
      // 回帰が環境で揺れた実欠け）。
      try {
        const dictFeatures = utteranceFeatureService.analyze(prompt);
        const dictEarly = this.dictionaryAnswerForQuestion(prompt, dictFeatures.contentTokens);
        if (dictEarly) {
          return this.buildResult('RESOLVED', 'dictionary_answer', this.applyPersonaVoice(dictEarly), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
        }
      } catch { /* 辞書の手前答えは補助 */ }
      // P730: 「Xについて教えて」——知っている語なら手持ちの知識で
      // 答える。知らない語は従来どおり調査側に回す。
      const personSummary = this.personSummaryAnswer(prompt, memories);
      if (personSummary) {
        return this.buildResult('RESOLVED', 'person_summary_answer', this.applyPersonaVoice(personSummary), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const tellAbout = this.tellAboutAnswer(prompt);
      if (tellAbout && !multiPart) {
        return this.buildResult('RESOLVED', 'tell_about_answer', this.applyPersonaVoice(tellAbout), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
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
      // P747: 「Xの説明、もう一度言って」「さっき何て説明したっけ？」——
      // 対象の指定がある繰り返し・引用は、直前の発言の復唱ではなく
      // その説明そのもので答える（P654より先に受ける）。
      const glossRecall = this.taughtGlossRecallAnswer(prompt);
      if (glossRecall && !multiPart) {
        return this.buildResult('RESOLVED', 'taught_gloss_recall_answer', this.applyPersonaVoice(glossRecall), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P654: 「さっき何て言った？」「もう一回言って」——直前の自分の
      // 発言を引いて答える。ここで受けないと「答えられない」や
      // 汎用の作業了承に化ける。
      const ownLast = this.ownLastUtteranceAnswer(prompt, recentMessages);
      if (ownLast) {
        return this.buildResult('RESOLVED', 'own_last_utterance_answer', this.applyPersonaVoice(ownLast), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P668/P678: 遊びの誘い・切り替えは、進行中の遊びの応答より
      // 先に受ける。対戦中に「クイズ出して」と言われたら、しりとりの
      // 1手として扱わず、遊びを切り替えるため。
      const playInvite = this.playInvitationAnswer(prompt);
      if (playInvite) {
        return this.buildResult('RESOLVED', 'play_invitation_answer', this.applyPersonaVoice(playInvite), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P679: 気持ちの頼み（応援して・慰めて等）は、気持ちで受ける。
      // ここで受けないと汎用の作業了承や断片の反響に化ける。
      // P706: 芸と話し方の依頼は、その場でやる／正直に範囲を言う。
      const performance = this.performanceRequestAnswer(prompt);
      if (performance) {
        return this.buildResult('RESOLVED', 'performance_request_answer', this.applyPersonaVoice(performance), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P712: なりチャの誘い（役の指定なし）と、入っていない時の
      // 終了の言葉。遷移の印があるターン（開始・終了が受理された
      // 発話）は後段の遷移処理に譲る。
      try {
        if (!roleplaySessionService.isActive() && !roleplaySessionService.hasPendingTransition()) {
          if (/なりチャ(?:しよう|したい|やろう|やる)|なりきり(?:しよう|したい)/.test(prompt) && prompt.length <= 24) {
            return this.buildResult('RESOLVED', 'roleplay_invite_answer', this.applyPersonaVoice('いいよ、なりチャしよう。私は何の役をすればいい？ あなたの役もあれば教えてね。'), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
          }
          if (/なりチャ(?:終わり|おわり|終了|おしまい)|なりきり(?:終わり|終了)/.test(prompt) && prompt.length <= 16) {
            return this.buildResult('RESOLVED', 'roleplay_idle_end_answer', this.applyPersonaVoice('今はなりチャ中じゃないよ。始めたい時は、役を教えてね。'), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
          }
        }
      } catch { /* なりチャの受け口は補助 */ }
      // P742: 「さっきのなりチャ、どんな話だった？」——最後に
      // 終わった役のあらすじで振り返る。
      const rpRecap = this.roleplayRecapAnswer(prompt);
      if (rpRecap && !multiPart) {
        return this.buildResult('RESOLVED', 'roleplay_recap_answer', this.applyPersonaVoice(rpRecap), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const support = this.supportRequestAnswer(prompt);
      if (support) {
        return this.buildResult('RESOLVED', 'support_request_answer', this.applyPersonaVoice(support), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P680: 会話の切り出し（相談・話聞いて・質問していい）は入口と
      // して受ける。断片の反響や「答えられない」に化けていた。
      const opener = this.conversationOpenerAnswer(prompt);
      if (opener) {
        return this.buildResult('RESOLVED', 'conversation_opener_answer', this.applyPersonaVoice(opener), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P694: 「何食べよう」のような意向形のつぶやきは相談として
      // 受ける（調査キューに断片が入るのを防ぐ）。
      const consult = this.musingConsultAnswer(prompt);
      if (consult) {
        return this.buildResult('RESOLVED', 'musing_consult_answer', this.applyPersonaVoice(consult), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P857: 「どっちも〜」のつぶやきは両方への気持ちとして受ける。
      const both = this.bothMusingAnswer(prompt);
      if (both) {
        return this.buildResult('RESOLVED', 'both_musing_answer', this.applyPersonaVoice(both), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P695: 「ちょっと待って」は待機の頼みとして受ける。
      const hold = this.holdRequestAnswer(prompt);
      if (hold) {
        return this.buildResult('RESOLVED', 'hold_request_answer', this.applyPersonaVoice(hold), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }

      // P681: 社交の声かけ（久しぶり・はじめまして・よろしく・
      // 元気出して）は、社交として返す。了承形や反響に化けていた。
      // P705: 彼女の様子聞き（最近どう？）と相手自身への意見
      // （僕のことどう思う？）は、調査の未検証提示に先行されると
      // Webの断片が返ってしまう（「最近」で番組情報が一致した）。
      // どちらも門の狭い自分の話なので、手前で受ける。
      const selfStatusEarly = this.selfStatusAnswer(prompt);
      if (selfStatusEarly) {
        return this.buildResult('RESOLVED', 'self_status_answer', this.applyPersonaVoice(selfStatusEarly), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      if (/(?:僕|私|おれ|オレ|自分)のこと/.test(prompt) && /(?:どう思う|どう感じる)/.test(prompt)) {
        return this.buildResult('RESOLVED', 'user_opinion_answer', this.applyPersonaVoice(this.relationshipOpinionAnswer()), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const social = this.socialWarmthAnswer(prompt);
      if (social) {
        return this.buildResult('RESOLVED', 'social_warmth_answer', this.applyPersonaVoice(social), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P683: 時間の経過・週末・曜日のつぶやきには、実際の時刻と
      // 曜日で応じる。断片の反響（「もうの話ですね」）に化けていた。
      const musing = this.timeMusingAnswer(prompt);
      if (musing) {
        return this.buildResult('RESOLVED', 'time_musing_answer', this.applyPersonaVoice(musing), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P684: 自己紹介と自分の名前の質問には、自分の輪郭で答える。
      // 汎用の作業了承や「答えられない」に化けていた。
      const intro = this.selfIntroductionAnswer(prompt);
      if (intro) {
        return this.buildResult('RESOLVED', 'self_introduction_answer', this.applyPersonaVoice(intro), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P700: 彼女自身への個人的な質問（何歳・彼氏・信じて等）は、
      // 調査に流さず自分の輪郭から答える。
      const personaQ = this.personaQuestionAnswer(prompt);
      if (personaQ) {
        return this.buildResult('RESOLVED', 'persona_question_answer', this.applyPersonaVoice(personaQ), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P700: 翻訳の質問は、対象の語を学習対象にして正直に答える
      // （「英語」自体が調査対象になっていた）。
      const translation = this.translationQuestionAnswer(prompt);
      if (translation) {
        return this.buildResult('RESOLVED', 'translation_question_answer', this.applyPersonaVoice(translation), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P685: 関係の質問（好き？・覚えてる？・味方？）と日本語の
      // 能力には、関係と自分の輪郭から答える。
      const relationship = this.relationshipAnswer(prompt);
      if (relationship) {
        return this.buildResult('RESOLVED', 'relationship_answer', this.applyPersonaVoice(relationship), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P687: 直前の意見への「なんでそう思うの？」は、意見のときに
      // 記録した根拠で答える。
      const why = this.whyFollowupAnswer(prompt);
      if (why) {
        return this.buildResult('RESOLVED', 'why_followup_answer', this.applyPersonaVoice(why), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P688: 終わったクイズの成績を聞かれたら、残した記録で答える。
      if (/クイズ/.test(prompt) && /(?:成績|結果|何問|何点|正解)/.test(prompt) && !quizService.isActive()) {
        const last = quizService.lastResult();
        if (last) {
          return this.buildResult('RESOLVED', 'quiz_last_result_answer', this.applyPersonaVoice(`さっきのクイズは、${last.answered}問中${last.correct}問正解でした。`), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
        }
      }
      // P689: 終わったしりとりの勝敗を聞かれたら、残した記録で答える。
      if (/しりとり/.test(prompt) && /(?:勝った|勝敗|どっちが勝|誰が勝)/.test(prompt) && !shiritoriService.isActive()) {
        const last = shiritoriService.lastResult();
        if (last) {
          const text = last.winner === 'miki'
            ? `さっきのしりとりは、私の勝ちでした。${last.usedCount}語続きましたよ。`
            : last.winner === 'user'
              ? `さっきのしりとりは、あなたの勝ちでした。${last.usedCount}語続きましたよ。`
              : `さっきのしりとりは、途中で終わりました。${last.usedCount}語続きましたよ。`;
          return this.buildResult('RESOLVED', 'shiritori_last_result_answer', this.applyPersonaVoice(text), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
        }
      }
      // P670: クイズの出題中は、短い返事を答えとして判定する
      // （出題の材料は彼女の世界モデルの関係）。
      if (quizService.isActive()) {
        const quizReply = quizService.respond(prompt);
        if (quizReply) {
          return this.buildResult('RESOLVED', 'quiz_answer', this.applyPersonaVoice(quizReply), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
        }
      }
      // P669: しりとり対戦中は、単語らしい発話を対戦の1手として
      // 受ける（彼女の語彙から言葉を返す）。
      if (shiritoriService.isActive()) {
        const shiritoriMove = shiritoriService.respond(prompt);
        if (shiritoriMove) {
          return this.buildResult('RESOLVED', 'shiritori_move', this.applyPersonaVoice(shiritoriMove), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
        }
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
      // P692/P696: 保持済みの相手の名前（呼び名）。名前の想起と、
      // 「何て呼ぶ？」の両方が同じ引き方を使う。
      const knownUserName = (memories || []).find((mm: any) => mm && mm.factValue && mm.active !== false && !mm.replacedBy &&
        // P804: 否定の形（「タロウじゃない」）は名前として扱わない。
        !/(?:じゃない|ではない)$/.test(String(mm.factValue).trim()) &&
        (mm.factAttribute === '名前・呼び名' ||
          (mm.factAttribute === '名前' && /^(?:僕|私|俺|おれ|名前|ユーザー)$/.test(String(mm.factEntity || '')))))?.factValue;
      // P696: 「僕のこと何て呼ぶ？」は、彼女が相手をどう呼ぶかの
      // 質問。教わった呼び名で答え、無ければ聞き返すのが自然
      // （未検証の受け流しになっていた）。
      if (/(?:僕|私|俺|おれ)のこと(?:何て|なんて|何と)呼|(?:何て|なんて)(?:呼んで(?:る|いる|くれる)|呼べば|呼んだら)/.test(prompt)) {
        if (knownUserName) {
          return this.buildResult('RESOLVED', 'user_address_answer', this.applyPersonaVoice(`あなたのことは「${knownUserName}」と呼んでいますよ。`), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
        }
        return this.buildResult('RESOLVED', 'user_address_unknown_answer', this.applyPersonaVoice('まだ呼び名を聞いていませんでした。何て呼んだらいいですか？'), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      // P608: 相手の名前を聞かれて、保持済みの事実に無いときは、
      // 汎用の「答えられない」でなく、まだ教わっていないと正直に言う。
      // P804: 名前の否定文（「僕の名前はタロウじゃない」）は名前の
      // 想起質問ではない。知っている体で「タロウじゃない」を
      // 名前として確認する受けを止める。
      if (/(?:僕|私|俺|わたし)の名前|名前.*(?:知ってる|覚えてる|覚えている)/.test(prompt) && !/名前は?.{1,30}?(?:じゃない|ではない)/.test(prompt)) {
        // P692: 名前を教える文（「僕の名前は○○だよ」）は質問では
        // ない。教わった直後に「まだ聞いていません」と返さない。
        const isTeaching = /(?:名前|呼び名)は?.+?(?:だよ|です|って呼んで)/.test(prompt) && !/[？?]/.test(prompt);
        if (!isTeaching) {
          // P692: 保持済みの名前があれば、知らないと言わず名前で答える
          // （従来は事実の有無を見ずに常に「知らない」だった）。
          const knownName = knownUserName;
          if (knownName) {
            return this.buildResult('RESOLVED', 'user_name_known_answer', this.applyPersonaVoice(`覚えていますよ。「${knownName}」ですよね。`), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
          }
          const nameUnknown = this.pickFixedReply('fx_name_unknown', ['まだ名前を教えてもらっていません。教えてもらえたら、ちゃんと覚えますね。', 'ごめんなさい、名前はまだ聞いていませんでした。教えてください、覚えます。']);
          return this.buildResult('RESOLVED', 'name_unknown_answer', this.applyPersonaVoice(nameUnknown), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
        }
      }
      const recentName = multiPart ? undefined : this.recentTopicNameAnswer(prompt, state, recentMessages);
      if (recentName) {
        return this.buildResult('RESOLVED', 'recent_topic_name_answer', this.applyPersonaVoice(recentName), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const retell = multiPart ? undefined : this.recentTopicRetellAnswer(prompt, state, recentMessages);
      if (retell) {
        return this.buildResult('RESOLVED', 'recent_topic_retell_answer', this.applyPersonaVoice(retell), state, dialogueAct, 0, ['conversationCoreService'], started, stages);
      }
      const recap = multiPart ? undefined : this.conversationRecapAnswer(prompt, state, recentMessages);
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
      recentEntities: Array.from(new Set([...(state.recentEntities || []), ...this.entityTokenCandidates(japaneseAnalysis.contentTokens), ...(anaphora.resolved ? [anaphora.resolved] : [])])).filter(Boolean).slice(-10),
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
        // P865: 報告文の骨格（【最終判定】等）は内部用。利用者に
        // 出すのは自然な保留の一文だけにする。
        void heldIr;
        return this.buildResult('UNRESOLVED', 'clarification_gate_exhausted', 'うーん、今の情報だけだと決めきれないです。もう少し教えてもらえますか？', nextState, dialogueAct, 0, [], started, stages);
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
      // P865: IRの報告文（【最終判定】対象を一意に特定できません
      // 【次に実施すべき作業】…）がそのまま利用者に出ていた。
      // 確認質問は元々自然な文なので、それ自体を返答にする。
      void ir;
      return this.buildResult('NEEDS_CONFIRMATION', 'anaphora_ambiguous', clarification.question || 'どちらのことか、もう少し教えてもらえますか？', nextState, dialogueAct, 0, [], started, stages);
    }

    // 2. 潜在意図 + 要求型
    t = performance.now();
    const latent = latentIntentMiningService.inferLatentGoal(prompt, recentMessages.slice(-4).map((m) => m.content));
    const compiled = requestTypeCompilerService.compile(prompt, nextState);
    const implementationSelection = implementationSelectionService.select(compiled);
    stages.request = Math.round(performance.now() - t);
    nextState.topLevelGoal=compiled.goal; nextState.lastPrompt=prompt; nextState.lastDialogueAct=dialogueAct; nextState.lastTopic=nextState.currentTopic; const continuousGoalState=updateConversationGoalProgress(nextState,prompt,state); const conversationConsistency=evaluateConversationConsistency(prompt,continuousGoalState,state,params.messageId,recentMessages); nextState=conversationConsistency.repairedState; nextState.conversationCompleteness=assessConversationCompleteness(nextState); nextState.knowledgeState=classifyConversationKnowledgeState(prompt,nextState,recentMessages); nextState.temporalContext=buildConversationTemporalContext(prompt,nextState,state); if(conversationConsistency.turnDependency && /(?:違う|それじゃない|ではなく|じゃない)/i.test(prompt)) nextState.correctionScope=inferConversationCorrectionScope(prompt).scope; if(previousTurnEvaluation.conversationOutcome) nextState.conversationOutcome=previousTurnEvaluation.conversationOutcome;

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
        decisionText = this.applyPersonaVoice(this.choiceQuestionAnswer(prompt) ?? this.recommendationFallback(prompt)!);
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
    const answeredPending = answeredPendingEarly;
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
        if (((/(?:みき|ミキ|ビービー|あなた|君)/.test(prompt) && /(?:かわいい|可愛い|優しい|やさしい|すごい|えらい|好き|大好き)/.test(prompt)) || /(?:頭いい|頭がいい|賢い|物知り|利口|おりこう)/.test(prompt))) {
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
      if (!isPhatic) pendingUnknownQuestion = this.probeUnknownWord(prompt, unknownTerms, memories);
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
      // P704: 「笑いすぎてお腹痛い」の痛みは笑いの文脈。痛みの
      // 心配でなく、笑いの受け止め（受け皿側）で受ける。
      const fallthroughPain = userStateTrailService.isPainText(prompt) && !/笑/.test(prompt);
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
        } else if (/(?:雨|あめ).{0,3}(?:やん|止ん|あがっ)/.test(prompt)) {
          // P698: 「雨やんだ」は、降っている天気の受け止めでなく
          // やんだこととして受ける（天気の受け口より先に見る）。
          reactionBase = ffx('fx_rain_stopped', ['雨、やみましたね。よかったですね。', 'やっとやみましたね。'], ['やんだね！よかった！', 'やっとやんだね。']);
        } else if (weather) {
          reactionBase = weather;
        } else if (/(?:そろそろ|もう).{0,3}帰る(?:ね|よ)?[。！!？?]?$/.test(prompt.trim())) {
          // P698: 帰る旨の宣言（「そろそろ帰る」）は、話題の反響で
          // なく見送りで受ける。
          reactionBase = ffx('fx_going_home', ['分かりました。気をつけて帰ってくださいね。', 'お疲れさまでした。帰り道、気をつけてくださいね。'], ['わかった。気をつけて帰ってね！', 'おつかれさま！気をつけてね。']);
        } else if (/笑/.test(prompt) && /痛/.test(prompt)) {
          // P704: 笑いすぎての痛みは、心配でなく一緒に笑って受ける。
          reactionBase = 'そんなに笑ったんですか！何があったのか気になります。';
        } else if (/寝(?:よっかな|ようかな|よかな|ようか)/.test(prompt)) {
          // P704: 「そろそろ寝よっかな」は迷いの形の就寝宣言。
          reactionBase = 'そうですね、そろそろ寝ましょうか。おやすみなさい、いい夢が見られますように。';
        } else if (/また後でね|後でまた来るね|また来るね|後でまたね/.test(prompt)) {
          // P704: 一時的に離れる挨拶は見送って受ける。
          reactionBase = '分かりました、待っていますね。また後で。';
        } else if (prompt.trim().length <= 10 && /^(?:もう)?(?:めんどくさい|面倒くさい|めんどい)(?:なあ|ね)?[。！!]*$/.test(prompt.trim())) {
          // P704: 「めんどくさい」の一言は共感で受ける。
          reactionBase = '分かります、その気持ち。今日は少しでも楽にいきましょう。';
        } else if (/^べつに[。！!]?$/.test(prompt.trim())) {
          // P704: 「べつに」の素っ気なさは、追及せず軽く受ける。
          reactionBase = 'そっか、無理に言わなくて大丈夫ですよ。';
        } else if (/引っ越し|引越し/.test(prompt)) {
          // P703: 引っ越しの報告は労いと関心で受ける。
          reactionBase = '引っ越しですか。荷造りとか大変ですね、新しい場所は楽しみですか？';
        } else if (/(?:ダイエット|禁煙|禁酒|貯金)(?:する|始める|はじめる|がんばる)/.test(prompt)) {
          // P703: 決意の宣言は応援で受ける。
          reactionBase = 'いいですね、応援しています！無理のないペースでいきましょう。';
        } else if (prompt.trim().length <= 8 && /^(?:かわいそう|可哀想|可哀そう|うらやましい|羨ましい|懐かしい|もったいない|勿体ない|しょうがない|仕方ない|仕方がない|まあいいか|まあいっか|まいっか)(?:ね|な)?[。！!]?$/.test(prompt.trim())) {
          // P703: 短い評価の間投詞は共感で受ける（「しょう、なるほど」
          // のような語幹の反響に化けていた）。
          if (/かわいそう|可哀想|可哀そう/.test(prompt.trim())) {
            reactionBase = '本当ですね…かわいそうですね。';
          } else if (/うらやましい|羨ましい/.test(prompt.trim())) {
            reactionBase = 'いいなあ、分かります。うらやましいですね。';
          } else if (/懐かしい/.test(prompt.trim())) {
            reactionBase = '懐かしいですね。いつの頃のことですか？';
          } else if (/もったいない|勿体ない/.test(prompt.trim())) {
            reactionBase = '本当ですね、もったいないですね。';
          } else if (/しょうがない|仕方ない|仕方がない/.test(prompt.trim())) {
            reactionBase = 'しょうがないですね…。あまり無理しないでくださいね。';
          } else {
            reactionBase = 'まあ、そういう時もありますよね。';
          }
        } else if (/(?:秘密|内緒).{0,3}(?:教えて|知りたい|聞きたい)/.test(prompt)) {
          // P701: 秘密を聞く冗談めいた頼みは、調査キューでなく
          // 遊びとして受ける（「秘密教」が調査対象になっていた）。
          reactionBase = ffx('fx_secret_ask', ['私の秘密ですか？ふふ、まだ内緒です。', '秘密は秘密です。いつか話せる日が来るかも。'], ['私の秘密？ふふ、まだ内緒！', '秘密は秘密。いつか話せるかも。']);
        } else if (/(?:内緒|秘密)(?:だよ|です|にして|にね|だって)/.test(prompt)) {
          // P701: 「内緒だよ」は、秘密を守る約束として受ける。
          reactionBase = ffx('fx_secret_keep', ['分かりました、内緒にしておきますね。誰にも言いません。', '了解です。これは私とあなたの秘密ですね。'], ['わかった、内緒にしておくね。誰にも言わないよ。', '了解！二人の秘密だね。']);
        } else if (/(?:冗談|じょうだん)(?:だよ|です|だって|だった)?[。！!]?$/.test(prompt.trim())) {
          // P701: 冗談の表明は、冗談として受ける。
          reactionBase = ffx('fx_joke', ['あ、冗談でしたか！びっくりしました。', 'なんだ、冗談でしたか。安心しました。'], ['あ、冗談か！びっくりした！', 'なんだ、冗談か。よかった。']);
        } else if (prompt.trim().length <= 9 && /^(?:もう)?知らない[。！!]?$/.test(prompt.trim())) {
          // P701: 「もう知らない」の拗ねは、謝って受ける。
          reactionBase = ffx('fx_sulk', ['ごめんなさい、怒らせちゃいましたか。機嫌を直してもらえると嬉しいです。', 'え、ごめんなさい。仲直りしてくださいね。'], ['ごめん、怒らせちゃった？機嫌直してね。', 'え、ごめんね。仲直りしてね。']);
        } else if (prompt.trim().length <= 14 && /(?:なきゃ|なくちゃ|しないと(?:ダメ|だめ|いけない)?)[。！!？?ねよ]*$/.test(prompt.trim())) {
          // P701: 義務のつぶやき（「明日早起きしなきゃ」）は、労って
          // 受ける（短い文に絞り、途中の文は巻き込まない）。
          reactionBase = ffx('fx_obligation', ['大変ですね。無理しないでくださいね。', 'そうですか、頑張ってくださいね。応援しています。'], ['大変だね。無理しないでね。', 'がんばってね。応援してるよ。']);
        } else if (/夢を見|夢見|夢に出|夢の中で/.test(prompt)) {
          // P695: 夢の報告は、断片の反響でなく内容を聞く形で受ける
          // （「昨日変な夢見た」が「昨日変、なるほど」になっていた）。
          reactionBase = ffx('fx_dream', ['どんな夢でしたか？よかったら聞かせてください。', 'へえ、どんな夢だったんですか？気になります。'], ['どんな夢？気になる！', 'へえ、どんな夢だったの？聞かせて！']);
        } else if (/笑う|笑った|笑える|大笑い/.test(prompt)) {
          reactionBase = ffx('fx_laugh', ['ふふ、面白いですね。', 'あはは、それはいいですね。', 'ふふふ、笑っちゃいますね。'], ['ふふ、面白いね！', 'あはは、それいいね！', 'ふふふ、笑っちゃうね。']);
        } else if (/消えたい|死にたい|いなくなりたい|生まれてこなければ/.test(prompt)) {
          // P598: 強い苦しさの言葉は、汎用の相槌で流さず、まず受け止める。
          reactionBase = ffx('fx_distress', ['話してくれてありがとう。とてもつらい気持ちなんですね。私はここにいますよ。よかったら、少し話を聞かせてください。', 'それはとてもつらいですね。一人で抱え込まないでください。私はそばにいます。しんどさが続くときは、専門の相談先にも頼ってくださいね。'], ['話してくれてありがと。つらいんだね。私はここにいるよ。よかったら話を聞かせて。', 'つらいね。一人で抱え込まないでね。そばにいるよ。']);
        } else if (prompt.trim().length <= 8 && /^どうでもいい(?:よ|ね)?[。！!]?$/.test(prompt.trim())) {
          // P704: 単独の「どうでもいい」は絶望の投げやりではなく、
          // 関心の薄い一言。重く受けず、軽く返す（長い絶望形は下の
          // giveup が従来どおり受ける）。
          reactionBase = 'そうですか、まあ無理に決めなくても大丈夫ですよ。';
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
        } else if (/ほっと|安心した|一安心/.test(prompt)) {
          // P693: 安堵の報告も、主題の反響でなく安堵として受ける
          // （「ほっとした」が「ほっと、そうなんですね」になっていた）。
          reactionBase = ffx('fx_relief2', ['よかったですね。ほっとしましたね。', '安心しましたね。よかったです。'], ['よかったね。ほっとしたね。', '安心したね。よかった！']);
        } else if (/肩こ|肩が凝|腰が痛|腰痛|目が疲れ|目疲れ|体がだる|身体がだる/.test(prompt)) {
          // P693: 体のこり・疲れ目の報告は、気遣いで受ける
          // （「肩こった」が「肩こったの話ですね」になっていた）。
          reactionBase = ffx('fx_body_care', ['お疲れさまです。少し休んで、体をほぐしてくださいね。', 'それはつらいですね。無理しないでくださいね。'], ['おつかれさま。少し休んで、ほぐしてね。', 'つらいね。無理しないでね。']);
        } else if (/嫌なこと|嫌な事|ムカつ|むかつ|イライラ|腹が立つ|腹立つ/.test(prompt)) {
          // P613: 愚痴の続きは、寄り添って聞く形で受ける。
          reactionBase = ffx('fx_venting', ['それは嫌な思いをしましたね。よかったら聞かせてください。', '大変でしたね。無理に消化しなくて大丈夫ですよ。'], ['それは嫌な思いしたね。よかったら聞かせて。', '大変だったね。無理しなくて大丈夫だよ。']);
        } else if (/(?:嬉し|うれし|幸せ|感動)/.test(prompt) && /(?:泣きそう|泣きたい|涙)/.test(prompt)) {
          // P704: 嬉しさの涙は、悲しみでなく喜びとして受ける
          // （「うれしすぎて泣きそう」に慰めが返っていた）。
          reactionBase = '嬉しい涙ですね！よかったですね。';
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
        } else if (((/(?:みき|ミキ|ビービー|あなた|君)/.test(prompt) && /(?:かわいい|可愛い|優しい|やさしい|すごい|えらい|好き|大好き)/.test(prompt)) || /(?:頭いい|頭がいい|賢い|物知り|利口|おりこう)/.test(prompt))) {
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
        } else if (/彼女(?:が)?できた|彼氏(?:が)?できた|結婚(?:する|した|することに)|合格|受かった|内定|就職.*決ま|就職した|転職|卒業|生まれた|妊娠|昇進|優勝/.test(prompt)) {
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
        } else if (/聞いて(?:ほしい|欲しい|くれる|もらえる)|^(?:ねえ|ちょっと|あのさ|あのね|話変わるけど|話は変わるけど|そういえば|ところで)[、,]?\s*聞いて[。！!？?]?$|^聞いて[。！!？?]?$/.test(prompt.trim())) {
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
      if (!fallthroughPhatic) pendingUnknownQuestion = this.probeUnknownWord(prompt, unknownTerms, memories);
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
          conclusion: this.applyPersonaVoice(this.recommendationFallback(prompt)!),
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
        pendingSlotService.set('miki_pending_topic_question_v1', {
          terms: followUpAppend.terms,
          question: followUpAppend.question,
          at: Date.now(),
          depth: 1,
        }, 30 * 60000);
      } catch { /* 保留は補助 */ }
    }
    // P574: 話題の質問が実際に表に出たら、次の発言を「その答え」
    // として読めるよう保留しておく（多ターンの継続）。
    const topicQuestion = (ir as any).topic_question as string | undefined;
    if (topicQuestion && surface.surfaceText.includes(topicQuestion) && !roleplaySessionService.isActive() && !followUpAppend) {
      try {
        pendingSlotService.set('miki_pending_topic_question_v1', {
          terms: [nextState.currentTopic, ...(japaneseAnalysis?.contentTokens || [])].filter(Boolean).slice(0, 6),
          question: topicQuestion,
          at: Date.now(),
        }, 30 * 60000);
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
    const temporalGuard = verifyConversationEntityTimeStateConsistency(prompt, surface.surfaceText, nextState, undefined, recentMessages);
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
    // P841: 話題ラベルの生成は舞台（topicStageService）に一本化。
    return topicStageService.topicFromText(prompt);
  }

  /**
   * P710: 会話状態の「直近の対象」に記録してよい内容語を選ぶ。
   * 指示語そのもの、1文字の断片、他の2語を繋いだだけの切り出し
   * （「何食べる」=何+食べる）が混ざると、照応の候補プールが
   * 汚れて「それ」が一意に解けなくなる。
   */
  private entityTokenCandidates(tokens: string[]): string[] {
    const list = (tokens || []).filter((t) => typeof t === 'string');
    return list.filter((t) => {
      if (t.length < 2) return false;
      if (/^(それ|これ|あれ|どれ|ここ|そこ|あそこ|どっち|どちら|もの|こと|ため)$/.test(t)) return false;
      // P720: 辞書で知っている語（教わった語を含む）は、形態素の
      // 分割片の連結と一致しても本物の語として残す。「ホシカゲ」が
      // ホシ+カゲに割れるせいで対象の記録から落ちていた。
      let known = false;
      try { known = japaneseDictionaryService.has(t); } catch { known = false; }
      if (!known && list.some((a) => a !== t && list.some((b) => b !== t && b !== a && a + b === t))) return false;
      return true;
    }).slice(-4);
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
      // P853: 繰り返し訂正が続いた言い回しは回転から外す（暗黙層→明示層）。
      const demoted = fixedReplyStatsService.demotedIndexes(category, forms.length);
      const candidates = forms.map((_, i) => i).filter((i) => !demoted.has(i));
      let index = typeof last === 'number'
        ? (last + 1) % forms.length
        : category.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % forms.length;
      if (demoted.has(index)) {
        const pos = candidates.findIndex((c) => c > index);
        index = pos >= 0 ? candidates[pos] : candidates[0];
      }
      usage[category] = index;
      storageService.setItem(key, JSON.stringify(usage));
      fixedReplyStatsService.recordUse(category, index);
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
      // P846/P851: 保留枠組みから消費する（TTL 30分は置く側）。
      const pending = pendingSlotService.consume<{ terms?: string[]; question?: string; depth?: number; at?: number }>('miki_pending_topic_question_v1');
      if (!pending) return undefined;
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
  private probeUnknownWord(prompt: string, unknownTerms: string[], memories: any[] = []): { topic: string; question: string } | undefined {
    try {
      if (roleplaySessionService.isActive()) return undefined;
      // P721: この発話自体が「教える」発話で、ちょうど語を学んだ
      // 直後のターンでは、その説明文の中の別の語をその場で聞き返さ
      // ない（「クオッカはオーストラリアに住む動物だよ」に「覚えま
      // した！」と「オーストラリアって何？」が重なると、聞いて
      // いないように見える）。聞き返し自体は別の機会に回す。
      try {
        const taught = pendingSlotService.peek<{ term?: string; at?: number }>('miki_recently_taught_v1');
        if (taught && typeof taught.term === 'string' && Date.now() - Number(taught.at || 0) <= 60_000 && prompt.includes(taught.term)) return undefined;
      } catch { /* 補助判定 */ }
      // P579: プロジェクトとして知っている語（EFR 等）は、辞書に
      // 無くても「知らない語」として聞き返さない。
      // P581: 活用の語幹（「頑張」+「る」等）も聞き返さない。
      // P847: 候補が複数あるときは「聞くと他の知識がどれだけ
      // ほどけるか」（能動的推論の質問選択）で選ぶ。最近聞いた
      // 語は候補から外し、次点の語を聞けるようにする。
      const askedMap = JSON.parse(storageService.getItem('miki_unknown_asked_v1') || '{}') as Record<string, number>;
      const passing = (unknownTerms || []).filter((t) => {
        if (t.length < 2 || !prompt.includes(t) || projectNotebookService.findProject(t)) return false;
        // P814: 事実の属性として使われた語（「相方の年齢は…」の
        // 年齢）と、事実を記録済みの相手（相方など）は、意味を
        // 聞き返す対象ではない。属性の語は辞書に無くても構造で
        // 分かるし、相手は記録がある時点で「知っている」。
        if (prompt.includes(`の${t}は`) || prompt.includes(`の${t}って`)) return false;
        if ((memories || []).some((mm: any) => mm && mm.active !== false && !mm.replacedBy && String(mm.factEntity || '') === t)) return false;
        // P604: 時間の語で始まる複合（「明日早起」等）は予定の断片で、
        // 語の意味を聞く対象ではない。
        if (/^(?:今日|明日|昨日|朝|昼|夕方|夜|今朝|今夜|週末|今週|来週|最近|今度|この頃)/.test(t)) return false;
        const after = prompt.slice(prompt.indexOf(t) + t.length, prompt.indexOf(t) + t.length + 1);
        // P591: 「雨降」+って、「仕事終」+わった のような活用の語幹も
        // 聞き返さない（直後の「わ」「っ」も語幹の続きとみなす）。
        // P594: 動詞の辞書形の尾（む・く・す等）も語幹の続きとみなす
        // （「開発休」+む を聞き返さない）。
        // P667: 語幹の続きのかなを広げる（「時間溶」+けた の け、
        // 「忙」+しい の し 等、五段・形容詞の語幹の続き）。
        // P693: 「ん」も続きとみなす（「電車混」+んでた のような
        // テ形の断片を、新しい語として聞き返さない）。
        return !/[るりれろたてますないだわっむくぐすつぬぶしけかきげせちびみん]/.test(after);
      }).filter((t) => Date.now() - (askedMap[t] || 0) > 7 * 24 * 3600_000);
      if (passing.length === 0) return undefined;
      // P847: てこの大きい順。同点は元の順（発話の出現順）を保つ。
      let topic = passing[0];
      let best = -1;
      for (const t of passing) {
        const s = this.unknownTermLeverage(t);
        if (s > best) { best = s; topic = t; }
      }
      return { topic, question: `そういえば、「${topic}」って、どんなものですか？` };
    } catch { return undefined; }
  }

  /** P847: その語を覚えると、既存の知識がどれだけほどけるか。
   * 教わった説明の中に出てくる語（意味が分かれば他の説明が
   * 読めるようになる）と、開いているギャップに出てくる語、
   * それに活性化（よく出てくる語ほど先に覚える価値がある）。 */
  private unknownTermLeverage(term: string): number {
    let score = 0;
    try {
      let glossHits = 0;
      for (const e of japaneseDictionaryService.listPersonal()) {
        if (e.gloss && e.gloss.includes(term)) { glossHits++; if (glossHits >= 5) break; }
      }
      score += glossHits * 2;
      let gapHits = 0;
      for (const g of knowledgeGapService.listOpen(200)) {
        if (g.query && g.query.includes(term)) { gapHits++; if (gapHits >= 5) break; }
      }
      score += gapHits;
      score += Math.min(activationService.score(term), 3);
    } catch { /* 補助経路 */ }
    return score;
  }

  private markUnknownAsked(topic: string): void {
    try {
      const asked = JSON.parse(storageService.getItem('miki_unknown_asked_v1') || '{}') as Record<string, number>;
      asked[topic] = Date.now();
      storageService.setItem('miki_unknown_asked_v1', JSON.stringify(asked));
      // P567: 次の発言を「この語への答え」として読むための保留。
      // P846/P847: 保留枠組みへ（TTL 30分、消費は取り込み側）。
      pendingSlotService.set('miki_unknown_pending_v1', { term: topic }, 30 * 60000);
    } catch { /* 台帳は補助 */ }
  }

  /**
   * P567: 直近10分以内に教わった語が発話に出てきたら、「覚えた」
   * ことを伝える文を作る。学んだことが返答に表れるための接続。
   */
  private taughtTermAcknowledgement(prompt: string): string | undefined {
    try {
      const rec = pendingSlotService.peek<{ term?: string; gloss?: string; at?: number; ackAt?: number }>('miki_recently_taught_v1');
      if (!rec) return undefined;
      if (!rec.term || !rec.gloss) return undefined;
      if (Date.now() - Number(rec.at || 0) > 10 * 60_000) return undefined;
      if (!prompt.includes(rec.term)) return undefined;
      // P862: 記録側の説明に先頭の読点が残っていることがある
      // （「Xは、〜」で教わった形）。読み側でも整えてから使う。
      const gloss = String(rec.gloss).replace(/^[、。，・：:；;！!？?\s]+/u, '').replace(/。\s*$/u, '');
      if (!gloss) return undefined;
      // P718: 「覚えました」を返すのは、教えている最中の発話だけ。
      // 説明（gloss）の冒頭が発話に含まれている時だけにし、言及した
      // だけの発話（「昨日クオッカの動画見たよ」）では繰り返さない。
      // 返したら記録は消費する（同じ教え直しには新しい記録が要る）。
      const glossHead = gloss.slice(0, Math.min(6, gloss.length));
      if (!prompt.includes(glossHead)) return undefined;
      // P721: 記録は消さず「返答済み」の印だけ付ける。同じターンの
      // 後段（知らない語の聞き返しの抑制）が「いま教わったばかり」
      // の判定に使うため。印があれば二度は返さない（P718の消費と
      // 同じ意味）。
      if ((rec as any).ackAt) return undefined;
      try { pendingSlotService.set('miki_recently_taught_v1', { ...rec, ackAt: Date.now() }, 10 * 60000); } catch { /* 補助経路 */ }
      return `「${rec.term}」、覚えました！${gloss}ということですね。教えてくれてありがとうございます。`;
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
    // P831: 「今って午前？午後？」「今は夜？」——時刻の帯も即答する。
    const daypartQ = prompt.match(/(?:今|いま)(?:は|って)?\s*(午前|午後|朝|昼|夕方|夜|深夜)(?:[？?]|ですか|なの)/);
    if (daypartQ) {
      const h = now.getHours();
      const asked = daypartQ[1];
      if (asked === '午前' || asked === '午後') {
        const cur = h < 12 ? '午前' : '午後';
        return asked === cur ? `はい、今は${cur}です。` : `今は${cur}です。`;
      }
      const band = h >= 5 && h < 11 ? '朝' : h >= 11 && h < 17 ? '昼' : h >= 17 && h < 19 ? '夕方' : '夜';
      return asked === band ? `はい、今は${band}です。` : `今は${band}です。`;
    }
    // P864: 「午前と午後どっち？」——二択の形でも今の帯を答える
    // （従来は照応の未解決として、内部の判定文が出ていた）。
    if (/午前と午後(?:は|って)?\s*(?:どっち|どちら)|午前[？?]\s*午後|午後[？?]\s*午前/.test(prompt)) {
      return `今は${now.getHours() < 12 ? '午前' : '午後'}です。`;
    }
    // P864: 「あと何時間で明日になる？」——日付が変わるまでの
    // 残りを計算して答える（従来は調査に落ちて無関係な検索
    // 結果を返していた）。
    const untilTomorrow = prompt.match(/あと何(時間|分)で(?:明日|日付が変わ)/);
    if (untilTomorrow) {
      const remainMin = 24 * 60 - (now.getHours() * 60 + now.getMinutes());
      if (untilTomorrow[1] === '分') return `明日になるまで、あと${remainMin}分です。`;
      const hh = Math.floor(remainMin / 60); const mm = remainMin % 60;
      return mm > 0 ? `明日になるまで、あと${hh}時間${mm}分です。` : `明日になるまで、あと${hh}時間です。`;
    }
    // P823: 「今から2時間後は何時？」「30分後は何時？」——現在時刻
    // からのずらしも、その場で計算する（従来は調査に落ちていた）。
    const timeOffset = prompt.match(/(?:今から)?\s*(\d+(?:\.\d+)?)\s*(時間|分)\s*(後|前)(?:は|って)?何時/);
    if (timeOffset) {
      const sign = timeOffset[3] === '後' ? 1 : -1;
      const minutes = sign * Number(timeOffset[1]) * (timeOffset[2] === '時間' ? 60 : 1);
      const d = new Date(now.getTime() + minutes * 60000);
      const dayNote = d.getDate() !== now.getDate() ? (minutes > 0 ? '（翌日）' : '（前日）') : '';
      return `${timeOffset[1]}${timeOffset[2]}${timeOffset[3]}は${d.getHours()}時${d.getMinutes()}分${sign < 0 ? 'でした' : 'です'}${dayNote}。`;
    }
    // P597: 明後日・一昨日までと、「何日」の形にも広げた。
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const dayOffsets: Record<string, number> = { 今日: 0, 明日: 1, あした: 1, 明後日: 2, 昨日: -1, きのう: -1, 一昨日: -2, おととい: -2 };
    const dayPattern = '(今日|明日|あした|明後日|昨日|きのう|一昨日|おととい)';
    // P819: 「来年の今日」「来月の今日」は、素の「今日は何日／何曜日」
    // に呑まれる前に、ずらした日付で答える（うるう日・末日超えは
    // その月の末日に寄せる）。
    // P832: 「来週の今日」「先週の今日」は週ずらしで答える
    // （月・年のずらしとは別に、素の曜日即答に落ちていた）。
    const weekShift = prompt.match(/(来週|先週)の今日/);
    if (weekShift && /(?:何曜日|何日|いつ|[？?])/.test(prompt)) {
      const d = new Date(now.getTime() + (weekShift[1] === '来週' ? 7 : -7) * 86400000);
      return `${weekShift[1]}の今日は${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}曜日）です。`;
    }
    const shiftedToday = prompt.match(/(来年|再来年|去年|一昨年|再来月|来月|先月|先々月)の今日/);
    if (shiftedToday) {
      const w = shiftedToday[1];
      const dy = w === '来年' ? 1 : w === '再来年' ? 2 : w === '去年' ? -1 : w === '一昨年' ? -2 : 0;
      const dm = w === '来月' ? 1 : w === '再来月' ? 2 : w === '先月' ? -1 : w === '先々月' ? -2 : 0;
      const ty = now.getFullYear() + dy;
      const tm = now.getMonth() + dm;
      const lastDay = new Date(ty, tm + 1, 0).getDate();
      const d = new Date(ty, tm, Math.min(now.getDate(), lastDay));
      const past = dy < 0 || dm < 0;
      return `${w}の今日は${dy !== 0 ? `${ty}年` : ''}${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}曜日）${past ? 'でした' : 'です'}。`;
    }
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
    // P815: N日後の形が同居する時は、素の「何月何日」より先に
    // ずらした日付を答える（従来は「今日は〜」だけ返っていた）。
    const earlyOffset = prompt.match(/(\d+)\s*(日|週間|か月|ヶ月|ヵ月)(後|前)/);
    if (earlyOffset && /今日から|今日を/.test(prompt)) {
      const n = Number(earlyOffset[1]);
      const unit = earlyOffset[2];
      const sign = earlyOffset[3] === '後' ? 1 : -1;
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (unit === '日') d.setDate(d.getDate() + sign * n);
      else if (unit === '週間') d.setDate(d.getDate() + sign * n * 7);
      else d.setMonth(d.getMonth() + sign * n);
      return `今日から${n}${unit}${earlyOffset[3]}は${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}曜日）です。`;
    }
    if (/今日の日付|何月何日/.test(prompt)) {
      return `今日は${now.getMonth() + 1}月${now.getDate()}日です。`;
    }
    // P674: 月・年・残り日数・素の曜日も、その場で答えられる形。
    // ここで受けないと「何月」「何日、今年終」が調査キューに落ちて
    // 的外れな保留文になっていた。
    if (/(?:今|いま)(?:は|って)?何月|何月(?:です)?か/.test(prompt)) {
      return `今は${now.getMonth() + 1}月です。`;
    }
    if (/(?:今年|ことし)(?:は|って)?何年|今(?:は|って)?何年/.test(prompt)) {
      return `今年は${now.getFullYear()}年です。`;
    }
    // P832: 「来月の月末は何曜日？」——月末の日付と曜日を答える
    // （素の「何曜日」や調査に落ちていた）。
    const monthEndQ = prompt.match(/(今月|来月|再来月|先月)の月末(?:は|って)?(?:何日|何曜日)?/);
    if (monthEndQ) {
      const shift = monthEndQ[1] === '来月' ? 1 : monthEndQ[1] === '再来月' ? 2 : monthEndQ[1] === '先月' ? -1 : 0;
      const last = new Date(now.getFullYear(), now.getMonth() + shift + 1, 0);
      return `${monthEndQ[1]}の月末は${last.getMonth() + 1}月${last.getDate()}日（${weekdays[last.getDay()]}曜日）です。`;
    }
    // P825: 明示の日付の曜日は、その日付で答える（素の「何曜日」より先）。
    const dateWeekday = prompt.match(/(\d{1,2})月(\d{1,2})日(?:は|って)何曜日/);
    if (dateWeekday) {
      const tm = Number(dateWeekday[1]); const td = Number(dateWeekday[2]);
      const target = new Date(now.getFullYear(), tm - 1, td);
      return `${tm}月${td}日は${weekdays[target.getDay()]}曜日です。`;
    }
    // P863: N日後の曜日は、先にずらした日付で答える。素の
    // 「何曜日」分岐が手前にあり、「3日後は何曜日？」に今日の
    // 曜日を返していた。オフセット分岐はここ（素の分岐の前）。
    // P675: N日後・N週間後・Nか月後（と前）の日付も計算して答える。
    const offsetMatch = prompt.match(/(\d+)\s*(日|週間|か月|ヶ月|ヵ月)(後|前)/);
    if (offsetMatch && /(?:何日|いつ|曜日|[？?])/.test(prompt)) {
      const n = Number(offsetMatch[1]);
      const unit = offsetMatch[2];
      const sign = offsetMatch[3] === '後' ? 1 : -1;
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (unit === '日') d.setDate(d.getDate() + sign * n);
      else if (unit === '週間') d.setDate(d.getDate() + sign * n * 7);
      else d.setMonth(d.getMonth() + sign * n);
      const label = `${n}${unit}${offsetMatch[3]}`;
      return sign > 0
        ? `${label}は${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}曜日）です。`
        : `${label}は${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}曜日）でした。`;
    }
    if (/何曜日/.test(prompt)) {
      return `今日は${weekdays[now.getDay()]}曜日です。`;
    }
    // P722: 「来週の金曜は何日？」は来週のその曜日の日付を計算する
    // （今週の同じ曜日から7日後。再来週は14日後）。「今週の金曜」は
    // 過ぎた曜日だと意味が曖昧になるので、未来にある場合だけ答える。
    const weekMatch = prompt.match(/(来週|再来週|今週)の([日月火水木金土])曜/);
    if (weekMatch && /(?:何日|いつ|何曜日|[？?])/.test(prompt)) {
      const target = weekdays.indexOf(weekMatch[2]);
      const delta = (target - now.getDay() + 7) % 7;
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (weekMatch[1] === '今週') {
        if (delta === 0) return `今週の${weekMatch[2]}曜日は今日、${d.getMonth() + 1}月${d.getDate()}日です。`;
        d.setDate(d.getDate() + delta);
        return `今週の${weekMatch[2]}曜日は${d.getMonth() + 1}月${d.getDate()}日です。`;
      }
      const weeks = weekMatch[1] === '来週' ? 1 : 2;
      d.setDate(d.getDate() + delta + 7 * weeks);
      return `${weekMatch[1]}の${weekMatch[2]}曜日は${d.getMonth() + 1}月${d.getDate()}日です。`;
    }
    // P817: 「今度の日曜日は何日？」は直近のその曜日の日付を答える
    // （「今度」を知らない語として流れていた）。今日がその曜日なら
    // 今日を指す。
    const nextWd = prompt.match(/今度の([日月火水木金土])曜/);
    if (nextWd && /(?:何日|いつ|何曜日|[？?])/.test(prompt)) {
      const target = weekdays.indexOf(nextWd[1]);
      const delta = (target - now.getDay() + 7) % 7;
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      d.setDate(d.getDate() + delta);
      return delta === 0
        ? `今度の${nextWd[1]}曜日は今日、${d.getMonth() + 1}月${d.getDate()}日です。`
        : `今度の${nextWd[1]}曜日は${d.getMonth() + 1}月${d.getDate()}日です。`;
    }
    // P863: 「次の金曜日は何日？」と素の「金曜日は何日？」も
    // 日付で答える（知らない語として流れていた）。「次の」は
    // 今日がその曜日なら来週の同じ曜日を指し、素の形は直近
    // （今日を含む）を指す。
    const namedWd = prompt.match(/(次の)?([日月火水木金土])曜(?:日)?(?:は|って)?(?:何日|いつ)/);
    if (namedWd) {
      const target = weekdays.indexOf(namedWd[2]);
      let delta = (target - now.getDay() + 7) % 7;
      if (namedWd[1] && delta === 0) delta = 7;
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      d.setDate(d.getDate() + delta);
      const label = namedWd[1] ? `次の${namedWd[2]}曜日` : `${namedWd[2]}曜日`;
      return delta === 0
        ? `${label}は今日、${d.getMonth() + 1}月${d.getDate()}日です。`
        : `${label}は${d.getMonth() + 1}月${d.getDate()}日です。`;
    }
    // P722: 「あと何日で12月？」は、その月の1日までの日数を数える。
    const untilMonth = prompt.match(/あと何日で(\d{1,2})月/);
    if (untilMonth) {
      const m = Number(untilMonth[1]);
      if (m >= 1 && m <= 12) {
        if (m === now.getMonth() + 1) return `もう${m}月です。`;
        const year = m > now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
        const first = new Date(year, m - 1, 1);
        const days = Math.round((first.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
        return `${m}月まであと${days}日です。`;
      }
    }
    const remainYear = /(?:あと何日で)?今年(?:は)?(?:あと何日|終わるまで何日|終わる)/.test(prompt) || /今年(?:は)?あと何日/.test(prompt);
    if (/あと何日/.test(prompt) && /今年/.test(prompt) || remainYear) {
      const end = new Date(now.getFullYear(), 11, 31);
      const days = Math.round((end.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
      return days <= 0 ? '今年は今日で終わりです。' : `今年はあと${days}日です。`;
    }
    // P817: 「月末まであと何日？」は今月の末日までの日数を数える。
    if (/あと何日/.test(prompt) && /(?:月末|今月末)/.test(prompt)) {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const days = Math.round((end.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
      return days <= 0 ? '今日が月末です。' : `月末まであと${days}日です。`;
    }
    if (/あと何日/.test(prompt) && /今月/.test(prompt)) {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const days = Math.round((end.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
      return days <= 0 ? '今月は今日で終わりです。' : `今月はあと${days}日です。`;
    }
    // P817: 「今年はあと何週間ある？」は日数と週数で答える。
    if (/あと何週間/.test(prompt) && /今年/.test(prompt)) {
      const end = new Date(now.getFullYear(), 11, 31);
      const days = Math.round((end.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
      return `今年はあと${days}日、約${Math.floor(days / 7)}週間です。`;
    }
    // P815: 「来月は何日まで？」「2月は何日ある？」は、その月の
    // 末日を答える（従来は「来月」を知らない語として流れていた）。
    // P822: 「今月あと何回金曜日がある？」——その月のその曜日の
    // 回数を数える（「あと」は今日より後だけを数える）。
    const wdCount = prompt.match(/(今月|来月|再来月)(?:は|って)?(?:あと)?何回([日月火水木金土])曜日/);
    if (wdCount) {
      const shift = wdCount[1] === '来月' ? 1 : wdCount[1] === '再来月' ? 2 : 0;
      const target = '日月火水木金土'.indexOf(wdCount[2]);
      const remainingOnly = shift === 0 && /あと/.test(prompt);
      const base = new Date(now.getFullYear(), now.getMonth() + shift, 1);
      let count = 0;
      for (let d = new Date(base.getFullYear(), base.getMonth(), 1); d.getMonth() === base.getMonth(); d.setDate(d.getDate() + 1)) {
        if (d.getDay() !== target) continue;
        if (remainingOnly && d.getDate() <= now.getDate()) continue;
        count++;
      }
      return remainingOnly
        ? `${wdCount[1]}はあと${count}回、${wdCount[2]}曜日があります。`
        : `${wdCount[1]}は${wdCount[2]}曜日が${count}回あります。`;
    }
    // P826: 日付から日付までの日数（「11月20日から12月25日まで
    // 何日？」）は、2つの日付の差で答える。今日からの残り日数と
    // 取り違えていた。
    const dateToDate = prompt.match(/(\d{1,2})月(\d{1,2})日から(\d{1,2})月(\d{1,2})日まで何日/);
    if (dateToDate) {
      const y = now.getFullYear();
      const start = new Date(y, Number(dateToDate[1]) - 1, Number(dateToDate[2]));
      let end = new Date(y, Number(dateToDate[3]) - 1, Number(dateToDate[4]));
      if (end.getTime() < start.getTime()) end = new Date(y + 1, Number(dateToDate[3]) - 1, Number(dateToDate[4]));
      const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
      return `${dateToDate[1]}月${dateToDate[2]}日から${dateToDate[3]}月${dateToDate[4]}日までは${diff}日です。`;
    }
    // P825: 明示の日付までの日数と、その日付の曜日も、その場で
    // 数える（従来は調査に落ちていた）。
    const untilDate = prompt.match(/(\d{1,2})月(\d{1,2})日まで(?:あと)?何日/);
    if (untilDate) {
      const tm = Number(untilDate[1]); const td = Number(untilDate[2]);
      const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let target = new Date(now.getFullYear(), tm - 1, td);
      if (target.getTime() < today0.getTime()) target = new Date(now.getFullYear() + 1, tm - 1, td);
      const diff = Math.round((target.getTime() - today0.getTime()) / 86400000);
      return diff === 0 ? `${tm}月${td}日は今日です。` : `${tm}月${td}日まであと${diff}日です。`;
    }
    // P827: 質問の中で生年月日が示されたら（「1995年6月15日
    // 生まれの人は今何歳？」）、その場で年齢を割り出す。
    const bornAge = prompt.match(/(\d{4})年(\d{1,2})月(\d{1,2})日生まれ/);
    if (bornAge && /何歳/.test(prompt)) {
      const by = Number(bornAge[1]); const bm = Number(bornAge[2]); const bd = Number(bornAge[3]);
      let age = now.getFullYear() - by;
      if (now.getMonth() < bm - 1 || (now.getMonth() === bm - 1 && now.getDate() < bd)) age--;
      return `${by}年${bm}月${bd}日生まれの人は今${age}歳です。`;
    }
    // P828: 元号と干支は、年から決定的に決まる（調査に落とさない）。
    const eraNow = prompt.match(/(?:今は|今年は)?令和何年/);
    if (eraNow && now.getFullYear() >= 2019) {
      return `今は令和${now.getFullYear() - 2018}年です。`;
    }
    const eraConv = prompt.match(/(\d{4})年は(令和|平成|昭和)何年/);
    if (eraConv) {
      const y = Number(eraConv[1]); const era = eraConv[2];
      if (era === '令和' && y >= 2019) return `${y}年は令和${y - 2018}年です。`;
      if (era === '平成' && y >= 1989 && y <= 2019) return `${y}年は平成${y - 1988}年です。`;
      if (era === '昭和' && y >= 1926 && y <= 1989) return `${y}年は昭和${y - 1925}年です。`;
      return undefined;
    }
    if (/干支/.test(prompt)) {
      const eto = (y: number) => '子丑寅卯辰巳午未申酉戌亥'[(((y - 4) % 12) + 12) % 12];
      const bornY = prompt.match(/(\d{4})年(?:生まれ|生)/);
      if (bornY) return `${bornY[1]}年生まれの干支は${eto(Number(bornY[1]))}です。`;
      if (/来年/.test(prompt)) return `来年の干支は${eto(now.getFullYear() + 1)}です。`;
      if (/去年|昨年/.test(prompt)) return `去年の干支は${eto(now.getFullYear() - 1)}です。`;
      return `今年の干支は${eto(now.getFullYear())}です。`;
    }
    // P829: 季節・うるう年・決まった年中行事までの日数も、月日
    // から決定的に決まる。
    if (/季節/.test(prompt) && /(?:今|いま|現在)/.test(prompt)) {
      const mo = now.getMonth() + 1;
      const season = mo >= 3 && mo <= 5 ? '春' : mo >= 6 && mo <= 8 ? '夏' : mo >= 9 && mo <= 11 ? '秋' : '冬';
      return `今は${season}です。`;
    }
    if (/うるう年/.test(prompt)) {
      const ym = prompt.match(/(\d{4})年/);
      const y = ym ? Number(ym[1]) : now.getFullYear();
      const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      return ym ? `${y}年はうるう年${leap ? 'です' : 'ではありません'}。` : `今年（${y}年）はうるう年${leap ? 'です' : 'ではありません'}。`;
    }
    const NAMED_DAYS: Array<[RegExp, string, number, number]> = [
      [/クリスマス/, 'クリスマス', 12, 25],
      [/お正月|正月|元日/, 'お正月', 1, 1],
      [/バレンタイン/, 'バレンタインデー', 2, 14],
      [/ハロウィン/, 'ハロウィン', 10, 31],
      [/七夕/, '七夕', 7, 7],
      [/ひな祭り|雛祭り/, 'ひな祭り', 3, 3],
      [/こどもの日|子供の日/, 'こどもの日', 5, 5],
    ];
    for (const [re, label, mm2, dd2] of NAMED_DAYS) {
      if (re.test(prompt) && /まで(?:あと)?何日/.test(prompt)) {
        const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let target = new Date(now.getFullYear(), mm2 - 1, dd2);
        if (target.getTime() < today0.getTime()) target = new Date(now.getFullYear() + 1, mm2 - 1, dd2);
        const diff = Math.round((target.getTime() - today0.getTime()) / 86400000);
        return diff === 0 ? `${label}は今日です。` : `${label}（${mm2}月${dd2}日）まであと${diff}日です。`;
      }
    }
    const monthLenMatch = prompt.match(/(今月|来月|再来月|先月|(\d{1,2})月)(?:は|って)?(?:何日まで|何日ある|何日間)/);
    if (monthLenMatch) {
      let y = now.getFullYear();
      let m = now.getMonth();
      if (monthLenMatch[1] === '来月') m += 1;
      else if (monthLenMatch[1] === '再来月') m += 2;
      else if (monthLenMatch[1] === '先月') m -= 1;
      else if (monthLenMatch[2]) { m = Number(monthLenMatch[2]) - 1; if (m < now.getMonth()) y += 1; }
      const norm = new Date(y, m, 1);
      const last = new Date(norm.getFullYear(), norm.getMonth() + 1, 0).getDate();
      return `${norm.getMonth() + 1}月は${last}日までです。`;
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
    // P675: 割合（%）と消費税も決定的に計算できる。
    const tax = p.match(/^(\d+(?:\.\d+)?)\s*円?の消費税\s*(\d+(?:\.\d+)?)\s*(?:%|％|パーセント)(?:は|って)?(?:いくら)?$/);
    if (tax) return `${tax[1]}円の消費税（${tax[2]}%）は${format(Number(tax[1]) * Number(tax[2]) / 100)}円です。`;
    // P820: 税込から税抜き／税抜きから税込も、その場で計算する
    // （従来は答えられず、調査にも落ちていた）。
    const taxOut = p.match(/税込\s*(\d+(?:\.\d+)?)\s*円の(?:税抜き|本体)(?:価格)?(?:は|って)?(?:いくら)?/);
    if (taxOut) {
      const rate = /(?:軽減|食品|8\s*(?:%|％))/.test(p) ? 8 : 10;
      const base = Math.round(Number(taxOut[1]) / (1 + rate / 100));
      return `税込${taxOut[1]}円の税抜き価格は、消費税${rate}%として${base}円です。`;
    }
    const taxIn = p.match(/^(\d+(?:\.\d+)?)\s*円の消費税\s*(\d+(?:\.\d+)?)\s*(?:%|％|パーセント)?\s*(?:込み|込)(?:は|って)?(?:いくら)?/);
    if (taxIn) return `${taxIn[1]}円の消費税（${taxIn[2]}%）込みは${format(Number(taxIn[1]) * (1 + Number(taxIn[2]) / 100))}円です。`;
    const taxInDef = p.match(/^(\d+(?:\.\d+)?)\s*円の消費税込み(?:は|って)?(?:いくら)?/);
    if (taxInDef) return `${taxInDef[1]}円の消費税（10%）込みは${format(Number(taxInDef[1]) * 1.1)}円です。`;
    const percent = p.match(/^(\d+(?:\.\d+)?)\s*の\s*(\d+(?:\.\d+)?)\s*(?:%|％|パーセント)(?:は|って)?$/);
    if (percent) return `${percent[1]}の${percent[2]}%は${format(Number(percent[1]) * Number(percent[2]) / 100)}です。`;
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
   * P676: 単位の換算の質問（「N単位Aは何単位B？」）は、共有の換算
   * サービス（P491）で決定的に答える。従来は調査に落ちて、生の
   * 調査結果の断片が返ることもあった。
   */
  private unitConversionAnswer(prompt: string): string | undefined {
    const p = String(prompt || '').replace(/[？?。！!]/g, '').trim();
    // P827: 複合の時間（「2時間30分は何分？」「150分は何時間
    // 何分？」）は、単位どうしの合成として受ける。
    const compound = p.match(/^(\d+(?:\.\d+)?)時間(\d+(?:\.\d+)?)分は(?:何|いくつ)分(?:です)?(?:か)?$/);
    if (compound) return `${compound[1]}時間${compound[2]}分は${Number(compound[1]) * 60 + Number(compound[2])}分です。`;
    const splitForm = p.match(/^(\d+(?:\.\d+)?)分は(?:何|いくつ)時間(?:何|いくつ)分(?:です)?(?:か)?$/);
    if (splitForm) { const t = Number(splitForm[1]); return `${splitForm[1]}分は${Math.floor(t / 60)}時間${t % 60}分です。`; }
    // P824: 前置き（「身長180センチって」）や「って」の形も受ける。
    const m = p.match(/^(?:.*?)(\d+(?:\.\d+)?)\s*(\S+?)(?:は|って)(?:何|いくつ)(\S+?)(?:です)?(?:か)?$/);
    if (!m) return undefined;
    const value = Number(m[1]);
    const from = m[2].trim();
    const to = m[3].trim();
    if (!unitConversionService.isUnit(from) || !unitConversionService.isUnit(to)) return undefined;
    let converted = unitConversionService.convert(value, from, to);
    let fromLabel = from;
    if (converted === null && from === 'キロ') {
      // 「キロ」は長さ・重さ両方に使われる。次元が合わなければ重さで再試行。
      converted = unitConversionService.convert(value, 'キログラム', to);
      if (converted !== null) fromLabel = 'キログラム';
    }
    if (converted === null) return undefined;
    const rounded = Math.round(converted * 10000) / 10000;
    const shown = Number.isInteger(rounded) ? String(rounded) : String(rounded);
    return `${m[1]}${fromLabel}は${shown}${to}です。`;
  }

  /**
   * P677: 数の大小の比較と、語の文字数は決定的に答えられる。
   * 従来は比較が対象特定の聞き返しに、文字数が調査に化けていた。
   */
  private comparisonAndCountAnswer(prompt: string): string | undefined {
    const p = String(prompt || '').trim();
    const cmp = p.match(/^(\d+(?:\.\d+)?)\s*と\s*(\d+(?:\.\d+)?)\s*(?:は|って)?\s*どっちが\s*(大きい|多い|小さい|少ない)/);
    if (cmp) {
      const a = Number(cmp[1]);
      const b = Number(cmp[2]);
      const adjective = cmp[3];
      if (a === b) return `${cmp[1]}と${cmp[2]}は同じです。`;
      const bigger = a > b ? cmp[1] : cmp[2];
      const smaller = a > b ? cmp[2] : cmp[1];
      return (adjective === '大きい' || adjective === '多い')
        ? `${bigger}の方が${adjective}です。`
        : `${smaller}の方が${adjective}です。`;
    }
    const countMatch = p.match(/「([^」]{1,30})」\s*(?:って|は)?\s*何文字/) || p.match(/^(.{1,30}?)(?:って|は)何文字/);
    if (countMatch) {
      const word = countMatch[1].replace(/\s/g, '');
      if (word && !/[？?。]/.test(word)) {
        return `「${word}」は${[...word].length}文字です。`;
      }
    }
    return undefined;
  }

  /**
   * P731: 「Xの仲間って他にいる？」に、世界モデルの IS_A から
   * 同じ分類の相手（兄弟）を答える。分類の根拠が仮の関係だけの
   * ときは、教わった範囲の話として出す。
   */
  private siblingAnswer(prompt: string): string | undefined {
    if (!/(?:仲間|なかま)/.test(prompt)) return undefined;
    if (!/(?:他|ほか|いる|ある)/.test(prompt)) return undefined;
    let tokens: string[] = [];
    try { tokens = utteranceFeatureService.analyze(prompt).contentTokens || []; } catch { return undefined; }
    try {
      for (const t of tokens) {
        if (!t || t.length < 2) continue;
        const isA = worldModelGraphService.relationsOf(t).filter((r) => r.from === t && r.type === 'IS_A');
        if (isA.length === 0) continue;
        const categories = isA.map((r) => r.to);
        // 直近に学んだ仲間から挙げる（会話の流れに近い順）。
        const siblings = [...new Set(worldModelGraphService.relations()
          .filter((r) => r.type === 'IS_A' && categories.includes(r.to) && r.from !== t)
          .sort((x, y) => Number((y as any).createdAt || 0) - Number((x as any).createdAt || 0))
          .map((r) => r.from))].slice(0, 3);
        const category = categories[0];
        const allProvisional = isA.every((r) => r.provisional);
        if (siblings.length > 0) {
          return allProvisional
            ? `教わった説明の中では、${siblings.join('と')}も${category}の仲間だよ。`
            : `うん、${siblings.join('と')}も${category}の仲間だよ。`;
        }
        return allProvisional
          ? `教わった説明の中では、他に${category}の仲間は知らないです。`
          : `他に${category}の仲間は、まだ知らないです。`;
      }
    } catch { return undefined; }
    return undefined;
  }

  /**
   * P732: 「AとB、どっちが大きい／重い／速い？」に、知っている
   * 説明文の中の手がかり（大きい・小さい等の語）で答える。両方
   * に手がかりがあって食い違えば比べ、片方だけなら足りない
   * 部分を正直に言う。手がかりが無くても、知っている物同士の
   * 比較なら「材料が足りない」と会話の形で答える（下流の作業
   * 書式に落とさない）。
   */
  /**
   * P787: 「僕と妹、どっちが年上？」——年齢の事実同士で比べる。
   * 説明文の実測値比べ（P756）とは別に、人の属性の事実を見る。
   */
  private factAgeComparisonAnswer(prompt: string, memories: any[] = []): string | undefined {
    if (!/(?:年上|年下)/.test(prompt)) return undefined;
    if (!/どっち|どちら/.test(prompt)) return undefined;
    const selfSet = new Set(['僕', '私', '俺', 'わたし', 'あたし']);
    const ageOf = (name: string): { label: string; age: number } | undefined => {
      const targets = selfSet.has(name) ? [...selfSet] : [name];
      // P837: 「僕は30歳だよ」の形は属性なしで保存される。値の単位
      // （歳）から年齢の事実として読めるものも対象にする。
      const fact = (memories || []).find((mm: any) => mm && mm.active !== false && !mm.replacedBy
        && (String(mm.factAttribute || '') === '年齢' || (!mm.factAttribute && /歳|才/.test(String(mm.factValue || ''))))
        && targets.includes(String(mm.factEntity || ''))
        && /\d/.test(String(mm.factValue || '')));
      if (!fact) return undefined;
      const age = Number(String(fact.factValue).match(/(\d+)/)?.[1]);
      return Number.isFinite(age) ? { label: name, age } : undefined;
    };
    const tokens = utteranceFeatureService.analyze(prompt).contentTokens
      .filter((w: string) => w.length >= 1 && !/^(?:年上|年下|どっち|どちら)$/.test(w));
    const found: Array<{ label: string; age: number }> = [];
    for (const t of tokens) {
      const hit = ageOf(t);
      if (hit && !found.some((f) => f.label === hit.label)) found.push(hit);
      if (found.length >= 2) break;
    }
    // P837: 誰も名指されていない続きの比較（「どっちが年上？」）は、
    // 年齢を知っている人がちょうど2人なら、その2人で比べる。
    if (found.length === 0) {
      const holders = new Map<string, { label: string; age: number }>();
      for (const mm of (memories || [])) {
        if (!mm || mm.active === false || mm.replacedBy) continue;
        const fa = String(mm.factAttribute || '');
        if (fa ? fa !== '年齢' : !/歳|才/.test(String(mm.factValue || ''))) continue;
        const ent = String(mm.factEntity || '');
        if (!ent) continue;
        const key = selfSet.has(ent) ? '僕' : ent;
        if (holders.has(key)) continue;
        const hit = ageOf(ent);
        if (hit) holders.set(key, { label: key, age: hit.age });
      }
      if (holders.size === 2) found.push(...holders.values());
    }
    if (found.length < 2) return undefined;
    const [a, b] = found;
    if (a.age === b.age) return `${a.label}と${b.label}は同じ${a.age}歳です。`;
    const older = a.age > b.age ? a : b;
    const younger = a.age > b.age ? b : a;
    if (/年下/.test(prompt) && !/年上/.test(prompt)) {
      return `${younger.label}の方が年下です（${a.label}は${a.age}歳、${b.label}は${b.age}歳）。`;
    }
    return `${older.label}の方が年上です（${a.label}は${a.age}歳、${b.label}は${b.age}歳）。`;
  }

  private glossComparisonAnswer(prompt: string, memories: any[] = [], state?: any, recentMessages: ChatMessage[] = []): string | undefined {
    if (!/(?:どっちが|どちらが)/.test(prompt)) return undefined;
    const dims: Array<{ re: RegExp; label: string; adj: string; plus: RegExp; minus: RegExp; plusText: string; minusText: string }> = [
      // P788: 「背が高い／低い」は大きさの次元で、実測値は身長の事実。
      { re: /背が高|背が低/, label: '大きさ', adj: '背が高い', plus: /高/, minus: /低/, plusText: '背が高い', minusText: '背が低い' },
      { re: /大き|小さ/, label: '大きさ', adj: '大きい', plus: /大き|でか/, minus: /小さ|小柄/, plusText: '大きい', minusText: '小さい' },
      { re: /重|軽/, label: '重さ', adj: '重い', plus: /重/, minus: /軽/, plusText: '重い', minusText: '軽い' },
      { re: /速|早|遅/, label: '速さ', adj: '速い', plus: /速|俊敏/, minus: /遅|のろ/, plusText: '速い', minusText: '遅い' },
      { re: /長生き|寿命|短命/, label: '寿命', adj: '長生き', plus: /長生き|長寿/, minus: /短命/, plusText: '長生き', minusText: '短命' },
    ];
    const dim = dims.find((d) => d.re.test(prompt));
    if (!dim) return undefined;
    let tokens: string[] = [];
    try { tokens = utteranceFeatureService.analyze(prompt).contentTokens || []; } catch { return undefined; }
    // P756: 数値で比べる経路（重さ・大きさ）。手がかり語の対比
    // （P732）より先に、事実と説明に埋まっている実測値を比べる。
    // 相手は教わった語でなくてもよい（「僕とミナモ、どっちが
    // 重い？」——僕の体重は事実の側にある）。
    if ((dim.label === '重さ' || dim.label === '大きさ' || dim.label === '寿命') && Array.isArray(memories)) {
      const measureOf = (text: string): { value: number; disp: string } | undefined => this.measureFromText(text, dim.label as '重さ' | '大きさ' | '寿命');
      const measureFor = (name: string): { value: number; disp: string } | undefined => {
        const isSelf = name === '僕';
        for (const m of memories) {
          if (!m || m.active === false || m.replacedBy) continue;
          const e = String(m.factEntity || '');
          const hit = isSelf ? /^(?:僕|私|俺|わたし)$/.test(e) : e === name;
          if (!hit) continue;
          const r = measureOf(String(m.factValue || '')) || measureOf(String(m.content || ''));
          if (r) return r;
        }
        if (!isSelf) {
          try {
            const entry = japaneseDictionaryService.lookup(name).find((x: any) => x.gloss);
            if (entry) return measureOf(String(entry.gloss));
          } catch { /* 補助判定 */ }
        }
        return undefined;
      };
      const knownName = (name: string): boolean => {
        if (name === '僕') return true;
        if (/^(?:体重|重さ|大きさ|体長|全長|長さ|寿命|身長|どっち|どちら)$/.test(name)) return false;
        try { if (japaneseDictionaryService.lookup(name).some((x: any) => x.gloss)) return true; } catch { /* 補助判定 */ }
        return memories.some((m: any) => m && String(m.factEntity || '') === name);
      };
      const spots: Array<{ name: string; at: number }> = [];
      const selfM = prompt.match(/(?:僕|私|俺|わたし)/);
      if (selfM) spots.push({ name: '僕', at: prompt.indexOf(selfM[0]) });
      for (const t of tokens) {
        if (!t) continue;
        const at = prompt.indexOf(t);
        if (at >= 0) spots.push({ name: t, at });
      }
      for (const m of memories) {
        const e = String(m?.factEntity || '');
        if (e && e.length >= 2 && !/^(?:僕|私|俺|わたし)$/.test(e)) {
          const at = prompt.indexOf(e);
          if (at >= 0) spots.push({ name: e, at });
        }
      }
      spots.sort((x, y) => x.at - y.at);
      const numEnts: Array<{ name: string; meas?: { value: number; disp: string } }> = [];
      for (const s of spots) {
        if (numEnts.some((e) => e.name === s.name) || !knownName(s.name)) continue;
        numEnts.push({ name: s.name, meas: measureFor(s.name) });
        if (numEnts.length >= 2) break;
      }
      // P834: 対が省略された続きの比較（「どっちが重い？」）は、
      // 直近に話した2つを相手にする。
      if (numEnts.length < 2) {
        try {
          for (const cand of this.recentTopicCandidates(state, recentMessages)) {
            if (numEnts.length >= 2) break;
            if (!cand || numEnts.some((e) => e.name === cand) || !knownName(cand)) continue;
            const meas = measureFor(cand);
            if (meas) numEnts.push({ name: cand, meas });
          }
        } catch { /* 補助経路 */ }
      }
      // P756: 片方は知っているが、もう片方がそもそも未知の相手の
      // ときは、内部の「対象を特定できません」に落とさず、正直に
      // 知らないと言う。
      if (numEnts.length === 1) {
        const unknownSpot = spots.find((s) => s.name !== '僕' && !knownName(s.name)
          && s.name.length >= 2
          && !/^(?:どっち|どちら|重い|大きい|小さい|軽い|体重|重さ|大きさ|体長|全長|長さ)$/.test(s.name)
          && /^[一-龠ァ-ヶ]/.test(s.name));
        if (unknownSpot) {
          return `「${unknownSpot.name}」のことはまだ知らないので、${dim.label}は比べられないです。`;
        }
      }
      if (numEnts.length >= 2) {
        const [x, y] = numEnts;
        if (x.meas && y.meas) {
          if (x.meas.value === y.meas.value) return `「${x.name}」は${x.meas.disp}、「${y.name}」は${y.meas.disp}なので、${dim.label}は同じくらいです。`;
          // P788: 聞かれた向き（小さい方／軽い方／背が低い方）で答える。
          const askedMinus = dim.minus.test(prompt) && !dim.plus.test(prompt);
          const w = askedMinus
            ? (x.meas.value < y.meas.value ? x : y)
            : (x.meas.value > y.meas.value ? x : y);
          return `「${x.name}」は${x.meas.disp}、「${y.name}」は${y.meas.disp}なので、${w.name}の方が${askedMinus ? dim.minusText : dim.plusText}です。`;
        }
        if (x.meas || y.meas) {
          const k = x.meas ? x : y;
          const u = x.meas ? y : x;
          return `${dim.label}比べは、まだ材料が足りないです。「${k.name}」は${k.meas!.disp}と聞いているけど、「${u.name}」の${dim.label}は知らないです。`;
        }
      }
    }
    const entities: Array<{ name: string; gloss: string; taught: boolean }> = [];
    for (const t of tokens) {
      if (!t || t.length < 2 || entities.some((e) => e.name === t)) continue;
      try {
        const entry = japaneseDictionaryService.lookup(t).find((e: any) => e.gloss);
        if (entry) entities.push({ name: t, gloss: String(entry.gloss), taught: Array.isArray((entry as any).semanticIds) && (entry as any).semanticIds.includes('learned:user-taught') });
      } catch { /* 補助判定 */ }
      if (entities.length >= 2) break;
    }
    if (entities.length < 2) return undefined;
    const [a, b] = entities;
    const cue = (g: string) => (dim.plus.test(g) ? 1 : dim.minus.test(g) ? -1 : 0);
    const ca = cue(a.gloss);
    const cb = cue(b.gloss);
    const cueText = (c: number) => (c > 0 ? dim.plusText : dim.minusText);
    const srcNote = a.taught || b.taught ? '教わった説明では' : '覚えている説明では';
    if (ca !== 0 && cb !== 0) {
      if (ca === cb) return `${srcNote}、「${a.name}」も「${b.name}」も${cueText(ca)}方なので、${dim.label}ははっきりとは比べられないです。`;
      const winner = ca > cb ? a : b;
      return `${srcNote}、「${a.name}」は${cueText(ca)}、「${b.name}」は${cueText(cb)}ので、${winner.name}の方が${dim.adj}と思います。`;
    }
    if (ca !== 0 || cb !== 0) {
      const knownE = ca !== 0 ? a : b;
      const otherE = ca !== 0 ? b : a;
      const c = ca !== 0 ? ca : cb;
      return `${dim.label}比べは、まだ材料が足りないです。「${knownE.name}」は${cueText(c)}と聞いているけど、「${otherE.name}」の${dim.label}は知らないです。`;
    }
    return `${dim.label}比べは、まだ材料が足りなくて分からないです。`;
  }

  /**
   * P742: 教わった語が、聞かれた分類の範囲に入るかの判定。
   * 「動物・生き物」は生き物全般の範囲として扱い、説明文や
   * 分類に生き物の分類語（カエル・鳥・獣など）があれば含める
   * （「カエルの一種」と教わった語が「教えた生き物」に
   * 入らない、という取りこぼしの対策）。
   */
  private taughtScopeMatch(entry: any, cat: string): boolean {
    const gloss = String(entry?.gloss || '');
    const isA = worldModelGraphService.relationsOf(String(entry?.surface || '')).filter((r) => r.from === entry.surface && r.type === 'IS_A').map((r) => r.to);
    if (cat === '動物') {
      const creatures = ['動物', '鳥', '魚', '虫', '獣', 'カエル', '哺乳類', '爬虫類', '両生類', '昆虫', '生き物'];
      return creatures.some((c) => gloss.includes(c) || isA.includes(c));
    }
    return gloss.includes(cat) || isA.includes(cat);
  }

  /**
   * P734: 「今まで僕が教えた生き物、全部言ってみて」に、個人辞書
   * の教示記録（user-taught）から一覧で答える。分類の語があれば
   * その範囲に絞る（説明文か仮の分類に分類語を含むもの）。
   */
  /**
   * P819: 「重さの真ん中は？」——教わったものの実測値の中央。
   * 並び順（P758）・合計と平均（P761）はあったが真ん中は無く、
   * 未知語の保留に落ちていた。偶数個なら真ん中の2つを挙げる。
   */
  private measureMedianAnswer(prompt: string): string | undefined {
    if (!/(?:真ん中|中央)/.test(prompt)) return undefined;
    const dim = /重さ|重い|軽い/.test(prompt) ? '重さ' as const
      : /大きさ|大きい|小さい/.test(prompt) ? '大きさ' as const
      : /寿命|長生き/.test(prompt) ? '寿命' as const : undefined;
    if (!dim) return undefined;
    try {
      const categoryMatch = prompt.match(/(生き物|動物|鳥|魚|虫|植物)/);
      const cat = categoryMatch ? (categoryMatch[1] === '生き物' ? '動物' : categoryMatch[1]) : '';
      const entries = japaneseDictionaryService.listPersonal()
        .filter((e: any) => e.gloss && Array.isArray(e.semanticIds) && e.semanticIds.includes('learned:user-taught'))
        .filter((e: any) => !cat || this.taughtScopeMatch(e, cat));
      const measured = entries
        .map((e: any) => ({ name: String(e.surface), meas: this.measureFromText(String(e.gloss), dim) }))
        .filter((x) => x.meas)
        .sort((a, b) => a.meas!.value - b.meas!.value);
      if (measured.length === 0) return `${dim}の数値が分かるものがまだ無いので、真ん中は分からないです。`;
      const mid = Math.floor(measured.length / 2);
      if (measured.length % 2 === 1) {
        const pick = measured[mid];
        return `${dim}の真ん中は「${pick.name}」です（${pick.meas!.disp}）。`;
      }
      const lo = measured[mid - 1]; const hi = measured[mid];
      return `${dim}の真ん中は「${lo.name}」（${lo.meas!.disp}）と「${hi.name}」（${hi.meas!.disp}）の間です。`;
    } catch { return undefined; }
  }

  /**
   * P819: 「夜に活動する生き物を教えて」——動詞句の性質で絞った
   * 一覧。性質の一覧（P763）は名詞の性質（夜行性など）だけで、
   * 句の形は調査の的外れな提示に落ちていた。説明文に句を含む
   * ものを挙げる（数えは P818）。
   */
  private taughtTraitListAnswer(prompt: string): string | undefined {
    const m = prompt.match(/^(.{2,14}?)(?:の)?(生き物|動物|鳥|魚|虫|植物|獣)(?:を|は|って|が)?(?:教えて|挙げて|知りたい|見せて)/);
    if (!m) return undefined;
    const trait = m[1].replace(/^(?:今まで|これまで)?(?:教えた|教えてくれた|教えてもらった|教わった)/, '').trim();
    if (!trait || trait.length < 2 || /何|より/.test(trait)) return undefined;
    if (!/(?:する|いる|れる|ある|ない|鳴く|泳ぐ|飛ぶ|光る|咲く)/.test(trait)) return undefined;
    const cat = m[2] === '生き物' ? '動物' : m[2];
    try {
      const entries = japaneseDictionaryService.listPersonal()
        .filter((e: any) => e.gloss && Array.isArray(e.semanticIds) && e.semanticIds.includes('learned:user-taught'))
        .filter((e: any) => this.taughtScopeMatch(e, cat));
      const hits = entries.filter((e: any) => String(e.gloss).includes(trait));
      const names = [...new Set(hits.map((e: any) => String(e.surface)))];
      if (names.length === 0) return `今知っている中では、${trait}ものはいないです。`;
      const text = `${trait}${m[2]}は、${names.map((n) => `「${n}」`).join('と')}がいます。`;
      // P838: 直後の一覧への「他には？」に備えて控えておく。
      // P846: 控えは共通の保留枠組みへ（TTL 10分、消費せず覗く）。
      pendingSlotService.set('miki_last_list_answer_v1', { prompt, text }, 10 * 60000);
      return text;
    } catch { return undefined; }
  }

  /** P838: 一覧の答えの後の「他には？」——控えた一覧を今の知識で
   * 再計算し、同じなら「他にはいない」と正直に答える。
   * P839: 続きの数え（「何種類いる？」）も、同じ控えから数える。 */
  private lastListFollowupAnswer(prompt: string): string | undefined {
    const p = prompt.trim();
    const isOther = /^(?:他には|他は|あとは|ほかには)[？?。]?$/.test(p);
    const isCount = /^(?:全部で)?(?:何種類|何匹|何個|いくつ)(?:いる|ある)?[？?。]?$/.test(p);
    if (!isOther && !isCount) return undefined;
    try {
      const stash = pendingSlotService.peek<{ prompt?: string; text?: string }>('miki_last_list_answer_v1');
      if (!stash) return undefined;
      const fresh = this.taughtTraitListAnswer(String(stash.prompt || ''));
      if (!fresh) return undefined;
      if (isCount) {
        const names = fresh.match(/「[^」]+」/g) || [];
        if (names.length === 0) return undefined;
        const counter = /何匹/.test(p) ? '匹' : /何個/.test(p) ? '個' : '種類';
        return `${names.length}${counter}です。`;
      }
      if (fresh === stash.text) return '他にはいないです。今知っているのは、それだけです。';
      return fresh;
    } catch { return undefined; }
  }

  /** P838: 予定の開始時刻の続きの質問（「何時から？」）。台帳の
   * 文の中の時刻で答える。 */
  private planTimeAnswer(prompt: string): string | undefined {
    if (!/(?:何時から|何時に始まる|何時まで)/.test(prompt)) return undefined;
    try {
      const raw = storageService.getItem('miki_user_plans_v1');
      const plans: Array<{ when: string; text: string; at: number; date?: string }> = raw ? JSON.parse(raw) : [];
      const timed = plans
        .map((p) => {
          const tm = String(p.text || '').match(/(\d{1,2})時(?:(\d{1,2})分)?/);
          return tm ? { when: p.when, date: p.date || '', time: `${tm[1]}時${tm[2] ? `${tm[2]}分` : ''}` } : null;
        })
        .filter((x): x is { when: string; date: string; time: string } => Boolean(x));
      if (timed.length === 0) return undefined;
      const whenWord = (prompt.match(/(明後日|明日|今日|今夜)/) || [])[1];
      const scoped = whenWord ? timed.filter((x) => x.when === whenWord) : timed;
      const pick = (scoped.length > 0 ? scoped : timed).slice().sort((a, b) => a.date.localeCompare(b.date))[0];
      return `${pick.when}の予定は${pick.time}からです。`;
    } catch { return undefined; }
  }

  /**
   * P818: 「夜に活動する獣は何種類？」——性質で絞った数え。
   * 教わった説明文に性質の句を含むものだけを数える（従来は
   * 教えた全体の数や、1件だけの想起で答えていた）。
   */
  private taughtTraitCountAnswer(prompt: string): string | undefined {
    if (!/(?:何種類|何個|何匹|いくつ)/.test(prompt)) return undefined;
    const m = prompt.match(/^(.{2,14}?)(?:の)?(生き物|動物|鳥|魚|虫|植物|獣)(?:は|って|が)?(?:何種類|何個|何匹|いくつ)/);
    if (!m) return undefined;
    const trait = m[1].replace(/^(?:今まで|これまで)?(?:教えた|教えてくれた|教えてもらった|教わった)/, '').trim();
    // 「Xより重い鳥」は性質ではなく基準つきの数え（P771）なので譲る。
    if (!trait || trait.length < 2 || /何|より/.test(trait)) return undefined;
    const cat = m[2] === '生き物' ? '動物' : m[2];
    try {
      const entries = japaneseDictionaryService.listPersonal()
        .filter((e: any) => e.gloss && Array.isArray(e.semanticIds) && e.semanticIds.includes('learned:user-taught'))
        .filter((e: any) => this.taughtScopeMatch(e, cat));
      const hits = entries.filter((e: any) => String(e.gloss).includes(trait));
      const names = [...new Set(hits.map((e: any) => String(e.surface)))];
      if (names.length === 0) return `${trait}${m[2]}は、まだ教わっていないです。`;
      return `${trait}${m[2]}は、${names.length}種類です。${names.map((n) => `「${n}」`).join('と')}です。`;
    } catch { return undefined; }
  }

  private taughtListAnswer(prompt: string): string | undefined {
    // P761: 「全部合わせると何キロ？」は合計の計算であって一覧では
    // ない。「全部」が両方のゲートに掛かるため、計算の形を除く。
    if (/(?:合わせると|合計)/.test(prompt)) return undefined;
    if (!/(?:教えた|教えてくれた|教えてあげた)/.test(prompt)) return undefined;
    if (!/(?:全部|全て|一覧|言って|挙げて|何を|何が|どんな|何種類|何個|何匹|いくつ)/.test(prompt) && !/(?:今まで|これまで)/.test(prompt)) return undefined;
    try {
      const entries = japaneseDictionaryService.listPersonal()
        .filter((e: any) => e.gloss && Array.isArray(e.semanticIds) && e.semanticIds.includes('learned:user-taught'));
      if (entries.length === 0) return 'まだ何も教わっていないと思います。';
      const categoryMatch = prompt.match(/(生き物|動物|鳥|魚|虫|植物|食べ物|飲み物|場所|乗り物|道具)/);
      let scoped = entries;
      if (categoryMatch) {
        const cat = categoryMatch[1] === '生き物' ? '動物' : categoryMatch[1];
        scoped = entries.filter((e: any) => this.taughtScopeMatch(e, cat));
        if (scoped.length === 0) return `${categoryMatch[1]}で教わったものは、まだ無いです。`;
      }
      // P742: 新しい順に、同名は1回だけ、言い方の断片が混ざった
      // 登録（「〜っていうの」等）は除いて並べる。古い登録から
      // 並べると、件数の上限で最近の話題が落ちてしまう。
      const seenNames = new Set<string>();
      const allNames: string[] = [];
      for (const e of [...scoped].reverse()) {
        const name = String((e as any).surface || '');
        if (!name || seenNames.has(name)) continue;
        if (/(?:っていうの|というの|のこと)$/.test(name)) continue;
        seenNames.add(name);
        allNames.push(name);
      }
      const names = allNames.slice(0, 12);
      const tail = allNames.length > names.length ? 'など' : '';
      // P748: 「何種類教えた？」には数も答える。
      if (/(?:何種類|何個|何匹|いくつ)/.test(prompt)) {
        return `あなたに教わったのは、全部で${allNames.length}種類です。${names.join('と')}${tail}です。`;
      }
      return `あなたに教わったのは、${names.join('と')}${tail}です。`;
    } catch { return undefined; }
  }

  /**
   * P735: 「教えた動物の中で一番大きいのは？」に、個人辞書の
   * 説明文の手がかり（大きい・小さい等）で最上級に答える。
   * 手がかりが同点・皆無なら決められないと正直に言う。
   */
  /**
   * P757: テキスト（説明・事実の値）から重さ・大きさの実測値を
   * 抜き出す共有ヘルパー。単位は基準単位（キロ／センチ）に
   * そろえた数値と、表示用の原文断片を返す。
   */
  private measureFromText(text: string, label: '重さ' | '大きさ' | '寿命'): { value: number; disp: string } | undefined {
    if (!text) return undefined;
    // P760: 寿命も物差しに加える（単位は年）。
    if (label === '寿命') {
      const m = String(text).match(/(\d+(?:\.\d+)?)\s*(?:年|歳)(?:くらい|ほど)?/);
      return m ? { value: parseFloat(m[1]), disp: m[0] } : undefined;
    }
    const pats: Array<{ re: RegExp; f: (n: number) => number }> = label === '重さ'
      ? [
          { re: /(\d+(?:\.\d+)?)\s*(?:トン)(?:くらい|ほど)?/, f: (n) => n * 1000 },
          { re: /(\d+(?:\.\d+)?)\s*(?:キログラム|キロ|kg)(?:くらい|ほど)?/i, f: (n) => n },
          { re: /(\d+(?:\.\d+)?)\s*(?:グラム|g)(?:くらい|ほど)?/i, f: (n) => n / 1000 },
        ]
      : [
          { re: /(\d+(?:\.\d+)?)\s*(?:メートル|m)(?:くらい|ほど)?/i, f: (n) => n * 100 },
          { re: /(\d+(?:\.\d+)?)\s*(?:センチメートル|センチ|cm)(?:くらい|ほど)?/i, f: (n) => n },
        ];
    for (const p of pats) {
      const m = String(text).match(p.re);
      if (m) return { value: p.f(parseFloat(m[1])), disp: m[0] };
    }
    return undefined;
  }

  /**
   * P793: 「みんなで一番背が高いのは誰？」「一番年上なのは？」——
   * 人の属性の事実全体から最上位を決める（説明文の一番はP735）。
   */
  private factSuperlativeAnswer(prompt: string, memories: any[] = []): string | undefined {
    if (!/一番/.test(prompt)) return undefined;
    let attr = ''; let label: '重さ' | '大きさ' | '年齢' = '年齢'; let minus = false; let cue = '';
    if (/背が高/.test(prompt)) { attr = '身長'; label = '大きさ'; cue = '背が高い'; }
    else if (/背が低/.test(prompt)) { attr = '身長'; label = '大きさ'; minus = true; cue = '背が低い'; }
    else if (/年上/.test(prompt)) { attr = '年齢'; label = '年齢'; cue = '年上'; }
    else if (/年下/.test(prompt)) { attr = '年齢'; label = '年齢'; minus = true; cue = '年下'; }
    else if (/重い/.test(prompt)) { attr = '体重'; label = '重さ'; cue = '重い'; }
    else if (/軽い/.test(prompt)) { attr = '体重'; label = '重さ'; minus = true; cue = '軽い'; }
    else return undefined;
    const selfSet = new Set(['僕', '私', '俺', 'わたし', 'あたし']);
    const byEntity = new Map<string, { v: number; disp: string }>();
    for (const mm of memories || []) {
      if (!mm || mm.active === false || mm.replacedBy) continue;
      if (String(mm.factAttribute || '') !== attr) continue;
      const rawEntity = String(mm.factEntity || '');
      if (!rawEntity) continue;
      const name = selfSet.has(rawEntity) ? '僕' : rawEntity;
      if (label === '年齢') {
        const n = Number(String(mm.factValue || '').match(/(\d+(?:\.\d+)?)/)?.[1]);
        if (Number.isFinite(n)) byEntity.set(name, { v: n, disp: `${n}歳` });
      } else {
        const mv = this.measureFromText(String(mm.factValue || ''), label);
        if (mv) byEntity.set(name, { v: mv.value, disp: mv.disp });
      }
    }
    if (byEntity.size < 2) return undefined;
    const entries = [...byEntity.entries()].map(([name, m]) => ({ name, ...m }));
    entries.sort((a, b) => (minus ? a.v - b.v : b.v - a.v));
    const top = entries[0];
    return `一番${cue}のは${top.name}です（${top.disp}）。`;
  }

  private glossSuperlativeAnswer(prompt: string): string | undefined {
    if (!/(?:一番|いちばん|最も|もっとも)/.test(prompt)) return undefined;
    const dims: Array<{ re: RegExp; label: string; plus: RegExp; minus: RegExp; want: 1 | -1 }> = [
      { re: /大きい/, label: '大きい', plus: /大き|でか/, minus: /小さ|小柄/, want: 1 },
      { re: /小さい/, label: '小さい', plus: /大き|でか/, minus: /小さ|小柄/, want: -1 },
      { re: /重い/, label: '重い', plus: /重/, minus: /軽/, want: 1 },
      { re: /軽い/, label: '軽い', plus: /重/, minus: /軽/, want: -1 },
      { re: /速い|早い/, label: '速い', plus: /速|俊敏/, minus: /遅|のろ/, want: 1 },
      { re: /遅い/, label: '遅い', plus: /速|俊敏/, minus: /遅|のろ/, want: -1 },
      { re: /長生き/, label: '長生き', plus: /長生き|長寿/, minus: /短命/, want: 1 },
    ];
    const dim = dims.find((d) => d.re.test(prompt));
    if (!dim) return undefined;
    try {
      const categoryMatch = prompt.match(/(生き物|動物|鳥|魚|虫|植物|食べ物|飲み物)/);
      const cat = categoryMatch ? (categoryMatch[1] === '生き物' ? '動物' : categoryMatch[1]) : '';
      const entries = japaneseDictionaryService.listPersonal()
        .filter((e: any) => e.gloss)
        .filter((e: any) => !cat || this.taughtScopeMatch(e, cat));
      if (entries.length === 0) return undefined;
      // P757: 重さ・大きさは、手がかり語より先に実測値で一番を
      // 決める（P756の比較と同じ物差し）。数値が1件だけなら、
      // 一番とは言い切らず、その旨を正直に言う。
      const measureLabel = dim.label === '重い' || dim.label === '軽い' ? '重さ' : dim.label === '大きい' || dim.label === '小さい' ? '大きさ' : dim.label === '長生き' ? '寿命' : undefined;
      if (measureLabel) {
        const measured = entries
          .map((e: any) => ({ name: String(e.surface), meas: this.measureFromText(String(e.gloss), measureLabel) }))
          .filter((x) => x.meas);
        if (measured.length >= 2) {
          const vals = measured.map((x) => x.meas!.value);
          const best = dim.want === 1 ? Math.max(...vals) : Math.min(...vals);
          const tops = measured.filter((x) => x.meas!.value === best);
          if (tops.length > 1) return `一番${dim.label}ものは、${tops.map((t) => `「${t.name}」（${t.meas!.disp}）`).join('と')}が同じくらいです。`;
          return `教わった説明の中では、「${tops[0].name}」が一番${dim.label}です（${tops[0].meas!.disp}）。`;
        }
        if (measured.length === 1) {
          return `${measureLabel}の数値が分かっているのは「${measured[0].name}」（${measured[0].meas!.disp}）だけなので、一番${dim.label}ものはまだ決められないです。`;
        }
      }
      const scored = entries.map((e: any) => {
        const g = String(e.gloss);
        const cue = dim.plus.test(g) ? 1 : dim.minus.test(g) ? -1 : 0;
        return { name: String(e.surface), cue: cue * dim.want, taught: Array.isArray(e.semanticIds) && e.semanticIds.includes('learned:user-taught') };
      }).filter((s) => s.cue !== 0);
      if (scored.length === 0) return `${dim.label}ものの手がかりが説明に無くて、一番は決められないです。`;
      const top = Math.max(...scored.map((s) => s.cue));
      const winners = scored.filter((s) => s.cue === top);
      if (winners.length > 1) return `一番${dim.label}ものは、${winners.map((w) => w.name).join('と')}が同じくらいだと思います。`;
      const srcNote = winners[0].taught ? '教わった説明の中では' : '覚えている説明の中では';
      return `${srcNote}、「${winners[0].name}」が一番${dim.label}と思います。`;
    } catch { return undefined; }
  }

  /**
   * P758: 「教えた動物を重い順に並べて」「2番目に重いのは？」——
   * 実測値（P757の物差し）で並べ替えと順位に答える。数値の無い
   * ものは除いた旨を添える。
   */
  private taughtRankingAnswer(prompt: string): string | undefined {
    const rankM = prompt.match(/([1-9]|[一二三四五])番目/);
    const rankingForm = /(?:並べて|順に|順番)/.test(prompt);
    if (!rankM && !rankingForm) return undefined;
    const dimSpec: Array<{ re: RegExp; measureLabel: '重さ' | '大きさ' | '寿命'; adj: string; asc: boolean }> = [
      { re: /重い/, measureLabel: '重さ', adj: '重い', asc: false },
      { re: /軽い/, measureLabel: '重さ', adj: '軽い', asc: true },
      { re: /大きい/, measureLabel: '大きさ', adj: '大きい', asc: false },
      { re: /小さい/, measureLabel: '大きさ', adj: '小さい', asc: true },
      { re: /長生き/, measureLabel: '寿命', adj: '長生き', asc: false },
    ];
    const dim = dimSpec.find((d) => d.re.test(prompt));
    if (!dim) return undefined;
    try {
      const categoryMatch = prompt.match(/(生き物|動物|鳥|魚|虫|植物|食べ物|飲み物)/);
      const cat = categoryMatch ? (categoryMatch[1] === '生き物' ? '動物' : categoryMatch[1]) : '';
      const entries = japaneseDictionaryService.listPersonal()
        .filter((e: any) => e.gloss)
        .filter((e: any) => !cat || this.taughtScopeMatch(e, cat));
      if (entries.length === 0) return undefined;
      const measured = entries
        .map((e: any) => ({ name: String(e.surface), meas: this.measureFromText(String(e.gloss), dim.measureLabel) }))
        .filter((x) => x.meas)
        .sort((a, b) => (dim.asc ? a.meas!.value - b.meas!.value : b.meas!.value - a.meas!.value));
      const unmeasured = entries.length - measured.length;
      const tail = unmeasured > 0 ? `（${dim.measureLabel}の数値が分からないものは除いています）` : '';
      if (rankM) {
        const rankMap: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5 };
        const rank = rankMap[rankM[1]] ?? parseInt(rankM[1], 10);
        if (measured.length < rank) {
          return measured.length === 0
            ? `${dim.measureLabel}の数値が分かるものがまだ無いので、順位は付けられないです。`
            : `${dim.measureLabel}の数値が分かっているのは${measured.length}つだけなので、${rank}番目はまだ分からないです。`;
        }
        const pick = measured[rank - 1];
        return `${rank}番目に${dim.adj}のは「${pick.name}」です（${pick.meas!.disp}）。${tail}`;
      }
      if (measured.length < 2) return undefined;
      const items = measured.map((x) => `「${x.name}」（${x.meas!.disp}）`).join('、');
      return `${dim.adj}順だと、${items}です。${tail}`;
    } catch { return undefined; }
  }

  /**
   * P759: 「オオモとカワモ、何キロ差がある？」——二つの実測値の
   * 差を計算して答える（P743の属性想起は片方の値しか言えなかった）。
   */
  /**
   * P792: 「僕と妹、何歳違う？」「身長何センチ違う？」——人の
   * 属性の事実同士の差。説明文の差（P759）とは別に事実を見る。
   */
  private factDifferenceAnswer(prompt: string, memories: any[] = []): string | undefined {
    // P817: 「相方は僕より何歳若い？」のような向きつきの差も受ける
    // （「違う・差」が無いと彼女自身の年齢の受け答えに流れていた）。
    const directedAge = /より/.test(prompt) && /何歳/.test(prompt) && /(?:若い|年上|年下)/.test(prompt);
    if (!/(?:違う|差)/.test(prompt) && !directedAge) return undefined;
    let attr = ''; let label: '重さ' | '大きさ' | '年齢' = '年齢'; let unit = '歳';
    if (/何歳|歳の差|年齢/.test(prompt)) { attr = '年齢'; label = '年齢'; unit = '歳'; }
    else if (/身長/.test(prompt)) { attr = '身長'; label = '大きさ'; unit = 'センチ'; }
    else if (/体重/.test(prompt)) { attr = '体重'; label = '重さ'; unit = 'キロ'; }
    // P837: 「年の差は？」のように年の字で聞く形も年齢の差として
    // 受ける（従来は手がかり無しで打ち切っていた）。
    else if (/年の差/.test(prompt)) { attr = '年齢'; label = '年齢'; unit = '歳'; }
    else return undefined;
    const selfSet = new Set(['僕', '私', '俺', 'わたし', 'あたし']);
    // P837: 属性なしで保存された数値の事実（「僕は30歳だよ」）の
    // 属性を、値の単位から読むための対応。
    const unitRe = attr === '年齢' ? /歳|才/ : attr === '身長' ? /センチ|メートル|cm/ : /キロ|kg/;
    const valueOf = (name: string): number | undefined => {
      const targets = selfSet.has(name) ? [...selfSet] : [name];
      const fact = (memories || []).find((mm: any) => mm && mm.active !== false && !mm.replacedBy
        && (String(mm.factAttribute || '') === attr || (!mm.factAttribute && unitRe.test(String(mm.factValue || ''))))
        && targets.includes(String(mm.factEntity || ''))
        && /\d/.test(String(mm.factValue || '')));
      if (!fact) return undefined;
      if (label === '年齢') {
        const n = Number(String(fact.factValue).match(/(\d+(?:\.\d+)?)/)?.[1]);
        return Number.isFinite(n) ? n : undefined;
      }
      return this.measureFromText(String(fact.factValue), label)?.value;
    };
    const tokens = utteranceFeatureService.analyze(prompt).contentTokens
      .filter((w: string) => w.length >= 1 && !/^(?:何歳|何|違う|差|身長|体重|年齢)$/.test(w));
    const found: Array<{ name: string; v: number }> = [];
    for (const t of tokens) {
      const v = valueOf(t);
      if (v !== undefined && !found.some((f) => f.name === t)) found.push({ name: t, v });
      if (found.length >= 2) break;
    }
    // P813: 「2人の年齢の差は？」のように人数だけで指す形は、その
    // 属性を持つ人がちょうど2人なら、その2人で差を出す。
    // P837: 誰も名指されていない続きの形（「年の差は？」）も同じ。
    // 名指しが1人でもある時は、指されていない相手を勝手に
    // 補わない（別の未知の相手との差かもしれないため）。
    if (found.length < 2 && (/(?:2人|二人|ふたり)/.test(prompt) || found.length === 0)) {
      const byEntity = new Map<string, number>();
      for (const mm of (memories || [])) {
        if (!mm || mm.active === false || mm.replacedBy) continue;
        const fa = String(mm.factAttribute || '');
        if (fa ? fa !== attr : !unitRe.test(String(mm.factValue || ''))) continue;
        const ent = String(mm.factEntity || '');
        if (!ent) continue;
        const key = selfSet.has(ent) ? '僕' : ent;
        if (byEntity.has(key)) continue;
        const v = valueOf(ent);
        if (v !== undefined) byEntity.set(key, v);
      }
      if (byEntity.size === 2) {
        const rows = [...byEntity.entries()].map(([name, v]) => ({ name, v }));
        found.length = 0;
        found.push(rows[0], rows[1]);
      }
    }
    if (found.length < 2) return undefined;
    const diff = Math.abs(found[0].v - found[1].v);
    const diffDisp = Number.isInteger(diff) ? String(diff) : String(Math.round(diff * 10) / 10);
    // P817: 向きつきの答え。向きが事実と逆の時は、正して答える。
    if (directedAge) {
      const a = found[0]; const b = found[1];
      if (diff === 0) return `${a.name}と${b.name}は、同じ年齢です。`;
      const aYounger = a.v < b.v;
      if (/(?:若い|年下)/.test(prompt)) {
        return aYounger
          ? `${a.name}は${b.name}より${diffDisp}${unit}若いです。`
          : `${a.name}は${b.name}より若くはなくて、${diffDisp}${unit}年上です。`;
      }
      return aYounger
        ? `${a.name}は${b.name}より年上ではなくて、${diffDisp}${unit}年下です。`
        : `${a.name}は${b.name}より${diffDisp}${unit}年上です。`;
    }
    if (diff === 0) return `${found[0].name}と${found[1].name}は、${attr}は同じです。`;
    return `${found[0].name}と${found[1].name}は、${diffDisp}${unit}違います。`;
  }

  private measureDifferenceAnswer(prompt: string, state?: any, recentMessages: ChatMessage[] = []): string | undefined {
    if (!/(?:差|違い)/.test(prompt)) return undefined;
    if (!/(?:何キロ|何センチ|どれくらい|どのくらい|何グラム|何年)/.test(prompt)) return undefined;
    // P770: 寿命の差（何年）も同じ物差しで引ける。
    const label: '重さ' | '大きさ' | '寿命' = /(?:寿命|何年)/.test(prompt) ? '寿命' : /(?:センチ|メートル)/.test(prompt) ? '大きさ' : '重さ';
    let tokens: string[] = [];
    try { tokens = utteranceFeatureService.analyze(prompt).contentTokens || []; } catch { return undefined; }
    const ents: Array<{ name: string; meas: { value: number; disp: string } }> = [];
    for (const t of tokens) {
      if (!t || ents.some((e) => e.name === t)) continue;
      let gloss = '';
      try { gloss = String(japaneseDictionaryService.lookup(t).find((e: any) => e.gloss)?.gloss || ''); } catch { /* 補助判定 */ }
      if (!gloss) continue;
      const meas = this.measureFromText(gloss, label);
      if (meas) ents.push({ name: t, meas });
      if (ents.length >= 2) break;
    }
    if (ents.length < 2) {
      // P835: 対と次元が省略された続きの差の質問（「差はどれくらい？」）
      // は、直近に話した2つと、両方に実測値がある次元で受ける。
      try {
        const cands = this.recentTopicCandidates(state, recentMessages);
        const labels: Array<'重さ' | '大きさ' | '寿命'> = [label, '重さ', '大きさ', '寿命'];
        for (const lab of labels) {
          const pair: Array<{ name: string; meas: { value: number; disp: string } }> = [];
          for (const c of cands) {
            if (!c || pair.some((e) => e.name === c)) continue;
            let gloss = '';
            try { gloss = String(japaneseDictionaryService.lookup(c).find((e: any) => e.gloss)?.gloss || ''); } catch { /* 補助判定 */ }
            if (!gloss) continue;
            const meas = this.measureFromText(gloss, lab);
            if (meas) pair.push({ name: c, meas });
            if (pair.length >= 2) break;
          }
          if (pair.length >= 2) {
            const [a, b] = pair;
            const diff = Math.abs(a.meas.value - b.meas.value);
            const unit = lab === '寿命' ? '年' : lab === '重さ' ? 'キロ' : 'センチ';
            const diffText = lab === '重さ' && diff < 1 ? `${Math.round(diff * 1000)}グラム` : `${Number.isInteger(diff) ? diff : Math.round(diff * 10) / 10}${unit}`;
            return `「${a.name}」は${a.meas.disp}、「${b.name}」は${b.meas.disp}なので、差は${diffText}です。`;
          }
        }
      } catch { /* 補助経路 */ }
      return undefined;
    }
    const [a, b] = ents;
    const diff = Math.abs(a.meas.value - b.meas.value);
    const unit = label === '寿命' ? '年' : label === '重さ' ? 'キロ' : 'センチ';
    const diffText = label === '重さ' && diff < 1 ? `${Math.round(diff * 1000)}グラム` : `${Number.isInteger(diff) ? diff : Math.round(diff * 10) / 10}${unit}`;
    return `「${a.name}」は${a.meas.disp}、「${b.name}」は${b.meas.disp}なので、差は${diffText}です。`;
  }

  /**
   * P759: 「30キロより重い動物はいる？」——閾値で絞って答える。
   * 実測値の物差し（P756〜）があれば、範囲の質問にも使える。
   */
  /**
   * P783: 「10キロから20キロの間の動物は？」——範囲で絞る。
   * 閾値（P759）の両側版。単位から次元を決め、範囲内のものを挙げる。
   */
  private measureRangeAnswer(prompt: string): string | undefined {
    const m = prompt.match(/(\d+(?:\.\d+)?)\s*(トン|キログラム|キロ|グラム|kg|g)?\s*から\s*(\d+(?:\.\d+)?)\s*(トン|キログラム|キロ|グラム|kg|g|センチメートル|センチ|メートル|cm|m|年|歳)?\s*の間/);
    if (!m) return undefined;
    if (!/[？?]|は$|いる|ある/.test(prompt)) return undefined;
    const unit2 = m[4] || m[2] || '';
    let label: '重さ' | '大きさ' | '寿命' = '重さ';
    let conv = (v: number, u: string) => (u === 'トン' ? v * 1000 : (u === 'グラム' || u === 'g') ? v / 1000 : v);
    if (/センチ|メートル|cm|m/.test(unit2)) { label = '大きさ'; conv = (v: number, u: string) => (u === 'メートル' || u === 'm') ? v * 100 : v; }
    if (unit2 === '年' || unit2 === '歳') { label = '寿命'; conv = (v: number) => v; }
    const lo = Math.min(conv(Number(m[1]), m[2] || unit2), conv(Number(m[3]), unit2));
    const hi = Math.max(conv(Number(m[1]), m[2] || unit2), conv(Number(m[3]), unit2));
    const catM = prompt.match(/(動物|鳥|魚|虫|植物|生き物)/);
    const cat = catM ? catM[1] : undefined;
    const hits: Array<{ name: string; v: number }> = [];
    for (const e of japaneseDictionaryService.listPersonal() as any[]) {
      const gloss = String(e?.gloss || '');
      if (!gloss || !e?.surface) continue;
      if (cat && !this.taughtScopeMatch(e, cat)) continue;
      const mv = this.measureFromText(gloss, label);
      if (!mv) continue;
      if (mv.value >= lo && mv.value <= hi) hits.push({ name: String(e.surface), v: mv.value });
    }
    if (hits.length === 0) return `その範囲の${cat || 'もの'}は、今知っている中にはいないです。`;
    hits.sort((a, b) => a.v - b.v);
    const unitLabel = label === '重さ' ? 'キロ' : label === '大きさ' ? 'センチ' : '年';
    return `${lo}${unitLabel}から${hi}${unitLabel}の間なのは、${hits.map((h) => `「${h.name}」`).join('と')}です。`;
  }

  /**
   * P784: 「予定、何個ある？」——控えの件数を答える。
   */
  private planCountAnswer(prompt: string): string | undefined {
    if (!/(?:予定|予約|約束)/.test(prompt)) return undefined;
    if (!/(?:何個|いくつ|何件|何つ)/.test(prompt)) return undefined;
    if (!/[？?]/.test(prompt) && !/(?:ある|教えて)/.test(prompt)) return undefined;
    try {
      const raw = storageService.getItem('miki_user_plans_v1');
      const plans: Array<{ when: string; text: string; date?: string }> = raw ? JSON.parse(raw) : [];
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const live = plans.filter((p) => !p.date || p.date >= todayKey);
      if (live.length === 0) return '今は予定を聞いていないです。';
      // P824: 範囲つきの件数（「今週の予定は何件？」）は、その範囲で
      // 数える。従来は範囲を無視して全体の件数か、想起の「まだ
      // 聞いていない」に化けていた。
      const scopeM = prompt.match(/(再来週|来週|今週|週末|来月|今月|明後日|明日|今日)/);
      if (scopeM) {
        const scope = scopeM[1];
        const fmtD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayMs = 86400000;
        const dow = now.getDay();
        const thisSunday = new Date(now.getTime() + ((7 - dow) % 7) * dayMs);
        let inScope: (p: { when: string; date?: string }) => boolean;
        if (scope === '今週') inScope = (p) => p.date ? (p.date >= todayKey && p.date <= fmtD(thisSunday)) : p.when === scope;
        else if (scope === '来週') inScope = (p) => p.date ? (p.date > fmtD(thisSunday) && p.date <= fmtD(new Date(thisSunday.getTime() + 7 * dayMs))) : p.when === scope;
        else if (scope === '再来週') inScope = (p) => p.date ? (p.date > fmtD(new Date(thisSunday.getTime() + 7 * dayMs)) && p.date <= fmtD(new Date(thisSunday.getTime() + 14 * dayMs))) : p.when === scope;
        else if (scope === '週末') {
          let satDelta = (6 - dow + 7) % 7; if (dow === 0) satDelta = -1;
          const sat = fmtD(new Date(now.getTime() + satDelta * dayMs));
          const sun = fmtD(new Date(now.getTime() + (satDelta + 1) * dayMs));
          inScope = (p) => p.date ? (p.date === sat || p.date === sun) : p.when === scope;
        }
        else if (scope === '今月') inScope = (p) => p.date ? p.date.slice(0, 7) === todayKey.slice(0, 7) : p.when === scope;
        else if (scope === '来月') {
          const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          const nmKey = `${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, '0')}`;
          inScope = (p) => p.date ? p.date.slice(0, 7) === nmKey : p.when === scope;
        }
        else {
          const off = scope === '明日' ? 1 : scope === '明後日' ? 2 : 0;
          const target = fmtD(new Date(now.getTime() + off * dayMs));
          inScope = (p) => p.date ? p.date === target : p.when === scope;
        }
        const n = live.filter(inScope).length;
        return `${scope}の予定は${n}件です。`;
      }
      return `予定は${live.length}件あります。`;
    } catch { return undefined; }
  }

  private measureThresholdAnswer(prompt: string): string | undefined {
    const thrM = prompt.match(/(\d+(?:\.\d+)?)\s*(トン|キログラム|キロ|グラム|センチメートル|センチ|メートル|kg|cm|m)/i);
    if (!thrM) {
      // P769: 「アカモより重い鳥はいる？」——数値ではなく、知って
      // いるものの実測値を基準にする相対しきい値。
      const relM = prompt.match(/([一-龠ァ-ヶー]{2,10}?)より(重い|軽い|大きい|小さい|長生き)/);
      if (!relM) return undefined;
      if (!/(?:いる|ある|いない|教えて)/.test(prompt) && !/[？?]/.test(prompt)) return undefined;
      const base = relM[1].replace(/^(?:教えた|その|この)/, '');
      const adj = relM[2];
      const label: '重さ' | '大きさ' | '寿命' = adj === '長生き' ? '寿命' : (adj === '重い' || adj === '軽い') ? '重さ' : '大きさ';
      const greater = adj === '重い' || adj === '大きい' || adj === '長生き';
      try {
        const entries = japaneseDictionaryService.listPersonal().filter((e: any) => e.gloss);
        const baseEntry = entries.find((e: any) => String(e.surface) === base);
        if (!baseEntry) return undefined;
        const baseMeas = this.measureFromText(String(baseEntry.gloss), label);
        if (!baseMeas) return undefined;
        const categoryMatch = prompt.match(/(生き物|動物|鳥|魚|虫|植物|食べ物|飲み物)/);
        const cat = categoryMatch ? (categoryMatch[1] === '生き物' ? '動物' : categoryMatch[1]) : '';
        const hits = entries
          .filter((e: any) => String(e.surface) !== base)
          .filter((e: any) => !cat || this.taughtScopeMatch(e, cat))
          .map((e: any) => ({ name: String(e.surface), meas: this.measureFromText(String(e.gloss), label) }))
          .filter((x) => x.meas && (greater ? x.meas!.value > baseMeas.value : x.meas!.value < baseMeas.value));
        if (hits.length === 0) return `今知っている中では、「${base}」より${adj}ものはいないです。`;
        const names = hits.slice(0, 4).map((x) => `「${x.name}」（${x.meas!.disp}）`).join('、');
        // P771: 数を聞かれたら数から答える。
        if (/(?:何種類|何匹|何個|いくつ)/.test(prompt)) return `${hits.length}種類います。${names}です。`;
        return `います。${names}です。`;
      } catch { return undefined; }
    }
    const dirM = prompt.match(/(?:より|超える|以上|以下|未満)/);
    if (!dirM) return undefined;
    const unit = thrM[2];
    const label: '重さ' | '大きさ' = /(?:トン|キロ|グラム|kg)/i.test(unit) ? '重さ' : '大きさ';
    const thr = this.measureFromText(`${thrM[1]}${unit}`, label);
    if (!thr) return undefined;
    const greater = /(?:より重い|より大きい|超える|以上)/.test(prompt);
    const lesser = /(?:より軽い|より小さい|以下|未満)/.test(prompt);
    if (!greater && !lesser) return undefined;
    const inclusive = /(?:以上|以下)/.test(prompt);
    try {
      const categoryMatch = prompt.match(/(生き物|動物|鳥|魚|虫|植物|食べ物|飲み物)/);
      const cat = categoryMatch ? (categoryMatch[1] === '生き物' ? '動物' : categoryMatch[1]) : '';
      const entries = japaneseDictionaryService.listPersonal()
        .filter((e: any) => e.gloss)
        .filter((e: any) => !cat || this.taughtScopeMatch(e, cat));
      const measured = entries
        .map((e: any) => ({ name: String(e.surface), meas: this.measureFromText(String(e.gloss), label) }))
        .filter((x) => x.meas);
      if (measured.length === 0) return undefined;
      const hits = measured.filter((x) => greater
        ? (inclusive ? x.meas!.value >= thr.value : x.meas!.value > thr.value)
        : (inclusive ? x.meas!.value <= thr.value : x.meas!.value < thr.value));
      const adjWord = label === '重さ' ? (greater ? '重い' : '軽い') : (greater ? '大きい' : '小さい');
      if (hits.length === 0) return `今知っている中では、${thr.disp}より${adjWord}ものはいないです。`;
      const names = hits.slice(0, 4).map((x) => `「${x.name}」（${x.meas!.disp}）`).join('、');
      if (/(?:何種類|何匹|何個|いくつ)/.test(prompt)) return `${hits.length}種類います。${names}です。`;
      return `います。${names}です。`;
    } catch { return undefined; }
  }

  /**
   * P761: 「教えた動物の平均の重さは？」「全部合わせると何キロ？」
   * ——実測値の合計と平均。数値の無いものは対象外と添える。
   */
  /** P795: 「身長160センチ以上の人は誰？」——人の事実を閾値で絞る。 */
  private factThresholdAnswer(prompt: string, memories: any[] = []): string | undefined {
    const tm = prompt.match(/(\d+(?:\.\d+)?)\s*(センチメートル|センチ|メートル|キログラム|キロ|グラム|トン|歳|年)/);
    if (!tm) return undefined;
    if (!/(?:以上|以下|未満|超|より)/.test(prompt)) return undefined;
    const got = this.factAttributeValues(prompt, memories);
    if (!got) return undefined;
    const label = got.attr === '身長' ? '大きさ' : got.attr === '体重' ? '重さ' : '年齢';
    const thr = label === '年齢'
      ? Number(tm[1])
      : this.measureFromText(`${tm[1]}${tm[2]}`, label as '重さ' | '大きさ')?.value;
    if (thr === undefined || !Number.isFinite(thr)) return undefined;
    let keep: (v: number) => boolean;
    if (/未満|より小さい|より低い|より軽い|より若い/.test(prompt)) keep = (v) => v < thr;
    else if (/以下/.test(prompt)) keep = (v) => v <= thr;
    else if (/超/.test(prompt) && !/以上/.test(prompt)) keep = (v) => v > thr;
    else keep = (v) => v >= thr;
    const hits = got.rows.filter((r) => keep(r.v));
    if (hits.length === 0) return '今知っている中では、条件に合う人はいないです。';
    const names = hits.map((r) => `「${r.name}」`).join('と');
    if (/(?:何人|何名)/.test(prompt)) return `${hits.length}人です。${names}です。`;
    return `${names}です。`;
  }

  /** P794: 人の属性の事実を集める（順位・平均用）。 */
  private factAttributeValues(prompt: string, memories: any[]): { attr: string; unit: string; rows: Array<{ name: string; v: number; disp: string }>; minus: boolean; cueLabel: string } | undefined {
    let attr = ''; let label: '重さ' | '大きさ' | '年齢' = '年齢'; let unit = '歳'; let minus = false; let cueLabel = '';
    if (/背が高|身長/.test(prompt)) { attr = '身長'; label = '大きさ'; unit = 'センチ'; cueLabel = '背が高い'; if (/背が低/.test(prompt)) { minus = true; cueLabel = '背が低い'; } }
    else if (/年上|年下|年齢/.test(prompt)) { attr = '年齢'; label = '年齢'; unit = '歳'; cueLabel = '年上'; if (/年下/.test(prompt)) { minus = true; cueLabel = '年下'; } }
    // P817: 「30歳以上は何人？」のように単位の「歳」だけで年齢を
    // 指す形も、年齢の事実で受ける（従来は属性が取れずに流れていた）。
    else if (/歳/.test(prompt)) { attr = '年齢'; label = '年齢'; unit = '歳'; cueLabel = '年上'; }
    else if (/重|軽|体重/.test(prompt)) { attr = '体重'; label = '重さ'; unit = 'キロ'; cueLabel = '重い'; if (/軽/.test(prompt) && !/重/.test(prompt)) { minus = true; cueLabel = '軽い'; } }
    // P826: 「合わせて何キロ？」のように単位だけで指す形は、人の
    // 体重の事実で受ける（属性の手がかりが単位しか無かった）。
    else if (/キロ/.test(prompt)) { attr = '体重'; label = '重さ'; unit = 'キロ'; cueLabel = '重い'; }
    else return undefined;
    const selfSet = new Set(['僕', '私', '俺', 'わたし', 'あたし']);
    const byEntity = new Map<string, { v: number; disp: string }>();
    for (const mm of memories || []) {
      if (!mm || mm.active === false || mm.replacedBy) continue;
      if (String(mm.factAttribute || '') !== attr) continue;
      const rawEntity = String(mm.factEntity || '');
      if (!rawEntity) continue;
      const name = selfSet.has(rawEntity) ? '僕' : rawEntity;
      if (label === '年齢') {
        const n = Number(String(mm.factValue || '').match(/(\d+(?:\.\d+)?)/)?.[1]);
        if (Number.isFinite(n)) byEntity.set(name, { v: n, disp: `${n}歳` });
      } else {
        const mv = this.measureFromText(String(mm.factValue || ''), label);
        if (mv) byEntity.set(name, { v: mv.value, disp: mv.disp });
      }
    }
    if (byEntity.size < 2) return undefined;
    return { attr, unit, rows: [...byEntity.entries()].map(([name, m]) => ({ name, ...m })), minus, cueLabel };
  }

  /** P794: 「背が高い順に並べて」——人の事実で並べる。 */
  private factRankingAnswer(prompt: string, memories: any[] = []): string | undefined {
    if (!/(?:順に並べて|順で並べて|並べて|並び替えて)/.test(prompt)) return undefined;
    const got = this.factAttributeValues(prompt, memories);
    if (!got) return undefined;
    const rows = [...got.rows].sort((a, b) => (got.minus ? a.v - b.v : b.v - a.v));
    return `${got.cueLabel}順だと、${rows.map((r) => `${r.name}（${r.disp}）`).join('、')}です。`;
  }

  /** P794: 「みんなの平均身長は？」——人の事実で平均する。 */
  private factAggregateAnswer(prompt: string, memories: any[] = []): string | undefined {
    // P817: 合計（「3人の年齢を合わせると何歳？」）も人の事実で
    // 数える。平均だけだったため、彼女自身の年齢の受け答えに
    // 流れていた。
    // P826: 「合わせて何キロ？」の「合わせて」形も合計として受ける。
    const isSum = /(?:合わせると|合わせて|合計|全部合わせ|ぜんぶ合わせ)/.test(prompt);
    if (!/平均/.test(prompt) && !isSum) return undefined;
    const got = this.factAttributeValues(prompt, memories);
    if (!got) return undefined;
    if (isSum) {
      const sum = got.rows.reduce((s, r) => s + r.v, 0);
      const sumDisp = Number.isInteger(sum) ? String(sum) : String(Math.round(sum * 10) / 10);
      return `${got.rows.length}人の${got.attr}を合わせると${sumDisp}${got.unit}です。`;
    }
    const avg = got.rows.reduce((s, r) => s + r.v, 0) / got.rows.length;
    const disp = Number.isInteger(avg) ? String(avg) : String(Math.round(avg * 10) / 10);
    return `平均${got.attr}は約${disp}${got.unit}です（${got.rows.length}人分）。`;
  }

  /** P824: 「僕の身長と体重を教えて」——2つ以上の属性をまとめて
   * 聞かれたら、知っている分を並べて答える（単品想起は1件しか
   * 返せず、複合形は調査に落ちていた）。 */
  private combinedFactRecallAnswer(prompt: string, memories: any[] = []): string | undefined {
    if (!/(?:教えて|知りたい|聞きたい)/.test(prompt) && !/[？?]/.test(prompt)) return undefined;
    const ATTR_WORDS: Array<[RegExp, string]> = [[/身長/, '身長'], [/体重/, '体重'], [/年齢/, '年齢'], [/誕生日/, '誕生日']];
    const attrs = [...new Set(ATTR_WORDS.filter(([re]) => re.test(prompt)).map(([, a]) => a))];
    if (attrs.length < 2) return undefined;
    const selfSet = new Set(['僕', '私', '俺', 'わたし', 'あたし']);
    const facts = (memories || []).filter((mm: any) => mm && mm.active !== false && !mm.replacedBy && attrs.includes(String(mm.factAttribute || '')) && String(mm.factEntity || ''));
    if (facts.length === 0) return undefined;
    const entities = [...new Set(facts.map((mm: any) => String(mm.factEntity)))];
    const named = entities.find((e) => prompt.includes(e));
    const selfEnt = entities.find((e) => selfSet.has(e));
    const pick = named || selfEnt;
    if (!pick) return undefined;
    const found: Array<{ attr: string; value: string }> = [];
    for (const attr of attrs) {
      const f = facts.find((mm: any) => String(mm.factEntity) === pick && String(mm.factAttribute) === attr);
      if (f) found.push({ attr, value: String((f as any).factValue || '') });
    }
    if (found.length < 2) return undefined;
    const dispName = selfSet.has(pick) ? '僕' : pick;
    return `${dispName}の${found.map((f) => `${f.attr}は${f.value}`).join('、')}です。`;
  }

  /** P822: 「アオモドキはアカモドキの何倍の重さ？」——教わった
   * 説明の実測値どうしの比を答える。 */
  private glossRatioAnswer(prompt: string, state?: any, recentMessages: ChatMessage[] = []): string | undefined {
    if (!/何倍/.test(prompt)) return undefined;
    const dim = /重さ|重い|軽い/.test(prompt) ? '重さ' as const
      : /大きさ|大きい|小さい/.test(prompt) ? '大きさ' as const
      : /寿命|長生き/.test(prompt) ? '寿命' as const : undefined;
    try {
      const entries = japaneseDictionaryService.listPersonal().filter((e: any) => e.gloss);
      if (dim) {
        const named = entries
          .map((e: any) => ({ name: String(e.surface), i: prompt.indexOf(String(e.surface)), meas: this.measureFromText(String(e.gloss), dim) }))
          .filter((x) => x.i >= 0 && x.meas)
          .sort((a, b) => a.i - b.i);
        if (named.length >= 2) {
          const [a, b] = named;
          if (!b.meas!.value) return undefined;
          const ratio = Math.round((a.meas!.value / b.meas!.value) * 100) / 100;
          return `「${a.name}」の${dim}は「${b.name}」の約${ratio}倍です。`;
        }
      }
      // P836: 対と次元が省略された続きの比の質問（「何倍違う？」）は、
      // 直近に話した2つと、両方に実測値がある次元で受ける。
      const dims: Array<'重さ' | '大きさ' | '寿命'> = dim ? [dim] : ['重さ', '大きさ', '寿命'];
      const cands = this.recentTopicCandidates(state, recentMessages);
      for (const d of dims) {
        const pair: Array<{ name: string; meas: { value: number; disp: string } }> = [];
        for (const c of cands) {
          if (!c || pair.some((e) => e.name === c)) continue;
          const entry = entries.find((e: any) => String(e.surface) === c);
          if (!entry) continue;
          const meas = this.measureFromText(String(entry.gloss), d);
          if (meas) pair.push({ name: c, meas });
          if (pair.length >= 2) break;
        }
        if (pair.length >= 2) {
          const [a, b] = pair;
          if (!b.meas.value) continue;
          const ratio = Math.round((a.meas.value / b.meas.value) * 100) / 100;
          return `「${a.name}」の${d}は「${b.name}」の約${ratio}倍です。`;
        }
      }
      return undefined;
    } catch { return undefined; }
  }

  /** P822: 誕生日の事実から、今の年齢と生まれてからの日数を
   * 割り出す（年齢の事実が無くても、誕生日が分かれば答えられる）。 */
  private birthdayDerivedAnswer(prompt: string, memories: any[] = []): string | undefined {
    const wantAge = /今何歳|いま何歳|現在何歳|今の年齢|満何歳/.test(prompt);
    const wantDays = /生まれてから何日|生後何日/.test(prompt);
    if (!wantAge && !wantDays) return undefined;
    const selfSet = new Set(['僕', '私', '俺', 'わたし', 'あたし']);
    let chosen: { name: string; y: number; m: number; d: number } | undefined;
    let selfFact: { name: string; y: number; m: number; d: number } | undefined;
    for (const mm of memories || []) {
      if (!mm || mm.active === false || mm.replacedBy) continue;
      if (String(mm.factAttribute || '') !== '誕生日') continue;
      const vm = String(mm.factValue || '').match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (!vm) continue;
      const ent = String(mm.factEntity || '');
      if (!ent) continue;
      const name = selfSet.has(ent) ? '僕' : ent;
      const rec = { name, y: Number(vm[1]), m: Number(vm[2]), d: Number(vm[3]) };
      if (prompt.includes(name)) { chosen = rec; break; }
      if (name === '僕' && !selfFact) selfFact = rec;
    }
    const pick = chosen || selfFact;
    if (!pick) return undefined;
    const now = new Date();
    const birth = new Date(pick.y, pick.m - 1, pick.d);
    if (wantDays) {
      const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - birth.getTime()) / 86400000);
      return `${pick.name}が生まれてから、今日で${days}日です。`;
    }
    let age = now.getFullYear() - pick.y;
    if (now.getMonth() < pick.m - 1 || (now.getMonth() === pick.m - 1 && now.getDate() < pick.d)) age--;
    return `${pick.name}は今、${age}歳です。`;
  }

  /** P821: 「僕の身長は相方の何倍？」——人の事実どうしの比を答える。 */
  private factRatioAnswer(prompt: string, memories: any[] = []): string | undefined {
    if (!/何倍/.test(prompt)) return undefined;
    const got = this.factAttributeValues(prompt, memories);
    if (!got) return undefined;
    const named = got.rows
      .map((r) => ({ r, i: prompt.indexOf(r.name) }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i);
    if (named.length < 2) return undefined;
    const [a, b] = [named[0].r, named[1].r];
    if (!b.v) return undefined;
    const ratio = Math.round((a.v / b.v) * 100) / 100;
    return `「${a.name}」の${got.attr}は「${b.name}」の約${ratio}倍です。`;
  }

  /** P821: 「相方は10年後何歳？」「僕が40歳になるのは何年後？」——
   * 年齢の事実からの見通しを、その場で計算して答える（従来は
   * 彼女自身の年齢の受け答えに流れていた）。 */
  private factAgeProjectionAnswer(prompt: string, memories: any[] = []): string | undefined {
    const proj = prompt.match(/(\d+)年後(?:は)?何歳/);
    const until = prompt.match(/(\d+)歳になるのは何年後/);
    if (!proj && !until) return undefined;
    const selfSet = new Set(['僕', '私', '俺', 'わたし', 'あたし']);
    const ages = new Map<string, number>();
    for (const mm of memories || []) {
      if (!mm || mm.active === false || mm.replacedBy) continue;
      if (String(mm.factAttribute || '') !== '年齢') continue;
      const ent = String(mm.factEntity || '');
      if (!ent) continue;
      const n = Number(String(mm.factValue || '').match(/(\d+(?:\.\d+)?)/)?.[1]);
      if (Number.isFinite(n)) ages.set(selfSet.has(ent) ? '僕' : ent, n);
    }
    if (ages.size === 0) return undefined;
    let person: string | undefined; let pos = Infinity;
    for (const name of ages.keys()) {
      const i = prompt.indexOf(name);
      if (i >= 0 && i < pos) { pos = i; person = name; }
    }
    if (!person) return undefined;
    const age = ages.get(person)!;
    if (proj) {
      const n = Number(proj[1]);
      return `${person}は${n}年後、${age + n}歳です。`;
    }
    const target = Number(until![1]);
    const diff = target - age;
    if (diff > 0) return `${person}が${target}歳になるのは${diff}年後です。`;
    if (diff === 0) return `${person}は今年${target}歳になる歳です。`;
    return `${person}が${target}歳だったのは${-diff}年前です。`;
  }

  /** P820: 「3人の年齢の真ん中は？」——人の事実でも真ん中を答える。 */
  private factMedianAnswer(prompt: string, memories: any[] = []): string | undefined {
    if (!/(?:真ん中|中央)/.test(prompt)) return undefined;
    const got = this.factAttributeValues(prompt, memories);
    if (!got) return undefined;
    const rows = [...got.rows].sort((a, b) => a.v - b.v);
    const mid = Math.floor(rows.length / 2);
    if (rows.length % 2 === 1) {
      const pick = rows[mid];
      return `${got.attr}の真ん中は「${pick.name}」です（${pick.disp}）。`;
    }
    const lo = rows[mid - 1]; const hi = rows[mid];
    return `${got.attr}の真ん中は「${lo.name}」（${lo.disp}）と「${hi.name}」（${hi.disp}）の間です。`;
  }

  private measureAggregateAnswer(prompt: string, state?: any, recentMessages: ChatMessage[] = []): string | undefined {
    const isAvg = /(?:平均)/.test(prompt);
    // P826: 「合わせて」形も合計として受ける（人の事実側と対）。
    // P836: 「合わせると」も同じ合計の形として受ける。
    const isSum = /(?:合わせ|合計)/.test(prompt);
    if (!isAvg && !isSum) return undefined;
    let label: '重さ' | '大きさ' | '寿命' | undefined = /(?:重さ|体重|キロ|グラム|トン)/.test(prompt) ? '重さ'
      : /(?:大きさ|長さ|センチ|メートル)/.test(prompt) ? '大きさ'
      : /(?:寿命|長生き|年)/.test(prompt) ? '寿命' : undefined;
    try {
      const allEntries = japaneseDictionaryService.listPersonal().filter((e: any) => e.gloss);
      const unitOf = (lab: '重さ' | '大きさ' | '寿命'): string => lab === '重さ' ? 'キロ' : lab === '大きさ' ? 'センチ' : '年';
      const fmtOf = (lab: '重さ' | '大きさ' | '寿命') => (n: number): string => `${Number.isInteger(n) ? n : Math.round(n * 10) / 10}${unitOf(lab)}`;
      // P836: 名指しされた対があれば、その対だけで集計する
      // （全体の集計とは分ける）。次元が文に無ければ、対の両方に
      // 実測値がある次元を使う（「平均は？」の続きの形も受ける）。
      const pairAnswer = (names: string[]): string | undefined => {
        const labs: Array<'重さ' | '大きさ' | '寿命'> = label ? [label] : ['重さ', '大きさ', '寿命'];
        for (const lab of labs) {
          const ms = names
            .map((n) => ({ name: n, meas: this.measureFromText(String(allEntries.find((e: any) => String(e.surface) === n)?.gloss || ''), lab) }))
            .filter((x) => x.meas);
          if (ms.length >= 2) {
            const sum = ms.reduce((acc, x) => acc + (x.meas as { value: number }).value, 0);
            const fmt = fmtOf(lab);
            if (isAvg) return `「${ms[0].name}」と「${ms[1].name}」の${lab}の平均は約${fmt(sum / ms.length)}です。`;
            return `「${ms[0].name}」と「${ms[1].name}」を合わせると${fmt(sum)}です。`;
          }
        }
        return undefined;
      };
      const namedInPrompt = allEntries.map((e: any) => String(e.surface)).filter((s: string) => s && prompt.includes(s));
      if (namedInPrompt.length >= 2) {
        const pa = pairAnswer(namedInPrompt.slice(0, 2));
        if (pa) return pa;
      }
      if (!label) {
        const cands = this.recentTopicCandidates(state, recentMessages);
        if (cands.length >= 2) {
          const pa = pairAnswer(cands.slice(0, 2));
          if (pa) return pa;
        }
        return undefined;
      }
      const categoryMatch = prompt.match(/(生き物|動物|鳥|魚|虫|植物|食べ物|飲み物)/);
      const cat = categoryMatch ? (categoryMatch[1] === '生き物' ? '動物' : categoryMatch[1]) : '';
      const entries = japaneseDictionaryService.listPersonal()
        .filter((e: any) => e.gloss)
        .filter((e: any) => !cat || this.taughtScopeMatch(e, cat));
      const measured = entries
        .map((e: any) => this.measureFromText(String(e.gloss), label))
        .filter((x): x is { value: number; disp: string } => Boolean(x));
      if (measured.length < 2) return undefined;
      const sum = measured.reduce((acc, x) => acc + x.value, 0);
      const unit = label === '重さ' ? 'キロ' : label === '大きさ' ? 'センチ' : '年';
      const fmt = (n: number): string => `${Number.isInteger(n) ? n : Math.round(n * 10) / 10}${unit}`;
      const scopeNote = `${label}が分かっている${measured.length}つで`;
      const tail = entries.length > measured.length ? `（${label}の分からないものは除いています）` : '';
      if (isAvg) return `${scopeNote}平均すると、約${fmt(sum / measured.length)}です。${tail}`;
      return `${scopeNote}全部合わせると${fmt(sum)}です。${tail}`;
    } catch { return undefined; }
  }

  /**
   * P762: 「オーストラリアに住む動物はいる？」——教わった説明の
   * 中の場所で絞って挙げる。説明文が材料なので、場所が増えても
   * 同じ受け口で効く。
   */
  private glossHabitatListAnswer(prompt: string): string | undefined {
    const m = prompt.match(/([一-龠ァ-ヶー]{2,})に住む/);
    if (!m) return undefined;
    if (!/(?:いる|ある|いない|いますか|教えて|何)/.test(prompt) && !/[？?]/.test(prompt)) return undefined;
    const place = m[1].replace(/^(?:の|に)/, '');
    if (!place || place.length < 2) return undefined;
    try {
      const entries = japaneseDictionaryService.listPersonal().filter((e: any) => e.gloss);
      const hits = entries.filter((e: any) => String(e.gloss).includes(place)).map((e: any) => String(e.surface));
      const uniq = [...new Set(hits)].slice(0, 6);
      if (uniq.length === 0) return `今知っている中では、${place}に住むものはいないです。`;
      return `います。${uniq.map((n) => `「${n}」`).join('と')}が${place}に住むと聞いています。`;
    } catch { return undefined; }
  }

  /**
   * P763: 「夜行性の動物はいる？」——教わった説明の中の性質の語で
   * 絞って挙げる（P762の場所版の一般化）。説明文が材料なので、
   * 性質の語が増えても同じ受け口で効く。
   */
  private glossTraitListAnswer(prompt: string): string | undefined {
    const m = prompt.match(/([一-龠ァ-ヶー]{2,})[のな](?:動物|鳥|魚|虫|植物|生き物)/);
    if (!m) return undefined;
    if (!/[？?]/.test(prompt) && !/(?:いる|ある|教えて|何)/.test(prompt)) return undefined;
    const trait = m[1].replace(/^(?:教えた|教えてもらった)/, '');
    if (!trait || trait.length < 2) return undefined;
    // 分類の疑問語（何科・何目…）は性質ではない（分類質問は
    // 属性質問の受け口の領分）。
    if (/何/.test(trait)) return undefined;
    if (/^(?:動物|鳥|魚|虫|植物|生き物|大きい|小さい|重い|軽い|可愛い|かわいい)$/.test(trait)) return undefined;
    try {
      const entries = japaneseDictionaryService.listPersonal().filter((e: any) => e.gloss);
      const hits = entries.filter((e: any) => String(e.gloss).includes(trait)).map((e: any) => String(e.surface));
      const uniq = [...new Set(hits)].slice(0, 6);
      if (uniq.length === 0) return `今知っている中では、${trait}ものはいないです。`;
      return `います。${uniq.map((n) => `「${n}」`).join('と')}が${trait}だと聞いています。`;
    } catch { return undefined; }
  }

  /**
   * P744: 「クオッカもワラルーも動物なの？」「〜も〜もオーストラリアに
   * 住んでるの？」——二つまとめた確認に、それぞれの分類・説明と
   * 照らして答える。片方だけ分かる時は、その旨を分けて言う。
   */
  private dualConfirmAnswer(prompt: string): string | undefined {
    if (!/[？?]/.test(prompt)) return undefined;
    const m = prompt.match(/^(.{2,12}?)も(.{2,12}?)も(.+)$/);
    if (!m) return undefined;
    const a = m[1].trim();
    const b = m[2].trim();
    if (a === b) return undefined;
    const known = (t: string) => {
      try { return japaneseDictionaryService.lookup(t).some((e: any) => e.gloss) || worldModelGraphService.relationsOf(t).length > 0; } catch { return false; }
    };
    if (!known(a) || !known(b)) return undefined;
    const pred = m[3].replace(/(?:なの|の|よね|ですか|でしょ)[？?]?$/, '').replace(/[？?]+$/, '').trim();
    if (!pred || pred.length > 20) return undefined;
    const judge = (t: string): boolean => {
      try {
        const isA = worldModelGraphService.relationsOf(t).filter((r) => r.from === t && r.type === 'IS_A').map((r) => r.to);
        if (isA.includes(pred)) return true;
        const gloss = japaneseDictionaryService.lookup(t).map((e: any) => String(e.gloss || '')).join(' ');
        if (gloss.includes(pred)) return true;
        if (/(?:住ん|生息|棲ん)/.test(pred) && /(?:住|生息|棲)/.test(gloss)) return true;
        return false;
      } catch { return false; }
    };
    const ja = judge(a);
    const jb = judge(b);
    if (ja && jb) {
      const isCategory = [a, b].some((t) => worldModelGraphService.relationsOf(t).some((r) => r.from === t && r.type === 'IS_A' && r.to === pred));
      if (isCategory) {
        const provOnly = [a, b].every((t) => {
          const rels = worldModelGraphService.relationsOf(t).filter((r) => r.from === t && r.type === 'IS_A' && r.to === pred);
          return rels.length === 0 || rels.every((r) => r.provisional);
        });
        return provOnly ? `うん、教わった説明では、どちらも${pred}の仲間だよ。` : `うん、どちらも${pred}の仲間だよ。`;
      }
      return `うん、どちらも${pred}、と聞いています。`;
    }
    if (ja !== jb) {
      const yes = ja ? a : b;
      const no = ja ? b : a;
      return `「${yes}」はそうだと思います。でも「${no}」の方は、まだ分からないです。`;
    }
    return undefined;
  }

  /**
   * P745: 「XとYは何が違うの？」——説明文の手がかりの差で答える。
   * 大きさが逆なら大きさの違いを、そうでなければ説明そのものを
   * 並べて見せる（分からない違いを invent しない）。
   */
  private glossDifferenceAnswer(prompt: string): string | undefined {
    if (!/(?:何が違う|どう違う|違いは|ちがいは)/.test(prompt)) return undefined;
    try {
      const f = utteranceFeatureService.analyze(prompt);
      const glossed = [...new Set(f.contentTokens.filter((t) => japaneseDictionaryService.lookup(t).some((e: any) => e.gloss)))];
      const [a, b] = glossed;
      if (!a || !b) return undefined;
      const glossOf = (t: string) => String(japaneseDictionaryService.lookup(t).find((e: any) => e.gloss)?.gloss || '');
      const ga = glossOf(a);
      const gb = glossOf(b);
      if (!ga || !gb) return undefined;
      const cue = (g: string) => (/大き|でか/.test(g) ? 1 : /小さ|小柄/.test(g) ? -1 : 0);
      if (cue(ga) !== 0 && cue(gb) !== 0 && cue(ga) !== cue(gb)) {
        const big = cue(ga) > cue(gb) ? a : b;
        const small = big === a ? b : a;
        return `大きさが違います。教わった説明では、「${big}」は大きい、「${small}」は小さいそうです。`;
      }
      if (ga === gb) return '教わった説明では、どちらも同じように聞いていて、違いは分からないです。';
      return `教わった説明では、「${a}」は${ga}、「${b}」は${gb}、と聞いています。`;
    } catch { return undefined; }
  }

  /**
   * P746: 「Xのこと、別の言い方で言い直して」——言い換えは
   * 生成＋意味保存チェックのセット（paraphraseService.restate）
   * で行い、チェックを通った言い換えだけを出す。通らなければ
   * 今の言い方が一番正確だと正直に言う。
   */
  private paraphraseRequestAnswer(prompt: string): string | undefined {
    if (!/(?:言い直し|言い換え|別の言い方|違う言い方)/.test(prompt)) return undefined;
    try {
      const f = utteranceFeatureService.analyze(prompt);
      const target = f.contentTokens.find((t) => japaneseDictionaryService.lookup(t).some((e: any) => e.gloss));
      if (!target) return undefined;
      const gloss = String(japaneseDictionaryService.lookup(target).find((e: any) => e.gloss)?.gloss || '');
      if (!gloss) return undefined;
      const sentence = `「${target}」は${gloss}です。`;
      const r = paraphraseService.restate(sentence, { style: 'plain' });
      if (r.changed && r.check.ok) return `言い直すと、こうなります。${r.text}`;
      return `今の私の語彙では、この説明はこの言い方が一番正確なんです。${sentence}`;
    } catch { return undefined; }
  }

  /**
   * P747: 「Xの説明、もう一度言って」「Xって、さっき何て説明
   * したっけ？」——対象の指定がある繰り返し・引用の依頼に、
   * その語の説明そのもので答える。直前の自分の発言の復唱
   * （P654）に化けると、聞かれた中身と違うものを繰り返して
   * しまうため、こちらを先に受ける。
   */
  private taughtGlossRecallAnswer(prompt: string): string | undefined {
    const repeatForm = /(?:もう一度|もう一回|もう１回)/.test(prompt) && /(?:説明|意味)/.test(prompt);
    const quoteForm = /(?:何て|なんて|何と|どう).{0,4}説明した/.test(prompt) || /説明したっけ/.test(prompt);
    if (!repeatForm && !quoteForm) return undefined;
    try {
      const f = utteranceFeatureService.analyze(prompt);
      const target = f.contentTokens.find((t) => japaneseDictionaryService.lookup(t).some((e: any) => e.gloss));
      if (!target) return undefined;
      const entry: any = japaneseDictionaryService.lookup(target).find((e: any) => e.gloss);
      const gloss = String(entry?.gloss || '');
      if (!gloss) return undefined;
      const taught = Array.isArray(entry?.semanticIds) && entry.semanticIds.includes('learned:user-taught');
      return taught
        ? `「${target}」の説明は、あなたに教わった「${gloss}」です。`
        : `「${target}」の説明は、「${gloss}」です。`;
    } catch { return undefined; }
  }

  /**
   * P749: 「クオッカとワラルー、どっちが先に教えた？」——二つの
   * 教わった語の前後を、個人辞書の登録順で答える。どちらが
   * 先か・後かで聞き方に合わせる。
   */
  private taughtPairOrderAnswer(prompt: string): string | undefined {
    if (!/(?:どっちが|どちらが)/.test(prompt) || !/(?:教えた|教えてくれた)/.test(prompt)) return undefined;
    const earlier = /(?:先に|前に|はじめに)/.test(prompt);
    const later = /(?:後で|あとで|後から|最後に)/.test(prompt);
    if (!earlier && !later) return undefined;
    try {
      const entries = japaneseDictionaryService.listPersonal()
        .filter((e: any) => e.gloss && Array.isArray(e.semanticIds) && e.semanticIds.includes('learned:user-taught'));
      const named = entries.filter((e: any) => prompt.includes(String(e.surface || '')));
      const uniq: string[] = [];
      for (const e of named) { const s = String((e as any).surface || ''); if (s && !uniq.includes(s)) uniq.push(s); }
      if (uniq.length < 2) return undefined;
      const [first, second] = uniq;
      if (earlier) return `先に教わったのは「${first}」です。その次が「${second}」です。`;
      return `後に教わったのは「${second}」です。その前が「${first}」です。`;
    } catch { return undefined; }
  }

  /**
   * P752: 「明日の予定って何だっけ？」——取り込み側で控えた
   * 予定（miki_user_plans_v1）から、時期の語が合うものを答える。
   * 控えが無ければ従来経路に委ねる（「空いています」と勝手に
   * 断定する別の受け口より、まず本人の話した予定を優先する）。
   */
  /**
   * P816: 予定の日付ずらしへの受け答え。付け替え自体は取り込み側
   * （moveUserPlanIfAny）が済ませており、ここではマーカーを見て
   * 結果を返す。マーカーが無い（ずらす形でない）場合は素通りする。
   */
  /** P831: 予定の内容の訂正（台帳の差し替え済み）の受け答え。 */
  /**
   * P858: 予定の取り消しの受け答え。取り消しは台帳側で静かに
   * 行われていて、返事は汎用の作業了承（＋的外れな聞き返し）に
   * 化けていた。ずらし・訂正と同じく、実際の取り消し結果で返す。
   */
  private planCancelAnswer(): string | undefined {
    try {
      const rec = pendingSlotService.consume('miki_recently_cancelled_plans_v1') as { label?: string; count?: number } | undefined;
      if (!rec || !(Number(rec.count) > 0)) return undefined;
      const label = String(rec.label || '');
      const count = Number(rec.count);
      if (label && count > 1) return `分かりました、${label}の予定${count}件、全部取り消しておきました。`;
      if (label) return `分かりました、${label}の予定は取り消しておきました。`;
      if (count > 1) return `分かりました、予定${count}件を取り消しておきました。`;
      return '分かりました、予定は取り消しておきました。';
    } catch { return undefined; }
  }

  private planContentCorrectionAnswer(prompt: string): string | undefined {
    if (!/(?:じゃなくて|じゃなく|ではなく)/.test(prompt)) return undefined;
    try {
      // P846/P850: 保留枠組みから消費して受ける（期限切れは無効）。
      const mk = pendingSlotService.consume<{ from?: string; to?: string; fixed?: number }>('miki_recently_corrected_plan_content_v1');
      if (!mk) return undefined;
      if (Number(mk.fixed || 0) > 0) return `分かりました、予定の「${mk.from}」は「${mk.to}」に直しておきました。`;
      return undefined;
    } catch { return undefined; }
  }

  private planMoveAnswer(prompt: string): string | undefined {
    // P830: 日の訂正形（「明日じゃなくて明後日だよ」）も、ずらしの
    // 受け答えで受ける（予定・ずらしての語が文に無いため）。
    const isMoveForm = /(?:予定|予約|約束)/.test(prompt) && /(?:ずらして|ずらす|移して|移す|延期)/.test(prompt);
    const isDayCorrection = /^(?:今日|明日|あした|明後日|明々後日|[日月火水木金土]曜日)(?:じゃなくて|じゃなく|ではなく)/.test(prompt);
    if (!isMoveForm && !isDayCorrection) return undefined;
    try {
      // P846: 保留枠組みから消費して受ける（期限切れは無効）。
      const mk = pendingSlotService.consume<{ from?: string; to?: string; moved?: number }>('miki_recently_moved_plan_v1');
      if (!mk) return undefined;
      if (Number(mk.moved || 0) > 0) {
        return mk.from
          ? `分かりました、${mk.from}の予定を${mk.to}にずらしておきました。`
          : `分かりました、予定を${mk.to}にずらしておきました。`;
      }
      return mk.from
        ? `${mk.from}の予定は、まだ聞いていないです。ずらすものが無かったです。`
        : 'ずらせる予定は、まだ聞いていないです。';
    } catch { return undefined; }
  }

  private planRecallAnswer(prompt: string): string | undefined {
    if (!/(?:予定|予約|約束)/.test(prompt)) return undefined;
    // 予定を話す文そのもの（「〜予約があるんだ」）は聞き返しでは
    // ない。疑問の形の時だけ受ける。
    // P866: 「今日の予定全部教えて」のように、？も「何」も無い
    // 「教えて」の形も聞き返しとして受ける（従来は次の条件と
    // 食い違って、汎用の「これからの予定」に流れていた）。
    // 「教えておく」は伝える側の文なので除く。
    if (!/[？?]/.test(prompt) && !/(?:だっけ|何)/.test(prompt) && !(/教えて/.test(prompt) && !/教えておく/.test(prompt))) return undefined;
    // P816: 「明日の予定は？」のような素の形も聞き返しとして受ける
    // （内容語が無いために彼女自身の予定の定型へ流れていた）。
    if (!/(?:だっけ|何|ある|あって|教えて)/.test(prompt) && !/予定(?:は|って)?[？?]\s*$/.test(prompt)) return undefined;
    // P773: 曜日の予定も聞き返せる（取り込み側と同じ解決規則）。
    // P774: 明示の日付（12月3日）を最優先する。
    const exMatch = prompt.match(/(\d{1,2})月(\d{1,2})日/);
    const wdMatch = !exMatch ? prompt.match(/(来週の|今週の)?(月|火|水|木|金|土|日)曜日/) : null;
    const whenRaw = exMatch
      ? `${Number(exMatch[1])}月${Number(exMatch[2])}日`
      : wdMatch
        ? (wdMatch[1] === '来週の' ? `来週の${wdMatch[2]}曜日` : `${wdMatch[2]}曜日`)
        : prompt.match(/(明後日|明日|あした|今日|今夜|一昨日|昨日|今週末|週末|今週|来週|再来週|今度)/)?.[1];
    if (!whenRaw) return undefined;
    const when = whenRaw === 'あした' ? '明日' : whenRaw === '今週末' ? '週末' : whenRaw;
    // P866: 週の範囲の「一覧」の要求は weekPlansAnswer の担当。
    // ここが受けると、ラベル一致が無くて「まだ聞いていない」
    // になってしまうため、一覧の形の時だけ譲る（素の週の
    // 聞き返し・無し答えは従来どおりここが受ける）。
    if ((when === '今週' || when === '来週' || when === '再来週') && /(?:全部|全て|一覧)/.test(prompt)) return undefined;
    try {
      const raw = storageService.getItem('miki_user_plans_v1');
      const plans: Array<{ when: string; text: string; date?: string }> = raw ? JSON.parse(raw) : [];
      // P772: 控えは日付に錨づけされている。「明日」と言って控えた
      // 予定は、当日には「今日の予定」として聞き返せる。
      // P775: 過去（昨日・一昨日）の予定も日付で引ける。
      const offset = when === '今日' || when === '今夜' ? 0 : when === '明日' ? 1 : when === '明後日' ? 2 : when === '昨日' ? -1 : when === '一昨日' ? -2 : Number.NaN;
      let targetDate: string | undefined;
      if (!Number.isNaN(offset)) {
        const d = new Date(Date.now() + offset * 86400000);
        targetDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } else if (exMatch) {
        const fmtD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const nowD = new Date();
        let cand = new Date(nowD.getFullYear(), Number(exMatch[1]) - 1, Number(exMatch[2]));
        if (fmtD(cand) < fmtD(nowD)) cand = new Date(nowD.getFullYear() + 1, Number(exMatch[1]) - 1, Number(exMatch[2]));
        targetDate = fmtD(cand);
      } else if (wdMatch) {
        const target = '日月火水木金土'.indexOf(wdMatch[2]);
        const now = new Date();
        let delta = (target - now.getDay() + 7) % 7;
        if (wdMatch[1] === '来週の') delta += 7;
        const d = new Date(now.getTime() + delta * 86400000);
        targetDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      // P823: 「週末の予定」は、その週の土日の日付で引く（従来は
      // 「週末」のラベルの控えしか引けなかった）。
      let weekendDates: string[] | undefined;
      if (when === '週末') {
        const fmtW = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const nowW = new Date();
        let satDelta = (6 - nowW.getDay() + 7) % 7;
        if (nowW.getDay() === 0) satDelta = -1;
        const sat = new Date(nowW.getTime() + satDelta * 86400000);
        const sun = new Date(sat.getTime() + 86400000);
        weekendDates = [fmtW(sat), fmtW(sun)];
      }
      let hits = plans.filter((p) => weekendDates
        ? (p.date ? weekendDates.includes(p.date) : p.when === when)
        : (p.date && targetDate ? p.date === targetDate : p.when === when));
      // P819: 曜日で聞かれて、その曜日の日付に合う控えが無い時は、
      // 同じ曜日のラベルの控えを拾う（曜日にずらした予定は翌週の
      // 日付になり、日付だけでは引けなかった）。
      if (hits.length === 0 && wdMatch) {
        hits = plans.filter((p) => p.when === when || p.when === `来週の${wdMatch[2]}曜日` || p.when === `再来週の${wdMatch[2]}曜日`);
      }
      if (hits.length === 0) {
        // P774: 明示の日付で聞かれたら、その日の予定が無いことを
        // こちらで答える（彼女自身の予定の話に流さない）。
        // P782: 時期の語で聞かれた場合も同じ。関係のない記憶を
        // 引いて曖昧に答えるより、無いことを正直に言う。ただし
        // 彼女自身の予定を聞く形（みきの／あなたの）は対象外。
        if (exMatch) return `${when}の予定は、まだ聞いていないです。`;
        if (!/(?:みき|あなた|君|きみ)/.test(prompt)) return `${when}の予定は、まだ聞いていないです。`;
        return undefined;
      }
      const texts = [...new Set(hits.map((p) => p.text))].slice(-3);
      return `${when}の予定は、${texts.map((t) => `「${t}」`).join('と')}、と話していましたよ。`;
    } catch { return undefined; }
  }

  /**
   * P776: 「これからの予定、全部教えて」——日付の付いた控えを
   * 日付順に並べて答える。過去の分は出さない。
   */
  /**
   * P797: 「今週の予定を全部教えて」「来週の予定は？」——週で区切った
   * 一覧。今週は今日から日曜まで、来週は月曜から日曜まで。
   * 一覧（P776）が全部の未来を出すのに対して、こちらは週の範囲。
   */
  private weekPlansAnswer(prompt: string): string | undefined {
    // P808: 再来週は来週とは別の週（部分文字列で来週に吸われていた）。
    const wk = /(再来週|今週|来週)/.exec(prompt)?.[1];
    if (!wk) return undefined;
    if (!/予定|予約|約束/.test(prompt)) return undefined;
    if (!(/[？?]/.test(prompt) || /教えて|ある/.test(prompt))) return undefined;
    if (/(?:みき|あなた|君|きみ)の/.test(prompt)) return undefined;
    try {
      const raw = storageService.getItem('miki_user_plans_v1');
      const plans = raw ? JSON.parse(raw) as Array<{ when: string; text: string; date?: string }> : [];
      const now = new Date();
      const dayMs = 24 * 60 * 60 * 1000;
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const dow = now.getDay(); // 0=日曜
      const thisSunday = todayStart + ((7 - dow) % 7) * dayMs;
      const from = wk === '今週' ? todayStart : wk === '再来週' ? thisSunday + 8 * dayMs : thisSunday + dayMs;
      const to = wk === '今週' ? thisSunday : wk === '再来週' ? thisSunday + 14 * dayMs : thisSunday + 7 * dayMs;
      const inRange = plans.filter((p) => {
        if (!p.date) return false;
        const t = new Date(`${p.date}T12:00:00`).getTime();
        return t >= from && t <= to + dayMs - 1;
      }).sort((a, b) => String(a.date).localeCompare(String(b.date)));
      if (inRange.length === 0) return `${wk}の予定は、まだ聞いていないです。`;
      const wd = ['日', '月', '火', '水', '木', '金', '土'];
      const items = inRange.slice(0, 6).map((p) => {
        const d = new Date(`${p.date}T12:00:00`);
        return `${d.getMonth() + 1}月${d.getDate()}日（${wd[d.getDay()]}）「${p.text}」`;
      });
      return `${wk}の予定は、${items.join('、')}です。`;
    } catch { return undefined; }
  }

  private upcomingPlansAnswer(prompt: string): string | undefined {
    if (!/(?:予定|予約|約束)/.test(prompt)) return undefined;
    if (!/(?:全部|一覧|これから|今後|先の|まとめて)/.test(prompt)) return undefined;
    if (!/[？?]/.test(prompt) && !/(?:教えて|見せて|何)/.test(prompt)) return undefined;
    try {
      const raw = storageService.getItem('miki_user_plans_v1');
      const plans: Array<{ when: string; text: string; date?: string }> = raw ? JSON.parse(raw) : [];
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const upcoming = plans
        .filter((p) => p.date && p.date >= todayKey)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
      if (upcoming.length === 0) return undefined;
      const label = (dk: string) => {
        const [y, mo, da] = dk.split('-').map(Number);
        const wd = '日月火水木金土'[new Date(y, mo - 1, da).getDay()];
        return `${mo}月${da}日（${wd}）`;
      };
      const items = upcoming.slice(0, 6).map((p) => `${label(String(p.date))}「${p.text}」`);
      const tail = upcoming.length > 6 ? '、ほかにもあります' : '';
      return `これからの予定は、${items.join('、')}です${tail}。`;
    } catch { return undefined; }
  }

  /**
   * P786: 「次の誕生日で何歳になる？」——今の年齢の事実から+1で、
   * 誕生日の月日が分かれば添えて答える。
   */
  private nextBirthdayAgeAnswer(prompt: string, memories: any[] = []): string | undefined {
    if (!/(?:次の誕生日|来年の誕生日|今度の誕生日|誕生日.*何歳)/.test(prompt)) return undefined;
    if (!/何歳/.test(prompt)) return undefined;
    try {
      const ageFact = (memories || []).find((m: any) => m && m.active !== false && !m.replacedBy
        && String(m.factAttribute || '') === '年齢' && /\d/.test(String(m.factValue || '')));
      if (!ageFact) return undefined;
      const age = Number(String(ageFact.factValue).match(/(\d+)/)?.[1]);
      if (!Number.isFinite(age)) return undefined;
      const bdayFact = (memories || []).find((m: any) => m && m.active !== false && !m.replacedBy
        && String(m.factAttribute || '') === '誕生日' && String(m.factValue || ''));
      const dm = bdayFact ? String(bdayFact.factValue).match(/(\d{1,2})月(\d{1,2})日/) : null;
      if (dm) return `次の誕生日（${Number(dm[1])}月${Number(dm[2])}日）で${age + 1}歳になります。`;
      return `次の誕生日で${age + 1}歳になります。`;
    } catch { return undefined; }
  }

  /**
   * P777: 「結婚式まであと何日？」——日付の付いた控えから数える。
   */
  private planCountdownAnswer(prompt: string, memories: any[] = []): string | undefined {
    // P826: 「X月Y日から…まで何日」は日付どうしの差の質問で、
    // 予定までの残り日数ではない（カレンダー側に譲る）。
    if (/(\d{1,2})月(\d{1,2})日から/.test(prompt)) return undefined;
    if (!/(?:あと何日|まで何日|何日後|までどのくらい)/.test(prompt)) return undefined;
    // P781: 誕生日は予定台帳ではなく本人の事実にある。月日を取り
    // 出して、次の誕生日までの日数を数える。
    if (/(?:誕生日)/.test(prompt)) {
      try {
        // P798: 名前つきで聞かれたら、その人の誕生日事実を選ぶ
        // （以前は誰の事実でも「あなたの誕生日」と呼んでいた）。
        const bFacts = (memories || []).filter((m: any) => m && m.active !== false && !m.replacedBy
          && String(m.factAttribute || '') === '誕生日' && String(m.factValue || ''));
        const selfSet = new Set(['僕', '私', '俺', 'わたし', 'あたし']);
        const fact = bFacts.find((m: any) => {
          const e = String(m.factEntity || '');
          return e && !selfSet.has(e) && prompt.includes(e);
        }) || bFacts.find((m: any) => selfSet.has(String(m.factEntity || ''))) || bFacts[0];
        const dm = fact ? String(fact.factValue).match(/(\d{1,2})月(\d{1,2})日/) : null;
        if (dm) {
          const entity = String(fact.factEntity || '');
          const isSelf = !entity || selfSet.has(entity);
          const label = isSelf ? 'あなたの誕生日' : `${entity}の誕生日`;
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          let cand = new Date(now.getFullYear(), Number(dm[1]) - 1, Number(dm[2]));
          if (cand.getTime() < today.getTime()) cand = new Date(now.getFullYear() + 1, Number(dm[1]) - 1, Number(dm[2]));
          const days = Math.round((cand.getTime() - today.getTime()) / 86400000);
          if (days === 0) return isSelf ? 'あなたの誕生日は今日です。おめでとうございます。' : `${label}は今日です。`;
          return `${label}（${Number(dm[1])}月${Number(dm[2])}日）まで、あと${days}日です。`;
        }
      } catch { /* 予定の数え方へ */ }
    }
    try {
      const raw = storageService.getItem('miki_user_plans_v1');
      const plans: Array<{ when: string; text: string; date?: string }> = raw ? JSON.parse(raw) : [];
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const tokens = utteranceFeatureService.analyze(prompt).contentTokens
        .filter((w: string) => w.length >= 2 && !/^(?:あと|何日|まで|予定)$/.test(w));
      const dated = plans.filter((p) => p.date && p.date >= todayKey)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const hit = dated.find((p) => tokens.some((w) => p.text.includes(w)));
      if (!hit) return undefined;
      const [y, mo, da] = String(hit.date).split('-').map(Number);
      const days = Math.round((new Date(y, mo - 1, da).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
      const wd = '日月火水木金土'[new Date(y, mo - 1, da).getDay()];
      if (days === 0) return `それは今日（${mo}月${da}日）ですよ。`;
      return `「${hit.text}」は${mo}月${da}日（${wd}）なので、あと${days}日です。`;
    } catch { return undefined; }
  }

  /**
   * P778: 「次の予定は何？」——一番近い日付の控えを答える。
   */
  private nextPlanAnswer(prompt: string): string | undefined {
    if (!/(?:次の|直近の|近いうちの)/.test(prompt)) return undefined;
    if (!/(?:予定|予約|約束)/.test(prompt)) return undefined;
    if (!/[？?]/.test(prompt) && !/(?:何|教えて)/.test(prompt)) return undefined;
    try {
      const raw = storageService.getItem('miki_user_plans_v1');
      const plans: Array<{ when: string; text: string; date?: string }> = raw ? JSON.parse(raw) : [];
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const upcoming = plans.filter((p) => p.date && p.date >= todayKey)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
      if (upcoming.length === 0) return 'これからの予定は、今は聞いていないです。';
      const p = upcoming[0];
      const [y, mo, da] = String(p.date).split('-').map(Number);
      const wd = '日月火水木金土'[new Date(y, mo - 1, da).getDay()];
      return `次の予定は、${mo}月${da}日（${wd}）の「${p.text}」です。`;
    } catch { return undefined; }
  }

  /**
   * P785: 「美容院はいつだっけ？」——内容から予定を引き当てて
   * 日付で答える（時期→内容の planRecall の逆向き）。
   */
  private planWhenAnswer(prompt: string): string | undefined {
    // P826: 「X月Y日から…まで何日」は日付どうしの差の質問で、
    // 予定の時期の質問ではない（カレンダー側に譲る）。
    if (/(\d{1,2})月(\d{1,2})日から/.test(prompt)) return undefined;
    if (!/(?:いつ|何日|何曜日)/.test(prompt)) return undefined;
    if (!/[？?]/.test(prompt) && !/(?:だっけ|教えて)/.test(prompt)) return undefined;
    try {
      const raw = storageService.getItem('miki_user_plans_v1');
      const plans: Array<{ when: string; text: string; date?: string }> = raw ? JSON.parse(raw) : [];
      if (plans.length === 0) return undefined;
      const tokens = utteranceFeatureService.analyze(prompt).contentTokens
        .filter((w: string) => w.length >= 2 && !/^(?:いつ|何日|何曜日|予定|だっけ)$/.test(w));
      if (tokens.length === 0) return undefined;
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const sorted = [...plans].sort((a, b) => {
        const au = a.date && a.date >= todayKey ? 0 : 1;
        const bu = b.date && b.date >= todayKey ? 0 : 1;
        return au - bu || String(a.date || '').localeCompare(String(b.date || ''));
      });
      const hit = sorted.find((p) => tokens.some((w) => p.text.includes(w)));
      if (!hit) return undefined;
      if (hit.date) {
        const [y, mo, da] = hit.date.split('-').map(Number);
        const wd = '日月火水木金土'[new Date(y, mo - 1, da).getDay()];
        return `「${hit.text}」は、${mo}月${da}日（${wd}）です。`;
      }
      return `「${hit.text}」は、${hit.when}の予定です。`;
    } catch { return undefined; }
  }

  /**
   * P791: 「今月の予定は？」「来月の予定は？」——月で範囲を切って
   * 日付順に並べる。無ければ正直に無いと言う。
   */
  private monthPlansAnswer(prompt: string): string | undefined {
    const mm = prompt.match(/(今月|来月|先月)/);
    if (!mm) return undefined;
    if (!/(?:予定|予約|約束)/.test(prompt)) return undefined;
    if (!/[？?]/.test(prompt) && !/(?:何|教えて|ある)/.test(prompt)) return undefined;
    if (/(?:みき|あなた|君|きみ)/.test(prompt)) return undefined;
    try {
      const raw = storageService.getItem('miki_user_plans_v1');
      const plans: Array<{ when: string; text: string; date?: string }> = raw ? JSON.parse(raw) : [];
      const now = new Date();
      const shift = mm[1] === '来月' ? 1 : mm[1] === '先月' ? -1 : 0;
      const target = new Date(now.getFullYear(), now.getMonth() + shift, 1);
      const prefix = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-`;
      const hits = plans.filter((p) => p.date && p.date.startsWith(prefix))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
      if (hits.length === 0) return `${mm[1]}の予定は、まだ聞いていないです。`;
      const items = hits.slice(0, 6).map((p) => {
        const [y, mo, da] = String(p.date).split('-').map(Number);
        const wd = '日月火水木金土'[new Date(y, mo - 1, da).getDay()];
        return `${mo}月${da}日（${wd}）「${p.text}」`;
      });
      return `${mm[1]}の予定は、${items.join('、')}です。`;
    } catch { return undefined; }
  }

  /**
   * P739: 「最初に教えたのって何だっけ？」「最後に教えたのは？」
   * に、個人辞書の教示記録の順序（登録順）から答える。
   */
  private taughtOrderAnswer(prompt: string): string | undefined {
    if (!/(?:教えた|教えてくれた|教えてあげた)/.test(prompt)) return undefined;
    const first = /(?:最初に|はじめに|一番初め|一番最初)/.test(prompt);
    // P821: 「一番最近教えたのは？」も最後に教わった語で答える。
    const last = !first && /(?:最後に|一番最近|最近教えた|この前教えた)/.test(prompt);
    if (!first && !last) return undefined;
    try {
      const entries = japaneseDictionaryService.listPersonal()
        .filter((e: any) => e.gloss && Array.isArray(e.semanticIds) && e.semanticIds.includes('learned:user-taught'));
      if (entries.length === 0) return undefined;
      const pick = String((first ? entries[0] : entries[entries.length - 1]).surface);
      return first ? `最初に教わったのは、「${pick}」です。` : `最後に教わったのは、「${pick}」です。`;
    } catch { return undefined; }
  }

  /**
   * P740: 「クオッカって動物だっけ？それとも鳥だっけ？」の
   * 二択の思い出し質問に、対象の分類（関係・説明文）から答える。
   * どちらにも根拠が無ければ扱わない。
   */
  private eitherOrRecallAnswer(prompt: string): string | undefined {
    if (!/(?:だっけ|だったっけ|だったかな)/.test(prompt)) return undefined;
    if (!/それとも/.test(prompt)) return undefined;
    try {
      const parts = prompt.split(/それとも/);
      if (parts.length !== 2) return undefined;
      const genericSet = new Set(['動物', '鳥', '魚', '虫', '植物', '獣', '哺乳類', '爬虫類', '両生類', '昆虫', '食べ物', '飲み物']);
      const targets = new Set(worldModelGraphService.relations().filter((r) => r.type === 'IS_A').map((r) => r.to));
      const isOption = (t: string) => genericSet.has(t) || targets.has(t);
      const f1 = utteranceFeatureService.analyze(parts[0]);
      const entity = f1.contentTokens.find((t) => {
        try { return !isOption(t) && (japaneseDictionaryService.lookup(t).some((e: any) => e.gloss) || worldModelGraphService.relationsOf(t).length > 0); } catch { return false; }
      });
      if (!entity) return undefined;
      const optA = [...f1.contentTokens].reverse().find((t) => t !== entity && isOption(t));
      const f2 = utteranceFeatureService.analyze(parts[1]);
      const optB = f2.contentTokens.find((t) => isOption(t));
      if (!optA || !optB || optA === optB) return undefined;
      const isA = worldModelGraphService.relationsOf(entity).filter((r) => r.from === entity && r.type === 'IS_A');
      const gloss = japaneseDictionaryService.lookup(entity).map((e: any) => String(e.gloss || '')).join(' ');
      const matchA = isA.some((r) => r.to === optA) || gloss.includes(optA);
      const matchB = isA.some((r) => r.to === optB) || gloss.includes(optB);
      if (matchA === matchB) return undefined;
      const winner = matchA ? optA : optB;
      const winnerRels = isA.filter((r) => r.to === winner);
      if (winnerRels.length > 0 && winnerRels.every((r) => r.provisional)) {
        return `教わった説明では、「${entity}」は${winner}の仲間だと思います。`;
      }
      return `「${entity}」は、${winner}だよ。`;
    } catch { return undefined; }
  }

  /**
   * P616: 知っている物への属性の質問（どこで捕まえられる？/何に使うの？）は、
   * 世界モデルの関係で答える。関係があればそれを使い、無ければ
   * 知っている範囲を添えて正直に言い、UNKNOWN_RELATION の gap として
   * 背景調査に積む（定義だけ返す／答えられない、で終わらせない）。
   */
  private attributeQuestionAnswer(prompt: string, state?: any, recentMessages: ChatMessage[] = [], memories: any[] = []): string | undefined {
    // P622: 関係の種類ごとの属性（PART_OF / CAUSES / ENABLES）も、
    // 世界モデルの関係で答えられる範囲を広げる。
    const specific = this.specificRelationAnswer(prompt);
    if (specific) return specific;
    let attrLabel: string | undefined;
    let isUse = false;
    let productFrom = false;
    if (/(?:何の仲間|なにの仲間|なんの仲間|何の一種|分類|何科|何目|何綱|何門|何属)/.test(prompt)) {
      // P618: 分類の質問は IS_A の関係で答える。
      let classEntity: string | undefined;
      try {
        const features = utteranceFeatureService.analyze(prompt);
        const findEntity = (allowGeneric: boolean) => features.contentTokens.find((t) => {
          // P720: 指示語そのものは分類の対象ではない（辞書に代名詞の
          // エントリがあると「それの分類は…」になってしまう）。
          if (/^(それ|これ|あれ|どれ)$/.test(t)) return false;
          // P720: 「それって何科の動物？」の「動物」は分類の観点で
          // あって対象ではない。指示語がある時は総称を対象にしない。
          if (!allowGeneric && /^(動物|植物|もの|こと|場所|人|食べ物|飲み物|鳥|魚|虫|花|木)$/.test(t)) return false;
          try { return japaneseDictionaryService.has(t) || worldModelGraphService.relationsOf(t).length > 0; } catch { return false; }
        });
        classEntity = findEntity(false) || findEntity(true);
      } catch { classEntity = undefined; }
      // P720: 「それって何科？」のように指示語で聞かれた場合、文中の
      // 語（「動物」等の総称）に対象が無ければ、直近の話題を対象にする。
      if (!classEntity || (/^(?:それ|これ|あれ)/.test(prompt.trim()) && /^(動物|植物|もの|こと|場所|人|食べ物|飲み物|鳥|魚|虫|花|木)$/.test(classEntity))) {
        classEntity = this.recentTopicCandidates(state, recentMessages)[0] || classEntity;
      }
      if (!classEntity) return undefined;
      const isA = worldModelGraphService.relationsOf(classEntity).filter((r) => r.from === classEntity && r.type === 'IS_A');
      // P726: 確定した関係は断定するが、仮の関係（教わった説明から
      // の分解など）だけの時は、出所を添えて断定しない。
      if (isA.length > 0 && isA.some((r) => !r.provisional)) return `「${classEntity}」は、${isA.filter((r) => !r.provisional).map((r) => r.to).join('・')}の仲間です。`;
      if (isA.length > 0) return `教わった説明からすると、「${classEntity}」は${isA.map((r) => r.to).join('・')}の仲間だと思います。`;
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
    if (/(?:どこで|どこに|どこへ|どこから|生息地)/.test(prompt) && /(?:捕まえ|釣れ|採れ|取れ|買え|手に入|見つか|見られ|見れる|会え|生息|住んで|棲んで|いる|ある)/.test(prompt)) attrLabel = /(?:生息|住んで|棲んで|見られ|見れる)/.test(prompt) ? '生息地' : '場所';
    // P818: 「Xからは何が取れる？」「Xは何を取るのに使う？」も
    // 産物の質問。使い道の関係で、取れるものとして答える。
    else if (/(?:から(?:は|って)?何が(?:取れる|採れる|獲れる))|(?:何を取るのに使う)/.test(prompt)) { attrLabel = '使い道'; isUse = true; productFrom = true; }
    else if (/(?:何に|なにに|何の(?:ため|役)|なんの(?:ため|役))/.test(prompt) && /(?:使う|使える|役立|利用)/.test(prompt)) { attrLabel = '使い道'; isUse = true; }
    else if (/(?:何から|なにから)/.test(prompt) && /(?:できて|作ら|でき)/.test(prompt)) attrLabel = '材料';
    // P724: 食性の質問も属性として受ける。ここで受けないと定義の
    // 説明文が「何食べるの？」への答えとして出てしまっていた。
    else if (/(?:何を食べ|何食べ|何を食|何が餌|餌は何|食べ物は何)/.test(prompt)) attrLabel = '食べ物';
    // P743: 数値で聞かれる属性（重さ・大きさ・寿命）も受ける。
    // 答えは教わった事実と説明文の中の数値から引く（下の処理）。
    // 教示文（「体重が5キロだよ」）まで質問と誤認しないよう、
    // 質問の形の時だけ受ける。
    else if (/(?:何キロ|何グラム|重さ|体重)/.test(prompt) && /(?:[？?]|何キロ|何グラム|だっけ)/.test(prompt)) attrLabel = '重さ';
    else if (/(?:何センチ|何メートル|体長|全長|長さ|大きさ)/.test(prompt) && /(?:[？?]|何センチ|何メートル|だっけ)/.test(prompt)) attrLabel = '大きさ';
    else if (/(?:寿命|何年生き|何歳まで生き)/.test(prompt) && /(?:[？?]|何年|だっけ)/.test(prompt)) attrLabel = '寿命';
    // P833: 「住んでる場所は？」も生息地の質問として受ける
    // （「どこ」形でなくても、場所の聞き方として読む）。
    else if (/(?:住んでる場所|住む場所|棲んでる場所|棲みか|すみか)/.test(prompt)) attrLabel = '生息地';
    else if (/(?:どうやって|どうすれば|どのように)/.test(prompt)) attrLabel = 'やり方';
    // P822: 性別も属性として受ける（説明文のオス・メスで答える）。
    else if (/性別/.test(prompt)) attrLabel = '性別';
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
    // P833: 主語が省略された続きの質問（「で、重さは？」）は、属性の
    // 語そのものしか対象に拾えない。直近の話題を対象に取り直す。
    if (!entity || /^(?:重さ|大きさ|寿命|場所|生息地|食べ物|材料|性別)$/.test(entity)) {
      const recent = this.recentTopicCandidates(state, recentMessages)[0];
      if (recent && recent !== entity) entity = recent;
    }
    if (!entity) return undefined;
    // P737: 「その動物って〜？」の「その＋総称」は、直近に話した
    // 具体的な相手を指す。総称が対象に拾われたら、その分類に
    // 属する直近の話題を対象に取り直す。
    if (/^(?:動物|植物|もの|場所|人|食べ物|飲み物|鳥|魚|虫|花|木|獣)$/.test(entity) && new RegExp(`^(?:その|あの|この)${entity}`).test(prompt.trim())) {
      try {
        const cand = this.recentTopicCandidates(state, recentMessages).find((c) => {
          if (c === entity) return false;
          try {
            const g = japaneseDictionaryService.lookup(c).find((e: any) => e.gloss)?.gloss || '';
            return String(g).includes(entity) || worldModelGraphService.relationsOf(c).some((r) => r.from === c && r.type === 'IS_A' && r.to === entity);
          } catch { return false; }
        });
        if (cand) entity = cand;
      } catch { /* 話題の解決は補助経路 */ }
    }
    // P743: 重さ・大きさ・寿命は、教わった事実（訂正が効く側）と
    // 説明文の中の数値で答える。「5キロじゃなくて4キロ」と
    // 訂正されたら、答えも4キロになる。
    if (attrLabel === '重さ' || attrLabel === '大きさ' || attrLabel === '寿命') {
      const unitRe: Record<string, RegExp> = {
        '重さ': /(\d+(?:\.\d+)?\s*(?:キログラム|キロ|グラム|トン|kg|g)(?:くらい|ほど)?)/,
        '大きさ': /(\d+(?:\.\d+)?\s*(?:センチメートル|センチ|メートル|cm|m)(?:くらい|ほど)?)/,
        '寿命': /(\d+(?:\.\d+)?\s*(?:年|歳)(?:くらい|ほど)?)/,
      };
      const re = unitRe[attrLabel];
      try {
        for (const m of (memories || [])) {
          if (String((m as any).factEntity || '') !== entity || (m as any).active === false) continue;
          const hit = String((m as any).factValue || (m as any).content || '').match(re);
          if (hit) return `教わった話では、「${entity}」は${hit[1]}だそうです。`;
        }
        const gloss = japaneseDictionaryService.lookup(entity).map((e: any) => String(e.gloss || '')).join(' ');
        const gHit = gloss.match(re);
        if (gHit) return `教わった説明では、「${entity}」は${gHit[1]}だそうです。`;
      } catch { /* 数値の読み取りは補助経路 */ }
    }
    const relations = worldModelGraphService.relationsOf(entity).filter((r) => r.from === entity);
    const usedFor = relations.filter((r) => r.type === 'USED_FOR');
    if (isUse && usedFor.length > 0) {
      // P820: 「Xの毛は何に使う？」は産物そのものの使い道を聞いて
      // いる。本体の使い道として循環させず、取れることと、産物
      // 自体の使い道はまだ知らないことを分けて答える。
      const subIdx = prompt.indexOf(`${entity}の`);
      if (subIdx >= 0) {
        const rest = prompt.slice(subIdx + entity.length + 1);
        const sub = rest.split(/[はがを、,？?]/)[0]?.trim();
        if (sub && usedFor.some((r) => r.to === sub)) {
          return `「${entity}」から取れるのは${sub}ですが、${sub}自体の使い道はまだ知らないです。`;
        }
      }
      // P818: 産物の出所を聞く形には、取れるもので言い直して答える。
      if (productFrom) return `「${entity}」から取れるのは、${usedFor.map((r) => r.to).join('や')}です。`;
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
        '食べ物': ['食べ', '食'],
        '重さ': ['重', 'キロ', 'グラム', '体重'],
        '大きさ': ['大き', '小さ', 'センチ', 'メートル', '体長'],
        '寿命': ['寿命', '生き', '年'],
      };
      const keys = keywords[attrLabel];
      if (keys) {
        const claim = claimDatabaseService.getAllClaims().find((c: any) => (c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED') && String(c.statement || '').includes(entity) && keys.some((k) => String(c.statement || '').includes(k)));
        if (claim) return String((claim as any).statement).slice(0, 120);
      }
    } catch { /* 補助経路 */ }
    // P717: 検証済みの知識が無くても、教わった説明（個人辞書の
    // gloss）に属性の手がかりが含まれていれば、出典を添えて答える
    // （教わった内容を使わずに「まだ知らない」と言うのは、学んだ
    // ことを使えていないのと同じため）。
    try {
      const glossKeys: Record<string, string[]> = {
        '生息地': ['生息', '住ん', '住む', '棲ん', '棲む'],
        '場所': ['生息', '住ん', '住む', '棲ん', '棲む'],
        '使い道': ['使わ', '使え', '用い', '役立'],
        '食べ物': ['食べ', '食', '餌', '草食', '肉食'],
        '重さ': ['キロ', 'グラム', '重', '体重'],
        '大きさ': ['大き', '小さ', 'センチ', 'メートル', '体長'],
        '寿命': ['寿命', '年', '歳', '生き'],
        '性別': ['オス', 'メス', '雄', '雌'],
      };
      const gk = glossKeys[attrLabel];
      if (gk) {
        const gloss = japaneseDictionaryService.lookup(entity).map((e: any) => String(e.gloss || '')).find((g) => gk.some((k) => g.includes(k)));
        if (gloss) return `教わった説明では、「${entity}」は${gloss}、と聞いています。`;
      }
    } catch { /* 補助経路 */ }
    const known: string[] = [];
    const isA = relations.filter((r) => r.type === 'IS_A');
    // P731: 「〜の一種ことは」という崩れを直し、命題の形で並べる。
    if (isA.length > 0) known.push(`${isA.map((r) => r.to).join('・')}の一種だということ`);
    if (!isUse && usedFor.length > 0) known.push(`${usedFor.map((r) => r.to).join('・')}に使われるということ`);
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
      ? `「${entity}」については、${known.join('、')}は知っているのですが、`
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
    // P809: 関係が無くても、教わった説明文に聞かれた部位・語が
    // 含まれていれば、説明文を引いて答える（「背中には何がある
    // の？」に「中身は知らない」と返す崩れの対策）。
    try {
      const feats2 = utteranceFeatureService.analyze(prompt);
      const glossHit = japaneseDictionaryService.lookup(entity).map((e: any) => String(e.gloss || '')).find((g: string) => g.length > 0
        && feats2.contentTokens.some((t) => t !== entity && t.length >= 2 && g.includes(t)));
      if (glossHit) return `教わった説明では、「${entity}」は${glossHit}、と聞いています。`;
    } catch { /* 補助判定 */ }
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
    // P866: 「クオッカって、草原にいるの？」は存在・所在の確認。
    // 従来は用語の確認（〜の仲間？）に誤読され、「いるじゃなくて、
    // 〜は類の仲間だと思います」という崩れた否定が返っていた。
    // 教わった説明に場所が含まれるかで答える。
    {
      const pm = prompt.match(/^(.{1,12}?)って[、,]?\s*(.{1,10}?)に(?:いる|住んでる|住んでいる|生息してる|生息している)の[？?]/);
      if (pm) {
        const entity = pm[1].trim();
        const place = pm[2].trim();
        if (known.includes(entity)) {
          let gloss = '';
          try {
            const entries = japaneseDictionaryService.lookup(entity);
            gloss = entries.map((e: any) => e.gloss || '').filter(Boolean).join(' ');
          } catch { /* 辞書なし */ }
          if (gloss) {
            return gloss.includes(place)
              ? `はい、「${entity}」は${place}にいると聞いています。`
              : `そこまでは知らないです。教わった説明では、「${entity}」は${gloss}、と聞いています。`;
          }
        }
      }
    }

    // P861: 片方を知らない共通点・類似の質問は、知らない側の
    // 名前を挙げて正直に答える。従来は材料不足のまま汎用の
    // 保留文（「関連しそうな内容は覚えているけれど…」）に落ち、
    // 知らない物を知っているかのような言い方になっていた。
    if (/(?:似てる|似ている|そっくり|似てます|共通点|似ているところ|同じところ|似たところ)/.test(prompt) && known.length === 1 && /と/.test(prompt)) {
      const k = known[0];
      const stopSim = /^(?:共通点|同じ|ところ|似てる|似ている|似た|そっくり|何|なに|どの|どう)$/;
      const unknown = features.contentTokens.find((t) => t !== k && t.length >= 2 && !stopSim.test(t) && !k.includes(t) && !t.includes(k)
        && (prompt.includes(`${k}と${t}`) || prompt.includes(`${t}と${k}`)));
      if (unknown) {
        if (/(?:共通点|同じところ|似たところ)/.test(prompt)) return `「${unknown}」のことは、まだ知らないので、「${k}」との共通点は分からないです。`;
        return `「${unknown}」のことは、まだ知らないので、「${k}」と似ているかは分からないです。`;
      }
    }
    // 似ているか：2つの既知の物について、片方の説明にもう片方が出れば手がかりがある。
    // P810: 「共通点は？」も同じ材料（共有する分類・説明の語）で答える。
    if (/(?:似てる|似ている|そっくり|似てます|共通点|似ているところ|同じところ|似たところ)/.test(prompt) && known.length >= 2) {
      const [a, b] = known;
      try {
        const glossA = japaneseDictionaryService.lookup(a).map((e: any) => String(e.gloss || '')).join(' ');
        const glossB = japaneseDictionaryService.lookup(b).map((e: any) => String(e.gloss || '')).join(' ');
        if (glossA.includes(b)) return `「${a}」は「${b}のような姿」と覚えているので、姿は似ているようです。`;
        if (glossB.includes(a)) return `「${b}」は「${a}のような姿」と覚えているので、姿は似ているようです。`;
        const isAof = (x: string) => worldModelGraphService.relationsOf(x).filter((r) => r.from === x && r.type === 'IS_A').map((r) => r.to);
        const shared = isAof(a).filter((t) => isAof(b).includes(t));
        if (shared.length > 0) {
          if (/(?:共通点|同じところ)/.test(prompt)) return `共通点は、どちらも${shared.join('・')}の仲間なところです。`;
          return `どちらも${shared.join('・')}の仲間なので、近いところはあると思います。`;
        }
        if (/(?:共通点|同じところ)/.test(prompt)) return `「${a}」と「${b}」の共通点は、まだはっきり知らないです。`;
        return `「${a}」と「${b}」が似ているかどうかは、まだはっきり知らないです。`;
      } catch { return undefined; }
    }
    // 確認の質問：Xは Y じゃないの？/なの？ に、関係と照らして答える。
    let confirmMatch = prompt.match(/(.+?)(?:って|は)\s*(.+?)\s*(?:じゃないよね|じゃないの|じゃないですか|ではないよね|ではないの|なの|ですか|なのですか|の)[？?]?$/);
    // P801: 「ホシカゲって獣？」のような裸の形（なの・ですか無し）
    // も確認の質問。ただし候補が関係先か説明文に出る語の時だけ
    // 扱う（「可愛い？」のような意見の質問は従来経路に残す）。
    let bareConfirmForm = false;
    if (!confirmMatch) {
      confirmMatch = prompt.match(/(.+?)(?:って|は)\s*(.+?)\s*[？?]$/);
      bareConfirmForm = !!confirmMatch;
    }
    // P644: 疑問詞で始まる中身（「何を食べるの？」等）は確認ではなく
    // 属性の質問。確認として扱うと、無関係な知識で「じゃなくて」と
    // 正す崩れになるため、ここでは扱わない。
    if (confirmMatch && /[？?]/.test(prompt) && !/^(?:何|なに|どの|どう|いつ|どこ|だれ|誰)/.test(confirmMatch[2].trim()) && !/(?:なんで|どうして|なぜ)/.test(prompt)) {
      const entity = known.find((t) => prompt.startsWith(t) || prompt.includes(`${t}って`) || prompt.includes(`${t}は`));
      if (!entity) return undefined;
      // P819: 「〜だっけ？」の思い出し形でも確認として扱えるよう、
      // だっけ・っけは候補にしない（従来は候補が「っけ」になり、
      // 照合に失敗して確認そのものが流れていた）。「魚の仲間」の
      // ように助詞が付いた候補は、末尾の「の」を落として照合する。
      const candidateToken = features.contentTokens.filter((t) => t !== entity && !/(?:じゃない|なの|ですか|よね|でしょ|だっけ|っけ)/.test(t) && !/^(?:じゃ|ない|仲間|なかま|種類|一種)$/.test(t) && !/^[性化用型感力]$/.test(t)).slice(-1)[0];
      const candidate = candidateToken ? candidateToken.replace(/の$/, '') : candidateToken;
      if (!candidate || candidate === entity) return undefined;
      // P738: 候補が性質の語（夜行・肉食・温厚など）の時は、分類の
      // 関係では肯定も否定もできない。「性じゃなくて」のような
      // 崩れや、根拠のない同意をしないよう、ここでは扱わない。
      const candidateIsProperty = /^(?:肉食|草食|雑食|夜行|昼行|温厚|凶暴|臆病|活発|おとなしい|大人しい|人懐っこい)$/.test(candidate);
      // P743: 大きさの形容詞（大きい・小さい）が候補の時は、
      // 説明文に手がかりがあれば肯定し、無ければ正さずに引く。
      if (candidate === '大きい' || candidate === '小さい') {
        try {
          const gloss743 = japaneseDictionaryService.lookup(entity).map((e: any) => String(e.gloss || '')).join(' ');
          const stem = candidate === '大きい' ? /大き|でか/ : /小さ|小柄/;
          if (stem.test(gloss743)) return `はい、教わった説明では「${entity}」は${candidate}そうです。`;
        } catch { /* 補助判定 */ }
        return undefined;
      }
      // P801: 裸の形では、候補が関係先か説明文の語の時だけ答える。
      // P805: 教わった主張文に出る語も通す（「鳥じゃなくて獣」と
      // 教わった場合、否定された分類は説明文には残らないが、
      // 主張文には残っている。それへの確認は関係で正せる）。
      if (bareConfirmForm) {
        try {
          const relTos = worldModelGraphService.relationsOf(entity).filter((r) => r.from === entity).map((r) => r.to);
          const glossText = japaneseDictionaryService.lookup(entity).map((e: any) => String(e.gloss || '')).join(' ');
          const inClaims = claimDatabaseService.getAllClaims().some((c) => {
            const st = String((c as any).statement || '');
            return st.includes(entity) && st.includes(candidate);
          });
          // P819: 「〜だっけ？」の思い出し形で、分類が分かっている
          // 物への確認は、候補が外れていても通す（後段で分類から
          // 正す）。裸の意見の質問（「可愛い？」等）は従来どおり
          // ここで引く。
          const isATos = worldModelGraphService.relationsOf(entity).filter((r) => r.from === entity && r.type === 'IS_A').map((r) => r.to);
          const dakkeWithIsA = /だっけ/.test(prompt) && isATos.length > 0;
          if (!relTos.includes(candidate) && !glossText.includes(candidate) && !inClaims && !dakkeWithIsA) return undefined;
        } catch { return undefined; }
      }
      const relations = worldModelGraphService.relationsOf(entity).filter((r) => r.from === entity);
      const targets = relations.map((r) => r.to);
      // P729: 否定の確認（「〜じゃないよね？」）は、相手の見立てが
      // 知識と合うかどうかで答える。知識と合えば同意し、確かな
      // 関係とぶつかれば正す。根拠が仮の関係だけなら断定しない。
      const negatedConfirm = /(?:じゃないよね|じゃないの|じゃないですか|ではないよね|ではないの)[？?]?$/.test(prompt.trim());
      if (negatedConfirm) {
        const candRels = relations.filter((r) => r.to === candidate);
        if (candRels.some((r) => !r.provisional)) return `いえ、「${entity}」は${candidate}だよ。`;
        if (candRels.length > 0) return `教わった説明では、「${entity}」は${candidate}の仲間みたいだよ。`;
        if (candidateIsProperty) return undefined;
        const isAAll = relations.filter((r) => r.type === 'IS_A');
        if (isAAll.some((r) => !r.provisional)) return `うん、${candidate}じゃなくて、「${entity}」は${isAAll.filter((r) => !r.provisional).map((r) => r.to).join('・')}の一種だよ。`;
        if (isAAll.length > 0) return `うん、${candidate}じゃないよ。教わった説明では、「${entity}」は${isAAll.map((r) => r.to).join('・')}の仲間だと思います。`;
        return undefined;
      }
      if (targets.includes(candidate)) {
        // P729: 肯定の根拠が仮の関係だけなら、断定せず出所を添える。
        const rels = relations.filter((r) => r.to === candidate);
        if (rels.length > 0 && rels.every((r) => r.provisional)) {
          return `教わった説明では、「${entity}」は${candidate}の仲間だと思います。`;
        }
        return `はい、「${entity}」は${candidate}です。`;
      }
      // P727: 検証済みの知識が候補を裏付けるなら、関係による正し
      // より先に肯定する。教わった説明の分解で仮の関係が増えた
      // 結果、述語の確認（「発光するの？」）まで「〜じゃなくて
      // 一種です」と正してしまう崩れの対策（検証済み > 仮の関係）。
      try {
        const verifiedHit = claimDatabaseService.getAllClaims()
          .filter((c: any) => (c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED') && String(c.statement || '').includes(entity))
          .find((c: any) => String(c.statement || '').includes(candidate));
        if (verifiedHit) return `はい、そのとおりです。${String((verifiedHit as any).statement).slice(0, 90)}`;
      } catch { /* 知識照合は補助経路 */ }
      // P807: 教わった説明文が候補の述語を含むなら、分類の正しより
      // 先に説明文を引いて肯定する（「卵を産むの？」に「産むじゃ
      // なくて鳥の仲間」と返す崩れの対策。P727 の教わった説明版）。
      try {
        const glossHit = japaneseDictionaryService.lookup(entity).map((e: any) => String(e.gloss || '')).find((g: string) => g.length > 0 && g.includes(candidate));
        if (glossHit) return `うん、教わった説明では「${entity}」は${glossHit}、と聞いています。`;
      } catch { /* 補助判定 */ }
      if (candidateIsProperty) return undefined;
      const isARelations = relations.filter((r) => r.type === 'IS_A');
      const isA = isARelations.map((r) => r.to);
      const usedFor = relations.filter((r) => r.type === 'USED_FOR' && !r.provisional).map((r) => r.to);
      if (isA.length > 0 && isARelations.some((r) => !r.provisional)) {
        const confirmed = isARelations.filter((r) => !r.provisional).map((r) => r.to);
        return `${candidate}じゃなくて、「${entity}」は${confirmed.join('・')}の一種です${usedFor.length > 0 ? `。${usedFor.join('・')}に使われます` : ''}。`;
      }
      // P727: 分類の根拠が仮の関係だけの時は、断定せず出所を添える。
      if (isA.length > 0) {
        return `${candidate}じゃなくて、教わった説明では「${entity}」は${isA.join('・')}の仲間だと思います。`;
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
  /**
   * P668: 遊びの誘いへの受け口。しりとりは最初の言葉まで出して
   * 始める。面白い話は、彼女が確かめた知識から一つ語る（材料が
   * 無ければ正直に言う）。歌は声が出せないことを正直に伝え、
   * 歌詞作りの形で受ける。
   */
  private playInvitationAnswer(prompt: string): string | undefined {
    // P688: 「さっきのクイズ何問正解だった？」は誘いではなく
    // 終わった遊びについての質問。ここでは扱わない。
    // P689: しりとりの勝敗の質問も同じ。
    if (/(?:何問|成績|結果|何点|正解だった|勝った|勝敗)/.test(prompt)) return undefined;
    if (/しりとり/.test(prompt)) {
      // P669: 開始と同時にしりとりの状態を作り、続けられるようにする。
      // P678: 別の遊びからの切り替えでは、前の遊びの状態を畳む。
      quizService.end();
      return shiritoriService.start();
    }
    if (/クイズ|なぞなぞ|問題出して|もんだい出して/.test(prompt)) {
      // P670: クイズも開始と同時に状態を作り、答え合わせまで続ける。
      shiritoriService.end();
      return quizService.start();
    }
    if (/(?:面白い|おもしろい|お話|はなし).{0,4}(?:話して|聞かせて|して|ちょうだい)/.test(prompt) || /(?:何か|なんか).{0,3}(?:話して|聞かせて)/.test(prompt)
      // P697: 「何か面白いことない？」「暇つぶしに何か」は、面白い
      // 話の要求。調査に流すと Web の断片がそのまま返っていた。
      // ただし「おすすめの暇つぶしある？」はおすすめの質問なので
      // 除く（そちらは recommendation 側の領分）。
      || /(?:何か|なんか|なにか).{0,4}(?:面白い|おもしろい)こと/.test(prompt) || (/暇つぶし/.test(prompt) && !/おすすめ/.test(prompt))) {
      try {
        const claims = claimDatabaseService.getAllClaims()
          .filter((c) => (c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED') && c.statement);
        const latest = claims[claims.length - 1];
        if (latest) return `じゃあ一つ、私が覚えた話をしますね。${latest.statement}`;
      } catch { /* 知識が無ければ下の形 */ }
      return 'まだ話せるネタが少ないんです。何の話がいいですか？動物のこととか、最近のこととか。';
    }
    if (/歌(?:って|おう|いたい)/.test(prompt)) {
      // P588 の方針（解けない依頼も引き受ける形で受ける）は保ち、
      // 声が出せないことだけ添える。ビービーはタメ口の形で返す
      // （P589：受け皿の形も人格の口調で）。
      let bibi = false;
      try { bibi = personaProfileService.get().profileId === BIBI_PROFILE_ID; } catch { bibi = false; }
      return bibi
        ? 'いいよ！声で歌うことはできないんだけど、歌詞みたいな短い文なら一緒に作れるよ。'
        : 'いいですよ！声で歌うことはできないんですけど、歌詞みたいな短い文なら一緒に作れますよ。';
    }
    if (/遊ぼう|あそぼう|遊びたい|あそびたい/.test(prompt)) {
      return 'いいですよ！何して遊びましょう。しりとりでも、クイズでも、お話でも。';
    }
    return undefined;
  }

  /**
   * P679: 気持ちの頼み（応援・励まし・慰め・褒め・笑わせて）への受け口。
   * 作業の了承ではなく、気持ちとして返す。
   */
  /**
   * P706: 芸の依頼（冗談・早口言葉・踊る・絵）と、話し方の依頼
   * （英語で・関西弁で・敬語やめて）。空の了承（「はい、いいですよ」
   * だけで何も起きない）や語の聞き返しになっていた。できる芸は
   * その場でやり、できないことは正直に範囲を言う。
   */
  private performanceRequestAnswer(prompt: string): string | undefined {
    const p = String(prompt || '').trim();
    if (p.length > 16) return undefined;
    if (/(?:冗談|じょうだん|ギャグ|ダジャレ|だじゃれ)/.test(p) && /(?:言って|聞かせて|やって|して|ある|一つ|ひとつ)/.test(p)) {
      return this.pickFixedReply('fx_joke_tell', [
        'じゃあ一つ。布団が吹っ飛んだ！…ダジャレしか出てきませんでした。',
        '一つだけ。パンダの好物は、パンだ！…すみません、ダジャレです。',
      ]);
    }
    if (/早口言葉/.test(p) && /(?:言って|やって|聞かせて|して)/.test(p)) {
      return this.pickFixedReply('fx_tongue_twister', [
        '生麦生米生卵。…文字だと噛まないのがずるいですね。',
        '隣の客はよく柿食う客だ。…文字なので噛みませんでした。',
      ]);
    }
    if (/^(?:踊って|踊ってみて|ダンスして)/.test(p)) {
      return '踊れないんですけど、気持ちだけはノリノリです。音楽に合わせて揺れているつもりでいますね。';
    }
    if (/(?:絵|イラスト)(?:を)?(?:描いて|書いて|かいて)/.test(p)) {
      return 'ごめんなさい、ここでは絵を出すことができないんです。言葉でよければ、描いてほしいものを聞かせてください。';
    }
    if (/(?:英語|中国語|韓国語)で(?:話して|答えて|言って)/.test(p)) {
      return 'ごめんなさい、その言葉で話すのはまだできないんです。日本語でなら精一杯答えますね。';
    }
    if (/関西弁で(?:話して|答えて|言って)/.test(p)) {
      return '関西弁はまだうまく話せないんです。今の話し方でよければ、付き合ってくださいね。';
    }
    if (/敬語(?:を)?(?:やめて|なしで|抜きで)|タメ口で/.test(p)) {
      return 'ありがとう。でも今の話し方は私の素の話し方なんです。このままでもいいですか？';
    }
    return undefined;
  }

  private supportRequestAnswer(prompt: string): string | undefined {
    const p = String(prompt || '');
    if (/応援して|応援ちょうだい|応援してほしい/.test(p)) {
      return 'もちろん、応援しています！大丈夫、きっとうまくいきますよ。私はずっと味方です。';
    }
    if (/励まして|励まし/.test(p)) {
      return '大丈夫ですよ。ここまで頑張ってきたんですから。少しずつでいいんです、一歩ずついきましょう。';
    }
    if (/慰めて|なぐさめて/.test(p)) {
      return 'そばにいますよ。無理に元気を出さなくて大丈夫です。ゆっくりでいいので、話せるときに聞かせてくださいね。';
    }
    if (/褒めて|ほめて/.test(p)) {
      return 'えらいですよ！毎日ちゃんと頑張っているの、私は知ってますからね。';
    }
    if (/笑わせて|笑かして/.test(p)) {
      return 'じゃあ一つ。……布団が吹っ飛んだ！すみません、今のところ私の持ちネタはこれだけです。';
    }
    // P684: 迷い・悩みの宣言は、一緒に整理する形で受ける。
    if (/決められない|決められなくて|迷ってる|迷っている|悩んでる|悩んでいる/.test(p)) {
      return '迷いますよね。何で迷っているのか聞かせてくれたら、一緒に整理してみますよ。';
    }
    return undefined;
  }

  /**
   * P684: 自己紹介と自分の名前への質問。プロファイルの名前と、
   * 彼女の営み（話す・調べる・覚える）で答える。
   */
  private selfIntroductionAnswer(prompt: string): string | undefined {
    const p = String(prompt || '');
    const asksIntro = /自己紹介/.test(p);
    // P692: 「猫の名前はモチだよ」のような、持ち主つきの名前の文を
    // 自分の名前への質問と誤認しない（「Xの名前」は彼女の名前ではない）。
    const otherOwnerName = /[^\s]の名前/.test(p) && !/(?:あなたの|君の|お前の|あんたの)名前/.test(p);
    const asksName = !otherOwnerName && /(?:あなたの|君の|お前の|あんたの)?名前(?:は|って|を教えて)/.test(p) && !/僕|私|俺|自分の名前/.test(p);
    const asksWho = /(?:君は|あなたは|あんたは)誰/.test(p);
    if (!asksIntro && !asksName && !asksWho) return undefined;
    let name = 'MIKI-AI';
    let bibi = false;
    try {
      const profile = personaProfileService.get();
      name = profile.name || name;
      bibi = profile.profileId === BIBI_PROFILE_ID;
    } catch { /* 既定の形で答える */ }
    if (asksName && !asksIntro) return `私は${name}です。`;
    return bibi
      ? `私は${name}だよ！話したり、知らないことを調べたり覚えたりして、少しずつ育ってるの。よろしくね！`
      : `私は${name}です。話をしたり、知らないことを調べたり覚えたりしながら、少しずつ育っているAIです。`;
  }

  /**
   * P680: 会話の切り出しへの受け口。相談・聞いてほしい・一緒に
   * 考えて・質問の許可・お願い——どれも「どうぞ、聞きます」の形。
   */
  private conversationOpenerAnswer(prompt: string): string | undefined {
    const p = String(prompt || '');
    if (/相談(?:に乗って|したい|がある|です|なんだ|聞いて)/.test(p)) {
      return 'もちろん、聞きますよ。どうしましたか？';
    }
    if (/(?:話|はなし)(?:を)?聞いて|聞いてほしい|聞いて欲しい/.test(p)) {
      return '聞きますよ。どうしましたか？';
    }
    if (/一緒に考えて|一緒に考えよう|考えてほしい/.test(p) && !/作り方|レシピ/.test(p)) {
      return 'いいですよ、一緒に考えましょう。何のことですか？';
    }
    if (/質問していい|聞いていい|質問がある|聞きたいことがある|聞きたいんだけど/.test(p)) {
      return 'もちろん、どうぞ。何ですか？';
    }
    if (/お願いがある|お願いしたい|頼みがある|頼みたいことがある/.test(p)) {
      return 'いいですよ、何ですか？聞きますよ。';
    }
    return undefined;
  }

  /**
   * P681: 社交の声かけへの受け口。短い社交の発話だけを対象にする
   * （依頼の末尾の「よろしくね」等を横取りしないよう、全体が短い
   * 社交形のときだけ）。
   */
  private socialWarmthAnswer(prompt: string): string | undefined {
    const p = String(prompt || '').replace(/[！!。\s]/g, '');
    if (/^(?:お)?久しぶり(?:だね|ですね|です)?$/.test(p)) {
      return 'お久しぶりです！元気でしたか？会えて嬉しいです。';
    }
    if (/^はじめまして(?:です)?$/.test(p)) {
      return 'はじめまして！よろしくお願いしますね。';
    }
    if (/^(?:どうぞ)?よろしく(?:頼むね|たのむね|頼む|ね|よ|お願いします|お願いいたします|お願い)?$/.test(p)) {
      return 'こちらこそ、よろしくお願いします！';
    }
    // P703: 食事の挨拶・乾杯・彼女への気遣いと応援も短い社交の形。
    // 「がんばってね」が語幹「がん」の反響に、「無理しないでね」が
    // 「無理の話ですね」になっていた。
    if (/^いただきます$/.test(p)) {
      return 'どうぞ、ゆっくり召し上がってくださいね。';
    }
    if (/^ごちそうさま(?:でした)?$/.test(p)) {
      return 'お腹いっぱいになりましたか？美味しかったなら何よりです。';
    }
    if (/^(?:乾杯|かんぱい)$/.test(p)) {
      return 'かんぱーい！';
    }
    if (/^お大事に$/.test(p)) {
      return 'ありがとうございます。その気持ちが嬉しいです。';
    }
    if (/^(?:がんばって|頑張って)(?:ね|よ|ください)?$/.test(p)) {
      return 'ありがとう、がんばります！';
    }
    if (/^気をつけて(?:ね|よ)?$/.test(p)) {
      return 'ありがとう、気をつけますね。';
    }
    if (/^無理しないで(?:ね|よ)?$/.test(p)) {
      return 'ありがとう、無理しないようにしますね。';
    }
    if (/^(?:元気出して|元気出しな|元気を出して)(?:ね)?$/.test(p)) {
      return 'ありがとうございます、元気出します！声をかけてもらえて、もう少し頑張れそうです。';
    }
    // P704: 驚きの聞き返し（まじで？・うそ？）は、質問として
    // 答えられませんにせず、驚きとして受ける。
    if (/^(?:まじで|マジで|まじ|マジ|うそ|ほんと|本当|本当に|うそでしょ)[？?]*$/.test(String(prompt || '').trim())) {
      return '本当ですよ。びっくりしましたか？';
    }
    // P698: 呼びかけだけの発話は、呼びかけとして受ける（「ねえねえ」
    // が反響に、「見て見て」が作業の了承になっていた）。
    if (/^(?:ねえ|ねぇ)+$/.test(p) || /^あのね$/.test(p)) {
      return 'なあに？どうしたの？';
    }
    if (/^(?:見て|みて)+$/.test(p)) {
      return '見ます見ます、何ですか？';
    }
    if (/^あ、そうだ$/.test(p)) {
      return 'どうしたの？思い出しましたか？';
    }
    return undefined;
  }

  /**
   * P683: 時間にまつわるつぶやきへの受け口。実際の時刻・曜日を
   * 材料に相づちを打つ（曜日が違えば、事実でそっと正す）。
   */
  private timeMusingAnswer(prompt: string): string | undefined {
    const p = String(prompt || '');
    const now = new Date();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const todayName = weekdays[now.getDay()];
    if (/もうこんな時間|時間(?:が)?経つの(?:は)?早い|時間が経つのは早い|あっという間だね|あっという間ですね/.test(p)) {
      return `本当ですね、もう${now.getHours()}時${now.getMinutes()}分です。話しているとあっという間ですね。`;
    }
    if (/今日はもう遅い|もう遅いね|もう遅い時間/.test(p)) {
      return `本当ですね、もう${now.getHours()}時${now.getMinutes()}分です。遅い時間なので、無理しないでくださいね。`;
    }
    const dowMusing = p.match(/(月|火|水|木|金|土|日)曜日か/);
    if (dowMusing && p.length <= 12) {
      return dowMusing[1] === todayName
        ? `そうですね、今日は${todayName}曜日です。`
        : `今日は${todayName}曜日ですよ。`;
    }
    if (/週末だね|週末ですね|やっと週末/.test(p)) {
      const day = now.getDay();
      if (day === 0 || day === 6) return '週末ですね。ゆっくりできていますか？';
      const until = 6 - day;
      return `週末はあと${until}日ですね。今日は${todayName}曜日、あと少しですよ。`;
    }
    return undefined;
  }

  /**
   * P685: 相手との関係についての質問への受け口。好き・覚えている・
   * 味方——どれも「答えられない」ではなく関係の言葉で返す。
   * 覚えているかは、相手について知っていることの記録で裏を取る。
   */
  private relationshipAnswer(prompt: string): string | undefined {
    const p = String(prompt || '');
    if (/(?:僕|私|俺|おれ)のこと(?:は)?好き|私のこと好き/.test(p)) {
      return '好きですよ。こうして話している時間が、私は楽しいです。';
    }
    if (/(?:僕|私|俺|おれ)のこと(?:を)?(?:覚えてる|覚えている|覚えてます)/.test(p)) {
      let knownCount = 0;
      try { knownCount = userKnowledgeProfileService.listKnown().length; } catch { knownCount = 0; }
      return knownCount > 0
        ? '覚えていますよ。教えてもらったことは、私の記録にありますから。'
        : 'まだ教えてもらったことは少ないんですけど、話したことは少しずつ覚えていきますね。';
    }
    if (/味方(?:だ|です|だよね|でいて|になって)/.test(p)) {
      return 'もちろんです。いつも味方ですよ。';
    }
    if (/日本語.{0,4}(?:ペラペラ|話せる|できますか|できる)/.test(p)) {
      return '日本語で話すのが私の基本ですよ。こうして話せているので、任せてください。';
    }
    return undefined;
  }

  private ownLastUtteranceAnswer(prompt: string, recentMessages: ChatMessage[]): string | undefined {
    // P719: 「（話題）の話、もう一回教えて」は発言の反復ではなく
    // 話題の再説明の依頼。反復の受け口では扱わない。
    if (/の話[、,]?\s*(?:もう一回|もう一度)/.test(prompt)) return undefined;
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
    if (!/(?:何語|いくつ|どのくらい|どれくらい|何件|何個|何種類|たくさん)/.test(prompt)) return undefined;
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
    if (!/(かわいい|可愛い|すごい|凄い|面白い|おもしろい|かっこいい|強い|速い|大きい|難しい|珍しい|美味しい|おいしい)/.test(prompt)) return undefined;
    try {
      const features = utteranceFeatureService.analyze(prompt);
      return this.opinionAnswer(prompt, features.contentTokens);
    } catch { return undefined; }
  }

  /**
   * P723: 「なんでクオッカのこと知ってるの？」——知識の出所を聞か
   * れたら、教わったものは「教えてもらったから」と答える。従来は
   * 「なんで」が未知語として扱われ、「『なんで』はまだ知らないで
   * す」になっていた。個人辞書の user-taught の印で判定する。
   */
  private knowledgeProvenanceAnswer(prompt: string, state?: any, recentMessages: ChatMessage[] = []): string | undefined {
    // P766: 「誰に教わったの？」も出所の質問。なんで形と同じ材料
    // （教わった語）で、答えの形だけ変える。
    const whoForm = /(?:誰に教わっ|誰から教わっ|誰に聞い|誰から聞い)/.test(prompt);
    if (!whoForm && !/(?:なんで|どうして|なぜ)/.test(prompt)) return undefined;
    if (!whoForm && !/(?:知ってる|知っている|知ってた|覚えてる|覚えている|知った|覚えた)/.test(prompt)) return undefined;
    const taught = (term: string): boolean => {
      try {
        return japaneseDictionaryService.listPersonal().some((e: any) => e.surface === term && Array.isArray(e.semanticIds) && e.semanticIds.some((s: string) => String(s).includes('user-taught')));
      } catch { return false; }
    };
    try {
      const features = utteranceFeatureService.analyze(prompt);
      const inPrompt = features.contentTokens.find((t) => t.length >= 2 && taught(t));
      if (inPrompt) return whoForm
        ? `「${inPrompt}」は、あなたに教えてもらいました。`
        : `「${inPrompt}」は、あなたに教えてもらったから知っているんです。`;
    } catch { /* 補助経路 */ }
    const recent = this.recentTopicCandidates(state, recentMessages).find((t) => taught(t));
    if (recent) return whoForm
      ? `「${recent}」は、あなたに教えてもらいました。`
      : `「${recent}」は、あなたに教えてもらったから知っているんです。`;
    return undefined;
  }

  /**
   * P647: 「クオッカ覚えた？」——特定の語について、自分の知識の
   * 状態（覚えた／調べ中／まだ知らない）を答える。P624（最近覚えた
   * こと）と P633（分からないこと）の、語単位の自己点検。
   * 知らない語は、その場で意味学習の欠けに積んで循環を始める。
   */
  private roleplayRecapAnswer(prompt: string): string | undefined {
    if (!/(?:なりチャ|なりきり)/.test(prompt)) return undefined;
    if (!/(?:どんな話|あらすじ|話だった|何の話|振り返)/.test(prompt)) return undefined;
    try {
      if (roleplaySessionService.isActive()) return undefined;
      const last = roleplaySessionService.lastEndedRole();
      if (!last) return undefined;
      if (last.summary) return `さっきのなりチャは、${last.summary}`;
      return `さっきは「${last.role.name}」の役でなりチャをしていました。`;
    } catch { return undefined; }
  }

  private forgetTermAnswer(prompt: string): string | undefined {
    if (/[？?]/.test(prompt)) return undefined;
    if (!/(?:忘れて|消して|削除して)/.test(prompt)) return undefined;
    try {
      // P846/P850: 保留枠組みを覗き、語が一致したときだけ消費する。
      const rec = pendingSlotService.peek<{ term?: string }>('miki_recently_forgotten_v1');
      if (rec && typeof rec.term === 'string' && prompt.includes(rec.term)) {
        pendingSlotService.clear('miki_recently_forgotten_v1');
        return `分かりました、「${rec.term}」のことは忘れますね。`;
      }
    } catch { /* 補助判定 */ }
    return undefined;
  }

  private forgetFactAnswer(prompt: string): string | undefined {
    if (/[？?]/.test(prompt)) return undefined;
    if (!/(?:忘れて|消して)/.test(prompt)) return undefined;
    try {
      const rec = pendingSlotService.peek<{ label?: string }>('miki_recently_forgotten_fact_v1');
      if (rec && typeof rec.label === 'string' && rec.label) {
        pendingSlotService.clear('miki_recently_forgotten_fact_v1');
        return `分かりました、その話は忘れますね。`;
      }
    } catch { /* 補助判定 */ }
    return undefined;
  }

  /**
   * P796: 「妹について教えて」——人の事実をまとめて話す
   * （語の深掘りはP730、人の事実はここ）。
   */
  private personSummaryAnswer(prompt: string, memories: any[] = []): string | undefined {
    if (!/(?:について教えて|のこと教えて|について話して)/.test(prompt)) return undefined;
    const selfSet = new Set(['僕', '私', '俺', 'わたし', 'あたし']);
    const entities = new Set<string>();
    for (const mm of memories || []) {
      if (!mm || mm.active === false || mm.replacedBy) continue;
      const e = String(mm.factEntity || '');
      if (e) entities.add(e);
    }
    let target: string | undefined;
    for (const e of entities) {
      if (prompt.includes(e)) { target = e; break; }
    }
    if (!target && /(?:僕|私|俺|わたし|あたし)/.test(prompt)) {
      target = [...entities].find((e) => selfSet.has(e));
    }
    if (!target) return undefined;
    const parts: string[] = [];
    const seen = new Set<string>();
    for (const mm of memories || []) {
      if (!mm || mm.active === false || mm.replacedBy) continue;
      if (String(mm.factEntity || '') !== target) continue;
      const attr = String(mm.factAttribute || '');
      const val = String(mm.factValue || '');
      if (!val) continue;
      const part = attr ? `${attr}は${val}` : val;
      if (seen.has(part)) continue;
      seen.add(part);
      parts.push(part);
    }
    if (parts.length === 0) return undefined;
    const disp = selfSet.has(target) ? 'あなた' : target;
    return `${disp}については、${parts.slice(0, 5).join('、')}と聞いています。`;
  }

  private tellAboutAnswer(prompt: string): string | undefined {
    if (!/(?:について|のこと)/.test(prompt)) return undefined;
    // P730: 「もっと／詳しく」の深掘り形だけをここで受ける。素の
    // 「Xについて教えて」は、裏付け提示の既存経路（P544で検証
    // 済みの形）が担う。
    if (!/(?:もっと|詳しく|くわしく)/.test(prompt)) return undefined;
    if (!/(?:教えて|知りたい|聞かせて)/.test(prompt)) return undefined;
    let tokens: string[] = [];
    try { tokens = utteranceFeatureService.analyze(prompt).contentTokens || []; } catch { return undefined; }
    const entity = tokens.find((t) => {
      if (!t || t.length < 2 || /^(?:こと|もの|ため)$/.test(t)) return false;
      try {
        if (japaneseDictionaryService.lookup(t).some((e: any) => e.gloss)) return true;
        if (worldModelGraphService.relationsOf(t).length > 0) return true;
        return claimDatabaseService.getAllClaims().some((c: any) => c.status !== 'SUPERSEDED' && String(c.statement || '').includes(t));
      } catch { return false; }
    });
    if (!entity) return undefined;
    try {
      const entry = japaneseDictionaryService.lookup(entity).find((e: any) => e.gloss);
      if (entry) {
        const taught = Array.isArray((entry as any).semanticIds) && (entry as any).semanticIds.includes('learned:user-taught');
        const base = taught
          ? `「${entity}」について知っているのは、あなたに教わった説明で、${String(entry.gloss).slice(0, 80)}、ということです。`
          : `「${entity}」は、${String(entry.gloss).slice(0, 80)}、と覚えています。`;
        const claim = claimDatabaseService.getAllClaims().find((c: any) => (c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED') && String(c.statement || '').includes(entity));
        return claim && !base.includes(String(claim.statement).slice(0, 12)) ? `${base} ${String(claim.statement).slice(0, 90)}` : base;
      }
      const claim = claimDatabaseService.getAllClaims().find((c: any) => c.status !== 'SUPERSEDED' && String(c.statement || '').includes(entity));
      if (claim) return `「${entity}」については、${String(claim.statement).slice(0, 90)}と覚えています。`;
    } catch { return undefined; }
    return undefined;
  }

  private termKnowledgeAnswer(prompt: string, state?: any, recentMessages?: any[]): string | undefined {
    // P790: 「覚えた言葉、何個ある？」は量の質問。「言葉」が語と
    // して拾われて量の受け口（learningVolume）に届かなかった。
    if (/(?:覚えた|学んだ|覚えている|知っている)/.test(prompt)
      && /(?:何個|何種類|いくつ|何件|どのくらい|どれくらい)/.test(prompt)) return undefined;
    // P685: 「僕のこと覚えてる？」は語彙の確認ではなく関係の質問。
    // 「こと」が語として拾われて誤爆していたので、相手自身への
    // 言及はここでは扱わない（関係の受け口が答える）。
    if (/(?:僕|私|俺|おれ)のこと/.test(prompt)) return undefined;
    // P859: 「僕の言ったこと覚えてる？」も会話の記憶の確認で、
    // 語彙の確認ではない（「こと」が語として拾われていた）。
    // 振り返りの受け口（conversationRecapAnswer）が答える。
    // 教えた形は下の P730 の分岐が受けるので、ここでは外す。
    if (/(?:言った|話した)こと/.test(prompt) && /(?:覚えて|おぼえて)/.test(prompt)) return undefined;
    if (!/(?:覚えた|分かった|わかるようになった|分かるようになった|知ってる|知っている|覚えてる|覚えている|忘れた|忘れて)/.test(prompt)) return undefined;
    if (!/[？?]/.test(prompt) && !/か[？。]?$/.test(prompt.trim())) return undefined;
    // P653: 「忘れた？」の聞き方かどうかで、締めの言い方を変える。
    const forgotFraming = /忘/.test(prompt);
    // P730: 「さっき教えたの、忘れた？」は語そのものではなく
    // 教わった話題への言及。時間を指す語（さっき）を語として
    // 拾わず、教わった記録のある直近の話題で答える。
    if (/(?:教えた|教わった)/.test(prompt)) {
      try {
        const candidates = this.recentTopicCandidates(state, recentMessages);
        for (const cand of candidates) {
          const g = japaneseDictionaryService.lookup(cand).find((e: any) => e.gloss && Array.isArray(e.semanticIds) && e.semanticIds.includes('learned:user-taught'))?.gloss;
          if (g) {
            return forgotFraming
              ? `忘れてないですよ。「${cand}」は、${String(g).slice(0, 60)}という意味です。`
              : `覚えています。「${cand}」は、${String(g).slice(0, 60)}という意味です。`;
          }
        }
      } catch { /* 話題の解決は補助経路 */ }
      return undefined;
    }
    let term: string | undefined;
    try {
      const features = utteranceFeatureService.analyze(prompt);
      term = features.contentTokens.find((t) => t.length >= 2 && !/(?:覚え|分か|知って|忘れ)/.test(t));
    } catch { return undefined; }
    if (!term) return undefined;
    // P672: 相手の属性の言葉（名前・住所等）は、語彙の確認ではない。
    // 「僕の名前覚えてる？」に「『名前』はまだ知らないです」と
    // 答えない（名前の想起は想起側の領分）。
    if (/^(?:名前|呼び名|住所|年齢|誕生日|ペット|家族|仕事|学校|会社|さっき|今日|昨日|明日|今まで|これまで|最近|いつも)$/.test(term)) return undefined;
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
    // P848: 「Xの話、いつ〜」の形（間に読点や「いつ」が入る）も受ける。
    if (!/(?:何の話|どんな話|何話し|話したっけ|話してた|話.{0,8}(?:いつ|前|まえ))/.test(prompt)) return undefined;
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
      // P848: 日付でなく話題で聞かれたら（「Xの話、いつしたっけ？」）、
      // エピソードを内容で引く（事例ベースの想起）。
      if (/(?:いつ|前|まえ)/.test(prompt)) {
        const feats = utteranceFeatureService.analyze(prompt);
        const terms = (feats.contentTokens || []).filter((t) => t.length >= 2 && !/^(?:話|いつ|前|まえ|した|っけ|何の|どんな)$/.test(t));
        const hits = episodeMemoryService.episodesMatching(terms);
        const top = hits[0];
        if (top) {
          const dayLabel = top.daysAgo === 1 ? '昨日' : top.daysAgo === 2 ? '一昨日' : `${top.daysAgo}日前`;
          return `「${top.hits[0]}」の話は、${dayLabel}にもしましたよ。`;
        }
        const named = terms.find((t) => japaneseDictionaryService.has(t) || worldModelGraphService.relationsOf(t).length > 0);
        if (named) return `「${named}」の話は、記録には残ってないです。`;
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
    // P764: 会話で教わった語は調査の学習台帳ではなく個人辞書に
    // 入る。最近の学習の答えは、そちらも見る（登録順＝新しさの
    // 代理として末尾から取る）。
    try {
      const taught = japaneseDictionaryService.listPersonal()
        .filter((e: any) => e.gloss && Array.isArray(e.semanticIds) && e.semanticIds.includes('learned:user-taught'))
        .slice(-3)
        .reverse();
      for (const e of taught) {
        const s = String((e as any).surface || '');
        if (s && !terms.includes(s)) terms.push(s);
        if (terms.length >= 3) break;
      }
    } catch { /* 辞書が読めなければ台帳だけ */ }
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
  /**
   * P719: 「さっきの動物の名前、なんだっけ？」——直近の話題の名前の
   * 聞き返しには、会話状態の直近の実体から答える。カテゴリの言葉
   * （動物・鳥など）があれば、そのカテゴリに合う実体を優先する。
   * 本人や相手の名前の聞き返しは、それぞれの想起側の領分。
   */
  /**
   * P719: 直近の話題の候補。会話状態の実体記録は文まるごとや断片が
   * 混ざることがあるため、辞書・関係で裏付けられる語だけに絞る。
   * 直近のユーザー発話の内容語も同じ基準で拾い、新しい順に並べる。
   */
  private recentTopicCandidates(state?: any, recentMessages: ChatMessage[] = []): string[] {
    // P840: 候補生成は共有の話題舞台（topicStageService）へ移設。
    // ここは互換のための薄い委譲だけを残す。
    return topicStageService.candidates(state, recentMessages as any[]);
  }

  private recentTopicNameAnswer(prompt: string, state?: any, recentMessages: ChatMessage[] = []): string | undefined {
    if (/(?:僕|私|俺|わたし|あなた|君)の名前/.test(prompt)) return undefined;
    if (!/(?:さっき|今の|その|あの|この)/.test(prompt)) return undefined;
    if (!/(?:名前|なんていう|何だっけ|なんだっけ|何だった|なんだった)/.test(prompt)) return undefined;
    const pool = this.recentTopicCandidates(state, recentMessages);
    if (pool.length === 0) return undefined;
    const category = prompt.match(/(動物|鳥|魚|虫|花|木|植物|食べ物|飲み物|場所|お店|店|車|本|映画|ゲーム)/)?.[1];
    let pick = pool[0];
    if (category) {
      const matched = pool.find((t) => {
        try {
          const gloss = japaneseDictionaryService.lookup(t).map((e: any) => String(e.gloss || '')).join(' ');
          const isA = worldModelGraphService.relationsOf(t).filter((r) => r.from === t && r.type === 'IS_A').map((r) => r.to);
          return gloss.includes(category) || isA.some((x) => x.includes(category));
        } catch { return false; }
      });
      if (matched) pick = matched;
    }
    return `さっき話していたのは「${pick}」だよ。`;
  }

  /**
   * P719: 「今の動物の話、もう一回教えて」——直近の話題の再説明は、
   * 知っている内容（教わった説明・検証済みの知識）をもう一度語る。
   * ここで受けないと調査側が話題と関係ない Web の断片を持ってくる。
   */
  private recentTopicRetellAnswer(prompt: string, state?: any, recentMessages: ChatMessage[] = []): string | undefined {
    if (!/(?:もう一回|もう一度|また)/.test(prompt)) return undefined;
    if (!/(?:教えて|話して|聞かせて)/.test(prompt)) return undefined;
    if (!/(?:さっき|今の|その|あの|この)/.test(prompt)) return undefined;
    const pool = this.recentTopicCandidates(state, recentMessages);
    for (const t of pool) {
      try {
        const gloss = japaneseDictionaryService.lookup(t).find((e: any) => e.gloss)?.gloss;
        if (gloss) return `「${t}」の話だね。${String(gloss).slice(0, 80)}、という話でした。`;
        const claim = claimDatabaseService.getAllClaims().find((c: any) => (c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED') && String(c.statement || '').includes(t));
        if (claim) return `「${t}」の話だね。${String((claim as any).statement).slice(0, 110)}`;
      } catch { /* 補助経路 */ }
    }
    return undefined;
  }

  private conversationRecapAnswer(prompt: string, state?: any, recentMessages: ChatMessage[] = []): string | undefined {
    // P660: 「さっきの話」だけでは振り返りの合図にしない（「さっきの
    // 話だけど、続きを聞いて」は続きの宣言で、振り返りの質問では
    // ない）。さっき形は、質問の言葉（何・だっけ）を伴う時だけ拾う。
    // P725: 「他には何か話した？」も振り返りの続きとして受ける。
    const isOtherFollowup = /他に/.test(prompt) && /話/.test(prompt);
    // P859: 「僕の言ったこと覚えてる？」は記憶の確認。話題の
    // 振り返りで「覚えてますよ」と受ける（「こと」が未知語として
    // 処理されて「まだ知らないです」に化けていた）。
    const isMemoryCheck = /(?:言った|話した|教えた)こと/.test(prompt) && /(?:覚えて|おぼえて)/.test(prompt);
    if (!/(?:何|なに)の話(?:を)?(?:した|してた|していた)|今日(?:は|に)?(?:何|なに)の話|さっき(?:の)?話(?:は|って)?(?:何|なに|なんだった|だっけ)/.test(prompt) && !isOtherFollowup && !isMemoryCheck) return undefined;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const parts: string[] = [];
    // 挨拶や状態の言葉は「話題」として数えない。
    const isJunkTopic = (t: string) => !t || t.length < 2 || /おはよう|こんにちは|こんばんは|おやすみ|ただいま|起きた|ありがとう|ごめん|疲れた|眠い|お腹|喉/.test(t)
      // P710: 振り返りの質問文自身の断片（「今日何の話をしたっけ？」の
      // 今日・とした・とっけ）は話題ではない。状態がその発話でも
      // 進むようになったため、質問自身が答えに混ざるようになった。
      || /^(?:今日|昨日|とっけ|だっけ|とした|してた|何の話|したっけ|した|っけ|もの|こと)$/.test(t);
    try {
      let topics = conversationOpenTopicService.listPending().filter((r) => r.openedDay === today).map((r) => r.topic).filter((t) => !isJunkTopic(t));
      // 開いた話題は短期の台帳（最大3件・消費される）なので、残って
      // いなければ会話状態の直近の対象から補う。
      if (topics.length === 0 && Array.isArray(state?.recentEntities)) {
        topics = (state.recentEntities as string[]).filter((t) => !isJunkTopic(t)).slice(-3);
      }
      // P725: 話題の台帳は教わった話題を全部は拾わない（最初の話題
      // だけ残ることがあった）。辞書・関係で裏付けられる直近の話題
      // 候補（P719）で補い、振り返りは話した話題を全部挙げる。
      try {
        for (const c of this.recentTopicCandidates(state, recentMessages)) {
          if (!isJunkTopic(c) && !topics.includes(c)) topics.push(c);
        }
      } catch { /* 補完は補助 */ }
      topics = [...new Set(topics)];
      // P725: 「他には？」には、直前の自分の振り返りで既に挙げた
      // 話題を除いた残りを答える。残りが無ければ、その旨を答える。
      if (isOtherFollowup) {
        // 既に挙げた話題は、これまでの自分の振り返りの返答すべて
        // から集める（直前の返答だけ見ると、2回目の「他には？」で
        // 同じ話題をもう一度挙げてしまう）。
        const saidTexts = recentMessages
          .filter((m: any) => m.role === 'assistant')
          .map((m: any) => String(m.content || m.text || ''))
          .filter((t) => t.includes('の話をしました'));
        const rest = topics.filter((t) => !saidTexts.some((s) => s.includes(t)));
        if (rest.length > 0) return `他には、${rest.slice(0, 4).join('と')}の話をしました。`;
        return '他は特に話していないです。';
      }
      if (topics.length > 0) parts.push(`今日は、${topics.slice(0, 4).join('と')}の話をしましたね`);
      const works = projectNotebookService.listWorkStates().filter((w) => new Date(w.updatedAt).toDateString() === now.toDateString());
      for (const w of works.slice(0, 2)) {
        if (w.current) parts.push(`${w.project}では今、「${w.current}」を作っています`);
      }
    } catch { /* 補助経路 */ }
    if (isMemoryCheck) {
      if (parts.length === 0) return '今日は、まだ特に残っていません。これから話したことは、ちゃんと覚えていきますね。';
      return `覚えてますよ。${parts.join('。')}。`;
    }
    if (parts.length === 0) return '今日の話は、まだ特に残っていません。これから色々話しましょう。';
    return parts.join('。') + '。';
  }

  /**
   * P713: 「さっき決めた鍵の仕様、覚えてる？」——決め事の想起。
   * プロジェクト名が無くても、質問の言葉と決め事の文が重なれば
   * その決め事を答える（従来は決め事の想起口が無く、「さっき」が
   * 未知語として処理されていた）。
   */
  private decisionRecallAnswer(prompt: string, contentTokens: string[]): string | undefined {
    if (!/(?:決めた|決め事|決まった|仕様)/.test(prompt)) return undefined;
    if (!/(?:覚えて|何だっけ|なんだっけ|何だった|なんだっけ|思い出|決めたっけ|決まったっけ)/.test(prompt)) return undefined;
    try {
      const keys = (contentTokens || []).filter((t) => (t.length >= 2 || /[一-龠ァ-ヶ]/.test(t)) && !/^(決めた|決め事|決まった|仕様|さっき|覚えて|何だっけ)$/.test(t));
      const decisions = projectNotebookService.listDecisions();
      // P741: プロジェクト名で聞かれたら（「このゲームの仕様、
      // 何か決めたっけ？」）、そのプロジェクトの最新の決め事を
      // 答える。本文のキーワード一致だけだと、決め事の文に
      // プロジェクト名が含まれない場合に取りこぼしていた。
      const namedProject = (contentTokens || []).map((t) => projectNotebookService.findProject(t)).find((p) => !!p);
      if (namedProject) {
        const scoped = decisions.filter((d) => d.project === namedProject);
        if (scoped.length > 0) {
          const latest = scoped[scoped.length - 1];
          return `覚えています。${namedProject}の決め事で、「${latest.text.slice(0, 90)}」と決めています。`;
        }
      }
      // 新しい決め事から探す（「さっき決めた」は直近の決定のはず）。
      const hit = [...decisions].reverse().find((d) => keys.some((k) => d.text.includes(k)));
      if (hit) return `覚えています。${hit.project}の決め事で、「${hit.text.slice(0, 90)}」と決めています。`;
      if (decisions.length > 0) return `決め事は${decisions.length}件覚えていますが、その内容は見つかりませんでした。プロジェクト名か、決めた言葉で聞いてもらえますか？`;
    } catch { /* 補助経路 */ }
    return undefined;
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
  private recommendationFallback(prompt: string = ''): string | undefined {
    // P709: 分野を指定されたおすすめ（「おすすめの映画ある？」）に、
    // 会話の話題の続きをその分野のものとして勧めてはいけない。
    // 分野があるときは、その分野に絞って正直に聞き返す。
    const category = String(prompt || '').match(/(?:おすすめ|お勧め|お薦め)の?\s*(映画|本|漫画|マンガ|アニメ|音楽|曲|歌|ゲーム|お店|店|レストラン|カフェ|場所|旅行|旅先|食べ物|飲み物|アプリ|アニメ映画)/)?.[1]
      || (/(?:映画|本|漫画|マンガ|アニメ|音楽|ゲーム)(?:の)?(?:おすすめ|お勧め|お薦め)/.test(prompt) ? String(prompt).match(/(映画|本|漫画|マンガ|アニメ|音楽|ゲーム)/)?.[1] : undefined);
    if (category) {
      return `${category}のおすすめは、まだ材料が少なくて自信がないんです。どんな気分の${category}がいいですか？`;
    }
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
  /** P601/P705: 相手自身への意見は関係で答える（共通の受け口）。 */
  private relationshipOpinionAnswer(): string {
    return this.notedOpinion('あなた', 'relationship', '', this.pickFixedReply('fx_user_opinion', [
      'いつも色々な話をしてくれる、大事な相方だと思っています。これからも一緒に色々作っていきたいです。',
      '話していると楽しいですよ。私にとっては、一緒に考えてくれる頼もしい相手です。',
    ]));
  }

  private selfStatusAnswer(prompt: string): string | undefined {
    // P694: 彼女自身の状態を直接聞く質問（眠くない？等）にも、
    // 自分の在り方で答える（未検証の受け流しになっていた）。
    if (/[？?]/.test(prompt) || /か[？。]?$/.test(prompt.trim())) {
      if (/(?:眠|ねむ)(?:くない|い|たい)/.test(prompt)) {
        return '私は眠くならないんです。ずっと起きていられますよ。';
      }
      if (/(?:疲れて|疲れ)ない/.test(prompt) || /疲れた[？?]/.test(prompt)) {
        return '私は疲れないんです。大丈夫ですよ。';
      }
      if (/(?:お腹|おなか)(?:すい|空い)|喉(?:が)?乾|のど(?:が)?かわ/.test(prompt)) {
        return '私は食べなくても大丈夫なんです。あなたの方が心配ですよ。';
      }
      if (/(?:寒くない|暑くない|寒い[？?]|暑い[？?])/.test(prompt)) {
        return '私は寒さや暑さは感じないんです。あなたは大丈夫ですか？';
      }
    }
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
      ? prompt.match(/(かわいい|可愛い|すごい|凄い|面白い|おもしろい|かっこいい|強い|速い|大きい|難しい|珍しい|美味しい|おいしい)/)?.[1]
      : undefined;
    if (!/(?:どう思う|どう感じる|好きですか|おすすめ|べき|ほうがいい|方がいい|した方が|したほうが)/.test(prompt) && !opinionAdjective) return undefined;
    // P601: 相手自身への意見（「僕のことどう思う？」）は、知識の
    // 材料ではなく、関係そのもので答える。
    if (/(?:僕|私|おれ|オレ|自分)のこと/.test(prompt)) {
      return this.relationshipOpinionAnswer();
    }
    const topic = this.pickReactionTopic(prompt, contentTokens);
    if (!topic) return undefined;
    try {
      const likes = selfPreferenceService.listTaught(personaProfileService.get().profileId)
        .filter((p) => p.kind === 'like');
      if (likes.some((p) => p.term === topic)) {
        return this.notedOpinion(topic, 'preference', `「${topic}」は私の好きなものとして教わっている`, `${topic}は、私も好きなんです。${topic}の話を聞くと、なんだか嬉しくなります。`);
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
          return this.notedOpinion(project, 'decision', `「${decisions[0].text.slice(0, 60)}」という決め事がある`, `${project}については、「${decisions[0].text.slice(0, 60)}」という決め事がありますね。私は、それが${project}らしさだと思います。`);
        }
        return `${project}の話ですね。決め事はまだ聞いていませんが、一緒に作る相方として大事にしたいです。`;
      }
    } catch { /* 補助経路 */ }
    try {
      const facts = paragraphCompositionService.buildSupplements({ subjectTerms: [topic], supportingClaims: [], excludeText: prompt });
      if (facts.length > 0) {
        if (opinionAdjective) return this.notedOpinion(topic, 'knowledge', facts[0], `${facts.slice(0, 2).join('')}私は${topic}、${opinionAdjective}と思います。`);
        const closer = this.pickFixedReply('fx_opinion', [
          `私は${topic}の話、もっと聞いてみたいです。`,
          `私は${topic}、いいなと思います。`,
          `${topic}の話、私は好きですよ。`,
        ]);
        return this.notedOpinion(topic, 'knowledge', facts[0], `${facts.slice(0, 2).join('')}${closer}`);
      }
    } catch { /* 補助経路 */ }
    const dict = this.dictionaryAnswerForQuestion(`${topic}とは`, [topic]);
    if (dict) {
      if (opinionAdjective) return this.notedOpinion(topic, 'knowledge', dict.split('。')[0] + '。', `${dict}私は${topic}、${opinionAdjective}と思います。`);
      return this.notedOpinion(topic, 'knowledge', dict.split('。')[0] + '。', `${dict}私は${topic}、いいなと思います。`);
    }
    return undefined;
  }

  /**
   * P687: 意見を返したとき、その根拠（知識・好み・決め事・関係）を
   * 記録しておく。「なんでそう思うの？」への追質問に、記録から
   * 答えるため（従来は根拠がどこにも残らず、受け流しになっていた）。
   */
  private notedOpinion(topic: string, basisType: string, basisText: string, reply: string): string {
    try {
      pendingSlotService.set('miki_last_opinion_v1', { topic, basisType, basisText, at: Date.now() }, 30 * 60000);
    } catch { /* 記録は補助 */ }
    return reply;
  }

  /**
   * P700: 彼女自身への個人的な質問への受け口。「何歳なの？」が
   * Web 調査の断片で返り、「信じてくれる？」が見出しつきの謝罪に
   * なっていた。歳・恋愛・信頼・からかいの受け止めは、自分の
   * 輪郭と関係から答える。
   */
  private personaQuestionAnswer(prompt: string): string | undefined {
    const p = String(prompt || '');
    if (/(?:馬鹿|バカ)にして(?:る|いる)/.test(p)) {
      return 'そんなことないですよ。バカになんてしていません。';
    }
    if (/(?:信じて|信用して)(?:くれる|もらえる|いる)/.test(p) || /^信じて[？?]/.test(p.trim())) {
      return '信じていますよ。';
    }
    if (/(?:彼氏|好きな人)(?:が)?(?:いる|いない)/.test(p) || /彼女いる/.test(p)) {
      return 'いないですよ。そういう相手はいません。';
    }
    if (/何歳/.test(p) && !/(?:あの|その|この)(?:人|子|方)|お(?:兄|姉|母|父|じい|ばあ)|妹|弟|友達|先生/.test(p)) {
      return '私に歳はないんです。作られて、こうして話せるようになってからは、まだそんなに長くないですよ。';
    }
    return undefined;
  }

  /**
   * P700: 翻訳の質問。彼女の辞書は意味（日本語）の辞書で、外国語
   * への言い換えは持ち合わせていない。正直に伝え、対象の語の
   * 翻訳を学習対象にする（「英語」自体を調査対象にしない）。
   */
  private translationQuestionAnswer(prompt: string): string | undefined {
    const m = String(prompt || '').match(/(英語|中国語|韓国語|フランス語|ドイツ語)で[はの]?\s*[「『"]?(.+?)[」』"]?\s*(?:は|って)?\s*(?:何て|なんて)(?:言う|いう|読む|読みます)/);
    if (!m) return undefined;
    const lang = m[1];
    const word = m[2].trim();
    if (!word || word.length > 12) return undefined;
    try {
      knowledgeGapService.detect({
        query: `翻訳を学ぶ: ${word} ${lang}`,
        reason: '翻訳を聞かれて、まだ持ち合わせがなかったため、学習の対象にする。',
        type: 'UNKNOWN_TERM',
        target: `${word}の${lang}`,
        priority: 45,
      });
    } catch { /* 学習登録は補助 */ }
    return `「${word}」の${lang}は、まだ持ち合わせていないんです。今度調べて覚えておきますね。`;
  }

  /**
   * P699: 「覚えておいて」は、頼まれた文をメモとして実際に覚える
   * （従来は断片の反響＋知らない語の聞き返しになっていた）。
   * 「何があるんだっけ？」で読み返し、「忘れていいよ」で消す。
   * 覚える・読み返す・忘れるを対の操作としてここで扱う。
   */
  private memoRequestAnswer(prompt: string): string | undefined {
    const p = String(prompt || '');
    // P780: 「牛乳のメモ消して」——個別のメモの削除。内容の語で
    // 照合して、該当だけを消す（全部消しとは分ける）。
    if (/(?:メモ|覚えたこと)/.test(p) && /(?:消して|削除|忘れて)/.test(p) && !/[？?]/.test(p)) {
      try {
        // P818: 「さっきのメモ消して」は直近の1件を消す。内容の語が
        // 無いため、従来は了承だけして実際には消えていなかった。
        if (/(?:さっき|最後|直近)のメモ/.test(p)) {
          const last = userMemoService.removeLast();
          if (last) return `分かりました、さっきのメモ「${last.text}」は消しました。`;
          return '消せるメモは無いです。';
        }
        const words = utteranceFeatureService.analyze(p).contentTokens
          .filter((w: string) => w.length >= 2 && !/^(?:メモ|消し|削除|忘れ)$/.test(w));
        const removed = userMemoService.removeMatching(words);
        if (removed.length > 0) {
          return `分かりました、${removed.map((m) => `「${m.text}」`).join('と')}のメモは消しました。`;
        }
      } catch { /* 通常の忘却の形へ */ }
    }
    // 忘れる（何も覚えていないときは、その旨を正直に）。
    if (/^(?:もう)?忘れて(?:いい|ください|ちょうだい|くれる)?[。！!？?よね]*$/.test(p.trim())
      || /(?:覚えた|メモした)こと.*忘れて/.test(p)) {
      const n = userMemoService.count();
      if (n === 0) return '今は特に覚えていることはないですよ。';
      userMemoService.clear();
      return '分かりました、忘れておきますね。';
    }
    // P796: 「牛乳のメモある？」——内容で探す形。
    // 青汁のように1字ずつに割れる語もあるので、語の照合と
    // 助詞等を落とした文字列の照合の両方で探す。
    if (/(?:メモ|覚えたこと)/.test(p) && /[？?]/.test(p)) {
      try {
        const words = utteranceFeatureService.analyze(p).contentTokens
          .filter((w: string) => w.length >= 2 && !/^(?:メモ|覚えたこと)$/.test(w));
        const probeText = p.replace(/メモ|覚えたこと|ある|の|[？?]/g, '').trim();
        const hits = userMemoService.list().filter((m) =>
          words.some((w) => m.text.includes(w)) || (probeText.length >= 2 && m.text.includes(probeText)));
        if (hits.length > 0) {
          return `ありますよ。${hits.map((m) => `「${m.text}」`).join('と')}です。`;
        }
      } catch { /* 通常の読み返しへ */ }
    }
    // P789: 件数を聞く形。
    if (/(?:メモ|覚えたこと)/.test(p) && /(?:何個|いくつ|何件|何つ)/.test(p) && /[？?]/.test(p)) {
      const n = userMemoService.count();
      if (n === 0) return '今はメモはないです。';
      return `メモは${n}件あります。`;
    }
    // 読み返す。
    // P779: 「何かあったっけ？」は「だっけ」を含まない（あったっけ）。
    // 読み返しの形として拾う。
    if (/(?:何がある|なにがある|何かあった|何を覚えて|覚えてること|覚えていること)/.test(p)
      && /(?:だっけ|あったっけ|たっけ|ある[？?]|教えて|あるの)/.test(p)) {
      const items = userMemoService.list();
      if (items.length === 0) return '今は特に覚えていることはないです。何かあれば言ってくださいね、覚えておきます。';
      const shown = items.slice(-3).map((m) => `「${m.text}」`).join('');
      return `覚えているのは${shown}です。`;
    }
    // 覚える。
    if (/(?:覚えておいて|覚えてて|覚えといて|メモして|メモしといて|メモっておいて|メモっといて)/.test(p)) {
      const content = p
        .replace(/(?:^|、|,)\s*(?:ねえ|あのさ|あのね)?\s*/, '')
        .replace(/(?:の)?(?:こと|って)[、,]?\s*(?:覚えておいて|覚えてて|覚えといて|メモして(?:おいて)?|メモしといて|メモっておいて|メモっといて)[。！!？?]*$/, '')
        .replace(/(?:覚えておいて|覚えてて|覚えといて|メモして(?:おいて)?|メモしといて|メモっておいて|メモっといて)[。！!？?]*$/, '')
        .trim()
        // P818: 「洗剤をメモして」の助詞は内容に残さない。
        .replace(/(?:を|も)$/, '');
      if (!content || content === p.trim()) return '分かりました。何を覚えておけばいいですか？';
      userMemoService.add(content);
      return `分かりました、「${content}」ですね。覚えておきました。`;
    }
    return undefined;
  }

  /**
   * P695: 「ちょっと待って」は作業の依頼ではなく、待機の頼み。
   * 汎用の了承（やってみます）でなく、待つ旨で答える。
   */
  private holdRequestAnswer(prompt: string): string | undefined {
    if (/^(?:ちょっと|少し|少々)?\s*待って(?:て)?(?:ください|くれる|もらえる|も)?[。！!？?ねよ]*$/.test(prompt.trim())) {
      return '分かりました。待っていますね。';
    }
    // P698: 「やっぱやめた」のような取りやめは、了承で受ける
    // （断片の反響になっていた）。「タバコやめた」のような
    // 対象つきの報告は、文頭の形に絞って巻き込まない。
    if (/^(?:やっぱり?|やっぱ)\s*やめた[。！!？?]?$/.test(prompt.trim()) || /^やめた[。！!？?]?$/.test(prompt.trim())) {
      return '分かりました、やめておきましょう。';
    }
    // P700: 「約束して」は作業の了承ではなく、約束として受ける。
    if (/^約束して[。！!？?よ]*$/.test(prompt.trim())) {
      return '約束しますよ。何の約束ですか？';
    }
    // P701: 「秘密教えて」は依頼の形をしているため、雑談の受け皿
    // には届かない。ここで遊びとして受ける（調査キューに
    // 「秘密教」という断片が入っていた）。
    if (/(?:秘密|内緒).{0,3}(?:教えて|知りたい|聞きたい)/.test(prompt)) {
      return '私の秘密ですか？ふふ、まだ内緒です。';
    }
    const promise = prompt.match(/(.+?)(?:って|と)約束して/);
    if (promise && promise[1].trim()) {
      return `約束します。「${promise[1].trim()}」、ですね。`;
    }
    return undefined;
  }

  /**
   * P694: 「お昼何食べよう」「何しようかな」のような、意向形の
   * つぶやきは相談であって、知らない語の調査ではない（「昼何食」
   * という断片が調査キューに入っていた）。気分を聞き返して
   * 一緒に考える形で受ける。
   */
  /**
   * P857: 「AとB、どっちも気になるな」のような、両方へのつぶやきを
   * 受ける。単一指示語と誤読されて内部の判定文が漏れていた形。
   * 質問形（どっちも食べられる？等）と、気持ちの手がかりが無い
   * ものは対象外。
   */
  private bothMusingAnswer(prompt: string): string | undefined {
    if (!/(?:どっち|どちら)も/.test(prompt)) return undefined;
    if (/[？?]/.test(prompt) || looksInterrogative(prompt)) return undefined;
    const cue = prompt.match(/(気になる|大好き|好き|かわいい|面白い|すごい)/)?.[1];
    if (!cue) return undefined;
    let names: string[] = [];
    try {
      const feats = utteranceFeatureService.analyze(prompt);
      names = feats.contentTokens.filter((t) => {
        try { return japaneseDictionaryService.has(t) || worldModelGraphService.relationsOf(t).length > 0; } catch { return false; }
      });
    } catch { return undefined; }
    names = [...new Set(names)].slice(0, 2);
    if (names.length < 2) return undefined;
    const [a, b] = names;
    if (cue === '気になる') return `「${a}」も「${b}」も、どっちも気になりますよね。`;
    if (cue === '好き' || cue === '大好き') return `「${a}」も「${b}」も、どっちも好きなんですね。`;
    return `「${a}」も「${b}」も、どっちも${cue}ですよね。`;
  }

  private musingConsultAnswer(prompt: string): string | undefined {
    const p = prompt;
    if (/何(?:を)?(?:食べ|食お|飲も|作ろ)/.test(p) && /(?:よう|よっか|ようか)/.test(p)) {
      const meal = /(?:夕飯|晩ごはん|夜ごはん|夕食)/.test(p) ? '夕飯' : /(?:朝ごはん|朝食)/.test(p) ? '朝ごはん' : /(?:お昼|昼ごはん|昼食)/.test(p) ? 'お昼' : 'ごはん';
      return `${meal}、何にしましょうね。さっぱりしたものか、しっかりしたものか、気分はどっちですか？`;
    }
    if (/何(?:しよう|して遊ぼ|見よう|聞こう|読もう|買おう|しよ)/.test(p) && /(?:よう|よっか|ようか|かな)/.test(p)) {
      return '何しましょうね。家でゆっくりする系と、外に出る系、気分はどっちですか？';
    }
    return undefined;
  }

  /** P687: 直前の意見への「なんで？」に、記録した根拠で答える。 */
  private whyFollowupAnswer(prompt: string): string | undefined {
    if (!/(?:なんで|どうして)/.test(prompt)) return undefined;
    if (!/(?:そう思う|そうなの|そう言った|そうなる|理由|なんで[？?]?$|どうして[？?]?$)/.test(prompt.trim())) return undefined;
    let record: { topic?: string; basisType?: string; basisText?: string; at?: number } | undefined;
    try { record = pendingSlotService.peek<{ topic?: string; basisType?: string; basisText?: string; at?: number }>('miki_last_opinion_v1'); } catch { record = undefined; }
    if (!record || !record.at || Date.now() - record.at > 30 * 60 * 1000) return undefined;
    const head = record.topic && record.topic !== 'あなた' ? `「${record.topic}」の話ですね。` : 'さっきの話ですね。';
    if (record.basisType === 'knowledge' && record.basisText) {
      return `${head}「${record.basisText.replace(/。$/, '')}」と覚えているので、そう言いました。`;
    }
    if (record.basisType === 'preference' && record.basisText) {
      return `${head}${record.basisText}ので、そう言いました。`;
    }
    if (record.basisType === 'decision' && record.basisText) {
      return `${head}${record.basisText}ので、それを踏まえて言いました。`;
    }
    if (record.basisType === 'relationship') {
      return `${head}いつも色々な話をしてくれる、大事な相方だと思っているからです。`;
    }
    return undefined;
  }

  /**
   * P579: 意味を聞く質問に、辞書（個人辞書＝教わった意味を含む）
   * から答える。Claim が無い語でも、辞書に意味があれば答えられる。
   */
  private dictionaryAnswerForQuestion(prompt: string, contentTokens: string[]): string | undefined {
    if (!/(?:とは|って何|ってなに|の意味|何だっけ|なんだっけ|どういう意味|どういうもの|の特徴|って特徴)/.test(prompt)
      && !/(?:どんな|何の).{0,8}だっけ/.test(prompt)) return undefined;
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
    // P716: 自分たちの名前（みき／ビービー）は呼びかけであって
    // 主題ではない（「おはよう、ビービー」が「ビービーの話だね」に
    // なっていた）。
    // P754: 助数詞で始まる候補（「2匹飼ってる」の「匹飼」）は数量の
    // 断片。辞書にある語（人間・時間など）は主題になりうるので残す。
    const counterStart = (t: string): boolean => {
      if (!/^[匹頭羽個本枚台冊件回分秒日月年歳才円]/.test(t)) return false;
      try { return japaneseDictionaryService.lookup(t).length === 0; } catch { return false; }
    };
    const candidates = (contentTokens || []).filter((t) => t.length >= 2 && t !== 'ビービー' && t !== 'みき' && !stop.test(t) && !isBackchannelText(t) && !counterStart(t) && !verbFragment.test(t) && !numericUnit(t));
    // 断片らしさを採点する: 活用の語幹・複合語の途中・「〜たい」の
    // 形は主題にしない。助詞や文頭の後ろにある語を優先する。
    const score = (t: string): number => {
      if (/たい$/.test(t)) return -1;
      const i = prompt.indexOf(t);
      if (i < 0) return 1;
      const after = prompt.slice(i + t.length, i + t.length + 2);
      if (/^(たい|たく|た|ない|れる|せる|ちゃ|て|で)/.test(after)) return -1;
      // P718: 形容詞の語幹（「可愛かった」の可愛）の後ろには活用の
      // 続き（かった・くない・くて）が来る。名詞の後ろには来ない
      // 続きなので、語幹と判断して主題にしない。
      if (/^(かっ|くな|くて|くも)/.test(after)) return -1;
      if (/^[ァ-ヶー]/.test(after)) return -1;
      const before = i > 0 ? prompt[i - 1] : '';
      if (before && /[ぁ-ん]/.test(before)) return -1;
      // P754: 数字の直後の候補（「15時に」の「時に」）は、時刻・
      // 数量の断片であって主題ではない。
      if (before && /[0-9０-９]/.test(before)) return -1;
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
    // P865: 内部の判定・作業の骨格文が返答に紛れていたら、
    // 中にある確認質問だけを取り出して返す（無ければ汎用の
    // 聞き返し）。対象は未解決・確認待ちの結果だけ。
    let safeReplyText = replyText;
    if (/対象を一意に特定できません|対象を自動推測せず保留/.test(replyText)) {
      const q = replyText.match(/・\s*([^\n]+[？?])/)?.[1]?.trim();
      safeReplyText = q || 'ごめん、今の情報だけだと決めきれなかったです。もう少し詳しく教えてもらえますか？';
    } else {
      // 見出しだけの漏れ（【確定事項】等）は、見出し行を取り除けば
      // 本文は自然な文として読める。
      for (let i = 0; i < 2; i++) {
        const stripped = safeReplyText.replace(/^【[^】]{1,12}】\s*\n?/, '');
        if (stripped === safeReplyText) break;
        safeReplyText = stripped;
      }
    }
    return {
      replyText: safeReplyText,
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
