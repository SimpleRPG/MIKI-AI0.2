import type {
  MemoryItem,
  MemoryScope,
  LongTermMemoryType,
  MemoryLifecycleStatus,
  MemoryPipelineSearchResult,
  MemoryPipelineStepHit,
  ChatMessage,
  ConversationState,
} from '../types';
import { storageService } from './storageService';
import {
  calculateDomainVector,
  calculateCosineSimilarity,
  extractQueryTokens,
  type ScoredMemory,
} from '../utils/memoryRetrieval';

/**
 * 設計思想 8章 & 35章 第4段階: 長期記憶と検索パイプラインサービス
 *
 * 【第4段階 実装要件】:
 * 1. 長期記憶 (Long-term Memory: 継続的な好み、長期的な方針、確定した設計原則、一般ルール)
 * 2. 完全一致検索 (Exact Match)
 * 3. 全文検索 (Full Text Search: FTS5 / バイグラム)
 * 4. 関連原文の再取得 (Raw Excerpt Re-acquisition)
 *
 * 【8.2 記憶の状態】:
 * - ACTIVE: 有効
 * - SUPERSEDED: 置換済み (古い記憶の置換先IDと理由を保持し、再利用を防止)
 * - REJECTED: 却下
 * - EXPIRED: 期限切れ
 * - UNVERIFIED: 未検証 (推測情報・注意マーク付き)
 * - APPROVED: 承認済み (確定事実)
 *
 * 【8.3 検索方針の7段階パイプライン】:
 * 1. 現在の会話状態 (ConversationState との照合・無効化前提の除外)
 * 2. 直近の原文 (直近数往復の会話からの文脈ブースト)
 * 3. 完全一致検索 (Exact match / 固有名詞・完全一致フレーズ)
 * 4. 全文検索 (FTS5 / トークン網羅性検索)
 * 5. 意味検索 (8次元ドメイン概念ベクトル類似度)
 * 6. 再順位付け (状態・承認・フィードバック・時間減衰・無関係記憶の厳格除外)
 * 7. 原文再取得 (根拠原文抜粋の再取得と出所担保)
 */
class LongTermMemoryService {
  /**
   * 記憶アイテムのライフサイクル状態 (8.2) を正規化
   */
  public getLifecycleStatus(item: MemoryItem): MemoryLifecycleStatus {
    if (item.lifecycleStatus) return item.lifecycleStatus;
    if (item.replacedBy || (item.status === 'deprecated' && item.conflictWith?.length)) {
      return 'SUPERSEDED';
    }
    if (item.destination === 'discard_candidate' || item.status === 'archived') {
      return 'REJECTED';
    }
    if (item.expiresAt && item.expiresAt < Date.now()) {
      return 'EXPIRED';
    }
    if (item.approved === true) {
      return 'APPROVED';
    }
    if (item.approved === false) {
      return 'UNVERIFIED';
    }
    return item.active === false ? 'REJECTED' : 'ACTIVE';
  }

  /**
   * 記憶の種類 (8.1 記憶の種類) を判定
   */
  public classifyMemoryScope(item: MemoryItem): MemoryScope {
    if (item.memoryScope) return item.memoryScope;
    if (item.memoryType === 'working') return 'short_term';
    if (item.memoryType === 'raw') return 'raw_archive';

    // 長期記憶の判定: preference, policy, design_principle, general_rule または pinned/重要度高
    if (
      item.longTermType ||
      item.category === 'preference' ||
      item.category === 'profile' ||
      item.pinned ||
      (item.importance && item.importance >= 4)
    ) {
      return 'long_term';
    }

    if (item.category === 'chat' || item.memoryType === 'episodic') {
      return 'mid_term';
    }

    return 'long_term';
  }

