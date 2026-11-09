import { storageService } from '../../../services/storageService';

/**
 * P522: 開いた話題の保持。
 *
 * 会話の主題はターンの状態変数にしか残らず、アプリを開き直したり
 * 日をまたいだりすると「前に話していた件」を彼女からは拾えな
 * かった。ここでは最後に開いた話題と、その日付だけを小さく保持し、
 * 別の日の挨拶のときに一度だけ「その後どうなりました？」と
 * 拾えるようにする。
 *
 * P553: 保持を1件から最大3件のリストにした。話題は1つとは限らず、
 * 1件だけだと新しい話題が前の話題を常に消してしまった。拾うときは
 * 重要度の高い順。14日より古い話題は静かに捨てる。保存形式は配列に
 * なるが、旧形式（単一オブジェクト）もそのまま読める。
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

  private load(): OpenTopicRecord[] {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      const list = (Array.isArray(parsed) ? parsed : [parsed]) as OpenTopicRecord[];
      const cutoff = dayKey(Date.now() - 14 * 24 * 3600_000);
      return list.filter((r) => r && typeof r.topic === 'string' && typeof r.openedDay === 'string' && r.openedDay >= cutoff);
    } catch {
      return [];
    }
  }

  private save(records: OpenTopicRecord[]): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(records.slice(-3)));
    } catch { /* 保持は補助経路 */ }
  }

  /**
   * P543: 重要度の目安を発話から見積もる。「覚えて」だけを合言葉に
   * せず、感情の強さ・訂正・教えの材料と合算する（1〜5）。
   */
  public salienceOf(text: string): number {
    const t = String(text || '');
    let score = 1;
    if (/覚えて|覚えといて|メモして|忘れないで|大事|重要/.test(t)) score += 2;
    if (/大好き|嬉しい|最高|つらい|悲しい|大変|ショック|びっくり|心配|不安/.test(t)) score += 1;
    if (/じゃなくて|ではなく|正しくは|訂正/.test(t)) score += 1;
    return Math.min(5, score);
  }

  /**
   * 今の話題を開いた話題として記録する。同じ話題は開いた日を保ち、
   * 重要度は高い方を残す（P543）。保持は最大3件で、溢れるときは
   * 重要度が低く古いものから外す（P553）。
   */
  public record(topic?: string, salience = 1): void {
    const clean = String(topic || '').trim();
    if (!clean || clean.length > 24) return;
    const weight = Math.max(1, Math.min(5, Math.round(salience) || 1));
    const records = this.load();
    const existing = records.find((r) => r.topic === clean);
    if (existing) {
      existing.weight = Math.max(existing.weight || 1, weight);
      this.save(records);
      return;
    }
    records.push({ topic: clean, openedDay: dayKey(Date.now()), weight });
    records.sort((a, b) => (a.weight || 1) - (b.weight || 1) || a.openedDay.localeCompare(b.openedDay));
    this.save(records.slice(-3));
  }

  /** 保持している話題の一覧（テスト・状態書き出し用）。 */
  public listPending(): OpenTopicRecord[] {
    return this.load();
  }

  /** 代表の話題（重要度が最も高く、同点なら新しいもの）。 */
  public current(): OpenTopicRecord | null {
    const records = this.load();
    if (records.length === 0) return null;
    return [...records].sort((a, b) => (b.weight || 1) - (a.weight || 1) || b.openedDay.localeCompare(a.openedDay))[0];
  }

  /**
   * 前の日以前に開いた話題を、重要度の高い順に1つ返す
   * （返した話題は保持から外す）。
   */
  public takeCallbackTopic(): string | undefined {
    const records = this.load();
    const today = dayKey(Date.now());
    const eligible = records
      .filter((r) => r.openedDay < today && r.consumedDay !== today)
      .sort((a, b) => (b.weight || 1) - (a.weight || 1) || a.openedDay.localeCompare(b.openedDay));
    const picked = eligible[0];
    if (!picked) return undefined;
    this.save(records.filter((r) => r !== picked));
    return picked.topic;
  }
}

export const conversationOpenTopicService = ConversationOpenTopicService.getInstance();
