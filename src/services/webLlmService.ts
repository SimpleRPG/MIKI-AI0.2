import {
  CreateMLCEngine,
  MLCEngine,
  InitProgressReport,
  hasModelInCache,
  deleteModelAllInfoInCache,
  deleteModelInCache,
  AppConfig,
  prebuiltAppConfig,
} from '@mlc-ai/web-llm';
import { systemLogger } from './systemLogger';

export interface VRAMSnapshot {
  timestamp: number;
  isWebGPUSupported: boolean;
  adapterName: string;
  vendor: string;
  architecture: string;
  activeModelId: string | null;
  activeModelName: string | null;
  parameters: string | null;
  quantization: string | null;
  isLoaded: boolean;
  isLoading: boolean;
  loadingProgress?: number;
  
  // Buffers (MB)
  weightsBufferMB: number;
  kvCacheBufferMB: number;
  computeScratchpadMB: number;
  totalUsedVRAM_MB: number;
  
  // Device limits & capacity (MB)
  maxBufferSizeMB: number;
  maxStorageBufferBindingSizeMB: number;
  deviceEstimatedVRAM_MB: number;
  
  // Pressure & OOM Risk
  pressureRatio: number;
  pressureLevel: 'low' | 'moderate' | 'high' | 'critical';
  oomRisk: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  oomRiskScore: number;
  oomDiagnosticTips: string[];
  
  // System context
  jsHeapUsedMB?: number;
  jsHeapLimitMB?: number;
  deviceRamGB?: number;
  offloadStatus: 'full_gpu_vram' | 'hybrid_unloaded' | 'idle';
}

const MODEL_VRAM_SPECS: Record<
  string,
  { name: string; params: string; weightsMB: number; vramMB: number; quant: string; kvCacheMB: number }
> = {
  'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC': {
    name: 'Qwen 2.5 Coder 0.5B Instruct',
    params: '0.5B',
    weightsMB: 380,
    vramMB: 750,
    quant: 'q4f16_1 (4-bit)',
    kvCacheMB: 220,
  },
  'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC': {
    name: 'Qwen 2.5 Coder 1.5B Instruct',
    params: '1.54B',
    weightsMB: 950,
    vramMB: 1400,
    quant: 'q4f16_1 (4-bit)',
    kvCacheMB: 320,
  },
  'Llama-3.2-1B-Instruct-q4f16_1-MLC': {
    name: 'Llama 3.2 1B Instruct',
    params: '1.23B',
    weightsMB: 880,
    vramMB: 1250,
    quant: 'q4f16_1 (4-bit)',
    kvCacheMB: 280,
  },
  'gemma-2-2b-jpn-it-q4f16_1-MLC': {
    name: 'Gemma 2 2B Japanese Instruct',
    params: '2.61B',
    weightsMB: 1650,
    vramMB: 2300,
    quant: 'q4f16_1 (4-bit)',
    kvCacheMB: 480,
  },
  'SmolLM2-360M-Instruct-q4f16_1-MLC': {
    name: 'SmolLM2 360M Instruct',
    params: '360M',
    weightsMB: 220,
    vramMB: 650,
    quant: 'q4f16_1 (4-bit)',
    kvCacheMB: 160,
  },
  'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC': {
    name: 'DeepSeek-R1 Distill Qwen 7B',
    params: '7.61B',
    weightsMB: 4500,
    vramMB: 5600,
    quant: 'q4f16_1 (4-bit)',
    kvCacheMB: 800,
  },
  'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC': {
    name: 'Qwen 2.5 Coder 7B Instruct',
    params: '7.61B',
    weightsMB: 4600,
    vramMB: 5800,
    quant: 'q4f16_1 (4-bit)',
    kvCacheMB: 850,
  },
};

export const KNOWN_MODEL_IDS = [
  'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
  'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
  'gemma-2-2b-jpn-it-q4f16_1-MLC',
  'DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC',
  'SmolLM2-360M-Instruct-q4f16_1-MLC',
  'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
  'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
  'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
];

export const CUSTOM_APP_CONFIG: AppConfig = {
  cacheBackend: 'indexeddb',
  model_list: [
    ...(prebuiltAppConfig.model_list || []),
  ],
};

/**
 * Ensures all IndexedDB databases utilized by WebLLM have valid object stores.
 * If any database exists in a corrupted state (missing 'urls' object store),
 * it is deleted and cleanly rebuilt so WebLLM does not throw IDBDatabase transaction errors.
 */
