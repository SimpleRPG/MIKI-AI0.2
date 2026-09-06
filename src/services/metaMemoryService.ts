import { storageService } from './storageService';

const STORAGE_KEY = 'miki_meta_memory_state';

export interface MetaMemoryParams {
  vectorWeight: number;    // 意味検索重み (0.0〜1.0)
  linkWeight: number;      // リンク展開・関係性重み (0.0〜1.0)
  tagWeight: number;       // タグ・完全一致重み (0.0〜1.0)
  maxLinkDepth: number;    // リンク展開最大深さ (1〜3)
  minScoreThreshold: number; // 最小採用スコア (0〜15)
}

/**
 * 設計思想 Master v5.0 第2章: 全8層完全記憶階層構造
 * ⑧ メタ記憶 (Meta-Memory) 管理サービス
 * 
 * 想起比率（ベクトル : リンク : タグ）の状況適応型動的調整。
 * 会話のコンテキスト（コード、デバッグ、雑談、創作）や過去の成否に基づき、
 * 最適な想起パラメータを自己学習・提供する。
 */
class MetaMemoryService {
  private params: MetaMemoryParams = {
    vectorWeight: 0.5,
    linkWeight: 0.3,
    tagWeight: 0.2,
    maxLinkDepth: 2,
    minScoreThreshold: 6.0,
  };
  private isLoaded = false;

  constructor() {
    this.load();
  }

  private load(): void {
    if (this.isLoaded) return;
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.vectorWeight === 'number') {
          this.params = { ...this.params, ...parsed };
        }
      }
      this.isLoaded = true;
    } catch (e) {
      // safe fallback
    }
  }

  private save(): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(this.params));
    } catch (e) {}
  }

  public getParams(): MetaMemoryParams {
    this.load();
    return { ...this.params };
  }

  /**
   * クエリの文脈種別に応じた最適な想起比率を算出 (第2章⑧ & 第3章5節)
   */
  public getAdaptiveParamsForContext(contextType: 'code' | 'logic' | 'shader' | 'chat'): MetaMemoryParams {
    this.load();
    const base = { ...this.params };

    switch (contextType) {
      case 'code':
      case 'logic':
        // 厳密なロジックやコードではタグ・完全一致・構造リンクを重視
        return {
          vectorWeight: 0.3,
          linkWeight: 0.4,
          tagWeight: 0.3,
          maxLinkDepth: base.maxLinkDepth,
          minScoreThreshold: 7.0,
        };
      case 'chat':
      default:
        // 対話では意味的連想 (ベクトル) を広めに拾う
        return {
          vectorWeight: 0.6,
          linkWeight: 0.2,
          tagWeight: 0.2,
          maxLinkDepth: 2,
          minScoreThreshold: 5.0,
        };
    }
  }

  /**
   * ユーザー訂正や高評価フィードバックを元に想起比率を微調整
   */
  public adaptWeightsFromFeedback(wasCorrection: boolean): void {
    this.load();
    if (wasCorrection) {
      // 誤想起があった場合: 意味的飛び石(ベクトル)を少し抑え、確実なタグ・完全一致を強める
      this.params.vectorWeight = Math.max(0.2, Number((this.params.vectorWeight - 0.05).toFixed(2)));
      this.params.tagWeight = Math.min(0.5, Number((this.params.tagWeight + 0.05).toFixed(2)));
    } else {
      // 成功対話時: ベクトルの連想性を微増
      this.params.vectorWeight = Math.min(0.7, Number((this.params.vectorWeight + 0.02).toFixed(2)));
      this.params.tagWeight = Math.max(0.1, Number((this.params.tagWeight - 0.02).toFixed(2)));
    }
    this.save();
  }
}

export const metaMemoryService = new MetaMemoryService();
