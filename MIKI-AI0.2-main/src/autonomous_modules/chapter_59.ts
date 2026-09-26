/**
 * 第59章 形式知識・制約ソルバー連携キャッシュ。
 * 制約判定そのものは verification/formalConstraintSolverService が担当し、
 * このモジュールは検証結果を期限・容量付きで保持する。
 */

export interface FormalKnowledgeCacheOptions {
  enabled?: boolean;
  maxCapacity?: number;
  timeoutMs?: number;
}

export interface FormalKnowledgeCacheResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

interface CacheEntry {
  payload: unknown;
  storedAt: number;
  expiresAt: number;
}

export class FormalKnowledgeCache {
  private readonly options: Required<FormalKnowledgeCacheOptions>;
  private readonly state = new Map<string, CacheEntry>();

  constructor(options: FormalKnowledgeCacheOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      maxCapacity: Math.max(1, options.maxCapacity ?? 100),
      timeoutMs: Math.max(1, options.timeoutMs ?? 5000),
    };
  }

  public execute<T = unknown>(key: string, payload: T): FormalKnowledgeCacheResult<T> {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return { success: false, error: 'CACHE_KEY_REQUIRED', timestamp: Date.now() };
    }
    if (!this.options.enabled) {
      return { success: false, error: 'CACHE_DISABLED', timestamp: Date.now() };
    }

    const now = Date.now();
    this.removeExpired(now);
    while (this.state.size >= this.options.maxCapacity) {
      const oldestKey = this.state.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      this.state.delete(oldestKey);
    }

    this.state.set(normalizedKey, {
      payload,
      storedAt: now,
      expiresAt: now + this.options.timeoutMs,
    });
    return { success: true, data: payload, timestamp: now };
  }

  public get<T = unknown>(key: string): T | null {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return null;
    }
    const now = Date.now();
    const entry = this.state.get(normalizedKey);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= now) {
      this.state.delete(normalizedKey);
      return null;
    }
    return entry.payload as T;
  }

  public clear(): void {
    this.state.clear();
  }

  public getDiagnostics(): {
    activeEntries: number;
    maxCapacity: number;
    timeoutMs: number;
    healthy: boolean;
  } {
    this.removeExpired(Date.now());
    return {
      activeEntries: this.state.size,
      maxCapacity: this.options.maxCapacity,
      timeoutMs: this.options.timeoutMs,
      healthy: this.options.enabled,
    };
  }

  private removeExpired(now: number): void {
    for (const [key, entry] of this.state.entries()) {
      if (entry.expiresAt <= now) {
        this.state.delete(key);
      }
    }
  }
}

export const formalKnowledgeCache = new FormalKnowledgeCache();
export const module59typescript = formalKnowledgeCache;
