import { storageService } from '../../../services/storageService';

/**
 * P930: 間違い帳。
 *
 * 彼女が「間違っていたこと」を消さずに残す台帳。訂正された事実
 * （誤り→正しさ）、予測の外れ、検証の失敗を1か所に集め、
 * 同じ誤りが繰り返された回数を数える。間違いを消すのではなく
 * 「何を・どう間違えたか」を見返せることが、同じ間違いを
 * 繰り返さないための土台になる。
 */

export type MistakeKind = 'CORRECTION' | 'PREDICTION' | 'VERIFICATION';

export interface MistakeEntry {
  id: string;
  at: number;
  kind: MistakeKind;
  /** 何について間違えたか */
  subject: string;
  /** 間違っていた内容 */
  wrong: string;
  /** 正しかった内容（分かっている場合） */
  right: string;
  occurrences: number;
  lastAt: number;
  resolved: boolean;
}

const KEY = 'miki_mistake_notebook_v1';
const MAX_ENTRIES = 200;

class MistakeNotebookService {
  private load(): MistakeEntry[] {
    try {
      const raw = storageService.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as MistakeEntry[];
      }
    } catch { /* fall through */ }
    return [];
  }

  private save(entries: MistakeEntry[]): void {
    try {
      storageService.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
    } catch { /* 保存できなくても本流は止めない */ }
  }

  private record(kind: MistakeKind, subject: string, wrong: string, right: string): MistakeEntry {
    const entries = this.load();
    const normalizedWrong = wrong.trim();
    const existing = entries.find((e) => e.kind === kind && e.wrong === normalizedWrong && !e.resolved);
    const now = Date.now();
    if (existing) {
      existing.occurrences += 1;
      existing.lastAt = now;
      if (right) existing.right = right;
      this.save(entries);
      return existing;
    }
    const entry: MistakeEntry = {
      id: `mistake-${now}-${entries.length}`,
      at: now,
      kind,
      subject: subject.trim(),
      wrong: normalizedWrong,
      right: right.trim(),
      occurrences: 1,
      lastAt: now,
      resolved: false,
    };
    entries.push(entry);
    this.save(entries);
    return entry;
  }

  /** 利用者の訂正（「XじゃなくてY」）を記録する。 */
  public recordCorrection(wrong: string, right: string): MistakeEntry | null {
    if (!wrong || !right || wrong === right) return null;
    return this.record('CORRECTION', wrong, wrong, right);
  }

  /** 予測が外れたことを記録する。 */
  public recordPrediction(subject: string, detail: string): MistakeEntry {
    return this.record('PREDICTION', subject, detail, '');
  }

  /** 検証で落ちたことを記録する。 */
  public recordVerification(subject: string, detail: string): MistakeEntry {
    return this.record('VERIFICATION', subject, detail, '');
  }

  public markResolved(id: string): boolean {
    const entries = this.load();
    const entry = entries.find((e) => e.id === id);
    if (!entry) return false;
    entry.resolved = true;
    this.save(entries);
    return true;
  }

  public list(limit = 20): MistakeEntry[] {
    return [...this.load()]
      .sort((a, b) => b.lastAt - a.lastAt)
      .slice(0, limit);
  }

  public summary(): { total: number; open: number; recurring: number } {
    const entries = this.load();
    return {
      total: entries.length,
      open: entries.filter((e) => !e.resolved).length,
      recurring: entries.filter((e) => e.occurrences >= 2).length,
    };
  }
}

export const mistakeNotebookService = new MistakeNotebookService();
