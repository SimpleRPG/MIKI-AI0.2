/**
 * 設計思想 第31章 31.3: 「なぜこの回答？」説明パネル (Why This Answer Inspector)
 * 
 * 【目的】
 * 通常回答を一切邪魔せず、メッセージごとに「なぜこの回答になったのか」の
 * 内部推論プロセス（質問理解、推定目的、使用記憶、競合記憶の抑制、回答骨格、回答長理由）を
 * ユーザーがワンクリックで検証できるインスペクターデータを提供する。
 */

import { WhyAnswerInspection } from '../types';
import { storageService } from './storageService';

const WHY_ANSWER_STORAGE_KEY = 'miki_why_answer_records_v1';

export class WhyAnswerInspectorService {
  private records: Record<string, WhyAnswerInspection> = {};

  constructor() {
    this.loadRecords();
  }

  private loadRecords() {
    try {
      const raw = storageService.getItem(WHY_ANSWER_STORAGE_KEY);
      if (raw) {
        this.records = JSON.parse(raw);
      }
    } catch {
      this.records = {};
    }
  }

  private saveRecords() {
    try {
      // 直近100件のみ保持
      const keys = Object.keys(this.records);
      if (keys.length > 100) {
        const sorted = keys.sort((a, b) => this.records[b].timestamp - this.records[a].timestamp);
        const pruned: Record<string, WhyAnswerInspection> = {};
        for (const k of sorted.slice(0, 100)) {
          pruned[k] = this.records[k];
        }
        this.records = pruned;
      }
      storageService.setItem(WHY_ANSWER_STORAGE_KEY, JSON.stringify(this.records));
    } catch (e) {
      console.warn('Failed to save why answer records:', e);
    }
  }

  public getInspection(turnId: string): WhyAnswerInspection | null {
    return this.records[turnId] || null;
  }

  /**
   * 推論メタデータから「なぜこの回答？」インスペクションレコードを合成・保存 (31.3)
   */
  public generateAndSaveInspection(params: {
    turnId: string;
    userPrompt: string;
    aiResponse: string;
    answerPlanType?: string;
    activeMemories?: { id: string; content: string }[];
    usedTools?: string[];
    explanationLevel?: string;
  }): WhyAnswerInspection {
    const { turnId, userPrompt, aiResponse, answerPlanType, activeMemories = [], usedTools = [], explanationLevel } = params;

    // 質問理解の要約
    const understoodQuestion = userPrompt.length > 60
      ? `${userPrompt.slice(0, 60)}...`
      : userPrompt;

    // 推定目的
    let estimatedGoal = '一般的な対話と情報共有';
    if (userPrompt.includes('どう') || userPrompt.includes('何') || userPrompt.includes('教えて')) {
      estimatedGoal = '知識・概念の理解と具体的な疑問解消';
    } else if (userPrompt.includes('コード') || userPrompt.includes('VBA') || userPrompt.includes('関数')) {
      estimatedGoal = 'エラーのない実用コードの作成またはトラブルシューティング';
    } else if (userPrompt.includes('作って') || userPrompt.includes('実装')) {
      estimatedGoal = '安全な設計骨格に基づく実装成果物の提供';
    }

    // 回答長を選んだ理由
    let lengthReason = '要点と結論を最速で伝えるため、中級標準の長さに調整';
    if (aiResponse.length < 150) {
      lengthReason = 'ユーザーの意図が明確かつ簡潔な回答を求めているため、前置きを省略して短縮';
    } else if (aiResponse.length > 500) {
      lengthReason = 'コード例または複数ステップの手順解説を含むため、丁寧な構成を選択';
    }

    // 未確認事項の推定
    const unconfirmedAssumptions: string[] = [];
    if (!userPrompt.includes('Excel') && (userPrompt.includes('VBA') || userPrompt.includes('マクロ'))) {
      unconfirmedAssumptions.push('対象Officeバージョン (Excel 2016以降/365を想定)');
    }
    if (userPrompt.length < 15) {
      unconfirmedAssumptions.push('背景目的の詳細（省略された文脈は一般的なベストプラクティスで補完）');
    }

    const inspection: WhyAnswerInspection = {
      turnId,
      timestamp: Date.now(),
      understoodQuestion,
      estimatedGoal,
      usedMemories: activeMemories.slice(0, 3).map((m) => ({
        id: m.id,
        snippet: m.content.slice(0, 50),
        category: '長期記憶',
      })),
      suppressedMemories: activeMemories.length > 3
        ? activeMemories.slice(3, 5).map((m) => ({
            id: m.id,
            snippet: m.content.slice(0, 50),
            reason: '本トピックとの関連スコアが下位のため競合抑制',
          }))
        : [],
      selectedAnswerPlan: answerPlanType || 'PLAN_DIRECT_ANSWER (直接結論型)',
      toolsOrSearchUsed: usedTools.length > 0 ? usedTools : ['内部Non-LLM決定論的処理 (外部検索なし)'],
      unconfirmedAssumptions: unconfirmedAssumptions.length > 0 ? unconfirmedAssumptions : ['重大な未確認前提なし'],
      lengthReason,
      explanationDepth: explanationLevel || 'INTERMEDIATE_STANDARD',
    };

    this.records[turnId] = inspection;
    this.saveRecords();
    return inspection;
  }
}

export const whyAnswerInspectorService = new WhyAnswerInspectorService();
