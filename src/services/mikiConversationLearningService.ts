import {
  ClaimRecord,
  ConversationState,
  DialogueAct,
} from '../types';
import { claimDatabaseService } from './claimDatabaseService';
import {
  mikiUnifiedLearningContinuumService,
  normalizeKey,
  LearningProfile,
} from './mikiUnifiedLearningContinuumService';
import { UnifiedOutcome } from './unifiedMikiExperienceService';
import { systemLogger } from './systemLogger';

export interface PreviousTurnEvaluationResult {
  observed: boolean;
  outcome: UnifiedOutcome;
  verified: boolean;
  key: string;
  reason: string;
  promotedClaims: ClaimRecord[];
}

export interface TeachingDetectionResult {
  detected: boolean;
  extractedStatement?: string;
  candidateClaim?: ClaimRecord;
  message?: string;
}

export interface ClaimCandidatePromotionEvaluation {
  eligible: boolean;
  reason: string;
  confidence: number;
  uses: number;
  failures: number;
  verified: number;
}

/**
 * 統合版指示書 第3章 / 第6章 / 第7章
 * 会話応答の学習的昇格およびユーザー教示管理サービス (Miki Conversation Learning Service)
 * 
 * LLMに依存せず、ユーザーの発話反応（肯定・訂正・継続・教示）から
 * 応答パターンおよびClaim候補の品質と確信度を統計的に評価し、
 * 4大客観基準（反復確認・ゼロ訂正・高確信度）を満たした場合にのみVERIFIEDへ自動昇格させる。
 */
export class MikiConversationLearningService {
  private static instance: MikiConversationLearningService;

  private constructor() {}

  public static getInstance(): MikiConversationLearningService {
    if (!MikiConversationLearningService.instance) {
      MikiConversationLearningService.instance = new MikiConversationLearningService();
    }
    return MikiConversationLearningService.instance;
  }

  /**
   * 直前の非LLM中核の応答結果（特にUNRESOLVEDまたはNEEDS_CONFIRMATION、または推論適用）に対する
   * ユーザーの次の発言を観測し、学習基盤へ記録する。
   */
  public evaluatePreviousTurn(
    currentPrompt: string,
    state: ConversationState
  ): PreviousTurnEvaluationResult {
    const defaultResult: PreviousTurnEvaluationResult = {
      observed: false,
      outcome: 'SUCCESS',
      verified: false,
      key: '',
      reason: '直前の観測対象状態なし',
      promotedClaims: [],
    };

    // 観測対象: 直前のターンが存在し、未解決/要確認であったか、または推論テンプレートが適用されていた場合
    const shouldObserve = Boolean(
      state.lastResultStatus === 'UNRESOLVED' ||
      state.lastResultStatus === 'NEEDS_CONFIRMATION' ||
      state.lastReasoningTemplateId ||
      state.lastCandidateClaimId
    );

    if (!shouldObserve) {
      return defaultResult;
    }

    const text = currentPrompt.trim();
    const isCorrection = this.isUserCorrection(text);
    const isStrongPositive = this.isUserStrongAffirmative(text);

    let outcome: UnifiedOutcome = 'SUCCESS';
    let verified = false;
    let reason = 'ユーザーが特に訂正せず会話を継続';

    if (isCorrection) {
      outcome = 'FAILURE';
      verified = false;
      reason = 'ユーザーからの訂正・不満を検知 (CORRECTION)';
    } else if (isStrongPositive) {
      outcome = 'SUCCESS';
      verified = true;
      reason = 'ユーザーからの強い肯定・感謝・正解確認を検知 (AFFIRMATIVE)';
    }

    // 会話キーの算出 (対話行為 + 話題の正規化キー)
    const prevDialogueAct = state.lastDialogueAct || 'QUESTION';
    const prevTopic = state.lastTopic || state.currentTopic || 'general';
    const conversationKey = `conversation:${normalizeKey(`${prevDialogueAct}:${prevTopic}`)}`;

    // 1. 会話応答キーの観測
    mikiUnifiedLearningContinuumService.observe({
      domain: 'conversation',
      key: conversationKey,
      outcome,
      verified,
      concepts: [prevTopic].filter(Boolean),
    });

    // 2. 推論テンプレートが適用されていた場合の観測 (Chapter 2)
    if (state.lastReasoningTemplateId) {
      mikiUnifiedLearningContinuumService.observe({
        domain: 'research',
        key: state.lastReasoningTemplateId,
        outcome,
        verified,
        concepts: ['reasoning_template', prevTopic],
      });
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `📊 [推論テンプレート観測] ${state.lastReasoningTemplateId}: outcome=${outcome}, verified=${verified} (理由: ${reason})`
      );
    }

