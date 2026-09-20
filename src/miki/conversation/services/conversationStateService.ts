import { ConversationState, ConversationStage, ResponseLength, DialogueAct, FeedbackStage, ConversationExplanationAdaptation, ConversationUnderstandingLevel, ConversationGoalStatus } from '../../../types';
import { systemLogger } from '../../../services/systemLogger';
import { anaphoraHistoryStack } from '../../../autonomous_modules/anaphora_history_stack';
import { resolveAnaphoraPure } from '../../../autonomous_modules/anaphora_resolver_sample';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';

/**
 * 作業指示書 v6 優先度9: 会話状態JSON指示 (超軽量版)
 * - expectedResponseLength はコード側のルールベース判定で充足されるため指示から完全削除。
 * - 短縮キー (t: topic, g: goal, s: stage, f: facts) を採用。
 * - 該当がないキーは完全省略を指示し、不可視の生成トークン消費を最小化する。
 */
export const CONVERSATION_STATE_INSTRUCTION = `回答前に会話状態を最小限の1行JSONで先頭出力してください（該当のないキーは完全省略）:
<state>{"t":"話題","g":"目的"}</state>
※変化時のみ追加可: "s":"QUESTION|CLARIFICATION|CORRECTION|COMPARISON|DECISION|FOLLOW_UP|TOPIC_CHANGE|CLOSING", "f":["新確定事実"]
出力後、すぐに自然な日本語で回答を続けてください。`;

/**
 * 日常の挨拶・短い相槌・声かけの検出ヘルパー (対策2: RAGスキップ・軽量対話モード)
 * 「ただいま」「おはよう」「うん」などの挨拶・相槌・声かけを検出し、
 * 重いRAG検索や不要な骨格注入、スキル誤爆を完全に防止する。
 */
export function inferUserUnderstandingLevel(
  userPrompt: string,
  state?: ConversationState | null,
): { level: ConversationUnderstandingLevel; confidence: number; evidence: string[] } {
  const text = (userPrompt || '').trim();
  const evidence: string[] = [];
  let score = 0;

  const noviceMarkers = /初心者|初めて|よくわからない|わからない|分からない|意味がわから|かんたんに|簡単に|基礎から|一から説明/i;
  const verificationMarkers = /根拠|証拠|検証|確認|公式|仕様|正確|厳密|再現|反証|ソース/i;
  const advancedMarkers = /TypeScript|JavaScript|Gradle|GitHub|API|JSON|SQL|Vite|React|Kotlin|Android|commit|push|branch|interface|class|function|CognitiveState|CORE|Blackboard|Evidence|Claim|Repository|APK|Termux/i;
  const deepTechnicalMarkers = /アーキテクチャ|依存関係|型定義|実装|パッチ|リファクタ|ビルド|コンパイル|デバッグ|スタック|レイヤ|スキーマ/i;

  if (noviceMarkers.test(text)) { score -= 3; evidence.push('初心者・意味確認・基礎説明の明示'); }
  if (verificationMarkers.test(text)) { score += 3; evidence.push('根拠・検証・正確性を重視する発言'); }
  if (advancedMarkers.test(text)) { score += 3; evidence.push('高度な技術用語・開発用語を使用'); }
  if (deepTechnicalMarkers.test(text)) { score += 2; evidence.push('実装・構造・デバッグ等の技術文脈'); }
  if ((state?.corrections?.length || 0) >= 2) { score += 1; evidence.push('過去の訂正履歴が複数あり、会話内容を精密に扱っている'); }
  if (state?.stage === 'CAUSALITY' || state?.stage === 'CONDITIONAL') { score += 1; evidence.push(`現在の会話段階=${state.stage}`); }

  if (verificationMarkers.test(text) && score >= 3) {
    return { level: 'VERIFICATION_FOCUSED', confidence: Math.min(0.95, 0.72 + Math.abs(score) * 0.05), evidence };
  }
  if (noviceMarkers.test(text) && score <= -2) {
    return { level: 'NOVICE', confidence: Math.min(0.95, 0.78 + Math.abs(score) * 0.04), evidence };
  }
  if (score >= 4) return { level: 'ADVANCED', confidence: Math.min(0.92, 0.70 + score * 0.04), evidence };
  if (score <= -3) return { level: 'NOVICE', confidence: Math.min(0.92, 0.72 + Math.abs(score) * 0.04), evidence };
  if (text.length === 0 && !state) return { level: 'UNKNOWN', confidence: 0.2, evidence: ['入力情報不足'] };
  return { level: 'INTERMEDIATE', confidence: 0.58, evidence: evidence.length ? evidence : ['明確な理解度シグナルなし'] };
}

export function adaptExplanationDetailLevel(
  userPrompt: string,
  state: ConversationState | null | undefined,
  baseLength: ResponseLength,
): ConversationExplanationAdaptation {
  const inferred = inferUserUnderstandingLevel(userPrompt, state);
  const text = (userPrompt || '').trim();
  const explicitShort = /短く|簡潔に|一言で|ひとことで|要点だけ|結論だけ|手短に|サクッと|1行で|3行で/i.test(text);
  const explicitDetailed = /詳しく|詳細に|具体的に|理由も|ステップバイステップ|徹底解説|深く教えて|背景/i.test(text);

  let selectedDetailLevel: ResponseLength = baseLength;
  let reason = `理解度=${inferred.level}を推定。`;
  if (explicitShort || baseLength === 'short') {
    selectedDetailLevel = 'short';
    reason += '明示的または既存の短文制約を優先。';
  } else if (explicitDetailed || baseLength === 'detailed') {
    selectedDetailLevel = 'detailed';
    reason += '明示的または既存の詳細説明要求を優先。';
  } else {
    if (inferred.level === 'NOVICE' || inferred.level === 'VERIFICATION_FOCUSED') selectedDetailLevel = 'detailed';
    else selectedDetailLevel = 'standard';
    reason += selectedDetailLevel === 'detailed'
      ? '初学者には前提・理由を補い、検証重視なら根拠を厚くする。'
      : '経験者向けでも中核説明を省略しすぎない標準量を維持。';
  }

  return {
    understandingLevel: inferred.level,
    selectedDetailLevel,
    confidence: inferred.confidence,
    evidence: inferred.evidence,
    reason,
    inferredAt: Date.now(),
  };
}

