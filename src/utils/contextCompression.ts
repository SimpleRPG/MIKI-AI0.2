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
  maxContextTokens?: number;       // 例: 2048トークン
  recentTurnsToKeep?: number;      // 直近残すターン数 (デフォルト: 4往復 = 8メッセージ)
  triggerTokenThreshold?: number;  // 圧縮を開始する閾値 (デフォルト: 1400トークン)
}

/**
 * コンテキスト圧縮 ＆ スライディングウィンドウ実行 (Context Compression Engine)
 * 設計思想 20. コンテキスト圧縮・スライディングウィンドウ
 */
export function compressContextHistory(
  messages: ChatMessage[],
  options: ContextCompressionOptions = {}
): CompressedContextResult {
  const recentTurnsToKeep = options.recentTurnsToKeep || 6;
  const triggerTokenThreshold = options.triggerTokenThreshold || 1200;

  // 全体トークン数推定
  const totalOriginalText = messages.map((m) => m.content).join('\n');
  const originalTokensEstimated = estimateTokens(totalOriginalText);

  // 閾値未満またはメッセージ数が少なければ圧縮不要
  if (messages.length <= recentTurnsToKeep || originalTokensEstimated < triggerTokenThreshold) {
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

  // スライディングウィンドウ分割: 古いメッセージ vs 直近メッセージ
  const splitIndex = messages.length - recentTurnsToKeep;
  const oldMessages = messages.slice(0, splitIndex);
  const recentMessages = messages.slice(splitIndex);

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