  /**
   * 長期記憶の4大分類 (8.1) をテキストから自動判定
   */
  public detectLongTermCategory(content: string, category?: string): LongTermMemoryType {
    const text = content.toLowerCase();

    // 確定した設計原則 (design_principle)
    if (
      text.includes('原則') ||
      text.includes('アーキテクチャ') ||
      text.includes('設計') ||
      text.includes('規約') ||
      text.includes('シングルスレッド') ||
      text.includes('型安全') ||
      text.includes('禁止事項')
    ) {
      return 'design_principle';
    }

    // 長期的な方針 (policy)
    if (
      text.includes('方針') ||
      text.includes('運用') ||
      text.includes('目標') ||
      text.includes('基準') ||
      text.includes('常に') ||
      text.includes('戦略') ||
      text.includes('ロードマップ')
    ) {
      return 'policy';
    }

    // 継続的な好み (preference)
    if (
      category === 'preference' ||
      category === 'profile' ||
      text.includes('好き') ||
      text.includes('嫌い') ||
      text.includes('好み') ||
      text.includes('タメ口') ||
      text.includes('呼んで') ||
      text.includes('テーマ') ||
      text.includes('フォント')
    ) {
      return 'preference';
    }

    // 繰り返し利用する一般ルール (general_rule)
    return 'general_rule';
  }