export function isCasualGreetingOrShortSocial(prompt: string): boolean {
  if (!prompt) return false;
  const p = prompt.trim();
  if (p.length === 0 || p.length > 25) return false;

  // 開発・コード・質問・指示のキーワードが含まれる場合は挨拶判定しない
  if (
    /コード|エラー|バグ|動かない|作って|実装|開発|修正|直し|教えて|どう|なぜ|何|いくら|関数|プログラム|vba|sql|api|css|html|python|typescript|javascript|react/i.test(
      p
    )
  ) {
    return false;
  }

  // 疑問符で終わる、または疑問詞がある場合は質問の可能性が高い（「元気？」等の単なる挨拶を除く）
  if (/[?？]$/.test(p) && !/^(元気|調子どう|いかが)[?？]$/.test(p)) {
    return false;
  }

  // 代表的な日常の挨拶・相槌・声かけ・疲労吐露
  const greetingPattern =
    /^(ただいま|ただいまー|ただいま〜|お帰り|おかえり|おかえりー|おはよう|おはよー|おはようございます|おやすみ|おやすみー|おやすみなさい|こんにちは|こんちは|こんばんは|こんばんわ|いってきます|行ってきます|行ってきまーす|いってらっしゃい|行ってらっしゃい|やっほー|ヤッホー|やあ|ハロー|hello|hi|バイバイ|またね|じゃあね|さようなら|お疲れ|お疲れ様|おつかれ|おつかれさま|ありがとう|ありがと|ありがとー|サンキュー|どうも|感謝|うん|ううん|はい|いいえ|そうだね|そうそう|なるほど|了解|りょ|りょうかい|わかった|ok|オッケー|おっけー|みき|みきちゃん|ねえ|ねえねえ|元気[？?]?|疲れた|つかれた|つかれたー|疲れたー|しんどい|だるい|つらい|もう無理|限界|ねむい|眠い)[！!。.\s〜ー]*$/i;

  if (greetingPattern.test(p)) {
    return true;
  }

  // 複合的な日常の挨拶・声かけ（作業指示キーワードを含まないもの）
  if (
    /^(こんにちは|おはよう|おはようございます|こんばんは|お疲れ様|おつかれ様|おつかれ|ハロー|hello)[、, ]*(今日も|本日も|いつも)?[よろしく|よろしくね|よろしくお願いします|お世話になっております|ありがとう|ありがと]*[！!。.\s]*$/i.test(
      p
    ) && !/作|書|調|コ|vba|エラー|直|教/i.test(p)
  ) {
    return true;
  }

  return false;
}

/**
 * 作業指示書 v6 優先度9-3: ルールベースの会話ステージ(stage)推定
 * ユーザー発言のキーワードパターンから会話段階を高精度に推定する。
 * モデルの不可視JSON生成負荷を軽減し、モデルがステージを省略・未出力にした場合でも適切に補完する。
 */
export function inferConversationStage(
  userPrompt: string,
  prevStage: ConversationStage = 'QUESTION'
): ConversationStage {
  if (!userPrompt || !userPrompt.trim()) return prevStage;
  const text = userPrompt.trim();

  // 0. 日常の挨拶・相槌（クロージング/親密対話ステージとして扱う）
  if (isCasualGreetingOrShortSocial(text)) {
    return 'CLOSING';
  }

  // 1. 訂正・エラー指摘 (最優先)
  if (
    /違う|そうじゃない|ではなくて|じゃなくて|エラー|動かない|動いてない|動かないよ|失敗|直して|修正して|訂正|直せ|間違っ|バグ|動かん/i.test(
      text
    )
  ) {
    return 'CORRECTION';
  }

  // 2. 比較・選択肢の検討
  if (
    /どっち|どちら|比較|違い|メリット|デメリット|差は何|選び方|おすすめはどっち|vs|違いは/i.test(
      text
    )
  ) {
    return 'COMPARISON';
  }

  // 2.1 因果・理由・波及効果の検討
  if (
    /なぜ|どうして|原因|理由|したらどうなる|した結果|影響は|仕組みは|引き起こ|背景は/i.test(
      text
    )
  ) {
    return 'CAUSALITY';
  }

  // 2.2 条件・環境分岐の検討
  if (
    /の場合|の条件|の環境|環境別|環境によって|条件によって|条件付き|ケースによって|プラットフォーム別/i.test(
      text
    )
  ) {
    return 'CONDITIONAL';
  }

  // 3. 意思決定・採否
  if (
    /決めた|これにする|これで行く|これでお願い|採用|決定|それで進めて|やってみて|実装して/i.test(
      text
    )
  ) {
    return 'DECISION';
  }

  // 4. クロージング・感謝・完了
  if (
    /ありがとう|助かった|解決|おわり|終わり|以上です|バイバイ|またね|お疲れ様|できたよ|完了/i.test(
      text
    )
  ) {
    return 'CLOSING';
  }

  // 5. 話題転換
  if (
    /別の話|ところで|話変わる|話題変え|全然違う|別の質問|関係ないけど/i.test(text)
  ) {
    return 'TOPIC_CHANGE';
  }

  // 6. 追加質問・深掘り
  if (
    /詳しく|他には|追加で|あと|それと|それから|もう一つ|もう1点|さらに|続き/i.test(
      text
    )
  ) {
    return 'FOLLOW_UP';
  }

  // 7. 意図確認・明確化要求
  if (
    /どういうこと|意味が|わかりにくい|もう少し具体的に|例え|要するに|どういう意味/i.test(
      text
    )
  ) {
    return 'CLARIFICATION';
  }

  // 8. デフォルト: 質問
  return 'QUESTION';
}

/**
 * 設計思想 4.2 対話行為の分類 (Dialogue Acts) 12区分判定エンジン
 */
export function classifyDialogueAct(userPrompt: string): DialogueAct {
  if (!userPrompt || !userPrompt.trim()) return 'QUESTION';
  const text = userPrompt.trim();

  // 1. 雑談・挨拶・相槌
  if (isCasualGreetingOrShortSocial(text)) {
    return 'CASUAL_CHAT';
  }

  // 2. 訂正・指摘
  if (/違う|そうじゃない|ではなくて|じゃなくて|修正して|訂正|直して|バグ|間違い/i.test(text)) {
    return 'CORRECTION';
  }

  // 3. 成果物・コード生成依頼
  if (/コード|マクロ|vba|スクリプト|プログラム|書いて|作って|実装して|生成して|出して/i.test(text)) {
    return 'REQUEST_ARTIFACT';
  }

  // 4. 推薦・比較の依頼
  if (/どっち|どちら|おすすめ|比較|違いは|選ぶなら|ベストは/i.test(text)) {
    return 'REQUEST_RECOMMENDATION';
  }

  // 5. 原理・理由の説明依頼
  if (/なぜ|どうして|仕組み|原理|どういうこと|詳しく教えて|解説して/i.test(text)) {
    return 'REQUEST_EXPLANATION';
  }

  // 6. 拒絶・否定
  if (/やめて|不要|いらない|結構です|やらない|使わない/i.test(text)) {
    return 'REJECTION';
  }

  // 7. 確認・念押し
  if (/本当|合ってる|大丈夫|確実|確認して|いいの|ですか/i.test(text) && /？|\?/.test(text)) {
    return 'CONFIRMATION';
  }

  // 8. 話題転換
  if (/別の話|ところで|話変わる|話題変え|関係ないけど|次の質問/i.test(text)) {
    return 'TOPIC_SHIFT';
  }

  // 9. 継続・追質問
  if (/あと|それと|さらに|追加で|もう1点|続き/i.test(text)) {
    return 'CONTINUATION';
  }

  // 10. フィードバック・評価
  if (/長い|短すぎる|固い|わかりやすい|助かった|変|不自然|良い|ダメ/i.test(text)) {
    return 'FEEDBACK';
  }

  // 11. 一般作業依頼
  if (/して|やって|お願い|実行/i.test(text)) {
    return 'REQUEST';
  }

  return 'QUESTION';
}

/**
 * 設計思想 4.4 フィードバックの段階的状態管理
 * 単語単体で直ちに全体設定を変更せず、文脈・意図の強さに応じて段階化する
 * MENTIONED → POSSIBLE_FEEDBACK → DIRECT_FEEDBACK → ADJUSTMENT_REQUEST → CONFIRMED_PREFERENCE
 */
