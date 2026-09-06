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
import { nativeLlmService } from './nativeLlmService';
import {
  calculateDomainVector,
  calculateCosineSimilarity,
  extractQueryTokens,
  type ScoredMemory,
} from '../utils/memoryRetrieval';

/**
 * 任意の次元数のベクトル間のコサイン類似度を算出 (提案A)
 */
function calculateVectorCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA <= 0 || normB <= 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

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
  // 設計思想 Master v5.0 第3章4節: ユーザー明示的削除の2段階反映用ランタイムブラックリスト
  private runtimeBlacklistMemoryIds = new Set<string>();

  /**
   * 即時ランタイム注入禁止ブラックリストに記憶IDを追加 (第3章4節 第1段階)
   */
  public addToRuntimeBlacklist(memoryId: string): void {
    this.runtimeBlacklistMemoryIds.add(memoryId);
  }

  /**
   * ランタイムブラックリストから除外
   */
  public removeFromRuntimeBlacklist(memoryId: string): void {
    this.runtimeBlacklistMemoryIds.delete(memoryId);
  }

  /**
   * ランタイムブラックリストに含まれているか判定
   */
  public isBlacklisted(memoryId: string): boolean {
    return this.runtimeBlacklistMemoryIds.has(memoryId);
  }

  /**
   * ランタイムブラックリストの全クリア
   */
  public clearRuntimeBlacklist(): void {
    this.runtimeBlacklistMemoryIds.clear();
  }

  /**
   * 置換先を辿って最新の有効記憶を解決する (第3章2節: 最新版自動差替え)
   */
  public resolveLatestSupersededMemory(
    oldMemory: MemoryItem,
    allMemoriesMap: Map<string, MemoryItem>
  ): MemoryItem | null {
    let current: MemoryItem | undefined = oldMemory;
    const visited = new Set<string>([oldMemory.id]);

    while (current?.replacedBy && allMemoriesMap.has(current.replacedBy)) {
      if (visited.has(current.replacedBy)) break; // 循環参照防止
      visited.add(current.replacedBy);
      current = allMemoriesMap.get(current.replacedBy);
    }

    if (current && current.id !== oldMemory.id && current.active !== false) {
      return current;
    }
    return null;
  }

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
   * 設計思想 Master v5.4 第19.3項:
   * 記憶の揮発性 (volatility) を推定・付与
   * - high: 価格・月額・役職・組織・バージョン番号・時事等 (時間経過で陳腐化しやすい)
   * - low: 恒久的ルール・普遍的構文・個人の長期的嗜好等
   */
  public detectVolatility(content: string, category?: string): 'high' | 'low' {
    const text = (content || '').toLowerCase();

    // 時事性・変動可能性が高いキーワード
    const highVolatilityPatterns = [
      /\d+(?:円|ドル|ユーロ|\$|¥)/,
      /(?:価格|料金|月額|年額|費用|コスト|定価|割引|キャンペーン|セール)/,
      /(?:代表取締役|社長|ceo|役員|担当者|人事|配属|就任|組織図)/,
      /(?:v\d+\.|\d+\.\d+\.\d+|バージョン|最新版|新機能|リリースノート|アップデート)/i,
      /(?:202[3-9]年|\d+月\d+日|今年|来年|締切|期限|予定日|スケジュール|時事|速報|ニュース)/,
    ];

    for (const pattern of highVolatilityPatterns) {
      if (pattern.test(text)) {
        return 'high';
      }
    }

    // 恒久的なカテゴリや普遍ルールは low
    if (
      category === 'preference' ||
      category === 'profile' ||
      text.includes('原則') ||
      text.includes('定石')
    ) {
      return 'low';
    }

    return 'low';
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

    // 提案A: 外部ローカルLLM / llama-serverから実埋め込みベクトルを非同期取得して保存
    nativeLlmService
      .getEmbedding(newContent, undefined, 2500)
      .then((emb) => {
        if (emb) {
          newMemory.embeddingVector = emb.embedding;
          newMemory.embeddingModelId = emb.modelId;
          newMemory.embeddingDimensions = emb.dimensions;
        }
      })
      .catch(() => {});

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

    // Step 5: 意味検索 (Semantic Search: llama-server 実埋め込みベクトル + 8次元ドメインフォールバック)
    // 【設計思想 8章 & 指示書 SECTION 7 提案A】
    const semanticScores = new Map<string, number>();
    let usedRealEmbedding = false;
    let embeddingDimensions = 0;

    // 1. llama-server / Ollama からの実埋め込み取得を試行 (タイムアウト1500msで高速安全判定)
    let queryEmbeddingResult: { embedding: number[]; modelId: string; dimensions: number } | null = null;
    try {
      queryEmbeddingResult = await nativeLlmService.getEmbedding(query, undefined, 1500);
    } catch (e) {
      queryEmbeddingResult = null;
    }

    const fallbackQueryVector = calculateDomainVector(query);

    if (queryEmbeddingResult && Array.isArray(queryEmbeddingResult.embedding) && queryEmbeddingResult.embedding.length > 0) {
      usedRealEmbedding = true;
      embeddingDimensions = queryEmbeddingResult.dimensions;
      const qVec = queryEmbeddingResult.embedding;
      const targetModelId = queryEmbeddingResult.modelId;

      for (const m of allMemories) {
        // モデルIDおよび次元数が一致する実埋め込みが存在する場合は高精度コサイン類似度
        if (
          m.embeddingVector &&
          m.embeddingVector.length === qVec.length &&
          (!m.embeddingModelId || m.embeddingModelId === targetModelId)
        ) {
          const sim = calculateVectorCosineSimilarity(qVec, m.embeddingVector);
          if (sim > 0.25) {
            semanticScores.set(m.id, sim);
          }
        } else {
          // 実埋め込み未計算またはモデル相違時のフォールバック (8次元ドメイン疎ベクトル)
          const memVector = m.domainVector || calculateDomainVector(m.content || '');
          const sim = calculateCosineSimilarity(fallbackQueryVector, memVector);
          if (sim > 0.15) {
            semanticScores.set(m.id, sim);
          }
        }
      }
    } else {
      // llama-server未起動または埋め込み未対応時の安全なフォールバック (SECTION 5 フォールバック原則)
      for (const m of allMemories) {
        const memVector = m.domainVector || calculateDomainVector(m.content || '');
        const sim = calculateCosineSimilarity(fallbackQueryVector, memVector);
        if (sim > 0.15) {
          semanticScores.set(m.id, sim);
        }
      }
    }

    steps.push({
      step: 5,
      name: '意味検索 (Semantic Search)',
      count: semanticScores.size,
      description: usedRealEmbedding
        ? `llama-server実埋め込みベクトル (${embeddingDimensions}次元) + コサイン類似度 (一部8次元フォールバック)`
        : '8次元ドメイン概念疎ベクトル + コサイン類似度 (実埋め込み未検出時フォールバック)',
      sampleIds: Array.from(semanticScores.keys()).slice(0, 3),
    });

    // Step 5.5: 関連記憶グラフリンク展開 (Semantic Link Expansion / GraphRAG 1ホップ展開: 第15章6節)
    const graphLinkedIds = new Set<string>();
    const seedMemoryIds = new Set<string>([
      ...Array.from(exactMatchedIds),
      ...Array.from(stateMatchedIds),
      ...Array.from(recentMatchedIds),
      ...Array.from(ftsMatchedIds),
      ...Array.from(semanticScores.keys()),
    ]);

    for (const sId of seedMemoryIds) {
      const seedMem = allMemories.find((m) => m.id === sId);
      if (seedMem?.relatedMemoryIds && Array.isArray(seedMem.relatedMemoryIds)) {
        for (const relId of seedMem.relatedMemoryIds) {
          if (!seedMemoryIds.has(relId) && !this.isBlacklisted(relId)) {
            graphLinkedIds.add(relId);
          }
        }
      }
    }

    steps.push({
      step: 6,
      name: 'グラフリンク展開 (GraphRAG 1-Hop Expansion)',
      count: graphLinkedIds.size,
      description: 'シード想起記憶の関連ノード(relatedMemoryIds)を1ホップ自動展開して連鎖想起',
      sampleIds: Array.from(graphLinkedIds).slice(0, 3),
    });

    // Step 7: 再順位付け (Rerank & Filtering: 状態・有効性・置換・出所確認)
    let filteredOutCount = 0;
    let supersededReplacedCount = 0;
    const scoredList: Array<{ memory: MemoryItem; score: number; matchStage: string; contradictionWarning?: string }> = [];

    // 高速アクセスマップ
    const allMemoriesMap = new Map<string, MemoryItem>();
    allMemories.forEach((m) => allMemoriesMap.set(m.id, m));

    const now = Date.now();
    for (const rawMemory of allMemories) {
      let memory = rawMemory;
      let status = this.getLifecycleStatus(memory);

      // 【除外ルール 0】第3章4節: ユーザー明示的削除のランタイムブラックリスト
      if (this.isBlacklisted(memory.id)) {
        filteredOutCount++;
        continue;
      }

      // 【除外ルール 1 ＆ 最新版自動差替え】置換済み (SUPERSEDED) 記憶の最新版解決 (第3章2節)
      if (status === 'SUPERSEDED' || memory.replacedBy) {
        const latestResolved = this.resolveLatestSupersededMemory(memory, allMemoriesMap);
        if (latestResolved && !this.isBlacklisted(latestResolved.id)) {
          // 古い記憶へのヒットを最新記憶に自動差替え
          memory = latestResolved;
          status = this.getLifecycleStatus(memory);
          supersededReplacedCount++;
        } else {
          filteredOutCount++;
          continue;
        }
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

      // 重複登録防止 (置換差替え等で同一メモリが既に登録されている場合)
      if (scoredList.some((item) => item.memory.id === memory.id)) {
        continue;
      }

      // スコア計算
      let score = 0;
      let primaryStage = 'semantic';

      // 1. 完全一致 (最優先 +25点)
      if (exactMatchedIds.has(memory.id) || exactMatchedIds.has(rawMemory.id)) {
        score += 25;
        primaryStage = 'exact_match';
      }

      // 2. 会話状態マッチ (+15点)
      if (stateMatchedIds.has(memory.id) || stateMatchedIds.has(rawMemory.id)) {
        score += 15;
        if (primaryStage !== 'exact_match') primaryStage = 'conversation_state';
      }

      // 3. 直近原文マッチ (+8点)
      if (recentMatchedIds.has(memory.id) || recentMatchedIds.has(rawMemory.id)) {
        score += 8;
        if (primaryStage === 'semantic') primaryStage = 'recent_raw';
      }

      // 4. 全文検索マッチ (+12点)
      if (ftsMatchedIds.has(memory.id) || ftsMatchedIds.has(rawMemory.id)) {
        score += 12;
        if (primaryStage === 'semantic') primaryStage = 'full_text';
      }

      // 5. 意味的類似度スコア (最大 +15点)
      const semSim = Math.max(semanticScores.get(memory.id) || 0, semanticScores.get(rawMemory.id) || 0);
      score += semSim * 15;

      // 6. グラフリンク展開マッチ (+10点: 1ホップ連鎖想起 - 第15章6節)
      if (graphLinkedIds.has(memory.id) || graphLinkedIds.has(rawMemory.id)) {
        score += 10;
        if (primaryStage === 'semantic') primaryStage = 'graph_link_expansion';
      }

      // メタデータボーナス
      if (memory.pinned) score += 20; // ピン留めは最優先
      if (status === 'APPROVED') score += 5; // 確定承認済み
      score += (memory.importance || 1) * 2; // 重要度 (1-5)

      // 設計思想 Master v5.0 第2章2節: 感情価 (質: useful_count / confusion_count) と熱量 (heat)
      const useful = (memory.useful_count ?? memory.goodCount) || 0;
      const confusion = (memory.confusion_count ?? memory.badCount) || 0;
      score += useful * 1.5; // 役立った回数ボーナス
      score -= confusion * 3.0; // 混乱・訂正回数ペナルティ

      // 熱量 (今いちばん熱い体験を優遇、0.0〜1.0)
      if (typeof memory.heat === 'number') {
        score += memory.heat * 4.0;
      }

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

    // 設計思想 Master v5.0 第3章2節: 矛盾ペア・置換競合の注記付与と枠数譲歩
    let contradictionPairsFlagged = 0;
    for (let i = 0; i < scoredList.length; i++) {
      const itemA = scoredList[i];
      for (let j = i + 1; j < scoredList.length; j++) {
        const itemB = scoredList[j];
        const isConflict =
          (itemA.memory.conflictWith && itemA.memory.conflictWith.includes(itemB.memory.id)) ||
          (itemB.memory.conflictWith && itemB.memory.conflictWith.includes(itemA.memory.id)) ||
          itemA.memory.supersededFrom === itemB.memory.id ||
          itemB.memory.supersededFrom === itemA.memory.id;

        if (isConflict) {
          contradictionPairsFlagged++;
          itemA.contradictionWarning = `※前提が更新されている可能性があります (最新版を優先)`;
          itemB.contradictionWarning = `※旧前提または競合設定の可能性があります`;
        }
      }
    }

    // 矛盾ペアが存在する場合、予算枠として1.5〜2枠相当を消費するため実効リミットを自動調整 (第3章2節)
    const effectiveLimit = contradictionPairsFlagged > 0 ? Math.max(2, limit - Math.min(2, contradictionPairsFlagged)) : limit;
    const topScored = scoredList.slice(0, effectiveLimit);

    steps.push({
      step: 7,
      name: '再順位付け & 厳格フィルタリング (Rerank & Filtering)',
      count: topScored.length,
      description: `置換最新版差替え(${supersededReplacedCount}件)、除外(${filteredOutCount}件)、競合注記(${contradictionPairsFlagged}件)、上位${topScored.length}件を厳選`,
      sampleIds: topScored.map((s) => s.memory.id),
    });

    // Step 8: 原文再取得 (Raw Excerpt Re-acquisition)
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
   * プロンプト用に、7段階パイプラインで厳選された記憶をフォーマット (第3章2節 矛盾注記対応)
   */
  public formatMemoriesForPrompt(searchResult: MemoryPipelineSearchResult): string {
    if (searchResult.scoredMemories.length === 0) return '';

    const lines: string[] = ['【参照された記憶・ユーザー情報 (7段階RAG・原文根拠担保)】:'];

    for (const sm of searchResult.scoredMemories) {
      const mem = sm.memory;
      const status = this.getLifecycleStatus(mem);
      const excerptInfo = searchResult.retrievedRawExcerpts.find((r) => r.memoryId === mem.id);

      let prefix = '・';
      if ((sm as any).contradictionWarning) {
        prefix = `・[⚠️${(sm as any).contradictionWarning}]: `;
      } else if (status === 'UNVERIFIED') {
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

  /**
   * 設計思想 Master v5.0 第2章2節: 感情価 (質) と熱量の更新
   * ターン終了後、想起した記憶についてユーザー訂正の有無をシグナルとして蓄積
   */
  public recordTurnFeedback(
    memories: MemoryItem[],
    usedMemoryIds: string[],
    wasCorrectionReceived: boolean
  ): MemoryItem[] {
    if (!usedMemoryIds || usedMemoryIds.length === 0) return memories;
    const targetSet = new Set(usedMemoryIds);
    const now = Date.now();

    return memories.map((mem) => {
      if (!targetSet.has(mem.id)) return mem;

      const currentUseful = (mem.useful_count ?? mem.goodCount) || 0;
      const currentConfusion = (mem.confusion_count ?? mem.badCount) || 0;
      const currentHeat = typeof mem.heat === 'number' ? mem.heat : 0.5;

      if (wasCorrectionReceived) {
        // ユーザーから訂正・矛盾指摘があった場合: 混乱回数を加算し熱量を冷却
        return {
          ...mem,
          confusion_count: currentConfusion + 1,
          badCount: currentConfusion + 1,
          heat: Math.max(0.1, Number((currentHeat * 0.7).toFixed(2))),
          lastUsedAt: now,
          updatedAt: now,
        };
      } else {
        // 訂正なく自然に受け入れられた場合: 有用回数を加算し熱量を適度に活性化 (実際に使われた分のみ)
        return {
          ...mem,
          useful_count: currentUseful + 1,
          goodCount: currentUseful + 1,
          heat: Math.min(1.0, Number((currentHeat + 0.15).toFixed(2))),
          useCount: (mem.useCount || 0) + 1,
          lastUsedAt: now,
          updatedAt: now,
        };
      }
    });
  }

  /**
   * 設計思想 8章: 浅い睡眠における長期記憶の自律監査とライフサイクル整理
   * 期限切れの検出、未検証記憶の分類、置換済み記憶の重複排除を実行
   */
  public auditAndConsolidateMemories(memories: MemoryItem[]): {
    updatedMemories: MemoryItem[];
    supersededCount: number;
    expiredCount: number;
    unverifiedCount: number;
    longTermCount: number;
  } {
    const now = Date.now();
    let supersededCount = 0;
    let expiredCount = 0;
    let unverifiedCount = 0;
    let longTermCount = 0;

    const updatedMemories = memories.map((mem) => {
      const currentStatus = this.getLifecycleStatus(mem);
      const scope = this.classifyMemoryScope(mem);
      let newStatus = currentStatus;

      if (scope === 'long_term') {
        longTermCount++;
      }

      // 期限切れチェック
      if (mem.expiresAt && mem.expiresAt < now && currentStatus !== 'EXPIRED') {
        newStatus = 'EXPIRED';
        expiredCount++;
      } else if (currentStatus === 'SUPERSEDED') {
        supersededCount++;
      } else if (currentStatus === 'UNVERIFIED') {
        unverifiedCount++;
      }

      const longTermType =
        mem.longTermType ||
        (scope === 'long_term' ? this.detectLongTermCategory(mem.content, mem.category) : undefined);

      return {
        ...mem,
        lifecycleStatus: newStatus,
        memoryScope: scope,
        longTermType,
      };
    });

    return {
      updatedMemories,
      supersededCount,
      expiredCount,
      unverifiedCount,
      longTermCount,
    };
  }

  /**
   * 8章 / 12章 置換関係の追跡 (Tracking of substitution relationships)
   * 指定した記憶アイテムに関連する置換履歴チェーン（旧記憶から新記憶への系譜）を追跡取得
   */
  public getSubstitutionChain(
    memories: MemoryItem[],
    startMemoryId: string
  ): {
    chain: MemoryItem[];
    rootId: string;
    latestId: string;
    hasSuperseded: boolean;
  } {
    const memMap = new Map<string, MemoryItem>();
    memories.forEach((m) => memMap.set(m.id, m));

    const current = memMap.get(startMemoryId);
    if (!current) {
      return { chain: [], rootId: startMemoryId, latestId: startMemoryId, hasSuperseded: false };
    }

    // 1. 祖先（過去の古い記憶）を遡る
    const ancestors: MemoryItem[] = [];
    let currAncestorId = current.supersededFrom;
    const visitedAncestors = new Set<string>([startMemoryId]);
    while (currAncestorId && memMap.has(currAncestorId) && !visitedAncestors.has(currAncestorId)) {
      visitedAncestors.add(currAncestorId);
      const parent = memMap.get(currAncestorId)!;
      ancestors.unshift(parent); // 古い順に前に追加
      currAncestorId = parent.supersededFrom;
    }

    // 2. 子孫（後続の新しい置換記憶）を辿る
    const descendants: MemoryItem[] = [];
    let currDescendantId = current.replacedBy;
    const visitedDescendants = new Set<string>([startMemoryId]);
    while (currDescendantId && memMap.has(currDescendantId) && !visitedDescendants.has(currDescendantId)) {
      visitedDescendants.add(currDescendantId);
      const child = memMap.get(currDescendantId)!;
      descendants.push(child); // 新しい順に後ろに追加
      currDescendantId = child.replacedBy;
    }

    const fullChain = [...ancestors, current, ...descendants];
    const rootId = fullChain[0]?.id || startMemoryId;
    const latestId = fullChain[fullChain.length - 1]?.id || startMemoryId;
    const hasSuperseded = fullChain.length > 1;

    return {
      chain: fullChain,
      rootId,
      latestId,
      hasSuperseded,
    };
  }

  /**
   * 8章 / 12章 置換関係サマリー一覧の生成
   * すべての置換履歴ペア・グループを整理してユーザー確認用に抽出
   */
  public getSubstitutionSummaries(memories: MemoryItem[]): Array<{
    oldMemory: MemoryItem;
    newMemory?: MemoryItem;
    reason: string;
    supersededAt?: number;
  }> {
    const memMap = new Map<string, MemoryItem>();
    memories.forEach((m) => memMap.set(m.id, m));

    const summaries: Array<{
      oldMemory: MemoryItem;
      newMemory?: MemoryItem;
      reason: string;
      supersededAt?: number;
    }> = [];

    for (const mem of memories) {
      if (mem.lifecycleStatus === 'SUPERSEDED' || Boolean(mem.replacedBy)) {
        const newMem = mem.replacedBy ? memMap.get(mem.replacedBy) : undefined;
        summaries.push({
          oldMemory: mem,
          newMemory: newMem,
          reason: mem.replacementReason || '新方針への適用に伴う置換',
          supersededAt: mem.supersededAt || mem.updatedAt,
        });
      }
    }

    return summaries.sort((a, b) => (b.supersededAt || 0) - (a.supersededAt || 0));
  }

  /**
   * 8章 / 指示書 SECTION 7 [提案A]:
   * バックグラウンド（浅い睡眠・アイドル時）において、未算出の記憶アイテムに
   * llama-server実埋め込みベクトルを順次付与してエンリッチ
   */
  public async enrichMemoryEmbeddings(memories: MemoryItem[], maxItems = 5): Promise<boolean> {
    const targets = memories
      .filter((m) => m.active !== false && !m.embeddingVector && m.content && m.content.trim())
      .slice(0, maxItems);
    if (targets.length === 0) return false;

    let enriched = false;
    for (const mem of targets) {
      try {
        const emb = await nativeLlmService.getEmbedding(mem.content, undefined, 2000);
        if (emb) {
          mem.embeddingVector = emb.embedding;
          mem.embeddingModelId = emb.modelId;
          mem.embeddingDimensions = emb.dimensions;
          enriched = true;
        }
      } catch (e) {}
    }
    return enriched;
  }

  /**
   * 設計思想 Master v5.2 第15章6節: 関連記憶グラフの自動リンク拡張 (Semantic Link Expansion)
   * 新規作成・更新された記憶について、既存の記憶群と意味的類似度・共通タグ・共有カテゴリを照合し、
   * 関連性の高い記憶ノードIDを relatedMemoryIds に双方向で自動リンクする。
   */
  public autoLinkRelatedMemories(
    targetMemory: MemoryItem,
    allMemories: MemoryItem[],
    maxLinks = 3
  ): { updatedTarget: MemoryItem; modifiedNeighbors: MemoryItem[] } {
    if (!targetMemory || !targetMemory.content) {
      return { updatedTarget: targetMemory, modifiedNeighbors: [] };
    }

    const targetTokens = extractQueryTokens(targetMemory.content);
    const targetVector = targetMemory.embeddingVector || targetMemory.domainVector || calculateDomainVector(targetMemory.content);
    const targetId = targetMemory.id;
    const existingLinks = new Set<string>(targetMemory.relatedMemoryIds || []);
    const modifiedNeighbors: MemoryItem[] = [];

    interface CandidateScore {
      memory: MemoryItem;
      score: number;
    }
    const candidates: CandidateScore[] = [];

    for (const other of allMemories) {
      if (other.id === targetId || other.active === false || other.lifecycleStatus === 'SUPERSEDED') continue;

      let linkScore = 0;

      // 1. 同一カテゴリ・ドメイン (+2点)
      if (other.category === targetMemory.category) linkScore += 2;
      if (other.memoryScope === targetMemory.memoryScope) linkScore += 1;

      // 2. 共通キーワード・トークン重複 (1単語あたり +3点)
      const otherTokens = extractQueryTokens(other.content || '');
      let tokenOverlap = 0;
      for (const tok of targetTokens) {
        if (otherTokens.has(tok)) tokenOverlap++;
      }
      linkScore += tokenOverlap * 3;

      // 3. 意味ベクトル類似度
      if (targetMemory.embeddingVector && other.embeddingVector && targetMemory.embeddingVector.length === other.embeddingVector.length) {
        const sim = calculateVectorCosineSimilarity(targetMemory.embeddingVector, other.embeddingVector);
        if (sim > 0.6) linkScore += sim * 10;
      } else {
        const otherVec = other.domainVector || calculateDomainVector(other.content || '');
        const sim = calculateCosineSimilarity(targetVector, otherVec);
        if (sim > 0.5) linkScore += sim * 6;
      }

      if (linkScore >= 5) {
        candidates.push({ memory: other, score: linkScore });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const topCandidates = candidates.slice(0, maxLinks);

    for (const cand of topCandidates) {
      existingLinks.add(cand.memory.id);

      // 相手側の記憶にも双方向で targetId を追加
      const neighborLinks = new Set<string>(cand.memory.relatedMemoryIds || []);
      if (!neighborLinks.has(targetId)) {
        neighborLinks.add(targetId);
        cand.memory.relatedMemoryIds = Array.from(neighborLinks);
        cand.memory.updatedAt = Date.now();
        modifiedNeighbors.push(cand.memory);
      }
    }

    targetMemory.relatedMemoryIds = Array.from(existingLinks);
    return { updatedTarget: targetMemory, modifiedNeighbors };
  }
}

export const longTermMemoryService = new LongTermMemoryService();
