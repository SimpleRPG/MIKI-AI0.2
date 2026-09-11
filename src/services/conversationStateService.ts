import { ConversationState, ConversationStage, ResponseLength, DialogueAct, FeedbackStage } from '../types';
import { systemLogger } from './systemLogger';
import { anaphoraHistoryStack } from '../autonomous_modules/anaphora_history_stack';
import { resolveAnaphoraPure } from '../autonomous_modules/anaphora_resolver_sample';

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

  // 代表的な日常の挨拶・相槌・声かけ
  const greetingPattern =
    /^(ただいま|ただいまー|ただいま〜|お帰り|おかえり|おかえりー|おはよう|おはよー|おはようございます|おやすみ|おやすみー|おやすみなさい|こんにちは|こんちは|こんばんは|こんばんわ|いってきます|行ってきます|行ってきまーす|いってらっしゃい|行ってらっしゃい|やっほー|ヤッホー|やあ|ハロー|hello|hi|バイバイ|またね|じゃあね|さようなら|お疲れ|お疲れ様|おつかれ|おつかれさま|ありがとう|ありがと|ありがとー|サンキュー|どうも|感謝|うん|ううん|はい|いいえ|そうだね|そうそう|なるほど|了解|りょ|りょうかい|わかった|ok|オッケー|おっけー|みき|みきちゃん|ねえ|ねえねえ|元気[？?]?)$/i;

  return greetingPattern.test(p);
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
      recentEntities,
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
  lines.push(`期待される回答長: ${state.expectedResponseLength}`);
  return lines.join('\n');
}

export function cleanStreamingVisibleText(rawStreamedText: string): string {
  return rawStreamedText.replace(/<state>[\s\S]*?<\/state>\s*/, '').replace(/<state>[\s\S]*/, '');
}

/**
 * 指示語・照応解決の結果
 */
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

  // 時系列順: 確定事実 -> 直近エンティティ -> 現在トピック (末尾が最新)
  const ordered = [...factsSlice, ...recentSlice, ...topicList]
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

