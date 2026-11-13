import { storageService } from '../../../services/storageService';

/**
 * P846: 保留枠組み（1回限りの控え）の共通土台。
 *
 * 「さっきの操作の結果を、次の発話で一度だけ受ける」ための控えが
 * 各所にバラバラに増え、保存形（生のJSON）も賞味期限の書き方も
 * バラバラだった。ここでは封筒 { v, at, ttl } に統一し、
 * 置く・覗く（期限切れは無効）・消費する（読んで消す）だけを
 * 提供する。保存キーは従来のものをそのまま使う（スナップ
 * ショットの有無チェック等はキー名で見るため）。
 */

interface Envelope<T> {
  v: T;
  at: number;
  ttl: number;
}

class PendingSlotService {
  public set<T>(key: string, value: T, ttlMs: number, now = Date.now()): void {
    try {
      const env: Envelope<T> = { v: value, at: now, ttl: ttlMs };
      storageService.setItem(key, JSON.stringify(env));
    } catch { /* 控えは補助経路 */ }
  }

  private read<T>(key: string, now: number): T | undefined {
    try {
      const raw = storageService.getItem(key);
      if (!raw) return undefined;
      const env = JSON.parse(raw) as Envelope<T>;
      if (!env || typeof env.at !== 'number' || typeof env.ttl !== 'number' || !('v' in env)) return undefined;
      if (now - env.at > env.ttl) {
        try { storageService.removeItem(key); } catch { /* ついで掃除 */ }
        return undefined;
      }
      return env.v;
    } catch { return undefined; }
  }

  /** 期限内なら中身を返す（消さない）。 */
  public peek<T>(key: string, now = Date.now()): T | undefined {
    return this.read<T>(key, now);
  }

  /** 期限内なら中身を返して消す（1回限りの受け取り）。 */
  public consume<T>(key: string, now = Date.now()): T | undefined {
    const value = this.read<T>(key, now);
    if (value !== undefined) {
      try { storageService.removeItem(key); } catch { /* 消えなくても期限で無効になる */ }
    }
    return value;
  }

  public clear(key: string): void {
    try { storageService.removeItem(key); } catch { /* 補助経路 */ }
  }
}

export const pendingSlotService = new PendingSlotService();
