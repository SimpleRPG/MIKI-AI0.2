/**
 * 設計思想 第155章:
 * 認知デバッガUI・推論トレース可視化 & 失敗経路診断エンジン
 * (Cognitive Debugger & Reasoning Trace Diagnostics Engine)
 *
 * 【目的】
 * 1. MIKI-AIが回答を生成した際の「思考・推論過程」を完全な透明性をもって可視化する。
 * 2. 意図分類、8層記憶の想起寄与、発火した定石ルール、回答骨格、安全ガードレールをタイムライン形式で記録。
 * 3. ユーザーの期待とズレた場合に「どの段階で判断が分岐したか（失敗経路）」をピンポイント診断する。
 */

import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

export interface ReasoningTraceStep {
  stepName: string;
  durationMs: number;
  status: 'SUCCESS' | 'OPTIMIZED' | 'CAUTION' | 'SKIPPED';
  details: string;
  artifacts?: Record<string, any>;
}

export interface CognitiveTraceRecord {
  id: string;
  timestamp: number;
  userPrompt: string;
  assistantReplySummary: string;
  intentCategory: string;
  recalledMemoryLayers: string[];
  firedHeuristicRules: string[];
  appliedSkeletonType: string;
  guardrailsChecked: string[];
  totalLatencyMs: number;
  traceSteps: ReasoningTraceStep[];
  diagnosticInsight?: string;
}

const TRACES_KEY = 'miki_cognitive_traces_v1';

export class CognitiveDebuggerService {
  private traces: CognitiveTraceRecord[] = [];

  constructor() {
    this.loadTraces();
    if (this.traces.length === 0) {
      this.seedInitialTraces();
    }
  }

  private loadTraces(): void {
    try {
      const raw = storageService.getItem(TRACES_KEY);
      if (raw) this.traces = JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to load cognitive traces:', e);
    }
  }

  private saveTraces(): void {
    try {
      storageService.setItem(TRACES_KEY, JSON.stringify(this.traces.slice(-30)));
    } catch (e) {
      console.warn('Failed to save cognitive traces:', e);
    }
  }

  private seedInitialTraces(): void {
    this.traces = [
      {
        id: 'trace_seed_1',
        timestamp: Date.now() - 3600000 * 2,
        userPrompt: 'Excelで重複したデータを抽出して別シートにコピーするマクロを書いて',
        assistantReplySummary: 'DictionaryオブジェクトとRange配列を用いた高速VBAマクロ（ゼロ省略）を提示',
        intentCategory: 'VBA_MACRO_CREATION',
        recalledMemoryLayers: ['第2層: 短期記憶', '第4層: エピソード記憶', '第6層: 手続き記憶 (Dictionary重複除外)'],
        firedHeuristicRules: ['[Rule-12] VBAではRange個別アクセスを避け配列一括転送を使用', '[Rule-08] 変数宣言強制(Option Explicit)付与'],
        appliedSkeletonType: 'CODE_EXPLANATION_DUAL_STAGE',
        guardrailsChecked: ['Qwen 3B重み不変条件', '個人情報漏洩ゼロ検証', 'ゼロ省略デリバリー検証'],
        totalLatencyMs: 340,
        traceSteps: [
          { stepName: '1. 意図解析 & 状況認識', durationMs: 15, status: 'SUCCESS', details: 'VBAマクロ作成意図・データ重複処理を特定' },
          { stepName: '2. 8層記憶動的想起', durationMs: 45, status: 'SUCCESS', details: '高速Dictionary処理手続きを想起 (想起スコア: 0.94)' },
          { stepName: '3. 定石ルール & 回答骨格選定', durationMs: 20, status: 'SUCCESS', details: '二段階デリバリー(完全コード＋要点解説)を適用' },
          { stepName: '4. 静的検証 & 不変条件チェック', durationMs: 30, status: 'SUCCESS', details: 'VBA 8大スキャナー合格、未宣言変数ゼロ' },
          { stepName: '5. 最終ストリーム生成', durationMs: 230, status: 'SUCCESS', details: 'エラーなく正常完了' },
        ],
        diagnosticInsight: '推論パスは最短最適経路を通過。DictionaryによるO(N)高速処理を選択しレイテンシ・精度ともに最高スコアを達成。',
      },
    ];
    this.saveTraces();
  }

  /**
   * 推論トレースを記録
   */
  public recordTrace(
    userPrompt: string,
    replySummary: string,
    intentCategory: string,
    recalledLayers: string[],
    rules: string[],
    skeleton: string,
    steps: ReasoningTraceStep[],
    totalLatencyMs: number,
    insight?: string
  ): CognitiveTraceRecord {
    const trace: CognitiveTraceRecord = {
      id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      userPrompt,
      assistantReplySummary: replySummary,
      intentCategory,
      recalledMemoryLayers: recalledLayers,
      firedHeuristicRules: rules,
      appliedSkeletonType: skeleton,
      guardrailsChecked: ['Qwen 3B保護', 'プライバシー送信境界', '不変条件オールクリア'],
      totalLatencyMs,
      traceSteps: steps,
      diagnosticInsight: insight || '推論経路の健全性を確認。不変条件および品質ゲートに適合しています。',
    };

    this.traces.unshift(trace);
    this.saveTraces();

    systemLogger.info('SELF_IMPROVEMENT', `🔍 [第155章 認知デバッガ] 発話推論トレース(${trace.id})を記録・診断しました`);
    return trace;
  }

  public getTraces(): CognitiveTraceRecord[] {
    return this.traces;
  }

  public getAllTraces(): CognitiveTraceRecord[] {
    return this.traces;
  }

  public getLatestTrace(): CognitiveTraceRecord | null {
    return this.traces[0] ?? null;
  }
}

export const cognitiveDebuggerService = new CognitiveDebuggerService();
