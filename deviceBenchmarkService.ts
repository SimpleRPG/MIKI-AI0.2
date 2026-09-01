import { webLLMService } from './webLlmService';

export interface DeviceSpecReport {
  gpuName: string;
  vendor: string;
  architecture: string;
  isWebGPUSupported: boolean;
  maxBufferSizeMB: number;
  maxComputeWorkgroupStorageMB: number;
  deviceRamGB: number;
  cpuCores: number;
  storageAvailableGB: number;
  storageTotalGB: number;
  gflops: number;
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
  public async runGPUBenchmark(): Promise<number> {
    if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (adapter) {
          const device = await adapter.requestDevice();
          const shaderCode = `
            @group(0) @binding(0) var<storage, read_write> data: array<f32>;
            @compute @workgroup_size(64)
            fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
              let idx = global_id.x;
              var val = data[idx];
              for (var i = 0u; i < 500u; i = i + 1u) {
                val = sin(val) * cos(val) + 0.001;
              }
              data[idx] = val;
            }
          `;
          const shaderModule = device.createShaderModule({ code: shaderCode });
          const computePipeline = device.createComputePipeline({
            layout: 'auto',
            compute: { module: shaderModule, entryPoint: 'main' },
          });

          const bufferSize = 65536 * 4;
          const gpuUsage = (globalThis as any).GPUBufferUsage;
          const storageUsage = gpuUsage
            ? gpuUsage.STORAGE | gpuUsage.COPY_SRC | gpuUsage.COPY_DST
            : 0x08 | 0x01 | 0x02;

          const gpuBuffer = device.createBuffer({
            size: bufferSize,
            usage: storageUsage,
          });

          const bindGroup = device.createBindGroup({
            layout: computePipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: gpuBuffer } }],
          });

          const t0 = performance.now();
          const commandEncoder = device.createCommandEncoder();
          const passEncoder = commandEncoder.beginComputePass();
          passEncoder.setPipeline(computePipeline);
          passEncoder.setBindGroup(0, bindGroup);
          passEncoder.dispatchWorkgroups(1024);
          passEncoder.end();
          device.queue.submit([commandEncoder.finish()]);
          await device.queue.onSubmittedWorkDone();
          const elapsedMs = performance.now() - t0;

          // 1024 * 64 * 500 * 2 operations = 65.5M FLOPs
          const gflops = Number(((65.536 / Math.max(1, elapsedMs)) * 1.5).toFixed(2));
          return Math.max(1.5, gflops);
        }
      } catch (e) {
        console.warn('WebGPU compute benchmark fallback:', e);
      }
    }

    const t0 = performance.now();
    let acc = 0;
    for (let i = 0; i < 15000000; i++) {
      acc += Math.sin(i) * Math.cos(i);
    }
    const dt = performance.now() - t0;
    return Number(((15 / dt) * 1.8).toFixed(2));
  }

  public async diagnoseDeviceSpecs(): Promise<DeviceSpecReport> {
    let gpuName = '検出中...';
    let vendor = 'Generic';
    let architecture = 'WebGPU / WebGL';
    let isWebGPUSupported = false;
    let maxBufferSizeMB = 256;
    let maxComputeWorkgroupStorageMB = 32;

    // 1. WebGPU GPU Diagnostics
    if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (adapter) {
          isWebGPUSupported = true;
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

    if (!isWebGPUSupported && typeof document !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            gpuName = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'WebGL Renderer';
            vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'WebGL Vendor';
          }
        }
      } catch (e) {}
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

    let gflops = 0;
    if (isWebGPUSupported) {
      try {
        gflops = await this.runGPUBenchmark();
      } catch (e) {
        console.warn('GFLOPS benchmark failed:', e);
      }
    }

    const compatibleModels: DeviceSpecReport['compatibleModels'] = [
      {
        id: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
        name: '⚡ SmolLM2 360M (超軽量220MB)',
        status: 'optimal',
        reason: '容量わずか220MB！全スマホ・低速回線でも最速でDL＆瞬時に動きます',
      },
      {
        id: 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
        name: '🌸 Qwen 2.5 Coder 0.5B (日本語×開発 統合)',
        status: 'optimal',
        reason: '日本語会話とゲーム開発を380MBで両立。スマホに最もバランスが良い万能型',
      },
      {
        id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
        name: '💖 Llama 3.2 1B Instruct',
        status: performanceTier === 'entry' ? 'supported' : 'optimal',
        reason: 'Meta最新1B。自然な日常会話と共感・親密なコミュニケーションに最適',
      },
      {
        id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
        name: '⚡ Qwen 2.5 Coder 1.5B',
        status: performanceTier === 'entry' ? 'heavy' : 'supported',
        reason: 'ゲーム作成やJavaScript/HTMLコード生成をより高度に実行',
      },
      {
        id: 'gemma-2-2b-jpn-it-q4f16_1-MLC',
        name: '💎 Google Gemma 2 2B Japanese',
        status: performanceTier === 'entry' || (maxBufferSizeMB < 512) ? 'heavy' : 'supported',
        reason:
          performanceTier === 'entry' || (maxBufferSizeMB < 512)
            ? 'VRAM 2.3GB以上を消費するため、ミドル〜エントリースマホではバッファ制限にかかりやすいです'
            : '日本語表現力No.1。高性能スマホ・PC向け',
      },
      {
        id: 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
        name: '🧩 DeepSeek R1 7B',
        status: performanceTier === 'ultra' ? 'supported' : 'unsupported',
        reason: 'VRAM 5.6GB推奨。PC/ハイスペックGPU専用（スマホではメモリ不足になります）',
      },
      {
        id: 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
        name: '👑 Qwen 2.5 Coder 7B',
        status: performanceTier === 'ultra' ? 'supported' : 'unsupported',
        reason: 'VRAM 5.8GB推奨。PC/ハイエンドGPU専用',
      },
    ];

    return {
      gpuName,
      vendor,
      architecture,
      isWebGPUSupported,
      maxBufferSizeMB,
      maxComputeWorkgroupStorageMB,
      deviceRamGB,
      cpuCores,
      storageAvailableGB,
      storageTotalGB,
      gflops,
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