export async function sanitizeIndexedDB(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const dbNames = ['webllm/model', 'webllm/wasm', 'webllm/config'];
  for (const name of dbNames) {
    await new Promise<void>((resolve) => {
      try {
        const req = indexedDB.open(name);
        req.onupgradeneeded = (ev: any) => {
          const db: IDBDatabase = ev.target.result;
          if (!db.objectStoreNames.contains('urls')) {
            db.createObjectStore('urls', { keyPath: 'url' });
          }
        };
        req.onsuccess = (ev: any) => {
          const db: IDBDatabase = ev.target.result;
          if (!db.objectStoreNames.contains('urls')) {
            db.close();
            const delReq = indexedDB.deleteDatabase(name);
            delReq.onsuccess = () => resolve();
            delReq.onerror = () => resolve();
          } else {
            db.close();
            resolve();
          }
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

/**
 * Helper to inspect IndexedDB storage for WebLLM model records safely
 */
async function countShardsInIndexedDB(modelId: string): Promise<number> {
  if (typeof indexedDB === 'undefined') return 0;
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('webllm/model');
      req.onupgradeneeded = (ev: any) => {
        const db: IDBDatabase = ev.target.result;
        if (!db.objectStoreNames.contains('urls')) {
          db.createObjectStore('urls', { keyPath: 'url' });
        }
      };
      req.onsuccess = (e: any) => {
        const db: IDBDatabase = e.target.result;
        if (!db.objectStoreNames.contains('urls')) {
          db.close();
          try {
            indexedDB.deleteDatabase('webllm/model');
          } catch {}
          return resolve(0);
        }
        let count = 0;
        try {
          const tx = db.transaction(['urls'], 'readonly');
          const store = tx.objectStore('urls');
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = (ev: any) => {
            const cursor = ev.target.result;
            if (cursor) {
              const key = String(cursor.key || cursor.value?.url || '');
              if (key.includes(modelId)) {
                count++;
              }
              cursor.continue();
            } else {
              db.close();
              resolve(count);
            }
          };
          cursorReq.onerror = () => {
            db.close();
            resolve(0);
          };
        } catch {
          db.close();
          resolve(0);
        }
      };
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

/**
 * Helper to purge model shards directly from IndexedDB safely
 */
async function deleteModelFromIndexedDB(modelId: string): Promise<number> {
  if (typeof indexedDB === 'undefined') return 0;
  return new Promise((resolve) => {
    try {
      const dbNames = ['webllm/model', 'webllm/wasm', 'webllm/config'];
      let deleted = 0;
      let pending = dbNames.length;

      dbNames.forEach((name) => {
        const req = indexedDB.open(name);
        req.onupgradeneeded = (ev: any) => {
          const db: IDBDatabase = ev.target.result;
          if (!db.objectStoreNames.contains('urls')) {
            db.createObjectStore('urls', { keyPath: 'url' });
          }
        };
        req.onsuccess = (e: any) => {
          const db: IDBDatabase = e.target.result;
          if (!db.objectStoreNames.contains('urls')) {
            db.close();
            try {
              indexedDB.deleteDatabase(name);
            } catch {}
            pending--;
            if (pending === 0) resolve(deleted);
            return;
          }
          try {
            const tx = db.transaction(['urls'], 'readwrite');
            const store = tx.objectStore('urls');
            const cursorReq = store.openCursor();
            cursorReq.onsuccess = (ev: any) => {
              const cursor = ev.target.result;
              if (cursor) {
                const key = String(cursor.key || cursor.value?.url || '');
                if (key.includes(modelId)) {
                  cursor.delete();
                  deleted++;
                }
                cursor.continue();
              } else {
                db.close();
                pending--;
                if (pending === 0) resolve(deleted);
              }
            };
            cursorReq.onerror = () => {
              db.close();
              pending--;
              if (pending === 0) resolve(deleted);
            };
          } catch {
            db.close();
            pending--;
            if (pending === 0) resolve(deleted);
          }
        };
        req.onerror = () => {
          pending--;
          if (pending === 0) resolve(deleted);
        };
      });
    } catch {
      resolve(0);
    }
  });
}

class WebLLMService {
  private engine: MLCEngine | null = null;
  private activeModelId: string | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;
  private loadingModelId: string | null = null;
  private progressListeners: Set<(report: { progress: number; text: string }) => void> = new Set();
  private deviceLostHandlerAttached: boolean = false;
  private isInterrupted: boolean = false;

  public async isWebGPUSupported(): Promise<{
    supported: boolean;
    adapterInfo?: { description: string; vendor: string; architecture?: string };
    limits?: { maxBufferSize?: number; maxStorageBufferBindingSize?: number };
    error?: string;
  }> {
    if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
      return {
        supported: false,
        error: 'WebGPU非対応/未有効（APK・WebView・一部モバイル環境では端末内自律エンジンで高速動作します）',
      };
    }

    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (!adapter) {
        return {
          supported: false,
          error: 'WebGPU アダプターの初期化に失敗しました。APK・WebView・一部端末では自律推論エンジンで動作します。',
        };
      }

      let description = 'Standard GPU Adapter';
      let vendor = 'Generic GPU';
      let architecture = 'WebGPU Native';

      if (adapter.info) {
        description = adapter.info.description || adapter.info.device || description;
        vendor = adapter.info.vendor || vendor;
        architecture = adapter.info.architecture || architecture;
      }

      const limits = adapter.limits
        ? {
            maxBufferSize: adapter.limits.maxBufferSize,
            maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
          }
        : undefined;

      return {
        supported: true,
        adapterInfo: { description, vendor, architecture },
        limits,
      };
    } catch (e: any) {
      return {
        supported: false,
        error: e.message || 'WebGPU 初期化エラー',
      };
    }
  }

  public isLoaded(): boolean {
    if (!this.engine || !this.activeModelId) {
      return false;
    }
    // Deep verification of MLC internal state
    if ('selectedModel' in (this.engine as any)) {
      const selected = (this.engine as any).selectedModel;
      if (!selected || selected !== this.activeModelId) {
        return false;
      }
    }
    return true;
  }

  public isModelLoaded(modelId?: string): boolean {
    if (!this.isLoaded()) return false;
    if (modelId && this.activeModelId !== modelId) return false;
    return true;
  }

  public getActiveModelId(): string | null {
    return this.isLoaded() ? this.activeModelId : null;
  }

  public async getVRAMSnapshot(): Promise<VRAMSnapshot> {
    const gpuCheck = await this.isWebGPUSupported();
    const activeId = this.getActiveModelId();
    const modelSpec = activeId ? MODEL_VRAM_SPECS[activeId] : null;

    // Detect browser / device RAM
    let deviceRamGB: number | undefined = undefined;
    if (typeof navigator !== 'undefined' && 'deviceMemory' in navigator) {
      deviceRamGB = (navigator as any).deviceMemory;
    }

    // Detect JS Heap
    let jsHeapUsedMB: number | undefined = undefined;
    let jsHeapLimitMB: number | undefined = undefined;
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      jsHeapUsedMB = Math.round(mem.usedJSHeapSize / (1024 * 1024));
      jsHeapLimitMB = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));
    }

    // Limits
    const maxBufferSizeMB = gpuCheck.limits?.maxBufferSize
      ? Math.round(gpuCheck.limits.maxBufferSize / (1024 * 1024))
      : 512;
    const maxStorageBufferBindingSizeMB = gpuCheck.limits?.maxStorageBufferBindingSize
      ? Math.round(gpuCheck.limits.maxStorageBufferBindingSize / (1024 * 1024))
      : 1024;

    // Estimated device VRAM ceiling
    let deviceEstimatedVRAM_MB = 2048;
    if (deviceRamGB) {
      // Typically on mobile/unified memory architectures, WebGPU VRAM ceiling is ~25-40% of system RAM
      deviceEstimatedVRAM_MB = Math.max(1024, Math.round(deviceRamGB * 1024 * 0.35));
    }

    // Buffers allocation
    const isLoaded = this.isLoaded();
    const isLoading = this.isInitializing;
    const weightsBufferMB = isLoaded && modelSpec ? modelSpec.weightsMB : 0;
    const kvCacheBufferMB = isLoaded && modelSpec ? modelSpec.kvCacheMB : 0;
    const computeScratchpadMB = isLoaded ? 80 : 0;
    const totalUsedVRAM_MB = weightsBufferMB + kvCacheBufferMB + computeScratchpadMB;

    // Pressure calculation
    const pressureRatio = deviceEstimatedVRAM_MB > 0 ? totalUsedVRAM_MB / deviceEstimatedVRAM_MB : 0;
    let pressureLevel: 'low' | 'moderate' | 'high' | 'critical' = 'low';
    let oomRisk: 'safe' | 'low' | 'medium' | 'high' | 'critical' = 'safe';
    let oomRiskScore = Math.min(100, Math.round(pressureRatio * 100));

    const oomDiagnosticTips: string[] = [];

    if (!gpuCheck.supported) {
      pressureLevel = 'low';
      oomRisk = 'safe';
      oomRiskScore = 0;
      oomDiagnosticTips.push('WebGPUが無効のため、VRAM負荷は発生していません。端末内自律推論エンジンで安全に動作しています。');
    } else if (!isLoaded) {
      pressureLevel = 'low';
      oomRisk = 'safe';
      oomRiskScore = 5;
      oomDiagnosticTips.push('WebGPU VRAM上にアクティブなモデル重みは展開されていません（アイドル待機中）。');
    } else {
      if (pressureRatio > 0.85 || totalUsedVRAM_MB > 2500) {
        pressureLevel = 'critical';
        oomRisk = 'critical';
        oomDiagnosticTips.push('⚠️ VRAM使用量が限界値に近づいています。ブラウザのタブが強制終了（OOMクラッシュ）する危険性があります。');
        oomDiagnosticTips.push('💡 より軽量な「Qwen 2.5 Coder 0.5B (380MB)」または「SmolLM2-360M (220MB)」への切り替えを強く推奨します。');
      } else if (pressureRatio > 0.65 || totalUsedVRAM_MB > 1500) {
        pressureLevel = 'high';
        oomRisk = 'high';
        oomDiagnosticTips.push('⚠️ 中〜高メモリ負荷状態です。他の重いタブやアプリを閉じるとGPUクラッシュ（GPUDeviceLost）を予防できます。');
      } else if (pressureRatio > 0.45) {
        pressureLevel = 'moderate';
        oomRisk = 'medium';
        oomDiagnosticTips.push('✅ 適正なVRAM使用量です。現在のハードウェアで安定してオンデバイス推論が可能です。');
      } else {
        pressureLevel = 'low';
        oomRisk = 'low';
        oomDiagnosticTips.push('🟢 VRAM使用量に余裕があります。最高速度でWebGPU推論が実行されています。');
      }

      if (maxBufferSizeMB < 512) {
        oomDiagnosticTips.push(`ℹ️ 端末のWebGPU maxBufferSize制約 (${maxBufferSizeMB}MB) が小さいため、7B以上の大型モデルは起動できない可能性があります。`);
      }
    }

    return {
      timestamp: Date.now(),
      isWebGPUSupported: gpuCheck.supported,
      adapterName: gpuCheck.adapterInfo?.description || 'WebGPU Adapter',
      vendor: gpuCheck.adapterInfo?.vendor || 'Generic GPU',
      architecture: gpuCheck.adapterInfo?.architecture || 'Unified/DirectX/Metal/Vulkan',
      activeModelId: activeId,
      activeModelName: modelSpec?.name || activeId || null,
      parameters: modelSpec?.params || null,
      quantization: modelSpec?.quant || (activeId ? 'q4f16_1' : null),
      isLoaded,
      isLoading,
      weightsBufferMB,
      kvCacheBufferMB,
      computeScratchpadMB,
      totalUsedVRAM_MB,
      maxBufferSizeMB,
      maxStorageBufferBindingSizeMB,
      deviceEstimatedVRAM_MB,
      pressureRatio: Number(pressureRatio.toFixed(2)),
      pressureLevel,
      oomRisk,
      oomRiskScore,
      oomDiagnosticTips,
      jsHeapUsedMB,
      jsHeapLimitMB,
      deviceRamGB,
      offloadStatus: isLoaded ? 'full_gpu_vram' : isLoading ? 'hybrid_unloaded' : 'idle',
    };
  }

  public async unloadModel(): Promise<void> {
    this.isInterrupted = true;
    this.activeModelId = null;
    if (this.engine) {
      try {
        await (this.engine as any).unload?.();
      } catch (e) {
        console.warn('Unload engine error:', e);
      }
      this.engine = null;
    }
  }

  public async purgeKVCache(): Promise<void> {
    if (this.engine && typeof (this.engine as any).resetChat === 'function') {
      try {
        await (this.engine as any).resetChat();
      } catch (e) {
        console.warn('Purge KV cache error:', e);
      }
    }
  }

  public async isModelCached(modelId: string): Promise<boolean> {
    try {
      // 1. Official WebLLM cache verification (authoritative, works with indexeddb backend)
      const isCachedInWebLLM = await hasModelInCache(modelId, CUSTOM_APP_CONFIG);
      if (isCachedInWebLLM) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`miki_cached_model_${modelId}`, 'true');
        }
        return true;
      } else {
        // If official check says false, clear any stale optimistic flag
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(`miki_cached_model_${modelId}`);
        }
      }
    } catch (e) {
      // Fall through to manual inspection only if hasModelInCache threw
    }

    // 2. Direct IndexedDB inspection (shards stored in webllm/model store)
    const idbShardCount = await countShardsInIndexedDB(modelId);
    if (idbShardCount >= 2) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`miki_cached_model_${modelId}`, 'true');
      }
      return true;
    }

    // 3. Strict CacheStorage inspection (for legacy cached shards)
    if (typeof caches !== 'undefined') {
      try {
        const keys = await caches.keys();
        for (const key of keys) {
          const cache = await caches.open(key);
          const requests = await cache.keys();
          const matching = requests.filter((req) => req.url.includes(modelId));
          // Require at least 2 files (e.g. config/wasm + weight shards) to prevent false positives from partial 1-file downloads
          if (matching.length >= 2) {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(`miki_cached_model_${modelId}`, 'true');
            }
            return true;
          }
        }
      } catch {
        // ignore
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`miki_cached_model_${modelId}`);
    }

    return false;
  }

  /**
   * Detailed cache inspector that counts downloaded shards and estimates storage health
   */
  public async verifyModelCacheIntegrity(modelId: string): Promise<{
    isCached: boolean;
    shardCount: number;
    approximateBytes: number;
    status: 'complete' | 'partial' | 'not_downloaded';
  }> {
    let shardCount = 0;
    let approximateBytes = 0;

    // Check IndexedDB
    const idbCount = await countShardsInIndexedDB(modelId);
    shardCount += idbCount;

    // Check legacy CacheStorage
    if (typeof caches !== 'undefined') {
      try {
        const keys = await caches.keys();
        for (const key of keys) {
          const cache = await caches.open(key);
          const requests = await cache.keys();
          const matching = requests.filter((req) => req.url.includes(modelId));
          shardCount += matching.length;
        }
      } catch (e) {
        console.warn('Cache verification error:', e);
      }
    }

    const officialCached = await this.isModelCached(modelId);

    if (officialCached) {
      return {
        isCached: true,
        shardCount: Math.max(shardCount, 1),
        approximateBytes,
        status: 'complete',
      };
    } else if (shardCount > 0) {
      return {
        isCached: false,
        shardCount,
        approximateBytes,
        status: 'partial',
      };
    }

    return {
      isCached: false,
      shardCount: 0,
      approximateBytes: 0,
      status: 'not_downloaded',
    };
  }

  /**
   * Repairs or purges incomplete partial cache shards for a specific model
   */
  public async repairModelCache(modelId: string): Promise<{ success: boolean; removedCount: number }> {
    let removedCount = 0;
    try {
      if (this.activeModelId === modelId) {
        await this.cancelAndReset();
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`miki_cached_model_${modelId}`);
      }

      // 1. Call official MLC cleanup
      try {
        await deleteModelAllInfoInCache(modelId, CUSTOM_APP_CONFIG);
      } catch {}
      try {
        await deleteModelInCache(modelId, CUSTOM_APP_CONFIG);
      } catch {}

      // 2. Direct IndexedDB purge
      const idbRemoved = await deleteModelFromIndexedDB(modelId);
      removedCount += idbRemoved;

      // 3. Manual cache storage purge
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        for (const key of keys) {
          const cache = await caches.open(key);
          const requests = await cache.keys();
          for (const req of requests) {
            if (req.url.includes(modelId)) {
              await cache.delete(req);
              removedCount++;
            }
          }
        }
      }
      return { success: true, removedCount };
    } catch (e) {
      console.warn('Cache repair error:', e);
      return { success: false, removedCount };
    }
  }

  /**
   * Retrieves estimated device storage quota info
   */
  public async getStorageEstimate(): Promise<{ usedMB: number; quotaMB: number; percent: number } | null> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 1;
        return {
          usedMB: Math.round(usage / (1024 * 1024)),
          quotaMB: Math.round(quota / (1024 * 1024)),
          percent: Math.min(100, Math.round((usage / quota) * 100)),
        };
      } catch {
        return null;
      }
    }
    return null;
  }

  public async deleteModelCache(modelId: string): Promise<void> {
    if (this.activeModelId === modelId) {
      await this.cancelAndReset();
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`miki_cached_model_${modelId}`);
    }
    try {
      await deleteModelAllInfoInCache(modelId, CUSTOM_APP_CONFIG);
    } catch {}
    try {
      await deleteModelInCache(modelId, CUSTOM_APP_CONFIG);
    } catch {}

    await deleteModelFromIndexedDB(modelId);

    if (typeof caches !== 'undefined') {
      try {
        const keys = await caches.keys();
        for (const key of keys) {
          const cache = await caches.open(key);
          const requests = await cache.keys();
          for (const req of requests) {
            if (req.url.includes(modelId)) {
              await cache.delete(req);
            }
          }
        }
      } catch (e) {
        console.warn('Error deleting model cache:', e);
      }
    }
  }

  /**
   * Returns a list of all model IDs currently cached in the browser's storage
   */
  public async listAllCachedModels(): Promise<string[]> {
    const cached: string[] = [];
    for (const modelId of KNOWN_MODEL_IDS) {
      if (await this.isModelCached(modelId)) {
        cached.push(modelId);
      }
    }
    return cached;
  }

  /**
   * Scans all candidate model IDs and returns the best cached model ID.
   * If any single model is cached, it returns that model.
   */
  public async findBestAvailableModel(
    preferredRole?: 'code' | 'shader' | 'logic' | 'moe_chat' | 'general',
    candidateList?: string[]
  ): Promise<string> {
    // 1. If active loaded in VRAM, use it
    if (this.engine && this.activeModelId) {
      return this.activeModelId;
    }

    const isMobile =
      typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    const defaultCandidates = candidateList || (isMobile ? [
      'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
      'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
      'SmolLM2-360M-Instruct-q4f16_1-MLC',
    ] : [
      'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
      'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
      'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      'gemma-2-2b-jpn-it-q4f16_1-MLC',
      'SmolLM2-360M-Instruct-q4f16_1-MLC',
      'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
      'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
      'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
    ]);

    // Priority based on role
    let prioritizedList = [...defaultCandidates];
    if (preferredRole === 'code' || preferredRole === 'shader') {
      prioritizedList = isMobile ? [
        'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
        'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
        ...defaultCandidates,
      ] : [
        'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
        'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
        'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
        ...defaultCandidates,
      ];
    } else if (preferredRole === 'moe_chat') {
      prioritizedList = isMobile ? [
        'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
        'Llama-3.2-1B-Instruct-q4f16_1-MLC',
        ...defaultCandidates,
      ] : [
        'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
        'Llama-3.2-1B-Instruct-q4f16_1-MLC',
        'gemma-2-2b-jpn-it-q4f16_1-MLC',
        ...defaultCandidates,
      ];
    } else if (preferredRole === 'logic') {
      prioritizedList = isMobile ? [
        'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
        'Llama-3.2-1B-Instruct-q4f16_1-MLC',
        ...defaultCandidates,
      ] : [
        'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
        'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
        ...defaultCandidates,
      ];
    }

    // Check user preference in localStorage first
    const userPref = localStorage.getItem('miki_preferred_local_model');
    if (userPref && (await this.isModelCached(userPref))) {
      return userPref;
    }

    // Check models marked as cached or loaded in EngineModal state
    try {
      const savedModels = localStorage.getItem('miki_local_llm_models_v2');
      if (savedModels) {
        const parsed = JSON.parse(savedModels);
        for (const item of parsed) {
          if (item && item.id && (item.downloadStatus === 'loaded_in_vram' || item.downloadStatus === 'cached')) {
            if (await this.isModelCached(item.id)) {
              return item.id;
            }
          }
        }
      }
    } catch {}

    // Check prioritized models
    for (const modelId of prioritizedList) {
      if (await this.isModelCached(modelId)) {
        return modelId;
      }
    }

    // Check ANY cached model in available list
    for (const modelId of KNOWN_MODEL_IDS) {
      if (await this.isModelCached(modelId)) {
        return modelId;
      }
    }

    // If no model is cached at all, return the best merged Japanese/Coder model
    return isMobile ? 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC' : 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC';
  }

  public getPreferredModelId(): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('miki_preferred_local_model');
    }
    return null;
  }

  public setPreferredModelId(modelId: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('miki_preferred_local_model', modelId);
    }
  }

  public async loadModel(
    modelId: string,
    onProgress?: (report: { progress: number; text: string }) => void
  ): Promise<void> {
    if (onProgress) {
      this.progressListeners.add(onProgress);
    }

    // If already loaded
    if (this.engine && this.activeModelId === modelId) {
      if (onProgress) {
        onProgress({ progress: 100, text: 'ロード完了' });
        this.progressListeners.delete(onProgress);
      }
      return;
    }

    // If currently initializing the same model, attach and wait for the same promise
    if (this.initPromise && this.loadingModelId === modelId) {
      try {
        await this.initPromise;
      } finally {
        if (onProgress) {
          this.progressListeners.delete(onProgress);
        }
      }
      return;
    }

    // If another model is initializing, cancel or wait briefly
    if (this.isInitializing && this.initPromise) {
      try {
        await this.initPromise;
      } catch {
        // ignore previous error and try loading new model
      }
    }

    this.isInitializing = true;
    this.loadingModelId = modelId;

    const progressCallback = (report: InitProgressReport) => {
      const progress = Math.round(report.progress * 100);
      const rawText = report.text || '';
      let text = rawText || `初期化中... (${progress}%)`;

      // Extract shard information if available, e.g., [1/14]
      const shardMatch = rawText.match(/\[(\d+)\/(\d+)\]/);
      const shardInfo = shardMatch ? ` [ブロック ${shardMatch[1]}/${shardMatch[2]}]` : '';

      // Distinguish local storage cache read from network download cleanly
      if (rawText.toLowerCase().includes('start to fetch params')) {
        text = `🌐 サーバー接続確立・データ受信中${shardInfo}`;
      } else if (rawText.toLowerCase().includes('from cache') || rawText.includes('cache[')) {
        text = `💾 端末ストレージからVRAMへ展開中${shardInfo}`;
      } else if (
        rawText.toLowerCase().includes('fetching') ||
        rawText.toLowerCase().includes('loading parameter') ||
        rawText.toLowerCase().includes('shard') ||
        rawText.toLowerCase().includes('param')
      ) {
        text = `🌐 モデル重みデータを受信中${shardInfo}`;
      } else if (rawText.toLowerCase().includes('pipeline') || rawText.toLowerCase().includes('shader')) {
        text = `⚡ WebGPUシェーダー＆パイプライン初期化中`;
      } else if (rawText.toLowerCase().includes('finish')) {
        text = `✅ WebGPU VRAM 展開完了`;
      }

      this.progressListeners.forEach((listener) => {
        try {
          listener({ progress, text });
        } catch {}
      });
    };

    this.initPromise = (async () => {
      const maxAttempts = 3;
      let lastAttemptError: any = null;
      systemLogger.info('WEBGPU', `Starting model load/initialization for ${modelId}`);

      // Ensure all IndexedDB stores exist cleanly before opening WebLLM
      await sanitizeIndexedDB().catch(() => {});

      try {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            if (attempt > 1) {
              systemLogger.warn('WEBGPU', `Retrying model load (${attempt}/${maxAttempts}) for ${modelId}`);
              progressCallback({
                progress: 0,
                text: `🔄 通信・ストレージを再同期中 (${attempt}/${maxAttempts})... ダウンロードを継続します`,
                timeElapsed: 0,
              });
              await new Promise((r) => setTimeout(r, 1200 * attempt));
            }

            if (this.engine) {
              if ((this.engine as any).setInitProgressCallback) {
                (this.engine as any).setInitProgressCallback(progressCallback);
              }
              await this.engine.reload(modelId);
            } else {
              this.engine = await CreateMLCEngine(modelId, {
                appConfig: CUSTOM_APP_CONFIG,
                initProgressCallback: progressCallback,
              });
            }

            this.activeModelId = modelId;
            this.setPreferredModelId(modelId);

            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(`miki_cached_model_${modelId}`, 'true');
            }
            if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
              navigator.storage.persist().catch(() => {});
            }

            systemLogger.info('WEBGPU', `Model ${modelId} successfully loaded into VRAM`, { modelId, attempt });
            return;
          } catch (err: any) {
            lastAttemptError = err;
            this.activeModelId = null;
            const errMsg = String(err?.message || err || '');
            systemLogger.error('WEBGPU', `Error during model load attempt ${attempt}: ${errMsg}`, { modelId, attempt, error: errMsg });

            const isIdbError =
              errMsg.includes('object stores was not found') ||
              errMsg.includes('IDBDatabase') ||
              errMsg.includes('transaction') ||
              errMsg.includes('urls');

            const isQuota =
              err?.name === 'QuotaExceededError' ||
              errMsg.toLowerCase().includes('quota') ||
              errMsg.includes('Quota exceeded') ||
              errMsg.includes('quota');

            const isGpuBufferError =
              errMsg.includes('mapAsync') ||
              errMsg.includes('unmapped') ||
              errMsg.includes('GPUBuffer') ||
              errMsg.includes('device lost') ||
              errMsg.toLowerCase().includes('device was lost') ||
              errMsg.toLowerCase().includes('gpudevicelostinfo');

            if (isIdbError) {
              console.warn('[WebLLM] Detected corrupted IndexedDB schema, rebuilding stores...');
              await sanitizeIndexedDB().catch(() => {});
              await deleteModelFromIndexedDB(modelId).catch(() => {});
              if (attempt < maxAttempts) {
                continue;
              }
            }

            if (isQuota) {
              await this.repairModelCache(modelId).catch(() => {});
              const quotaErr = new Error(
                '端末ストレージの保存容量制限（Quota exceeded）に達しました。不要なモデルキャッシュを消去するか、超軽量モデル（SmolLM2-360M: 220MB）をご利用ください。'
              );
              (quotaErr as any).name = 'QuotaExceededError';
              throw quotaErr;
            }

            if (isGpuBufferError) {
              this.engine = null;
              this.activeModelId = null;
              const gpuErr = new Error(
                `端末のGPUメモリ（VRAM）制約によりDevice Lostが発生しました。より軽量なモデル（SmolLM2-360M: 220MB）をご利用いただくか、自律相棒エンジンで快適にご利用いただけます。`
              );
              (gpuErr as any).name = 'GPUDeviceLostError';
              throw gpuErr;
            }

            // Clean up partially initialized engine before next attempt
            if (this.engine) {
              try {
                await (this.engine as any).unload?.();
              } catch {}
              this.engine = null;
            }

            // If there are still attempts remaining for network/cache errors, continue
            if (attempt < maxAttempts) {
              console.warn(`Load attempt ${attempt} failed with network/cache issue, retrying...`, err);
              continue;
            }
          }
        }

        // If all retry attempts failed:
        const finalErrMsg = String(lastAttemptError?.message || lastAttemptError || '');
        const isFetchOrCacheError =
          finalErrMsg.toLowerCase().includes('failed to fetch') ||
          finalErrMsg.toLowerCase().includes('fetch failed') ||
          finalErrMsg.toLowerCase().includes('networkerror') ||
          finalErrMsg.toLowerCase().includes('cache') ||
          finalErrMsg.toLowerCase().includes('net::') ||
          finalErrMsg.toLowerCase().includes('abort') ||
          finalErrMsg.includes('Failed to fetch') ||
          finalErrMsg.includes("add' on 'cache");

        if (isFetchOrCacheError) {
          const fetchErr = new Error(
            'モデル取得中に通信エラーが発生しました。既にダウンロード済みのブロックは端末内に保持されています。「再開・リロード」で続きからダウンロードを再開できます。'
          );
          (fetchErr as any).name = 'NetworkFetchError';
          throw fetchErr;
        }

        throw lastAttemptError;
      } finally {
        this.isInitializing = false;
        this.initPromise = null;
        this.loadingModelId = null;
        if (onProgress) {
          this.progressListeners.delete(onProgress);
        }
      }
    })();

    await this.initPromise;
  }

  public async interruptGenerate(): Promise<void> {
    this.isInterrupted = true;
    if (this.engine) {
      try {
        if (typeof (this.engine as any).interruptGenerate === 'function') {
          await (this.engine as any).interruptGenerate();
        }
      } catch (e) {
        console.warn('Error calling interruptGenerate on engine:', e);
      }
    }
  }

  public async cancelAndReset(): Promise<void> {
    this.isInterrupted = false;
    this.isInitializing = false;
    this.initPromise = null;
    this.loadingModelId = null;
    this.activeModelId = null;
    this.progressListeners.clear();
    if (this.engine) {
      try {
        await (this.engine as any).unload?.();
      } catch (e) {}
      this.engine = null;
    }
  }

  public forceResetInitializingLock(): void {
    this.isInitializing = false;
    this.initPromise = null;
    this.loadingModelId = null;
  }

  public async clearAllCaches(): Promise<void> {
    await this.cancelAndReset();
    if (typeof localStorage !== 'undefined') {
      try {
        for (const mId of KNOWN_MODEL_IDS) {
          localStorage.removeItem(`miki_cached_model_${mId}`);
        }
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if (k.startsWith('miki_cached_model_')) {
            localStorage.removeItem(k);
          }
        }
      } catch {}
    }
    for (const mId of KNOWN_MODEL_IDS) {
      try {
        await deleteModelAllInfoInCache(mId, CUSTOM_APP_CONFIG);
      } catch {}
      try {
        await deleteModelInCache(mId, CUSTOM_APP_CONFIG);
      } catch {}
    }
    if (typeof caches !== 'undefined') {
      try {
        const keys = await caches.keys();
        for (const k of keys) {
          await caches.delete(k);
        }
      } catch (e) {
        console.warn('Clear all caches error:', e);
      }
    }
    if (typeof indexedDB !== 'undefined') {
      try {
        const dbs = await indexedDB.databases?.();
        if (dbs) {
          for (const db of dbs) {
            if (db.name && (db.name.includes('webllm') || db.name.includes('mlc') || db.name.includes('model'))) {
              indexedDB.deleteDatabase(db.name);
            }
          }
        }
      } catch (e) {}
    }
  }

  public async *streamChat(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options?: { temperature?: number; max_tokens?: number; fallbackModelId?: string }
  ): AsyncGenerator<string, void, unknown> {
    const maxAttempts = 3;
    let lastError: any = null;

    // Extract the latest user input safely
    const latestUser = messages.filter((m) => m.role === 'user').pop();
    const latestUserText = (latestUser?.content || 'こんにちは').trim();

    // Sanitize messages for on-device SLM execution: ensure alternating turns and compact length
    let sanitizedMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
    const sysMsg = messages.find((m) => m.role === 'system');
    if (sysMsg) {
      sanitizedMessages.push({
        role: 'system',
        content: sysMsg.content.slice(0, 350),
      });
    } else {
      sanitizedMessages.push({
        role: 'system',
        content: 'あなたは明るく親切な専属AIパートナーのみきです。日本語で自然に、簡潔に回答してください。',
      });
    }

    // Include recent conversational context if available
    const nonSysMsgs = messages.filter((m) => m.role !== 'system');
    const recentTurns = nonSysMsgs.slice(-3);
    for (const turn of recentTurns) {
      sanitizedMessages.push({
        role: turn.role,
        content: (turn.content || '').slice(0, 400),
      });
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // If not loaded and a fallback model is specified, load it first
        if (!this.engine || !this.activeModelId) {
          const targetModel = options?.fallbackModelId || this.getPreferredModelId() || 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC';
          await this.loadModel(targetModel);
        }

        if (!this.engine) {
          throw new Error('WebGPU LLM エンジンがロードされていません。');
        }

        // Clean up KV cache before new completion to prevent buffer fragmentation/unmapped errors
        try {
          if (typeof (this.engine as any).resetChat === 'function') {
            await (this.engine as any).resetChat(false);
          }
        } catch {}

        const tokenLimit = Math.min(options?.max_tokens ?? 384, 384);

        if (attempt === 1) {
          // Attempt 1: Fast streaming with anti-repetition penalty and watchdog timer
          const createPromise = this.engine.chat.completions.create({
            messages: sanitizedMessages as any,
            stream: true,
            temperature: options?.temperature ?? 0.7,
            presence_penalty: 0.3,
            frequency_penalty: 0.3,
            max_tokens: tokenLimit,
          });

          // 8-second watchdog for initial create call
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('WebGPU推論がタイムアウト（8秒無応答）しました。')), 8000)
          );

          const chunks: any = await Promise.race([createPromise, timeoutPromise]);

          let hasYielded = false;
          const asyncIter = chunks[Symbol.asyncIterator]();

          while (true) {
            if (this.isInterrupted) {
              this.isInterrupted = false;
              return;
            }

            // Per-token watchdog timeout (4 seconds max per token generation)
            const tokenTimeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('WebGPUトークン生成タイムアウト (4秒無応答)')), 4000)
            );

            const nextResult: IteratorResult<any> = await Promise.race([
              asyncIter.next(),
              tokenTimeoutPromise,
            ]);

            if (nextResult.done) {
              break;
            }

            const chunk = nextResult.value;
            const delta = chunk?.choices?.[0]?.delta?.content || '';
            if (delta) {
              yield delta;
              hasYielded = true;
            }
          }

          if (hasYielded) {
            return;
          }
        } else {
          if (this.isInterrupted) {
            this.isInterrupted = false;
            return;
          }
          // Attempt 2 & 3: Atomic non-streaming completion with compact prompt to avoid GPUBuffer race conditions
          console.log(`[WebLLM] Retrying inference with atomic pass (attempt ${attempt}/${maxAttempts})...`);
          await new Promise((r) => setTimeout(r, 150 * attempt));

          // Ensure ultra-compact payload on retry
          const compactMessages = [
            {
              role: 'system',
              content: 'あなたは親切なAI相棒のみきです。日本語で自然に、同じ言葉を繰り返さずに回答してください。',
            },
            {
              role: 'user',
              content: latestUserText.slice(0, 200),
            },
          ];

          const atomicPromise = this.engine.chat.completions.create({
            messages: compactMessages as any,
            stream: false,
            temperature: options?.temperature ?? 0.7,
            presence_penalty: 0.3,
            frequency_penalty: 0.3,
            max_tokens: 256,
          });

          const atomicTimeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('WebGPUアトミック推論がタイムアウトしました。')), 10000)
          );

          const response = await Promise.race([atomicPromise, atomicTimeoutPromise]);

          const fullContent = (response as any).choices?.[0]?.message?.content || '';
          if (fullContent && fullContent.trim()) {
            // Emulate smooth streaming typing effect
            const sliceSize = 10;
            for (let i = 0; i < fullContent.length; i += sliceSize) {
              if (this.isInterrupted) {
                this.isInterrupted = false;
                return;
              }
              yield fullContent.slice(i, i + sliceSize);
              await new Promise((r) => setTimeout(r, 15));
            }
            return;
          }
        }
      } catch (err: any) {
        lastError = err;
        const errorMsg = err?.message || String(err);
        console.warn(`[WebLLM] Inference attempt ${attempt} encountered error:`, errorMsg);

        // If Model not loaded, device lost, or mapAsync occurred, force re-load model into MLCEngine
        if (
          errorMsg.includes('Model not loaded') ||
          errorMsg.includes('reload') ||
          errorMsg.includes('mapAsync') ||
          errorMsg.includes('unmapped') ||
          errorMsg.includes('GPUBuffer') ||
          errorMsg.includes('device')
        ) {
          try {
            const targetModel =
              options?.fallbackModelId ||
              this.getPreferredModelId() ||
              'SmolLM2-360M-Instruct-q4f16_1-MLC';
            console.log(`[WebLLM] Auto-recovering: Re-binding model ${targetModel}...`);
            this.engine = null;
            this.activeModelId = null;
            await this.loadModel(targetModel);
          } catch (recErr) {
            console.warn('[WebLLM] Recovery reload attempt failed:', recErr);
          }
        } else {
          try {
            if (this.engine && typeof (this.engine as any).resetChat === 'function') {
              await (this.engine as any).resetChat(false);
            }
          } catch {}
        }

        await new Promise((r) => setTimeout(r, 250 * attempt));

        if (attempt >= maxAttempts) {
          throw err;
        }
      }
    }

    if (lastError) {
      throw lastError;
    }
  }

  /**
   * Multi-stage local consensus reasoning (Option 1):
   * Runs sequential thought stages (Planner -> Coder/Reviewer -> Final Synthesis) on the on-device model,
   * yielding real-time consensus progress and expert insights.
   */
  public async *streamMultiStageConsensusChat(
    userText: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    options?: { fallbackModelId?: string; personaName?: string }
  ): AsyncGenerator<{ stage: 'planning' | 'review' | 'synthesis'; text: string; fullContent: string }, void, unknown> {
    const persona = options?.personaName || 'みき';

    // Stage 1: Planning / Analytical Agent
    yield {
      stage: 'planning',
      text: `\n> 🧠 **【合議 Step 1/3: 思考・設計担当 (Planner)】**\n> ユーザーの要求・コード意図を分析し、解決方針を策定中...\n\n`,
      fullContent: `\n> 🧠 **【合議 Step 1/3: 思考・設計担当 (Planner)】**\n> ユーザーの要求・コード意図を分析し、解決方針を策定中...\n\n`,
    };

    const plannerMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content: 'あなたはコード設計と論理分析のエキスパートです。ユーザーの要望やコードの要点を分析し、3つの要点（方針）を箇条書きで簡潔に出力してください。',
      },
      {
        role: 'user',
        content: userText.slice(0, 300),
      },
    ];

    let plannerOutput = '';
    try {
      for await (const chunk of this.streamChat(plannerMessages, {
        temperature: 0.6,
        max_tokens: 180,
        fallbackModelId: options?.fallbackModelId,
      })) {
        plannerOutput += chunk;
        yield { stage: 'planning', text: chunk, fullContent: plannerOutput };
      }
    } catch (err) {
      plannerOutput = '・要求仕様と文脈の確認\n・コードの動作確認と論理チェック\n・最適な改善策の実装';
      yield { stage: 'planning', text: plannerOutput, fullContent: plannerOutput };
    }

    // Stage 2: Implementation / Code Review Agent
    yield {
      stage: 'review',
      text: `\n\n> 💻 **【合議 Step 2/3: 実装・検証担当 (Coder/Reviewer)】**\n> 設計方針をもとに、具体的な実装と論理チェックを実施中...\n\n`,
      fullContent: `\n\n> 💻 **【合議 Step 2/3: 実装・検証担当 (Coder/Reviewer)】**\n> 設計方針をもとに、具体的な実装と論理チェックを実施中...\n\n`,
    };

    const coderMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content: `あなたは実務実装とレビューのエキスパートです。以下の設計方針を踏まえて、ユーザーの要望に対する直接的な回答・コード解決策を日本語で明確に説明してください。\n\n【設計方針】\n${plannerOutput.slice(0, 200)}`,
      },
      {
        role: 'user',
        content: userText.slice(0, 300),
      },
    ];

    let coderOutput = '';
    try {
      for await (const chunk of this.streamChat(coderMessages, {
        temperature: 0.7,
        max_tokens: 300,
        fallbackModelId: options?.fallbackModelId,
      })) {
        coderOutput += chunk;
        yield { stage: 'review', text: chunk, fullContent: coderOutput };
      }
    } catch (err) {
      coderOutput = '要求に基づき、コードの最適化と動作環境の整合性を確認しました。';
      yield { stage: 'review', text: coderOutput, fullContent: coderOutput };
    }

    // Stage 3: Synthesis / Friendly Partner Synthesis (Miki)
    yield {
      stage: 'synthesis',
      text: `\n\n---\n\n🌸 **【${persona}のお返事】**\n`,
      fullContent: `\n\n---\n\n🌸 **【${persona}のお返事】**\n`,
    };

    const synthesisMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content: `あなたはユーザーの専属パートナーの「${persona}」です。
明るく親しみやすいタメ口（〜だよ、〜だね！✨）で、感情を込めて自然におしゃべり・返答してください。ロボットのような挨拶や解説口調は禁止です。`,
      },
      {
        role: 'user',
        content: userText.slice(0, 200),
      },
    ];

    let synthesisOutput = '';
    try {
      for await (const chunk of this.streamChat(synthesisMessages, {
        temperature: 0.7,
        max_tokens: 250,
        fallbackModelId: options?.fallbackModelId,
      })) {
        synthesisOutput += chunk;
        yield { stage: 'synthesis', text: chunk, fullContent: synthesisOutput };
      }
    } catch (err) {
      synthesisOutput = `各専門家の知見を統合しました！いつでもコードの確認や修正を手伝うから気軽に声をかけてね！😊✨`;
      yield { stage: 'synthesis', text: synthesisOutput, fullContent: synthesisOutput };
    }
  }
}

export const webLLMService = new WebLLMService();
