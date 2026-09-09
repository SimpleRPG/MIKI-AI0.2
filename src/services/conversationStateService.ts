import { ConversationState, ConversationStage, ResponseLength } from '../types';
import { systemLogger } from './systemLogger';

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

export interface ExtractConversationStateOptions {
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

    return { state: fallbackState, visibleText: rawResponse, stats };
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

    const state: ConversationState = {
      currentTopic,
      topLevelGoal,
      stage,
      confirmedFacts,
      corrections: newCorrections,
      invalidatedAssumptions,
      pendingQuestions,
      expectedResponseLength,
      updatedAt: Date.now(),
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

    return { state, visibleText, stats };
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
      updatedAt: Date.now(),
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

    return { state: fallbackState, visibleText, stats };
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
  lines.push(`期待される回答長: ${state.expectedResponseLength}`);
  return lines.join('\n');
}

export function cleanStreamingVisibleText(rawStreamedText: string): string {
  return rawStreamedText.replace(/<state>[\s\S]*?<\/state>\s*/, '').replace(/<state>[\s\S]*/, '');
}

