import { webLLMService } from './webLlmService';

export interface DeviceSpecReport {
  gpuName: string;
  vendor: string;
  architecture: string;
  maxBufferSizeMB: number;
  maxComputeWorkgroupStorageMB: number;
  deviceRamGB: number;
  cpuCores: number;
  storageAvailableGB: number;
  storageTotalGB: number;
  performanceTier: 'ultra' | 'high' | 'medium' | 'entry';
  tierLabel: string;
  recommendedModelId: string;
  recommendedModelName: string;
  recommendationReason: string;
  compatibleModels: Array<{
    id: string;
    name: string;
    status: 'optimal' | 'supported' | 'heavy' | 'unsupported';
    reason: string;
  }>;
}

/**
 * スマホやPCのハードウェアスペック（GPU, RAM, VRAM, ストレージ）を自動診断し、
 * 最も快適・高速・自然に動作するLLMモデルを判定・推奨するサービス
 */
class DeviceBenchmarkService {
  public async diagnoseDeviceSpecs(): Promise<DeviceSpecReport> {
    let gpuName = '検出中...';
    let vendor = 'Generic';
    let architecture = 'WebGPU';
    let maxBufferSizeMB = 256;
    let maxComputeWorkgroupStorageMB = 32;

    // 1. WebGPU GPU Diagnostics
    if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (adapter) {
          if (adapter.info) {
            gpuName = adapter.info.description || adapter.info.device || adapter.info.architecture || gpuName;
            vendor = adapter.info.vendor || vendor;
            architecture = adapter.info.architecture || architecture;
          }
          if (adapter.limits) {
            maxBufferSizeMB = Math.round((adapter.limits.maxBufferSize || 268435456) / (1024 * 1024));
            maxComputeWorkgroupStorageMB = Math.round(
              (adapter.limits.maxComputeWorkgroupStorageSize || 32768) / 1024
            );
          }
        }
      } catch (e) {
        console.warn('WebGPU spec inspection error:', e);
      }
    }

    // 2. RAM & CPU Diagnostics
    const deviceRamGB = (navigator as any).deviceMemory || 4; // defaults to 4GB if not exposed by browser
    const cpuCores = navigator.hardwareConcurrency || 4;

    // 3. Storage Diagnostics
    let storageAvailableGB = 10;
    let storageTotalGB = 20;
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const total = (estimate.quota || 0) / (1024 * 1024 * 1024);
        const used = (estimate.usage || 0) / (1024 * 1024 * 1024);
        storageTotalGB = Number(total.toFixed(1));
        storageAvailableGB = Number(Math.max(0, total - used).toFixed(1));
      } catch (e) {
        console.warn('Storage estimate error:', e);
      }
    }

    // 4. Determine Performance Tier & Optimal LLM Model
    let performanceTier: DeviceSpecReport['performanceTier'] = 'medium';
    let tierLabel = 'ミドルレンジ端末 (バランス型)';
    let recommendedModelId = 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC';
    let recommendedModelName = '🌸 Qwen 2.5 Coder 0.5B (日本語×開発 統合)';
    let recommendationReason =
      '快適な応答速度と自然な日本語を両立。スマホのGPU負荷やバッテリー消費を最小限に抑えてサクサク動きます。';

    const isHighEndGpu =
      gpuName.toLowerCase().includes('apple') ||
      gpuName.toLowerCase().includes('m1') ||
      gpuName.toLowerCase().includes('m2') ||
      gpuName.toLowerCase().includes('m3') ||
      gpuName.toLowerCase().includes('m4') ||
      gpuName.toLowerCase().includes('rtx') ||
      gpuName.toLowerCase().includes('geforce') ||
      gpuName.toLowerCase().includes('radeon') ||
      (gpuName.toLowerCase().includes('adreno') && (gpuName.includes('7') || gpuName.includes('8') || gpuName.includes('elite')));

    if (isHighEndGpu && (deviceRamGB >= 8 || maxBufferSizeMB >= 1024)) {
      performanceTier = 'ultra';
      tierLabel = 'ハイエンド端末・PC (高VRAM)';
      recommendedModelId = 'gemma-2-2b-jpn-it-q4f16_1-MLC';
      recommendedModelName = '💎 Google Gemma 2 2B (日本語・自然対話特化)';
      recommendationReason =
        '余裕のあるGPU/RAMスペックを検出。最高峰の自然な日本語対話と文脈理解力をフル活用できます。';
    } else if (deviceRamGB >= 6 || maxBufferSizeMB >= 512 || isHighEndGpu) {
      performanceTier = 'high';
      tierLabel = 'ハイスペックスマホ (Snapdragon / iPhone Pro / Tensor等)';
      recommendedModelId = 'gemma-2-2b-jpn-it-q4f16_1-MLC';
      recommendedModelName = '💎 Google Gemma 2 2B (日本語・自然対話特化)';
      recommendationReason =
        '十分なVRAMと演算能力を検出。表現力の高い2Bモデルでより人間らしく豊かな会話が可能です。';
    } else if (deviceRamGB <= 3 || maxBufferSizeMB <= 256) {
      performanceTier = 'entry';
      tierLabel = 'エントリー端末 / 省エネモード';
      recommendedModelId = 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC';
      recommendedModelName = '🌸 Qwen 2.5 Coder 0.5B (超軽量・高応答)';
      recommendationReason =
        'メモリクラッシュを防ぎ、確実に高速動作する0.5Bモデルが最も安全で快適です。';
    }

    const compatibleModels: DeviceSpecReport['compatibleModels'] = [
      {
        id: 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
        name: '🌸 Qwen 2.5 Coder 0.5B (日本語×開発 統合)',
        status: 'optimal',
        reason: '全スマホで最高速・省メモリ・安定動作（推奨）',
      },
      {
        id: 'gemma-2-2b-jpn-it-q4f16_1-MLC',
        name: '💎 Google Gemma 2 2B Japanese',
        status: performanceTier === 'entry' ? 'heavy' : 'optimal',
        reason:
          performanceTier === 'entry'
            ? 'VRAM 2.3GB以上推奨のため、動作が重くなる可能性があります'
            : '日本語表現力No.1。自然な会話に最適',
      },
      {
        id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
        name: '⚡ Qwen 2.5 Coder 1.5B',
        status: performanceTier === 'entry' ? 'heavy' : 'supported',
        reason: 'ゲーム作成やコード生成に強力',
      },
      {
        id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
        name: '💖 Llama 3.2 1B Instruct',
        status: 'supported',
        reason: '感情・共感対話に優れる',
      },
      {
        id: 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
        name: '🧩 DeepSeek R1 7B',
        status: performanceTier === 'ultra' ? 'supported' : 'unsupported',
        reason: 'PC/ハイエンドGPU専用（スマホではメモリ不足の可能性大）',
      },
    ];

    return {
      gpuName,
      vendor,
      architecture,
      maxBufferSizeMB,
      maxComputeWorkgroupStorageMB,
      deviceRamGB,
      cpuCores,
      storageAvailableGB,
      storageTotalGB,
      performanceTier,
      tierLabel,
      recommendedModelId,
      recommendedModelName,
      recommendationReason,
      compatibleModels,
    };
  }
}

export const deviceBenchmarkService = new DeviceBenchmarkService();