export function evaluateFeedbackStage(
  userPrompt: string,
  currentPreference?: string
): { stage: FeedbackStage; targetAttribute?: string; reason: string } {
  const text = userPrompt.trim();

  // 明示的な恒久確定要求
  if (/いつも|今後は常に|デフォルトで|恒久的に|これからは全部/i.test(text) && /短く|長く|丁寧に|簡潔に|結論から/i.test(text)) {
    return {
      stage: 'CONFIRMED_PREFERENCE',
      targetAttribute: /短く|簡潔/i.test(text) ? 'VERBOSITY_CONCISE' : 'VERBOSITY_DETAILED',
      reason: 'ユーザーによる恒久的設定の明示指定',
    };
  }

  // 今回・当面の変更要求
  if (/もっと短く|もっと簡潔に|長すぎるから端折って|結論だけ言って|丁寧に言って/i.test(text)) {
    return {
      stage: 'ADJUSTMENT_REQUEST',
      targetAttribute: /短く|簡潔|端折って/i.test(text) ? 'VERBOSITY_CONCISE' : 'POLITENESS_HIGH',
      reason: '直接的な回答スタイル変更要求',
    };
  }

  // 直前回答への直接的評価
  if (/回答が長い|今の説明固い|ちょっとわかりにくい|助かったよ/i.test(text)) {
    return {
      stage: 'DIRECT_FEEDBACK',
      reason: '直前回答に対する客観的評価の提示',
    };
  }

  // 文脈から評価の可能性がある発言
  if (/長文|固い言葉|変な感じ/i.test(text)) {
    return {
      stage: 'POSSIBLE_FEEDBACK',
      reason: '評価キーワードを含むが変更指示は伴わない',
    };
  }

  // 単に単語が含まれているだけ
  if (/「長い」|長い歴史|固い岩/i.test(text)) {
    return {
      stage: 'MENTIONED',
      reason: '評価語が別文脈・引用として言及されただけ',
    };
  }

  return {
    stage: 'MENTIONED',
    reason: '該当なし',
  };
}

/**
 * 設計思想106/119/121: 会話全体のGoalを1ターン単位の質問へ分断せず、
 * 同じConversationState内で継続追跡する決定論的ヘルパー。
 * 新しいGoal/Task DBは作らず、既存ConversationStateへ状態を保持する。
 */
export function updateConversationGoalProgress(
  state: ConversationState,
  userPrompt: string,
  previousState: ConversationState | null,
): ConversationState {
  const text = String(userPrompt || '').trim();
  const previous = previousState?.goalProgress;
  const previousGoal = previous?.activeGoal || previousState?.topLevelGoal || '';
  const isTopicShift = state.stage === 'TOPIC_CHANGE';
  const isCancel = /(?:やめて|中止|キャンセル|取り消し)/i.test(text);
  const isPause = /(?:いったん置|後で|あとで|保留|一旦保留)/i.test(text);
  const actionMatches = text.match(/(?:調べ(?:て|る)?|検索(?:して|する)?|確認(?:して|する)?|修正(?:して|する)?|直(?:して|す)|実装(?:して|する)?|作(?:って|る)|テスト(?:して|する)?|検証(?:して|する)?|説明(?:して|する)?|比較(?:して|する)?|作成(?:して|する)?)/g) || [];
  const pendingActions = [...new Set(actionMatches.map(v => v.trim()))].slice(0, 8);

  let activeGoal = previousGoal;
  let activeGoalId = previous?.activeGoalId || '';
  let previousGoals = [...(previous?.previousGoals || [])];

  const explicitGoal = String(state.topLevelGoal || '').trim();
  const goalCandidate = isTopicShift && (!explicitGoal || explicitGoal === previousGoal)
    ? (state.currentTopic || text)
    : explicitGoal;
  const shouldCreateGoal = Boolean(
    goalCandidate &&
    (!activeGoal || isTopicShift || (previousGoal && goalCandidate !== previousGoal && state.stage !== 'FOLLOW_UP'))
  );

  if (shouldCreateGoal) {
    if (activeGoal && activeGoalId) {
      previousGoals.push({
        goalId: activeGoalId,
        goal: activeGoal,
        status: isTopicShift ? 'PAUSED' : (previous?.status || 'ACTIVE'),
        revision: previous?.revision || 1,
      });
      previousGoals = previousGoals.slice(-8);
    }
    activeGoal = goalCandidate;
    activeGoalId = `CG-${canonicalSha256({ goal: activeGoal, topic: state.currentTopic || '', seed: 'conversation-goal-v204' }).slice(0, 20)}`;
  }

  if (!activeGoal) {
    activeGoal = text || state.currentTopic || '未定義の会話Goal';
    activeGoalId = `CG-${canonicalSha256({ goal: activeGoal, topic: state.currentTopic || '', seed: 'conversation-goal-v204' }).slice(0, 20)}`;
  }

  const completedConditions = [...(previous?.completedConditions || [])];
  const priorInstruction = previous?.latestUserInstruction || '';
  if (previous?.status === 'ACTIVE' && previousState?.lastResultStatus === 'RESOLVED' && priorInstruction) {
    if (!completedConditions.includes(priorInstruction)) completedConditions.push(priorInstruction);
  }

  const blockedConditions = [...(previous?.blockedConditions || [])];
  if (previousState?.lastResultStatus === 'NEEDS_CONFIRMATION' && priorInstruction) {
    if (!blockedConditions.includes(priorInstruction)) blockedConditions.push(priorInstruction);
  }
  if (isCancel && text && !blockedConditions.includes(text)) blockedConditions.push(text);

  let status: ConversationGoalStatus = previous?.status || 'ACTIVE';
  if (isCancel) status = 'CANCELLED';
  else if (isPause) status = 'PAUSED';
  else if (state.lastResultStatus === 'NEEDS_CONFIRMATION') status = 'BLOCKED';
  else if (state.lastResultStatus === 'RESOLVED' && pendingActions.length === 0 && /(?:完了|できた|解決|ありがとう|助かった)/i.test(text)) status = 'COMPLETED';
  else status = 'ACTIVE';

  const remainingConditions = pendingActions.length > 0
    ? pendingActions.filter(action => !completedConditions.includes(action))
    : (previous?.remainingConditions || []).filter(condition => !completedConditions.includes(condition));

  return {
    ...state,
    goalProgress: {
      activeGoalId,
      activeGoal,
      status,
      completedConditions: [...new Set(completedConditions)].slice(-12),
      remainingConditions: [...new Set(remainingConditions)].slice(0, 12),
      blockedConditions: [...new Set(blockedConditions)].slice(-12),
      latestUserInstruction: text,
      pendingActions,
      previousGoals,
      revision: (previous?.revision || 0) + 1,
    },
  };
}

