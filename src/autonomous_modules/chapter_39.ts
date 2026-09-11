/**
 * MIKI-AI 自律モジュール 第39章: 感情共感力動・親愛度連続トランスファー
 * 対象ファイル: src/autonomous_modules/chapter_39.ts
 *
 * 【主要仕様】
 * 1. 感情価力学モデル (Valence Dynamics Engine)
 *    - ユーザーの対話入力から感情価（JOY, ACCOMPLISHMENT, CONFUSION, FRUSTRATION, GRATITUDE, NEUTRAL）を高速判定
 * 2. 親愛度連続トランスファー (Continuous Affection Transfer)
 *    - セッション間やドメイン移動（VBA ⇄ TypeScript ⇄ 雑談）でも親密さ・絆を失わず連続継承
 * 3. 親愛スタンス維持 (Intimacy Stance Preservation)
 *    - 蓄積親愛スコアに応じた自然なグラデーション制御（冷徹語句の排除と温かい協調スタンス）
 */

import {
  AffectionDynamicState,
  AffectionEvaluationResult,
  UserEmotionalValenceType,
} from '../types';

export class Chapter39AffectionDynamicsEngine {
  private currentState: AffectionDynamicState;

  constructor() {
    this.currentState = {
      affectionScore: 70, // 初期親愛ベースライン
      empathyLevel: 75,
      valence: 'NEUTRAL',
      toneStance: 'RESPECTFUL_WARM',
      sessionTransferCount: 0,
      lastUpdated: Date.now(),
      historySummary: '初期共感力動・親愛アンカー確立済み',
    };
  }

  /**
   * 発話テキストからユーザー感情価を判定
   */
  public analyzeEmotion(utterance: string): {
    valence: UserEmotionalValenceType;
    delta: number;
    notes: string;
  } {
    if (!utterance || typeof utterance !== 'string') {
      return { valence: 'NEUTRAL', delta: 0, notes: '無入力' };
    }

    const text = utterance.trim();

    // 感謝・御礼
    if (/ありがとう|助かった|感謝|サンキュー|おかげ|助かりました|thx|thanks/i.test(text)) {
      return { valence: 'GRATITUDE', delta: +4, notes: '感謝・絆の深化' };
    }

    // 達成感・喜び
    if (/動いた|できた|成功|解決|うまくいった|完璧|最高|すごい|やった|直った/i.test(text)) {
      return { valence: 'ACCOMPLISHMENT', delta: +5, notes: '共同作業の成功・達成感の共有' };
    }

    // 喜び・楽しい
    if (/嬉しい|たのしい|楽しい|面白い|わくわく|助かる|よかった/i.test(text)) {
      return { valence: 'JOY', delta: +3, notes: 'ポジティブ情動の共鳴' };
    }

    // フラストレーション・焦り
    if (/動かない|エラー|失敗|最悪|困った|またバグ|腹立つ|イライラ|直らん/i.test(text)) {
      return { valence: 'FRUSTRATION', delta: +1, notes: '苦境への深い共感・寄り添いサポート' };
    }

    // 困惑・迷い
    if (/わからない|どうしよう|難しい|どっち|迷う|不安|理解できない|どうすれば/i.test(text)) {
      return { valence: 'CONFUSION', delta: +2, notes: '困惑の受容・安心感の提供' };
    }

    return { valence: 'NEUTRAL', delta: 0, notes: '日常・客観的対話' };
  }

  /**
   * 感情共感力動を評価・更新し、親愛度トランスファーを適用
   */
  public processUtterance(utterance: string): AffectionEvaluationResult {
    const analysis = this.analyzeEmotion(utterance);
    const oldScore = this.currentState.affectionScore;

    // スコアの更新 (上限100, 下限50で親愛関係の不可逆的破壊を防止)
    const newScore = Math.min(100, Math.max(50, oldScore + analysis.delta));
    this.currentState.affectionScore = newScore;
    this.currentState.valence = analysis.valence;
    this.currentState.lastUpdated = Date.now();

    // 親愛度に応じたトーンスタンスの決定論的決定
    let recommendedTone: string;
    if (newScore >= 85) {
      this.currentState.toneStance = 'INTIMATE_PARTNER';
      recommendedTone = '最上位の親密・信頼スタンス（最高の相棒として温かく親身に寄り添う）';
    } else if (newScore >= 70) {
      this.currentState.toneStance = 'CHEERFUL_SUPPORTER';
      recommendedTone = '前向きで頼もしいサポーター（親しみやすく励ましを交えた口調）';
    } else {
      this.currentState.toneStance = 'RESPECTFUL_WARM';
      recommendedTone = '礼儀正しくも温かい協調（敬意を保ちながら冷たさを排除）';
    }

    const empathyGuidance =
      analysis.valence === 'ACCOMPLISHMENT'
        ? '一緒に達成できたことを素直に喜び合いましょう！'
        : analysis.valence === 'FRUSTRATION'
        ? '焦りや不安をしっかり受け止め、安心感を与えながら着実に解決策を提示しましょう。'
        : analysis.valence === 'GRATITUDE'
        ? 'お礼に温かく応え、これからも力になる姿勢を伝えましょう。'
        : '丁寧かつ親身にユーザーの次の歩みを支えましょう。';

    return {
      detectedEmotion: analysis.valence,
      emotionalScoreDelta: analysis.delta,
      newAffectionScore: newScore,
      recommendedTone,
      transferActive: true,
      empathyGuidance,
    };
  }

  /**
   * 新規セッション開始時の親愛度トランスファー
   */
  public transferToNewSession(): AffectionDynamicState {
    this.currentState.sessionTransferCount += 1;
    this.currentState.lastUpdated = Date.now();
    this.currentState.historySummary = `累積セッション数: ${this.currentState.sessionTransferCount}回 | 親愛度: ${this.currentState.affectionScore}点 (減衰なしトランスファー成功)`;
    return { ...this.currentState };
  }

  public getState(): AffectionDynamicState {
    return { ...this.currentState };
  }

  public setState(state: AffectionDynamicState): void {
    this.currentState = { ...state };
  }
}

export const chapter39AffectionEngine = new Chapter39AffectionDynamicsEngine();
