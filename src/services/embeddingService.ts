import { nonLlmRuntimeService, NonLlmTeacherConfig } from './nonLlmRuntimeService';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { nativeBackgroundService } from './nativeBackgroundService';
import type { MemoryItem, EmbeddingHealthStatus, EmbeddingHealthCheckResult } from '../types';

export interface EmbeddingStats {
  available: boolean;
  modelId: string;
  endpoint: string;
  dimensions?: number;
  totalMemoriesCount: number;
  embeddedMemoriesCount: number;
  lastSyncTimestamp?: number;
  healthStatus?: EmbeddingHealthStatus;
  consecutiveDegradedCount?: number;
}

/**
 * 設計思想 Master v5.0 第8項 & 第14章:
 * 決定論的特徴ベクトル (Embedding API) 連携サービス
 *
 * 8次元手作り疎ベクトルから、LLM実埋め込みベクトル（768〜4096次元）へのシームレスな移行と
 * オフライン・フォールバックを統括する。
 */
class EmbeddingService {
  private queryEmbeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
  private isSyncing = false;
  private lastCheckResult: { available: boolean; timestamp: number } | null = null;
  // 設計思想 Master v5.4 第19.4項: 埋め込み健全性監視
  private consecutiveDegradedCount = 0;
  private lastDegradedNotificationTimestamp = 0;
  private healthStatus: EmbeddingHealthStatus = 'available';

