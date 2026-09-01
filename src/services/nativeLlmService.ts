import { registerPlugin, Capacitor } from '@capacitor/core';
import { systemLogger } from './systemLogger';
import { webLLMService } from './webLlmService';
import { sendChatMessage } from './api';

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

export interface ExternalLocalLlmConfig {
  endpoint: string; // e.g. http://localhost:11434 (Ollama) or http://localhost:1234/v1 (LM Studio)
  model: string;
  type: 'ollama' | 'openai_compatible';
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
  getStorageInfo(): Promise<NativeStorageInfo>;
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

class NativeLlmService {
  private isNativePlatform: boolean = false;
  private isAvailableOnDevice: boolean = false;
  private activeModelId: string | null = null;
  private isModelLoading: boolean = false;

  constructor() {
    this.checkPlatform();
  }

  private async checkPlatform(): Promise<boolean> {
    try {
      this.isNativePlatform = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
      if (this.isNativePlatform) {
        const res = await NativeMlcPlugin.isAvailable();
        this.isAvailableOnDevice = !!res.available;
        systemLogger.info(
          'NATIVE_GPU',
          `📱 Android Native C++ llama.cpp エンジン検出: ${res.backend} (${res.architecture})`
        );
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
    return this.activeModelId;
  }

  public async getHardwareSpecs(): Promise<NativeGpuInfo> {
    try {
      if (this.isNative()) {
        return await NativeMlcPlugin.getHardwareSpecs();
      }
    } catch (e) {}

    return {
      available: this.isNative(),
      backend: this.isNative() ? 'Vulkan' : 'WebGPU',
      gpuVendor: this.isNative() ? 'Qualcomm / ARM' : 'Web Browser GPU',
      gpuRenderer: this.isNative() ? 'Adreno / Mali Hardware Native' : 'Browser WebGPU Canvas',
      totalMemoryMB: 8192,
      availableMemoryMB: 4096,
      allocatedMemoryMB: this.activeModelId ? 950 : 0,
      isNative: this.isNative(),
    };
  }

  public async getStorageInfo(): Promise<NativeStorageInfo> {
    if (this.isNative()) {
      try {
        return await NativeMlcPlugin.getStorageInfo();
      } catch (e) {
        systemLogger.warn('NATIVE_GPU', `ストレージ容量の取得に失敗: ${e}`);
      }
    }
    return {
      totalDiskMB: 10240,
      freeDiskMB: 8192,
      usedByModelsMB: 0,
      modelsDir: 'internal',
      files: [],
    };
  }

  public async downloadModel(
    modelId: string,
    downloadUrl: string,
    fileName: string,
    onProgress?: (report: { progress: number; text: string; speedMBs?: number; etaSeconds?: number }) => void
  ): Promise<{ success: boolean; filePath: string; sizeMB: number }> {
    if (!this.isNative()) {
      throw new Error('GGUFモデルのネイティブ高速ダウンロードはAndroid APK実機環境でのみ利用可能です。');
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
      systemLogger.info('NATIVE_GPU', `✅ GGUFモデルのダウンロード完了: ${fileName} (${res.sizeMB} MB)`);
      return res;
    } finally {
      if (progressListener && typeof progressListener.remove === 'function') {
        progressListener.remove();
      }
    }
  }

  public async loadNativeModel(
    modelId: string,
    fileName?: string,
    options?: { nGpuLayers?: number; nCtx?: number; nThreads?: number },
    onProgress?: (report: { progress: number; text: string }) => void
  ): Promise<void> {
    if (!this.isNative()) {
      throw new Error(
        '本体物理GPU (llama.cpp C++ JNI) エンジンはAndroid実機APKでのみ動作します。Web環境ではWebGPUまたはクラウドをご利用ください。'
      );
    }

    this.isModelLoading = true;
    systemLogger.info('NATIVE_GPU', `🚀 llama.cpp C++ JNI でGGUFモデルをVRAM/RAMに展開中: ${modelId} (${fileName || modelId})`);

    let progressListener: any = null;
    if (onProgress) {
      progressListener = await (NativeMlcPlugin as any).addListener?.('onProgress', (data: NativeLlmProgressEvent) => {
        onProgress({
          progress: Math.min(100, Math.max(0, Math.round(data.progress * 100))),
          text: data.text,
        });
      });
    }

    try {
      const res = await NativeMlcPlugin.loadModel({
        modelId,
        fileName: fileName || `${modelId}.gguf`,
        nGpuLayers: options?.nGpuLayers ?? 99,
        nCtx: options?.nCtx ?? 2048,
        nThreads: options?.nThreads ?? 4,
      });

      this.activeModelId = modelId;
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

  public async *streamNativeChat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { temperature?: number; top_p?: number; max_tokens?: number }
  ): AsyncGenerator<string, void, unknown> {
    if (!this.isNative()) {
      // If user triggers Native GPU in Web preview, give clear honest guidance
      if (webLLMService.isLoaded()) {
        systemLogger.info('NATIVE_GPU', `ℹ️ Webプレビュー環境のため、ロード済みのWebGPUエンジンへルーティングします。`);
        for await (const chunk of webLLMService.streamChat(messages, options)) {
          yield chunk;
        }
        return;
      } else {
        throw new Error(
          '【未ロード】本体GPU (llama.cpp GGUF) はAndroid APK実機環境で動作します。Webブラウザ上では「WebGPU」または「Gemini クラウド」モードを選択してください。'
        );
      }
    }

    if (!this.activeModelId) {
      throw new Error('モデルがVRAM/RAMにロードされていません。エンジン設定からGGUFモデルをロードしてください。');
    }

    systemLogger.info('NATIVE_GPU', `⚡ llama.cpp C++ JNI ネイティブ推論を開始 (${this.activeModelId})`);

    const chunkQueue: string[] = [];
    let isDone = false;
    let streamError: any = null;
    let notifyNext: (() => void) | null = null;

    const chunkListener = await (NativeMlcPlugin as any).addListener?.('onStreamChunk', (data: NativeLlmChunkEvent) => {
      if (data && typeof data.delta === 'string') {
        chunkQueue.push(data.delta);
        if (notifyNext) {
          notifyNext();
          notifyNext = null;
        }
      }
    });

    const executionPromise = NativeMlcPlugin.generateStream({
      messages,
      temperature: options?.temperature ?? 0.7,
      topP: options?.top_p ?? 0.9,
      maxTokens: options?.max_tokens ?? 512,
    })
      .then((res) => {
        isDone = true;
        if (notifyNext) {
          notifyNext();
          notifyNext = null;
        }
        systemLogger.info(
          'NATIVE_GPU',
          `🎉 llama.cpp 推論完了: ${res.totalTokens} tokens (${res.tps.toFixed(1)} tps, 処理時間: ${res.durationMs}ms)`
        );
      })
      .catch((err) => {
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
          yield chunkQueue.shift()!;
        } else if (!isDone) {
          await new Promise<void>((resolve) => {
            notifyNext = resolve;
          });
        }
      }

      if (streamError) {
        throw new Error(`llama.cpp ネイティブ推論エラー: ${streamError.message || streamError}`);
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
   */
  public async *streamExternalLocalLlm(
    config: ExternalLocalLlmConfig,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { temperature?: number }
  ): AsyncGenerator<string, void, unknown> {
    const endpoint = config.endpoint.replace(/\/$/, '');
    systemLogger.info('EXTERNAL_GPU', `🖥️ 外部ローカルLLMサーバー (${endpoint}) に接続推論中...`);

    if (config.type === 'ollama') {
      const url = `${endpoint}/api/chat`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model || 'qwen2.5:1.5b',
          messages,
          stream: true,
          options: { temperature: options?.temperature ?? 0.7 },
        }),
      });

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
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              yield data.message.content;
            }
          } catch (e) {}
        }
      }
    } else {
      // OpenAI Compatible (LM Studio / llama.cpp server)
      const url = `${endpoint}/v1/chat/completions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model || 'default',
          messages,
          stream: true,
          temperature: options?.temperature ?? 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`LM Studio / Local API 接続エラー (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is null');
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
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
              if (delta) yield delta;
            } catch (e) {}
          }
        }
      }
    }
  }

  public async deleteDownloadedModel(fileName: string): Promise<void> {
    if (this.isNative()) {
      await NativeMlcPlugin.deleteModel({ fileName });
    }
  }

  public async unload(): Promise<void> {
    if (this.isNative()) {
      await NativeMlcPlugin.unloadModel();
    }
    this.activeModelId = null;
  }
}

export const nativeLlmService = new NativeLlmService();
