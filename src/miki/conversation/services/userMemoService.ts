import { storageService } from '../../../services/storageService';
import { dayKeyOf } from '../../memory/services/dayKeyService';

/**
 * P699: 「覚えておいて」と頼まれた内容を、そのままの文で覚える
 * メモ。事実の取り込み（属性つきの記録）とは別に、頼まれた文を
 * 残して「何があるんだっけ？」で読み返すための置き場。
 * 忘れてと言われたら消す——覚えることと忘れることは対の操作。
 */

const KEY = 'miki_user_memos_v1';
const MAX_ITEMS = 20;

export interface UserMemo {
  text: string;
  at: number;
  day: string;
}

class UserMemoService {
  private static instance: UserMemoService;
  public static getInstance(): UserMemoService {
    if (!UserMemoService.instance) {
      UserMemoService.instance = new UserMemoService();
    }
    return UserMemoService.instance;
  }

  private load(): UserMemo[] {
    try {
      const raw = storageService.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as UserMemo[];
      return Array.isArray(parsed) ? parsed.filter((m) => m && typeof m.text === 'string') : [];
    } catch { return []; }
  }

  private save(items: UserMemo[]): void {
    try {
      storageService.setItem(KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
    } catch { /* 保存できなくても会話は続ける */ }
  }

  /** 頼まれた内容を覚える。同じ内容は重ねない。 */
  public add(text: string): UserMemo | undefined {
    const clean = String(text || '').trim();
    if (!clean) return undefined;
    const items = this.load();
    if (items.some((m) => m.text === clean)) return items.find((m) => m.text === clean);
    const memo: UserMemo = { text: clean, at: Date.now(), day: dayKeyOf(Date.now()) };
    items.push(memo);
    this.save(items);
    return memo;
  }

  public list(): UserMemo[] {
    return this.load();
  }

  public count(): number {
    return this.load().length;
  }

  /** 忘れる。消した件数を返す。 */
  public clear(): number {
    const n = this.load().length;
    this.save([]);
    return n;
  }

  /** P818: 直近のメモを1件だけ消す。消したメモを返す。 */
  public removeLast(): UserMemo | undefined {
    const items = this.load();
    const last = items.pop();
    if (last) this.save(items);
    return last;
  }

  /** P780: 指定の語を含むメモだけを消す。消したメモを返す。 */
  public removeMatching(words: string[]): UserMemo[] {
    const items = this.load();
    const removed = items.filter((m) => words.some((w) => w && m.text.includes(w)));
    if (removed.length > 0) {
      this.save(items.filter((m) => !removed.includes(m)));
    }
    return removed;
  }
}

export const userMemoService = UserMemoService.getInstance();
