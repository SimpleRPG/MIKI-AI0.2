import { Capacitor } from '@capacitor/core';
import type { MemoryItem, MemoryType } from '../types';

/**
 * Synchronous-facade persistent storage, backed by:
 *  - Android/iOS (native): real SQLite via @capacitor-community/sqlite — no
 *    practical size ceiling (bounded only by device free space), unlike
 *    localStorage's ~5-10MB per-origin cap baked into the WebView. This is
 *    the "SQLite/Room的な構造" the design doc calls for.
 *  - Browser / web preview build: IndexedDB, whose quota Chromium sizes
 *    against actual free disk space rather than an arbitrary small constant.
 *  - Last-resort fallback (neither available): in-memory only. Data is not
 *    lost mid-session but will not survive a restart. This should not
 *    normally be hit on a real device or browser.
 *
 * The rest of the app was written against localStorage's *synchronous*
 * getItem/setItem API across call sites. Rather than making every one of
 * those call sites async (a large, risky rewrite touching React state
 * initializers, constructors, etc.), this service hydrates an in-memory
 * cache from the real backend once at startup (await `storageService.ready`
 * before rendering — see main.tsx), then serves every read/write
 * synchronously from that cache, mirroring localStorage's API. Writes are
 * mirrored to the real backend in the background (debounced ~400ms), so
 * nothing is lost on restart, but nothing is capped either.
 *
 * Any pre-existing localStorage data (from before this migration) is copied
 * in automatically, once, on first run.
 *
 * In addition to the generic key-value store, it supports 7-tier structured
 * memory persistence (raw, structural, semantic, episodic, procedural, meta, working)
 * with approved state, source reference, and metadata.
 */
class StorageService {
  private cache = new Map<string, string>();
  private dirtyKeys = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private backend: 'sqlite' | 'indexeddb' | 'memory' = 'memory';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sqlite: any = null; // SQLiteDBConnection (native only, loaded dynamically)
  private idb: IDBDatabase | null = null;
  private readonly STORE = 'kv_store';
  private readonly MEMORIES_STORE = 'memories_store';
  private readonly DB_NAME = 'mikiai_kv';

  /** Resolves once the persistent backend has been hydrated into the cache. */
  public readonly ready: Promise<void>;

  constructor() {
    this.ready = this.init().catch((e) => {
      console.warn('storageService: init failed, continuing with in-memory storage only', e);
      this.backend = 'memory';
    });
  }

