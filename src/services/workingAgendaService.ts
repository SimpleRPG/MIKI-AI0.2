import { WorkingAgendaItem } from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const STORAGE_KEY = 'miki_working_agenda_items';

/**
 * 設計思想 Master v5.0 第2章: 全8層記憶階層構造
 * ③ 中期記憶 (Working Agenda) 管理サービス
 * 
 * 進行中の話題、未解決事項、直近の決定事項を独立して保持。
 * エピソード記憶との混在を解消し、自発思考モード（第9章）への優先宿題供給源として機能する。
 */
class WorkingAgendaService {
  private items: WorkingAgendaItem[] = [];
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
        if (Array.isArray(parsed)) {
          this.items = parsed;
        }
      }
      this.isLoaded = true;
    } catch (e: any) {
      systemLogger.warn('PERSISTENCE', 'WorkingAgendaService: failed to load agenda items', e);
      this.items = [];
    }
  }

  private save(): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch (e: any) {
      systemLogger.error('PERSISTENCE', 'WorkingAgendaService: failed to save agenda items', e);
    }
  }

  public getItems(): WorkingAgendaItem[] {
    this.load();
    return [...this.items];
  }

  public getActiveAgendas(): WorkingAgendaItem[] {
    this.load();
    return this.items.filter((item) => item.status === 'in_progress' || item.status === 'pending_decision');
  }

  /**
   * 自発思考モード (第9章) 用に未解決の宿題課題を抽出
   */
  public getHomeworkForAutonomousThought(): WorkingAgendaItem[] {
    this.load();
    return this.items.filter(
      (item) =>
        (item.status === 'in_progress' || item.status === 'pending_decision') &&
        (item.unresolvedQuestions.length > 0 || item.assignedToAutonomousThought)
    );
  }

  public addOrUpdateAgenda(
    topic: string,
    unresolvedQuestions: string[] = [],
    recentDecisions: string[] = [],
    turnNumber: number = 0,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): WorkingAgendaItem {
    this.load();
    const existing = this.items.find(
      (it) => it.topic.toLowerCase() === topic.toLowerCase() && it.status !== 'resolved' && it.status !== 'abandoned'
    );

    const now = Date.now();
    if (existing) {
      existing.unresolvedQuestions = Array.from(
        new Set([...existing.unresolvedQuestions, ...unresolvedQuestions])
      );
      existing.recentDecisions = Array.from(
        new Set([...existing.recentDecisions, ...recentDecisions])
      );
      existing.lastActiveTurn = turnNumber;
      existing.priority = priority;
      existing.updatedAt = now;
      this.save();
      return existing;
    }

    const newItem: WorkingAgendaItem = {
      id: `agenda_${now}_${Math.random().toString(36).substring(2, 7)}`,
      topic,
      status: 'in_progress',
      unresolvedQuestions,
      recentDecisions,
      lastActiveTurn: turnNumber,
      priority,
      assignedToAutonomousThought: unresolvedQuestions.length > 0,
      createdAt: now,
      updatedAt: now,
    };

    this.items.unshift(newItem);
    this.save();
    return newItem;
  }

  /**
   * ターン終了時にユーザーとアシスタントの対話からアジェンダ・決定事項を自動解析して登録
   */
  public recordTurnAgenda(userText: string, assistantText: string, turnNumber: number = 0): WorkingAgendaItem | null {
    const combined = `${userText} ${assistantText}`;
    // 疑問文や保留表現の検出
    const unresolved: string[] = [];
    const questions = userText.match(/[^。！？\n]+(?:ですか|どうする|どうすれば|どうでしょうか|教えて|課題|未解決|？|\?)/g);
    if (questions) {
      unresolved.push(...questions.slice(0, 2).map((q) => q.trim()));
    }

    // 決定事項表現の検出
    const decisions: string[] = [];
    const agreed = assistantText.match(/[^。！？\n]+(?:決定|しました|方針|実装完了|解決|合意)/g);
    if (agreed) {
      decisions.push(...agreed.slice(0, 2).map((d) => d.trim()));
    }

    if (unresolved.length === 0 && decisions.length === 0 && userText.length < 15) {
      return null;
    }

    const topic = userText.slice(0, 28).replace(/[\n\r]/g, ' ') + (userText.length > 28 ? '...' : '');
    const priority = combined.includes('急ぎ') || combined.includes('エラー') || combined.includes('不具合') ? 'high' : 'normal';

    return this.addOrUpdateAgenda(topic, unresolved, decisions, turnNumber, priority);
  }

  public resolveAgenda(id: string, resolutionNote?: string): boolean {
    this.load();
    const target = this.items.find((it) => it.id === id);
    if (!target) return false;

    target.status = 'resolved';
    target.updatedAt = Date.now();
    if (resolutionNote) {
      target.recentDecisions.push(`解決: ${resolutionNote}`);
    }
    this.save();
    return true;
  }

  public deleteAgenda(id: string): boolean {
    this.load();
    const initialLen = this.items.length;
    this.items = this.items.filter((it) => it.id !== id);
    if (this.items.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  /**
   * プロンプト用に進行中アジェンダを要約ブロックとして出力
   */
  public formatAgendaForPrompt(): string {
    const actives = this.getActiveAgendas();
    if (actives.length === 0) return '';

    const lines: string[] = ['【進行中の話題・未解決事項 (中期記憶: Working Agenda)】:'];
    for (const a of actives.slice(0, 3)) {
      lines.push(`・[課題: ${a.topic}] (優先度: ${a.priority})`);
      if (a.unresolvedQuestions.length > 0) {
        lines.push(`  - 未解決の問い: ${a.unresolvedQuestions.slice(0, 2).join(' / ')}`);
      }
      if (a.recentDecisions.length > 0) {
        lines.push(`  - 直近の合意: ${a.recentDecisions.slice(-2).join(' / ')}`);
      }
    }
    return lines.join('\n');
  }
}

export const workingAgendaService = new WorkingAgendaService();