  /**
   * 埋め込みベクトルのコサイン類似度を計算 (-1.0 〜 1.0 -> 0.0 〜 1.0 に正規化)
   */
  public calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA <= 0 || normB <= 0) return 0;
    const rawCos = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    // 0.0〜1.0 の範囲に正規化
    return Math.max(0, Math.min(1, (rawCos + 1) / 2));
  }

  /**
   * 外部LLM埋め込みエンドポイントの疎通確認 (キャッシュ付き: 30秒)
   */
  public async checkAvailability(overrideConfig?: NonLlmTeacherConfig): Promise<{
    available: boolean;
    endpoint: string;
    type: string;
    dimensions?: number;
  }> {
    const now = Date.now();
    if (this.lastCheckResult && now - this.lastCheckResult.timestamp < 30000 && !overrideConfig) {
      const cfg = nonLlmRuntimeService.getActiveExternalConfig();
      return {
        available: this.lastCheckResult.available,
        endpoint: cfg.endpoint,
        type: cfg.type || 'deterministic',
      };
    }

    const check = await nonLlmRuntimeService.checkEmbeddingAvailability(overrideConfig);
    this.lastCheckResult = { available: check.available, timestamp: now };
    return check;
  }

  /**
   * クエリ文字列の実埋め込みを取得 (メモリ内LRUキャッシュ付き)
   */
  public async getQueryEmbedding(
    query: string,
    overrideConfig?: NonLlmTeacherConfig
  ): Promise<number[] | null> {
    const trimmed = (query || '').trim();
    if (!trimmed) return null;

    const cached = this.queryEmbeddingCache.get(trimmed);
    if (cached && Date.now() - cached.timestamp < 300000) {
      return cached.embedding;
    }

    try {
      const res = await nonLlmRuntimeService.getEmbedding(trimmed, overrideConfig, 3000);
      if (res && res.embedding && res.embedding.length > 0) {
        if (this.queryEmbeddingCache.size > 200) {
          const firstKey = this.queryEmbeddingCache.keys().next().value;
          if (firstKey) this.queryEmbeddingCache.delete(firstKey);
        }
        this.queryEmbeddingCache.set(trimmed, {
          embedding: res.embedding,
          timestamp: Date.now(),
        });
        return res.embedding;
      }
    } catch (e) {
      systemLogger.warn('INFERENCE', `実クエリ埋め込み取得失敗: ${(e as any)?.message}`);
    }

    return null;
  }

  /**
   * 単一の記憶アイテムについて実埋め込みベクトルを保証する
   */
  public async ensureMemoryEmbedding(
    memory: MemoryItem,
    overrideConfig?: NonLlmTeacherConfig
  ): Promise<MemoryItem> {
    if (memory.embeddingVector && memory.embeddingVector.length > 0) {
      return memory;
    }

    const textToEmbed = `${memory.content} ${(memory.tags || []).join(' ')}`;
    try {
      const res = await nonLlmRuntimeService.getEmbedding(textToEmbed, overrideConfig, 3500);
      if (res && res.embedding) {
        const updated: MemoryItem = {
          ...memory,
          embeddingVector: res.embedding,
          embeddingModelId: res.modelId,
          embeddingDimensions: res.dimensions,
        };
        storageService.saveMemoryItem(updated);
        return updated;
      }
    } catch (e) {}

    return memory;
  }

  /**
   * 未計算の全記憶アイテムについて、実埋め込みベクトルをバックグラウンド一括生成・同期する
   */
  public async syncMemoriesEmbeddings(
    memories: MemoryItem[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<{ updatedCount: number; memories: MemoryItem[] }> {
    if (this.isSyncing) {
      return { updatedCount: 0, memories };
    }

    const avail = await this.checkAvailability();
    if (!avail.available) {
      systemLogger.info('INFERENCE', '実埋め込みAPIが利用不能のため、埋め込み同期をスキップしました');
      return { updatedCount: 0, memories };
    }

    this.isSyncing = true;
    let updatedCount = 0;
    const resultMemories = [...memories];

    try {
      const unindexed = resultMemories.filter(
        (m) => !m.embeddingVector || m.embeddingVector.length === 0
      );

      systemLogger.info(
        'INFERENCE',
        `実埋め込み同期開始: 未生成 ${unindexed.length} 件 / 全体 ${resultMemories.length} 件`
      );

      for (let i = 0; i < unindexed.length; i++) {
        const m = unindexed[i];
        const updated = await this.ensureMemoryEmbedding(m);
        if (updated.embeddingVector && updated.embeddingVector.length > 0) {
          const idx = resultMemories.findIndex((orig) => orig.id === m.id);
          if (idx >= 0) {
            resultMemories[idx] = updated;
            updatedCount++;
          }
        }
        if (onProgress) {
          onProgress(i + 1, unindexed.length);
        }
        // UIブロック防止のための短いyield
        if (i % 3 === 0) {
          await new Promise((r) => setTimeout(r, 20));
        }
      }

      systemLogger.info(
        'INFERENCE',
        `実埋め込み同期完了: 新規生成 ${updatedCount} 件`
      );
    } finally {
      this.isSyncing = false;
    }

    return { updatedCount, memories: resultMemories };
  }

  /**
   * 現在の記憶リストと埋め込み状況の統計を取得
   */
  public async getStats(memories: MemoryItem[]): Promise<EmbeddingStats> {
    const config = nonLlmRuntimeService.getActiveExternalConfig();
    const avail = await this.checkAvailability(config);
    const embedded = (memories || []).filter(
      (m) => m.embeddingVector && m.embeddingVector.length > 0
    );
    const sampleDimensions = embedded.length > 0 ? embedded[0].embeddingDimensions : undefined;

    return {
      available: avail.available,
      modelId: config.model || 'deterministic',
      endpoint: config.endpoint,
      dimensions: sampleDimensions || avail.dimensions,
      totalMemoriesCount: (memories || []).length,
      embeddedMemoriesCount: embedded.length,
      lastSyncTimestamp: Date.now(),
      healthStatus: this.healthStatus,
      consecutiveDegradedCount: this.consecutiveDegradedCount,
    };
  }

  /**
   * 設計思想 Master v5.4 第19.4項:
   * 埋め込み健全性監視 (Embedding Health Guard)
   * 深い睡眠フェーズ冒頭 (PHASE 1 開始直後) 等で呼び出され、疎通確認と連続縮退を監視
   */
  public async checkHealth(
    overrideConfig?: NonLlmTeacherConfig
  ): Promise<EmbeddingHealthCheckResult> {
    const memories = storageService.getMemories();
    const totalCount = memories.length;
    const actualEmbeddedCount = memories.filter(
      (m) => m.embeddingVector && m.embeddingVector.length > 0
    ).length;
    const fallbackCount = totalCount - actualEmbeddedCount;

    let status: EmbeddingHealthStatus = 'available';
    let userNotified = false;

    try {
      const avail = await this.checkAvailability(overrideConfig);
      if (!avail.available) {
        status = 'degraded_fallback';
        this.consecutiveDegradedCount++;
      } else {
        status = 'available';
        this.consecutiveDegradedCount = 0;
      }
    } catch {
      status = 'unavailable';
      this.consecutiveDegradedCount++;
    }

    this.healthStatus = status;

    // 既定3回連続サイクル以上継続した場合、警告ログ＆ローカル通知を送信 (1日1回上限)
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    if (
      this.consecutiveDegradedCount >= 3 &&
      now - this.lastDegradedNotificationTimestamp > ONE_DAY_MS
    ) {
      systemLogger.warn(
        'INFERENCE',
        `【第19章 埋め込み健全性警告】実埋め込みサーバーが3回連続でオフラインです (${this.consecutiveDegradedCount}回)。8次元手作り疎ベクトルフォールバックが継続しています。`
      );

      try {
        const activeEndpoint = (overrideConfig ?? nonLlmRuntimeService.getActiveExternalConfig()).endpoint;
        await nativeBackgroundService.sendLocalNotification({
          title: '🧠 MikiAI 記憶検索の精度低下警告',
          body: `実埋め込みサーバーがオフラインのため、記憶検索が簡易フォールバック状態です。Termux (${activeEndpoint}) の稼働状態をご確認ください。`,
          data: { tab: 'memory' },
        });
        userNotified = true;
        this.lastDegradedNotificationTimestamp = now;
      } catch (err) {
        systemLogger.warn('INFERENCE', `健全性通知送信エラー: ${(err as any)?.message}`);
      }
    }

    return {
      status,
      consecutiveDegradedCount: this.consecutiveDegradedCount,
      userNotified,
      actualEmbeddingCount: actualEmbeddedCount,
      fallbackCount,
      timestamp: now,
    };
  }

  /**
   * 設計思想 Master v5.4 第19.4項 & 第18.1項:
   * 復帰時または深い睡眠時の段階的再埋め込みバッチ処理 (4〜8件単位、50msクールダウン)
   */
  public async performReindexingBatch(
    maxBatchSize = 6,
    signal?: AbortSignal
  ): Promise<{ reindexed: number }> {
    const avail = await this.checkAvailability();
    if (!avail.available) {
      return { reindexed: 0 };
    }

    const memories = storageService.getMemories();
    // actualEmbedding を持たず手作り疎ベクトルのみの記憶を優先抽出
    const unindexed = memories.filter(
      (m) => m.active !== false && (!m.embeddingVector || m.embeddingVector.length === 0)
    );

    if (unindexed.length === 0) {
      return { reindexed: 0 };
    }

    const batch = unindexed.slice(0, Math.min(maxBatchSize, 8));
    let reindexed = 0;

    for (const mem of batch) {
      if (signal?.aborted) break;

      const updated = await this.ensureMemoryEmbedding(mem);
      if (updated.embeddingVector && updated.embeddingVector.length > 0) {
        reindexed++;
      }

      // 第18.1項 Galaxy S25 熱対策: 50msクールダウン
      await new Promise((r) => setTimeout(r, 50));
    }

    if (reindexed > 0) {
      systemLogger.info(
        'INFERENCE',
        `【第19章 埋め込み復旧バッチ】${reindexed}件の記憶に実埋め込みを付与しました (残り ${unindexed.length - reindexed} 件)`
      );
    }

    return { reindexed };
  }
}

export const embeddingService = new EmbeddingService();