  private async init(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await this.initSqlite();
        this.backend = 'sqlite';
      } catch (e) {
        console.warn('storageService: native SQLite unavailable, falling back to IndexedDB', e);
        try {
          await this.initIndexedDb();
          this.backend = 'indexeddb';
        } catch (e2) {
          console.warn('storageService: IndexedDB also unavailable, using in-memory storage', e2);
          this.backend = 'memory';
        }
      }
    } else {
      try {
        await this.initIndexedDb();
        this.backend = 'indexeddb';
      } catch (e) {
        console.warn('storageService: IndexedDB unavailable, using in-memory storage', e);
        this.backend = 'memory';
      }
    }
    await this.migrateFromLegacyLocalStorage();
  }

  private async initSqlite(): Promise<void> {
    // Dynamic import so a pure web/browser build never needs this package at
    // runtime (it is only exercised on native Android/iOS).
    const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
    const sqliteConnection = new SQLiteConnection(CapacitorSQLite);
    const isConnResult = await sqliteConnection.isConnection(this.DB_NAME, false);
    this.sqlite = isConnResult.result
      ? await sqliteConnection.retrieveConnection(this.DB_NAME, false)
      : await sqliteConnection.createConnection(this.DB_NAME, false, 'no-encryption', 1, false);
    await this.sqlite.open();
    await this.sqlite.execute(
      `CREATE TABLE IF NOT EXISTS ${this.STORE} (key TEXT PRIMARY KEY NOT NULL, value TEXT);`
    );
    await this.sqlite.execute(
      `CREATE TABLE IF NOT EXISTS ${this.MEMORIES_STORE} (
        id TEXT PRIMARY KEY NOT NULL,
        category TEXT,
        memory_type TEXT,
        content TEXT,
        approved INTEGER,
        source_ref TEXT,
        raw_excerpt TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        json_payload TEXT
      );`
    );
    const res = await this.sqlite.query(`SELECT key, value FROM ${this.STORE};`);
    for (const row of res.values || []) {
      this.cache.set(row.key, row.value);
    }
  }

  private initIndexedDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB unavailable in this environment'));
        return;
      }
      const req = indexedDB.open(this.DB_NAME, 2);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(this.STORE)) {
          req.result.createObjectStore(this.STORE);
        }
        if (!req.result.objectStoreNames.contains(this.MEMORIES_STORE)) {
          req.result.createObjectStore(this.MEMORIES_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        this.idb = req.result;
        const tx = this.idb.transaction(this.STORE, 'readonly');
        const store = tx.objectStore(this.STORE);
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            this.cache.set(String(cursor.key), cursor.value as string);
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      };
      req.onerror = () => reject(req.error);
    });
  }

  private async migrateFromLegacyLocalStorage(): Promise<void> {
    const FLAG = '__miki_storage_migrated_v1';
    if (this.cache.get(FLAG) === '1') return;
    if (typeof localStorage === 'undefined') return;

    try {
      let migratedCount = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || key === FLAG) continue;
        // Never clobber anything the new backend already has (e.g. from a
        // previous, partially-completed migration).
        if (this.cache.has(key)) continue;
        const value = localStorage.getItem(key);
        if (value !== null) {
          this.cache.set(key, value);
          this.dirtyKeys.add(key);
          migratedCount++;
        }
      }
      this.cache.set(FLAG, '1');
      this.dirtyKeys.add(FLAG);
      if (migratedCount > 0) {
        await this.flush();
        console.info(
          `storageService: migrated ${migratedCount} key(s) from localStorage into ${this.backend} storage`
        );
      }
    } catch (e) {
      console.warn('storageService: legacy localStorage migration failed (non-fatal)', e);
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().catch((e) => console.warn('storageService: background flush failed', e));
    }, 400);
  }

  private async flush(): Promise<void> {
    if (this.dirtyKeys.size === 0) return;
    const keys = Array.from(this.dirtyKeys);
    this.dirtyKeys.clear();

    try {
      if (this.backend === 'sqlite' && this.sqlite) {
        for (const key of keys) {
          if (this.cache.has(key)) {
            const val = this.cache.get(key)!;
            await this.sqlite.run(`INSERT OR REPLACE INTO ${this.STORE} (key, value) VALUES (?, ?);`, [
              key,
              val,
            ]);

            // If updating memories, also sync structured SQLite table
            if (key === 'gamecraft_memories') {
              try {
                const memList: MemoryItem[] = JSON.parse(val);
                if (Array.isArray(memList)) {
                  for (const mem of memList) {
                    await this.sqlite.run(
                      `INSERT OR REPLACE INTO ${this.MEMORIES_STORE} (id, category, memory_type, content, approved, source_ref, raw_excerpt, created_at, updated_at, json_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                      [
                        mem.id,
                        mem.category || 'chat',
                        mem.memoryType || 'semantic',
                        mem.content,
                        mem.approved ? 1 : 0,
                        mem.sourceRef || '',
                        mem.rawExcerpt || '',
                        mem.createdAt || Date.now(),
                        mem.updatedAt || Date.now(),
                        JSON.stringify(mem),
                      ]
                    );
                  }
                }
              } catch (e) {
                console.warn('storageService: sqlite structured memories sync skipped', e);
              }
            }
          } else {
            await this.sqlite.run(`DELETE FROM ${this.STORE} WHERE key = ?;`, [key]);
          }
        }
      } else if (this.backend === 'indexeddb' && this.idb) {
        await new Promise<void>((resolve, reject) => {
          const tx = this.idb!.transaction(
            this.idb!.objectStoreNames.contains(this.MEMORIES_STORE)
              ? [this.STORE, this.MEMORIES_STORE]
              : [this.STORE],
            'readwrite'
          );
          const store = tx.objectStore(this.STORE);
          const memoriesStore = this.idb!.objectStoreNames.contains(this.MEMORIES_STORE)
            ? tx.objectStore(this.MEMORIES_STORE)
            : null;

          for (const key of keys) {
            if (this.cache.has(key)) {
              const val = this.cache.get(key)!;
              store.put(val, key);

              // If updating memories, sync structured IndexedDB store
              if (key === 'gamecraft_memories' && memoriesStore) {
                try {
                  const memList: MemoryItem[] = JSON.parse(val);
                  if (Array.isArray(memList)) {
                    for (const mem of memList) {
                      memoriesStore.put(mem);
                    }
                  }
                } catch {}
              }
            } else {
              store.delete(key);
            }
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
      // backend === 'memory': nothing to persist beyond the in-memory cache.
    } catch (e) {
      // Put the keys back so the next scheduled flush retries them.
      keys.forEach((k) => this.dirtyKeys.add(k));
      throw e;
    }
  }

  // --- localStorage-compatible synchronous API ---

  public getItem(key: string): string | null {
    return this.cache.has(key) ? this.cache.get(key)! : null;
  }

  public setItem(key: string, value: string): void {
    this.cache.set(key, value);
    this.dirtyKeys.add(key);
    this.scheduleFlush();
  }

  public removeItem(key: string): void {
    if (!this.cache.has(key)) return;
    this.cache.delete(key);
    this.dirtyKeys.add(key);
    this.scheduleFlush();
  }

  /** Equivalent of `Object.keys(localStorage)`. */
  public keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /** Equivalent of `localStorage.key(index)`. */
  public key(index: number): string | null {
    return this.keys()[index] ?? null;
  }

  /** Equivalent of `localStorage.length`. */
  public get length(): number {
    return this.cache.size;
  }

  /** Force any pending debounced writes to persist immediately. */
  public async flushNow(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  public getBackendName(): 'sqlite' | 'indexeddb' | 'memory' {
    return this.backend;
  }

  // --- 7-Tier Hierarchical Memory Dedicated Methods ---

  public getMemories(): MemoryItem[] {
    const raw = this.getItem('gamecraft_memories');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public setMemories(memories: MemoryItem[]): void {
    this.setItem('gamecraft_memories', JSON.stringify(memories));
  }

  public getMemoriesByType(type: MemoryType): MemoryItem[] {
    return this.getMemories().filter((m) => m.memoryType === type);
  }

  public getApprovedMemories(): MemoryItem[] {
    return this.getMemories().filter((m) => m.approved !== false && m.active !== false);
  }

  public saveMemoryItem(item: MemoryItem): void {
    const current = this.getMemories();
    const idx = current.findIndex((m) => m.id === item.id);
    let next: MemoryItem[];
    if (idx >= 0) {
      next = [...current];
      next[idx] = { ...next[idx], ...item, updatedAt: Date.now() };
    } else {
      next = [item, ...current];
    }
    this.setMemories(next);
  }
}

export const storageService = new StorageService();
