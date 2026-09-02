import type { MemoryItem } from '../types';

/**
 * 記憶検索(RAG簡易版)
 *
 * これまでは `memories.filter(active).slice(0, 3)` で、記憶が増えるほど
 * 「先頭の3件」が固定的に選ばれ続け、今の発言と無関係な記憶が埋め込まれる一方、
 * 本当に関係ある記憶が呼び出されない問題があった。
 *
 * ここでは埋め込みモデルやサーバーを使わず、端末内だけで完結する軽量な
 * キーワード一致 + 重要度 + 最近性 + ピン留めのスコアリングで上位N件だけを選ぶ。
 */

const STOPWORDS = new Set([
  'です', 'ます', 'こと', 'それ', 'これ', 'あれ', 'よう', 'ため', 'から', 'まで',
  'って', 'けど', 'でも', 'だよ', 'だね', 'かな', 'ねえ', 'ちゃん', 'さん',
  'the', 'and', 'for', 'with', 'this', 'that', 'です', 'ですね',
]);

/**
 * 日本語は分かち書きされていないため、単純な単語分割に加えて
 * 2文字ずつの重なり合うN-gram(バイグラム)も抽出し、部分一致の取りこぼしを減らす。
 */
function extractTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  if (!text) return tokens;

  // 記号・空白で分割した「単語」トークン(英数字混じりの語に強い)
  const words = text
    .toLowerCase()
    .split(/[\s、。,.!?！？「」『』()（）\[\]【】\/\\・:：;；~〜\-]+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  words.forEach((w) => tokens.add(w));

  // 日本語向けの文字バイグラム(単語分割だけでは拾えない部分一致を補う)
  const cleaned = text.replace(/[\s、。,.!?！？「」『』()（）\[\]【】\/\\・:：;；~〜\-]+/g, '');
  for (let i = 0; i < cleaned.length - 1; i++) {
    const bigram = cleaned.slice(i, i + 2).toLowerCase();
    if (!STOPWORDS.has(bigram)) tokens.add(bigram);
  }

  return tokens;
}

export interface MemoryRetrievalOptions {
  limit?: number; // 最終的にプロンプトへ積む件数の上限
  alwaysIncludePinned?: boolean; // ピン留め記憶は関連度が低くても優先的に含めるか
}

/**
 * 現在のユーザー発言に関連する記憶を上位N件だけ選んで返す。
 * スコアが同点の場合は「新しいもの」「よく使われているもの」を優先する。
 */
export function retrieveRelevantMemories(
  currentUserMessage: string,
  memories: MemoryItem[],
  options: MemoryRetrievalOptions = {}
): MemoryItem[] {
  const { limit = 5, alwaysIncludePinned = true } = options;

  const activeMemories = (memories || []).filter((m) => m.active !== false);
  if (activeMemories.length === 0) return [];

  const queryTokens = extractTokens(currentUserMessage);

  const scored = activeMemories.map((memory) => {
    const memoryTokens = extractTokens(`${memory.content} ${(memory.tags || []).join(' ')}`);

    let keywordMatches = 0;
    queryTokens.forEach((t) => {
      if (memoryTokens.has(t)) keywordMatches++;
    });

    const importanceScore = (memory.importance ?? 1) * 1.5;
    const pinnedBonus = memory.pinned ? 8 : 0;
    const usageBonus = Math.min(memory.useCount ?? 0, 5) * 0.5;

    // 「良い・悪い評価」(ユーザーからのフィードバック)を検索スコアへ反映する。
    // 良い評価が多い記憶は積極的に再利用し、悪い評価が多い記憶は
    // (完全に除外はせず)優先度を下げることで、次第に呼ばれにくくする。
    const good = memory.goodCount ?? 0;
    const bad = memory.badCount ?? 0;
    const feedbackScore = Math.max(-6, Math.min(6, (good - bad) * 2));

    // 最近使われた/作られたものをわずかに優先(同点時のタイブレーク用)
    const recencyTimestamp = memory.lastUsedAt ?? memory.updatedAt ?? memory.createdAt ?? 0;
    const recencyScore = recencyTimestamp > 0 ? Math.min(recencyTimestamp / 1e13, 1) : 0;

    const score =
      keywordMatches * 3 + importanceScore + pinnedBonus + usageBonus + feedbackScore + recencyScore;

    return { memory, score, keywordMatches };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected: MemoryItem[] = [];
  const selectedIds = new Set<string>();

  // ピン留めされた記憶は、関連度に関わらず優先的に含める
  if (alwaysIncludePinned) {
    scored
      .filter((s) => s.memory.pinned)
      .forEach((s) => {
        if (selected.length < limit && !selectedIds.has(s.memory.id)) {
          selected.push(s.memory);
          selectedIds.add(s.memory.id);
        }
      });
  }

  // 残り枠を関連度スコア順に埋める
  for (const s of scored) {
    if (selected.length >= limit) break;
    if (selectedIds.has(s.memory.id)) continue;
    selected.push(s.memory);
    selectedIds.add(s.memory.id);
  }

  return selected;
}
