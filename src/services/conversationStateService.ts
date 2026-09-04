import { ConversationState } from '../types';

export const CONVERSATION_STATE_INSTRUCTION = `
回答本文を書く前に、必ず次の形式で会話状態を1行のJSONとして出力してください。
このJSONはユーザーには見えないよう後で除去されるので、体裁を気にせず正確に書いてください。

<state>{"currentTopic":"...","topLevelGoal":"...","stage":"QUESTION|CLARIFICATION|CORRECTION|COMPARISON|DECISION|FOLLOW_UP|TOPIC_CHANGE|CLOSING","confirmedFacts":["..."],"corrections":[{"oldValue":"...","newValue":"...","affectedTopics":["..."]}],"invalidatedAssumptions":["..."],"pendingQuestions":["..."],"expectedResponseLength":"short|standard|detailed"}</state>

その直後に、通常通りの自然な日本語で回答を続けてください。
`;

export function extractConversationState(rawResponse: string, prevState: ConversationState | null): {
  state: ConversationState;
  visibleText: string;
} {
  const match = rawResponse.match(/<state>([\s\S]*?)<\/state>/);
  const visibleText = rawResponse.replace(/<state>[\s\S]*?<\/state>\s*/, '').trim();

  if (!match) {
    // 抽出失敗時は前回の状態をそのまま維持し、回答本文はそのまま使う
    return { state: prevState ?? defaultConversationState(), visibleText: rawResponse };
  }

  try {
    const parsed = JSON.parse(match[1]);
    const state: ConversationState = {
      currentTopic: parsed.currentTopic || prevState?.currentTopic || '',
      topLevelGoal: parsed.topLevelGoal || prevState?.topLevelGoal || '',
      stage: parsed.stage || 'QUESTION',
      confirmedFacts: Array.isArray(parsed.confirmedFacts) ? parsed.confirmedFacts.slice(0, 10) : (prevState?.confirmedFacts || []),
      corrections: Array.isArray(parsed.corrections)
        ? [...(prevState?.corrections || []), ...parsed.corrections.map((c: any) => ({ ...c, timestamp: Date.now() }))].slice(-10)
        : (prevState?.corrections || []),
      invalidatedAssumptions: Array.isArray(parsed.invalidatedAssumptions)
        ? Array.from(new Set([...(prevState?.invalidatedAssumptions || []), ...parsed.invalidatedAssumptions])).slice(-10)
        : (prevState?.invalidatedAssumptions || []),
      pendingQuestions: Array.isArray(parsed.pendingQuestions) ? parsed.pendingQuestions.slice(0, 5) : [],
      expectedResponseLength: parsed.expectedResponseLength || 'standard',
      updatedAt: Date.now(),
    };
    return { state, visibleText };
  } catch {
    return { state: prevState ?? defaultConversationState(), visibleText };
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
