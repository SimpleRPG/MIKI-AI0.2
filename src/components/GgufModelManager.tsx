import React, { useState, useEffect } from 'react';
import {
  Download,
  Play,
  Trash2,
  CheckCircle2,
  HardDrive,
  Cpu,
  RefreshCw,
  FolderOpen,
  Terminal,
  Zap,
  RotateCcw,
  Sparkles,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import { OFFICIAL_GGUF_MODELS, GgufModelDefinition, getModelManifest, getManifestNativeEnv } from '../services/ggufModels';
import { nativeLlmService, NativeStorageInfo, NativeGpuInfo } from '../services/nativeLlmService';
import { systemLogger } from '../services/systemLogger';

interface GgufModelManagerProps {
  onSelectModelToLoad?: (model: GgufModelDefinition) => void;
  onRunTestInference?: (model: GgufModelDefinition) => void;
}

export const GgufModelManager: React.FC<GgufModelManagerProps> = () => {
  const [models] = useState<GgufModelDefinition[]>(OFFICIAL_GGUF_MODELS);
  const [storageInfo, setStorageInfo] = useState<NativeStorageInfo | null>(null);
  const [hardwareSpecs, setHardwareSpecs] = useState<NativeGpuInfo | null>(null);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadStatusText, setDownloadStatusText] = useState<string>('');
  const [downloadSpeed, setDownloadSpeed] = useState<number | undefined>(undefined);
  const [etaSeconds, setEtaSeconds] = useState<number | undefined>(undefined);
  const [activeLoadedId, setActiveLoadedId] = useState<string | null>(null);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testOutput, setTestOutput] = useState<string>('');
  const [customFilePickerOpen, setCustomFilePickerOpen] = useState(false);

  const [notification, setNotification] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<string | null>(null);
  const [hasStorageAccess, setHasStorageAccess] = useState<boolean>(true);

  const showNotification = (type: 'info' | 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const refreshStorage = async () => {
    try {
      const info = await nativeLlmService.getStorageInfo().catch(() => null);
      if (info) setStorageInfo(info);
      const specs = await nativeLlmService.getHardwareSpecs().catch(() => null);
      if (specs) setHardwareSpecs(specs);
      setActiveLoadedId(nativeLlmService.getActiveModelId());
      const granted = await nativeLlmService.isSharedStorageAccessGranted().catch(() => true);
      setHasStorageAccess(granted);
    } catch (e) {
      console.warn('Failed to refresh storage info:', e);
    }
  };

  useEffect(() => {
    refreshStorage();
  }, []);

  const handleDownloadGguf = async (model: GgufModelDefinition) => {
    setDownloadingModelId(model.id);
    setDownloadProgress(0);
    setDownloadStatusText('ダウンロード準備中...');

    try {
      systemLogger.info('NATIVE_GPU', `GGUFモデルのダウンロードを開始: ${model.name}`);
      await nativeLlmService.downloadModel(
        model.id,
        model.downloadUrl,
        model.fileName,
        (report) => {
          setDownloadProgress(report.progress);
          setDownloadStatusText(report.text);
          setDownloadSpeed(report.speedMBs);
          setEtaSeconds(report.etaSeconds);
        }
      );
      systemLogger.info('NATIVE_GPU', `GGUFモデルのダウンロード完了: ${model.fileName}`);
      showNotification('success', `GGUFモデル「${model.name}」の保存が完了しました。`);
      await refreshStorage();
    } catch (err: any) {
      systemLogger.error('NATIVE_GPU', `ダウンロードエラー: ${err?.message || err}`);
      showNotification('error', `ダウンロード通知: ${err?.message || err}`);
    } finally {
      setDownloadingModelId(null);
      setDownloadProgress(0);
      setDownloadStatusText('');
      setDownloadSpeed(undefined);
      setEtaSeconds(undefined);
    }
  };

  const handleLoadGguf = async (model: GgufModelDefinition) => {
    try {
      systemLogger.info('NATIVE_GPU', `GGUFモデルをVRAM/RAMへロード: ${model.name}`);
      showNotification('info', `GGUFモデル「${model.name}」を展開中...`);
      await nativeLlmService.loadNativeModel(model.id, model.fileName);
      setActiveLoadedId(model.id);
      showNotification('success', `GGUFモデル「${model.name}」をVRAMにロードしました。即時推論可能です。`);
      await refreshStorage();
    } catch (err: any) {
      systemLogger.error('NATIVE_GPU', `GGUFモデルロード失敗: ${err?.message || err}`);
      showNotification('error', `ロード失敗: ${err?.message || err}`);
    }
  };

  const handleDeleteGguf = async (fileName: string) => {
    try {
      await nativeLlmService.deleteDownloadedModel(fileName);
      setDeleteConfirmTarget(null);
      showNotification('info', `GGUFファイル「${fileName}」を端末から削除しました。`);
      await refreshStorage();
    } catch (err: any) {
      showNotification('error', `削除エラー: ${err?.message || err}`);
    }
  };

  const handleRunGgufTest = async (model: GgufModelDefinition) => {
    setIsTestRunning(true);
    setTestOutput(`🚀 [GGUF llama.cpp Native] ${model.name} で推論テストを開始...\n\n`);

    try {
      const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        {
          role: 'system',
          content: 'あなたは端末内llama.cpp Nativeエンジンで動作するみきです。簡潔に日本語で挨拶してください。',
        },
        {
          role: 'user',
          content: 'こんにちは！あなたのモデル名と特徴を教えてください。',
        },
      ];

      for await (const chunk of nativeLlmService.streamNativeChat(messages, {
        temperature: 0.7,
        max_tokens: 256,
      })) {
        setTestOutput((prev) => prev + chunk);
      }
    } catch (err: any) {
      setTestOutput((prev) => prev + `\n\n❌ 推論エラー: ${err?.message || err}`);
    } finally {
      setIsTestRunning(false);
    }
  };

  const isModelFilePresent = (fileName: string) => {
    if (!storageInfo || !Array.isArray(storageInfo.files)) return false;
    const targetName = (fileName || '').toLowerCase();
    return storageInfo.files.some(
      (f) => f && typeof f.fileName === 'string' && f.fileName.toLowerCase() === targetName
    );
  };

  const freeDiskDisplay =
    storageInfo && typeof storageInfo.freeDiskMB === 'number' && !isNaN(storageInfo.freeDiskMB)
      ? `${(storageInfo.freeDiskMB / 1024).toFixed(1)} GB`
      : '8.0 GB';

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Notification Toast Banner */}
      {notification && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 animate-in fade-in duration-150 shadow-lg ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-950/80 border-rose-500/80 text-rose-200'
              : 'bg-sky-950/80 border-sky-500/80 text-sky-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-[10px] px-2 py-0.5 rounded bg-black/40 hover:bg-black/60 font-semibold"
          >
            閉じる
          </button>
        </div>
      )}

      {/* Shared Storage Access Warning */}
      {!hasStorageAccess && (
        <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/60 text-amber-100 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>
              「すべてのファイルへのアクセス」が未許可のため、GGUFモデルは共有フォルダ (Download/gguf-models) に保存できません。Termux側から同じモデルを使うには許可が必要です。
            </span>
          </div>
          <button
            onClick={() => nativeLlmService.requestSharedStorageAccess()}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shrink-0 self-end sm:self-auto"
          >
            許可する
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 via-slate-950 to-purple-950/60 border border-emerald-500/40 space-y-2.5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>GGUFモデル管理 (llama.cpp / Native GPU)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  llama.cpp GGUF
                </span>
              </div>
              <p className="text-xs text-slate-300/90 mt-0.5">
                標準の単一バイナリ形式 (.gguf) を端末ストレージに直接保存し、C++ JNI (OpenCL/Vulkan) で超高速オンデバイス推論を実行します。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={refreshStorage}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>ストレージ更新</span>
            </button>
          </div>
        </div>

        {/* Hardware status badge */}
        <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">推論バックエンド:</span>
            <span className="font-mono text-emerald-400 font-bold">
              {hardwareSpecs?.backend || (nativeLlmService.isNative() ? 'Vulkan / OpenCL' : 'WebGPU / WASM')}
            </span>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">端末GPU / チップ:</span>
            <span className="font-mono text-sky-300 font-bold truncate max-w-[140px]">
              {hardwareSpecs?.gpuRenderer || 'Snapdragon / ARM / Adreno'}
            </span>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">端末空き容量:</span>
            <span className="font-mono text-purple-300 font-bold">
              {freeDiskDisplay}
            </span>
          </div>
        </div>

        {/* Chapter 78: Model Manifest Spec Banner */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>モデルマニフェスト (78章: ビルド仕様・単一情報源)</span>
              </div>
              <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                v{getModelManifest().manifestVersion} (CI/CDビルド連動)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-slate-400 font-mono text-[10px]">
              <div>llama.cpp: <span className="text-slate-200">{getManifestNativeEnv().pinnedCommit} ({getManifestNativeEnv().pinnedCommitHash.slice(0, 7)})</span></div>
              <div>Target NDK: <span className="text-slate-200">{getManifestNativeEnv().ndkVersion}</span></div>
              <div>Vulkan-Headers: <span className="text-slate-200">{getManifestNativeEnv().vulkanHeaders.pinnedTag}</span></div>
              <div>SPIRV-Headers: <span className="text-slate-200">{getManifestNativeEnv().spirvHeaders.pinnedTag}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Model List Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
          <div className="flex items-center gap-2">
            <span>公式対応 GGUF モデル一覧 (4-bit Q4_K_M 最適化)</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
              {models.length} 種
            </span>
          </div>
        </div>

        {/* Downloading Banner */}
        {downloadingModelId && (
          <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs flex flex-col gap-2.5 shadow-lg shadow-emerald-950/40">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-bold text-slate-100">GGUFモデルを端末ストレージに直接ダウンロード中:</span>
                <span className="text-emerald-300 font-mono font-semibold">
                  {downloadStatusText || `${downloadProgress}%`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {downloadSpeed && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-200 font-mono font-bold">
                    ⚡ {downloadSpeed.toFixed(1)} MB/s
                  </span>
                )}
                <span className="font-mono font-bold text-slate-100">{downloadProgress}%</span>
              </div>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-emerald-800/60">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400 transition-all duration-200"
                style={{ width: `${Math.max(3, downloadProgress)}%` }}
              />
            </div>
            {etaSeconds !== undefined && etaSeconds > 0 && (
              <div className="text-[10px] text-emerald-300/80">
                残り時間: 約 {etaSeconds < 60 ? `${etaSeconds}秒` : `${Math.ceil(etaSeconds / 60)}分`}
              </div>
            )}
          </div>
        )}

        {/* GGUF Cards */}
        <div className="space-y-3">
          {models.map((model) => {
            const isFilePresent = isModelFilePresent(model.fileName);
            const isLoaded = activeLoadedId === model.id;
            const isDownloadingThis = downloadingModelId === model.id;

            return (
              <div
                key={model.id}
                className={`p-4 rounded-xl border transition-all ${
                  isLoaded
                    ? 'bg-emerald-950/30 border-emerald-500/80 ring-1 ring-emerald-500/40'
                    : isFilePresent
                    ? 'bg-slate-900/90 border-slate-700 hover:border-slate-600'
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
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-bold">
                            📱 スマホ最軽量
                          </span>
                        )}
                        {isLoaded && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-bold">
                            <CheckCircle2 className="w-3 h-3" /> VRAM常駐中 (高速推論可)
                          </span>
                        )}
                        {isFilePresent && !isLoaded && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1 font-semibold">
                            <HardDrive className="w-3 h-3" /> 端末保存済み (.gguf)
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{model.description}</p>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-2">
                        <span>
                          ファイル名: <strong className="font-mono text-slate-300">{model.fileName}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          容量: <strong className="text-slate-300">{model.sizeMB} MB</strong>
                        </span>
                        <span>•</span>
                        <span>
                          形式: <strong className="text-emerald-300">{model.quantization}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          推奨RAM/VRAM: <strong className="text-purple-300">~{model.vramMB} MB</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {!isFilePresent && (
                      <button
                        onClick={() => handleDownloadGguf(model)}
                        disabled={downloadingModelId !== null}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>GGUFを保存 (~{model.sizeMB}MB)</span>
                      </button>
                    )}

                    {isFilePresent && (
                      <>
                        {!isLoaded ? (
                          <button
                            onClick={() => handleLoadGguf(model)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold transition-colors"
                          >
                            <Cpu className="w-3.5 h-3.5" />
                            <span>VRAMロード</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRunGgufTest(model)}
                            disabled={isTestRunning}
                            className="flex items-center gap-1 px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 rounded-lg text-xs font-bold transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>{isTestRunning ? '推論中...' : 'テスト推論'}</span>
                          </button>
                        )}

                        {deleteConfirmTarget === model.fileName ? (
                          <div className="flex items-center gap-1 bg-rose-950/90 border border-rose-600 px-2 py-1 rounded-lg animate-in fade-in duration-100">
                            <span className="text-[10px] text-rose-200 font-bold">削除?</span>
                            <button
                              onClick={() => handleDeleteGguf(model.fileName)}
                              className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold"
                            >
                              確定
                            </button>
                            <button
                              onClick={() => setDeleteConfirmTarget(null)}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmTarget(model.fileName)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="端末からGGUFファイルを削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Test Output Box */}
      {testOutput && (
        <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              <span>llama.cpp GGUF ネイティブ推論出力結果</span>
            </div>
            <button
              onClick={() => setTestOutput('')}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline"
            >
              クリア
            </button>
          </div>
          <pre className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300 whitespace-pre-wrap select-text leading-relaxed">
            {testOutput}
          </pre>
        </div>
      )}

      {/* Manual Local GGUF File Loader Guide */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-bold flex items-center gap-2 text-slate-200">
            <FolderOpen className="w-4 h-4 text-emerald-400" />
            <span>自作・既存のGGUFファイルを端末から直接読み込む</span>
          </div>
          <button
            onClick={() => setCustomFilePickerOpen(!customFilePickerOpen)}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 underline"
          >
            {customFilePickerOpen ? '閉じる' : '詳細・フォルダ案内'}
          </button>
        </div>

        {customFilePickerOpen && (
          <div className="pt-2 border-t border-slate-800 space-y-2 text-[11px] text-slate-400 leading-relaxed">
            <p>
              PCからAndroidスマホの内部ストレージ（<code>/Android/data/.../files/models/</code>）やダウンロードフォルダに直接コピーした<code>.gguf</code>ファイルも自動認識されます。
            </p>
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300">
              💡 推奨GGUFモデル: <strong>Qwen2.5-Coder-0.5B-Instruct-Q4_K_M.gguf</strong> / <strong>Llama-3.2-1B-Instruct-Q4_K_M.gguf</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
