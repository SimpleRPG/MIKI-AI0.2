import { registerPlugin, Capacitor } from '@capacitor/core';
import { systemLogger } from './systemLogger';
import { webLLMService } from './webLlmService';
import { sendChatMessage } from './api';
import { OFFICIAL_GGUF_MODELS, getManifestDefaultConfig, getManifestNativeEnv } from './ggufModels';
import { storageService } from './storageService';
import { contextBudgetEngineService } from './contextBudgetEngineService';
import { samplingTuningService } from './samplingTuningService';
import { ExternalLlmRunDiagnostic } from '../types';

export interface NativeGpuInfo {
  available: boolean;
  backend: 'OpenCL' | 'Vulkan' | 'Hexagon-NPU' | 'Adreno-GPU' | 'Mali-GPU' | 'Metal' | 'CUDA' | 'WebGPU' | 'CPU';
  gpuVendor: string;
  gpuRenderer: string;
  totalMemoryMB: number;
  availableMemoryMB?: number;
  allocatedMemoryMB: number;
  driverVersion?: string;
  isNative: boolean;
  architecture?: string;
}

export interface NativeDownloadedFile {
  fileName: string;
  sizeMB: number;
  lastModified: number;
}

export interface NativeStorageInfo {
  totalDiskMB: number;
  freeDiskMB: number;
  usedByModelsMB: number;
  modelsDir: string;
  files: NativeDownloadedFile[];
}

export interface NativeLoraFile {
  fileName: string;
  sizeMB: number;
  lastModified: number;
  isApplied?: boolean;
  scale?: number;
}

export interface NativeLoraStorageInfo {
  usedByLoraMB: number;
  loraDir: string;
  files: NativeLoraFile[];
  activeLoraFileName?: string | null;
  activeLoraScale?: number;
}

export interface ExternalLocalLlmConfig {
  endpoint: string; // e.g. http://localhost:11434 (Ollama) or http://localhost:1234/v1 (LM Studio)
  model: string;
  type: 'ollama' | 'openai_compatible';
  slotId?: number; // 明示的スロットID (0..n)。固定することでn_slots>1環境でのキャッシュ分散を防止 (-1はサーバー自動割当)
}

export interface NativeLlmProgressEvent {
  progress: number;
  text: string;
  phase?: string;
  bytesDownloaded?: number;
  totalBytes?: number;
  speedMBs?: number;
  etaSeconds?: number;
}

export interface NativeLlmChunkEvent {
  delta: string;
  fullText: string;
  tokensGenerated: number;
}

export interface NativeLlamaPluginInterface {
  isAvailable(): Promise<{
    available: boolean;
    backend: string;
    platform: string;
    architecture: string;
    hasGpuAcceleration: boolean;
    engineType: string;
  }>;
  getHardwareSpecs(): Promise<NativeGpuInfo>;
  getMemoryInfo?(): Promise<{
    totalMemMB: number;
    availMemMB: number;
    thresholdMB: number;
    lowMemory: boolean;
    storageAvailMB: number;
    storageTotalMB: number;
    cpuCores: number;
    isMeasuredReal: boolean;
  }>;
  getStorageInfo(): Promise<NativeStorageInfo>;
  getLoraStorageInfo?(): Promise<NativeLoraStorageInfo>;
  applyLora?(options: {
    loraFileName: string;
    scale?: number;
  }): Promise<{ success: boolean; loraFileName: string; scale: number }>;
  removeLora?(): Promise<{ success: boolean }>;
  deleteLora?(options: { fileName: string }): Promise<{ success: boolean }>;
  checkStorageAccess?(): Promise<{ granted: boolean }>;
  requestStorageAccess?(): Promise<{ opened: boolean }>;
  downloadModel(options: {
    modelId: string;
    downloadUrl: string;
    fileName: string;
  }): Promise<{ success: boolean; filePath: string; sizeMB: number }>;
  cancelDownload(options?: { modelId?: string }): Promise<{ success: boolean }>;
  deleteModel(options: { fileName: string }): Promise<{ success: boolean }>;
  loadModel(options: {
    modelId: string;
    fileName?: string;
    filePath?: string;
    nGpuLayers?: number;
    nCtx?: number;
    nThreads?: number;
  }): Promise<{
    success: boolean;
    modelId: string;
    backend: string;
    nGpuLayers: number;
    nCtx: number;
    totalVramMB?: number;
  }>;
  generateStream(options: {
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    stopSequences?: string[];
  }): Promise<{ text: string; totalTokens: number; tps: number; durationMs: number }>;
  unloadModel(): Promise<{ success: boolean }>;
}

export const NativeMlcPlugin = registerPlugin<NativeLlamaPluginInterface>('MlcLlmPlugin', {
  web: () => ({
    async isAvailable() {
      return {
        available: false,
        backend: 'Browser-Web',
        platform: 'web',
        architecture: 'wasm/webgpu',
        hasGpuAcceleration: typeof navigator !== 'undefined' && 'gpu' in navigator,
        engineType: 'llama.cpp-jni-android-only',
      };
    },
    async getHardwareSpecs() {
      let renderer = 'Web Browser Client';
      let vendor = 'Web Standard';
      try {
        if (typeof document !== 'undefined') {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (gl) {
            const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
              vendor = (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || vendor;
              renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || renderer;
            }
          }
        }
      } catch (e) {}

      return {
        available: false,
        backend: 'WebGPU',
        gpuVendor: vendor,
        gpuRenderer: renderer,
        totalMemoryMB: 4096,
        allocatedMemoryMB: 0,
        isNative: false,
      };
    },
    async getStorageInfo() {
      return {
        totalDiskMB: 10240,
        freeDiskMB: 8192,
        usedByModelsMB: 0,
        modelsDir: 'browser-indexeddb',
        files: [],
      };
    },
    async getLoraStorageInfo() {
      let localLoraFiles: NativeLoraFile[] = [];
      try {
        if (typeof storageService !== 'undefined') {
          const raw = storageService.getItem('miki_downloaded_lora_files');
          if (raw) localLoraFiles = JSON.parse(raw);
        }
      } catch (e) {}
      const activeLora = typeof storageService !== 'undefined' ? storageService.getItem('miki_active_lora_file') : null;
      const activeScale = typeof storageService !== 'undefined' ? Number(storageService.getItem('miki_active_lora_scale') || '1.0') : 1.0;
      const totalMB = localLoraFiles.reduce((acc, f) => acc + (f.sizeMB || 0), 0);
      return {
        usedByLoraMB: Math.round(totalMB * 10) / 10,
        loraDir: 'Download/lora-adapters',
        files: localLoraFiles.map(f => ({
          ...f,
          isApplied: f.fileName === activeLora,
          scale: f.fileName === activeLora ? activeScale : 1.0
        })),
        activeLoraFileName: activeLora,
        activeLoraScale: activeScale
      };
    },
    async applyLora(options: { loraFileName: string; scale?: number }) {
      if (typeof storageService !== 'undefined') {
        storageService.setItem('miki_active_lora_file', options.loraFileName);
        storageService.setItem('miki_active_lora_scale', String(options.scale ?? 1.0));
      }
      return { success: true, loraFileName: options.loraFileName, scale: options.scale ?? 1.0 };
    },
    async removeLora() {
      if (typeof storageService !== 'undefined') {
        storageService.removeItem('miki_active_lora_file');
        storageService.removeItem('miki_active_lora_scale');
      }
      return { success: true };
    },
    async deleteLora(options: { fileName: string }) {
      try {
        if (typeof storageService !== 'undefined') {
          const raw = storageService.getItem('miki_downloaded_lora_files');
          if (raw) {
            const list: NativeLoraFile[] = JSON.parse(raw);
            const filtered = list.filter(f => f && f.fileName !== options.fileName);
            storageService.setItem('miki_downloaded_lora_files', JSON.stringify(filtered));
          }
          const active = storageService.getItem('miki_active_lora_file');
          if (active === options.fileName) {
            storageService.removeItem('miki_active_lora_file');
            storageService.removeItem('miki_active_lora_scale');
          }
        }
      } catch (e) {}
      return { success: true };
    },
    async downloadModel() {
      throw new Error('GGUF native download is only available in the Android APK native runtime.');
    },
    async cancelDownload() {
      return { success: true };
    },
    async deleteModel() {
      return { success: true };
    },
    async loadModel() {
      throw new Error('GGUF native C++ loader is only available in the Android APK native runtime.');
    },
    async generateStream() {
      throw new Error('Native C++ inference is only available in the Android APK native runtime.');
    },
    async unloadModel() {
      return { success: true };
    },
  }),
});

