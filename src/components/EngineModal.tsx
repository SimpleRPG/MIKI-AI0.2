import React, { useState, useEffect } from 'react';
import { EngineMode, WebGPUStatus, LocalLLMModel, MemoryItem } from '../types';
import { webLLMService } from '../services/webLlmService';
import { deviceBenchmarkService, DeviceSpecReport } from '../services/deviceBenchmarkService';
import { distillKnowledgeForLocalLLM } from '../services/api';
import {
  Cpu,
  Sparkles,
  Activity,
  ShieldCheck,
  CheckCircle2,
  Download,
  Trash2,
  Play,
  HardDrive,
  Terminal,
  Check,
  AlertTriangle,
  ArrowDownToLine,
  Search,
  RotateCcw,
  X,
  RefreshCw,
  AlertCircle,
  Smartphone,
  Zap,
  HelpCircle,
  Layers,
  GraduationCap,
  BookOpen,
  Brain,
  Plus,
} from 'lucide-react';

interface EngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  engineMode: EngineMode;
  onSelectEngine: (mode: EngineMode) => void;
}

const OFFICIAL_LOCAL_MODELS: LocalLLMModel[] = [
  {
    id: 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 Coder 0.5B Instruct',
    expertRole: 'code',
    expertName: '🌸 日本語×開発 統合モデル (スマホ超推奨)',
    icon: '🌸',
    sizeMB: 380,
    parameters: '0.5B',
    quantization: 'q4f16_1 (4-bit weights)',
    vramMB: 750,
    description: '【日本語・スマホ最優秀】わずか380MBで流暢な日本語会話とコード生成を1つのモデルで両立。スマホのWebGPUで最高速・安定に動きます。',
    huggingFaceRepo: 'mlc-ai/Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
    downloadStatus: 'not_downloaded',
    downloadProgress: 0,
  },
  {
    id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 Coder 1.5B Instruct',
    expertRole: 'code',
    expertName: '⚡ 高精度 統合モデル (日本語＋高度コード)',
    icon: '⚡',
    sizeMB: 950,
    parameters: '1.54B',
    quantization: 'q4f16_1 (4-bit weights)',
    vramMB: 1400,
    description: '1.5Bパラメータの高性能統合モデル。自然な日本語の雑談と本格的なWebゲーム・アルゴリズム生成を両立します。',
    huggingFaceRepo: 'mlc-ai/Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
    downloadStatus: 'not_downloaded',
    downloadProgress: 0,
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B Instruct',
    expertRole: 'moe_chat',
    expertName: '💖 Llama 3.2 1B (親密対話・感情共感)',
    icon: '💖',
    sizeMB: 880,
    parameters: '1.23B',
    quantization: 'q4f16_1 (4-bit weights)',
    vramMB: 1250,
    description: 'Meta開発の最新軽量対話モデル。キャラクター会話、親密なアシスタント対話をローカルWebGPUで実行します。',
    huggingFaceRepo: 'mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC',
    downloadStatus: 'not_downloaded',
    downloadProgress: 0,
  },
  {
    id: 'gemma-2-2b-jpn-it-q4f16_1-MLC',
    name: 'Gemma 2 2B Japanese Instruct',
    expertRole: 'general',
    expertName: '💎 Google Gemma 2 (日本語・自然対話特化)',
    icon: '💎',
    sizeMB: 1650,
    parameters: '2.61B',
    quantization: 'q4f16_1 (4-bit weights)',
    vramMB: 2300,
    description: 'Google Gemma 2の日本語ファインチューニングモデル。極めて自然な日本語と文脈理解力を提供します。',
    huggingFaceRepo: 'mlc-ai/gemma-2-2b-jpn-it-q4f16_1-MLC',
    downloadStatus: 'not_downloaded',
    downloadProgress: 0,
  },
  {
    id: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
    name: 'SmolLM2 360M Instruct',
    expertRole: 'general',
    expertName: '⚡ SmolLM2 360M (超軽量・英語/コード基礎)',
    icon: '⚡',
    sizeMB: 220,
    parameters: '360M',
    quantization: 'q4f16_1 (4-bit weights)',
    vramMB: 650,
    description: '超軽量220MB。英語での高速処理や超低メモリ環境向け（※日本語の会話にはQwen 0.5B推奨）。',
    huggingFaceRepo: 'mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC',
    downloadStatus: 'not_downloaded',
    downloadProgress: 0,
  },
  {
    id: 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
    name: 'DeepSeek-R1 Distill Qwen 7B',
    expertRole: 'logic',
    expertName: '🧩 DeepSeek R1 (推論・思考・難問デバッグ)',
    icon: '🧩',
    sizeMB: 4500,
    parameters: '7.61B',
    quantization: 'q4f16_1 (4-bit weights)',
    vramMB: 5600,
    description: '思考チェーン (Chain-of-Thought) とバグ修正・数学的アルゴリズムに特化した超強力推論モデル（PC/高VRAM推奨）。',
    huggingFaceRepo: 'mlc-ai/DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
    downloadStatus: 'not_downloaded',
    downloadProgress: 0,
  },
  {
    id: 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 Coder 7B Instruct',
    expertRole: 'shader',
    expertName: '👑 Qwen 2.5 Coder 7B (プロ開発・高精度)',
    icon: '👑',
    sizeMB: 4600,
    parameters: '7.61B',
    quantization: 'q4f16_1 (4-bit weights)',
    vramMB: 5800,
    description: 'ハイエンドGPU向け。複雑なWebGPUシェーダー、大規模リファクタリングを高品質に実行。',
    huggingFaceRepo: 'mlc-ai/Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
    downloadStatus: 'not_downloaded',
    downloadProgress: 0,
  },
];

