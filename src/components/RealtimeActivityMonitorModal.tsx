import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Terminal,
  ChevronDown,
  ChevronUp,
  Brain,
  ShieldCheck,
  RefreshCw,
  Clock,
  ExternalLink,
} from 'lucide-react';
import {
  systemLogger,
  SystemLogEntry,
  StepExecutionSnapshot,
} from '../services/systemLogger';
import { proactiveContextOsService, ContextAwarenessSnapshot } from '../services/proactiveContextOsService';
import { selfCodeArchitectService } from '../services/selfCodeArchitectService';

interface RealtimeActivityMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
  isGenerating?: boolean;
}

export const RealtimeActivityMonitorModal: React.FC<RealtimeActivityMonitorModalProps> = ({
  isOpen,
  onClose,
  isLoading = false,
  isGenerating = false,
}) => {
  const [logs, setLogs] = useState<SystemLogEntry[]>(() => systemLogger.getLogs().slice(-60));
  const [steps, setSteps] = useState<StepExecutionSnapshot[]>(() => systemLogger.getCurrentSessionSteps());
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'STEP' | 'INFERENCE' | 'SELF_IMPROVEMENT' | 'TOOLS'>('ALL');
  const [contextSnapshot, setContextSnapshot] = useState<ContextAwarenessSnapshot>(() =>
    proactiveContextOsService.getSnapshot()
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // 最新のスナップショットを同期
    setLogs(systemLogger.getLogs().slice(-60));
    setSteps(systemLogger.getCurrentSessionSteps());
    setContextSnapshot(proactiveContextOsService.getSnapshot());

    // ログ通知サブスクライブ
    const unsubLog = systemLogger.subscribeLog((newEntry) => {
      setLogs((prev) => [...prev.slice(-100), newEntry]);
      setContextSnapshot(proactiveContextOsService.getSnapshot());
    });

    // ステップ通知サブスクライブ
    const unsubStep = systemLogger.subscribeStep((_step, allSteps) => {
      setSteps([...allSteps]);
    });

    return () => {
      unsubLog();
      unsubStep();
    };
  }, [isOpen]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((l) => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'STEP') return l.category === 'STEP';
    if (selectedFilter === 'INFERENCE') return l.category === 'INFERENCE' || l.category === 'WEBGPU' || l.category === 'NATIVE_GPU';
    if (selectedFilter === 'SELF_IMPROVEMENT') return l.category === 'SELF_IMPROVEMENT';
    if (selectedFilter === 'TOOLS') return l.category === 'TOOLS';
    return true;
  });

  const isWorking = isLoading || isGenerating;
  const currentActiveStep = steps.find((s) => s.status === 'active') || steps[steps.length - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="p-3 sm:p-4 bg-gradient-to-r from-slate-950 via-indigo-950/70 to-slate-950 border-b border-indigo-500/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white shadow-md">
              <Activity className={`w-4 h-4 ${isWorking ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  リアルタイム行動・思考モニター
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    isWorking
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700 animate-pulse'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isWorking ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  {isWorking ? 'アクティブ実行中' : 'アイドル待機中'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                みきが今どの工程（記憶検索・VBA検証・不変条件・自己改善）を実行しているか秒単位で可視化します
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                systemLogger.clearLogs();
                setLogs([]);
                setSteps([]);
              }}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] rounded-lg border border-slate-700 transition-colors"
              title="ログ表示をクリア"
            >
              クリア
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 状態サマリーカード */}
        <div className="p-3 sm:p-4 bg-slate-950/60 border-b border-slate-800 shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* 1. 現在の動作フェーズ */}
          <div className="p-2.5 bg-slate-900/90 border border-indigo-900/40 rounded-xl space-y-1">
            <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>実行中フェーズ</span>
            </div>
            <div className="text-xs font-bold text-indigo-200 truncate">
              {isWorking
                ? currentActiveStep?.title || '思考・パイプライン展開中'
                : '待機中 (次回の対話・自己改善準備完了)'}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {isWorking ? `工程 ${currentActiveStep?.stepNumber || 1}/10` : '常時自律待機'}
            </div>
          </div>

          {/* 2. 第54章 能動知覚OSステータス */}
          <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
              <Brain className="w-3 h-3 text-pink-400" />
              <span>能動知覚OS (第54章)</span>
            </div>
            <div className="text-xs font-bold text-pink-200">
              モード: {contextSnapshot.detectedUserMode}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              時間帯: {contextSnapshot.timeOfDay} / 疲労検知: {contextSnapshot.cognitiveFatigueDetected ? '検知(労りモード)' : '正常'}
            </div>
          </div>

          {/* 3. 5大不変条件ステータス */}
          <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>不変条件＆安全性 (第30章)</span>
            </div>
            <div className="text-xs font-bold text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>全5大不変条件ガード稼働中</span>
            </div>
            <div className="text-[10px] text-slate-400">
              Qwen保護 / プライバシー外部送信ゼロ / 回帰ゼロ
            </div>
          </div>
        </div>

        {/* 推論・自律改善 10段階工程バー */}
        {steps.length > 0 && (
          <div className="px-3 sm:px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                推論＆処理パイプライン進捗 (直近セッション)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {steps.length} 工程実行済み
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {steps.slice(-5).map((step, idx) => (
                <div
                  key={idx}
                  className={`p-1.5 rounded-lg border text-[10px] ${
                    step.status === 'success'
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : step.status === 'active'
                      ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200 animate-pulse'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono font-bold">
                    <span>工程 {step.stepNumber}/{step.totalSteps}</span>
                    <span className="text-[9px] text-slate-400">+{step.elapsedMs}ms</span>
                  </div>
                  <div className="truncate font-sans font-medium mt-0.5" title={step.title}>
                    {step.title}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* フィルター & 自動スクロールバー */}
        <div className="px-3 sm:px-4 py-2 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-400 font-bold mr-1">絞り込み:</span>
            {[
              { key: 'ALL', label: 'すべて' },
              { key: 'STEP', label: '工程 (Step)' },
              { key: 'INFERENCE', label: '推論・GPU' },
              { key: 'SELF_IMPROVEMENT', label: '自己改善' },
              { key: 'TOOLS', label: 'ツール' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedFilter(tab.key as any)}
                className={`px-2 py-0.5 rounded-md transition-all font-medium ${
                  selectedFilter === tab.key
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
            />
            <span>最新ログに自動追従</span>
          </label>
        </div>

        {/* リアルタイムログストリーム */}
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 font-mono text-[11px] space-y-1.5 bg-slate-950 select-text"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs font-sans">
              直近の実行ログはありません。メッセージを送信するか自己改善を実行するとリアルタイムで流れます。
            </div>
          ) : (
            filteredLogs.map((l) => {
              const isError = l.level === 'ERROR';
              const isWarn = l.level === 'WARN';
              const isStep = l.category === 'STEP';
              const isSelf = l.category === 'SELF_IMPROVEMENT';

              return (
                <div
                  key={l.id}
                  className={`p-1.5 rounded border transition-colors leading-relaxed ${
                    isError
                      ? 'bg-rose-950/40 border-rose-800/80 text-rose-300'
                      : isWarn
                      ? 'bg-amber-950/30 border-amber-800/60 text-amber-200'
                      : isStep
                      ? 'bg-indigo-950/40 border-indigo-800/60 text-indigo-200'
                      : isSelf
                      ? 'bg-purple-950/30 border-purple-800/50 text-purple-200'
                      : 'bg-slate-900/50 border-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="text-slate-500">
                      {new Date(l.epoch).toLocaleTimeString()}
                    </span>
                    {l.elapsedMs !== undefined && (
                      <span className="text-slate-500">+{l.elapsedMs}ms</span>
                    )}
                    <span
                      className={`px-1 py-0.2 rounded font-bold ${
                        isError
                          ? 'bg-rose-900 text-rose-200'
                          : isWarn
                          ? 'bg-amber-900 text-amber-200'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {l.level}
                    </span>
                    <span className="text-indigo-400 font-bold">[{l.category}]</span>
                  </div>

                  <div className="font-sans text-xs mt-0.5 text-slate-100">
                    {l.message}
                  </div>

                  {l.details && (
                    <pre className="mt-1 p-1 bg-black/60 rounded text-[9.5px] text-slate-400 overflow-x-auto">
                      {typeof l.details === 'string'
                        ? l.details
                        : JSON.stringify(l.details, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 sm:p-3 bg-slate-950 border-t border-slate-800 shrink-0 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px]">SystemLogger WebSocket & Storage 購読中</span>
          </div>

          <button
            onClick={() => {
              systemLogger.downloadDiagnosticsTxtFile();
            }}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold transition-all shadow active:scale-95"
          >
            完全ログをテキスト保存
          </button>
        </div>
      </div>
    </div>
  );
};