export function inferConversationCorrectionScope(userPrompt:string):{scope:import('../../../types').ConversationCorrectionScope;confidence:'high'|'medium'}{
 const text=String(userPrompt||'').trim();
 if (/(?:今後は|これからは|いつも|常に|毎回|デフォルトで|恒久的に)/i.test(text)) return {scope:'GLOBAL_PREFERENCE',confidence:'high'};
 if (/(?:このタスク|この作業|今回の作業|このコード|この案件)/i.test(text)) return {scope:'TASK',confidence:'high'};
 if (/(?:この話|この話題|この件では|このテーマ|この会話の間)/i.test(text)) return {scope:'TOPIC',confidence:'high'};
 if (/(?:この会話|このチャット|ここでは)/i.test(text)) return {scope:'CONVERSATION',confidence:'medium'};
 return {scope:'TURN_ONLY',confidence:'medium'};
}
export function classifyConversationKnowledgeState(userPrompt:string,state:ConversationState):import('../../../types').ConversationKnowledgeState{
 const text=String(userPrompt||'').trim(); const anaphora=resolveAnaphora(text,state); const hasReference=/(?:これ|それ|あれ|さっき|前の|どっち|どちら)/.test(text);
 if(hasReference&&(anaphora.confidence==='ambiguous'||anaphora.confidence==='unresolved')) return 'MEANING_UNCLEAR';
 switch(state.unresolvedState){case 'CAPABILITY_MISSING':return 'UNDERSTOOD_CAPABILITY_MISSING';case 'PERMISSION_DENIED':return 'UNDERSTOOD_PERMISSION_DENIED';case 'EXECUTION_FAILED':return 'EXECUTED_UNVERIFIED';case 'INSUFFICIENT_EVIDENCE':case 'UNKNOWN':case 'WAITING_EXTERNAL':return 'UNDERSTOOD_KNOWLEDGE_MISSING';case 'PENDING_USER_INPUT':return 'MEANING_UNCLEAR';}
 if(state.lastResultStatus==='RESOLVED'&&state.lastFalsificationPassed===true) return 'UNDERSTOOD_AND_KNOWN';
 return state.lastResultStatus==='RESOLVED'?'EXECUTED_UNVERIFIED':'UNDERSTOOD_KNOWLEDGE_MISSING';
}
export function clarificationGate(state:ConversationState,questionKey:string,maxQuestions=2):{allowed:boolean;next:ConversationState['clarificationControl']}{
 const previous=state.clarificationControl||{askedCount:0,maxQuestions,waitingForUser:false}; const normalizedKey=String(questionKey||'').trim(); const sameQuestion=Boolean(normalizedKey&&previous.lastQuestionKey===normalizedKey); const allowed=Boolean(normalizedKey&&!sameQuestion&&previous.askedCount<Math.max(1,previous.maxQuestions||maxQuestions));
 return {allowed,next:{askedCount:allowed?previous.askedCount+1:previous.askedCount,maxQuestions:previous.maxQuestions||maxQuestions,lastQuestionKey:allowed?normalizedKey:previous.lastQuestionKey,waitingForUser:allowed}};
}
export function assessConversationCompleteness(state:ConversationState):import('../../../types').ConversationCompletenessAssessment{
 const progress=state.goalProgress; const requestedItems=[...new Set([...(progress?.completedConditions||[]),...(progress?.remainingConditions||[]),...(progress?.pendingActions||[])])].filter(Boolean); const addressedItems=[...new Set(progress?.completedConditions||[])].filter(Boolean); const missingItems=[...new Set([...(progress?.remainingConditions||[]),...(progress?.blockedConditions||[])])].filter(Boolean); return {requestedItems,addressedItems,missingItems,complete:requestedItems.length===0||missingItems.length===0};
}

/**
 * 設計思想109: 会話内の時間表現・状態表現を決定論的に正規化する。
 * 相対日付は実行時の端末日付を基準に日付キーへ変換し、
 * 修正前/修正後・実行前/実行後・旧仕様/現仕様を状態軸として分離する。
 */
