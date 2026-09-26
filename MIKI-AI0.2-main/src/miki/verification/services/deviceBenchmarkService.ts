import { deterministicRuntimeService } from '../../safety/services/deterministicRuntimeService';

export class DeviceBenchmarkService {
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
          const storageUsage = gpuUsage ? gpuUsage.STORAGE | gpuUsage.COPY_SRC | gpuUsage.COPY_DST : 8 | 1 | 2;
          const gpuBuffer = device.createBuffer({
            size: bufferSize,
            usage: storageUsage,
          });
          const bindGroup = device.createBindGroup({
            layout: computePipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: gpuBuffer } }],
          });
          const t02 = performance.now();
          const commandEncoder = device.createCommandEncoder();
          const passEncoder = commandEncoder.beginComputePass();
          passEncoder.setPipeline(computePipeline);
          passEncoder.setBindGroup(0, bindGroup);
          passEncoder.dispatchWorkgroups(1024);
          passEncoder.end();
          device.queue.submit([commandEncoder.finish()]);
          await device.queue.onSubmittedWorkDone();
          const elapsedMs = performance.now() - t02;
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

  public async diagnoseDeviceSpecs(): Promise<Record<string, any>> {
    let gpuName = '検出中...';
    let vendor = 'Generic';
    let architecture = 'WebGPU / WebGL';
    let isWebGPUSupported = false;
    let maxBufferSizeMB = 256;
    let maxComputeWorkgroupStorageMB = 32;

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
        const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as any;
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            gpuName = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'WebGL Renderer';
            vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'WebGL Vendor';
          }
        }
      } catch (e) {}
    }

    let isRealMeasured = false;
    let deviceRamGB = 4;
    let cpuCores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    let storageAvailableGB = 10;
    let storageTotalGB = 20;

    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      deviceRamGB = Number((mem.jsHeapSizeLimit / (1024 * 1024 * 1024)).toFixed(1));
      isRealMeasured = true;
    } else if (typeof navigator !== 'undefined' && (navigator as any).deviceMemory) {
      deviceRamGB = (navigator as any).deviceMemory;
      isRealMeasured = true;
    }

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

    let performanceTier = 'medium';
    let tierLabel = 'ミドルレンジ端末 (バランス型)';
    const recommendedModelId = 'non-llm-core';
    const recommendedModelName = 'Non-LLM Core';
    const recommendationReason = '生成モデルを使用せず、決定論的な構文・検索・制約・検証パイプラインを端末資源に合わせて実行します。';
    const compatibleModels = [
      {
        id: 'non-llm-core',
        name: 'Non-LLM Core',
        status: 'optimal',
        reason: 'モデルダウンロード不要・ローカル生成ランタイム不要。',
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
      gflops: 15,
      isRealMeasured,
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
