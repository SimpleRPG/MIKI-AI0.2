/**
 * 設計思想 第37章: 多段意図推定・潜在欲求マイニング
 * (Multi-Stage Intent Estimation & Latent Goal Mining Engine)
 *
 * 【主要要件】
 * 1. 潜在ゴール推論 (Latent Goal Inference):
 *    ユーザーの曖昧な発話・表面的な要求の背後にある「真の目的」「業務課題」「感情的欲求」を深層推論。
 * 2. マルチターン意図追跡 (Multi-turn Intent Tracking):
 *    対話の推移・途中での方針転換（Intent Drift）を追跡し、文脈矛盾や手戻りを先回り解決。
 * 3. 不変条件の保護:
 *    Qwen 3B絶対保護、送信前プライバシー境界、ロールバック性の担保。
 */

import {
  LatentGoalInference,
  MultiTurnIntentTrace,
  MultiTurnIntentSession,
} from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { privacyGuardrailService } from './privacyGuardrailService';
import { chapter37IntentMiningEngine } from '../autonomous_modules/chapter_37';

const INTENT_SESSIONS_STORAGE_KEY = 'miki_latent_intent_sessions_v1';

export class LatentIntentMiningService {
  private sessions: Map<string, MultiTurnIntentSession> = new Map();
  private activeSessionId: string = 'session_default';

  constructor() {
    this.loadSessions();
  }

