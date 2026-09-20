import {
  ClaimRecord,
  ConversationState,
  DialogueAct, ConversationOutcomeKind, ConversationQualityCause, ConversationOutcomeAssessment, AnswerContentIR, ConversationAnswerDecisionSnapshot, ConversationAnswerChangeExplanation, ConversationAnswerChangeCause,
} from '../../../types';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import {
  mikiUnifiedLearningContinuumService,
  normalizeKey,
  LearningProfile,
} from './mikiUnifiedLearningContinuumService';
import { UnifiedOutcome } from '../../experience/services/unifiedMikiExperienceService';
import { systemLogger } from '../../../services/systemLogger';
import { evidenceService } from '../../memory/services/evidenceService';

export interface PreviousTurnEvaluationResult {
  observed: boolean;
  outcome: UnifiedOutcome;
  verified: boolean;
  key: string;
  reason: string;
  promotedClaims: ClaimRecord[];
  conversationOutcome: ConversationOutcomeAssessment;
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
  public buildAnswerDecisionSnapshot(input:{prompt:string;ir:AnswerContentIR;surfaceText:string;claimIds?:string[];evidenceIds?:string[];capabilityIds?:string[];experienceIds?:string[];strategyRefs?:string[];decisionRefs?:string[]}):ConversationAnswerDecisionSnapshot{
    const inputKey=normalizeKey(input.prompt||''); const uniq=(v?:string[])=>[...new Set((v||[]).map(String).filter(Boolean))].sort(); const stable=(v:unknown)=>{const raw=JSON.stringify(v);let h=2166136261;for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');};
    const knowledgeRefs=uniq(input.claimIds), evidenceRefs=uniq(input.evidenceIds), capabilityRefs=uniq(input.capabilityIds), experienceRefs=uniq(input.experienceIds), strategyRefs=uniq(input.strategyRefs), decisionRefs=uniq(input.decisionRefs);
    const decisionFingerprint=stable({conclusion:input.ir.conclusion,reasons:input.ir.reasons,conditions:input.ir.conditions,exceptions:input.ir.exceptions,next_actions:input.ir.next_actions,certainty:input.ir.certainty,target:input.ir.target,detail_level:input.ir.detail_level,interaction_mode:input.ir.interaction_mode,world_scope:input.ir.world_scope,strategy:input.ir.strategy});
    return {inputKey,decisionFingerprint,answerFingerprint:stable(input.surfaceText||''),knowledgeRefs,evidenceRefs,capabilityRefs,experienceRefs,strategyRefs,decisionRefs,capturedAt:Date.now()};
  }

  public compareAndRecordAnswerChange(state:ConversationState,current:ConversationAnswerDecisionSnapshot):{state:ConversationState;explanation:ConversationAnswerChangeExplanation}{
    const history=state.answerDecisionHistory||[]; const previous=[...history].reverse().find(x=>x.inputKey===current.inputKey)||(state.lastAnswerDecisionSnapshot?.inputKey===current.inputKey?state.lastAnswerDecisionSnapshot:undefined); const sameInput=Boolean(previous&&current.inputKey);
    const diff=(a:string[],b:string[])=>[...new Set([...b.filter(x=>!a.includes(x)),...a.filter(x=>!b.includes(x))])].sort();
    const changedReferences={knowledge:previous?diff(previous.knowledgeRefs,current.knowledgeRefs):[],evidence:previous?diff(previous.evidenceRefs,current.evidenceRefs):[],capability:previous?diff(previous.capabilityRefs,current.capabilityRefs):[],experience:previous?diff(previous.experienceRefs,current.experienceRefs):[],strategy:previous?diff(previous.strategyRefs,current.strategyRefs):[],decision:previous?diff(previous.decisionRefs,current.decisionRefs):[]};
    const causes:ConversationAnswerChangeCause[]=[]; if(sameInput&&previous&&previous.answerFingerprint!==current.answerFingerprint){if(changedReferences.knowledge.length)causes.push('KNOWLEDGE_CHANGED');if(changedReferences.evidence.length)causes.push('EVIDENCE_CHANGED');if(changedReferences.capability.length)causes.push('CAPABILITY_CHANGED');if(changedReferences.experience.length)causes.push('EXPERIENCE_CHANGED');if(changedReferences.strategy.length)causes.push('STRATEGY_CHANGED');if(changedReferences.decision.length)causes.push('DECISION_CHANGED');if(previous.decisionFingerprint===current.decisionFingerprint)causes.push('SURFACE_CHANGED');if(!causes.length)causes.push('UNATTRIBUTED_CHANGE');}
    let explanation='同一入力の比較対象がありません。',confidence=0.2; if(sameInput&&previous){if(previous.answerFingerprint===current.answerFingerprint){explanation='同一入力に対する前回回答と現在回答は同一でした。';confidence=1;}else{explanation=`同一入力で回答が変化。変化した追跡軸: ${causes.join(' / ')}。これは原因候補であり、因果証明ではありません。`;confidence=causes.includes('UNATTRIBUTED_CHANGE')?0.3:0.85;}}
    const result:ConversationAnswerChangeExplanation={sameInput,changed:Boolean(sameInput&&previous&&previous.answerFingerprint!==current.answerFingerprint),causes:[...new Set(causes)],changedReferences,previousSnapshotAt:previous?.capturedAt,currentSnapshotAt:current.capturedAt,previousAnswerFingerprint:previous?.answerFingerprint,currentAnswerFingerprint:current.answerFingerprint,explanation,confidence};
    const nextState={...state,lastAnswerDecisionSnapshot:current,answerDecisionHistory:[...history,current].slice(-12),lastAnswerChangeExplanation:result}; return {state:nextState,explanation:result};
  }

  public assessConversationOutcome(currentPrompt:string,state:ConversationState):ConversationOutcomeAssessment{const text=String(currentPrompt||'').trim();const correction=this.isUserCorrection(text);const strongNegative=/(?:嫌|最悪|分かりにく|わかりにく|長すぎ|役に立た|ダメ)/i.test(text);const followUp=/(?:もっと|詳しく|続き|あと|それと|もう一つ|もう1点)/i.test(text);const topicChanged=/(?:別の話|ところで|話変わる|全然違う|別の質問)/i.test(text);const goalCompleted=state.goalProgress?.status==='COMPLETED'||/(?:解決した|できた|完了した|ありがとう|助かった)/i.test(text);const factualGroundingVerified=state.lastCandidateClaimId?state.lastFalsificationPassed===true:state.lastResultStatus==='RESOLVED';const constraintSatisfied=!/(?:それじゃない|条件違|指定違)/i.test(text);const causes:ConversationQualityCause[]=[];if(correction)causes.push(state.dialogueRepair?.required?'reference_error':'intent_error');if(state.unresolvedState==='UNKNOWN')causes.push('knowledge_gap');if(state.unresolvedState==='INSUFFICIENT_EVIDENCE')causes.push('evidence_weakness');if(state.unresolvedState==='CAPABILITY_MISSING'||state.unresolvedState==='EXECUTION_FAILED')causes.push('execution_error');if(state.unresolvedState==='PENDING_USER_INPUT')causes.push('intent_error');if(followUp)causes.push('surface_wording_error');if(state.invalidatedAssumptions.length>0)causes.push('context_loss');if(!constraintSatisfied)causes.push('constraint_violation');let outcome:ConversationOutcomeKind='UNRESOLVED';if(topicChanged)outcome='TOPIC_CHANGED';else if(correction)outcome='CORRECTED';else if(strongNegative)outcome='NEGATIVE_FEEDBACK';else if(followUp)outcome='NEEDS_MORE_EXPLANATION';else if(goalCompleted||state.lastResultStatus==='RESOLVED')outcome='RESOLVED';return{outcome,causes:[...new Set(causes)],goalCompleted,factualGroundingVerified,constraintSatisfied,surfaceQuality:correction||strongNegative||followUp?'NEEDS_REPAIR':goalCompleted?'GOOD':'UNKNOWN'};}

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
      conversationOutcome: this.assessConversationOutcome(currentPrompt, state),
    };