    // 3. 直前に登録・言及されたClaim候補の観測 (Chapter 1)
    const promotedClaims: ClaimRecord[] = [];
    if (state.lastCandidateClaimId) {
      const candidateKey = `claim_candidate:${state.lastCandidateClaimId}`;
      mikiUnifiedLearningContinuumService.observe({
        domain: 'conversation',
        key: candidateKey,
        outcome,
        verified,
        concepts: ['candidate_claim', prevTopic],
      });

      // 昇格判定の実行
      const promoCheck = this.evaluateCandidatePromotion(state.lastCandidateClaimId);
      if (promoCheck.eligible) {
        const claim = claimDatabaseService.listClaims({ status: 'CANDIDATE' }).find(
          (c) => c.claim_id === state.lastCandidateClaimId
        );
        if (claim) {
          claimDatabaseService.setVerificationStatus(
            claim.claim_id,
            'SUPPORTED',
            promoCheck.reason
          );
          claimDatabaseService.promoteMaturity(
            claim.claim_id,
            'CONNECTED',
            '対話における一貫した検証および客観的統計基準充足'
          );
          promotedClaims.push(claim);
          systemLogger.info(
            'SELF_IMPROVEMENT',
            `🎉 [Claim自動昇格成功] ${claim.claim_id}: CANDIDATE -> SUPPORTED (${promoCheck.reason})`
          );
        }
      }
    }

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `📈 [会話応答学習観測] key=${conversationKey} | outcome=${outcome} | verified=${verified} | 理由: ${reason}`
    );

    return {
      observed: true,
      outcome,
      verified,
      key: conversationKey,
      reason,
      promotedClaims,
    };
  }

  /**
   * ユーザーが望ましい答え・意見・正解例を教えてくれたか（教示検知）
   * 例: 「〜って言えばよかったのに」「正解は〜だよ」「実は〜です」「〜が正しい」
   */
  public detectAndRegisterTeaching(
    prompt: string,
    contextTopic?: string
  ): TeachingDetectionResult {
    const text = prompt.trim();
    let extracted: string | null = null;

    // パターン1: 「〜って言えばよかったのに」「〜と言えばよかったのに」
    const m1 = text.match(/[「『]?(.+?)[」』]?(?:って|と)(?:言えばよかったのに|答えるべきだった|答えてほしかった)/i);
    if (m1) extracted = m1[1];

    // パターン2: 「正解は〜だよ」「正解は〜です」「答えは〜」
    if (!extracted) {
      const m2 = text.match(/(?:正解|答え|本当|実際)は[「『]?(.+?)[」』]?(?:だよ|です|だね|だ|である)/i);
      if (m2) extracted = m2[1];
    }

    // パターン3: 「〜が正解」「〜が正しい」
    if (!extracted) {
      const m3 = text.match(/[「『]?(.+?)[」』]?が(?:正解|正しい|適切|正当)(?:だよ|です|だね|だ|である)?/i);
      if (m3) extracted = m3[1];
    }

    // パターン4: 「実は〜なんだよ」「実は〜です」
    if (!extracted) {
      const m4 = text.match(/実は[「『]?(.+?)[」』]?(?:なんだよ|なんです|だよ|です)/i);
      if (m4) extracted = m4[1];
    }

    if (!extracted || extracted.length < 3) {
      return { detected: false };
    }

    const cleanedStatement = extracted.trim().replace(/^[、, ]+|[、, ]+$/g, '');

    // 既存のClaimに重複があるか確認
    const existing = claimDatabaseService.listClaims({ excludeSuperseded: true }).find(
      (c) => c.statement === cleanedStatement
    );

    let candidateClaim: ClaimRecord;
    if (existing) {
      candidateClaim = existing;
    } else {
      // 新しいClaim候補としてCANDIDATEで登録 (ユーザー本人が直接教えた内容)
      candidateClaim = claimDatabaseService.registerClaim({
        statement: cleanedStatement,
        world: 'REAL',
        kind: 'FACT_CLAIM',
        status: 'CANDIDATE',
        source: 'user_teaching',
        self_provenance: 'USER_CONFIRMED',
        maturity: 'DEFINED',
        scope: { environment: 'user_conversation', conditions: { topic: contextTopic || 'user_instruction' } },
        origin_source_id: 'user_conversation_feedback',
        independence_cluster_id: 'cluster_user_teaching',
      });
    }

    // 候補キーの初回観測 (初回登録時は1回目なので昇格しない: 歯止め)
    const candidateKey = `claim_candidate:${candidateClaim.claim_id}`;
    mikiUnifiedLearningContinuumService.observe({
      domain: 'conversation',
      key: candidateKey,
      outcome: 'SUCCESS',
      verified: false,
      concepts: ['user_teaching', contextTopic || 'general'].filter(Boolean),
    });

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `💡 [ユーザー教示検知・登録] ${candidateClaim.claim_id}: 「${candidateClaim.statement}」をCANDIDATEとして保存しました (1回目観測のため未昇格)`
    );

    return {
      detected: true,
      extractedStatement: cleanedStatement,
      candidateClaim,
      message: `教えていただきありがとうございます！「${cleanedStatement}」を新しい知識候補として記録しました。今後の対話の中で継続検証していきます。`,
    };
  }

  /**
   * Claim候補のVERIFIED昇格条件の判定 (統計的客観基準・LLM不使用)
   * 
   * 昇格条件:
   * 1. 観測回数が2回以上 (uses >= 2: 1回の言及では自己証明禁止により昇格不可)
   * 2. ユーザー訂正・不満がゼロ (failures === 0)
   * 3. 確信度が70%以上 (confidence >= 70)
   * 4. 少なくとも1回以上の明示的確認または検証 (verified >= 1)
   */
  public evaluateCandidatePromotion(
    claimId: string
  ): ClaimCandidatePromotionEvaluation {
    const key = `claim_candidate:${claimId}`;
    const profile = mikiUnifiedLearningContinuumService.getProfile(key);

    if (!profile) {
      return {
        eligible: false,
        reason: '観測プロファイルが存在しません',
        confidence: 0,
        uses: 0,
        failures: 0,
        verified: 0,
      };
    }

    // 1回の言及では絶対に昇格しない (指示書必須要件)
    if (profile.uses < 2) {
      return {
        eligible: false,
        reason: `観測回数が不足しています (現在${profile.uses}回、昇格には最低2回の一貫した確認が必要)`,
        confidence: profile.confidence,
        uses: profile.uses,
        failures: profile.failures,
        verified: profile.verified,
      };
    }

    // ユーザーからの訂正・失敗が存在する場合は昇格不可
    if (profile.failures > 0) {
      return {
        eligible: false,
        reason: `ユーザーからの訂正または不満が記録されています (失敗数: ${profile.failures}件)`,
        confidence: profile.confidence,
        uses: profile.uses,
        failures: profile.failures,
        verified: profile.verified,
      };
    }

    // 確信度しきい値 (70%以上)
    if (profile.confidence < 70) {
      return {
        eligible: false,
        reason: `統計的確信度が基準値未満です (${profile.confidence}% < 70.0%)`,
        confidence: profile.confidence,
        uses: profile.uses,
        failures: profile.failures,
        verified: profile.verified,
      };
    }

    // 明示的肯定または検証済み裏付けが必須
    if (profile.verified < 1) {
      return {
        eligible: false,
        reason: '明示的な肯定・感謝または検証済み証拠が不足しています (verified < 1)',
        confidence: profile.confidence,
        uses: profile.uses,
        failures: profile.failures,
        verified: profile.verified,
      };
    }

    return {
      eligible: true,
      reason: `統計的客観基準充足による自動昇格 (uses=${profile.uses}, confidence=${profile.confidence}%, failures=0, verified=${profile.verified})`,
      confidence: profile.confidence,
      uses: profile.uses,
      failures: profile.failures,
      verified: profile.verified,
    };
  }

  /**
   * ユーザーが訂正・不満を示しているかの判定
   */
  private isUserCorrection(text: string): boolean {
    return /違う|そうじゃない|ではなくて|じゃなくて|間違っ|失敗|誤り|動かない|おかしい|バグ|ダメ/i.test(text);
  }

  /**
   * ユーザーが強い肯定・感謝・同意を示しているかの判定
   */
  private isUserStrongAffirmative(text: string): boolean {
    return /ありがとう|感謝|助かった|その通り|合ってる|正解|素晴らしい|さすが|いいね|完璧|解決した|役に立った/i.test(text);
  }
}

export const mikiConversationLearningService = MikiConversationLearningService.getInstance();
