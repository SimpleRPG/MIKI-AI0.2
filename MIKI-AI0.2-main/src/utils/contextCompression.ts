/**
 * Context Compression & Sentence Truncation Utilities
 * 作業指示書 v5 優先度7: 会話履歴の送信トークン量削減とコンテキスト長動的予算配分
 */

export interface CompressionOptions {
  maxContextTokens?: number;
  recentTurnsToKeep?: number;
  triggerTokenThreshold?: number;
}

export interface ContextCompressionResult {
  isCompressed: boolean;
  originalTokensEstimated: number;
  compressedTokensEstimated: number;
  compressionRatio: number;
  formattedMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  episodeSummary?: string;
}

/**
 * 文単位でテキストを安全に切り詰める (句点・感嘆符・改行で文の途中切れを防止)
 */
export function truncateTextBySentence(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) {
    return text;
  }

  const rawSub = text.slice(0, maxChars);
  // 日本語の句点や改行、欧文のピリオド等を探索
  const sentenceEndPattern = /[。！？\n.!?]/g;
  let lastValidIndex = -1;
  let match: RegExpExecArray | null;

  while ((match = sentenceEndPattern.exec(rawSub)) !== null) {
    lastValidIndex = match.index;
  }

  // 適切な区切り位置が十分後半（40%以上）にあればそこで切り詰める
  if (lastValidIndex > Math.floor(maxChars * 0.4)) {
    return text.slice(0, lastValidIndex + 1);
  }

  return rawSub.trim() + '...';
}

/**
 * 会話履歴のコンテキストを動的予算に合わせて圧縮・整形する
 */
export function compressContextHistory(
  messages: Array<{ role?: string; content?: string; [key: string]: any }>,
  options: CompressionOptions = {}
): ContextCompressionResult {
  const maxTokens = options.maxContextTokens ?? 2000;
  const recentTurnsToKeep = options.recentTurnsToKeep ?? 4;
  const triggerThreshold = options.triggerTokenThreshold ?? 1500;

  const validMessages = (messages || []).filter(
    (m) => m && m.content && typeof m.content === 'string' && m.content.trim()
  );

  // 概算トークン推定 (日本語・混在テキスト: 1文字 ≈ 0.6〜0.7トークン)
  const estimateTokens = (text: string) => Math.ceil(text.length * 0.67);

  const totalOriginalChars = validMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  const originalTokensEstimated = estimateTokens(totalOriginalChars ? 'x'.repeat(totalOriginalChars) : '');

  const needsCompression = originalTokensEstimated > triggerThreshold || validMessages.length > recentTurnsToKeep;

  if (!needsCompression) {
    return {
      isCompressed: false,
      originalTokensEstimated,
      compressedTokensEstimated: originalTokensEstimated,
      compressionRatio: 1.0,
      formattedMessages: validMessages.map((m) => ({
        role: (m.role as 'user' | 'assistant' | 'system') || 'user',
        content: m.content || '',
      })),
    };
  }

  // 直近 recentTurnsToKeep 件を保持し、古いターンは要約または除外
  const recentMessages = validMessages.slice(-recentTurnsToKeep);
  const olderMessages = validMessages.slice(0, -recentTurnsToKeep);

  let episodeSummary = '';
  if (olderMessages.length > 0) {
    const summarySnippets = olderMessages
      .slice(-4)
      .map((m) => `${m.role === 'user' ? 'ユーザー' : 'みき'}: ${truncateTextBySentence(m.content || '', 60)}`)
      .join(' / ');
    episodeSummary = `[過去の会話要約: ${summarySnippets}]`;
  }

  const formattedMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

  for (let i = 0; i < recentMessages.length; i++) {
    const m = recentMessages[i];
    const distFromEnd = recentMessages.length - 1 - i;
    const maxLimit = distFromEnd < 2 ? 350 : 160;
    formattedMessages.push({
      role: (m.role as 'user' | 'assistant' | 'system') || 'user',
      content: truncateTextBySentence(m.content || '', maxLimit),
    });
  }

  const compressedChars = formattedMessages.reduce((sum, m) => sum + m.content.length, 0);
  const compressedTokensEstimated = estimateTokens('x'.repeat(compressedChars));

  return {
    isCompressed: true,
    originalTokensEstimated,
    compressedTokensEstimated,
    compressionRatio: originalTokensEstimated > 0 ? compressedTokensEstimated / originalTokensEstimated : 1.0,
    formattedMessages,
    episodeSummary: episodeSummary || undefined,
  };
}
