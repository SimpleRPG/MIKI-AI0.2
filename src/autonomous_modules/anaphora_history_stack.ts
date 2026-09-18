/**
 * MIKI-AI 自律モジュール: 指示語・文脈照応の履歴スタック管理クラスの実装
 * 対象ファイル: src/autonomous_modules/anaphora_history_stack.ts
 *
 * 【主要要件】
 * 1. 直近エンティティ・話題の時系列スタック管理 (LIFO/FIFO併用)
 * 2. 時間減衰 (Turn Decay) による古い話題の自動退行防止
 * 3. 曖昧候補・複数エンティティの重複排除と優先度ソート
 */

export interface AnaphoraStackItem {
  id: string;
  topicOrEntity: string;
  category: 'TOPIC' | 'ENTITY' | 'FACT';
  turn: number;
  timestamp: number;
}

export class AnaphoraHistoryStack {
  private stack: AnaphoraStackItem[] = [];
  private maxItems: number;
  private decayTurnLimit: number;

  constructor(maxItems = 15, decayTurnLimit = 8) {
    this.maxItems = maxItems;
    this.decayTurnLimit = decayTurnLimit;
  }

  /**
   * エンティティまたはトピックをスタックに追加
   */
  public push(topicOrEntity: string, category: 'TOPIC' | 'ENTITY' | 'FACT' = 'ENTITY', currentTurn = 1): void {
    if (!topicOrEntity || !topicOrEntity.trim()) return;
    const text = topicOrEntity.trim();

    // 既存の同一項目を削除して最新位置へ移動
    this.stack = this.stack.filter((item) => item.topicOrEntity !== text);

    this.stack.push({
      id: `anaphora_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      topicOrEntity: text,
      category,
      turn: currentTurn,
      timestamp: Date.now(),
    });

    if (this.stack.length > this.maxItems) {
      this.stack.shift();
    }
  }

  /**
   * 現在ターンに基づいて時間減衰した候補プールを取得 (最新順)
   */
  public getActivePool(currentTurn = 1): string[] {
    const validItems = this.stack.filter((item) => {
      const turnDiff = Math.abs(currentTurn - item.turn);
      return turnDiff <= this.decayTurnLimit;
    });

    // 最新のものを末尾に保ちつつ返す
    return validItems.map((item) => item.topicOrEntity);
  }

  /**
   * 直近のN件の候補を取得
   */
  public getRecent(n = 3): string[] {
    return this.stack.slice(-n).map((i) => i.topicOrEntity);
  }

  /**
   * スタックをクリア
   */
  public clear(): void {
    this.stack = [];
  }

  public getDiagnostics() {
    return {
      size: this.stack.length,
      maxItems: this.maxItems,
      decayTurnLimit: this.decayTurnLimit,
      latestItem: this.stack.length > 0 ? this.stack[this.stack.length - 1] : null,
    };
  }
}

export const anaphoraHistoryStack = new AnaphoraHistoryStack();