  private loadSessions(): void {
    try {
      const raw = storageService.getItem(INTENT_SESSIONS_STORAGE_KEY);
      if (raw) {
        const parsed: MultiTurnIntentSession[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const s of parsed) {
            this.sessions.set(s.id, s);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load latent intent sessions:', e);
    }
  }

  private saveSessions(): void {
    try {
      const list = Array.from(this.sessions.values()).slice(-20);
      storageService.setItem(INTENT_SESSIONS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save latent intent sessions:', e);
    }
  }

  /**
   * 1. 潜在ゴール推論 (Latent Goal Inference)
   * ユーザーの発話から、表面上の指示と真のゴール（業務効率化・不安解消・納期遵守など）を分解特定
   */
  public inferLatentGoal(utterance: string, contextTurns: string[] = []): LatentGoalInference {
    // プライバシー検証
    privacyGuardrailService.auditOutboundContent(utterance, 'GEMINI_TEACHER', { autoSanitize: true });

    const text = utterance.toLowerCase();
    let surfaceIntent = '一般的な質問・相談';
    let latentGoal = '効率的なタスク完遂と疑問の解消';
    const unexpressedNeeds: string[] = [];
    let confidenceScore = 80;
    let urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let suggestedProactiveAction = '要求の背景を確認しつつ、標準的な回答を提示';

    if (text.includes('vba') || text.includes('マクロ') || text.includes('excel') || text.includes('エクセル')) {
      surfaceIntent = 'VBA/Excelマクロの作成・修正';
      if (text.includes('動かない') || text.includes('エラー') || text.includes('遅い') || text.includes('重い')) {
        latentGoal = '業務停止リスクの即時回避とクラッシュしない堅牢なバッチ自動化';
        unexpressedNeeds.push('エラーハンドリング（On Error Goto）の組み込み');
        unexpressedNeeds.push('ScreenUpdating/Calculation最適化による高速化');
        unexpressedNeeds.push('保守しやすいコメント・定数定義');
        urgencyLevel = 'HIGH';
        suggestedProactiveAction = 'エラー原因の根本修復コードに加え、処理速度を3倍にする最適化スニペットを併せて提示';
        confidenceScore = 92;
      } else {
        latentGoal = 'ルーチン業務の自動化による残業削減・作業ミス根絶';
        unexpressedNeeds.push('データ列の変動に耐えうる動的最終行取得');
        unexpressedNeeds.push('ワンクリックで実行できるボタン配置手順の教示');
        urgencyLevel = 'MEDIUM';
        suggestedProactiveAction = '基本マクロとともに、ボタン登録手順と入力データの想定フォーマットを先行案内';
        confidenceScore = 88;
      }
    } else if (text.includes('react') || text.includes('typescript') || text.includes('css') || text.includes('コンポーネント')) {
      surfaceIntent = 'フロントエンドUI・コンポーネントの実装';
      latentGoal = '保守性が高く不具合の出ないクリーンアーキテクチャの構築';
      unexpressedNeeds.push('型安全なインターフェース設計');
      unexpressedNeeds.push('不要な再レンダリング防止（useCallback/useMemo）');
      urgencyLevel = 'MEDIUM';
      suggestedProactiveAction = '単なるUI描画にとどまらず、Propsの型定義と状態管理を含めた安全なコードを提供';
      confidenceScore = 90;
    } else if (text.includes('助けて') || text.includes('急ぎ') || text.includes('明日まで') || text.includes('緊急')) {
      surfaceIntent = '緊急のトラブルシューティング';
      latentGoal = '締め切り直前のプレッシャーからの解放と確実な動作の確保';
      unexpressedNeeds.push('手動でもリカバリ可能な最短代替策');
      unexpressedNeeds.push('安心感を与える明快な即答');
      urgencyLevel = 'HIGH';
      suggestedProactiveAction = '理屈の講釈を省き、コピー＆ペーストで即座に動く最小修正案を最優先で出力';
      confidenceScore = 95;
    }

    return {
      surfaceIntent,
      latentGoal,
      unexpressedNeeds,
      confidenceScore,
      urgencyLevel,
      suggestedProactiveAction,
    };
  }

  /**
   * 2. マルチターン意図追跡 (Multi-turn Intent Tracking)
   * 会話のターンを追跡し、ゴールへの収束度や意図のシフトを記録
   */
  public trackMultiTurnIntent(utterance: string, sessionId: string = this.activeSessionId): MultiTurnIntentTrace {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        topic: utterance.slice(0, 30),
        traces: [],
        overallLatentGoal: '',
        resolvedNeeds: [],
        pendingNeeds: [],
        updatedAt: Date.now(),
      };
      this.sessions.set(sessionId, session);
    }

    const turnIndex = session.traces.length + 1;
    const inference = this.inferLatentGoal(utterance);

    // 直前ターンとの意図シフト検出
    let intentShiftDetected = false;
    let shiftReason: string | undefined;

    if (session.traces.length > 0) {
      const prev = session.traces[session.traces.length - 1];
      if (prev.inferredIntent !== inference.surfaceIntent) {
        intentShiftDetected = true;
        shiftReason = `意図が「${prev.inferredIntent}」から「${inference.surfaceIntent}」へ展開・深化しました`;
      }
    }

    const trace: MultiTurnIntentTrace = {
      turnIndex,
      utterance,
      inferredIntent: inference.surfaceIntent,
      latentGoal: inference.latentGoal,
      intentShiftDetected,
      shiftReason,
      clarityScore: inference.confidenceScore,
      timestamp: Date.now(),
    };

    session.traces.push(trace);
    session.overallLatentGoal = inference.latentGoal;
    session.updatedAt = Date.now();

    for (const need of inference.unexpressedNeeds) {
      if (!session.pendingNeeds.includes(need) && !session.resolvedNeeds.includes(need)) {
        session.pendingNeeds.push(need);
      }
    }

    this.saveSessions();

    // 自律モジュール (chapter_37.ts) との決定論的同期
    try {
      chapter37IntentMiningEngine.trackTurn(utterance);
    } catch (e) {
      console.warn('Failed to sync with chapter37IntentMiningEngine:', e);
    }

    systemLogger.info('SELF_IMPROVEMENT', `[第37章 意図推定] Turn #${turnIndex}: 表面「${inference.surfaceIntent}」 / 潜在「${inference.latentGoal}」 (シフト: ${intentShiftDetected ? '検知' : 'なし'})`);

    return trace;
  }

  public getSession(sessionId: string): MultiTurnIntentSession | null {
    return this.sessions.get(sessionId) || null;
  }

  public getAllSessions(): MultiTurnIntentSession[] {
    return Array.from(this.sessions.values());
  }

  public resolveNeed(sessionId: string, need: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pendingNeeds = session.pendingNeeds.filter((n) => n !== need);
      if (!session.resolvedNeeds.includes(need)) {
        session.resolvedNeeds.push(need);
      }
      session.updatedAt = Date.now();
      this.saveSessions();
    }
  }
}

export const latentIntentMiningService = new LatentIntentMiningService();
