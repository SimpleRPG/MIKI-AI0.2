import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { longTermMemoryService } from './longTermMemoryService';
import { embeddingService } from './embeddingService';
import { autonomousSearchService } from './autonomousSearchService';
import type {
  MemoryItem,
  SpacedRecallAuditResult,
  FreshnessRevalidationResult,
  EmbeddingHealthCheckResult,
} from '../types';

const AUDIT_LOGS_KEY = 'miki_memory_audit_logs';

export interface MemoryAuditCycleRecord {
  id: string;
  timestamp: number;
  durationMs: number;
  spacedRecall: SpacedRecallAuditResult;
  freshness: FreshnessRevalidationResult;
  embeddingHealth: EmbeddingHealthCheckResult;
}

/**
 * 設計思想 Master v5.4 第19章:
 * 記憶の間隔反復定着・鮮度再検証・埋め込み健全性監視パイプライン (MemoryAuditService)
 */
class MemoryAuditService {
  private auditHistory: MemoryAuditCycleRecord[] = [];

  constructor() {
    this.loadHistory();
  }

  private loadHistory(): void {
    try {
      const raw = localStorage.getItem(AUDIT_LOGS_KEY);
      if (raw) {
        this.auditHistory = JSON.parse(raw);
      }
    } catch {
      this.auditHistory = [];
    }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(this.auditHistory.slice(-20)));
    } catch {}
  }

  public getRecentAuditRecords(limit = 10): MemoryAuditCycleRecord[] {
    return this.auditHistory.slice(-limit).reverse();
  }

  /**
   * 設計思想 Master v5.4 第19.2項:
   * 間隔反復による記憶定着監査 (Spaced Recall Reinforcement)
   * 重要度が高いにもかかわらず長期間想起されていない記憶を自律検知・補強
   */
  public async performSpacedRecallAudit(
    abortSignal?: AbortSignal,
    maxItems = 3
  ): Promise<SpacedRecallAuditResult> {
    const memories = storageService.getMemories();
    const now = Date.now();
    const DORMANT_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30日

    // 休眠重要記憶 (Dormant-Important Memory) を抽出
    // importance >= 4 (5段階) または >= 0.7 (0〜1スケール)
    const dormantMemories = memories.filter((m) => {
      if (m.active === false) return false;
      const importance = m.importance ?? 1;
      const isHighImportance = importance >= 4 || importance >= 0.7;
      if (!isHighImportance) return false;

      const lastUsed = m.lastUsedAt || m.createdAt || 0;
      return now - lastUsed >= DORMANT_THRESHOLD_MS;
    });

    const targetItems = dormantMemories.slice(0, maxItems);
    const reinforcedMemoryIds: string[] = [];
    let contradictionsFlagged = 0;

    for (const mem of targetItems) {
      if (abortSignal?.aborted) break;

      try {
        // 自己確認プロンプトによる定着シミュレーション
        const currentContent = mem.content;
        const currentTags = mem.tags || [];

        // 矛盾フラグチェック (否定・破棄キーワードがないか)
        const isSelfContradictory =
          currentContent.includes('【誤り】') ||
          currentContent.includes('【廃止】') ||
          currentContent.includes('使わない');

        if (isSelfContradictory) {
          contradictionsFlagged++;
          // 鮮度再検証または置換差分へマーク
          storageService.saveMemoryItem({
            ...mem,
            pendingVerificationDiff: `【間隔反復で検知された矛盾】破棄・無効化キーワードが含まれています: ${currentContent.slice(0, 50)}...`,
            updatedAt: now,
          });
        } else {
          // 定着回数を加算し lastUsedAt を更新
          const updatedReinforcement = (mem.reinforcementCount || 0) + 1;
          storageService.saveMemoryItem({
            ...mem,
            lastUsedAt: now,
            reinforcementCount: updatedReinforcement,
            heat: Math.min(1.0, (mem.heat || 0.5) + 0.15), // 熱量を再活性化
            updatedAt: now,
          });
          reinforcedMemoryIds.push(mem.id);
        }
      } catch (err) {
        systemLogger.warn(
          'PERSISTENCE',
          `間隔反復処理エラー (ID: ${mem.id}): ${(err as any)?.message}`
        );
      }

      await new Promise((r) => setTimeout(r, 40));
    }

    if (reinforcedMemoryIds.length > 0) {
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `【第19.2項 間隔反復監査】${reinforcedMemoryIds.length}件の休眠重要記憶を自律再確認・定着補強しました`
      );
    }

    return {
      dormantMemoriesChecked: dormantMemories.length,
      reinforcedCount: reinforcedMemoryIds.length,
      contradictionsFlagged,
      reinforcedMemoryIds,
    };
  }

  /**
   * 設計思想 Master v5.4 第19.3項:
   * 記憶の鮮度再検証 (Freshness Revalidation)
   * 価格・組織・バージョン等の時事性・揮発性記憶をWeb検索で裏取り再検証
   */
  public async performFreshnessRevalidation(
    abortSignal?: AbortSignal,
    maxItems = 2
  ): Promise<FreshnessRevalidationResult> {
    const memories = storageService.getMemories();
    const now = Date.now();
    const REVALIDATION_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000; // 90日

    // 揮発性が未設定の記憶には自動分類を付与
    const staleItems: MemoryItem[] = [];
    for (const mem of memories) {
      if (mem.active === false) continue;

      let volatility = mem.volatility;
      if (!volatility) {
        volatility = longTermMemoryService.detectVolatility(mem.content, mem.category);
        storageService.saveMemoryItem({ ...mem, volatility });
      }

      if (volatility === 'high') {
        const lastChecked = mem.lastVerifiedAt || mem.updatedAt || mem.createdAt || 0;
        if (now - lastChecked >= REVALIDATION_THRESHOLD_MS) {
          staleItems.push(mem);
        }
      }
    }

    const targets = staleItems.slice(0, maxItems);
    let verifiedCount = 0;
    let diffsDetected = 0;
    const flaggedMemoryIds: string[] = [];

    const searchConfig = autonomousSearchService.getConfig();
    if (!searchConfig.enabled) {
      return {
        memoriesChecked: staleItems.length,
        verifiedCount: 0,
        diffsDetected: 0,
        flaggedMemoryIds: [],
      };
    }

    for (const mem of targets) {
      if (abortSignal?.aborted) break;

      try {
        // 記憶内容から再検証検索クエリを生成
        const cleanQuery = mem.content
          .replace(/[【】「」『』]/g, ' ')
          .slice(0, 40)
          .trim();

        if (cleanQuery.length > 3) {
          const searchRes = await autonomousSearchService.executeSearch(cleanQuery);
          if (searchRes.results && searchRes.results.length > 0) {
            const topResult = searchRes.results[0];
            const snippet = topResult.snippet || '';

            // 簡易差分検出 (バージョンや価格等の数値・キーワード変更の兆候)
            const hasNewInfoNotice =
              snippet.length > 20 &&
              !snippet.toLowerCase().includes(mem.content.slice(0, 15).toLowerCase());

            if (hasNewInfoNotice) {
              diffsDetected++;
              flaggedMemoryIds.push(mem.id);
              storageService.saveMemoryItem({
                ...mem,
                pendingVerificationDiff: `【最新Web調査による更新候補】${snippet.slice(0, 100)}... (参照: ${topResult.url || 'Web'})`,
                lastVerifiedAt: now,
                updatedAt: now,
              });
            } else {
              verifiedCount++;
              storageService.saveMemoryItem({
                ...mem,
                lastVerifiedAt: now,
                updatedAt: now,
              });
            }
          } else {
            // 検索結果なしでも検証済みタイムスタンプ更新
            verifiedCount++;
            storageService.saveMemoryItem({
              ...mem,
              lastVerifiedAt: now,
              updatedAt: now,
            });
          }
        }
      } catch (err) {
        systemLogger.warn('PERSISTENCE', `鮮度再検証エラー (ID: ${mem.id}): ${(err as any)?.message}`);
      }

      // クールダウン
      await new Promise((r) => setTimeout(r, 100));
    }

    if (diffsDetected > 0) {
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `【第19.3項 鮮度再検証】${diffsDetected}件の記憶にWeb調査差分を検知し、確認待ち差分を記録しました`
      );
    }

    return {
      memoriesChecked: staleItems.length,
      verifiedCount,
      diffsDetected,
      flaggedMemoryIds,
    };
  }

  /**
   * 設計思想 Master v5.4 第19章 総合実行パイプライン
   * バックグラウンド深い睡眠サイクルから呼び出される総合実行メソッド
   */
  public async runFullAuditCycle(abortSignal?: AbortSignal): Promise<MemoryAuditCycleRecord> {
    const startTime = Date.now();
    systemLogger.info('SELF_IMPROVEMENT', '【第19章】記憶の間隔反復・鮮度再検証・埋め込み健全性サイクルを開始します');

    // 1. 埋め込み健全性監視 (19.4)
    const embeddingHealth = await embeddingService.checkHealth();

    // 2. 埋め込み復旧バッチ (健全な場合、手作り疎ベクトル記憶を再埋め込み)
    if (embeddingHealth.status === 'available') {
      await embeddingService.performReindexingBatch(6, abortSignal);
    }

    // 3. 間隔反復による記憶定着監査 (19.2)
    const spacedRecall = await this.performSpacedRecallAudit(abortSignal);

    // 4. 記憶の鮮度再検証 (19.3)
    const freshness = await this.performFreshnessRevalidation(abortSignal);

    const record: MemoryAuditCycleRecord = {
      id: `audit_${Date.now()}`,
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
      spacedRecall,
      freshness,
      embeddingHealth,
    };

    this.auditHistory.push(record);
    this.saveHistory();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `【第19章】サイクル完了 (${record.durationMs}ms): 間隔反復定着 ${spacedRecall.reinforcedCount}件 / 鮮度差分検知 ${freshness.diffsDetected}件 / 埋め込み状態: ${embeddingHealth.status}`
    );

    return record;
  }
}

export const memoryAuditService = new MemoryAuditService();