export function normalizeConversationTemporalReferences(
  userPrompt: string,
  nowMs = Date.now(),
): {
  referenceDate: string;
  anchors: import('../../../types').ConversationTemporalAnchor[];
} {
  const text = String(userPrompt || '').trim();
  const base = new Date(nowMs);
  const dateKey = (offset: number): string => {
    const d = new Date(base.getTime());
    d.setDate(d.getDate() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const anchors: import('../../../types').ConversationTemporalAnchor[] = [];
  const addRelative = (phrase: string, offset: number) => anchors.push({
    kind: 'RELATIVE_DATE', phrase, normalized: dateKey(offset), dayOffset: offset,
  });
  if (/一昨日/.test(text)) addRelative('一昨日', -2);
  if (/昨日/.test(text)) addRelative('昨日', -1);
  if (/(?:今日|本日)/.test(text)) addRelative(text.match(/今日|本日/)?.[0] || '今日', 0);
  if (/明日/.test(text)) addRelative('明日', 1);
  if (/明後日/.test(text)) addRelative('明後日', 2);

  const explicit = text.match(/(20\d{2})[\/\-年](\d{1,2})[\/\-月](\d{1,2})日?/);
  if (explicit) {
    const [, y, m, d] = explicit;
    anchors.push({
      kind: 'EXPLICIT_DATE',
      phrase: explicit[0],
      normalized: `${y}-${String(Number(m)).padStart(2, '0')}-${String(Number(d)).padStart(2, '0')}`,
    });
  }

  const statePatterns: Array<[
    RegExp,
    import('../../../types').ConversationTemporalReferenceKind,
    import('../../../types').ConversationTemporalAnchor['statePhase']
  ]> = [
    [/修正前|実行前/, 'STATE_BEFORE', 'BEFORE'],
    [/修正後|実行後/, 'STATE_AFTER', 'AFTER'],
    [/現仕様|現在|現状/, 'STATE_CURRENT', 'CURRENT'],
    [/旧仕様|以前|従来/, 'STATE_OLD', 'OLD'],
    [/新仕様|最新状態/, 'STATE_NEW', 'NEW'],
    [/その後|以後|後から/, 'RELATIVE_SEQUENCE', 'SEQUENCE'],
  ];
  for (const [pattern, kind, statePhase] of statePatterns) {
    const match = text.match(pattern);
    if (match) anchors.push({ kind, phrase: match[0], normalized: statePhase, statePhase });
  }

  return { referenceDate: dateKey(0), anchors };
}

/**
 * 設計思想109: 直前Stateを上書きして過去状態を失わず、
 * 現ターンの明示的な時間/状態参照を追加して同一会話軸として追跡する。
 */
export function buildConversationTemporalContext(
  userPrompt: string,
  state: ConversationState,
  previousState: ConversationState | null = null,
  nowMs = Date.now(),
): import('../../../types').ConversationTemporalContext {
  const normalized = normalizeConversationTemporalReferences(userPrompt, nowMs);
  const previous = previousState?.temporalContext || state.temporalContext;
  const allAnchors = [...(previous?.anchors || []), ...normalized.anchors].slice(-24);
  const dateKeys = allAnchors
    .filter((a) => a.kind === 'RELATIVE_DATE' || a.kind === 'EXPLICIT_DATE')
    .map((a) => a.normalized);
  const statePhases = allAnchors
    .filter((a) => Boolean(a.statePhase))
    .map((a) => a.statePhase as NonNullable<import('../../../types').ConversationTemporalAnchor['statePhase']>);
  const activeDateKey = dateKeys.length > 0
    ? dateKeys[dateKeys.length - 1]
    : previous?.activeDateKey;
  const activeStatePhase = statePhases.length > 0
    ? statePhases[statePhases.length - 1]
    : previous?.activeStatePhase;

  const conflicts: string[] = [];
  const sameTurnDateKeys = [...new Set(normalized.anchors
    .filter((a) => a.kind === 'RELATIVE_DATE' || a.kind === 'EXPLICIT_DATE')
    .map((a) => a.normalized))];
  const comparisonContext = /比較|比べ|違い|推移|から.*まで|まで.*から|その後|翌日|翌日以降/.test(String(userPrompt || ''));
  if (sameTurnDateKeys.length > 1 && !comparisonContext) {
    conflicts.push(`同一発話内で時間基準が複数指定されています: ${sameTurnDateKeys.join(' / ')}`);
  }

  const statePairs = new Set(statePhases);
  const hasBefore = statePairs.has('BEFORE') || statePairs.has('OLD');
  const hasAfter = statePairs.has('AFTER') || statePairs.has('NEW');
  if (hasBefore && hasAfter && !comparisonContext) {
    conflicts.push('同一発話内で修正前/修正後または旧仕様/新仕様が比較語なしで混在しています。');
  }

  return {
    referenceDate: normalized.referenceDate,
    anchors: allAnchors,
    activeDateKey,
    activeStatePhase,
    revision: (previous?.revision || 0) + 1,
    conflicts,
  };
}

/**
 * 設計思想109: 最終回答前に、ユーザーが明示した時間/状態軸と
 * 生成された表面文の時間/状態軸が直接衝突していないか検査する。
 * 「比較」「推移」等の明示された比較文脈では両方を許容する。
 */
export function verifyConversationEntityTimeStateConsistency(
  userPrompt: string,
  answerText: string,
  state: ConversationState,
  nowMs = Date.now(),
): import('../../../types').ConversationTemporalConsistencyReport {
  const promptNorm = normalizeConversationTemporalReferences(userPrompt, nowMs);
  const answerNorm = normalizeConversationTemporalReferences(answerText, nowMs);
  const conflicts = [...promptNorm.anchors.length ? buildConversationTemporalContext(userPrompt, state, state, nowMs).conflicts : []];
  const promptDates = promptNorm.anchors
    .filter((a) => a.kind === 'RELATIVE_DATE' || a.kind === 'EXPLICIT_DATE')
    .map((a) => a.normalized);
  const answerDates = answerNorm.anchors
    .filter((a) => a.kind === 'RELATIVE_DATE' || a.kind === 'EXPLICIT_DATE')
    .map((a) => a.normalized);
  const promptStates = promptNorm.anchors.filter((a) => Boolean(a.statePhase));
  const answerStates = answerNorm.anchors.filter((a) => Boolean(a.statePhase));
  const comparisonContext = /比較|比べ|違い|推移|から.*まで|まで.*から|その後|翌日|翌日以降/.test(`${userPrompt} ${answerText}`);

  if (promptDates.length > 0 && answerDates.length > 0 && !comparisonContext) {
    const promptPrimary = promptDates[promptDates.length - 1];
    const differing = answerDates.filter((key) => key !== promptPrimary);
    if (differing.length > 0) conflicts.push(`回答側の時間基準が依頼時点と異なります: ${promptPrimary} -> ${[...new Set(differing)].join(' / ')}`);
  }

  const promptState = promptStates[promptStates.length - 1]?.statePhase;
  const conflictingAnswerStates = answerStates
    .map((a) => a.statePhase)
    .filter((phase) => {
      if (!promptState || !phase) return false;
      if (promptState === 'BEFORE' || promptState === 'OLD') return phase === 'AFTER' || phase === 'NEW' || phase === 'CURRENT';
      if (promptState === 'AFTER' || promptState === 'NEW') return phase === 'BEFORE' || phase === 'OLD';
      if (promptState === 'CURRENT') return phase === 'BEFORE' || phase === 'OLD';
      return false;
    });
  if (conflictingAnswerStates.length > 0 && !comparisonContext) {
    conflicts.push(`回答側の状態基準が依頼時点と衝突しています: ${promptState} -> ${[...new Set(conflictingAnswerStates)].join(' / ')}`);
  }

  // Entity guard: explicit anaphora must resolve to the same target before a temporal/state guard can pass.
  const anaphora = resolveAnaphora(userPrompt, state);
  const promptHasAnaphora = /(?:これ|それ|あれ|さっき|前の|どっち|どちら)/.test(userPrompt);
  if (promptHasAnaphora && anaphora.confidence === 'ambiguous') {
    conflicts.push('参照対象が複数候補のまま時間/状態整合性を確定できません。');
  }

  const normalizedStateKeys = [
    ...promptStates.map((a) => a.statePhase).filter(Boolean),
    ...answerStates.map((a) => a.statePhase).filter(Boolean),
  ] as string[];
  return {
    passed: conflicts.length === 0,
    conflicts: [...new Set(conflicts)],
    normalizedTimeKeys: [...new Set([...promptDates, ...answerDates])],
    normalizedStateKeys: [...new Set(normalizedStateKeys)],
  };
}

export interface ConversationConsistencyReport{needsRepair:boolean;unresolvedState?:import('../../../types').ConversationUnresolvedState;reason?:string;turnDependency:import('../../../types').ConversationTurnDependency;repairedState:ConversationState;}
export function evaluateConversationConsistency(userPrompt:string,state:ConversationState,previousState:ConversationState|null,taskId?:string):ConversationConsistencyReport{
 const text=String(userPrompt||'').trim(); const anaphora=resolveAnaphora(text,state); const correction=/(?:違う|それじゃない|ではなく|じゃない|間違|誤解|勘違い)/i.test(text); const referenceMentioned=/(?:これ|それ|あれ|さっき|前の|どっち|どちら)/.test(text); const clarificationNeeded=anaphora.confidence==='ambiguous'||(anaphora.confidence==='unresolved'&&referenceMentioned);
 const unresolvedState: any=state.lastResultStatus==='NEEDS_CONFIRMATION'?'PENDING_USER_INPUT':state.lastResultStatus==='UNRESOLVED'?'UNKNOWN':undefined;
 const dependency={turnKey:`TURN-${canonicalSha256({prompt:text,goal:state.goalProgress?.activeGoalId||previousState?.goalProgress?.activeGoalId||'',revision:state.goalProgress?.revision||0}).slice(0,20)}`,dependsOnGoalId:state.goalProgress?.activeGoalId||previousState?.goalProgress?.activeGoalId,dependsOnEntity:anaphora.resolved||state.currentTopic||undefined,dependsOnTaskId:taskId,dependsOnClaimIds:state.lastCandidateClaimId?[state.lastCandidateClaimId]:[],dependsOnMemoryIds:[],referenceConfidence:anaphora.confidence};
 const needsRepair=correction||clarificationNeeded; const reason=correction?'USER_CORRECTION_REQUIRES_DIALOGUE_REPAIR':clarificationNeeded?'REFERENCE_AMBIGUOUS_REQUIRES_RESOLUTION':undefined;
 const knowledgeState=classifyConversationKnowledgeState(text,state); const correctionScope=correction?inferConversationCorrectionScope(text):undefined; const completeness=assessConversationCompleteness(state);
 const previousClarification=state.clarificationControl||{askedCount:0,maxQuestions:2,waitingForUser:false};
 const repairedState={...state,unresolvedState,turnDependencies:[...(previousState?.turnDependencies||[]),dependency].slice(-16),dialogueRepair:{required:needsRepair,reason,invalidatedTargets:correction?[previousState?.currentTopic,previousState?.goalProgress?.activeGoal].filter(Boolean) as string[]:[],repairRevision:(previousState?.dialogueRepair?.repairRevision||0)+(needsRepair?1:0)},clarificationPending:clarificationNeeded,knowledgeState,correctionScope:correction?correctionScope?.scope:state.correctionScope,clarificationControl:{...previousClarification,waitingForUser:clarificationNeeded},conversationCompleteness:completeness,pendingQuestions:correction&&clarificationNeeded?[...new Set([...state.pendingQuestions,'正しい参照対象'])].slice(-5):state.pendingQuestions};
 return {needsRepair,unresolvedState,reason,turnDependency:dependency,repairedState};
}

export interface ExtractConversationStateOptions {
  turnTaskId?: string;
  userPrompt?: string;
  inferredExpectedLength?: ResponseLength;
  stateDurationMs?: number;
}

export interface StateExtractionStats {
  hasStateTag: boolean;
  rawStateChars: number;
  estimatedTokens: number;
  durationMs?: number;
  isKeyShortened: boolean;
  keysFound: string[];
}

export function extractConversationState(
  rawResponse: string,
  prevState: ConversationState | null,
  options?: ExtractConversationStateOptions
): {
  state: ConversationState;
  visibleText: string;
  stats: StateExtractionStats;
} {
  const preserveAnswerChangeState=<T extends ConversationState>(nextState:T):T=>({...nextState,lastAnswerDecisionSnapshot:prevState?.lastAnswerDecisionSnapshot,answerDecisionHistory:prevState?.answerDecisionHistory,lastAnswerChangeExplanation:prevState?.lastAnswerChangeExplanation});
  const match = rawResponse.match(/<state>([\s\S]*?)<\/state>/);
  const visibleText = rawResponse.replace(/<state>[\s\S]*?<\/state>\s*/, '').trim();

  // ルールベースによる補完値の計算
  const ruleInferredStage = inferConversationStage(
    options?.userPrompt || '',
    prevState?.stage || 'QUESTION'
  );
  const effectiveLength: ResponseLength =
    options?.inferredExpectedLength || prevState?.expectedResponseLength || 'standard';

  if (!match) {
    // 抽出失敗（モデルがstateを出力しなかった、または途中で切れた）時は
    // ルールベース推定値を活用して最新状態へ更新
    const fallbackState: ConversationState = {
      currentTopic: prevState?.currentTopic || '',
      topLevelGoal: prevState?.topLevelGoal || '',
      stage: ruleInferredStage,
      confirmedFacts: prevState?.confirmedFacts || [],
      corrections: prevState?.corrections || [],
      invalidatedAssumptions: prevState?.invalidatedAssumptions || [],
      pendingQuestions: prevState?.pendingQuestions || [],
      expectedResponseLength: effectiveLength,
      explanationAdaptation: adaptExplanationDetailLevel(options?.userPrompt || '', prevState, effectiveLength),
      recentEntities: prevState?.recentEntities || (prevState?.currentTopic ? [prevState.currentTopic] : []),
      updatedAt: Date.now(),
    };

    const stats: StateExtractionStats = {
      hasStateTag: false,
      rawStateChars: 0,
      estimatedTokens: 0,
      durationMs: options?.stateDurationMs,
      isKeyShortened: false,
      keysFound: [],
    };

    systemLogger.info(
      'STATE_EXTRACTION',
      `ℹ️ [会話状態(state) 抽出結果] <state>タグなし (出力スキップ) | 文字数: 0字 (0 tok) | 所要時間: ${options?.stateDurationMs ?? 'N/A'}ms | ルールベース推定ステージ: ${fallbackState.stage} | 回答長: ${fallbackState.expectedResponseLength}`
    );

    const goalState=updateConversationGoalProgress(fallbackState, options?.userPrompt||'',prevState); const consistency=evaluateConversationConsistency(options?.userPrompt||'',goalState,prevState,options?.turnTaskId); const repairedState=preserveAnswerChangeState({...consistency.repairedState,temporalContext:buildConversationTemporalContext(options?.userPrompt||'',consistency.repairedState,prevState)}); return { state: repairedState, visibleText: rawResponse, stats };
  }

  const rawStateBlock = match[0];
  const rawJsonStr = match[1].trim();
  const rawStateChars = rawStateBlock.length;
  // JSONは英数字・記号・日本語の混合のため、約1.5文字/トークンで推計
  const estimatedTokens = Math.max(1, Math.round(rawStateChars / 1.5));

  try {
    const parsed = JSON.parse(rawJsonStr);
    const keysFound = Object.keys(parsed);
    // 短縮キー (t, g, s, f, c, inv, q, len) の有無を検知
    const isKeyShortened = keysFound.some((k) => ['t', 'g', 's', 'f', 'c', 'inv', 'q', 'len'].includes(k));

    // 1. Topic (短縮: t, 従来: currentTopic)
    const currentTopic = parsed.t || parsed.currentTopic || prevState?.currentTopic || '';

    // 2. Goal (短縮: g, 従来: topLevelGoal)
    const topLevelGoal = parsed.g || parsed.topLevelGoal || prevState?.topLevelGoal || '';

    // 3. Stage (短縮: s, 従来: stage, 未指定時はルールベース推定)
    const stage: ConversationStage = parsed.s || parsed.stage || ruleInferredStage;

    // 4. Confirmed Facts (短縮: f, 従来: confirmedFacts)
    const rawFacts = parsed.f || parsed.confirmedFacts;
    const confirmedFacts: string[] = Array.isArray(rawFacts)
      ? Array.from(new Set([...(prevState?.confirmedFacts || []), ...rawFacts])).slice(-10)
      : prevState?.confirmedFacts || [];

    // 5. Corrections (短縮: c, 従来: corrections)
    const rawCorrections = parsed.c || parsed.corrections;
    let newCorrections = prevState?.corrections || [];
    if (Array.isArray(rawCorrections) && rawCorrections.length > 0) {
      const normalized = rawCorrections.map((item: any) => ({
        oldValue: item.o || item.oldValue || '',
        newValue: item.n || item.newValue || '',
        affectedTopics: item.affectedTopics || [],
        timestamp: Date.now(),
      }));
      newCorrections = [...newCorrections, ...normalized].slice(-10);
    }

    // 6. Invalidated Assumptions (短縮: inv, 従来: invalidatedAssumptions)
    const rawInv = parsed.inv || parsed.invalidatedAssumptions;
    const invalidatedAssumptions: string[] = Array.isArray(rawInv)
      ? Array.from(new Set([...(prevState?.invalidatedAssumptions || []), ...rawInv])).slice(-10)
      : prevState?.invalidatedAssumptions || [];

    // 7. Pending Questions (短縮: q, 従来: pendingQuestions)
    const rawQ = parsed.q || parsed.pendingQuestions;
    const pendingQuestions: string[] = Array.isArray(rawQ) ? rawQ.slice(0, 5) : [];

    // 8. Expected Response Length (短縮: len, 従来: expectedResponseLength, 未指定時はコード側判定値)
    const expectedResponseLength: ResponseLength =
      parsed.len || parsed.expectedResponseLength || effectiveLength;

    // 9. Recent Entities (短縮: e, 従来: recentEntities)
    const rawEntities = parsed.e || parsed.recentEntities;
    const extractedEntities: string[] = Array.isArray(rawEntities)
      ? rawEntities.filter((x: any) => typeof x === 'string')
      : [];
    const candidateEntities = [
      ...(prevState?.recentEntities || []),
      ...extractedEntities,
      ...(currentTopic ? [currentTopic] : []),
      ...confirmedFacts,
    ];
    const recentEntities = Array.from(new Set(candidateEntities)).filter(Boolean).slice(-10);

    const state: ConversationState = {
      currentTopic,
      topLevelGoal,
      stage,
      confirmedFacts,
      corrections: newCorrections,
      invalidatedAssumptions,
      pendingQuestions,
      expectedResponseLength,
      explanationAdaptation: adaptExplanationDetailLevel(options?.userPrompt || '', prevState, expectedResponseLength),
      recentEntities,
      updatedAt: Date.now(),
      lastFalsificationPassed: prevState?.lastFalsificationPassed,
      lastFalsificationScore: prevState?.lastFalsificationScore,
      lastReasoningTemplateId: prevState?.lastReasoningTemplateId,
      lastCandidateClaimId: prevState?.lastCandidateClaimId,
    };

    const stats: StateExtractionStats = {
      hasStateTag: true,
      rawStateChars,
      estimatedTokens,
      durationMs: options?.stateDurationMs,
      isKeyShortened,
      keysFound,
    };

    systemLogger.info(
      'STATE_EXTRACTION',
      `🔍 [会話状態(state) 出力コスト実測] 文字数: ${rawStateChars}字 (~${estimatedTokens} tok) | 生成所要時間: ${options?.stateDurationMs ?? 'N/A'}ms | 短縮形式: ${isKeyShortened ? '短縮キー (軽量版)' : '従来キー'} | ステージ: ${state.stage} (モデル=${parsed.s || parsed.stage || '省略'}, ルール推定=${ruleInferredStage}) | 回答長: ${state.expectedResponseLength}`,
      { stats, parsedKeys: keysFound }
    );

    const goalState=updateConversationGoalProgress(state, options?.userPrompt||'',prevState); const consistency=evaluateConversationConsistency(options?.userPrompt||'',goalState,prevState,options?.turnTaskId); const repairedState=preserveAnswerChangeState({...consistency.repairedState,temporalContext:buildConversationTemporalContext(options?.userPrompt||'',consistency.repairedState,prevState)}); return { state: repairedState, visibleText, stats };
  } catch (parseErr) {
    // JSON構文エラー時はフォールバック
    const fallbackState: ConversationState = {
      currentTopic: prevState?.currentTopic || '',
      topLevelGoal: prevState?.topLevelGoal || '',
      stage: ruleInferredStage,
      confirmedFacts: prevState?.confirmedFacts || [],
      corrections: prevState?.corrections || [],
      invalidatedAssumptions: prevState?.invalidatedAssumptions || [],
      pendingQuestions: prevState?.pendingQuestions || [],
      expectedResponseLength: effectiveLength,
      explanationAdaptation: adaptExplanationDetailLevel(options?.userPrompt || '', prevState, effectiveLength),
      updatedAt: Date.now(),
      lastFalsificationPassed: prevState?.lastFalsificationPassed,
      lastFalsificationScore: prevState?.lastFalsificationScore,
      lastReasoningTemplateId: prevState?.lastReasoningTemplateId,
      lastCandidateClaimId: prevState?.lastCandidateClaimId,
    };

    const stats: StateExtractionStats = {
      hasStateTag: true,
      rawStateChars,
      estimatedTokens,
      durationMs: options?.stateDurationMs,
      isKeyShortened: false,
      keysFound: [],
    };

    systemLogger.warn(
      'STATE_EXTRACTION',
      `⚠️ [会話状態(state) JSONパース失敗] 文字数: ${rawStateChars}字 (~${estimatedTokens} tok) | ルールベース推定値を採用しました。`,
      { parseErr: (parseErr as any)?.message }
    );

    const goalState=updateConversationGoalProgress(fallbackState, options?.userPrompt||'',prevState); const consistency=evaluateConversationConsistency(options?.userPrompt||'',goalState,prevState,options?.turnTaskId); const repairedState={...consistency.repairedState,temporalContext:buildConversationTemporalContext(options?.userPrompt||'',consistency.repairedState,prevState)}; return { state: repairedState, visibleText, stats };
  }
}

export function defaultConversationState(): ConversationState {
  return {
    currentTopic: '',
    topLevelGoal: '',
    stage: 'QUESTION',
    confirmedFacts: [],
    corrections: [],
    invalidatedAssumptions: [],
    pendingQuestions: [],
    expectedResponseLength: 'standard',
    recentEntities: [],
    updatedAt: Date.now(),
  };
}

export function formatConversationStateForPrompt(state: ConversationState): string {
  if (!state.currentTopic && !state.topLevelGoal) return '';
  const lines = [
    `【会話状態】`,
    `現在の話題: ${state.currentTopic || '(未設定)'}`,
    `最上位目的: ${state.topLevelGoal || '(未設定)'}`,
    `会話段階: ${state.stage}`,
  ];
  if (state.confirmedFacts.length) lines.push(`確定事項: ${state.confirmedFacts.join(' / ')}`);
  if (state.invalidatedAssumptions.length) lines.push(`無効化された前提(使用禁止): ${state.invalidatedAssumptions.join(' / ')}`);
  if (state.corrections.length) {
    const last = state.corrections[state.corrections.length - 1];
    lines.push(`直近の訂正: 「${last.oldValue}」→「${last.newValue}」`);
  }
  if (state.temporalContext?.activeDateKey) lines.push(`時間基準: ${state.temporalContext.activeDateKey}`);
  if (state.temporalContext?.activeStatePhase) lines.push(`状態基準: ${state.temporalContext.activeStatePhase}`);
  lines.push(`期待される回答長: ${state.expectedResponseLength}`);
  return lines.join('\n');
}

export function cleanStreamingVisibleText(rawStreamedText: string): string {
  return rawStreamedText.replace(/<state>[\s\S]*?<\/state>\s*/, '').replace(/<state>[\s\S]*/, '');
}

/**
 * 指示語・照応解決の結果
 */
export interface InformationGainQuestionResult {
  shouldAsk: boolean;
  question: string;
  candidateCount: number;
  expectedRemainingCandidates: number;
  informationGainBits: number;
  reason: string;
}

export interface AnaphoraResolutionResult {
  detectedExpression: string | null;
  resolved: string | null;
  candidates: string[];
  confidence: 'unique' | 'ambiguous' | 'unresolved';
}

/**
 * 非LLM決定的指示語解決純粋関数 (元設計書 4.2節 & 作業指示書 フェーズ1)
 *
 * 対象表現：「あれ」「それ」「これ」「前の」「さっきの」「どっち」「どちら」
 * （まずはこの範囲に限定し、拡張は反例が出てから行う。元設計書54章「削減知能と機能追加抑制」の思想に従う）
 *
 * - 候補が1件に絞れる場合: confidence = 'unique', resolved = 対象文字列
 * - 候補が2件以上残る場合: confidence = 'ambiguous', resolved = null, candidates = [選択肢...]
 * - 該当なしの場合: confidence = 'unresolved', resolved = null, candidates = []
 */
export function selectInformationGainQuestion(candidates: string[]): InformationGainQuestionResult {
  const normalized = [...new Set(candidates.map(item => item.trim()).filter(Boolean))];
  const n = normalized.length;
  if (n <= 1) return { shouldAsk: false, question: '', candidateCount: n, expectedRemainingCandidates: n, informationGainBits: 0, reason: '候補が一意または存在しないため質問不要' };
  if (n === 2) return {
    shouldAsk: true,
    question: `「${normalized[0]}」と「${normalized[1]}」のどちらを指していますか？`,
    candidateCount: 2,
    expectedRemainingCandidates: 1,
    informationGainBits: 1,
    reason: '二択は1問で候補を一意化できるため、最大情報利得の確認質問を選択',
  };

  const entropy = (x: number): number => x <= 1 ? 0 : Math.log2(x);
  const tokenMap = new Map<string, Set<number>>();
  normalized.forEach((candidate, index) => {
    const tokens = candidate.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) || [];
    for (const token of new Set(tokens)) {
      if (!tokenMap.has(token)) tokenMap.set(token, new Set<number>());
      tokenMap.get(token)!.add(index);
    }
  });

  let best: { token: string; yes: number; no: number; gain: number } | undefined;
  const baseEntropy = entropy(n);
  for (const [token, indexes] of tokenMap) {
    const yes = indexes.size;
    const no = n - yes;
    if (yes === 0 || no === 0) continue;
    const expected = (yes / n) * yes + (no / n) * no;
    const gain = baseEntropy - entropy(expected);
    if (!best || gain > best.gain || (gain === best.gain && token < best.token)) best = { token, yes, no, gain };
  }

  if (best) {
    const preview = normalized.slice(0, 4).join(' / ');
    const expected = (best.yes / n) * best.yes + (best.no / n) * best.no;
    return {
      shouldAsk: true,
      question: `「${best.token}」を含む候補を指していますか？（候補: ${preview}${n > 4 ? ' / …' : ''}）`,
      candidateCount: n,
      expectedRemainingCandidates: Number(expected.toFixed(3)),
      informationGainBits: Number(best.gain.toFixed(3)),
      reason: `候補を${best.yes}件/${best.no}件へ最も均等に分割する識別語「${best.token}」を採用`,
    };
  }

  const preview = normalized.slice(0, 4).join(' / ');
  const expected = (1 / n) * 1 + ((n - 1) / n) * (n - 1);
  return {
    shouldAsk: true,
    question: `次の候補のどれを指していますか？「${preview}${n > 4 ? ' / …' : ''}」`,
    candidateCount: n,
    expectedRemainingCandidates: Number(expected.toFixed(3)),
    informationGainBits: Number((baseEntropy - entropy(expected)).toFixed(3)),
    reason: '識別語で有効な分割を作れないため候補列挙による最小質問へフォールバック',
  };
}

export function resolveAnaphora(
  prompt: string,
  state: ConversationState
): AnaphoraResolutionResult {
  if (!prompt || typeof prompt !== 'string') {
    return { detectedExpression: null, resolved: null, candidates: [], confidence: 'unresolved' };
  }

  const p = prompt.trim();
  // 対象表現の検出: 「さっきの」「前の」「あれ」「それ」「これ」「どっち」「どちら」
  const anaphoraRegex = /(さっきの|前の方|前のやつ|前の|あれ|それ|これ|どっち|どちら)/;
  const match = p.match(anaphoraRegex);
  if (!match) {
    return { detectedExpression: null, resolved: null, candidates: [], confidence: 'unresolved' };
  }

  const expr = match[1];

  // 直近1〜2ターンのエンティティを優先する候補プール構築 (設計思想: 最新ターン優先・一定ターン以前の過剰遡及防止)
  const recentSlice = (state.recentEntities || []).slice(-3);
  const factsSlice = (state.confirmedFacts || []).slice(-2);
  const topicList = state.currentTopic ? [state.currentTopic] : [];

  // 時系列順: 現在トピック -> 確定事実 -> 直近エンティティ (末尾が最新)
  const ordered = [...topicList, ...factsSlice, ...recentSlice]
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);

  // 重複排除: 最新の出現順 (末尾) を優先保持
  const seen = new Set<string>();
  const pool: string[] = [];
  for (let i = ordered.length - 1; i >= 0; i--) {
    const item = ordered[i];
    if (!seen.has(item)) {
      seen.add(item);
      pool.unshift(item);
    }
  }

  // 自律モジュール anaphoraHistoryStack への同期
  try {
    for (const item of pool) {
      anaphoraHistoryStack.push(item, 'ENTITY', 1);
    }
  } catch (e) {
    console.warn('Failed to sync with anaphoraHistoryStack:', e);
  }

  // 自律モジュール resolveAnaphoraPure を用いた純粋関数解決
  const pureResult = resolveAnaphoraPure(p, pool);
  if (pureResult.detectedExpression && pureResult.confidence !== 'unresolved') {
    return {
      detectedExpression: pureResult.detectedExpression,
      resolved: pureResult.resolved,
      candidates: pureResult.candidates,
      confidence: pureResult.confidence,
    };
  }

  // 1. 比較・選択肢の表現 (「どっち」「どちら」)
  if (expr === 'どっち' || expr === 'どちら') {
    // ユーザー発言自体に明示的な比較対象があるか (例:「AとBどっち」「AかBどちら」)
    const vsMatch = p.match(/(.+?)(?:と|vs|または|か)(.+?)(?:どっち|どちら)/i);
    if (vsMatch) {
      const c1 = vsMatch[1].trim().replace(/^[、\s]+|[、\s]+$/g, '');
      const c2 = vsMatch[2].trim().replace(/^[、\s]+|[、\s]+$/g, '');
      const directCandidates = [c1, c2].filter((c) => c.length > 0 && c.length < 50);
      if (directCandidates.length >= 2) {
        return {
          detectedExpression: expr,
          resolved: null,
          candidates: directCandidates,
          confidence: 'ambiguous', // 2つの選択肢が存在するため曖昧（聞き返し推奨）
        };
      }
    }

    // 会話状態のプールからの解決
    if (pool.length >= 2) {
      return {
        detectedExpression: expr,
        resolved: null,
        candidates: pool.slice(-2), // 直近の2つの選択肢
        confidence: 'ambiguous',
      };
    } else if (pool.length === 1) {
      return {
        detectedExpression: expr,
        resolved: pool[0],
        candidates: [pool[0]],
        confidence: 'unique',
      };
    }
    return {
      detectedExpression: expr,
      resolved: null,
      candidates: [],
      confidence: 'unresolved',
    };
  }

  // 2. 直前参照表現 (「前の」「さっきの」「前の方」「前のやつ」)
  if (expr === '前の' || expr === 'さっきの' || expr === '前のやつ' || expr === '前の方') {
    // 「さっきの〜」で後続名詞が存在する場合の特定判定 (例:「さっきのユーティリティ型」)
    const modifierMatch = p.match(/(?:さっきの|前の)(.+?)(?:と|で|を|に|が|は|も|の|！|？|、|\s|$)/);
    const targetNoun = modifierMatch ? modifierMatch[1].trim() : '';

    if (targetNoun && targetNoun !== 'やつ' && targetNoun !== '方') {
      // 後続名詞に合致するエンティティをプールから検索
      const matchedEntity = pool.find(
        (item) => item.includes(targetNoun) || targetNoun.includes(item)
      );
      if (matchedEntity) {
        return {
          detectedExpression: expr,
          resolved: matchedEntity,
          candidates: [matchedEntity],
          confidence: 'unique',
        };
      }
      // プール内に該当名詞が存在しない場合 (例:「さっきのエラーログ」でエラーログが初出)
      // 無関係な直前トピックに誤バインドせず unresolved とする
      return {
        detectedExpression: expr,
        resolved: null,
        candidates: [],
        confidence: 'unresolved',
      };
    }

    // 「前のやつ」「前の」で現在トピックとの対比である場合、1つ前のエンティティを優先
    if ((expr === '前のやつ' || expr === '前の' || expr === '前の方') && pool.length >= 2) {
      const priorEntity = pool[pool.length - 2];
      return {
        detectedExpression: expr,
        resolved: priorEntity,
        candidates: [priorEntity],
        confidence: 'unique',
      };
    }

    if (pool.length >= 1) {
      // 直近の要素を一意解決
      const mostRecent = pool[pool.length - 1];
      return {
        detectedExpression: expr,
        resolved: mostRecent,
        candidates: [mostRecent],
        confidence: 'unique',
      };
    }
    return {
      detectedExpression: expr,
      resolved: null,
      candidates: [],
      confidence: 'unresolved',
    };
  }

  // 3. 指示代名詞 (「これ」「それ」「あれ」)
  if (pool.length === 1) {
    return {
      detectedExpression: expr,
      resolved: pool[0],
      candidates: pool,
      confidence: 'unique',
    };
  } else if (pool.length > 1) {
    // 複数候補が存在する場合は ambiguous
    return {
      detectedExpression: expr,
      resolved: null,
      candidates: pool.slice(-3),
      confidence: 'ambiguous',
    };
  }

  return {
    detectedExpression: expr,
    resolved: null,
    candidates: [],
    confidence: 'unresolved',
  };
}

