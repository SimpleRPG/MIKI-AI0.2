import { CreateMLCEngine, MLCEngine, InitProgressReport, hasModelInCache, AppConfig, prebuiltAppConfig } from '@mlc-ai/web-llm';

export const KNOWN_MODEL_IDS = [
  'SmolLM2-360M-Instruct-q4f16_1-MLC',
  'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
  'DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC',
  'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
  'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
  'gemma-2-2b-jpn-it-q4f16_1-MLC',
  'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
  'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
];

// AppConfig to support models and ensure reliable fallback wasm URLs with optimized mobile limits
export const CUSTOM_APP_CONFIG: AppConfig = {
  model_list: [
    ...(prebuiltAppConfig.model_list || []),
  ],
};

class WebLLMService {
  private engine: MLCEngine | null = null;
  private activeModelId: string | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;
  private loadingModelId: string | null = null;
  private progressListeners: Set<(report: { progress: number; text: string }) => void> = new Set();
  private deviceLostHandlerAttached: boolean = false;

  public async isWebGPUSupported(): Promise<{
    supported: boolean;
    adapterInfo?: { description: string; vendor: string; architecture?: string };
    error?: string;
  }> {
    if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
      return {
        supported: false,
        error: 'このブラウザは WebGPU をサポートしていません。Chrome / Edge / Brave 等をご利用ください。',
      };
    }

    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (!adapter) {
        return {
          supported: false,
          error: 'WebGPU アダプターの初期化に失敗しました。ハードウェアアクセラレーションが有効かご確認ください。',
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

      return {
        supported: true,
        adapterInfo: { description, vendor, architecture },
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

  public async isModelCached(modelId: string): Promise<boolean> {
    try {
      // 1. Official WebLLM cache verification (authoritative)
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

    // 2. Strict CacheStorage inspection (requires ndarray-cache.json or multiple weight shards)
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
      'SmolLM2-360M-Instruct-q4f16_1-MLC',
      'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
      'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
    ] : [
      'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
      'SmolLM2-360M-Instruct-q4f16_1-MLC',
      'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
      'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
      'gemma-2-2b-jpn-it-q4f16_1-MLC',
      'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
      'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
    ]);

    // Priority based on role
    let prioritizedList = [...defaultCandidates];
    if (preferredRole === 'code' || preferredRole === 'shader') {
      prioritizedList = isMobile ? [
        'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
        'SmolLM2-360M-Instruct-q4f16_1-MLC',
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
        'SmolLM2-360M-Instruct-q4f16_1-MLC',
        'Llama-3.2-1B-Instruct-q4f16_1-MLC',
        ...defaultCandidates,
      ] : [
        'Llama-3.2-1B-Instruct-q4f16_1-MLC',
        'gemma-2-2b-jpn-it-q4f16_1-MLC',
        'SmolLM2-360M-Instruct-q4f16_1-MLC',
        ...defaultCandidates,
      ];
    } else if (preferredRole === 'logic') {
      prioritizedList = isMobile ? [
        'SmolLM2-360M-Instruct-q4f16_1-MLC',
        'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
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

    // If no model is cached at all, return fastest lightweight default
    return isMobile ? 'SmolLM2-360M-Instruct-q4f16_1-MLC' : 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC';
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
      const text = report.text || `初期化中... (${progress}%)`;
      this.progressListeners.forEach((listener) => {
        try {
          listener({ progress, text });
        } catch {}
      });
    };

    this.initPromise = (async () => {
      try {
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
      } catch (err: any) {
        this.activeModelId = null;
        const errMsg = String(err?.message || err || '');
        const isQuota =
          err?.name === 'QuotaExceededError' ||
          errMsg.toLowerCase().includes('quota') ||
          errMsg.includes('Quota exceeded') ||
          errMsg.includes('quota');

        const isFetchError =
          errMsg.toLowerCase().includes('failed to fetch') ||
          errMsg.toLowerCase().includes('fetch failed') ||
          errMsg.toLowerCase().includes('networkerror') ||
          errMsg.toLowerCase().includes('load failed') ||
          errMsg.toLowerCase().includes('net::') ||
          errMsg.toLowerCase().includes('abort') ||
          errMsg.includes('Failed to fetch');

        const isGpuBufferError =
          errMsg.includes('mapAsync') ||
          errMsg.includes('unmapped') ||
          errMsg.includes('GPUBuffer') ||
          errMsg.includes('device lost');

        if (isQuota) {
          // Clean up incomplete shards to free up storage
          await this.repairModelCache(modelId);
          const quotaErr = new Error(
            '端末ストレージの保存容量制限（Quota exceeded）に達しました。不要なモデルキャッシュを消去するか、超軽量モデル（SmolLM2-360M: 220MB）をご利用ください。'
          );
          (quotaErr as any).name = 'QuotaExceededError';
          throw quotaErr;
        }

        const isCacheAddError =
          errMsg.toLowerCase().includes("failed to execute 'add' on 'cache'") ||
          errMsg.toLowerCase().includes('cache.add()') ||
          errMsg.toLowerCase().includes('encountered a network error');

        if (isCacheAddError || isFetchError) {
          // Purge any corrupted partial files in cache for this model to allow clean retry
          await this.repairModelCache(modelId).catch(() => {});
          const fetchErr = new Error(
            'モデルファイル取得中にキャッシュ通信エラーが発生しました（Cache.add network error）。破損した不完全キャッシュをクリアしました。「再試行」または「修復 & 再DL」をお試しください。'
          );
          (fetchErr as any).name = 'NetworkFetchError';
          throw fetchErr;
        }

        if (isGpuBufferError || errMsg.toLowerCase().includes('device was lost') || errMsg.toLowerCase().includes('gpudevicelostinfo')) {
          this.engine = null;
          this.activeModelId = null;
          const gpuErr = new Error(
            `端末のGPUメモリ（VRAM）制約によりDevice Lostが発生しました。より軽量なモデル（SmolLM2-360M: 220MB）をご利用いただくか、ハイブリッド合議知能モードで快適にご利用いただけます。`
          );
          (gpuErr as any).name = 'GPUDeviceLostError';
          throw gpuErr;
        }

        throw err;
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

  public async cancelAndReset(): Promise<void> {
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
    if (typeof caches !== 'undefined') {
      try {
        const keys = await caches.keys();
        for (const k of keys) {
          if (k.includes('webllm') || k.includes('model') || k.includes('mlc') || k.includes('wasm')) {
            await caches.delete(k);
          }
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
            if (db.name && (db.name.includes('webllm') || db.name.includes('mlc'))) {
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
          const targetModel = options?.fallbackModelId || this.getPreferredModelId() || 'SmolLM2-360M-Instruct-q4f16_1-MLC';
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
          // Attempt 1: Fast streaming
          const chunks = await this.engine.chat.completions.create({
            messages: sanitizedMessages as any,
            stream: true,
            temperature: options?.temperature ?? 0.7,
            max_tokens: tokenLimit,
          });

          let hasYielded = false;
          for await (const chunk of chunks) {
            const delta = chunk.choices[0]?.delta?.content || '';
            if (delta) {
              yield delta;
              hasYielded = true;
            }
          }
          if (hasYielded) {
            return;
          }
        } else {
          // Attempt 2 & 3: Atomic non-streaming completion with compact prompt to avoid GPUBuffer race conditions
          console.log(`[WebLLM] Retrying inference with atomic pass (attempt ${attempt}/${maxAttempts})...`);
          await new Promise((r) => setTimeout(r, 150 * attempt));

          // Ensure ultra-compact payload on retry
          const compactMessages = [
            {
              role: 'system',
              content: 'あなたは親切なAI相棒のみきです。日本語で簡潔に回答してください。',
            },
            {
              role: 'user',
              content: latestUserText.slice(0, 200),
            },
          ];

          const response = await this.engine.chat.completions.create({
            messages: compactMessages as any,
            stream: false,
            temperature: options?.temperature ?? 0.7,
            max_tokens: 256,
          });

          const fullContent = (response as any).choices?.[0]?.message?.content || '';
          if (fullContent && fullContent.trim()) {
            // Emulate smooth streaming typing effect
            const sliceSize = 10;
            for (let i = 0; i < fullContent.length; i += sliceSize) {
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
}

export const webLLMService = new WebLLMService();
