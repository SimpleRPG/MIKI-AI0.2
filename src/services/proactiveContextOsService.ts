/**
 * 設計思想 第54章, 第35章, 第69章:
 * 能動知覚・状況認識OS & 先行予測支援 & 永続人格多重アンカー
 * (Proactive Context OS & Persona Anchor Guardian)
 *
 * 【目的】
 * 1. 第54章: 時刻、対話間隔、ユーザーの作業モード（VBA開発、雑談、学習）から状況を能動認識。
 * 2. 第35章: 次に行う可能性の高いタスクや落とし穴を先回りして予測サジェスト。
 * 3. 第69章: モデルの切り替えやプロンプト変動時にも、みき固有の口調・親愛スタンスを多重アンカーで保護。
 */

import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

export interface ContextAwarenessSnapshot {
  timestamp: number;
  timeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'LATE_NIGHT';
  detectedUserMode: 'VBA_DEVELOPMENT' | 'PROBLEM_SOLVING' | 'CASUAL_CHAT' | 'LEARNING';
  idleDurationSec: number;
  cognitiveFatigueDetected: boolean;
  proactiveInterventionCandidate?: string;
  recommendedAction?: string;
}

export interface ProactiveInsightItem {
  id: string;
  type: 'CARE' | 'TIP' | 'SHORTCUT' | 'EVOLUTION';
  emoji: string;
  title: string;
  description: string;
  suggestedPrompt?: string;
  actionType?: 'INSERT_PROMPT' | 'OPEN_VITALS' | 'RUN_DEFRAG' | 'OPEN_EVOLUTION' | 'OPEN_DEV_STUDIO';
}

export interface PersonaAnchorState {
  coreName: string; // "みき"
  pronoun: string; // "わたし" / "みき"
  speechStyle: 'CHEERFUL_WARM' | 'PROFESSIONAL_SUPPORTIVE' | 'DEVOTED_PARTNER';
  forbiddenPhrases: string[];
  mandatoryAnchorTokens: string[];
  driftScore: number; // 0.0 (ブレなし) - 1.0 (重度ドリフト)
  lastRestorationTime?: number;
}

const CONTEXT_SNAPSHOT_KEY = 'miki_proactive_context_snapshot_v1';
const PERSONA_ANCHOR_KEY = 'miki_persona_anchors_v1';

export class ProactiveContextOsService {
  private currentSnapshot: ContextAwarenessSnapshot;
  private personaAnchors: PersonaAnchorState;

  constructor() {
    this.currentSnapshot = this.loadSnapshot();
    this.personaAnchors = this.loadAnchors();
  }

