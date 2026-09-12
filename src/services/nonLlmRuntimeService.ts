import type { ChatMessage } from '../types';
import { nonLlmCoreService } from './nonLlmCoreService';

export interface NativeGpuInfo {
  backend: 'NON_LLM_CORE';
  deviceName: string;
  totalMemoryMB: number;
  freeMemoryMB: number;
  computeUnits: number;
  gpuRenderer?: string;
  gpuVendor?: string;
}
export interface NativeDownloadedFile { fileName: string; size: number; path?: string; }
export interface NativeStorageInfo {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  freeDiskMB?: number;
  totalDiskMB?: number;
}
export interface NativeLoraFile { fileName: string; size: number; }
export interface NativeLoraStorageInfo { totalBytes: number; freeBytes: number; usedBytes: number; files: NativeLoraFile[]; }
export interface NonLlmTeacherConfig { endpoint: string; model?: string; apiKey?: string; type?: string; slotId?: number; [key: string]: any; }
export interface NativeLlmProgressEvent { stage: string; progress: number; message?: string; }
export interface NativeLlmChunkEvent { content: string; done?: boolean; }
export interface VRAMSnapshot { totalMB: number; usedMB: number; freeMB: number; pressureLevel: 'low' | 'medium' | 'high' | 'critical'; }

const EMPTY_STORAGE: NativeStorageInfo = { totalBytes: 0, freeBytes: 0, usedBytes: 0 };
const EMPTY_LORA: NativeLoraStorageInfo = { ...EMPTY_STORAGE, files: [] };

function messagesToPrompt(messages: ChatMessage[] | any[]): string {
  return (messages || []).map((m: any) => String(m?.content ?? '')).filter(Boolean).slice(-8).join('\n');
}

function deterministicEmbedding(text: string, dimensions = 256): number[] {
  const out = new Array<number>(dimensions).fill(0);
  const normalized = text.normalize('NFKC').toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    const j = (code * 31 + i * 17) % dimensions;
    out[j] += ((code % 97) + 1) / 97;
  }
  const norm = Math.sqrt(out.reduce((s, x) => s + x * x, 0)) || 1;
  return out.map(x => x / norm);
}

async function* deterministicStream(messages: ChatMessage[] | any[]): AsyncGenerator<string> {
  const prompt = messagesToPrompt(messages);
  const result = await nonLlmCoreService.execute({ prompt, recentMessages: messages as ChatMessage[] });
  yield result.replyText;
}

export const nonLlmRuntimeService = {
  isNative: () => false,
  getActiveModelId: () => '' as string,
  isLoadingModel: () => false,
  getActiveExternalConfig: () => ({ endpoint: '', type: 'non_llm_core', model: 'deterministic-feature-v1' }) as NonLlmTeacherConfig,
  getActiveLoraInfo: () => null as NativeLoraFile | null,
  getHardwareSpecs: async (): Promise<NativeGpuInfo> => ({ backend: 'NON_LLM_CORE', deviceName: 'Non-LLM Core', totalMemoryMB: 0, freeMemoryMB: 0, computeUnits: 0 }),
  getStorageInfo: async () => EMPTY_STORAGE,
  getLoraStorageInfo: async () => EMPTY_LORA,
  isSharedStorageAccessGranted: async () => false,
  requestSharedStorageAccess: async () => false,
  resetDiagnostics: () => undefined,
  getAvailableGgufModels: async (..._args: any[]) => [] as any[],
  listExternalModels: async (_config?: NonLlmTeacherConfig): Promise<string[]> => [],
  checkEmbeddingAvailability: async (_config?: NonLlmTeacherConfig) => ({ available: false, endpoint: '', type: 'non_llm_core', dimensions: 256, reason: 'Local embedding runtime removed; deterministic feature embedding is used.' }),
  getEmbedding: async (text: string, ..._args: any[]) => ({ embedding: deterministicEmbedding(text), dimensions: 256, modelId: 'deterministic-feature-v1', model: 'deterministic-feature-v1' }),
  downloadModel: async (..._args: any[]) => { throw new Error('Local generative model downloads have been removed.'); },
  loadNativeModel: async (..._args: any[]) => { throw new Error('Local generative model loading has been removed.'); },
  deleteDownloadedModel: async (..._args: any[]) => false,
  applyLoraAdapter: async (..._args: any[]) => ({ success: false, reason: 'LoRA model adapters are retired with local generative models.' }),
  removeLoraAdapter: async (..._args: any[]) => ({ success: true }),
  deleteLoraFile: async (..._args: any[]) => false,
  autoLoadDownloadedModelIfAvailable: async (..._args: any[]) => false,
  streamDeterministicChat: (first: any, second?: any, _options?: any) =>
    deterministicStream(Array.isArray(first) ? first : (Array.isArray(second) ? second : [])),
  chatStream: (messages: any, _options?: any) => deterministicStream(Array.isArray(messages) ? messages : []),
  streamChat: (messages: any, _options?: any) => deterministicStream(Array.isArray(messages) ? messages : []),
  isWebGPUSupported: async (..._args: any[]) => ({ supported: false, adapterInfo: { description: 'Non-LLM Core', vendor: 'Deterministic', architecture: 'CPU', maxBufferSize: 0, maxComputeInvocations: 0 }, error: 'WebGPU model runtime is retired.' }),
  isLoaded: () => false,
  isModelLoaded: (_modelId?: string) => false,
  isModelCached: async (_modelId?: string) => false,
  getActiveModelIdWeb: () => '' as string,
  getStorageEstimate: async () => ({ quota: 0, usage: 0 }),
  getVRAMSnapshot: async (): Promise<VRAMSnapshot> => ({ totalMB: 0, usedMB: 0, freeMB: 0, pressureLevel: 'low' }),
  listAllCachedModels: async () => [],
  findBestAvailableModel: async (..._args: any[]) => '',
  loadModel: async (..._args: any[]) => { throw new Error('Local generative model loading is retired; use the Non-LLM Core.'); },
  unloadModel: async (..._args: any[]) => undefined,
  cancelAndReset: () => undefined,
  interruptGenerate: () => undefined,
  clearAllCaches: async () => undefined,
  deleteModelCache: async (..._args: any[]) => undefined,
  purgeKVCache: async (..._args: any[]) => undefined,
  repairModelCache: async (..._args: any[]) => ({ repaired: false, reason: 'Web model runtime is retired.' }),
  verifyModelCacheIntegrity: async (..._args: any[]) => ({ isCached: false, valid: false, status: 'retired', shardCount: 0, reason: 'Web model runtime is retired.' }),
  forceResetInitializingLock: () => undefined,
};