  /**
   * 設計思想 8.2: 古い記憶の置換処理 (置換関係の永続保存)
   * 訂正された古い記憶は削除せず、SUPERSEDED 状態に変更して置換理由と置換先IDを記録する。
   */
  public supersedeMemory(
    memories: MemoryItem[],
    oldMemoryId: string,
    newContent: string,
    reason: string,
    customProps?: Partial<MemoryItem>
  ): { updatedMemories: MemoryItem[]; newMemory: MemoryItem } {
    const now = Date.now();
    const newMemoryId = `mem_long_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const oldMemory = memories.find((m) => m.id === oldMemoryId);

    const longTermType =
      customProps?.longTermType ||
      this.detectLongTermCategory(newContent, customProps?.category || oldMemory?.category);

    const newMemory: MemoryItem = {
      id: newMemoryId,
      category: customProps?.category || oldMemory?.category || 'preference',
      content: newContent,
      importance: customProps?.importance ?? oldMemory?.importance ?? 4,
      pinned: customProps?.pinned ?? oldMemory?.pinned ?? false,
      active: true,
      approved: true,
      lifecycleStatus: 'ACTIVE',
      memoryScope: 'long_term',
      longTermType,
      supersededFrom: oldMemoryId,
      sourceRef: customProps?.sourceRef || `superseded_from_${oldMemoryId}`,
      rawExcerpt: customProps?.rawExcerpt || newContent,
      domainVector: calculateDomainVector(newContent),
      semanticKeywords: Array.from(extractQueryTokens(newContent)).slice(0, 10),
      createdAt: now,
      updatedAt: now,
      useCount: 0,
    };

    const updatedMemories = memories.map((m) => {
      if (m.id === oldMemoryId) {
        return {
          ...m,
          active: false,
          lifecycleStatus: 'SUPERSEDED' as const,
          replacedBy: newMemoryId,
          replacementReason: reason,
          supersededAt: now,
          updatedAt: now,
        };
      }
      return m;
    });

    return {
      updatedMemories: [newMemory, ...updatedMemories],
      newMemory,
    };
  }

  /**
   * 設計思想 8.3: 検索方針に基づく7段階完全検索パイプライン
   */
  public async searchPipeline(
    query: string,
    allMemories: MemoryItem[],
    conversationState?: ConversationState | null,
    recentMessages: ChatMessage[] = [],
    options: {
      limit?: number;
      onlyApprovedForFacts?: boolean;
      minScoreThreshold?: number;
    } = {}
  ): Promise<MemoryPipelineSearchResult> {
    const limit = options.limit ?? 5;
    const minScore = options.minScoreThreshold ?? 6.0;
    const steps: MemoryPipelineStepHit[] = [];

    // Step 1: 現在の会話状態 (ConversationState) との照合
    const stateMatchedIds = new Set<string>();
    const invalidatedTerms: string[] = [];

    if (conversationState) {
      if (conversationState.invalidatedAssumptions?.length) {
        invalidatedTerms.push(...conversationState.invalidatedAssumptions);
      }

      const stateKeywords = [
        conversationState.currentTopic,
        conversationState.topLevelGoal,
        ...(conversationState.confirmedFacts || []),
        ...(conversationState.pendingQuestions || []),
      ]
        .filter(Boolean)
        .join(' ');

      const stateTokens = extractQueryTokens(stateKeywords);
      if (stateTokens.size > 0) {
        for (const m of allMemories) {
          if (!m.content) continue;
          let matchCount = 0;
          for (const tok of stateTokens) {
            if (m.content.includes(tok)) matchCount++;
          }
          if (matchCount >= 2 || (matchCount >= 1 && m.importance && m.importance >= 4)) {
            stateMatchedIds.add(m.id);
          }
        }
      }
    }

    steps.push({
      step: 1,
      name: '現在の会話状態 (ConversationState)',
      count: stateMatchedIds.size,
      description: `話題・目的・確定事項との照合 (${invalidatedTerms.length}件の無効化前提を排除対象に指定)`,
      sampleIds: Array.from(stateMatchedIds).slice(0, 3),
    });

    // Step 2: 直近の原文 (直近数往復の文脈照合)
    const recentMatchedIds = new Set<string>();
    const recentText = recentMessages
      .slice(-4)
      .map((m) => m.content)
      .join(' ');
    const recentTokens = extractQueryTokens(recentText);

    if (recentTokens.size > 0) {
      for (const m of allMemories) {
        if (!m.content) continue;
        let tokenHits = 0;
        for (const tok of recentTokens) {
          if (m.content.includes(tok)) tokenHits++;
        }
        if (tokenHits >= 2) {
          recentMatchedIds.add(m.id);
        }
      }
    }

    steps.push({
      step: 2,
      name: '直近の原文 (Recent Raw Context)',
      count: recentMatchedIds.size,
      description: '直近4往復の会話ログからの継続文脈ブースト',
      sampleIds: Array.from(recentMatchedIds).slice(0, 3),
    });

    // Step 3: 完全一致検索 (Exact Match)
    const exactMatchedIds = new Set<string>();
    const queryLower = query.toLowerCase().trim();
    const queryTokens = Array.from(extractQueryTokens(query));

    // クエリ中の長さ3以上のフレーズまたはトークンで完全一致を探索
    for (const m of allMemories) {
      if (!m.content) continue;
      const contentLower = m.content.toLowerCase();

      // 1. 完全部分文字列一致 (例: "タメ口", "Canvas", "Qwen 2.5")
      for (const tok of queryTokens) {
        if (tok.length >= 2 && contentLower.includes(tok.toLowerCase())) {
          exactMatchedIds.add(m.id);
          break;
        }
      }

      // 2. タグやキーワードの完全一致
      if (m.tags?.some((t) => queryLower.includes(t.toLowerCase()))) {
        exactMatchedIds.add(m.id);
      }
      if (m.semanticKeywords?.some((k) => queryLower.includes(k.toLowerCase()))) {
        exactMatchedIds.add(m.id);
      }
    }

    steps.push({
      step: 3,
      name: '完全一致検索 (Exact Match)',
      count: exactMatchedIds.size,
      description: 'キーワード・タグ・固有名詞の完全一致検出',
      sampleIds: Array.from(exactMatchedIds).slice(0, 3),
    });

    // Step 4: 全文検索 (Full Text Search: SQLite FTS5 または JS N-gram)
    const ftsMatchedIds = new Set<string>();
    if (storageService.supportsFTS()) {
      const ftsResults = await storageService.searchMemoriesFTS(query, 50);
      if (ftsResults) {
        ftsResults.forEach((id) => ftsMatchedIds.add(id));
      }
    }

    // FTSが未サポートまたはフォールバック時のJSバイグラム全文走査
    if (ftsMatchedIds.size === 0) {
      for (const m of allMemories) {
        if (!m.content) continue;
        const tokens = extractQueryTokens(m.content);
        let overlap = 0;
        for (const qTok of queryTokens) {
          if (tokens.has(qTok)) overlap++;
        }
        if (overlap >= 1) {
          ftsMatchedIds.add(m.id);
        }
      }
    }

    steps.push({
      step: 4,
      name: '全文検索 (Full Text Search)',
      count: ftsMatchedIds.size,
      description: storageService.supportsFTS() ? 'SQLite FTS5 転置インデックス検索' : '高速JS形態素バイグラム全文検索',
      sampleIds: Array.from(ftsMatchedIds).slice(0, 3),
    });

    // Step 5: 意味検索 (Semantic Domain Search)
    const queryVector = calculateDomainVector(query);
    const semanticScores = new Map<string, number>();

    for (const m of allMemories) {
      const memVector = m.domainVector || calculateDomainVector(m.content || '');
      const sim = calculateCosineSimilarity(queryVector, memVector);
      if (sim > 0.15) {
        semanticScores.set(m.id, sim);
      }
    }

    steps.push({
      step: 5,
      name: '意味検索 (Semantic Search)',
      count: semanticScores.size,
      description: '8次元ドメイン概念疎ベクトル + コサイン類似度',
      sampleIds: Array.from(semanticScores.keys()).slice(0, 3),
    });

    // Step 6: 再順位付け (Rerank & Filtering: 状態・有効性・置換・出所確認)
    let filteredOutCount = 0;
    const scoredList: Array<{ memory: MemoryItem; score: number; matchStage: string }> = [];

    const now = Date.now();
    for (const memory of allMemories) {
      const status = this.getLifecycleStatus(memory);

      // 【除外ルール 1】置換済み (SUPERSEDED) 記憶は無効な古い前提のため完全除外
      if (status === 'SUPERSEDED' || memory.replacedBy) {
        filteredOutCount++;
        continue;
      }

      // 【除外ルール 2】却下 (REJECTED) または 期限切れ (EXPIRED) または 非アクティブ
      if (status === 'REJECTED' || status === 'EXPIRED' || memory.active === false) {
        filteredOutCount++;
        continue;
      }

      // 【除外ルール 3】49章 隔離記憶
      if (memory.destination === 'quarantine' || memory.destination === 'discard_candidate') {
        filteredOutCount++;
        continue;
      }

      // 【除外ルール 4】無効化された前提 (invalidatedAssumptions) と合致する記憶
      if (
        invalidatedTerms.some(
          (inv) => inv && (memory.content.includes(inv) || inv.includes(memory.content))
        )
      ) {
        filteredOutCount++;
        continue;
      }

      // 【除外ルール 5】設計思想 25: 事実性カテゴリで未承認 (UNVERIFIED) のものは厳格モードで除外
      if (
        options.onlyApprovedForFacts &&
        (memory.category === 'profile' || memory.category === 'preference') &&
        status === 'UNVERIFIED'
      ) {
        filteredOutCount++;
        continue;
      }

      // スコア計算
      let score = 0;
      let primaryStage = 'semantic';

      // 1. 完全一致 (最優先 +25点)
      if (exactMatchedIds.has(memory.id)) {
        score += 25;
        primaryStage = 'exact_match';
      }

      // 2. 会話状態マッチ (+15点)
      if (stateMatchedIds.has(memory.id)) {
        score += 15;
        if (primaryStage !== 'exact_match') primaryStage = 'conversation_state';
      }

      // 3. 直近原文マッチ (+8点)
      if (recentMatchedIds.has(memory.id)) {
        score += 8;
        if (primaryStage === 'semantic') primaryStage = 'recent_raw';
      }

      // 4. 全文検索マッチ (+12点)
      if (ftsMatchedIds.has(memory.id)) {
        score += 12;
        if (primaryStage === 'semantic') primaryStage = 'full_text';
      }

      // 5. 意味的類似度スコア (最大 +15点)
      const semSim = semanticScores.get(memory.id) || 0;
      score += semSim * 15;

      // メタデータボーナス
      if (memory.pinned) score += 20; // ピン留めは最優先
      if (status === 'APPROVED') score += 5; // 確定承認済み
      score += (memory.importance || 1) * 2; // 重要度 (1-5)
      score += (memory.goodCount || 0) * 1.5; // 👍 フィードバック
      score -= (memory.badCount || 0) * 3.0; // 👎 フィードバック

      // 時間減衰 (直近使われた記憶ほど優先)
      if (memory.lastUsedAt) {
        const daysAgo = (now - memory.lastUsedAt) / (1000 * 60 * 60 * 24);
        if (daysAgo < 1) score += 3;
        else if (daysAgo < 7) score += 1.5;
      }

      // 長期記憶の種別ブースト
      if (memory.memoryScope === 'long_term' && (memory.longTermType === 'design_principle' || memory.longTermType === 'policy')) {
        score += 2;
      }

      // 閾値チェック: 無関係な記憶は混ぜない (設計思想 5章 14番)
      if (score >= minScore || memory.pinned) {
        scoredList.push({
          memory,
          score: Math.round(score * 10) / 10,
          matchStage: memory.pinned ? 'pinned' : primaryStage,
        });
      } else {
        filteredOutCount++;
      }
    }

    // スコア降順ソート
    scoredList.sort((a, b) => b.score - a.score);
    const topScored = scoredList.slice(0, limit);

    steps.push({
      step: 6,
      name: '再順位付け & 厳格フィルタリング (Rerank & Filtering)',
      count: topScored.length,
      description: `置換済み・期限切れ・低関連性(${filteredOutCount}件)を除外し、上位${topScored.length}件を厳選`,
      sampleIds: topScored.map((s) => s.memory.id),
    });

    // Step 7: 原文再取得 (Raw Excerpt Re-acquisition)
    const retrievedRawExcerpts = topScored.map((sm) => {
      const mem = sm.memory;
      const status = this.getLifecycleStatus(mem);
      const excerpt =
        mem.rawExcerpt ||
        mem.content.slice(0, 160) ||
        (mem.sourceRef ? `[出典: ${mem.sourceRef}]` : '[原文記録あり]');

      return {
        memoryId: mem.id,
        sourceRef: mem.sourceRef || 'conversation_log',
        rawExcerpt: excerpt,
        lifecycleStatus: status,
      };
    });

    steps.push({
      step: 7,
      name: '関連原文の再取得 (Raw Excerpt Re-acquisition)',
      count: retrievedRawExcerpts.length,
      description: '採用された記憶の根拠原文抜粋および出所情報の検証・紐付け',
      sampleIds: retrievedRawExcerpts.map((r) => r.memoryId),
    });

    return {
      scoredMemories: topScored,
      filteredOutCount,
      steps,
      retrievedRawExcerpts,
    };
  }

  /**
   * プロンプト用に、7段階パイプラインで厳選された記憶をフォーマット
   */
  public formatMemoriesForPrompt(searchResult: MemoryPipelineSearchResult): string {
    if (searchResult.scoredMemories.length === 0) return '';

    const lines: string[] = ['【参照された記憶・ユーザー情報 (7段階RAG・原文根拠担保)】:'];

    for (const sm of searchResult.scoredMemories) {
      const mem = sm.memory;
      const status = this.getLifecycleStatus(mem);
      const excerptInfo = searchResult.retrievedRawExcerpts.find((r) => r.memoryId === mem.id);

      let prefix = '・';
      if (status === 'UNVERIFIED') {
        prefix = '・[※未検証・仮推論情報（断定せず推測として扱うこと）]: ';
      } else if (mem.longTermType === 'design_principle') {
        prefix = '・[確定設計原則]: ';
      } else if (mem.longTermType === 'policy') {
        prefix = '・[長期方針]: ';
      }

      let line = `${prefix}${mem.content}`;
      if (excerptInfo?.sourceRef && excerptInfo.sourceRef !== 'user_chat') {
        line += ` (根拠: ${excerptInfo.sourceRef})`;
      }
      lines.push(line);
    }

    return lines.join('\n');
  }
}

export const longTermMemoryService = new LongTermMemoryService();
