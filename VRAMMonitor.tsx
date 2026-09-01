import React, { useState, useEffect, useRef } from 'react';
import { VRAMSnapshot, webLLMService } from '../services/webLlmService';
import { LocalLLMModel } from '../types';
import {
  Cpu,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Zap,
  HardDrive,
  Layers,
  Sparkles,
  Info,
  ShieldAlert,
  Sliders,
  Play,
  Pause,
  ArrowRight,
} from 'lucide-react';

interface VRAMMonitorProps {
  localModels: LocalLLMModel[];
  onSelectModelToLoad?: (model: LocalLLMModel) => void;
  onRefreshModels?: () => void;
}

export const VRAMMonitor: React.FC<VRAMMonitorProps> = ({
  localModels,
  onSelectModelToLoad,
  onRefreshModels,
}) => {
  const [snapshot, setSnapshot] = useState<VRAMSnapshot | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [pollIntervalMs, setPollIntervalMs] = useState(1500);
  const [history, setHistory] = useState<Array<{ time: number; usedMB: number; pressure: number }>>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isActionBusy, setIsActionBusy] = useState(false);

  const fetchSnapshot = async () => {
    try {
      const snap = await webLLMService.getVRAMSnapshot();
      setSnapshot(snap);
      setHistory((prev) => {
        const next = [
          ...prev,
          {
            time: snap.timestamp,
            usedMB: snap.totalUsedVRAM_MB,
            pressure: snap.pressureRatio,
          },
        ];
        return next.slice(-24); // Keep last 24 data points
      });
    } catch (e) {
      console.warn('VRAM snapshot error:', e);
    }
  };

  useEffect(() => {
    fetchSnapshot();
  }, []);

  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(fetchSnapshot, pollIntervalMs);
    return () => clearInterval(interval);
  }, [isPolling, pollIntervalMs]);

  const handleUnloadVRAM = async () => {
    setIsActionBusy(true);
    try {
      await webLLMService.unloadModel();
      setActionMessage('✨ VRAM上のモデル重みとバッファを完全に解放しました。');
      await fetchSnapshot();
      if (onRefreshModels) onRefreshModels();
    } catch (e: any) {
      setActionMessage(`❌ 解放エラー: ${e?.message || e}`);
    } finally {
      setIsActionBusy(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handlePurgeKVCache = async () => {
    setIsActionBusy(true);
    try {
      await webLLMService.purgeKVCache();
      setActionMessage('🧹 KVキャッシュ（コンテキスト履歴バッファ）をクリアしました。');
      await fetchSnapshot();
    } catch (e: any) {
      setActionMessage(`❌ クリアエラー: ${e?.message || e}`);
    } finally {
      setIsActionBusy(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleSwitchToLightModel = async () => {
    const lightModel = localModels.find((m) => m.id.includes('SmolLM2-360M') || m.id.includes('0.5B'));
    if (lightModel && onSelectModelToLoad) {
      onSelectModelToLoad(lightModel);
    }
  };

  if (!snapshot) {
    return (
      <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-3">
        <RotateCcw className="w-6 h-6 animate-spin text-purple-400" />
        <span className="text-xs">WebGPU VRAM 状態をスキャン中...</span>
      </div>
    );
  }

  // Pressure color helpers
  const getPressureColor = (level: VRAMSnapshot['pressureLevel']) => {
    switch (level) {
      case 'critical':
        return {
          text: 'text-rose-400',
          bg: 'bg-rose-500/20',
          border: 'border-rose-500/40',
          bar: 'bg-gradient-to-r from-orange-500 to-rose-600',
          badge: 'bg-rose-950/80 text-rose-300 border-rose-600',
          label: '🔴 OOM クラッシュ危険域',
        };
      case 'high':
        return {
          text: 'text-amber-400',
          bg: 'bg-amber-500/20',
          border: 'border-amber-500/40',
          bar: 'bg-gradient-to-r from-yellow-500 to-amber-600',
          badge: 'bg-amber-950/80 text-amber-300 border-amber-600',
          label: '🟠 高負荷 (注意)',
        };
      case 'moderate':
        return {
          text: 'text-yellow-400',
          bg: 'bg-yellow-500/20',
          border: 'border-yellow-500/40',
          bar: 'bg-gradient-to-r from-emerald-500 to-yellow-500',
          badge: 'bg-yellow-950/80 text-yellow-300 border-yellow-600',
          label: '🟡 適正・安定動作',
        };
      case 'low':
      default:
        return {
          text: 'text-emerald-400',
          bg: 'bg-emerald-500/20',
          border: 'border-emerald-500/40',
          bar: 'bg-gradient-to-r from-teal-500 to-emerald-500',
          badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-600',
          label: '🟢 低負荷・余裕あり',
        };
    }
  };

  const pressureColors = getPressureColor(snapshot.pressureLevel);
  const pressurePercent = Math.min(100, Math.round(snapshot.pressureRatio * 100));

  return (
    <div className="space-y-5">
      {/* Top Banner & Control Bar */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-tr from-purple-500/20 to-sky-500/20 border border-purple-500/30 text-purple-400">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100">リアルタイム VRAM & GPUメモリ監視</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${pressureColors.badge}`}>
                {pressureColors.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              WebGPU バッファ割り当て、OOMクラッシュリスク、GPUオフロード状態を可視化
            </p>
          </div>
        </div>

        {/* Polling toggles */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            onClick={() => setIsPolling(!isPolling)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all ${
              isPolling
                ? 'bg-purple-950/60 border-purple-500/50 text-purple-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title={isPolling ? 'リアルタイム計測を一時停止' : 'リアルタイム計測を再開'}
          >
            {isPolling ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPolling ? '1.5秒計測中' : '停止中'}</span>
          </button>

          <button
            onClick={fetchSnapshot}
            disabled={isActionBusy}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors"
            title="手動で最新状態を再取得"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isActionBusy ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-lg bg-purple-950/70 border border-purple-500/40 text-purple-200 text-xs flex items-center gap-2 animate-in fade-in duration-150">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Main Gauge & Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: GPU Memory Pressure Meter */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-purple-400" />
              <span>GPU VRAM 占有率</span>
            </span>
            <span className={`text-base font-black font-mono ${pressureColors.text}`}>
              {pressurePercent}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${pressureColors.bar}`}
                style={{ width: `${Math.min(100, Math.max(3, pressurePercent))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>使用中: {snapshot.totalUsedVRAM_MB} MB</span>
              <span>目安上限: {snapshot.deviceEstimatedVRAM_MB} MB</span>
            </div>
          </div>

          {/* History Sparkline */}
          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-[10px] text-slate-400 mb-1 block">負荷トレンド (過去24サンプル)</span>
            <div className="h-9 flex items-end gap-1 bg-slate-950/60 p-1 rounded border border-slate-800/60">
              {history.map((pt, idx) => {
                const barHeight = Math.max(8, Math.min(100, Math.round(pt.pressure * 100)));
                return (
                  <div
                    key={idx}
                    className="flex-1 bg-purple-500/60 hover:bg-purple-400 rounded-t-sm transition-all"
                    style={{ height: `${barHeight}%` }}
                    title={`${new Date(pt.time).toLocaleTimeString()}: ${pt.usedMB}MB (${Math.round(
                      pt.pressure * 100
                    )}%)`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 2: Active Model Offloading Card */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-sky-400" />
                <span>モデル常駐ステータス</span>
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  snapshot.isLoaded
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : snapshot.isLoading
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {snapshot.isLoaded
                  ? '⚡ 100% GPU VRAM 常駐'
                  : snapshot.isLoading
                  ? '🔄 VRAM バインド中'
                  : '💤 未ロード (アイドル)'}
              </span>
            </div>

            {snapshot.activeModelName ? (
              <div className="space-y-1.5 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="text-xs font-bold text-slate-100 truncate">
                  {snapshot.activeModelName}
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400 font-mono">
                  <div>パラメータ: <span className="text-slate-200">{snapshot.parameters || '-'}</span></div>
                  <div>量子化: <span className="text-sky-300">{snapshot.quantization || '-'}</span></div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/80 text-center text-xs text-slate-400">
                現在VRAMに展開中のモデルはありません
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">GPUオフロード方式:</span>
            <span className="text-sky-400 font-mono">WebGPU Unified VRAM</span>
          </div>
        </div>

        {/* Card 3: OOM Risk Index & Quick Actions */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>OOM (メモリ不足) リスク指数</span>
              </span>
              <span className={`text-xs font-mono font-bold ${pressureColors.text}`}>
                スコア: {snapshot.oomRiskScore}/100
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {snapshot.oomRisk === 'critical'
                ? '危険: ブラウザタブのメモリ枯渇によるクラッシュが懸念されます。'
                : snapshot.oomRisk === 'high'
                ? '警告: 負荷が高まっています。KVキャッシュの整理を推奨します。'
                : '安全: メモリクラッシュの危険性は極めて低いです。'}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
            {snapshot.isLoaded && (
              <div className="flex gap-2">
                <button
                  onClick={handleUnloadVRAM}
                  disabled={isActionBusy}
                  className="flex-1 py-1.5 px-2 bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-600/40 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  title="WebGPUからモデルをアンロードしてVRAMを即時全解放します"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>VRAM即時解放</span>
                </button>

                <button
                  onClick={handlePurgeKVCache}
                  disabled={isActionBusy}
                  className="flex-1 py-1.5 px-2 bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border border-amber-600/40 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  title="会話コンテキストバッファをリセットしてVRAMを節約"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>KVクリア</span>
                </button>
              </div>
            )}

            {snapshot.pressureLevel === 'critical' && (
              <button
                onClick={handleSwitchToLightModel}
                className="w-full py-1.5 px-2 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-600/50 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>超軽量 SmolLM2 (220MB) に切替</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* WebGPU Buffers Detailed Breakdown */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4 shadow-lg">
        <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-400" />
          <span>WebGPU バッファメモリ詳細内訳 (Buffer Allocations)</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Buffer 1: Model Weights */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block">① モデル重みバッファ (Weights)</span>
            <div className="text-base font-bold font-mono text-purple-300">
              {snapshot.weightsBufferMB} <span className="text-xs font-normal text-slate-400">MB</span>
            </div>
            <p className="text-[10px] text-slate-500">
              量子化パラメータ (q4f16_1) のテンソル重み
            </p>
          </div>

          {/* Buffer 2: KV Cache */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block">② KVキャッシュ (Attention Context)</span>
            <div className="text-base font-bold font-mono text-sky-300">
              {snapshot.kvCacheBufferMB} <span className="text-xs font-normal text-slate-400">MB</span>
            </div>
            <p className="text-[10px] text-slate-500">
              対話コンテキスト長 (2048〜4096 tokens) バッファ
            </p>
          </div>

          {/* Buffer 3: Compute Workspace */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block">③ 計算スクラッチパッド (Workspace)</span>
            <div className="text-base font-bold font-mono text-indigo-300">
              {snapshot.computeScratchpadMB} <span className="text-xs font-normal text-slate-400">MB</span>
            </div>
            <p className="text-[10px] text-slate-500">
              中間活性化テンソル & 一時コンピュート領域
            </p>
          </div>

          {/* Buffer 4: Hardware Limit */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block">④ 単一バッファ上限 (maxBufferSize)</span>
            <div className="text-base font-bold font-mono text-emerald-300">
              {snapshot.maxBufferSizeMB} <span className="text-xs font-normal text-slate-400">MB</span>
            </div>
            <p className="text-[10px] text-slate-500">
              GPUドライバ制約 (maxStorage: {snapshot.maxStorageBufferBindingSizeMB}MB)
            </p>
          </div>
        </div>
      </div>

      {/* Hardware Environment & OOM Advisory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hardware Specs */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
          <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-400" />
            <span>ハードウェア検出情報</span>
          </h4>

          <div className="space-y-1.5 text-xs text-slate-300 font-mono">
            <div className="flex justify-between border-b border-slate-900 pb-1">
              <span className="text-slate-400 font-sans">GPU アダプター:</span>
              <span className="text-slate-200 truncate max-w-[200px]">{snapshot.adapterName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-900 pb-1">
              <span className="text-slate-400 font-sans">ベンダー / アーキテクチャ:</span>
              <span>{snapshot.vendor} / {snapshot.architecture}</span>
            </div>
            {snapshot.deviceRamGB && (
              <div className="flex justify-between border-b border-slate-900 pb-1">
                <span className="text-slate-400 font-sans">端末システムRAM:</span>
                <span>約 {snapshot.deviceRamGB} GB</span>
              </div>
            )}
            {snapshot.jsHeapUsedMB && (
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">ブラウザ JS Heap 使用量:</span>
                <span>{snapshot.jsHeapUsedMB} MB / {snapshot.jsHeapLimitMB || 2048} MB</span>
              </div>
            )}
          </div>
        </div>

        {/* OOM Diagnostic Advisory */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
          <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
            <Info className="w-4 h-4 text-pink-400" />
            <span>OOM 予防と推奨アクション</span>
          </h4>

          <ul className="space-y-1.5 text-xs text-slate-300">
            {snapshot.oomDiagnosticTips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2 bg-slate-900/60 p-2 rounded border border-slate-800/60">
                <span className="text-pink-400 font-bold shrink-0">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