    // 観測対象: 直前のターンが存在し、未解決/要確認であったか、推論テンプレート適用、Claim候補、または内的自己反証スコアが存在する場合
    const shouldObserve = Boolean(
      state.lastResultStatus === 'UNRESOLVED' ||
      state.lastResultStatus === 'NEEDS_CONFIRMATION' ||
      state.lastReasoningTemplateId ||
      state.lastCandidateClaimId ||
      state.lastFalsificationPassed !== undefined
    );

    if (!shouldObserve) {
      return defaultResult;
    }

    const text = currentPrompt.trim();
    const conversationOutcome = this.assessConversationOutcome(text, state);
    const isCorrection = this.isUserCorrection(text);
    const isStrongPositive = this.isUserStrongAffirmative(text);

    let outcome: UnifiedOutcome = 'SUCCESS';
    let verified = false;
    let reason = 'ユーザーが特に訂正せず会話を継続';

    if (isCorrection) {
      outcome = 'FAILURE';
      verified = false;
      reason = 'ユーザーからの訂正・不満を検知 (CORRECTION)';
    } else if (state.lastFalsificationPassed === false) {
      // v10 / 作業指示書 v15: Mikiが自分で矛盾・エッジケース破綻を検知した場合、ユーザーの沈黙を成功と解釈しない
      outcome = 'FAILURE';
      verified = false;
      reason = `内的自己反証で不合格を自己検知 (FALSIFICATION_FAILED: score=${state.lastFalsificationScore ?? 'N/A'})`;
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
      conversationOutcome,
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
        source: 'USER_CLAIM',
        self_provenance: 'USER_CONFIRMED',
        maturity: 'DEFINED',
        scope: { environment: 'user_conversation', conditions: { topic: contextTopic || 'user_instruction' } },
        origin_source_id: 'user_conversation_feedback',
        independence_cluster_id: `cluster_user_claim_${contextTopic || 'general'}`,
      });
      const userClaimEvidence = evidenceService.recordUserClaimEvidence({
        title: `User claim for ${candidateClaim.claim_id}`,
        statement: cleanedStatement,
        sourceId: candidateClaim.claim_id,
        metadata: {
          environment: 'user_conversation',
          result_summary: 'ユーザー発言として保存。客観的事実の検証結果ではない。',
          verification_status: 'UNVERIFIED',
        },
      });
      evidenceService.attachEvidenceToClaim(userClaimEvidence.evidence_id, candidateClaim.claim_id);
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
    const candidate = claimDatabaseService.getClaim(claimId);

    // 116: USER_CLAIMはユーザー発言の証跡であり、客観的事実の独立検証ではない。
    // 既存Verifierが別途SUPPORTED/DEVICE_VERIFIEDへ変更するまで、自動昇格を止める。
    if (candidate?.source === 'USER_CLAIM') {
      return {
        eligible: false,
        reason: 'USER_CLAIM_REQUIRES_INDEPENDENT_VERIFICATION',
        confidence: profile?.confidence ?? 0,
        uses: profile?.uses ?? 0,
        failures: profile?.failures ?? 0,
        verified: profile?.verified ?? 0,
      };
    }

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