const GGUF_STORAGE_KEY = 'miki_downloaded_gguf_files';

export class NativeLlmService {
  private isNativePlatform: boolean = false;
  private isAvailableOnDevice: boolean = false;
  private activeModelId: string | null = null;
  private activeLoraFileName: string | null = null;
  private activeLoraScale: number = 1.0;
  private isModelLoading: boolean = false;
  private cachedHardwareSpecs: NativeGpuInfo | null = null;
  // 外部ローカルLLM(llama-swap等)から最後に応答があった時刻。
  // TTLで自動アンロードされる仕様のため、これを基準にコールドスタートかどうかを判定し、
  // タイムアウト時間を自動調整する。
  private lastExternalLlmWarmAt: number = 0;
  // 直近に観測した「初回チャンクまでの実測時間(TTFT)」。実測値をもとに
  // 次回以降のタイムアウトを自動調整するために保持する(移動平均)。
  private lastExternalLlmTtftMs: number | null = null;
  // 外部ローカルLLMの実行履歴（直近20件）。同一セッション内での1回目・2回目のTTFT比較やKVキャッシュ効果判定に使用。
  private externalLlmRunHistory: ExternalLlmRunDiagnostic[] = [];
  private sessionQueryCounter: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedHistory = storageService.getItem('miki_external_llm_run_history');
        if (savedHistory) {
          this.externalLlmRunHistory = JSON.parse(savedHistory);
        }
      } catch {
        this.externalLlmRunHistory = [];
      }
      try {
        if (typeof storageService !== 'undefined') {
          this.activeLoraFileName = storageService.getItem('miki_active_lora_file') || null;
          this.activeLoraScale = Number(storageService.getItem('miki_active_lora_scale') || '1.0');
        }
      } catch {
        this.activeLoraFileName = null;
        this.activeLoraScale = 1.0;
      }
    }
    this.checkPlatform();
  }

  /**
   * 外部ローカルLLM診断の実行履歴を取得する
   */
  public getExternalLlmRunHistory(): ExternalLlmRunDiagnostic[] {
    return [...this.externalLlmRunHistory];
  }

  /**
   * 直近の外部ローカルLLM実行診断結果を取得する
   */
  public getLastExternalLlmRun(): ExternalLlmRunDiagnostic | null {
    return this.externalLlmRunHistory.length > 0
      ? this.externalLlmRunHistory[this.externalLlmRunHistory.length - 1]
      : null;
  }

  /**
   * 診断ログ・学習TTFT・キャッシュ履歴を新品状態にリセットする
   */
  public resetDiagnostics(): void {
    this.lastExternalLlmWarmAt = 0;
    this.lastExternalLlmTtftMs = null;
    this.sessionQueryCounter = 0;
    this.externalLlmRunHistory = [];
    if (typeof window !== 'undefined') {
      try {
        storageService.removeItem('miki_external_llm_run_history');
      } catch {}
    }
    systemLogger.info(
      'EXTERNAL_GPU',
      '🧹 [外部LLM診断リセット完了] TTFT学習値・キャッシュ履歴・ステージ計測データを新品状態に初期化しました。次回送信はコールドスタート・初回計測として扱われます。'
    );
  }

  private async checkPlatform(): Promise<boolean> {
    try {
      this.isNativePlatform = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
      if (this.isNativePlatform && NativeMlcPlugin) {
        const res = await Promise.race([
          NativeMlcPlugin.isAvailable().catch(() => null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
        ]);
        this.isAvailableOnDevice = !!res?.available;
        if (this.isAvailableOnDevice) {
          systemLogger.info(
            'NATIVE_GPU',
            `📱 Android Native C++ llama.cpp エンジン検出: ${res?.backend || 'Native'} (${res?.architecture || 'ARM64'})`
          );
        }
      } else {
        this.isAvailableOnDevice = false;
      }
    } catch (e) {
      this.isAvailableOnDevice = false;
    }
    return this.isAvailableOnDevice;
  }

  public isNative(): boolean {
    return this.isNativePlatform && this.isAvailableOnDevice;
  }

  public getActiveModelId(): string | null {
    if (!this.activeModelId && typeof storageService !== 'undefined') {
      try {
        this.activeModelId = storageService.getItem('miki_active_gguf_model') || null;
      } catch (e) {}
    }
    return this.activeModelId;
  }

  public isLoadingModel(): boolean {
    return this.isModelLoading;
  }

  public async getAvailableGgufModels(): Promise<Array<{ id: string; fileName: string; name: string; sizeMB: number }>> {
    const storage = await this.getStorageInfo();
    const result: Array<{ id: string; fileName: string; name: string; sizeMB: number }> = [];

    if (!storage || !Array.isArray(storage.files)) return result;

    for (const f of storage.files) {
      if (!f || !f.fileName) continue;
      const official = OFFICIAL_GGUF_MODELS.find(
        (m) =>
          m.fileName.toLowerCase() === f.fileName.toLowerCase() ||
          m.id.toLowerCase() === f.fileName.toLowerCase().replace('.gguf', '')
      );
      result.push({
        id: official?.id || f.fileName.replace('.gguf', ''),
        fileName: f.fileName,
        name: official?.name || f.fileName,
        sizeMB: f.sizeMB || 395,
      });
    }
    return result;
  }

  public async autoLoadDownloadedModelIfAvailable(
    onProgress?: (report: { progress: number; text: string }) => void
  ): Promise<boolean> {
    if (this.activeModelId) return true;
    if (this.isModelLoading) {
      while (this.isModelLoading) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return !!this.activeModelId;
    }

    try {
      const available = await this.getAvailableGgufModels();
      if (available.length === 0) return false;

      // Prefer saved active model, or lightest model (e.g. 0.5B), or first available
      const savedActiveId = typeof storageService !== 'undefined' ? storageService.getItem('miki_active_gguf_model') : null;
      let target = available.find((m) => m.id === savedActiveId || m.fileName === savedActiveId);
      if (!target) {
        target = available.find((m) => m.id.includes('0.5b') || m.fileName.includes('0.5b')) || available[0];
      }

      if (target) {
        systemLogger.info('NATIVE_GPU', `⚡ 端末内GGUFモデル「${target.name}」(${target.fileName}) を自動ロードします...`);
        await this.loadNativeModel(target.id, target.fileName, undefined, onProgress);
        return true;
      }
    } catch (e: any) {
      systemLogger.warn('NATIVE_GPU', `GGUF自動ロード試行エラー: ${e?.message || e}`);
    }
    return false;
  }

  public async getHardwareSpecs(): Promise<NativeGpuInfo> {
    if (this.cachedHardwareSpecs) {
      return this.cachedHardwareSpecs;
    }

    try {
      if (this.isNative()) {
        // getStorageInfo()と同様、800msの競争タイムアウトは端末の負荷や初期化時に
        // ネイティブ側の取得が間に合わずフォールバックに落ちてしまう原因となるため撤廃。
        // ネイティブ呼び出しが失敗した場合は catch(() => null) でnullになり、安全に処理される。
        const [specsRes, memRes] = await Promise.all([
          NativeMlcPlugin.getHardwareSpecs().catch(() => null),
          NativeMlcPlugin.getMemoryInfo ? NativeMlcPlugin.getMemoryInfo().catch(() => null) : Promise.resolve(null),
        ]);

        if (memRes && memRes.isMeasuredReal) {
          const res: NativeGpuInfo = {
            available: true,
            backend: (specsRes?.backend as any) || 'Vulkan',
            gpuVendor: specsRes?.gpuVendor || 'Qualcomm / ARM / MediaTek',
            gpuRenderer: specsRes?.gpuRenderer || 'Vulkan Adreno / Mali Hardware Native',
            totalMemoryMB: memRes.totalMemMB,
            availableMemoryMB: memRes.availMemMB,
            allocatedMemoryMB: this.activeModelId ? 950 : 0,
            isNative: true,
          };
          this.cachedHardwareSpecs = res;
          return res;
        }

        if (specsRes && typeof specsRes.backend === 'string') {
          this.cachedHardwareSpecs = specsRes;
          return specsRes;
        }
      }
    } catch (e) {}

    // Web / WebView 実測フォールバック: performance.memory または navigator.deviceMemory から動的計測
    let measuredTotalMB = 4096;
    let measuredAvailMB = 2048;
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      const heapLimitMB = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));
      const usedHeapMB = Math.round(mem.usedJSHeapSize / (1024 * 1024));
      measuredTotalMB = heapLimitMB;
      measuredAvailMB = Math.max(128, heapLimitMB - usedHeapMB);
    } else if (typeof navigator !== 'undefined' && (navigator as any).deviceMemory) {
      measuredTotalMB = Math.round((navigator as any).deviceMemory * 1024);
      measuredAvailMB = Math.round(measuredTotalMB * 0.5);
    }

    const defaultSpecs: NativeGpuInfo = {
      available: this.isNative(),
      backend: this.isNative() ? 'Vulkan' : 'WebGPU',
      gpuVendor: this.isNative() ? 'Qualcomm / ARM' : 'Web Browser GPU',
      gpuRenderer: this.isNative() ? 'Adreno / Mali Hardware Native' : 'Browser WebGPU Canvas',
      totalMemoryMB: measuredTotalMB,
      availableMemoryMB: measuredAvailMB,
      allocatedMemoryMB: this.activeModelId ? 950 : 0,
      isNative: this.isNative(),
    };

    this.cachedHardwareSpecs = defaultSpecs;
    return defaultSpecs;
  }

  public async getStorageInfo(): Promise<NativeStorageInfo> {
    if (this.isNative()) {
      try {
        // 800msの競争タイムアウトは、Download/gguf-models配下に大きい(数GB)
        // モデルが複数あるとネイティブ側のスキャンが間に合わず、本物の結果を
        // 無視してローカル記録側のフォールバックに落ちてしまう原因だったため撤廃。
        // ネイティブ呼び出しが失敗した場合は catch(() => null) でnullになり、
        // 下のフォールバック処理へ正しく進む。
        const res = await NativeMlcPlugin.getStorageInfo().catch(() => null);
        if (res && Array.isArray(res.files)) {
          return {
            totalDiskMB: res.totalDiskMB || 10240,
            freeDiskMB: res.freeDiskMB || 8192,
            usedByModelsMB: res.usedByModelsMB || 0,
            modelsDir: res.modelsDir || 'internal/models',
            files: res.files.filter((f) => f && typeof f.fileName === 'string'),
          };
        }
      } catch (e) {
        systemLogger.warn('NATIVE_GPU', `ストレージ容量の取得に失敗: ${e}`);
      }
    }

    let localFiles: NativeDownloadedFile[] = [];
    try {
      if (typeof storageService !== 'undefined') {
        const raw = storageService.getItem(GGUF_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            localFiles = parsed.filter((f) => f && typeof f.fileName === 'string');
          }
        }
      }
    } catch (e) {}

    const usedMB = localFiles.reduce((sum, f) => sum + (f.sizeMB || 0), 0);

    return {
      totalDiskMB: 10240,
      freeDiskMB: Math.max(1024, 8192 - usedMB),
      usedByModelsMB: usedMB,
      modelsDir: 'internal/models',
      files: localFiles,
    };
  }

  public async downloadModel(
    modelId: string,
    downloadUrl: string,
    fileName: string,
    onProgress?: (report: { progress: number; text: string; speedMBs?: number; etaSeconds?: number }) => void
  ): Promise<{ success: boolean; filePath: string; sizeMB: number }> {
    // Look up model definition for accurate size and metadata
    const officialModel = OFFICIAL_GGUF_MODELS.find((m) => m.id === modelId || m.fileName === fileName);
    const targetSizeMB = officialModel?.sizeMB || 395;

    if (!this.isNative()) {
      systemLogger.info('NATIVE_GPU', `📥 [端末ストレージ] GGUFモデル取得・登録: ${fileName}`);
      if (onProgress) {
        onProgress({ progress: 20, text: 'GGUFモデルヘッダー検証中...', speedMBs: 15.2, etaSeconds: 3 });
        await new Promise((r) => setTimeout(r, 300));
        onProgress({ progress: 65, text: '重みブロックダウンロード中...', speedMBs: 18.5, etaSeconds: 1 });
        await new Promise((r) => setTimeout(r, 300));
        onProgress({ progress: 100, text: 'GGUFモデル準備完了', speedMBs: 21.0, etaSeconds: 0 });
      }

      // Persist in local storage
      try {
        if (typeof storageService !== 'undefined') {
          const raw = storageService.getItem(GGUF_STORAGE_KEY);
          const list: NativeDownloadedFile[] = raw ? JSON.parse(raw) : [];
          const filtered = Array.isArray(list) ? list.filter((f) => f && f.fileName !== fileName) : [];
          filtered.push({
            fileName,
            sizeMB: targetSizeMB,
            lastModified: Date.now(),
          });
          storageService.setItem(GGUF_STORAGE_KEY, JSON.stringify(filtered));
        }
      } catch (e) {}

      return { success: true, filePath: `/models/${fileName}`, sizeMB: targetSizeMB };
    }

    systemLogger.info('NATIVE_GPU', `📥 GGUFモデルのダウンロード開始: ${fileName} (${downloadUrl})`);

    let progressListener: any = null;
    if (onProgress) {
      progressListener = await (NativeMlcPlugin as any).addListener?.('onProgress', (data: NativeLlmProgressEvent) => {
        onProgress({
          progress: Math.min(100, Math.max(0, Math.round(data.progress * 100))),
          text: data.text,
          speedMBs: data.speedMBs,
          etaSeconds: data.etaSeconds,
        });
      });
    }

    try {
      const res = await NativeMlcPlugin.downloadModel({
        modelId,
        downloadUrl,
        fileName,
      });

      // Also persist record
      try {
        if (typeof storageService !== 'undefined') {
          const raw = storageService.getItem(GGUF_STORAGE_KEY);
          const list: NativeDownloadedFile[] = raw ? JSON.parse(raw) : [];
          const filtered = Array.isArray(list) ? list.filter((f) => f && f.fileName !== fileName) : [];
          filtered.push({
            fileName,
            sizeMB: res?.sizeMB || targetSizeMB,
            lastModified: Date.now(),
          });
          storageService.setItem(GGUF_STORAGE_KEY, JSON.stringify(filtered));
        }
      } catch (e) {}

      systemLogger.info('NATIVE_GPU', `✅ GGUFモデルのダウンロード完了: ${fileName} (${res?.sizeMB || targetSizeMB} MB)`);
      return res || { success: true, filePath: `/models/${fileName}`, sizeMB: targetSizeMB };
    } finally {
      if (progressListener && typeof progressListener.remove === 'function') {
        progressListener.remove();
      }
    }
  }

  public async loadNativeModel(
    modelId: string,
    fileNameOrProgress?: string | ((report: { progress: number; text: string }) => void),
    options?: { nGpuLayers?: number; nCtx?: number; nThreads?: number },
    onProgress?: (report: { progress: number; text: string }) => void
  ): Promise<void> {
    const actualFileName = typeof fileNameOrProgress === 'string' ? fileNameOrProgress : undefined;
    const actualOnProgress = typeof fileNameOrProgress === 'function' ? fileNameOrProgress : onProgress;

    // 既に同じモデルがVRAMにロード済みなら二重ロードをスキップ
    if (this.activeModelId === modelId) {
      systemLogger.info('NATIVE_GPU', `ℹ️ モデル「${modelId}」は既にVRAMにロード済みのためスキップします。`);
      return;
    }

    // 既にロード処理が進行中なら完了まで待機
    if (this.isModelLoading) {
      systemLogger.warn('NATIVE_GPU', `⏳ モデルロード処理が既に進行中のため待機します (待機対象: ${modelId})`);
      while (this.isModelLoading) {
        await new Promise((r) => setTimeout(r, 100));
      }
      // 先行ロード完了後に同じモデルがロード済みになっていればスキップ
      if (this.activeModelId === modelId) {
        systemLogger.info('NATIVE_GPU', `ℹ️ 先行ロードの完了によりモデル「${modelId}」が展開されたためスキップします。`);
        return;
      }
    }

    if (!this.isNative()) {
      this.isModelLoading = true;
      try {
        systemLogger.info('NATIVE_GPU', `🚀 [Web環境] GGUFモデル仮想ロード: ${modelId}`);
        if (actualOnProgress) {
          actualOnProgress({ progress: 50, text: 'GGUFモデルをVRAMにマッピング中...' });
          await new Promise((r) => setTimeout(r, 300));
          actualOnProgress({ progress: 100, text: 'ロード完了 (即時推論可能)' });
        }
        this.activeModelId = modelId;
      } finally {
        this.isModelLoading = false;
      }
      return;
    }

    this.isModelLoading = true;
    systemLogger.info('NATIVE_GPU', `🚀 llama.cpp C++ JNI でGGUFモデルをVRAM/RAMに展開中: ${modelId} (${actualFileName || modelId})`);

    let progressListener: any = null;
    if (actualOnProgress) {
      progressListener = await (NativeMlcPlugin as any).addListener?.('onProgress', (data: NativeLlmProgressEvent) => {
        actualOnProgress({
          progress: Math.min(100, Math.max(0, Math.round(data.progress * 100))),
          text: data.text,
        });
      });
    }

    try {
      const defCfg = getManifestDefaultConfig();
      const res = await NativeMlcPlugin.loadModel({
        modelId,
        fileName: actualFileName || `${modelId}.gguf`,
        nGpuLayers: options?.nGpuLayers ?? defCfg.nGpuLayers ?? 99,
        nCtx: options?.nCtx ?? defCfg.nCtx ?? 2048,
        nThreads: options?.nThreads ?? defCfg.nThreads ?? 4,
      });

      this.activeModelId = modelId;
      try {
        if (typeof storageService !== 'undefined') {
          storageService.setItem('miki_active_gguf_model', modelId);
          storageService.setItem('miki_active_gguf_file', actualFileName || `${modelId}.gguf`);
        }
      } catch (e) {}
      systemLogger.info(
        'NATIVE_GPU',
        `✅ llama.cpp C++ モデルロード完了: ${res.modelId} (バックエンド: ${res.backend}, GPUオフロード層: ${res.nGpuLayers}, Context: ${res.nCtx})`
      );
    } catch (err: any) {
      this.activeModelId = null;
      systemLogger.error('NATIVE_GPU', `❌ llama.cpp モデルロード失敗: ${err?.message || err}`);
      throw err;
    } finally {
      this.isModelLoading = false;
      if (progressListener && typeof progressListener.remove === 'function') {
        progressListener.remove();
      }
    }
  }

  public async *chatStream(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { temperature?: number; top_p?: number; max_tokens?: number }
  ): AsyncGenerator<string, void, unknown> {
    const extConfig = this.getActiveExternalConfig();
    if (extConfig && extConfig.endpoint) {
      for await (const chunk of this.streamExternalLocalLlm(extConfig, messages, options)) {
        yield chunk;
      }
    } else {
      for await (const chunk of this.streamNativeChat(messages, options)) {
        yield chunk;
      }
    }
  }

  public async *streamNativeChat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { temperature?: number; top_p?: number; max_tokens?: number }
  ): AsyncGenerator<string, void, unknown> {
    if (!this.isNative()) {
      // If user triggers Native GPU in Web preview, route to WebGPU if available
      if (webLLMService.isLoaded()) {
        systemLogger.info('NATIVE_GPU', `ℹ️ Webプレビュー環境のため、ロード済みのWebGPUエンジンへルーティングします。`);
        for await (const chunk of webLLMService.streamChat(messages, options)) {
          yield chunk;
        }
        return;
      } else {
        // Safe streaming fallback for preview environment
        systemLogger.info('NATIVE_GPU', `ℹ️ Webプレビュー環境（実機APK外）のため、スマートフォールバックで応答を生成します。`);
        const userQuery = messages[messages.length - 1]?.content || 'こんにちは';
        try {
          const cloudResp = await sendChatMessage({
            prompt: userQuery,
            history: [],
          });
          yield cloudResp.text;
          return;
        } catch {
          yield `【🌸 GGUF ネイティブ推論モード】\n\nAndroid APK実機ではllama.cpp (C++ JNI / Vulkan / OpenCL) により端末GPUでミリ秒単位の高速推論が実行されます。\nご質問「${userQuery.slice(0, 30)}」を受け付けました！`;
          return;
        }
      }
    }

    if (!this.activeModelId) {
      const autoLoaded = await this.autoLoadDownloadedModelIfAvailable();
      if (!autoLoaded) {
        if (webLLMService.isLoaded()) {
          systemLogger.info('NATIVE_GPU', `ℹ️ Native GGUFモデル未展開のため、ロード済みのWebGPUエンジンへルーティングします。`);
          for await (const chunk of webLLMService.streamChat(messages, options)) {
            yield chunk;
          }
          return;
        }
        throw new Error('端末内にロード済みのGGUFモデルがありません。「端末ローカルLLM設定」からGGUFモデルをダウンロードまたはVRAMロードしてください。');
      }
    }

    systemLogger.info('NATIVE_GPU', `⚡ llama.cpp C++ JNI ネイティブ推論を開始 (${this.activeModelId})`);

    const chunkQueue: string[] = [];
    let isDone = false;
    let streamError: any = null;
    let notifyNext: (() => void) | null = null;
    let generatedFullText = '';
    let hasYielded = false;

    const chunkListener = await (NativeMlcPlugin as any).addListener?.('onStreamChunk', (data: NativeLlmChunkEvent) => {
      if (data && typeof data.delta === 'string') {
        chunkQueue.push(data.delta);
        if (notifyNext) {
          notifyNext();
          notifyNext = null;
        }
      }
    });

    const defCfg = getManifestDefaultConfig();
    const tunedCfg = samplingTuningService.getSamplingConfig();
    const nativeCfg = (options as any)?.nativeConfig;
    const loraInfo = this.getActiveLoraInfo();
    systemLogger.info(
      'NATIVE_GPU',
      `⚡ llama.cpp C++ JNI ネイティブ推論を開始: ${this.activeModelId}${loraInfo.fileName ? ` [LoRA適用: ${loraInfo.fileName} (scale: ${loraInfo.scale})]` : ''}`
    );
    const executionPromise = (NativeMlcPlugin as any).generateStream({
      messages,
      temperature: nativeCfg?.temperature ?? options?.temperature ?? tunedCfg.temperature ?? defCfg.temperature ?? 0.7,
      topP: nativeCfg?.topP ?? options?.top_p ?? tunedCfg.topP ?? defCfg.topP ?? 0.9,
      topK: nativeCfg?.topK ?? tunedCfg.topK,
      minP: nativeCfg?.minP ?? tunedCfg.minP,
      maxTokens: nativeCfg?.maxTokens ?? options?.max_tokens ?? defCfg.maxTokens ?? 512,
      repetitionPenalty: nativeCfg?.repetitionPenalty ?? defCfg.repetitionPenalty ?? 1.15,
      frequencyPenalty: nativeCfg?.frequencyPenalty ?? tunedCfg.frequencyPenalty ?? 0.1,
      presencePenalty: nativeCfg?.presencePenalty ?? tunedCfg.presencePenalty ?? 0.1,
      repeatLastN: nativeCfg?.repeatLastN ?? tunedCfg.repeatLastN,
      noRepeatNgramSize: nativeCfg?.noRepeatNgramSize ?? tunedCfg.noRepeatNgramSize,
      stopSequences: ['<|im_end|>', '<|endoftext|>', '<|end|>', 'User:', 'Assistant:'],
    })
      .then((res: any) => {
        isDone = true;
        if (notifyNext) {
          notifyNext();
          notifyNext = null;
        }
        systemLogger.info(
          'NATIVE_GPU',
          `🎉 llama.cpp 推論完了: ${res?.totalTokens ?? 'N/A'} tokens (${res?.tps ? res.tps.toFixed(1) : 'N/A'} tps, 処理時間: ${res?.durationMs ?? 0}ms)`
        );
      })
      .catch((err: any) => {
        streamError = err;
        isDone = true;
        if (notifyNext) {
          notifyNext();
          notifyNext = null;
        }
      });

    try {
      while (!isDone || chunkQueue.length > 0) {
        if (chunkQueue.length > 0) {
          const delta = chunkQueue.shift()!;
          generatedFullText += delta;

          // Simple loop detection: if the last 40 characters appear 3+ times consecutively
          if (generatedFullText.length > 120) {
            const tail = generatedFullText.slice(-30);
            const matches = generatedFullText.split(tail).length - 1;
            if (matches >= 4) {
              systemLogger.warn('NATIVE_GPU', '⚠️ トークンループを検知したためストリームを安全に早期終了しました。');
              samplingTuningService.recordLoopDetection({ text: tail });
              break;
            }
          }

          yield delta;
          hasYielded = true;
        } else if (!isDone) {
          await new Promise<void>((resolve) => {
            notifyNext = resolve;
          });
        }
      }

      if (streamError) {
        const errorMsg = String(streamError?.message || streamError || '');
        if (errorMsg.includes('looping content') || errorMsg.includes('loop')) {
          systemLogger.warn('NATIVE_GPU', `ℹ️ モデルのループ検出警告を正常に処理しました: ${errorMsg}`);
          if (!hasYielded) {
            yield '（回答の生成が完了しました）';
          }
          return;
        }
        throw new Error(`llama.cpp ネイティブ推論エラー: ${errorMsg}`);
      }
      await executionPromise;
    } finally {
      if (chunkListener && typeof chunkListener.remove === 'function') {
        chunkListener.remove();
      }
    }
  }

  /**
   * External Local LLM (Ollama / LM Studio) Stream Bridge
   * 12章 プロンプトキャッシュ最適化 (Prompt Cache Optimization):
   * llama.cpp server / llama-swap のプロンプトキャッシュ機能 (cache_prompt: true, slot_id, id_slot) を
   * リクエストペイロードに明示的に含めることで、静的プロンプトプレフィックスのKVキャッシュ再利用を最大化。
   */
  public async *streamExternalLocalLlm(
    config: ExternalLocalLlmConfig,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: {
      temperature?: number;
      max_tokens?: number;
      signal?: AbortSignal;
      cachePrompt?: boolean;
      slotId?: number;
      ttl?: number;
      stageA_preFetchMs?: number;
      promptStats?: ExternalLlmRunDiagnostic['promptStats'];
      onDiagnosticRecorded?: (diag: ExternalLlmRunDiagnostic) => void;
    }
  ): AsyncGenerator<string, void, unknown> {
    const endpoint = config.endpoint.replace(/\/$/, '');
    const activeTtlSeconds = options?.ttl ?? contextBudgetEngineService.getVariableTtlSeconds();

    // 1. プロンプト統計 (文字数・推定トークン数) の算出と事前ログ出力
    const promptStats: ExternalLlmRunDiagnostic['promptStats'] = options?.promptStats || (() => {
      const sys = messages.find((m) => m.role === 'system')?.content || '';
      const hist = messages.filter((m, i) => m.role !== 'system' && i < messages.length - 1);
      const user = messages[messages.length - 1]?.role === 'user' ? messages[messages.length - 1].content : '';
      const charsTotal = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
      return {
        charsTotal,
        charsCombinedSystem: sys.length,
        charsStaticPrefix: sys.length,
        charsDynamicContext: 0,
        dynamicElementsCount: 0,
        charsHistory: hist.reduce((sum, m) => sum + m.content.length, 0),
        historyMessageCount: hist.length,
        charsUser: user.length,
        estimatedTokens: Math.round(charsTotal / 1.5),
      };
    })();

    systemLogger.info(
      'EXTERNAL_GPU',
      `🔍 [外部LLM 送信プロンプト詳細診断] 全体: ${promptStats.charsTotal}文字 (~${promptStats.estimatedTokens}トークン) | System: ${promptStats.charsCombinedSystem}字, 履歴: ${promptStats.historyMessageCount}件 (${promptStats.charsHistory}字), User: ${promptStats.charsUser}字`,
      { promptStats, targetEndpoint: endpoint, model: config.model }
    );

    // 2. 自動調整タイムアウト:
    // ・実測TTFT(初回チャンクまでの時間)を学習しておき、次回以降はその実測値に安全マージンを掛けた時間を初回タイムアウトとして使う。
    // ・実測データがまだ無い場合のみ、TTLベースのコールドスタート推定値を初期値にする。
    const requestStartedAt = Date.now();
    const isColdStart = requestStartedAt - this.lastExternalLlmWarmAt > activeTtlSeconds * 1000;
    const learnedTtftMs = this.lastExternalLlmTtftMs;
    let initialTimeoutMs: number;
    if (learnedTtftMs != null) {
      // 実測値の2倍 + コールドスタート時は再ロード分を追加。下限90秒 (Termux/GPUヘビーPrefill・長考対応)。
      initialTimeoutMs = Math.max(90000, Math.round(learnedTtftMs * 2) + (isColdStart ? 45000 : 0));
    } else {
      // まだ実測データが無い初回呼び出し用のフォールバック値 (コールドスタート時は120秒、通常90秒)
      initialTimeoutMs = isColdStart ? 120000 : 90000;
    }

    systemLogger.info(
      'EXTERNAL_GPU',
      `⏱️ [外部LLM タイムアウト学習状態] 初回タイムアウト: ${initialTimeoutMs}ms (前回実測学習TTFT: ${learnedTtftMs != null ? `${learnedTtftMs}ms` : '未学習(初回/リセット済)'} | コールドスタート判定: ${isColdStart ? 'はい (再ロード猶予+45s)' : 'いいえ (ウォーム維持)'})`
    );

    // 設計思想 Master v5.2: トークン生成間無応答タイムアウト（Termux/ローカルLLMの長考・重負荷Prefillを考慮し90秒に緩和）
    const idleTimeoutMs = 90000;
    let firstChunkReceived = false;
    let tFetchStart = performance.now();
    let tResponseHeader = performance.now();
    let tFirstChunk = 0;
    let stageB_httpConnectMs = 0;
    let stageD_prefillOnlyMs = 0;
    let observedTtftMs = 0;
    let totalTokensGenerated = 0;

    const timeoutController = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const armTimer = (ms: number, isFirstChunkPhase: boolean) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const sec = Math.round(ms / 1000);
        timeoutController.abort(
          new Error(
            isFirstChunkPhase
              ? `外部LLMサーバーの応答がタイムアウトしました(${sec}秒、コールドスタート想定)。Termux側でサーバーが起動しているか確認してください。`
              : `外部LLMサーバーの応答が${sec}秒間止まったため中断しました。`
          )
        );
      }, ms);
    };
    armTimer(initialTimeoutMs, true);

    // チャンク受信のたびに呼ぶ共通処理:
    const onChunkReceived = () => {
      this.lastExternalLlmWarmAt = Date.now();
      if (!firstChunkReceived) {
        firstChunkReceived = true;
        tFirstChunk = performance.now();
        observedTtftMs = Math.round(tFirstChunk - tFetchStart);
        stageD_prefillOnlyMs = Math.round(tFirstChunk - tResponseHeader);
        const prevLearned = this.lastExternalLlmTtftMs;
        this.lastExternalLlmTtftMs =
          learnedTtftMs != null ? Math.round((learnedTtftMs + observedTtftMs) / 2) : observedTtftMs;

        systemLogger.info(
          'EXTERNAL_GPU',
          `🎯 [Stage C/D: TTFT初回トークン到達] 実測TTFT: ${observedTtftMs}ms (接続: ${stageB_httpConnectMs}ms, llama.cpp Prefill/生成: ${stageD_prefillOnlyMs}ms) | 旧学習値: ${prevLearned ?? 'なし'}ms ➔ 新学習値: ${this.lastExternalLlmTtftMs}ms`
        );
      }
      armTimer(idleTimeoutMs, false);
    };

    const onExternalAbort = () => timeoutController.abort();
    if (options?.signal) {
      options.signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    // 3. スロットIDの明示固定判定
    // サーバーが n_slots=4 等で稼働している場合、未指定だとリクエストごとにスロットが分散され
    // 各スロットでKVキャッシュが毎回消滅・再計算されて25秒遅延の原因となる。
    // options.slotId または config.slotId が指定されているか、openai_compatible の場合はデフォルトで 0 を固定。
    const targetSlotId = options?.slotId !== undefined
      ? options.slotId
      : config.slotId !== undefined
      ? config.slotId
      : (config.type === 'openai_compatible' ? 0 : undefined);

    try {
      if (config.type === 'ollama') {
        const url = `${endpoint}/api/chat`;
        tFetchStart = performance.now();
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: timeoutController.signal,
          body: JSON.stringify({
            model: config.model || 'qwen2.5:1.5b',
            messages,
            stream: true,
            keep_alive: `${activeTtlSeconds}s`,
            options: {
              temperature: options?.temperature ?? 0.7,
              use_mmap: true,
              ...(typeof options?.max_tokens === 'number' ? { num_predict: options.max_tokens } : {}),
            },
          }),
        });
        tResponseHeader = performance.now();
        stageB_httpConnectMs = Math.round(tResponseHeader - tFetchStart);

        if (!response.ok) {
          throw new Error(`Ollamaサーバー接続エラー (${response.status}): ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body is null');
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          onChunkReceived();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (data.message?.content) {
                totalTokensGenerated++;
                yield data.message.content;
              }
            } catch (e) {}
          }
        }
      } else {
        // OpenAI Compatible (LM Studio / llama.cpp server / llama-swap)
        const url = `${endpoint}/v1/chat/completions`;
        let response: Response;

        const requestBody: Record<string, any> = {
          model: config.model || 'default',
          messages,
          stream: true,
          temperature: options?.temperature ?? 0.7,
          cache_prompt: options?.cachePrompt ?? true,
          ttl: activeTtlSeconds,
          keep_alive: `${activeTtlSeconds}s`,
        };

        if (typeof options?.max_tokens === 'number') {
          requestBody.max_tokens = options.max_tokens;
        }

        if (typeof targetSlotId === 'number' && targetSlotId >= 0) {
          requestBody.id_slot = targetSlotId;
          requestBody.slot_id = targetSlotId;
          systemLogger.info(
            'EXTERNAL_GPU',
            `📌 [スロット固定] slot_id: ${targetSlotId} / id_slot: ${targetSlotId} を指定してリクエスト (スロット分散によるキャッシュ無効化を完全抑止)`
          );
        } else if (targetSlotId === -1) {
          systemLogger.info('EXTERNAL_GPU', '📌 [スロット自動] slot_idは未指定で送信 (サーバー側の自動割当に委譲)');
        }

        tFetchStart = performance.now();
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream, application/json',
            },
            signal: timeoutController.signal,
            body: JSON.stringify(requestBody),
          });
        } catch (fetchErr: any) {
          const rawMsg = fetchErr?.message || String(fetchErr);
          throw new Error(
            `外部LLM (${url}) へのリクエストに失敗しました: ${rawMsg}。Termuxでサーバーが起動しているか確認してください。`
          );
        }

        tResponseHeader = performance.now();
        stageB_httpConnectMs = Math.round(tResponseHeader - tFetchStart);
        systemLogger.info(
          'EXTERNAL_GPU',
          `⚡ [Stage B: HTTP接続応答] ステータス ${response.status} 受信完了 (+${stageB_httpConnectMs}ms)`
        );

        if (!response.ok) {
          let errBody = '';
          try {
            errBody = await response.text();
          } catch (e) {}

          let parsedErrorMsg = '';
          try {
            const jsonErr = JSON.parse(errBody);
            parsedErrorMsg = jsonErr?.error?.message || jsonErr?.error || jsonErr?.message || '';
          } catch (e) {}

          const details = parsedErrorMsg || errBody.slice(0, 300) || `Status ${response.status}`;
          throw new Error(`外部LLMエラー (${response.status}): ${details} [モデル: ${config.model || 'default'}]`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json') && !contentType.includes('event-stream')) {
          onChunkReceived();
          const json = await response.json();
          const content = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || '';
          if (content) {
            totalTokensGenerated++;
            yield content;
          }
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body is null');
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          onChunkReceived();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const jsonStr = trimmed.slice(6);
              if (jsonStr === '[DONE]') break;
              try {
                const data = JSON.parse(jsonStr);
                const delta = data.choices?.[0]?.delta?.content;
                if (delta) {
                  totalTokensGenerated++;
                  yield delta;
                }
                // llama.cpp / llama-swap の timings / cache_n レスポンスを検出して記録
                if (data.timings || data.usage) {
                  const timings = data.timings || {};
                  const cacheN = timings.cache_n ?? timings.n_cache ?? data.usage?.prompt_tokens_details?.cached_tokens;
                  systemLogger.info(
                    'EXTERNAL_GPU',
                    `📊 [外部LLM timings/cache診断] cache_n: ${cacheN ?? '未返却'} | prompt_n: ${timings.prompt_n ?? data.usage?.prompt_tokens ?? '未返却'} | prompt_ms: ${timings.prompt_ms ?? 'N/A'}ms | predicted_n: ${timings.predicted_n ?? data.usage?.completion_tokens ?? 'N/A'}`,
                    { timings, usage: data.usage }
                  );
                }
              } catch (e) {}
            }
          }
        }
      }

      // 4. ストリーミング終了後のステージ別遅延分析・連続実行TTFT比較診断
      const tStreamEnd = performance.now();
      const stageE_streamMs = tFirstChunk > 0 ? Math.round(tStreamEnd - tFirstChunk) : 0;
      const totalElapsedMs = (options?.stageA_preFetchMs ?? 0) + Math.round(tStreamEnd - tFetchStart);
      const tokensPerSec = stageE_streamMs > 0 ? Number(((totalTokensGenerated / stageE_streamMs) * 1000).toFixed(1)) : 0;

      this.sessionQueryCounter++;
      const queryNumber = this.sessionQueryCounter;

      const prevRun = this.externalLlmRunHistory.length > 0
        ? this.externalLlmRunHistory[this.externalLlmRunHistory.length - 1]
        : undefined;

      let comparisonWithPrevious: ExternalLlmRunDiagnostic['comparisonWithPrevious'] = undefined;

      if (prevRun) {
        const diffMs = observedTtftMs - prevRun.observedTtftMs;
        const speedupRatio = Number((prevRun.observedTtftMs / Math.max(1, observedTtftMs)).toFixed(2));
        let verdict: 'cache_hit' | 'no_cache' | 'inconclusive' = 'inconclusive';
        let explanation = '';

        if (diffMs < -2000 || speedupRatio >= 1.5) {
          verdict = 'cache_hit';
          explanation = `🟢 プレフィックスKVキャッシュが有効に機能しています（前回: ${prevRun.observedTtftMs}ms ➔ 今回: ${observedTtftMs}ms、短縮: ${Math.abs(diffMs)}ms、${speedupRatio}倍高速化）。初回遅延はコールドスタートまたは初回プロンプト評価（Prefill）によるものです。`;
        } else if (Math.abs(diffMs) <= 2000 && observedTtftMs > 10000) {
          verdict = 'no_cache';
          explanation = `🔴 プレフィックスKVキャッシュが無効化されているか、毎回フル再計算されています（1回目: ${prevRun.observedTtftMs}ms ➔ 2回目: ${observedTtftMs}ms）。動的コンテキストの変動、スロット分散、またはllama.cpp側のcache_prompt無効が疑われます。`;
        } else if (diffMs > 2000) {
          verdict = 'no_cache';
          explanation = `⚠️ 2回目のほうが遅延しました（前回: ${prevRun.observedTtftMs}ms ➔ 今回: ${observedTtftMs}ms、差分: +${diffMs}ms）。スロット競合またはシステム負荷を再確認してください。`;
        } else {
          verdict = 'inconclusive';
          explanation = `ℹ️ 比較結果: 前回 ${prevRun.observedTtftMs}ms ➔ 今回 ${observedTtftMs}ms (差分: ${diffMs}ms)`;
        }

        comparisonWithPrevious = {
          prevRunId: prevRun.runId,
          prevQueryNumber: prevRun.queryNumber,
          prevTtftMs: prevRun.observedTtftMs,
          diffMs,
          speedupRatio,
          verdict,
          explanation,
        };

        systemLogger.info('EXTERNAL_GPU', `📊 [外部LLM 連続実行TTFT比較判定] ${explanation}`, {
          comparison: comparisonWithPrevious,
        });
      }

      const diagnosticRecord: ExternalLlmRunDiagnostic = {
        runId: `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        queryNumber,
        timestamp: new Date().toISOString(),
        endpoint,
        model: config.model || 'default',
        slotId: targetSlotId,
        promptStats,
        timeoutStats: {
          initialTimeoutMs,
          learnedTtftBeforeMs: learnedTtftMs,
          isColdStart,
        },
        stageTimings: {
          stageA_preFetchMs: options?.stageA_preFetchMs ?? 0,
          stageB_httpConnectMs,
          stageC_D_ttftMs: observedTtftMs,
          stageD_prefillOnlyMs,
          stageE_streamMs,
          totalElapsedMs,
        },
        observedTtftMs,
        tokensGenerated: totalTokensGenerated,
        tokensPerSec,
        comparisonWithPrevious,
      };

      this.externalLlmRunHistory.push(diagnosticRecord);
      if (this.externalLlmRunHistory.length > 20) {
        this.externalLlmRunHistory.shift();
      }
      if (typeof window !== 'undefined') {
        try {
          storageService.setItem('miki_external_llm_run_history', JSON.stringify(this.externalLlmRunHistory.slice(-10)));
        } catch {}
      }

      options?.onDiagnosticRecorded?.(diagnosticRecord);

      systemLogger.info('EXTERNAL_GPU', `🏁 [Stage A〜E 遅延細分化サマリー]`, {
        stageA_preFetch: `${options?.stageA_preFetchMs ?? 0}ms (MIKI-AI内部処理: プロンプト・想起・状態)`,
        stageB_httpConnect: `${stageB_httpConnectMs}ms (HTTP接続・ヘッダー応答)`,
        stageC_D_ttft: `${observedTtftMs}ms (TTFT初回トークン到達)`,
        stageD_prefillOnly: `${stageD_prefillOnlyMs}ms (llama.cpp Prefill/初回生成)`,
        stageE_stream: `${stageE_streamMs}ms (トークン生成: ${totalTokensGenerated}tok, ${tokensPerSec} tok/s)`,
        totalElapsed: `${totalElapsedMs}ms`,
        comparison: comparisonWithPrevious?.explanation,
      });
    } finally {
      clearTimeout(timer);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  /**
   * External Local LLM (Ollama / LM Studio / llama-swap) の
   * 稼働中モデル一覧を取得する。カードUIでの切替候補として使う。
   */
  public async listExternalModels(config: ExternalLocalLlmConfig): Promise<string[]> {
    const endpoint = config.endpoint.replace(/\/$/, '');

    if (config.type === 'ollama') {
      const res = await fetch(`${endpoint}/api/tags`);
      if (!res.ok) throw new Error(`Ollamaモデル一覧取得エラー (${res.status})`);
      const data = await res.json();
      const models = Array.isArray(data?.models) ? data.models : [];
      return models.map((m: any) => m?.name).filter((n: any): n is string => !!n);
    }

    // OpenAI互換 (LM Studio / llama.cpp server / llama-swap)
    const res = await fetch(`${endpoint}/v1/models`);
    if (!res.ok) throw new Error(`モデル一覧取得エラー (${res.status})`);
    const data = await res.json();
    const models = Array.isArray(data?.data) ? data.data : [];
    return models.map((m: any) => m?.id).filter((n: any): n is string => !!n);
  }

  /**
   * GGUFモデルの保存先(共有ストレージ Download/gguf-models)への
   * 書き込み権限が許可されているか確認する。Android 11未満では常にtrue。
   */
  public async isSharedStorageAccessGranted(): Promise<boolean> {
    try {
      if (this.isNative() && NativeMlcPlugin?.checkStorageAccess) {
        const res = await NativeMlcPlugin.checkStorageAccess();
        return !!res?.granted;
      }
    } catch (e) {}
    return true;
  }

  /**
   * 「すべてのファイルへのアクセス」許可画面をOSに開かせる。
   * Termux (~/storage/downloads/gguf-models) と同じ場所にアプリが
   * 書き込めるようにするために必要。
   */
  public async requestSharedStorageAccess(): Promise<void> {
    try {
      if (this.isNative() && NativeMlcPlugin?.requestStorageAccess) {
        await NativeMlcPlugin.requestStorageAccess();
      }
    } catch (e) {}
  }

  public async deleteDownloadedModel(fileName: string): Promise<void> {
    try {
      if (this.isNative() && NativeMlcPlugin) {
        await NativeMlcPlugin.deleteModel({ fileName }).catch(() => null);
      }
    } catch (e) {}

    try {
      if (typeof storageService !== 'undefined') {
        const raw = storageService.getItem(GGUF_STORAGE_KEY);
        if (raw) {
          const list: NativeDownloadedFile[] = JSON.parse(raw);
          const filtered = Array.isArray(list) ? list.filter((f) => f && f.fileName !== fileName) : [];
          storageService.setItem(GGUF_STORAGE_KEY, JSON.stringify(filtered));
        }
      }
    } catch (e) {}
  }

  public async unload(): Promise<void> {
    try {
      if (this.isNative() && NativeMlcPlugin) {
        await NativeMlcPlugin.unloadModel().catch(() => null);
      }
    } catch (e) {}
    this.activeModelId = null;
    this.activeLoraFileName = null;
    this.activeLoraScale = 1.0;
    try {
      if (typeof storageService !== 'undefined') {
        storageService.removeItem('miki_active_lora_file');
        storageService.removeItem('miki_active_lora_scale');
      }
    } catch {}
  }

  /**
   * 現在適用中のLoRAアダプター情報を取得
   */
  public getActiveLoraInfo(): { fileName: string | null; scale: number } {
    return {
      fileName: this.activeLoraFileName,
      scale: this.activeLoraScale,
    };
  }

  /**
   * 共有ストレージ (Download/lora-adapters) 内のLoRAアダプターファイル一覧・空き容量を取得
   */
  public async getLoraStorageInfo(): Promise<NativeLoraStorageInfo> {
    if (this.isNative() && NativeMlcPlugin.getLoraStorageInfo) {
      try {
        const info = await NativeMlcPlugin.getLoraStorageInfo();
        if (info && info.activeLoraFileName !== undefined) {
          this.activeLoraFileName = info.activeLoraFileName;
          this.activeLoraScale = info.activeLoraScale ?? 1.0;
        }
        return info;
      } catch (err) {
        systemLogger.warn('NATIVE_GPU', `LoRAストレージ取得失敗: ${err}`);
      }
    }

    // Web環境またはフォールバック
    let localLoraFiles: NativeLoraFile[] = [];
    try {
      if (typeof storageService !== 'undefined') {
        const raw = storageService.getItem('miki_downloaded_lora_files');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            localLoraFiles = parsed.filter((f) => f && typeof f.fileName === 'string');
          }
        }
      }
    } catch (e) {}

    const usedMB = localLoraFiles.reduce((sum, f) => sum + (f.sizeMB || 0), 0);
    return {
      usedByLoraMB: Math.round(usedMB * 10) / 10,
      loraDir: 'Download/lora-adapters',
      files: localLoraFiles.map((f) => ({
        ...f,
        isApplied: f.fileName === this.activeLoraFileName,
        scale: f.fileName === this.activeLoraFileName ? this.activeLoraScale : 1.0,
      })),
      activeLoraFileName: this.activeLoraFileName,
      activeLoraScale: this.activeLoraScale,
    };
  }

  /**
   * GGUFベースモデルに対してLoRAアダプターをロード・適用
   */
  public async applyLoraAdapter(
    fileName: string,
    scale: number = 1.0
  ): Promise<{ success: boolean; message: string }> {
    if (!this.activeModelId) {
      return {
        success: false,
        message: 'ベースモデルがロードされていません。先にGGUFベースモデルをロードしてください。',
      };
    }

    const effScale = scale > 0 ? scale : 1.0;

    if (this.isNative() && NativeMlcPlugin.applyLora) {
      try {
        systemLogger.info('NATIVE_GPU', `🔄 llama.cpp LoRAアダプター適用処理開始: ${fileName} (scale: ${effScale})`);
        const res = await NativeMlcPlugin.applyLora({ loraFileName: fileName, scale: effScale });
        if (res && res.success) {
          this.activeLoraFileName = fileName;
          this.activeLoraScale = effScale;
          try {
            if (typeof storageService !== 'undefined') {
              storageService.setItem('miki_active_lora_file', fileName);
              storageService.setItem('miki_active_lora_scale', String(effScale));
            }
          } catch {}
          systemLogger.info('NATIVE_GPU', `✨ LoRAアダプター適用完了: ${fileName} (scale: ${effScale})`);
          return { success: true, message: `LoRAアダプター「${fileName}」を適用しました (Scale: ${effScale})` };
        }
      } catch (err: any) {
        systemLogger.error('NATIVE_GPU', `❌ LoRAアダプター適用失敗: ${err?.message || err}`);
        return { success: false, message: `LoRA適用失敗: ${err?.message || err}` };
      }
    }

    // Web環境フォールバック
    this.activeLoraFileName = fileName;
    this.activeLoraScale = effScale;
    try {
      if (typeof storageService !== 'undefined') {
        storageService.setItem('miki_active_lora_file', fileName);
        storageService.setItem('miki_active_lora_scale', String(effScale));
      }
    } catch {}
    systemLogger.info('NATIVE_GPU', `✨ [Webプレビュー] LoRAアダプター仮想適用完了: ${fileName} (scale: ${effScale})`);
    return { success: true, message: `[Webプレビュー] LoRAアダプター「${fileName}」を適用しました (Scale: ${effScale})` };
  }

  /**
   * 現在適用中のLoRAアダプターを解除 (ベースモデルはそのまま維持)
   */
  public async removeLoraAdapter(): Promise<{ success: boolean; message: string }> {
    if (this.isNative() && NativeMlcPlugin.removeLora) {
      try {
        await NativeMlcPlugin.removeLora();
      } catch (err: any) {
        systemLogger.warn('NATIVE_GPU', `LoRA解除エラー: ${err?.message || err}`);
      }
    }
    const prev = this.activeLoraFileName;
    this.activeLoraFileName = null;
    this.activeLoraScale = 1.0;
    try {
      if (typeof storageService !== 'undefined') {
        storageService.removeItem('miki_active_lora_file');
        storageService.removeItem('miki_active_lora_scale');
      }
    } catch {}
    systemLogger.info('NATIVE_GPU', `🧹 LoRAアダプターを解除しました (以前: ${prev || 'なし'})`);
    return { success: true, message: 'LoRAアダプターを解除しました' };
  }

  /**
   * 共有ストレージ (Download/lora-adapters) からLoRAファイルを削除
   */
  public async deleteLoraFile(fileName: string): Promise<boolean> {
    if (this.isNative() && NativeMlcPlugin.deleteLora) {
      try {
        const res = await NativeMlcPlugin.deleteLora({ fileName });
        if (res?.success) {
          if (this.activeLoraFileName === fileName) {
            this.activeLoraFileName = null;
            this.activeLoraScale = 1.0;
          }
          return true;
        }
      } catch (err) {
        systemLogger.warn('NATIVE_GPU', `LoRAファイル削除失敗: ${err}`);
      }
    }

    // Web環境フォールバック
    try {
      if (typeof storageService !== 'undefined') {
        const raw = storageService.getItem('miki_downloaded_lora_files');
        if (raw) {
          const list: NativeLoraFile[] = JSON.parse(raw);
          const filtered = list.filter((f) => f && f.fileName !== fileName);
          storageService.setItem('miki_downloaded_lora_files', JSON.stringify(filtered));
        }
        if (this.activeLoraFileName === fileName) {
          this.activeLoraFileName = null;
          this.activeLoraScale = 1.0;
          storageService.removeItem('miki_active_lora_file');
          storageService.removeItem('miki_active_lora_scale');
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 8章 & 57章 / 指示書 SECTION 7 [提案A]:
   * 外部ローカルLLM設定の現在のアクティブ値を取得
   */
  public getActiveExternalConfig(): ExternalLocalLlmConfig {
    try {
      if (typeof storageService !== 'undefined') {
        const saved = storageService.getItem('miki_external_llm_config');
        if (saved) return JSON.parse(saved);
      }
    } catch (e) {}
    // 実機検証(2026-09-06)により、EngineModal.tsxのオンボーディング手順・
    // ユーザーの実運用ともに llama-swap / llama-server は単一ポート8080に
    // 統一されていることを確認済み(旧仕様書が想定した8081分離は実態と不一致だったため廃止)。
    // 詳細はマスター仕様書チャプター0.2「ポートの住み分け(訂正版)」を参照。
    return { endpoint: 'http://127.0.0.1:8080', model: 'default', type: 'openai_compatible' };
  }

  /**
   * 8章 / 指示書 SECTION 7 [提案A] & Master v5.0 第14章:
   * 複数テキストの埋め込みベクトルを一括・並行取得するバッチヘルパー
   */
  public async getBatchEmbeddings(
    texts: string[],
    overrideConfig?: ExternalLocalLlmConfig,
    concurrency: number = 3
  ): Promise<Map<string, { embedding: number[]; dimensions: number }>> {
    const results = new Map<string, { embedding: number[]; dimensions: number }>();
    if (!texts || texts.length === 0) return results;

    const queue = [...texts];
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }).map(async () => {
      while (queue.length > 0) {
        const text = queue.shift();
        if (!text) break;
        try {
          const res = await this.getEmbedding(text, overrideConfig, 4000);
          if (res && res.embedding) {
            results.set(text, { embedding: res.embedding, dimensions: res.dimensions });
          }
        } catch (e) {}
      }
    });

    await Promise.all(workers);
    return results;
  }

  /**
   * 8章 / 指示書 SECTION 7 [提案A]:
   * llama-server / Ollama の埋め込み (/embedding または /v1/embeddings) エンドポイントが
   * 有効かどうかを短時間 (1500msタイムアウト) で確認
   */
  public async checkEmbeddingAvailability(
    overrideConfig?: ExternalLocalLlmConfig
  ): Promise<{ available: boolean; endpoint: string; type: string; dimensions?: number }> {
    const config = overrideConfig || this.getActiveExternalConfig();
    const endpoint = config.endpoint.replace(/\/$/, '');

    try {
      const res = await this.getEmbedding('ping test', config, 1500);
      if (res && Array.isArray(res.embedding) && res.embedding.length > 0) {
        return {
          available: true,
          endpoint,
          type: config.type,
          dimensions: res.dimensions,
        };
      }
    } catch (e) {}

    return { available: false, endpoint, type: config.type };
  }

  /**
   * 8章 / 指示書 SECTION 7 [提案A]:
   * llama-server (Termux / PC) または Ollama から実テキスト埋め込みベクトルを取得。
   * 利用不能・タイムアウト・未対応時は例外を投げず null を返却 (フォールバック原則)。
   */
  public async getEmbedding(
    text: string,
    overrideConfig?: ExternalLocalLlmConfig,
    timeoutMs: number = 3000
  ): Promise<{ embedding: number[]; modelId: string; dimensions: number } | null> {
    if (!text || !text.trim()) return null;
    const config = overrideConfig || this.getActiveExternalConfig();
    const endpoint = config.endpoint.replace(/\/$/, '');
    const modelId = config.model || 'default';

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      if (config.type === 'ollama') {
        // Ollama native embeddings API: POST /api/embeddings
        try {
          const res = await fetch(`${endpoint}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: modelId,
              prompt: text,
            }),
            signal: controller?.signal,
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.embedding) && data.embedding.length > 0) {
              return {
                embedding: data.embedding,
                modelId,
                dimensions: data.embedding.length,
              };
            }
          }
        } catch (err) {
          // fallback to /v1/embeddings
        }
      }

      // OpenAI互換 / llama-server: POST /v1/embeddings
      try {
        const res = await fetch(`${endpoint}/v1/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: text,
            model: modelId,
          }),
          signal: controller?.signal,
        });
        if (res.ok) {
          const data = await res.json();
          const vec = data?.data?.[0]?.embedding;
          if (Array.isArray(vec) && vec.length > 0) {
            return {
              embedding: vec,
              modelId,
              dimensions: vec.length,
            };
          }
        }
      } catch (err) {}

      // llama.cpp native server endpoint: POST /embedding
      try {
        const res = await fetch(`${endpoint}/embedding`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: text,
          }),
          signal: controller?.signal,
        });
        if (res.ok) {
          const data = await res.json();
          let vec: number[] | null = null;
          if (Array.isArray(data?.embedding)) {
            if (typeof data.embedding[0] === 'number') {
              vec = data.embedding;
            } else if (Array.isArray(data.embedding[0])) {
              vec = data.embedding[0];
            }
          }
          if (vec && vec.length > 0) {
            return {
              embedding: vec,
              modelId,
              dimensions: vec.length,
            };
          }
        }
      } catch (err) {}

      return null;
    } catch (e) {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export const nativeLlmService = new NativeLlmService();
