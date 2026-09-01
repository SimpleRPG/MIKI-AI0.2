import { registerPlugin, Capacitor } from '@capacitor/core';
import { systemLogger } from './systemLogger';

export interface NativeGpuInfo {
  available: boolean;
  backend: 'OpenCL' | 'Vulkan' | 'Hexagon-NPU' | 'WebGPU' | 'CPU';
  gpuVendor: string;
  gpuRenderer: string;
  totalMemoryMB: number;
  allocatedMemoryMB: number;
  driverVersion?: string;
  isNative: boolean;
}

export interface NativeLlmProgressEvent {
  progress: number;
  text: string;
  phase: string;
}

export interface NativeLlmChunkEvent {
  delta: string;
  fullText: string;
  tokensGenerated: number;
}

export interface NativeMlcLlmPluginInterface {
  isAvailable(): Promise<{ available: boolean; backend: string; platform: string }>;
  getHardwareSpecs(): Promise<NativeGpuInfo>;
  loadModel(options: {
    modelId: string;
    modelUrl?: string;
    kvCacheSize?: number;
    maxGenLen?: number;
  }): Promise<{ success: boolean; modelId: string }>;
  generateStream(options: {
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ text: string; totalTokens: number; tps: number }>;
  unloadModel(): Promise<{ success: boolean }>;
}

export const NativeMlcPlugin = registerPlugin<NativeMlcLlmPluginInterface>('MlcLlmPlugin', {
  web: () => ({
    async isAvailable() {
      return { available: false, backend: 'WebGPU-Browser', platform: 'web' };
    },
    async getHardwareSpecs() {
      return {
        available: false,
        backend: 'WebGPU',
        gpuVendor: 'Browser WebGPU',
        gpuRenderer: 'Unified Graphics Adapter',
        totalMemoryMB: 2048,
        allocatedMemoryMB: 0,
        isNative: false,
      };
    },
    async loadModel() {
      throw new Error('Native MLC LLM is only active inside the compiled Android APK.');
    },
    async generateStream() {
      throw new Error('Native MLC LLM is only active inside the compiled Android APK.');
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
        systemLogger.info('NATIVE_GPU', `📱 Android Native GPU エンジン (OpenCL/Vulkan) 検出: ${res.backend}`);
      }
    } catch (e) {
      this.isAvailableOnDevice = false;
    }
    return this.isAvailableOnDevice;
  }

  public isNative(): boolean {
    return this.isNativePlatform && this.isAvailableOnDevice;
  }

  public async getHardwareSpecs(): Promise<NativeGpuInfo> {
    if (!this.isNative()) {
      return {
        available: false,
        backend: 'WebGPU',
        gpuVendor: 'WebGPU / Browser Engine',
        gpuRenderer: 'WebGL/WebGPU Bridge',
        totalMemoryMB: 2500,
        allocatedMemoryMB: 0,
        isNative: false,
      };
    }
    try {
      return await NativeMlcPlugin.getHardwareSpecs();
    } catch {
      return {
        available: true,
        backend: 'OpenCL',
        gpuVendor: 'Qualcomm Snapdragon / MediaTek',
        gpuRenderer: 'Adreno GPU / Mali GPU (Native)',
        totalMemoryMB: 8192,
        allocatedMemoryMB: this.activeModelId ? 800 : 0,
        isNative: true,
      };
    }
  }

  public async loadNativeModel(
    modelId: string,
    onProgress?: (report: { progress: number; text: string }) => void
  ): Promise<void> {
    if (!this.isNative()) {
      throw new Error('Native MLC is only available on Android native app.');
    }

    this.isModelLoading = true;
    systemLogger.info('NATIVE_GPU', `🚀 端末GPU (OpenCL/Vulkan) でモデルをダイレクト展開中: ${modelId}`);

    let progressListener: any = null;
    if (onProgress) {
      progressListener = await (NativeMlcPlugin as any).addListener?.('onProgress', (data: NativeLlmProgressEvent) => {
        onProgress({ progress: Math.round(data.progress * 100), text: data.text });
      });
    }

    try {
      await NativeMlcPlugin.loadModel({
        modelId,
        kvCacheSize: 512,
        maxGenLen: 512,
      });
      this.activeModelId = modelId;
      systemLogger.info('NATIVE_GPU', `✅ ネイティブGPU VRAM への重みバインドが完了しました (${modelId})`);
    } finally {
      this.isModelLoading = false;
      if (progressListener && typeof progressListener.remove === 'function') {
        progressListener.remove();
      }
    }
  }

  public async *streamNativeChat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { temperature?: number; max_tokens?: number }
  ): AsyncGenerator<string, void, unknown> {
    if (!this.isNative()) {
      throw new Error('Native MLC is only available on Android native app.');
    }

    systemLogger.info('NATIVE_GPU', `⚡ 端末ネイティブGPU (OpenCL/Vulkan) で直接推論を開始します`);

    const chunkQueue: string[] = [];
    let isDone = false;
    let streamError: any = null;
    let notifyNext: (() => void) | null = null;

    const chunkListener = await (NativeMlcPlugin as any).addListener?.('onStreamChunk', (data: NativeLlmChunkEvent) => {
      if (data.delta) {
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
      maxTokens: options?.max_tokens ?? 256,
    })
      .then((res) => {
        isDone = true;
        if (notifyNext) {
          notifyNext();
          notifyNext = null;
        }
        systemLogger.info('NATIVE_GPU', `🎉 ネイティブGPU推論完了: ${res.totalTokens} tokens (${res.tps.toFixed(1)} tps)`);
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
        throw streamError;
      }
      await executionPromise;
    } finally {
      if (chunkListener && typeof chunkListener.remove === 'function') {
        chunkListener.remove();
      }
    }
  }

  public async unload(): Promise<void> {
    if (this.isNative()) {
      await NativeMlcPlugin.unloadModel();
      this.activeModelId = null;
    }
  }
}

export const nativeLlmService = new NativeLlmService();
