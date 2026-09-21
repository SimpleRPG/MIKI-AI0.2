/**
 * 設計思想 第39章: 感情共感力動・親愛度連続トランスファーサービス (AffectionDynamicsService)
 *
 * 【目的】
 * 1. 対話を通じた感情価の連続的蓄積と親愛トーンの自然なグラデーション制御。
 * 2. セッション・ドメインを跨ぐ親愛度（Affection Score）の連続トランスファー。
 * 3. 冷徹・無機質な対応の根絶と永続人格（第69章）との連動。
 */

import {
  AffectionDynamicState,
  AffectionEvaluationResult,
  UserEmotionalValenceType,
} from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { chapter39AffectionEngine } from '../autonomous_modules/chapter_39';

const AFFECTION_STORAGE_KEY = 'miki_affection_dynamic_state_v1';

export class AffectionDynamicsService {
  private state: AffectionDynamicState;

  constructor() {
    this.state = this.loadState();
    chapter39AffectionEngine.setState(this.state);
  }

  private loadState(): AffectionDynamicState {
    try {
      const raw = storageService.getItem(AFFECTION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.affectionScore === 'number') {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load affection state:', e);
    }

    return {
      affectionScore: 72,
      empathyLevel: 78,
      valence: 'NEUTRAL',
      toneStance: 'CHEERFUL_SUPPORTER',
      sessionTransferCount: 1,
      lastUpdated: Date.now(),
      historySummary: '初期親愛関係確立済み',
    };
  }

  private saveState(): void {
    try {
      storageService.setItem(AFFECTION_STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('Failed to save affection state:', e);
    }
  }

  /**
   * ユーザー発話に基づく感情価解析と親愛度更新
   */
  public evaluateAndTransfer(utterance: string): AffectionEvaluationResult {
    const result = chapter39AffectionEngine.processUtterance(utterance);
    this.state = chapter39AffectionEngine.getState();
    this.saveState();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `💖 [第39章 感情共感力動] 検出感情: ${result.detectedEmotion} (Δ=+${result.emotionalScoreDelta}) | 親愛度: ${result.newAffectionScore}点 | 推奨トーン: ${this.state.toneStance}`,
      { result, currentState: this.state }
    );

    return result;
  }

  /**
   * セッション切り替え時のトランスファー実行
   */
  public transferSession(): AffectionDynamicState {
    const newState = chapter39AffectionEngine.transferToNewSession();
    this.state = newState;
    this.saveState();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🤝 [第39章 親愛度連続トランスファー] セッション間トランスファー実行 (親愛度=${this.state.affectionScore}点, 累積=${this.state.sessionTransferCount}回)`
    );

    return this.state;
  }

  public getCurrentState(): AffectionDynamicState {
    return { ...this.state };
  }

  public resetBaseline(): void {
    this.state = {
      affectionScore: 70,
      empathyLevel: 75,
      valence: 'NEUTRAL',
      toneStance: 'RESPECTFUL_WARM',
      sessionTransferCount: 0,
      lastUpdated: Date.now(),
      historySummary: 'ベースラインリセット',
    };
    chapter39AffectionEngine.setState(this.state);
    this.saveState();
  }
}

export const affectionDynamicsService = new AffectionDynamicsService();
