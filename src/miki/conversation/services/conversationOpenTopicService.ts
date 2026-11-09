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

  /** 今の話題を開いた話題として記録する。同じ話題は開いた日を保つ。 */
  public record(topic?: string): void {
    const clean = String(topic || '').trim();
    if (!clean || clean.length > 24) return;
    const current = this.load();
    if (current && current.topic === clean) return;
    this.save({ topic: clean, openedDay: dayKey(Date.now()) });
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
