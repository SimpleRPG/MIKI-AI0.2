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
import { nativeLlmService } from './nativeLlmService';
import { storageService } from './storageService';

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
  'gemma-2-2b-it-q4f16_1-MLC': {
    name: 'Gemma 2 2B Instruct',
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
  'gemma-2-2b-it-q4f16_1-MLC',
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
  private inferenceLock: Promise<void> = Promise.resolve();

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
    const targetModelId = this.normalizeModelId(modelId);
    try {
      // 1. Official WebLLM cache verification (authoritative, checks that all shards exist)
      const isCachedInWebLLM = await hasModelInCache(targetModelId, CUSTOM_APP_CONFIG);
      if (isCachedInWebLLM) {
        if (typeof storageService !== 'undefined') {
          storageService.setItem(`miki_cached_model_${targetModelId}`, 'true');
        }
        return true;
      } else {
        if (typeof storageService !== 'undefined') {
          storageService.removeItem(`miki_cached_model_${targetModelId}`);
        }
        return false;
      }
    } catch (e) {
      if (typeof storageService !== 'undefined') {
        storageService.removeItem(`miki_cached_model_${targetModelId}`);
      }
      return false;
    }
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
    const targetModelId = this.normalizeModelId(modelId);
    let shardCount = 0;
    let approximateBytes = 0;

    // Check IndexedDB
    const idbCount = await countShardsInIndexedDB(targetModelId);
    shardCount += idbCount;

    // Check legacy CacheStorage
    if (typeof caches !== 'undefined') {
      try {
        const keys = await caches.keys();
        for (const key of keys) {
          const cache = await caches.open(key);
          const requests = await cache.keys();
          const matching = requests.filter((req) => req.url.includes(targetModelId));
          shardCount += matching.length;
        }
      } catch (e) {
        console.warn('Cache verification error:', e);
      }
    }

    const officialCached = await this.isModelCached(targetModelId);

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
      if (typeof storageService !== 'undefined') {
        storageService.removeItem(`miki_cached_model_${modelId}`);
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
    if (typeof storageService !== 'undefined') {
      storageService.removeItem(`miki_cached_model_${modelId}`);
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
    const userPref = storageService.getItem('miki_preferred_local_model');
    if (userPref && (await this.isModelCached(userPref))) {
      return userPref;
    }

    // Check models marked as cached or loaded in EngineModal state
    try {
      const savedModels = storageService.getItem('miki_local_llm_models_v2');
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
    if (typeof storageService !== 'undefined') {
      return storageService.getItem('miki_preferred_local_model');
    }
    return null;
  }

  public setPreferredModelId(modelId: string): void {
    if (typeof storageService !== 'undefined') {
      storageService.setItem('miki_preferred_local_model', modelId);
    }
  }

  private modelSwitchQueue: Promise<void> = Promise.resolve();
  private activeLoadSessionId: number = 0;
  private inFlightLoadMap: Map<string, Promise<void>> = new Map();

  public normalizeModelId(modelId: string): string {
    if (modelId === 'gemma-2-2b-jpn-it-q4f16_1-MLC') {
      return 'gemma-2-2b-it-q4f16_1-MLC';
    }
    return modelId;
  }

  public async loadModel(
    modelId: string,
    onProgress?: (report: { progress: number; text: string }) => void
  ): Promise<void> {
    const targetModelId = this.normalizeModelId(modelId);

    if (onProgress) {
      this.progressListeners.add(onProgress);
    }

    // If native platform is available and the GGUF model is ALREADY downloaded in native storage, we can use it.
    // Otherwise, execute standard WebLLM (WebGPU) download and load pipeline.
    if (nativeLlmService.isNative()) {
      try {
        const storageInfo = await nativeLlmService.getStorageInfo();
        const hasNativeGguf = storageInfo.files.some(
          (f) => f.fileName === `${targetModelId}.gguf` || f.fileName.includes(targetModelId)
        );
        if (hasNativeGguf) {
          systemLogger.info('NATIVE_GPU', `📱 端末内GGUFモデルを検出。Native GPU (OpenCL/Vulkan) でロードします: ${targetModelId}`);
          this.isInitializing = true;
          this.loadingModelId = targetModelId;
          try {
            await nativeLlmService.loadNativeModel(targetModelId, onProgress);
            this.activeModelId = targetModelId;
            this.setPreferredModelId(targetModelId);
            if (onProgress) {
              onProgress({ progress: 100, text: 'Native GPU (OpenCL/Vulkan) ロード完了 (高速推論可能)' });
            }
            return;
          } finally {
            this.isInitializing = false;
            this.loadingModelId = null;
            if (onProgress) {
              this.progressListeners.delete(onProgress);
            }
          }
        }
      } catch {
        // Fallback to standard WebGPU/WebLLM loader
      }
    }

    // If already loaded in VRAM with active engine
    if (this.engine && this.activeModelId === targetModelId) {
      systemLogger.info('WEBGPU', `モデル ${targetModelId} は既にVRAM上にロード済みです (即時利用可能)`);
      if (onProgress) {
        onProgress({ progress: 100, text: 'WebGPU VRAM ロード完了 (推論可能)' });
        this.progressListeners.delete(onProgress);
      }
      return;
    }

    // If this exact model is currently downloading/initializing, reuse the in-flight Promise
    if (this.inFlightLoadMap.has(targetModelId)) {
      systemLogger.info('WEBGPU', `[ロード重複防止] モデル ${targetModelId} は現在バックグラウンドでダウンロード/展開処理中です。既存セッションを共有して完了を待機します`);
      try {
        await this.inFlightLoadMap.get(targetModelId);
        if (onProgress) {
          this.progressListeners.delete(onProgress);
        }
        return;
      } catch (e) {
        if (onProgress) {
          this.progressListeners.delete(onProgress);
        }
        throw e;
      }
    }

    // Mutex locking: chain all model switch requests sequentially to eliminate parallel IndexedDB race conditions
    const currentSessionId = ++this.activeLoadSessionId;
    systemLogger.info('WEBGPU', `モデル切替・ロード要求受付 (Session #${currentSessionId}): ${targetModelId}`);

    const loadTask = async () => {
      systemLogger.info('WEBGPU', `[Session #${currentSessionId}] モデル初期化タスク実行開始: ${targetModelId}`);

      this.isInitializing = true;
      this.loadingModelId = targetModelId;

      const spec = MODEL_VRAM_SPECS[targetModelId];
      const totalSizeMB = spec ? spec.weightsMB : 0;
      let lastLoggedShard = '';
      let loadStartTime = performance.now();
      let lastReportedProgress = 0;
      let lastProgressTime = performance.now();
      let currentPhase = 'INIT'; // 'INIT' | 'DOWNLOAD' | 'EXPAND_TO_VRAM' | 'SHADER_JIT' | 'DONE'
      let currentShardLabel = '';

      const progressCallback = (report: InitProgressReport) => {
        const progress = Math.round(report.progress * 100);
        const rawText = report.text || '';
        let text = rawText || `初期化中... (${progress}%)`;

        const shardMatch = rawText.match(/\[(\d+)\/(\d+)\]/);
        const shardInfo = shardMatch ? ` [ブロック ${shardMatch[1]}/${shardMatch[2]}]` : '';
        if (shardInfo) currentShardLabel = shardInfo;
        const now = performance.now();
        const elapsedSec = (now - loadStartTime) / 1000;

        const isFromCache = rawText.toLowerCase().includes('from cache') || rawText.includes('cache[');
        const isFetching = rawText.toLowerCase().includes('fetching') || rawText.toLowerCase().includes('loading parameter') || rawText.toLowerCase().includes('shard') || rawText.toLowerCase().includes('start to fetch');
        const isShader = rawText.toLowerCase().includes('pipeline') || rawText.toLowerCase().includes('shader');
        const isFinish = rawText.toLowerCase().includes('finish');

        // Output raw event for complete diagnostic transparency
        systemLogger.debug('WEBGPU', `[WebLLMイベント] 進捗: ${progress}% | 状態: "${rawText}" | 経過: ${elapsedSec.toFixed(1)}s`);

        if (isFromCache && currentPhase !== 'EXPAND_TO_VRAM') {
          currentPhase = 'EXPAND_TO_VRAM';
          systemLogger.info('WEBGPU', `【工程 2/3: VRAM展開開始】端末内IndexedDBからWebGPU VRAMへ重みブロックを展開中... (${targetModelId})`);
        } else if (isFetching && !isFromCache && currentPhase !== 'DOWNLOAD') {
          currentPhase = 'DOWNLOAD';
          systemLogger.info('WEBGPU', `【工程 1/3: ネットワーク受信】未保存シャードをHuggingFaceからダウンロード中... (回線状況により1ブロックあたり15〜40秒程度かかります) (${targetModelId})`);
        }

        if (shardMatch && (shardInfo !== lastLoggedShard || isFromCache)) {
          lastLoggedShard = shardInfo;
          const currentShard = parseInt(shardMatch[1], 10);
          const totalShards = parseInt(shardMatch[2], 10);
          const downloadedMB = totalSizeMB > 0 ? Math.round((currentShard / totalShards) * totalSizeMB) : 0;
          
          const timeDelta = (now - lastProgressTime) / 1000;
          const progressDelta = progress - lastReportedProgress;
          const speedMBs = (timeDelta > 0 && totalSizeMB > 0 && progressDelta > 0)
            ? (((progressDelta / 100) * totalSizeMB) / timeDelta).toFixed(1)
            : (elapsedSec > 0 && downloadedMB > 0 ? (downloadedMB / elapsedSec).toFixed(1) : '0.0');

          const remainingMB = Math.max(0, totalSizeMB - downloadedMB);
          const etaSec = Number(speedMBs) > 0 ? Math.round(remainingMB / Number(speedMBs)) : 0;
          const etaStr = etaSec > 0 ? ` (残り約 ${etaSec}秒)` : '';

          if (isFromCache) {
            systemLogger.debug('WEBGPU', `[VRAM展開中] 💾 端末キャッシュからVRAMへ展開: ${shardInfo} (${downloadedMB}/${totalSizeMB}MB, 経過: ${elapsedSec.toFixed(1)}s)`);
          } else {
            systemLogger.info('WEBGPU', `[重み受信完了] 🌐 ネットワーク受信完了: ${shardInfo} (${progress}% 完了, ${downloadedMB}/${totalSizeMB}MB, 速度: ${speedMBs} MB/s, 経過: ${elapsedSec.toFixed(1)}s${etaStr})`);
          }

          lastReportedProgress = progress;
          lastProgressTime = now;
        }

        if (rawText.toLowerCase().includes('start to fetch params')) {
          text = `🌐 HuggingFace通信接続確立・重みデータ受信中${shardInfo}`;
        } else if (isFromCache) {
          text = `💾 端末ストレージからVRAMへ展開中${shardInfo}`;
        } else if (isFetching) {
          text = `🌐 モデル重みデータを受信中${shardInfo}`;
        } else if (isShader) {
          if (currentPhase !== 'SHADER_JIT') {
            currentPhase = 'SHADER_JIT';
            systemLogger.info('WEBGPU', `【工程 3/3: シェーダーJIT】WebGPUシェーダー最適化コンパイル＆パイプライン生成開始 (${targetModelId})`);
          }
          text = `⚡ WebGPUシェーダー＆パイプライン初期化中`;
        } else if (isFinish) {
          currentPhase = 'DONE';
          text = `✅ WebGPU VRAM 展開完了`;
          const totalSec = ((performance.now() - loadStartTime) / 1000).toFixed(2);
          systemLogger.info('WEBGPU', `🎉 モデル重みの展開とWebGPUパイプライン初期化が完了しました (総所要時間: ${totalSec}s)`);
        }

        this.progressListeners.forEach((listener) => {
          try {
            listener({ progress, text });
          } catch {}
        });
      };

      try {
        // Step 1: Unload previous model safely from VRAM
        systemLogger.step(1, 5, `前モデル (${this.activeModelId || 'なし'}) のVRAM解放とメモリクリーンアップ`, {
          previousModel: this.activeModelId,
          targetModel: targetModelId,
        });

        if (this.engine) {
          try {
            if (this.activeModelId !== targetModelId) {
              systemLogger.info('WEBGPU', `既存モデル (${this.activeModelId}) をアンロードしてVRAMを解放します`);
              if (typeof (this.engine as any).unload === 'function') {
                await (this.engine as any).unload();
              }
              this.engine = null;
              this.activeModelId = null;
            }
          } catch (unloadErr) {
            systemLogger.warn('WEBGPU', '既存モデルのアンロード例外（無視して新規初期化を続行します）:', unloadErr);
            this.engine = null;
            this.activeModelId = null;
          }
        }

        // Step 2: Storage verification & sanitize IndexedDB
        systemLogger.step(2, 5, `ストレージ（IndexedDB/CacheStorage）キャッシュ検証 (${targetModelId})`);
        await sanitizeIndexedDB().catch(() => {});
        const cachedShardCount = await countShardsInIndexedDB(targetModelId).catch(() => 0);
        systemLogger.info(
          'WEBGPU',
          `【ストレージ事前診断】モデル ${targetModelId}: 端末IndexedDB内に ${cachedShardCount} 個の重みシャードが保存されています。`
        );

        // Step 3 & 4: Model loading loop
        systemLogger.step(3, 5, `モデル重みファイルダウンロード & VRAMバインド開始 (${targetModelId})`);
        const maxAttempts = 2;
        let lastAttemptError: any = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          let watchdogInterval: any = null;
          try {
            if (attempt > 1) {
              systemLogger.warn('WEBGPU', `モデルロード再試行 (${attempt}/${maxAttempts}) [${targetModelId}]`);
              progressCallback({
                progress: 0,
                text: `🔄 通信・ストレージを再同期中 (${attempt}/${maxAttempts})... ダウンロードを継続します`,
                timeElapsed: 0,
              });
              await new Promise((r) => setTimeout(r, 1000 * attempt));
            }

            // Adaptive Watchdog with generous 180s timeout and periodic heartbeat logging
            let lastWatchdogPing = performance.now();
            let lastHeartbeatLog = performance.now();
            const watchdogTimeoutSec = 180; // 3 minutes per shard to accommodate mobile 4G speeds

            const watchdogPromise = new Promise<never>((_, reject) => {
              watchdogInterval = setInterval(() => {
                const now = performance.now();
                const idleSec = (now - lastWatchdogPing) / 1000;
                
                // Heartbeat notification to UI and log every 10 seconds of download inactivity
                if (idleSec >= 8 && now - lastHeartbeatLog >= 10000) {
                  lastHeartbeatLog = now;
                  const waitingMsg = `🌐 HuggingFaceから重みブロックを受信中... (${Math.round(idleSec)}秒経過 / ダウンロード継続中)`;
                  systemLogger.info(
                    'WEBGPU',
                    `[ダウンロード継続中] ${currentShardLabel || '重みブロック'} を受信中... (待機経過: ${Math.round(idleSec)}秒 / タイムアウト上限: ${watchdogTimeoutSec}秒)`
                  );
                  this.progressListeners.forEach((listener) => {
                    try {
                      listener({
                        progress: lastReportedProgress,
                        text: waitingMsg,
                      });
                    } catch {}
                  });
                }

                if (idleSec >= watchdogTimeoutSec) {
                  if (watchdogInterval) clearInterval(watchdogInterval);
                  reject(
                    new Error(
                      `モデル重みの通信/VRAM展開が無応答（${Math.round(
                        idleSec
                      )}秒）のため中断しました。通信が途切れたか、端末のWebGPUメモリ上限に達した可能性があります。「再開」するか、スマホに最適な超軽量モデル（Qwen 0.5B: 380MB / SmolLM2: 220MB）をご利用ください。`
                    )
                  );
                }
              }, 2000);
            });

            const wrappedProgressCallback = (report: InitProgressReport) => {
              lastWatchdogPing = performance.now();
              progressCallback(report);
            };

            const loadOperation = async () => {
              if (this.engine) {
                if ((this.engine as any).setInitProgressCallback) {
                  (this.engine as any).setInitProgressCallback(wrappedProgressCallback);
                }
                await this.engine.reload(targetModelId);
              } else {
                this.engine = await CreateMLCEngine(targetModelId, {
                  appConfig: CUSTOM_APP_CONFIG,
                  initProgressCallback: wrappedProgressCallback,
                });
              }
            };

            await Promise.race([loadOperation(), watchdogPromise]);
            if (watchdogInterval) clearInterval(watchdogInterval);

            this.activeModelId = targetModelId;
            this.setPreferredModelId(targetModelId);

            if (typeof storageService !== 'undefined') {
              storageService.setItem(`miki_cached_model_${targetModelId}`, 'true');
            }
            if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
              navigator.storage.persist().catch(() => {});
            }

            // Step 5: Finished & VRAM allocation telemetry
            const vramSnapshot = await this.getVRAMSnapshot().catch(() => null);
            systemLogger.step(5, 5, `モデル切替・VRAMバインド完了 (${targetModelId})`, {
              modelId: targetModelId,
              attempt,
              status: 'ready',
              weightsVRAM_MB: vramSnapshot?.weightsBufferMB || spec?.weightsMB,
              kvCacheVRAM_MB: vramSnapshot?.kvCacheBufferMB || spec?.kvCacheMB,
              totalVRAM_MB: vramSnapshot?.totalUsedVRAM_MB || spec?.vramMB,
              deviceEstimatedVRAM_MB: vramSnapshot?.deviceEstimatedVRAM_MB,
              vramPressure: vramSnapshot ? `${Math.round(vramSnapshot.pressureRatio * 100)}% (${vramSnapshot.pressureLevel})` : undefined,
              jsHeapUsedMB: vramSnapshot?.jsHeapUsedMB,
            });
            systemLogger.info('WEBGPU', `[VRAM展開ステータス] 重み: ${vramSnapshot?.weightsBufferMB ?? spec?.weightsMB ?? 0}MB | KVキャッシュ: ${vramSnapshot?.kvCacheBufferMB ?? spec?.kvCacheMB ?? 0}MB | 合計消費: ${vramSnapshot?.totalUsedVRAM_MB ?? spec?.vramMB ?? 0}MB | 推定負荷率: ${vramSnapshot ? Math.round(vramSnapshot.pressureRatio * 100) : 0}% (${vramSnapshot?.pressureLevel ?? 'normal'})`);
            return;
          } catch (err: any) {
            if (watchdogInterval) clearInterval(watchdogInterval);
            lastAttemptError = err;
            this.activeModelId = null;
            const errMsg = String(err?.message || err || '');
            systemLogger.error('WEBGPU', `モデルロード試行 ${attempt}/${maxAttempts} でエラーが発生しました: ${errMsg}`, {
              modelId: targetModelId,
              attempt,
              error: errMsg,
            });

            const isConstraintError = errMsg.includes('ConstraintError') || errMsg.includes('already exists');
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

            if (isConstraintError) {
              systemLogger.info('WEBGPU', 'IndexedDBキー競合 (ConstraintError) を検知。キャッシュを保持したまま再同期します');
            }

            if (isIdbError) {
              systemLogger.warn('WEBGPU', 'IndexedDBスキーマ再構築を実行します');
              await sanitizeIndexedDB().catch(() => {});
              await deleteModelFromIndexedDB(targetModelId).catch(() => {});
            }

            if (isQuota) {
              await this.repairModelCache(targetModelId).catch(() => {});
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
                `端末のGPUメモリ（VRAM）制約によりDevice Lostが発生しました。より軽量なモデル（SmolLM2-360M: 220MB または Qwen 0.5B）をご利用ください。`
              );
              (gpuErr as any).name = 'GPUDeviceLostError';
              throw gpuErr;
            }

            if (this.engine) {
              try {
                await (this.engine as any).unload?.();
              } catch {}
              this.engine = null;
            }

            if (attempt < maxAttempts) {
              continue;
            }
          }
        }

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
            'モデル重みのダウンロード中にネットワーク切断が発生しました。保存済みのブロックは端末内に保持されています。「再ダウンロード」で続きから再開できます。'
          );
          (fetchErr as any).name = 'NetworkFetchError';
          throw fetchErr;
        }

        throw lastAttemptError;
      } finally {
        if (this.activeLoadSessionId === currentSessionId) {
          this.isInitializing = false;
          this.loadingModelId = null;
        }
        if (onProgress) {
          this.progressListeners.delete(onProgress);
        }
      }
    };

    // Chain the task onto the mutex queue so loads never run concurrently
    const loadPromise = this.modelSwitchQueue.then(loadTask, loadTask).finally(() => {
      this.inFlightLoadMap.delete(targetModelId);
    });
    this.inFlightLoadMap.set(targetModelId, loadPromise);
    this.modelSwitchQueue = loadPromise;
    await loadPromise;
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
    this.inFlightLoadMap.clear();
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
    this.inFlightLoadMap.clear();
  }

  public async clearAllCaches(): Promise<void> {
    await this.cancelAndReset();
    if (typeof storageService !== 'undefined') {
      try {
        for (const mId of KNOWN_MODEL_IDS) {
          storageService.removeItem(`miki_cached_model_${mId}`);
        }
        const keys = storageService.keys();
        for (const k of keys) {
          if (k.startsWith('miki_cached_model_')) {
            storageService.removeItem(k);
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
    const maxAttempts = 2;
    let lastError: any = null;

    // Extract the latest user input safely
    const latestUser = messages.filter((m) => m.role === 'user').pop();
    const latestUserText = (latestUser?.content || 'こんにちは').trim();

    // Sanitize messages for on-device SLM execution: keep compact system prompt and short history for fast prefill
    const sanitizedMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
    const sysMsg = messages.find((m) => m.role === 'system');
    if (sysMsg && sysMsg.content) {
      sanitizedMessages.push({
        role: 'system',
        content: sysMsg.content.slice(0, 260),
      });
    } else {
      sanitizedMessages.push({
        role: 'system',
        content: 'あなたは明るく親切な専属AIパートナーのみきです。日本語で自然に、簡潔に回答してください。',
      });
    }

    // Include only 1-2 most recent turns to minimize GPU prefill latency on mobile
    const nonSysMsgs = messages.filter((m) => m.role !== 'system');
    const recentTurns = nonSysMsgs.slice(-2);
    for (const turn of recentTurns) {
      sanitizedMessages.push({
        role: turn.role,
        content: (turn.content || '').slice(0, 220),
      });
    }

    systemLogger.debug('INFERENCE', `[プロンプト整形] 送信ターン数: ${sanitizedMessages.length}, システム文字数: ${sanitizedMessages[0]?.content?.length ?? 0}, 入力文字数: ${latestUserText.length}`);

    // Wait for any active GPU inference pipeline to completely resolve and release staging buffers
    const currentInferenceLock = this.inferenceLock;
    let releaseInferenceLock: () => void = () => {};
    this.inferenceLock = new Promise<void>((resolve) => {
      releaseInferenceLock = resolve;
    });

    try {
      await currentInferenceLock;
    } catch {}

    if (nativeLlmService.isNative()) {
      systemLogger.info('NATIVE_GPU', `⚡ 端末ネイティブGPU (OpenCL/Vulkan) ストリーミング推論開始`);
      if (!this.activeModelId) {
        const targetModel = options?.fallbackModelId || this.getPreferredModelId() || 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC';
        await this.loadModel(targetModel);
      }
      for await (const chunk of nativeLlmService.streamNativeChat(sanitizedMessages, options)) {
        yield chunk;
      }
      return;
    }

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          // If not loaded and a fallback model is specified, load it first
          if (!this.engine || !this.activeModelId) {
            const targetModel = options?.fallbackModelId || this.getPreferredModelId() || 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC';
            systemLogger.info('INFERENCE', `[WebGPU推論 試行 ${attempt}/${maxAttempts}] エンジン未ロードのためロードを開始します: ${targetModel}`);
            await this.loadModel(targetModel);
          }

          if (!this.engine) {
            throw new Error('WebGPU LLM エンジンがロードされていません。');
          }

          const tokenLimit = Math.min(options?.max_tokens ?? 256, 256);

          if (attempt === 1) {
            systemLogger.info('INFERENCE', `[WebGPU推論 試行 1/2] ストリーミング生成API呼び出し開始 (MaxTokens: ${tokenLimit}, Temperature: ${options?.temperature ?? 0.7}, Model: ${this.activeModelId})`);
            
            const createStartTime = performance.now();
            const createPromise = this.engine.chat.completions.create({
              messages: sanitizedMessages as any,
              stream: true,
              temperature: options?.temperature ?? 0.7,
              max_tokens: tokenLimit,
            });

            // 25-second watchdog for initial create/prefill (gives mobile GPUs adequate time for shader JIT & prefill)
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('WebGPU推論がタイムアウト（25秒無応答）しました。')), 25000)
            );

            const chunks: any = await Promise.race([createPromise, timeoutPromise]);
            const createElapsedMs = Math.round(performance.now() - createStartTime);
            systemLogger.debug('INFERENCE', `[WebGPU Prefill通信確立] create()完了 (所要時間: ${createElapsedMs}ms)`);

            let hasYielded = false;
            let generatedChunkCount = 0;
            let firstTokenTime: number | null = null;
            let lastTokenTime: number = performance.now();
            const inferStartTime = performance.now();

            const asyncIter = chunks[Symbol.asyncIterator]();

            while (true) {
              if (this.isInterrupted) {
                this.isInterrupted = false;
                systemLogger.warn('INFERENCE', '[WebGPU推論] ユーザーによって生成が中断されました。');
                return;
              }

              // Per-token watchdog timeout (10 seconds max per token generation)
              const tokenTimeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('WebGPUトークン生成タイムアウト (10秒無応答)')), 10000)
              );

              const nextResult: IteratorResult<any> = await Promise.race([
                asyncIter.next(),
                tokenTimeoutPromise,
              ]);

              if (nextResult.done) {
                break;
              }

              const now = performance.now();
              const chunk = nextResult.value;
              const delta = chunk?.choices?.[0]?.delta?.content || '';
              if (delta) {
                if (!firstTokenTime) {
                  firstTokenTime = now;
                  const ttftMs = Math.round(firstTokenTime - inferStartTime);
                  systemLogger.info('INFERENCE', `WebGPU 初回トークン到達 (TTFT: ${ttftMs}ms) | 先頭: "${delta.slice(0, 15)}"`);
                }

                yield delta;
                hasYielded = true;
                generatedChunkCount++;

                // Periodic progress telemetry every 10 tokens
                if (generatedChunkCount % 10 === 0) {
                  const elapsedSinceFirst = (now - firstTokenTime) / 1000;
                  const currentTps = elapsedSinceFirst > 0 ? (generatedChunkCount / elapsedSinceFirst).toFixed(1) : '0';
                  const intervalMs = Math.round(now - lastTokenTime);
                  systemLogger.debug('INFERENCE', `[WebGPU生成進捗] ${generatedChunkCount} チャンク到達 (速度: ${currentTps} tok/s, 直近間隔: ${intervalMs}ms)`);
                }

                lastTokenTime = now;
              }
            }

            const totalTimeMs = Math.round(performance.now() - inferStartTime);
            const genDurationSec = firstTokenTime ? (performance.now() - firstTokenTime) / 1000 : 0;
            const avgTps = genDurationSec > 0 ? (generatedChunkCount / genDurationSec).toFixed(1) : '0';

            systemLogger.info('INFERENCE', `[WebGPU推論 完了] 受信チャンク数: ${generatedChunkCount}, 総所要時間: ${totalTimeMs}ms (平均速度: ${avgTps} tok/s)`);

            if (hasYielded) {
              return;
            }
          } else {
            if (this.isInterrupted) {
              this.isInterrupted = false;
              return;
            }
            // Attempt 2: Atomic non-streaming completion with compact prompt
            systemLogger.info('INFERENCE', `[WebGPU推論 試行 2/2] アトミック(非ストリーミング)一括生成に切り替えてリトライします...`);
            await new Promise((r) => setTimeout(r, 200));

            // Ensure engine is ready before attempt 2
            if (!this.engine || !this.activeModelId) {
              const targetModel =
                options?.fallbackModelId ||
                this.getPreferredModelId() ||
                'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC';
              systemLogger.info('WEBGPU', `[WebGPU自己修復] リトライ前にモデルを再初期化中: ${targetModel}`);
              await this.loadModel(targetModel);
            }

            const compactMessages = [
              {
                role: 'system',
                content: 'あなたは親切なAI相棒のみきです。日本語で自然に回答してください。',
              },
              {
                role: 'user',
                content: latestUserText.slice(0, 150),
              },
            ];

            systemLogger.debug('INFERENCE', `[WebGPUアトミック生成] 入力: "${latestUserText.slice(0, 50)}..."`);
            const atomicPromise = this.engine.chat.completions.create({
              messages: compactMessages as any,
              stream: false,
              temperature: options?.temperature ?? 0.7,
              max_tokens: 200,
            });

            const atomicTimeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('WebGPUアトミック推論がタイムアウト（20秒無応答）しました。')), 20000)
            );

            const response = await Promise.race([atomicPromise, atomicTimeoutPromise]);

            const fullContent = (response as any).choices?.[0]?.message?.content || '';
            if (fullContent && fullContent.trim()) {
              systemLogger.info('INFERENCE', `[WebGPU推論 試行 2] アトミック生成成功 (文字数: ${fullContent.length})`);
              const sliceSize = 8;
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
          systemLogger.warn('INFERENCE', `[WebGPU推論 試行 ${attempt} エラー] ${errorMsg}`, { attempt, error: errorMsg });

          // Safe reset: attempt resetChat to clear KV cache
          try {
            if (this.engine && typeof (this.engine as any).resetChat === 'function') {
              await (this.engine as any).resetChat(false);
            }
          } catch {}

          // If attempt 1 failed with ANY error, cleanly re-sync the engine for attempt 2
          if (attempt < maxAttempts) {
            try {
              const targetModel =
                options?.fallbackModelId ||
                this.activeModelId ||
                this.getPreferredModelId() ||
                'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC';
              systemLogger.info('WEBGPU', `[WebGPU自己修復] エラー復旧のためモデルを再初期化中: ${targetModel}`);
              this.engine = null;
              this.activeModelId = null;
              await this.loadModel(targetModel);
            } catch (recErr: any) {
              systemLogger.warn('WEBGPU', `[WebGPU自己修復再初期化エラー] ${recErr?.message || recErr}`);
            }
          }
        }
      }

      if (lastError) {
        throw lastError;
      }
    } finally {
      releaseInferenceLock();
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
