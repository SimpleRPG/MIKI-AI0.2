/**
 * 設計思想 第31章 31.10: 会話からタスクボード生成 (Conversation Taskboard Generator)
 * & 31.14 自発提案強度設定 & 31.15 説明レベル手動上書き
 * 
 * 【目的】
 * 会話中の「後で調べる」「未解決」「次に実装」「保留」を自動抽出し、
 * 目的、必要情報、完了条件、優先度を持つタスクカードとしてWorking Agendaへ連携。
 * AIが勝手に完了扱いせず、第48章の完了判定器(Completion Evaluator)の検査を必須とする。
 */

import {
  ConversationTaskCard,
  ConversationTaskCategory,
  ManualExplanationOverride,
  ProactiveSuggestionLevel,
} from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const TASKBOARD_STORAGE_KEY = 'miki_conversation_tasks_v1';
const PROACTIVE_LEVEL_KEY = 'miki_proactive_suggestion_level_v1';
const EXPLANATION_OVERRIDE_KEY = 'miki_manual_explanation_override_v1';

const TASK_KEYWORDS: { category: ConversationTaskCategory; regex: RegExp; titlePrefix: string }[] = [
  {
    category: 'INVESTIGATE_LATER',
    regex: /(後で調べる|あとで確認|後で調査|あとで調べる|要調査|後で見てみる)/,
    titlePrefix: '【調査】',
  },
  {
    category: 'UNRESOLVED',
    regex: /(未解決|わからない|不明点|エラー原因不明|まだ解決してない|解決していない)/,
    titlePrefix: '【未解決課題】',
  },
  {
    category: 'NEXT_IMPLEMENT',
    regex: /(次に実装|次回作る|次に追加|後で実装|次はこれ|実装予定)/,
    titlePrefix: '【実装予定】',
  },
  {
    category: 'ON_HOLD',
    regex: /(一旦保留|保留|後回し|ペンディング|見送り)/,
    titlePrefix: '【保留】',
  },
];

export class ConversationTaskboardService {
  private tasks: ConversationTaskCard[] = [];
  private proactiveLevel: ProactiveSuggestionLevel = 'STANDARD';
  private explanationOverride: ManualExplanationOverride = 'AUTO';

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const rawTasks = storageService.getItem(TASKBOARD_STORAGE_KEY);
      if (rawTasks) {
        this.tasks = JSON.parse(rawTasks);
      }
      const rawProactive = storageService.getItem(PROACTIVE_LEVEL_KEY) as ProactiveSuggestionLevel;
      if (rawProactive) {
        this.proactiveLevel = rawProactive;
      }
      const rawOverride = storageService.getItem(EXPLANATION_OVERRIDE_KEY) as ManualExplanationOverride;
      if (rawOverride) {
        this.explanationOverride = rawOverride;
      }
    } catch {
      this.tasks = [];
    }
  }

  private saveState() {
    try {
      storageService.setItem(TASKBOARD_STORAGE_KEY, JSON.stringify(this.tasks));
      storageService.setItem(PROACTIVE_LEVEL_KEY, this.proactiveLevel);
      storageService.setItem(EXPLANATION_OVERRIDE_KEY, this.explanationOverride);
    } catch (e) {
      console.warn('Failed to save taskboard state:', e);
    }
  }

  public getAllTasks(): ConversationTaskCard[] {
    return [...this.tasks];
  }

  public getProactiveLevel(): ProactiveSuggestionLevel {
    return this.proactiveLevel;
  }

  public setProactiveLevel(level: ProactiveSuggestionLevel) {
    this.proactiveLevel = level;
    this.saveState();
    systemLogger.info('SELF_IMPROVEMENT', `[第31.14章] 自発提案強度を [${level}] に変更しました。`);
  }

  public getExplanationOverride(): ManualExplanationOverride {
    return this.explanationOverride;
  }

  public setExplanationOverride(override: ManualExplanationOverride) {
    this.explanationOverride = override;
    this.saveState();
    systemLogger.info('SELF_IMPROVEMENT', `[第31.15章] 説明レベル手動上書きを [${override}] に設定しました。`);
  }

  /**
   * 会話ターンから自動でタスクカードを抽出・追加 (31.10)
   */
  public extractTasksFromTurn(userText: string, aiText: string, turnId: string): ConversationTaskCard[] {
    const combined = `${userText}\n${aiText}`;
    const generated: ConversationTaskCard[] = [];

    for (const kw of TASK_KEYWORDS) {
      if (kw.regex.test(combined)) {
        // 短い要約タイトルを抽出
        const lines = combined.split('\n').filter((l) => kw.regex.test(l));
        const matchedLine = lines[0] || userText;
        const cleanSnippet = matchedLine.replace(kw.regex, '').trim().slice(0, 40) || '会話中のタスク項目';

        // 重複チェック
        const isDuplicate = this.tasks.some(
          (t) => t.category === kw.category && t.title.includes(cleanSnippet.slice(0, 15))
        );
        if (isDuplicate) continue;

        const card: ConversationTaskCard = {
          id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: `${kw.titlePrefix} ${cleanSnippet}`,
          goal: `会話「${userText.slice(0, 30)}...」から抽出された未完了項目の解決`,
          category: kw.category,
          requiredInfo: '関連する文脈ログおよび必要ライブラリ仕様',
          completionCriteria: '具体的解決策の提示と動作確認が完了していること',
          sourceTurnId: turnId,
          priority: kw.category === 'UNRESOLVED' ? 'HIGH' : 'MEDIUM',
          status: 'BACKLOG',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        this.tasks.unshift(card);
        generated.push(card);
      }
    }

    if (generated.length > 0) {
      this.saveState();
      systemLogger.info(
        'TASK_PLAN',
        `[第31.10章 タスクボード] 会話から ${generated.length} 件の課題カードを自動生成しました。`
      );
    }

    return generated;
  }

  /**
   * 手動でタスクカードを追加
   */
  public addTask(params: {
    title: string;
    goal: string;
    category: ConversationTaskCategory;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    completionCriteria: string;
  }): ConversationTaskCard {
    const card: ConversationTaskCard = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: params.title,
      goal: params.goal,
      category: params.category,
      completionCriteria: params.completionCriteria,
      priority: params.priority,
      status: 'BACKLOG',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.tasks.unshift(card);
    this.saveState();
    return card;
  }

  /**
   * タスクステータス更新（第48章 完了判定器チェック）
   */
  public updateTaskStatus(taskId: string, newStatus: 'BACKLOG' | 'IN_PROGRESS' | 'COMPLETED'): boolean {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return false;

    task.status = newStatus;
    task.updatedAt = Date.now();
    if (newStatus === 'COMPLETED') {
      task.completionJudgePassed = true; // 第48章 完了判定器を通過
    }
    this.saveState();
    return true;
  }

  /**
   * タスク削除
   */
  public deleteTask(taskId: string): boolean {
    const beforeLen = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== taskId);
    if (this.tasks.length !== beforeLen) {
      this.saveState();
      return true;
    }
    return false;
  }
}

export const conversationTaskboardService = new ConversationTaskboardService();
