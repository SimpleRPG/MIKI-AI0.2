/**
 * 設計思想 第31章 31.2: 会話分岐・巻き戻し (Conversation Branching & Rollback)
 * 
 * 【目的】
 * 会話の任意ターンから別案を試せるブランチ機能。
 * - 現在の会話を壊さず別仮説・別設計案を並列比較
 * - 誤った前提を採用する前の状態へ安全に巻き戻し
 * - 採用した分岐のみを本線へ統合マージ
 */

import { ConversationBranch, Message } from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const BRANCH_STORAGE_KEY = 'miki_conversation_branches_v1';
const ACTIVE_BRANCH_ID_KEY = 'miki_active_branch_id_v1';

export class ConversationBranchService {
  private branches: ConversationBranch[] = [];
  private activeBranchId: string = 'branch_main';

  constructor() {
    this.loadBranches();
  }

  private loadBranches() {
    try {
      const raw = storageService.getItem(BRANCH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.branches = parsed;
        }
      }
      const active = storageService.getItem(ACTIVE_BRANCH_ID_KEY);
      if (active) {
        this.activeBranchId = active;
      }
    } catch {
      this.branches = [];
    }

    if (this.branches.length === 0) {
      this.branches = [
        {
          id: 'branch_main',
          name: '本線 (Main)',
          forkMessageId: 'root',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
          isCurrent: true,
          hypothesisNote: 'メインの対話フロー',
        },
      ];
      this.activeBranchId = 'branch_main';
      this.saveBranches();
    }
  }

  private saveBranches() {
    try {
      storageService.setItem(BRANCH_STORAGE_KEY, JSON.stringify(this.branches));
      storageService.setItem(ACTIVE_BRANCH_ID_KEY, this.activeBranchId);
    } catch (e) {
      console.warn('Failed to save branches:', e);
    }
  }

  public getAllBranches(): ConversationBranch[] {
    return [...this.branches];
  }

  public getActiveBranchId(): string {
    return this.activeBranchId;
  }

  public getActiveBranch(): ConversationBranch {
    const found = this.branches.find((b) => b.id === this.activeBranchId);
    return found || this.branches[0];
  }

  /**
   * 指定メッセージ地点から新しい仮説ブランチを作成 (31.2)
   */
  public forkBranch(
    parentBranchId: string,
    forkMessageId: string,
    messagesSnapshot: Message[],
    branchName?: string,
    hypothesisNote?: string
  ): ConversationBranch {
    // forkMessageId までのメッセージを抽出
    let forkedMessages: Message[] = [];
    const targetIdx = messagesSnapshot.findIndex((m) => m.id === forkMessageId);
    if (targetIdx >= 0) {
      forkedMessages = messagesSnapshot.slice(0, targetIdx + 1);
    } else {
      forkedMessages = [...messagesSnapshot];
    }

    const timestamp = Date.now();
    const newBranchId = `branch_${timestamp}_${Math.random().toString(36).slice(2, 6)}`;
    const name = branchName || `仮説ブランチ #${this.branches.length + 1}`;

    const newBranch: ConversationBranch = {
      id: newBranchId,
      name,
      parentBranchId,
      forkMessageId,
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: forkedMessages,
      isCurrent: true,
      hypothesisNote,
    };

    // 既存ブランチのisCurrentを解除
    this.branches.forEach((b) => (b.isCurrent = false));
    this.branches.push(newBranch);
    this.activeBranchId = newBranchId;

    this.saveBranches();

    systemLogger.info(
      'CHAT',
      `[第31.2章 会話分岐] メッセージ [${forkMessageId}] から新ブランチ「${name}」を作成しました。`
    );

    return newBranch;
  }

  /**
   * 別のブランチへ切り替え
   */
  public switchBranch(branchId: string): ConversationBranch | null {
    const target = this.branches.find((b) => b.id === branchId);
    if (!target) return null;

    this.branches.forEach((b) => {
      b.isCurrent = b.id === branchId;
    });
    this.activeBranchId = branchId;
    this.saveBranches();

    systemLogger.info('CHAT', `[第31.2章 会話切り替え] ブランチ「${target.name}」へコンテキストを切り替えました。`);
    return target;
  }

  /**
   * 現在のアクティブブランチのメッセージを同期保存
   */
  public syncCurrentBranchMessages(messages: Message[]) {
    const active = this.getActiveBranch();
    active.messages = messages;
    active.updatedAt = Date.now();
    this.saveBranches();
  }

  /**
   * サブブランチの成果を本線(Main)へ統合マージ (31.2)
   */
  public mergeIntoMain(sourceBranchId: string): { success: boolean; messageCount: number } {
    const source = this.branches.find((b) => b.id === sourceBranchId);
    const main = this.branches.find((b) => b.id === 'branch_main');

    if (!source || !main) return { success: false, messageCount: 0 };

    main.messages = [...source.messages];
    main.updatedAt = Date.now();
    this.switchBranch('branch_main');

    systemLogger.info(
      'CHAT',
      `[第31.2章 ブランチ統合] ブランチ「${source.name}」の内容を本線(Main)へマージしました (${main.messages.length} 件)。`
    );

    return { success: true, messageCount: main.messages.length };
  }

  /**
   * 不要になったブランチの削除（Mainは保護）
   */
  public deleteBranch(branchId: string): boolean {
    if (branchId === 'branch_main') return false;
    this.branches = this.branches.filter((b) => b.id !== branchId);
    if (this.activeBranchId === branchId) {
      this.switchBranch('branch_main');
    } else {
      this.saveBranches();
    }
    return true;
  }
}

export const conversationBranchService = new ConversationBranchService();