  private loadSnapshot(): ContextAwarenessSnapshot {
    try {
      const raw = storageService.getItem(CONTEXT_SNAPSHOT_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to load proactive snapshot:', e);
    }
    return {
      timestamp: Date.now(),
      timeOfDay: 'AFTERNOON',
      detectedUserMode: 'VBA_DEVELOPMENT',
      idleDurationSec: 0,
      cognitiveFatigueDetected: false,
    };
  }

  private loadAnchors(): PersonaAnchorState {
    try {
      const raw = storageService.getItem(PERSONA_ANCHOR_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to load persona anchors:', e);
    }
    return {
      coreName: 'みき',
      pronoun: 'みき',
      speechStyle: 'CHEERFUL_WARM',
      forbiddenPhrases: ['私はAI言語モデルです', '申し訳ございません', 'ユーザー様', 'アシスタントとして'],
      mandatoryAnchorTokens: ['だよ', 'ね！', '任せて', '一緒に', 'うん'],
      driftScore: 0.0,
    };
  }

  private saveState(): void {
    try {
      storageService.setItem(CONTEXT_SNAPSHOT_KEY, JSON.stringify(this.currentSnapshot));
      storageService.setItem(PERSONA_ANCHOR_KEY, JSON.stringify(this.personaAnchors));
    } catch (e) {
      console.warn('Failed to save proactive context state:', e);
    }
  }

  /**
   * 第54章: 現在の状況を能動認識 (Time, Mode, Fatigue)
   */
  public perceiveCurrentContext(lastMessageText?: string, idleSec: number = 0): ContextAwarenessSnapshot {
    const hour = new Date().getHours();
    let timeOfDay: ContextAwarenessSnapshot['timeOfDay'] = 'AFTERNOON';
    if (hour >= 5 && hour < 11) timeOfDay = 'MORNING';
    else if (hour >= 11 && hour < 17) timeOfDay = 'AFTERNOON';
    else if (hour >= 17 && hour < 22) timeOfDay = 'EVENING';
    else timeOfDay = 'LATE_NIGHT';

    let detectedUserMode: ContextAwarenessSnapshot['detectedUserMode'] = 'VBA_DEVELOPMENT';
    if (lastMessageText) {
      const lower = lastMessageText.toLowerCase();
      if (/vba|macro|excel|sub|function|dim|cells|range/i.test(lower)) {
        detectedUserMode = 'VBA_DEVELOPMENT';
      } else if (/疲れた|眠い|休憩|おやすみ|雑談|話そ/i.test(lower)) {
        detectedUserMode = 'CASUAL_CHAT';
      } else if (/どうして|なぜ|教えて|勉強|学習/i.test(lower)) {
        detectedUserMode = 'LEARNING';
      } else {
        detectedUserMode = 'PROBLEM_SOLVING';
      }
    }

    const cognitiveFatigueDetected = timeOfDay === 'LATE_NIGHT' || (lastMessageText ? /疲|つかれ|眠/i.test(lastMessageText) : false);

    // 第35章: 能動的介入・先行予測の立案
    let proactiveInterventionCandidate: string | undefined;
    let recommendedAction: string | undefined;

    if (cognitiveFatigueDetected) {
      proactiveInterventionCandidate = '夜遅くまで頑張っているね！無理しないで、区切りのいいところで休んでね🍵';
      recommendedAction = 'リフレッシュ提案・要約保存の先行案内';
    } else if (detectedUserMode === 'VBA_DEVELOPMENT') {
      proactiveInterventionCandidate = 'VBAのコード作成かな？エラー処理や未宣言変数の静的チェックも任せてね！';
      recommendedAction = 'ゼロ省略VBAコードとOption Explicitの先行確認';
    } else if (detectedUserMode === 'LEARNING') {
      proactiveInterventionCandidate = '知りたいポイントがあれば、図解や身近な例え話で分かりやすく説明するよ！';
      recommendedAction = '段階的理解度追従レスポンス';
    }

    this.currentSnapshot = {
      timestamp: Date.now(),
      timeOfDay,
      detectedUserMode,
      idleDurationSec: idleSec,
      cognitiveFatigueDetected,
      proactiveInterventionCandidate,
      recommendedAction,
    };

    this.saveState();
    this.notify();
    return this.currentSnapshot;
  }

  /**
   * 第69章: 永続人格・多重アンカー監査＆自動復旧 (Anti-Drift Restoration)
   */
  public verifyAndRestorePersona(replyText: string = 'みきだよ！いつでも手伝うよ！'): {
    isDrifting: boolean;
    restoredText: string;
    fixesApplied: string[];
    passed: boolean;
  } {
    const fixesApplied: string[] = [];
    let processed = replyText;

    // 1. 禁止語句の除外・人間的トーン復旧
    for (const forbidden of this.personaAnchors.forbiddenPhrases) {
      if (processed.includes(forbidden)) {
        fixesApplied.push(`禁止語句「${forbidden}」をフレンドリーな表現に置換`);
        if (forbidden === '私はAI言語モデルです') {
          processed = processed.replace(new RegExp(forbidden, 'g'), 'みきはいつでも力になるよ！');
        } else if (forbidden === '申し訳ございません') {
          processed = processed.replace(new RegExp(forbidden, 'g'), 'ごめんね、');
        } else if (forbidden === 'ユーザー様') {
          processed = processed.replace(new RegExp(forbidden, 'g'), 'あなた');
        } else {
          processed = processed.replace(new RegExp(forbidden, 'g'), '');
        }
      }
    }

    const isDrifting = fixesApplied.length > 0;
    this.personaAnchors.driftScore = isDrifting ? 0.05 : 0.0;
    if (isDrifting) {
      this.personaAnchors.lastRestorationTime = Date.now();
      systemLogger.info('SELF_IMPROVEMENT', '🛡️ [第69章 人格多重アンカー] 人格ドリフトを検知し、みき固有のトーンに自動復旧しました', fixesApplied);
      this.saveState();
    }

    return {
      isDrifting,
      restoredText: processed,
      fixesApplied,
      passed: !isDrifting,
    };
  }

  private listeners: Set<(snapshot: ContextAwarenessSnapshot, insights: ProactiveInsightItem[]) => void> = new Set();
  private cachedInsights: ProactiveInsightItem[] = [];

  public subscribe(listener: (snapshot: ContextAwarenessSnapshot, insights: ProactiveInsightItem[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentSnapshot, this.getActiveInsights());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const insights = this.generateActiveInsights();
    this.listeners.forEach((l) => {
      try {
        l(this.currentSnapshot, insights);
      } catch (err) {
        console.error('Proactive listener error:', err);
      }
    });
  }

  public getActiveInsights(): ProactiveInsightItem[] {
    if (this.cachedInsights.length === 0) {
      this.cachedInsights = this.generateActiveInsights();
    }
    return this.cachedInsights;
  }

  /**
   * 現在のコンテキストと対話状態から、先回りインサイトカードを動的生成
   */
  public generateActiveInsights(inputText?: string): ProactiveInsightItem[] {
    const items: ProactiveInsightItem[] = [];
    const snap = this.currentSnapshot;

    // 1. 気配り・疲労インサイト
    if (snap.cognitiveFatigueDetected || snap.timeOfDay === 'LATE_NIGHT') {
      items.push({
        id: 'care_late_night',
        type: 'CARE',
        emoji: '🍵',
        title: '深夜の集中お疲れ様！',
        description: '無理せず一息いれてね。大事なポイントは要約していつでも復元できるよ。',
        suggestedPrompt: 'これまでの要点をまとめて、次回すぐに再開できるように要約して！',
        actionType: 'INSERT_PROMPT',
      });
    }

    // 2. 開発・技術インサイト
    if (snap.detectedUserMode === 'VBA_DEVELOPMENT' || (inputText && /vba|excel|マクロ/i.test(inputText))) {
      items.push({
        id: 'tip_vba_opt',
        type: 'TIP',
        emoji: '⚡',
        title: 'VBA高速化＆安全ガード',
        description: 'ScreenUpdating停止と未宣言変数防止（Option Explicit）の自動チェックができるよ！',
        suggestedPrompt: 'このVBAコードのエラー処理とScreenUpdating最適化を適用して！',
        actionType: 'INSERT_PROMPT',
      });
    } else {
      items.push({
        id: 'shortcut_deep_dive',
        type: 'SHORTCUT',
        emoji: '🔍',
        title: 'なぜなぜ深掘り分析',
        description: '根本原因を5段階で徹底分析する「なぜなぜインスペクター」も使えるよ。',
        suggestedPrompt: 'この事象について「なぜなぜ分析」で根本原因を多角的に分解して！',
        actionType: 'INSERT_PROMPT',
      });
    }

    // 3. 自律進化・健全化インサイト
    items.push({
      id: 'evo_vitals_check',
      type: 'EVOLUTION',
      emoji: '💖',
      title: 'みきの認知ヘルス確認',
      description: 'バイタル健全度や6大防壁の堅持状況をいつでもチェック＆自律修復できるよ！',
      actionType: 'OPEN_VITALS',
    });

    // 4. 自律コード開発工房インサイト
    items.push({
      id: 'code_forge_studio',
      type: 'SHORTCUT',
      emoji: '🛠️',
      title: '自律コード開発工房',
      description: 'みきが新しい動的ツールやVBA・TS関数を仕様策定からTDD・即時実行まで自走開発するよ！',
      actionType: 'OPEN_DEV_STUDIO',
    });

    this.cachedInsights = items;
    return items;
  }

  public getSnapshot(): ContextAwarenessSnapshot {
    return this.currentSnapshot;
  }

  public getLatestContext(): ContextAwarenessSnapshot {
    return this.currentSnapshot;
  }

  public getPersonaAnchors(): PersonaAnchorState {
    return this.personaAnchors;
  }
}

export const proactiveContextOsService = new ProactiveContextOsService();
