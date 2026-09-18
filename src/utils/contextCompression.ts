import { ChatMessage, CompressedContextResult } from '../types';

/**
 * 日本語・コード混在テキストのトークン数高速推定
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // 日本語文字（約1.3トークン/文字）+ 英単語
  const japaneseCharCount = (text.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g) || []).length;
  const nonJapaneseWords = text.replace(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g, ' ').split(/\s+/).filter(Boolean).length;

  return Math.round(japaneseCharCount * 1.3 + nonJapaneseWords * 1.3);
}

/**
 * 過去メッセージ群から要約（エピソード蒸留）を生成
 */
function summarizeOldTurns(messages: ChatMessage[]): string {
  if (messages.length === 0) return '';

  const bulletPoints: string[] = [];
  let userKeyQuestions: string[] = [];
  let codeSnippetsMentioned: string[] = [];

  messages.forEach((msg) => {
    const text = msg.content;
    if (msg.role === 'user') {
      if (text.length > 50) {
        userKeyQuestions.push(text.substring(0, 45) + '...');
      } else {
        userKeyQuestions.push(text);
      }
    } else {
      if (text.includes('```vba')) {
        codeSnippetsMentioned.push('Excel VBAマクロコードの提供');
      } else if (text.includes('```javascript') || text.includes('```html')) {
        codeSnippetsMentioned.push('HTML/Canvas/JS描画コードの提供');
      }
    }
  });

  bulletPoints.push(`- ユーザーの主な関心・質問: ${userKeyQuestions.slice(-3).join(' / ')}`);
  if (codeSnippetsMentioned.length > 0) {
    bulletPoints.push(`- 提供・議論した実装: ${Array.from(new Set(codeSnippetsMentioned)).join(', ')}`);
  }
  bulletPoints.push('- 会話トーン: タメ口・親友ペルソナ継続中');

  return `【過去の対話エピソード要約】\n${bulletPoints.join('\n')}`;
}

export interface ContextCompressionOptions {
  maxContextTokens?: number;       // 例: live_budget または historyQuota (設計思想 Master v5.0 第4章 B層)
  recentTurnsToKeep?: number;      // 直近残すターン数 (デフォルト: 4〜8往復)
  triggerTokenThreshold?: number;  // 圧縮を開始する閾値
}

/**
 * コンテキスト圧縮 ＆ スライディングウィンドウ実行 (Context Compression Engine)
 * 設計思想 Master v5.0 第4章 B層: ターン単位の動的予算配分
 * live_budget (または historyQuota) を上限として、超過時は直近ターン数を安全に縮小しながらエピソード蒸留を実施
 */
export function compressContextHistory(
  messages: ChatMessage[],
  options: ContextCompressionOptions = {}
): CompressedContextResult {
  // maxContextTokens が指定されている場合はそれを最優先トリガー閾値として採用 (第4章 B層 実配線)
  const effectiveThreshold = options.maxContextTokens
    ? Math.max(400, Math.floor(options.maxContextTokens * 0.9))
    : options.triggerTokenThreshold || 1200;

  let recentTurnsToKeep = options.recentTurnsToKeep || 6;

  // 全体トークン数推定
  const totalOriginalText = messages.map((m) => m.content).join('\n');
  const originalTokensEstimated = estimateTokens(totalOriginalText);

  // 閾値未満またはメッセージ数が少なければ圧縮不要
  if (messages.length <= recentTurnsToKeep && originalTokensEstimated < effectiveThreshold) {
    return {
      isCompressed: false,
      originalTokensEstimated,
      compressedTokensEstimated: originalTokensEstimated,
      compressionRatio: 1.0,
      summarizedTurnCount: 0,
      activeRecentTurnCount: messages.length,
      episodeSummary: '',
      formattedMessages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    };
  }

  // もし直近ターンだけでも閾値を超える場合、recentTurnsToKeep を段階的に4〜2まで安全縮小
  let splitIndex = Math.max(0, messages.length - recentTurnsToKeep);
  let recentMessages = messages.slice(splitIndex);
  let recentTokens = estimateTokens(recentMessages.map((m) => m.content).join('\n'));

  while (recentTokens > effectiveThreshold && recentTurnsToKeep > 2) {
    recentTurnsToKeep = Math.max(2, recentTurnsToKeep - 2);
    splitIndex = Math.max(0, messages.length - recentTurnsToKeep);
    recentMessages = messages.slice(splitIndex);
    recentTokens = estimateTokens(recentMessages.map((m) => m.content).join('\n'));
  }

  const oldMessages = messages.slice(0, splitIndex);

  // 要約生成
  const episodeSummary = summarizeOldTurns(oldMessages);

  // 圧縮後メッセージリスト構築
  const formattedMessages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
    {
      role: 'system',
      content: episodeSummary,
    },
    ...recentMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  const compressedText = episodeSummary + '\n' + recentMessages.map((m) => m.content).join('\n');
  const compressedTokensEstimated = estimateTokens(compressedText);
  const compressionRatio = Number((compressedTokensEstimated / Math.max(1, originalTokensEstimated)).toFixed(2));

  return {
    isCompressed: true,
    originalTokensEstimated,
    compressedTokensEstimated,
    compressionRatio,
    summarizedTurnCount: oldMessages.length,
    activeRecentTurnCount: recentMessages.length,
    episodeSummary,
    formattedMessages,
  };
}

/**
 * 文単位で最大文字数以内に収まるよう安全に切り詰めるヘルパー (作業指示書 v5 優先度7)
 * 文の途中で切れて不自然な文脈になるのを防ぐため、句点(。)や改行(\n)等の文境界を優先検出して切り詰める。
 */
export function truncateTextBySentence(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text || '';

  const sub = text.slice(0, maxChars);

  // 句点・改行・感嘆符・疑問符・英語ピリオドのインデックスを探索
  const lastPeriod = sub.lastIndexOf('。');
  const lastNewline = sub.lastIndexOf('\n');
  const lastExcl = Math.max(sub.lastIndexOf('！'), sub.lastIndexOf('!'));
  const lastQuest = Math.max(sub.lastIndexOf('？'), sub.lastIndexOf('?'));
  const lastDot = sub.lastIndexOf('. ');

  const delimiterIndices = [lastPeriod, lastNewline, lastExcl, lastQuest, lastDot].filter((idx) => idx >= 0);

  if (delimiterIndices.length > 0) {
    const bestDelimiter = Math.max(...delimiterIndices);
    // 区切り位置が上限の35%以上残っている場合は、文の境界で自然に切る
    if (bestDelimiter >= Math.floor(maxChars * 0.35)) {
      return sub.slice(0, bestDelimiter + 1).trimEnd();
    }
  }

  // 境界が手前に存在しない場合は、上限文字数で切る
  return sub.trimEnd();
}