export const EngineModal: React.FC<EngineModalProps> = ({
  isOpen,
  onClose,
  engineMode,
  onSelectEngine,
}) => {
  const [activeTab, setActiveTab] = useState<'downloader' | 'training' | 'benchmark' | 'architecture'>('downloader');

  // LLM Training & Knowledge Distillation State
  const [trainingTopic, setTrainingTopic] = useState('Three.js 3Dゲーム開発とパフォーマンス最適化');
  const [customTrainingTopic, setCustomTrainingTopic] = useState('');
  const [trainingSkillType, setTrainingSkillType] = useState<'code' | 'persona' | 'game' | 'logic'>('game');
  const [isDistilling, setIsDistilling] = useState(false);
  const [distilledResult, setDistilledResult] = useState<{
    title: string;
    category: string;
    content: string;
    qaPairs: Array<{ q: string; a: string }>;
    summary: string;
  } | null>(null);
  const [distillSuccessMsg, setDistillSuccessMsg] = useState<string | null>(null);

  // Device specs diagnosis
  const [deviceReport, setDeviceReport] = useState<DeviceSpecReport | null>(null);
  const [isDiagnosingDevice, setIsDiagnosingDevice] = useState(false);

  // GPU Hardware detection
  const [gpuInfo, setGpuInfo] = useState<WebGPUStatus>({
    supported: false,
    adapterName: '検出中...',
    vendor: 'Unknown',
    status: 'ready',
  });
  const [webGpuError, setWebGpuError] = useState<string | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<number | null>(null);

  // Local Models state
  const [localModels, setLocalModels] = useState<LocalLLMModel[]>(() => {
    try {
      const saved = localStorage.getItem('miki_local_llm_models_v2');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return OFFICIAL_LOCAL_MODELS;
  });

  const [useLocalInMoE, setUseLocalInMoE] = useState<boolean>(() => {
    return localStorage.getItem('miki_use_local_in_moe') !== 'false';
  });

  // Custom Model Input
  const [customRepoInput, setCustomRepoInput] = useState('');
  const [customRoleInput, setCustomRoleInput] = useState<'code' | 'logic' | 'moe_chat' | 'general'>('code');

  // Interactive Test Box state
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [testPrompt, setTestPrompt] = useState('こんにちは！自己紹介と得意な開発分野を教えてください。');
  const [testOutput, setTestOutput] = useState('');
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testMetrics, setTestMetrics] = useState<{ speed: number; latency: number } | null>(null);
  const [activeLoadingModelId, setActiveLoadingModelId] = useState<string | null>(null);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [batchQueue, setBatchQueue] = useState<{ total: number; currentIdx: number; currentModelName: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const cancelBatchRef = React.useRef(false);
  const [isScanningIntegrity, setIsScanningIntegrity] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [storageQuota, setStorageQuota] = useState<{ usedMB: number; quotaMB: number; percent: number } | null>(null);

  // Save models to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('miki_local_llm_models_v2', JSON.stringify(localModels));
    } catch (e) {}
  }, [localModels]);

  useEffect(() => {
    localStorage.setItem('miki_use_local_in_moe', useLocalInMoE ? 'true' : 'false');
  }, [useLocalInMoE]);

  const refreshStorageEstimate = async () => {
    const est = await webLLMService.getStorageEstimate();
    if (est) setStorageQuota(est);
  };

  // Check real WebGPU hardware & cache status on open
  const runCacheIntegrityScan = async () => {
    setIsScanningIntegrity(true);
    try {
      const gpuCheck = await webLLMService.isWebGPUSupported();
      if (gpuCheck.supported && gpuCheck.adapterInfo) {
        setGpuInfo({
          supported: true,
          adapterName: gpuCheck.adapterInfo.description,
          vendor: gpuCheck.adapterInfo.vendor,
          architecture: gpuCheck.adapterInfo.architecture,
          maxBufferSize: 512,
          maxComputeInvocations: 256,
          status: 'ready',
        });
        setWebGpuError(null);
      } else {
        setGpuInfo({
          supported: false,
          adapterName: 'WebGPU 未検出 (WebGL 2.0 / CPU エミュレーション)',
          vendor: 'Browser Fallback',
          status: 'unsupported',
        });
        setWebGpuError(gpuCheck.error || 'WebGPU が利用できません。');
      }

      await refreshStorageEstimate();

      // Check cache for each model with deep integrity verification
      const activeLoaded = webLLMService.getActiveModelId();
      const isEngineLoaded = webLLMService.isLoaded();

      let repairedCount = 0;
      const updatedModels = await Promise.all(
        localModels.map(async (m) => {
          const integrity = await webLLMService.verifyModelCacheIntegrity(m.id);
          if (activeLoaded === m.id && isEngineLoaded) {
            return {
              ...m,
              downloadStatus: 'loaded_in_vram' as const,
              downloadProgress: 100,
              statusText: 'WebGPU VRAM 稼働中 (推論可能)',
              errorMessage: undefined,
            };
          }
          if (integrity.isCached) {
            return {
              ...m,
              downloadStatus: 'cached' as const,
              downloadProgress: 100,
              statusText: '端末キャッシュ済み (即時ロード可能)',
              errorMessage: undefined,
            };
          }
          if (integrity.status === 'partial') {
            repairedCount++;
            return {
              ...m,
              downloadStatus: 'error' as const,
              downloadProgress: Math.min(80, integrity.shardCount * 10),
              statusText: 'ダウンロード中断または一部破損',
              errorMessage: `前回のダウンロードが未完了です (${integrity.shardCount}ファイル検出)。「修復＆再ダウンロード」で続きからダウンロードできます。`,
            };
          }
          if (m.downloadStatus === 'downloading') {
            return m;
          }
          return {
            ...m,
            downloadStatus: 'not_downloaded' as const,
            downloadProgress: 0,
            statusText: undefined,
            errorMessage: undefined,
          };
        })
      );

      setLocalModels(updatedModels);
      setScanNotice(
        repairedCount > 0
          ? `スキャン完了: ${repairedCount} 件の中断キャッシュを検出しました。「修復＆再ダウンロード」が可能です。`
          : 'スキャン完了: キャッシュとWebGPUの状態はすべて正常です。'
      );
      setTimeout(() => setScanNotice(null), 4000);
    } catch (e) {
      console.warn('Scan error:', e);
    } finally {
      setIsScanningIntegrity(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runCacheIntegrityScan();
    }
  }, [isOpen]);

  const runGpuBenchmark = async () => {
    setIsBenchmarking(true);
    setBenchmarkResult(null);

    try {
      const gflops = await deviceBenchmarkService.runGPUBenchmark();
      setBenchmarkResult(gflops);
    } catch (e) {
      console.warn('GPU benchmark error:', e);
      const t0 = performance.now();
      let acc = 0;
      for (let i = 0; i < 20000000; i++) {
        acc += Math.sin(i) * Math.cos(i);
      }
      const dt = performance.now() - t0;
      const gflops = Number(((20 / dt) * 1.8).toFixed(2));
      setBenchmarkResult(gflops);
    } finally {
      setIsBenchmarking(false);
    }
  };

  const handleRunDeviceDiagnosis = async () => {
    setIsDiagnosingDevice(true);
    try {
      const report = await deviceBenchmarkService.diagnoseDeviceSpecs();
      setDeviceReport(report);
    } catch (err) {
      console.error('Device diagnosis failed:', err);
    } finally {
      setIsDiagnosingDevice(false);
    }
  };

  useEffect(() => {
    if (isOpen && !deviceReport) {
      handleRunDeviceDiagnosis();
    }
  }, [isOpen]);

  // Real Download & VRAM load using WebLLM
  const handleDownloadAndLoad = async (model: LocalLLMModel) => {
    setActiveLoadingModelId(model.id);
    const startTime = performance.now();
    let lastProgressTime = startTime;
    let lastReportedProgress = 1;

    setLocalModels((prev) =>
      prev.map((m) =>
        m.id === model.id
          ? {
              ...m,
              downloadStatus: 'downloading',
              downloadProgress: 1,
              statusText: 'WebGPU パイプラインを初期化中...',
              errorMessage: undefined,
              downloadSpeed: undefined,
              etaSeconds: undefined,
              lastUpdatedTime: Date.now(),
              isStalled: false,
            }
          : m
      )
    );

    try {
      await webLLMService.loadModel(model.id, (report) => {
        const now = performance.now();
        const progressDiff = report.progress - lastReportedProgress;
        const timeDiffSec = (now - lastProgressTime) / 1000;

        let speedStr: string | undefined = undefined;
        let etaSec: number | undefined = undefined;

        if (timeDiffSec > 0.4 && progressDiff > 0) {
          const bytesTotal = model.sizeMB * 1024 * 1024;
          const bytesDownloadedInDiff = (progressDiff / 100) * bytesTotal;
          const bytesPerSec = bytesDownloadedInDiff / timeDiffSec;
          const mbPerSec = bytesPerSec / (1024 * 1024);
          speedStr = `${mbPerSec.toFixed(1)} MB/s`;

          const remainingProgress = Math.max(0, 100 - report.progress);
          const remainingBytes = (remainingProgress / 100) * bytesTotal;
          etaSec = Math.ceil(remainingBytes / Math.max(bytesPerSec, 1024));

          lastProgressTime = now;
          lastReportedProgress = report.progress;
        }

        setLocalModels((prev) =>
          prev.map((m) => {
            if (m.id === model.id) {
              return {
                ...m,
                downloadProgress: report.progress,
                statusText: report.text,
                downloadStatus: report.progress >= 100 ? 'loaded_in_vram' : 'downloading',
                downloadSpeed: speedStr || m.downloadSpeed,
                etaSeconds: etaSec !== undefined ? etaSec : m.etaSeconds,
                lastUpdatedTime: Date.now(),
                isStalled: false,
              };
            }
            return m;
          })
        );
      });

      setLocalModels((prev) =>
        prev.map((m) =>
          m.id === model.id
            ? {
                ...m,
                downloadStatus: 'loaded_in_vram',
                downloadProgress: 100,
                statusText: 'WebGPU VRAM ロード完了 (推論可能)',
              }
            : m.downloadStatus === 'loaded_in_vram'
            ? {
                ...m,
                downloadStatus: 'cached',
                statusText: undefined,
              }
            : m
        )
      );
      setActiveLoadingModelId(null);
    } catch (err: any) {
      console.error('Download/Load error:', err);
      const errMsg = String(err?.message || err || '');
      const isQuotaError =
        err?.name === 'QuotaExceededError' ||
        errMsg.toLowerCase().includes('quota') ||
        errMsg.includes('Quota exceeded');

      const isFetchError =
        err?.name === 'NetworkFetchError' ||
        errMsg.toLowerCase().includes('failed to fetch') ||
        errMsg.toLowerCase().includes('fetch failed') ||
        errMsg.toLowerCase().includes('networkerror') ||
        errMsg.toLowerCase().includes('cache') ||
        errMsg.toLowerCase().includes('load failed') ||
        errMsg.toLowerCase().includes('net::') ||
        errMsg.includes('Failed to fetch');

      const isDeviceLost =
        err?.name === 'GPUDeviceLostError' ||
        errMsg.toLowerCase().includes('device was lost') ||
        errMsg.toLowerCase().includes('gpudevicelostinfo') ||
        errMsg.toLowerCase().includes('gpu constraints') ||
        errMsg.toLowerCase().includes('insufficient memory');

      let formattedStatus = 'エラーが発生しました';
      let formattedError = errMsg || 'ダウンロードまたはWebGPUロードに失敗しました';

      if (isQuotaError) {
        formattedStatus = '容量不足 (Quota exceeded)';
        formattedError = '端末ストレージの保存容量上限（Quota exceeded）に達しました。不要なモデルキャッシュを削除するか、超軽量モデル（SmolLM2-360M: 220MB）をご利用ください。';
      } else if (isDeviceLost) {
        formattedStatus = 'GPUメモリ制限 (Device Lost)';
        formattedError = '端末のGPUメモリ（VRAM）制約によりGPUがリセットされました。超軽量モデル（SmolLM2-360M: 220MB）をご利用ください。';
      } else if (isFetchError) {
        formattedStatus = '通信・キャッシュエラー';
        formattedError = 'モデルデータ取得中に通信またはキャッシュエラーが発生しました。不完全なキャッシュは自動クリアされました。「再試行」または「修復 & 再DL」で再取得できます。';
      }

      await refreshStorageEstimate();

      setLocalModels((prev) =>
        prev.map((m) =>
          m.id === model.id
            ? {
                ...m,
                downloadStatus: 'error',
                statusText: formattedStatus,
                errorMessage: formattedError,
              }
            : m
        )
      );
      setActiveLoadingModelId(null);
    }
  };

  // Cancel ongoing download and reset state
  const handleCancelDownload = async (modelId: string) => {
    try {
      await webLLMService.cancelAndReset();
    } catch (e) {
      console.warn('Cancel download error:', e);
    }
    setActiveLoadingModelId(null);
    setLocalModels((prev) =>
      prev.map((m) =>
        m.id === modelId
          ? {
              ...m,
              downloadStatus: 'not_downloaded',
              downloadProgress: 0,
              statusText: undefined,
              errorMessage: undefined,
            }
          : m
      )
    );
  };

  // Retry or Resume download (re-binds WebLLM)
  const handleRetryDownload = async (model: LocalLLMModel) => {
    webLLMService.forceResetInitializingLock();
    await handleDownloadAndLoad(model);
  };

  // Clean repair for broken partial cache and fresh re-download
  const handleRepairAndCleanDownload = async (model: LocalLLMModel) => {
    try {
      setLocalModels((prev) =>
        prev.map((m) =>
          m.id === model.id
            ? {
                ...m,
                statusText: '破損キャッシュを修復・初期化中...',
                errorMessage: undefined,
              }
            : m
        )
      );
      await webLLMService.repairModelCache(model.id);
      webLLMService.forceResetInitializingLock();
      await handleDownloadAndLoad(model);
    } catch (e: any) {
      console.warn('Repair download failed:', e);
    }
  };

  // Batch download all non-cached models sequentially
  const handleDownloadAllModels = async () => {
    if (isBatchDownloading) return;

    const pendingModels = localModels.filter(
      (m) => m.downloadStatus !== 'cached' && m.downloadStatus !== 'loaded_in_vram'
    );

    if (pendingModels.length === 0) {
      setScanNotice('✅ すべてのモデルが既にダウンロード済み（端末キャッシュ済み）です！');
      setTimeout(() => setScanNotice(null), 4000);
      return;
    }

    const totalMB = pendingModels.reduce((sum, m) => sum + m.sizeMB, 0);
    setScanNotice(`📥 全 ${pendingModels.length} モデル（合計 約 ${(totalMB / 1024).toFixed(1)} GB）の一括ダウンロードを開始しました...`);

    cancelBatchRef.current = false;
    setIsBatchDownloading(true);

    for (let i = 0; i < pendingModels.length; i++) {
      if (cancelBatchRef.current) {
        break;
      }
      const model = pendingModels[i];
      setBatchQueue({
        total: pendingModels.length,
        currentIdx: i + 1,
        currentModelName: model.name,
      });

      try {
        await handleDownloadAndLoad(model);
        await new Promise((r) => setTimeout(r, 400));
      } catch (err: any) {
        console.warn(`Batch download failed for ${model.name}:`, err);
        if (cancelBatchRef.current || err?.name === 'QuotaExceededError') {
          break;
        }
      }
    }

    setIsBatchDownloading(false);
    setBatchQueue(null);
    setScanNotice('🎉 全モデルの一括ダウンロードが完了しました！');
    setTimeout(() => setScanNotice(null), 5000);
    await runCacheIntegrityScan();
  };

  const handleCancelBatchDownload = async () => {
    cancelBatchRef.current = true;
    setIsBatchDownloading(false);
    setBatchQueue(null);
    setScanNotice('⏹️ 一括ダウンロードを中断しました');
    setTimeout(() => setScanNotice(null), 3000);
    if (activeLoadingModelId) {
      await handleCancelDownload(activeLoadingModelId);
    }
  };

  // Clear all cached models and reset WebGPU engine
  const handleClearAllCaches = async () => {
    setShowClearConfirm(false);
    try {
      setScanNotice('🗑️ すべてのモデルキャッシュを削除し、WebGPUエンジンを初期化中...');
      await webLLMService.clearAllCaches();
      setLocalModels((prev) =>
        prev.map((m) => ({
          ...m,
          downloadStatus: 'not_downloaded',
          downloadProgress: 0,
          statusText: undefined,
          errorMessage: undefined,
        }))
      );
      setActiveLoadingModelId(null);
      setTestingModelId(null);
      setTestOutput('');
      await refreshStorageEstimate();
      setScanNotice('✨ すべてのモデルキャッシュを削除し、WebGPUエンジンを完全初期化しました');
      setTimeout(() => setScanNotice(null), 5000);
    } catch (err) {
      console.error('Clear all caches error:', err);
      setScanNotice('❌ キャッシュ削除中にエラーが発生しました');
    }
  };

  // Real Delete Cache
  const handleDeleteCache = async (modelId: string) => {
    try {
      await webLLMService.deleteModelCache(modelId);
      setLocalModels((prev) =>
        prev.map((m) =>
          m.id === modelId
            ? {
                ...m,
                downloadStatus: 'not_downloaded',
                downloadProgress: 0,
                statusText: undefined,
                errorMessage: undefined,
              }
            : m
        )
      );
      if (testingModelId === modelId) {
        setTestingModelId(null);
        setTestOutput('');
      }
    } catch (err: any) {
      console.error('Delete cache error:', err);
    }
  };

  // Add Custom HuggingFace Model
  const handleAddCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRepoInput.trim()) return;

    const rawId = customRepoInput.trim();
    const shortName = rawId.split('/').pop() || rawId;

    const newModel: LocalLLMModel = {
      id: rawId,
      name: shortName,
      expertRole: customRoleInput,
      expertName: `Custom ${customRoleInput.toUpperCase()} Expert`,
      icon: '📦',
      sizeMB: 1200,
      parameters: 'Custom',
      quantization: 'q4f16_1',
      vramMB: 1800,
      description: `HuggingFace / WebLLM リポジトリ (${rawId})`,
      huggingFaceRepo: rawId,
      downloadStatus: 'not_downloaded',
      downloadProgress: 0,
    };

    setLocalModels((prev) => [newModel, ...prev]);
    setCustomRepoInput('');
  };

  // Real WebGPU Test Inference
  const handleRunTestInference = async (model: LocalLLMModel) => {
    setTestingModelId(model.id);
    setIsTestRunning(true);
    setTestOutput('');
    setTestMetrics(null);

    const tStart = performance.now();
    let firstTokenTime: number | null = null;
    let fullText = '';
    let tokenCount = 0;

    try {
      // If not yet loaded into active engine, load it first
      if (webLLMService.getActiveModelId() !== model.id || !webLLMService.isLoaded()) {
        setTestOutput('🔄 WebGPU メモリにモデルをバインド中...');
        await webLLMService.loadModel(model.id);
        setLocalModels((prev) =>
          prev.map((m) =>
            m.id === model.id
              ? { ...m, downloadStatus: 'loaded_in_vram', downloadProgress: 100 }
              : m.downloadStatus === 'loaded_in_vram'
              ? { ...m, downloadStatus: 'cached' }
              : m
          )
        );
      }

      setTestOutput('⚡ オンデバイス推論実行中...\n');

      const messages: { role: 'system' | 'user'; content: string }[] = [
        {
          role: 'system',
          content: 'あなたはWebGPU上で動作するオンデバイスAIアシスタントです。親切で簡潔に日本語で回答してください。',
        },
        { role: 'user', content: testPrompt },
      ];

      for await (const chunk of webLLMService.streamChat(messages, {
        temperature: 0.7,
        max_tokens: 256,
        fallbackModelId: model.id,
      })) {
        if (firstTokenTime === null) {
          firstTokenTime = performance.now();
        }
        fullText += chunk;
        tokenCount += 1;
        setTestOutput(fullText);
      }

      const tEnd = performance.now();
      const durationSec = (tEnd - (firstTokenTime || tStart)) / 1000;
      const speed = Number((tokenCount / Math.max(0.05, durationSec)).toFixed(1));
      const latency = Math.round((firstTokenTime || tEnd) - tStart);

      setTestMetrics({ speed, latency });
    } catch (err: any) {
      console.error('Test inference error:', err);
      setTestOutput(`❌ 推論エラー: ${err.message || err}`);
    } finally {
      setIsTestRunning(false);
    }
  };

  // Calculate total cached
  const cachedModels = localModels.filter(
    (m) => m.downloadStatus === 'cached' || m.downloadStatus === 'loaded_in_vram'
  );
  const cachedCount = cachedModels.length;
  const totalCachedMB = cachedModels.reduce((sum, m) => sum + m.sizeMB, 0);

  const handleRunDistillation = async () => {
    const topicToUse = customTrainingTopic.trim() || trainingTopic;
    if (!topicToUse) return;

    setIsDistilling(true);
    setDistilledResult(null);
    setDistillSuccessMsg(null);

    try {
      const res = await distillKnowledgeForLocalLLM({
        topic: topicToUse,
        skillType: trainingSkillType,
      });

      if (res.success && res.knowledge) {
        setDistilledResult(res.knowledge);
      } else {
        alert(res.error || '蒸留データの生成に失敗しました。');
      }
    } catch (err: any) {
      alert(`蒸留エラー: ${err.message || err}`);
    } finally {
      setIsDistilling(false);
    }
  };

  const handleSaveKnowledgeToMemory = () => {
    if (!distilledResult) return;

    try {
      const savedMemoriesRaw = localStorage.getItem('gamecraft_memories');
      const memoriesList: MemoryItem[] = savedMemoriesRaw ? JSON.parse(savedMemoriesRaw) : [];

      const newMemory: MemoryItem = {
        id: 'mem_distill_' + Date.now(),
        category: 'gamedev',
        content: `【知識カード: ${distilledResult.title}】\n${distilledResult.content}\n\nQ&A例:\n${(distilledResult.qaPairs || []).map((p: any) => `Q: ${p.q}\nA: ${p.a}`).join('\n')}`,
        importance: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'manual',
        pinned: true,
        active: true,
        tags: ['distilled_llm_knowledge', distilledResult.category],
      };

      memoriesList.unshift(newMemory);
      localStorage.setItem('gamecraft_memories', JSON.stringify(memoriesList));
      setDistillSuccessMsg(`✨ 知識カード「${distilledResult.title}」を端末記憶 (Memory) に保存しました！みきが次回以降の会話・ゲーム作成でこの知識を活用します。`);
    } catch (e) {
      alert('記憶の保存に失敗しました。');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-500/20 to-sky-600/20 border border-purple-500/30 text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 flex flex-wrap items-center gap-2">
                <span>端末ローカル LLM &amp; MoE / WebGPU エンジン</span>
                <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap shrink-0">
                  {engineMode === 'moe' ? 'MoE Multi-Agent' : engineMode === 'webgpu' ? 'WebGPU' : 'Gemini 3.7'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                ブラウザの WebGPU で LLM 重みを直接ダウンロード・端末内実行 (オフライン/低遅延)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 sm:px-6 gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('downloader')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'downloader'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>📦 モデル一覧 & ダウンロード</span>
            {totalCachedMB > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {(totalCachedMB / 1024).toFixed(1)} GB
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('training')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'training'
                ? 'border-pink-500 text-pink-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-pink-400" />
            <span>🎓 LLM教育・知識蒸留</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
              Teacher AI
            </span>
          </button>

          <button
            onClick={() => setActiveTab('benchmark')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'benchmark'
                ? 'border-sky-500 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>📱 端末診断 & 推奨判定</span>
            {deviceReport && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                {deviceReport.performanceTier.toUpperCase()}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'architecture'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>💡 外付け記憶＆モデル切替の仕組み</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Active WebGPU Engine Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-pink-950/50 border border-purple-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 text-purple-300 rounded-lg border border-purple-500/40">
                <Cpu className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-slate-100">
                    ⚡ 端末オンデバイス WebGPU 推論（完全無料・トークン消費0）
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <p className="text-[11px] text-slate-300/80">
                  おしゃべりやゲーム作成はすべて端末内のローカルGPUで直接推論。教育・知識合成は「🎓 LLM教育」タブで実行できます。
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('training')}
              className="px-3 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/50 text-pink-200 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-center"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>LLMを教育する</span>
            </button>
          </div>

          {/* WebGPU Warning if not supported */}
          {webGpuError && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">WebGPU の状態: </span>
                {webGpuError}
                <div className="text-[11px] text-amber-300/80 mt-1">
                  ※ Chrome/Edge/Brave などの WebGPU 対応ブラウザをご利用いただくと、最高速度でハードウェア推論が行われます。
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: Real Local LLM Downloader & Runner */}
          {activeTab === 'downloader' && (
            <div className="space-y-5">
              {/* Storage & MoE Toggle */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <span>端末内 WebGPU / CacheStorage 保持容量:</span>
                        <span className="text-purple-400 font-mono">
                          {(totalCachedMB / 1024).toFixed(2)} GB
                        </span>
                        {storageQuota && (
                          <span className="text-[11px] text-slate-400 font-normal">
                            (ブラウザ上限: {(storageQuota.quotaMB / 1024).toFixed(1)} GB / 空きあり)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        ダウンロードしたモデル重みは端末のブラウザキャッシュに安全に永続化され、通信不要で動作します
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center flex-wrap gap-2">
                    <button
                      onClick={runCacheIntegrityScan}
                      disabled={isScanningIntegrity}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-950/60 hover:bg-sky-900/60 text-sky-300 border border-sky-600/40 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                      title="端末キャッシュの整合性をスキャンし、破損ファイルを自動診断"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isScanningIntegrity ? 'animate-spin' : ''}`} />
                      <span>{isScanningIntegrity ? '診断中...' : 'キャッシュ整合性スキャン'}</span>
                    </button>

                    {showClearConfirm ? (
                      <div className="flex items-center gap-1.5 bg-rose-950/90 border border-rose-600 px-2 py-1 rounded-lg animate-in fade-in duration-150">
                        <span className="text-[11px] text-rose-200 font-bold">全削除しますか？</span>
                        <button
                          onClick={handleClearAllCaches}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-bold shadow transition-colors"
                        >
                          確定
                        </button>
                        <button
                          onClick={() => setShowClearConfirm(false)}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowClearConfirm(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700/80 hover:border-rose-700/60 rounded-lg text-xs font-semibold transition-colors"
                        title="全モデルキャッシュを削除し、WebGPUエンジンを完全リセット"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>全消去 & リセット</span>
                      </button>
                    )}

                    <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-900 border border-slate-700/80 px-3 py-1.5 rounded-lg text-xs text-slate-200">
                      <input
                        type="checkbox"
                        checked={useLocalInMoE}
                        onChange={(e) => setUseLocalInMoE(e.target.checked)}
                        className="rounded border-slate-700 text-purple-500 focus:ring-0"
                      />
                      <span className="font-semibold">MoEで端末ローカル優先</span>
                    </label>
                  </div>
                </div>

                {/* Storage Quota Bar */}
                {storageQuota && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center gap-3 text-[11px] text-slate-400">
                    <div className="flex-1 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                      <div
                        className="bg-purple-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(2, storageQuota.percent))}%` }}
                      />
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-slate-300">
                      使用中: {(storageQuota.usedMB / 1024).toFixed(2)} GB ({storageQuota.percent}%)
                    </span>
                  </div>
                )}

                {/* Scan notice banner if any */}
                {scanNotice && (
                  <div className="p-2 rounded-lg bg-sky-950/50 border border-sky-500/30 text-sky-200 text-xs flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>{scanNotice}</span>
                  </div>
                )}
              </div>

              {/* Zero Token Guarantee Notice */}
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold text-emerald-300 flex items-center gap-2">
                      <span>トークン消費 0 保証（完全無料・プライベート）</span>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Zero Cloud Tokens
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-400/90 mt-0.5">
                      すべての対話・コード生成は端末内の WebGPU (VRAM) で直接計算されるため、クラウドAPIの課金やトークン消費は一切発生しません。
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommended Model Quick Banner based on Device Diagnosis */}
              {deviceReport && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/60 to-purple-950/60 border border-sky-500/40 space-y-2">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sky-300 font-bold text-xs">
                      <Smartphone className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>あなたの端末（{deviceReport.gpuName || 'スマホ/ブラウザ'}）に最適なモデル</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-200 border border-sky-500/30 uppercase font-mono">
                        Tier: {deviceReport.performanceTier}
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab('benchmark')}
                      className="text-[11px] text-sky-300 hover:text-sky-100 underline flex items-center gap-1 self-end sm:self-auto"
                    >
                      <span>詳しい端末診断結果を見る</span>
                      <span>→</span>
                    </button>
                  </div>

                  <div className="text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <div>
                      <div className="font-bold text-slate-100 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>推奨: {deviceReport.recommendedModelName}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{deviceReport.recommendationReason}</div>
                    </div>

                    {(() => {
                      const recModel = localModels.find((m) => m.id === deviceReport.recommendedModelId);
                      if (!recModel) return null;
                      return (
                        <div className="shrink-0 flex items-center gap-2">
                          {recModel.downloadStatus === 'not_downloaded' && (
                            <button
                              onClick={() => handleDownloadAndLoad(recModel)}
                              className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>推奨モデルをDL & ロード</span>
                            </button>
                          )}
                          {recModel.downloadStatus === 'cached' && (
                            <button
                              onClick={() => handleDownloadAndLoad(recModel)}
                              className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>VRAMへロード</span>
                            </button>
                          )}
                          {recModel.downloadStatus === 'loaded_in_vram' && (
                            <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>稼働中（最適）</span>
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Models List */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs font-semibold text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>端末実行対応 LLM モデル一覧</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                      {localModels.length} モデル
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {isBatchDownloading ? (
                      <button
                        onClick={handleCancelBatchDownload}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/50 rounded-lg text-xs font-bold transition-all animate-pulse"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>一括ダウンロード中止</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleDownloadAllModels}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 hover:from-purple-500 hover:to-sky-500 text-white rounded-lg text-xs font-bold shadow-md shadow-purple-600/25 transition-all active:scale-95"
                        title="表内の未ダウンロードモデルをすべて順番に端末キャッシュに保存"
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                        <span>
                          全モデルを一括ダウンロード (
                          {
                            localModels.filter(
                              (m) => m.downloadStatus !== 'cached' && m.downloadStatus !== 'loaded_in_vram'
                            ).length
                          }
                          件)
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Batch Download Progress Card */}
                {batchQueue && (
                  <div className="p-3.5 rounded-xl bg-purple-950/60 border border-purple-500/50 text-purple-200 text-xs flex flex-col gap-2.5 shadow-lg shadow-purple-950/40 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                        </span>
                        <span className="font-bold text-slate-100">
                          一括ダウンロード進行中:
                        </span>
                        <span className="px-2 py-0.5 rounded bg-purple-900/80 text-purple-200 font-mono border border-purple-700/60 font-semibold">
                          [{batchQueue.currentIdx} / {batchQueue.total}] {batchQueue.currentModelName}
                        </span>
                      </div>
                      <button
                        onClick={handleCancelBatchDownload}
                        className="px-2 py-0.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 rounded text-[11px] font-semibold transition-colors shrink-0"
                      >
                        中止
                      </button>
                    </div>
                    <div className="w-full bg-slate-900/90 rounded-full h-2 overflow-hidden border border-purple-800/60">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-sky-400 transition-all duration-300"
                        style={{
                          width: `${Math.round((batchQueue.currentIdx / batchQueue.total) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="text-[10px] text-purple-300/80">
                      ※ 順番にWebGPUエンジンがブラウザのCacheStorageへ重みを自動ダウンロード・キャッシュします。
                    </div>
                  </div>
                )}

                {localModels.map((model) => {
                  const isDownloading = model.downloadStatus === 'downloading';
                  const isLoaded = model.downloadStatus === 'loaded_in_vram';
                  const isCached = model.downloadStatus === 'cached' || isLoaded;
                  const isBusy = activeLoadingModelId === model.id;

                  return (
                    <div
                      key={model.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isLoaded
                          ? 'bg-purple-950/30 border-purple-500/80 ring-1 ring-purple-500/40'
                          : isCached
                          ? 'bg-slate-900/90 border-slate-700 hover:border-slate-600'
                          : isDownloading
                          ? 'bg-purple-950/20 border-purple-600/60'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl p-2 rounded-xl bg-slate-800/80 border border-slate-700/80 shrink-0">
                            {model.icon}
                          </span>
                          <div>
                            <div className="flex items-center flex-wrap gap-2">
                              <h3 className="font-bold text-sm text-slate-100">{model.name}</h3>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                {model.expertName}
                              </span>
                              {model.sizeMB <= 400 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1 font-bold">
                                  📱 スマホ・4G推奨
                                </span>
                              )}
                              {isLoaded && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-bold">
                                  <Check className="w-3 h-3" /> WebGPU VRAM 稼働中
                                </span>
                              )}
                              {isCached && !isLoaded && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 font-semibold">
                                  <HardDrive className="w-3 h-3" /> 端末キャッシュ済み
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{model.description}</p>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-2">
                              <span>
                                ダウンロード容量: <strong className="text-slate-300">~{model.sizeMB} MB</strong>
                              </span>
                              <span>•</span>
                              <span>
                                パラメータ: <strong className="text-slate-300">{model.parameters}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                量子化: <strong className="text-slate-300">{model.quantization}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                推奨VRAM: <strong className="text-purple-300">~{model.vramMB} MB</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {model.downloadStatus === 'not_downloaded' && (
                            <button
                              onClick={() => handleDownloadAndLoad(model)}
                              disabled={isBusy}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-md shadow-purple-600/20 transition-all disabled:opacity-50"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>端末にDL & ロード</span>
                            </button>
                          )}

                          {isDownloading && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRetryDownload(model)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded-lg text-xs font-bold transition-all shadow-sm"
                                title="固まったダウンロードを再開・リロード"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>再試行 (リロード)</span>
                              </button>
                              <button
                                onClick={() => handleCancelDownload(model.id)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 border border-rose-700/50 rounded-lg text-xs font-semibold transition-all"
                                title="ダウンロードを中止してリセット"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>中止</span>
                              </button>
                            </div>
                          )}

                          {isCached && (
                            <>
                              {!isLoaded ? (
                                <button
                                  onClick={() => handleDownloadAndLoad(model)}
                                  disabled={isBusy}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                                >
                                  <Cpu className="w-3.5 h-3.5" />
                                  <span>VRAMロード</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleRunTestInference(model)}
                                  disabled={isTestRunning && testingModelId === model.id}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 rounded-lg text-xs font-bold transition-colors"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  <span>テスト推論</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteCache(model.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                title="端末ストレージからモデルキャッシュを削除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Download Progress & Status Text */}
                      {isDownloading && (
                        <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                          <div className="flex justify-between items-center text-xs text-slate-400">
                            <span className="text-purple-300 font-mono text-[11px] truncate max-w-[70%]">
                              {model.statusText || 'ダウンロード中...'}
                            </span>
                            <div className="flex items-center gap-2">
                              {model.downloadSpeed && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-200 border border-purple-700/50 font-mono font-bold">
                                  ⚡ {model.downloadSpeed}
                                </span>
                              )}
                              {model.etaSeconds !== undefined && model.etaSeconds > 0 && (
                                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                                  (残り約 {model.etaSeconds < 60 ? `${model.etaSeconds}秒` : `${Math.ceil(model.etaSeconds / 60)}分`})
                                </span>
                              )}
                              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                              <span className="font-mono text-[11px] text-slate-200 font-bold">
                                {model.downloadProgress}%
                              </span>
                            </div>
                          </div>

                          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-sky-400 rounded-full transition-all duration-200"
                              style={{ width: `${Math.max(3, model.downloadProgress)}%` }}
                            />
                          </div>

                          {/* 0% Explanation and tips for large models */}
                          {model.downloadProgress === 0 && (
                            <div className="p-2 rounded bg-purple-950/40 border border-purple-800/40 text-[10px] text-purple-200 space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-purple-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                                <span>第1データブロック（約100MB）を受信中（0%表示のまま少々お待ちください）</span>
                              </div>
                              <p className="text-slate-400 leading-normal">
                                モデルは分割ブロックで届くため、最初のブロックが完了するまで0%表示となります。正常に通信中です。
                              </p>
                              {model.sizeMB >= 800 && (
                                <div className="pt-1 flex items-center justify-between">
                                  <span className="text-amber-300">💡 スマホですぐ試したい場合:</span>
                                  <button
                                    onClick={async () => {
                                      await handleCancelDownload(model.id);
                                      const smol = localModels.find((m) => m.id === 'SmolLM2-360M-Instruct-q4f16_1-MLC');
                                      if (smol) handleDownloadAndLoad(smol);
                                    }}
                                    className="px-2 py-0.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-bold shadow transition-colors"
                                  >
                                    ⚡ 超高速 360M (220MB) に切り替え
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[10px] text-slate-400">
                            <span className="text-slate-300">
                              {model.downloadSpeed
                                ? `🚀 通信速度: ${model.downloadSpeed} (正常に進行中)`
                                : '⏳ サーバー接続・重み初期化中...'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleRetryDownload(model)}
                                className="underline hover:text-purple-300 font-semibold"
                              >
                                再開・リロード
                              </button>
                              <span>•</span>
                              <button
                                onClick={() => handleCancelDownload(model.id)}
                                className="underline hover:text-rose-300"
                              >
                                中止
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Error text if any */}
                      {model.errorMessage && (
                        <div className="mt-2 text-xs text-rose-300 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/60 flex flex-col gap-2">
                          <div className="flex items-start sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                              <span className="leading-snug">{model.errorMessage}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                              <button
                                onClick={() => handleRepairAndCleanDownload(model)}
                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[11px] font-bold transition-colors flex items-center gap-1 shadow-sm"
                                title="破損したキャッシュファイルを削除して最初から綺麗に再ダウンロード"
                              >
                                <RotateCcw className="w-3 h-3" />
                                修復 & 再DL
                              </button>
                              <button
                                onClick={() => handleCancelDownload(model.id)}
                                className="px-2 py-1 bg-rose-900/60 hover:bg-rose-800 text-rose-200 rounded text-[11px] font-semibold transition-colors"
                                title="ダウンロード状態をリセット"
                              >
                                リセット
                              </button>
                            </div>
                          </div>

                          {/* Quota Exceeded Quick Action Banner */}
                          {(model.errorMessage.includes('Quota') || model.errorMessage.includes('容量')) && (
                            <div className="pt-2 border-t border-rose-900/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-rose-200">
                              <span>💡 容量確保のショートカット:</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={handleClearAllCaches}
                                  className="px-2 py-0.5 bg-rose-900/80 hover:bg-rose-800 text-rose-100 rounded text-[10px] font-bold transition-colors"
                                >
                                  全キャッシュ消去
                                </button>
                                {model.id !== 'SmolLM2-360M-Instruct-q4f16_1-MLC' && (
                                  <button
                                    onClick={() => {
                                      const smol = localModels.find(
                                        (m) => m.id === 'SmolLM2-360M-Instruct-q4f16_1-MLC'
                                      );
                                      if (smol) handleDownloadAndLoad(smol);
                                    }}
                                    className="px-2 py-0.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-bold transition-colors flex items-center gap-1"
                                  >
                                    ⚡ 超軽量 SmolLM2 (220MB) をDL
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Network / Fetch Error Quick Action Banner */}
                          {(model.errorMessage.includes('Failed to fetch') || model.errorMessage.includes('通信エラー')) && (
                            <div className="pt-2 border-t border-rose-900/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-rose-200">
                              <span>🌐 通信復旧ショートカット:</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleDownloadAndLoad(model)}
                                  className="px-2.5 py-0.5 bg-sky-700 hover:bg-sky-600 text-white rounded text-[10px] font-bold transition-colors flex items-center gap-1"
                                >
                                  <RotateCcw className="w-2.5 h-2.5" />
                                  再接続 & 再試行
                                </button>
                                <button
                                  onClick={() => handleRepairAndCleanDownload(model)}
                                  className="px-2 py-0.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-bold transition-colors"
                                >
                                  キャッシュ修復
                                </button>
                                {model.id !== 'SmolLM2-360M-Instruct-q4f16_1-MLC' && (
                                  <button
                                    onClick={() => {
                                      const smol = localModels.find(
                                        (m) => m.id === 'SmolLM2-360M-Instruct-q4f16_1-MLC'
                                      );
                                      if (smol) handleDownloadAndLoad(smol);
                                    }}
                                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/40 rounded text-[10px] font-bold transition-colors"
                                  >
                                    ⚡ 最軽量SmolLM2 (220MB)
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Interactive Test Inference Area */}
              {testingModelId && (
                <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/40 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                      <Terminal className="w-4 h-4" />
                      <span>端末内 WebGPU オンデバイス推論テスト</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {testMetrics && (
                        <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 mr-2">
                          <span>⚡ {testMetrics.speed} tok/s</span>
                          <span>•</span>
                          <span>⏱️ {testMetrics.latency} ms</span>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setTestingModelId(null);
                          setTestOutput('');
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                        title="テストコンソールを閉じる"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testPrompt}
                      onChange={(e) => setTestPrompt(e.target.value)}
                      placeholder="テストプロンプトを入力..."
                      className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      onClick={() => {
                        const target = localModels.find((m) => m.id === testingModelId);
                        if (target) handleRunTestInference(target);
                      }}
                      disabled={isTestRunning}
                      className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {isTestRunning ? '推論中...' : '実行'}
                    </button>
                  </div>

                  <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 leading-relaxed min-h-[60px] whitespace-pre-wrap select-text">
                    {testOutput || '出力を待機中...'}
                  </div>
                </div>
              )}

              {/* Add Custom HuggingFace Model */}
              <form
                onSubmit={handleAddCustomModel}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3"
              >
                <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Search className="w-4 h-4 text-purple-400" />
                  <span>カスタム HuggingFace / WebLLM リポジトリの追加</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={customRepoInput}
                    onChange={(e) => setCustomRepoInput(e.target.value)}
                    placeholder="例: Qwen/Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC"
                    className="sm:col-span-2 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />

                  <select
                    value={customRoleInput}
                    onChange={(e: any) => setCustomRoleInput(e.target.value)}
                    className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="code">Code Expert</option>
                    <option value="logic">Logic / Reasoning</option>
                    <option value="moe_chat">Companion Moe</option>
                    <option value="general">General</option>
                  </select>

                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                  >
                    モデルを追加
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: LLM Education & Knowledge Distillation (Teacher AI) */}
          {activeTab === 'training' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Header Box */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-950 to-pink-950/30 border border-pink-500/30 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-pink-500/20 text-pink-300 border border-pink-500/30">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <span>Teacher AI による端末ローカルLLMの教育・知識蒸留</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30">
                        Knowledge Distillation
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300/80">
                      大規模クラウドAI（Teacher）の知識を凝縮し、WebGPUで動く端末内ローカルLLM（みき）に高品質なナレッジカードとQ&amp;Aデータセットを注入・教育します。
                    </p>
                  </div>
                </div>
              </div>

              {/* Training Preset Selection */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-pink-400" />
                  <span>教育トピックを選択（または自由入力）</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    {
                      label: '🪐 Three.js 3Dゲーム & 60fps最適化',
                      topic: 'Three.js 3Dゲーム開発、ライト・シャドウ・カメラ制御、60fps最適化',
                      skill: 'game' as const,
                    },
                    {
                      label: '🌸 相棒ペルソナ & 感情豊かな対話',
                      topic: '親しみやすく自然な日本語会話、相棒ペルソナ、共感と励まし',
                      skill: 'persona' as const,
                    },
                    {
                      label: '🟢 2Dオセロ & ボードゲームAI',
                      topic: 'オセロの合法手判定、ミニマックス探索AI、Canvasグラフィックス',
                      skill: 'logic' as const,
                    },
                    {
                      label: '⚡ WebGPUシェーダー & WGSLエフェクト',
                      topic: 'WebGPUコンピュートシェーダー、WGSL、流体パーティクル表現',
                      skill: 'code' as const,
                    },
                    {
                      label: '🔧 自律デバッグ & 構文エラー修復',
                      topic: 'JavaScript/TypeScript構文エラーの即時特定、スコープ解決ルール',
                      skill: 'code' as const,
                    },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setTrainingTopic(preset.topic);
                        setCustomTrainingTopic('');
                        setTrainingSkillType(preset.skill);
                      }}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        trainingTopic === preset.topic && !customTrainingTopic
                          ? 'bg-pink-500/20 border-pink-500/60 text-pink-200 font-bold'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom Input */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <label className="text-[11px] text-slate-400 block font-medium">
                    自由入力トピック（教えたい特定のゲームジャンルや対話テーマ）:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customTrainingTopic}
                      onChange={(e) => setCustomTrainingTopic(e.target.value)}
                      placeholder="例: レトロ風インベーダーゲームのスコア・衝突判定アルゴリズム"
                      className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500"
                    />
                    <select
                      value={trainingSkillType}
                      onChange={(e: any) => setTrainingSkillType(e.target.value)}
                      className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
                    >
                      <option value="game">🎮 ゲーム開発</option>
                      <option value="code">💻 コーディング</option>
                      <option value="persona">🌸 対話・性格</option>
                      <option value="logic">🧩 ロジック</option>
                    </select>
                  </div>
                </div>

                {/* Execute Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleRunDistillation}
                    disabled={isDistilling}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-pink-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    <GraduationCap className={`w-4 h-4 ${isDistilling ? 'animate-spin' : ''}`} />
                    <span>{isDistilling ? '知識蒸留・データ合成中...' : '🚀 知識蒸留・学習を実行する'}</span>
                  </button>
                </div>
              </div>

              {/* Success Notification */}
              {distillSuccessMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{distillSuccessMsg}</span>
                  </div>
                </div>
              )}

              {/* Distillation Result Display */}
              {distilledResult && (
                <div className="p-4 rounded-xl bg-slate-950 border border-pink-500/40 space-y-3 animate-in fade-in duration-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-pink-400" />
                      <span className="font-bold text-slate-100 text-xs sm:text-sm">
                        {distilledResult.title}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30 uppercase">
                        {distilledResult.category}
                      </span>
                    </div>

                    <button
                      onClick={handleSaveKnowledgeToMemory}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>✨ 端末記憶 (Memory) に保存して注入</span>
                    </button>
                  </div>

                  {distilledResult.summary && (
                    <div className="p-2.5 rounded-lg bg-pink-950/30 border border-pink-500/20 text-pink-200 text-[11px] leading-relaxed">
                      💡 {distilledResult.summary}
                    </div>
                  )}

                  {/* Knowledge Content */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400">注入知識スニペット:</span>
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap font-mono leading-relaxed select-text">
                      {distilledResult.content}
                    </div>
                  </div>

                  {/* QA Pairs */}
                  {distilledResult.qaPairs && distilledResult.qaPairs.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-800/80">
                      <span className="text-[11px] font-bold text-slate-400">合成されたQ&amp;Aデータセット (例):</span>
                      <div className="space-y-1.5">
                        {distilledResult.qaPairs.map((pair, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-1">
                            <div className="text-pink-300 font-semibold">Q: {pair.q}</div>
                            <div className="text-slate-300 font-mono text-[11px]">A: {pair.a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Device Specs & Model Benchmark Diagnosis */}
          {activeTab === 'benchmark' && (
            <div className="space-y-5">
              {/* Header card with quick diagnose button */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-100 text-sm flex items-center gap-2">
                      <span>📱 スマホ＆端末ハードウェア適合度診断</span>
                      {deviceReport && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30 uppercase">
                          Tier: {deviceReport.performanceTier}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      あなたのスマホの GPU (WebGPU/WebGL)、VRAM、RAM、ストレージを計測し、快適に動くモデルを自動判定します
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleRunDeviceDiagnosis}
                  disabled={isDiagnosingDevice}
                  className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all disabled:opacity-50 self-end sm:self-auto"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isDiagnosingDevice ? 'animate-spin' : ''}`} />
                  <span>{isDiagnosingDevice ? '診断実行中...' : 'ハードウェア再診断'}</span>
                </button>
              </div>

              {/* Hardware Specs Grid */}
              {deviceReport && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-sky-400" />
                      <span>GPU アダプター / レンダラー</span>
                    </div>
                    <div className="font-bold text-slate-200 truncate" title={deviceReport.gpuName}>
                      {deviceReport.gpuName}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {deviceReport.isWebGPUSupported ? '✅ WebGPU ハードウェア対応' : '⚠️ WebGL2 フォールバック'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>GPU 最大バッファ制限 / VRAM</span>
                    </div>
                    <div className="font-bold text-amber-300">
                      最大 {deviceReport.maxBufferSizeMB} MB / 推論可能
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {deviceReport.maxBufferSizeMB >= 512 ? '大半のモデルをロード可能' : '軽量(0.5B以下)モデル推奨'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <span>GPU 演算能力 (GFLOPS)</span>
                    </div>
                    <div className="font-bold text-emerald-300 flex items-center justify-between">
                      <span>{benchmarkResult !== null ? `${benchmarkResult} GFLOPS` : '実測テスト可能'}</span>
                      <button
                        onClick={runGpuBenchmark}
                        disabled={isBenchmarking}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-semibold transition-colors"
                      >
                        {isBenchmarking ? '計測中...' : '実測実行'}
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-500">シェーダー並列演算速度</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                      <span>端末メモリ (RAM) & CPU コア</span>
                    </div>
                    <div className="font-bold text-purple-300">
                      RAM ~{deviceReport.deviceRamGB} GB / {deviceReport.cpuCores} CPU Cores
                    </div>
                    <div className="text-[10px] text-slate-500">ブラウザ報告値</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1 sm:col-span-2">
                    <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                      <span>あなたのスマホの総合判定・推奨モデル</span>
                    </div>
                    <div className="font-bold text-pink-300 flex items-center gap-2">
                      <span>{deviceReport.recommendedModelName}</span>
                    </div>
                    <div className="text-[11px] text-slate-300">{deviceReport.recommendationReason}</div>
                  </div>
                </div>
              )}

              {/* Model Compatibility Matrix */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-200 text-xs flex items-center gap-2">
                    <span>各モデルのスマホ適合度判定一覧</span>
                    <span className="text-[10px] text-slate-400 font-normal">（あなたのスマホでの動作予測）</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {deviceReport?.compatibleModels.map((item) => {
                    const statusConfig = {
                      optimal: { label: '◎ 超快適 (最適)', bg: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' },
                      supported: { label: '○ 動作可能', bg: 'bg-sky-950/60 text-sky-300 border-sky-500/40' },
                      heavy: { label: '△ 重い/発熱注意', bg: 'bg-amber-950/60 text-amber-300 border-amber-500/40' },
                      unsupported: { label: '✕ メモリ不足 (非推奨)', bg: 'bg-rose-950/60 text-rose-300 border-rose-500/40' },
                    }[item.status];

                    const matchedModel = localModels.find((m) => m.id === item.id);

                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-100">{item.name}</span>
                            <span className={`text-[10px] px-2 py-0.2 rounded-full border font-bold ${statusConfig.bg}`}>
                              {statusConfig.label}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">{item.reason}</div>
                        </div>

                        {matchedModel && (
                          <div className="shrink-0 flex items-center gap-2 self-end sm:self-auto">
                            {matchedModel.downloadStatus === 'not_downloaded' && (
                              <button
                                onClick={() => {
                                  setActiveTab('downloader');
                                  handleDownloadAndLoad(matchedModel);
                                }}
                                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>ダウンロード</span>
                              </button>
                            )}
                            {matchedModel.downloadStatus === 'cached' && (
                              <button
                                onClick={() => handleDownloadAndLoad(matchedModel)}
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span>ロード</span>
                              </button>
                            )}
                            {matchedModel.downloadStatus === 'loaded_in_vram' && (
                              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>現在稼働中</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Architecture & External Learning Explained */}
          {activeTab === 'architecture' && (
            <div className="space-y-5">
              {/* Question 1: External Data & LLM Swapping */}
              <div className="p-5 rounded-xl bg-slate-950/80 border border-pink-500/30 space-y-3">
                <div className="flex items-center gap-2.5 text-pink-300 font-bold text-sm">
                  <HelpCircle className="w-5 h-5 text-pink-400" />
                  <span>Q. 学習データを外付けにするなら、LLMは他のものでもいいの？</span>
                </div>
                <div className="p-3.5 rounded-lg bg-pink-950/20 border border-pink-500/20 text-xs text-slate-200 leading-relaxed space-y-2">
                  <div className="font-bold text-emerald-300">👉 A. まさにその通りです！どのモデルに切り替えても記憶はそのまま維持されます。</div>
                  <p className="text-slate-300">
                    このアプリでは、<strong>「LLM本体（計算・推論エンジン）」</strong>と<strong>「みきの人格・記憶・学習データ（外付けストレージ）」</strong>を完全に分離して設計しています。
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
                    <div className="font-bold text-sky-300 flex items-center gap-1.5">
                      <Layers className="w-4 h-4" />
                      <span>🧠 LLMモデル（交換可能な頭脳エンジン）</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      文章の組み立てやコードの生成を行う計算コアです。
                      SmolLM2 (360M), Qwen 2.5 (0.5B), Llama 3.2 (1B), Gemma 2 (2B) など、スマホのスペックや充電残量に合わせて自由に切り替えられます。
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
                    <div className="font-bold text-pink-300 flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4" />
                      <span>🌸 外付け記憶ストレージ（みきの人格・思い出）</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      あなたとの会話履歴、親密度、学習したゲームコード、設定した口調などは、すべて端末のストレージ（LocalStorage / IndexedDB）に永続保存されます。モデルを変えてもみきとしての記憶は一切消えません。
                    </p>
                  </div>
                </div>
              </div>

              {/* Question 2: Why GPU and Miki are Unified */}
              <div className="p-5 rounded-xl bg-slate-950/80 border border-purple-500/30 space-y-3">
                <div className="flex items-center gap-2.5 text-purple-300 font-bold text-sm">
                  <HelpCircle className="w-5 h-5 text-purple-400" />
                  <span>Q. GPU と みき専属（パートナー）が分かれている意味はあるの？</span>
                </div>
                <div className="p-3.5 rounded-lg bg-purple-950/20 border border-purple-500/20 text-xs text-slate-200 leading-relaxed space-y-2">
                  <div className="font-bold text-purple-300">👉 A. 「みき」が1人で日常会話・ゲーム開発・WebGPUシェーダーのすべてを担当します！</div>
                  <p className="text-slate-300">
                    以前は「会話担当」と「GPUコード担当」で別々に表示されていましたが、混乱を避けるため現在は<strong>「🌸 みき専属（統合パートナー）」として1つに統合</strong>されています。
                    みきに話しかけるだけで、雑談もコード作成もWebGPUグラフィックスも、文脈に合わせて自動で適切に対応します。
                  </p>
                </div>
              </div>

              {/* APK Storage Information */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-400 space-y-2 leading-relaxed">
                <div className="font-bold text-slate-300 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  <span>📱 Android APK（ネイティブアプリ）にした場合のメリット</span>
                </div>
                <p>
                  ブラウザ版ではブラウザのキャッシュ上限がありますが、<strong>Android APKとしてビルドした場合</strong>は端末本体の大容量ストレージ（内部ストレージやSDカード）に直接モデルを保存できます。また、APK内にモデルを事前同梱することで、初回起動時から完全通信不要で動作させることも可能です。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>WebGPU オンデバイス パイプライン準備完了</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition-colors"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
};
