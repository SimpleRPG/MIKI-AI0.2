import { storageService } from '../../../services/storageService';

/**
 * P544: 相手の知識モデル（心の読みの最小形）。推測はせず、観測
 * できる信号だけで「相手が知っている言葉／知らない言葉」を分ける:
 *   - 「Xって何？」と聞いた → 知らない側
 *   - 「Xって〜のことだよ」と教えた → 知っている側
 *   - 知らない側だった語を、質問でなく普通の文で使った →
 *     知っている側へ移す（覚えたか、もともと知っていた）
 * 消費先: 彼女の答えに知らない側の語が出てきたら、辞書の短い
 * 説明を括弧で添える（conversationCoreService）。新しい信号が
 * 常に勝つ（聞いた後で教えたら知っている側、など）。
 */

interface UserKnowledgeState {
  known: Record<string, number>;
  unknown: Record<string, number>;
}

const STORAGE_KEY = 'miki_user_knowledge_v1';
const MAX_TERMS = 100;

class UserKnowledgeProfileService {
  private state: UserKnowledgeState | null = null;

  private load(): UserKnowledgeState {
    if (this.state) return this.state;
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as UserKnowledgeState) : null;
      this.state = parsed && typeof parsed === 'object' && parsed.known && parsed.unknown
        ? parsed
        : { known: {}, unknown: {} };
    } catch {
      this.state = { known: {}, unknown: {} };
    }
    return this.state;
  }

  private save(): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch { /* 保持は補助経路 */ }
  }

  private prune(record: Record<string, number>): void {
    const keys = Object.keys(record);
    if (keys.length <= MAX_TERMS) return;
    keys.sort((a, b) => (record[a] || 0) - (record[b] || 0));
    for (const key of keys.slice(0, keys.length - MAX_TERMS)) delete record[key];
  }

  public markKnown(term: string): void {
    const clean = String(term || '').trim();
    if (!clean) return;
    const state = this.load();
    state.known[clean] = Date.now();
    delete state.unknown[clean];
    this.prune(state.known);
    this.save();
  }

  public markUnknown(term: string): void {
    const clean = String(term || '').trim();
    if (!clean) return;
    const state = this.load();
    state.unknown[clean] = Date.now();
    delete state.known[clean];
    this.prune(state.unknown);
    this.save();
  }

  public isUnknown(term: string): boolean {
    return Boolean(this.load().unknown[String(term || '').trim()]);
  }

  public isKnown(term: string): boolean {
    return Boolean(this.load().known[String(term || '').trim()]);
  }

  /** 知らない側の語を、新しい順に返す。 */
  public listUnknown(): string[] {
    const unknown = this.load().unknown;
    return Object.keys(unknown).sort((a, b) => (unknown[b] || 0) - (unknown[a] || 0));
  }

  public listKnown(): string[] {
    const known = this.load().known;
    return Object.keys(known).sort((a, b) => (known[b] || 0) - (known[a] || 0));
  }
}

export const userKnowledgeProfileService = new UserKnowledgeProfileService();
