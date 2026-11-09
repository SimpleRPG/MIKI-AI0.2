import { storageService } from '../../../services/storageService';

/**
 * P522: 開いた話題の保持。
 *
 * 会話の主題はターンの状態変数にしか残らず、アプリを開き直したり
 * 日をまたいだりすると「前に話していた件」を彼女からは拾えな
 * かった。ここでは最後に開いた話題と、その日付だけを小さく保持し、
 * 別の日の挨拶のときに一度だけ「その後どうなりました？」と
 * 拾えるようにする。
 */

interface OpenTopicRecord {
  topic: string;
  openedDay: string;
  consumedDay?: string;
  /** P543: 重要度（1〜5）。大事な話題は軽い話題に上書きされにくくする。 */
  weight?: number;
}

const STORAGE_KEY = 'miki_open_topics_v1';

const dayKey = (ts: number): string => {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

export class ConversationOpenTopicService {
  private static instance: ConversationOpenTopicService;

  private constructor() {}

  public static getInstance(): ConversationOpenTopicService {
    if (!ConversationOpenTopicService.instance) {
      ConversationOpenTopicService.instance = new ConversationOpenTopicService();
    }
    return ConversationOpenTopicService.instance;
  }

  private load(): OpenTopicRecord | null {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as OpenTopicRecord;
      return parsed && typeof parsed.topic === 'string' ? parsed : null;
    } catch {
      return null;
    }
  }

  private save(record: OpenTopicRecord): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch { /* 保持は補助経路 */ }
  }

  /**
   * P543: 重要度の目安を発話から見積もる。「覚えて」だけを合言葉に
   * せず、感情の強さ・訂正・教えの材料と合算する（1〜5）。
   */
  public salienceOf(text: string): number {
    const t = String(text || '');
    let score = 1;
    if (/覚えて|忘れないで|大事|重要/.test(t)) score += 2;
    if (/大好き|嬉しい|最高|つらい|悲しい|大変|ショック|びっくり|心配|不安/.test(t)) score += 1;
    if (/じゃなくて|ではなく|正しくは|訂正/.test(t)) score += 1;
    return Math.min(5, score);
  }

  /**
   * 今の話題を開いた話題として記録する。同じ話題は開いた日を保ち、
   * 重要度は高い方を残す。別の話題が来たら、未消費で重要度が高い
   * 既存の話題は軽い話題に上書きされない（P543）。
   */
  public record(topic?: string, salience = 1): void {
    const clean = String(topic || '').trim();
    if (!clean || clean.length > 24) return;
    const weight = Math.max(1, Math.min(5, Math.round(salience) || 1));
    const current = this.load();
    if (current && current.topic === clean) {
      const merged = Math.max(current.weight || 1, weight);
      if (merged !== (current.weight || 1)) this.save({ ...current, weight: merged });
      return;
    }
    if (current && !current.consumedDay && weight < (current.weight || 1)) return;
    this.save({ topic: clean, openedDay: dayKey(Date.now()), weight });
  }

  /** 現在保持している話題（テスト・自己照会用）。 */
  public current(): OpenTopicRecord | null {
    return this.load();
  }

  /**
   * 前の日以前に開いた話題を、今日まだ拾っていなければ返す
   * （返した時点で今日分は消費済みにする）。
   */
  public takeCallbackTopic(): string | undefined {
    const record = this.load();
    if (!record) return undefined;
    const today = dayKey(Date.now());
    if (record.openedDay >= today) return undefined;
    if (record.consumedDay === today) return undefined;
    record.consumedDay = today;
    this.save(record);
    return record.topic;
  }
}

export const conversationOpenTopicService = ConversationOpenTopicService.getInstance();
