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
  Brain,
  ShieldCheck,
  RefreshCw,
  Clock,
  GitBranch,
  RotateCcw,
  FileCode,
  Check,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import {
  systemLogger,
  SystemLogEntry,
  StepExecutionSnapshot,
} from '../services/systemLogger';
import { proactiveContextOsService, ContextAwarenessSnapshot } from '../services/proactiveContextOsService';
import { selfCodeArchitectService } from '../services/selfCodeArchitectService';
import {
  autonomousContinuousEvolutionService,
  AutonomousEvolutionStepEvent,
  AutonomousEvolutionRecord,
} from '../services/autonomousContinuousEvolutionService';
import { aiderEngineService, AiderCommitRecord } from '../services/aiderEngineService';

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
  const [activeTab, setActiveTab] = useState<'pipeline' | 'evolution' | 'logs'>('pipeline');
  const [logs, setLogs] = useState<SystemLogEntry[]>(() => systemLogger.getLogs().slice(-80));
  const [steps, setSteps] = useState<StepExecutionSnapshot[]>(() => systemLogger.getCurrentSessionSteps());
  const [selectedLogFilter, setSelectedLogFilter] = useState<'ALL' | 'STEP' | 'INFERENCE' | 'SELF_IMPROVEMENT' | 'TOOLS'>('ALL');
  const [contextSnapshot, setContextSnapshot] = useState<ContextAwarenessSnapshot>(() =>
    proactiveContextOsService.getSnapshot()
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 自律改善・Aiderトラッカー
  const [commits, setCommits] = useState<AiderCommitRecord[]>([]);
  const [isEvolutionBusy, setIsEvolutionBusy] = useState(false);
  const [latestEvolutionRecord, setLatestEvolutionRecord] = useState<AutonomousEvolutionRecord | null>(null);
  const [recentEvolutionSteps, setRecentEvolutionSteps] = useState<AutonomousEvolutionStepEvent[]>([]);
  const [isRollingBack, setIsRollingBack] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadCommits = async () => {
    try {
      const list = await aiderEngineService.fetchCommits();
      setCommits(list);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    // 最新状態のロード
    setLogs(systemLogger.getLogs().slice(-80));
    setSteps(systemLogger.getCurrentSessionSteps());
    setContextSnapshot(proactiveContextOsService.getSnapshot());
    loadCommits();

    // 1. SystemLogger サブスクライブ
    const unsubLog = systemLogger.subscribeLog((newEntry) => {
      setLogs((prev) => [...prev.slice(-120), newEntry]);
      setContextSnapshot(proactiveContextOsService.getSnapshot());
    });

    const unsubStep = systemLogger.subscribeStep((_step, allSteps) => {
      setSteps([...allSteps]);
    });

    // 2. 自律改善サービス サブスクライブ
    const unsubEvolution = autonomousContinuousEvolutionService.subscribe((record, isRunning) => {
      setIsEvolutionBusy(isRunning);
      if (record) setLatestEvolutionRecord(record);
    });

    const unsubEvolutionSteps = autonomousContinuousEvolutionService.subscribeSteps((step) => {
      setRecentEvolutionSteps((prev) => [...prev.slice(-25), step]);
      if (step.phase === 'COMPLETED' || step.phase === 'DEPLOY') {
        loadCommits();
      }
    });

    return () => {
      unsubLog();
      unsubStep();
      unsubEvolution();
      unsubEvolutionSteps();
    };
  }, [isOpen]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current && activeTab === 'logs') {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll, activeTab]);

  if (!isOpen) return null;

  const handleRollback = async (hash: string) => {
    setIsRollingBack(hash);
    try {
      const res = await aiderEngineService.rollbackCommit(hash);
      if (res.success) {
        setActionNotice(`✅ コミット [${hash}] を復元しました: ${res.restoredFiles?.join(', ') || res.message}`);
        await loadCommits();
      } else {
        setActionNotice(`⚠️ ロールバック失敗: ${res.message}`);
      }
    } catch (e: any) {
      setActionNotice(`❌ エラー: ${e?.message || e}`);
    } finally {
      setIsRollingBack(null);
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  const filteredLogs = logs.filter((l) => {
    if (selectedLogFilter === 'ALL') return true;
    if (selectedLogFilter === 'STEP') return l.category === 'STEP';
    if (selectedLogFilter === 'INFERENCE') return l.category === 'INFERENCE' || l.category === 'WEBGPU' || l.category === 'NATIVE_GPU';
    if (selectedLogFilter === 'SELF_IMPROVEMENT') return l.category === 'SELF_IMPROVEMENT';
    if (selectedLogFilter === 'TOOLS') return l.category === 'TOOLS';
    return true;
  });

  const isWorking = isLoading || isGenerating || isEvolutionBusy;
  const currentActiveStep = steps.find((s) => s.status === 'active') || steps[steps.length - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
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
                  リアルタイム行動・思考・自律改善モニター
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    isWorking
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700 animate-pulse'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isWorking ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                  {isWorking ? 'アクティブ実行中' : 'アイドル待機中'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                みきが今何をしているか（推論・思考・自律改善・コード生成・Aiderコミット・スナップショット）を秒単位で可視化します
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

        {/* Action Notice */}
        {actionNotice && (
          <div className="px-4 py-2 bg-indigo-950 border-b border-indigo-500/50 text-indigo-200 text-xs font-medium flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Main Sub-Tab Switcher */}
        <div className="px-3 sm:px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'pipeline'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>思考・対話パイプライン</span>
            {steps.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                {steps.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('evolution')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'evolution'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>自律改善・コミット＆復元</span>
            {commits.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                {commits.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'logs'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>リアルタイム診断ログ</span>
            {logs.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                {logs.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: 思考・対話パイプライン */}
        {activeTab === 'pipeline' && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-slate-950">
            {/* 状態サマリーカード */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
                  {isWorking ? `工程 ${currentActiveStep?.stepNumber || 1}/${currentActiveStep?.totalSteps || 10}` : '常時自律待機'}
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
                  時間帯: {contextSnapshot.timeOfDay} / 疲労: {contextSnapshot.cognitiveFatigueDetected ? '検知(労りモード)' : '正常'}
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
                <div className="text-[10px] text-slate-400 truncate">
                  モデル重み不変性 / プライバシー漏洩ゼロ / 物理ロールバック
                </div>
              </div>
            </div>

            {/* 推論・思考 10段階パイプライン工程バー */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  直近セッションの思考・推論工程
                </span>
                <span className="text-[10.5px] text-slate-400 font-mono">
                  {steps.length} 工程実行済み
                </span>
              </div>

              {steps.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  まだ推論パイプラインは実行されていません。チャットでメッセージを送信すると、思考工程（記憶想起・トーン調整・コードIR・反証・完了判定）がステップ順に可視化されます。
                </div>
              ) : (
                <div className="space-y-1.5">
                  {steps.map((step, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all ${
                        step.status === 'success'
                          ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                          : step.status === 'active'
                          ? 'bg-indigo-950/80 border-indigo-500 text-indigo-100 shadow-md animate-pulse'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-mono text-[10px] font-bold text-slate-300 shrink-0">
                          {step.stepNumber}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold truncate text-slate-100">{step.title}</div>
                          <div className="text-[10.5px] text-slate-400 truncate">
                            {typeof step.details === 'string' ? step.details : `カテゴリ: ${step.category}`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 font-mono text-[10.5px]">
                        <span className="text-slate-500">+{step.elapsedMs}ms</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                            step.status === 'success'
                              ? 'bg-emerald-900 text-emerald-200'
                              : step.status === 'active'
                              ? 'bg-indigo-900 text-indigo-200'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {step.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: 自律改善・コミット＆復元 */}
        {activeTab === 'evolution' && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-slate-950">
            {/* 現在の自律巡回ステータス */}
            <div className="p-3 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isEvolutionBusy ? 'bg-purple-400 animate-ping' : 'bg-slate-500'}`} />
                  <span className="text-xs font-bold text-purple-200">
                    自律改善エンジン (Autonomous Continuous Evolution)
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {isEvolutionBusy ? '自律サイクル進行中' : '常時スタンバイ'}
                </span>
              </div>

              {latestEvolutionRecord ? (
                <div className="text-xs text-slate-300 space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-purple-900/40">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-300">
                      直近改善章: 第{latestEvolutionRecord.chapterNumber || '??'}章『{latestEvolutionRecord.chapterTitle || '自律改善'}』
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(latestEvolutionRecord.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    対象ファイル: <span className="font-mono text-slate-300">{latestEvolutionRecord.targetFile}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    理由: {latestEvolutionRecord.reasoning}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 py-1">
                  現在実行中の自律改善はありません。「自己改善」タブから自律改善サイクルを開始できます。
                </div>
              )}

              {/* 直近の自律進化ステップ */}
              {recentEvolutionSteps.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="text-[10px] text-slate-400 font-bold">リアルタイム進捗ステップ:</div>
                  <div className="max-h-28 overflow-y-auto space-y-1 text-[10px] font-mono">
                    {recentEvolutionSteps.slice(-5).map((st, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-slate-300">
                        <span className="text-purple-400">[{st.phase}]</span>
                        <span className="text-slate-200">{st.title}</span>
                        <span className="text-slate-500 truncate">- {st.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Aider アトミックコミット & 物理スナップショット復元履歴 */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Aider アトミックコミット & 物理スナップショット復元履歴
                  </span>
                </div>
                <button
                  onClick={loadCommits}
                  className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10.5px] text-slate-300 rounded-lg border border-slate-700"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>再読み込み</span>
                </button>
              </div>

              {commits.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  まだコミット履歴がありません。自律実装サイクルが実行されると、ファイル変更前のスナップショットとコミットがここに記録されます。
                </div>
              ) : (
                <div className="space-y-2">
                  {commits.map((c) => (
                    <div
                      key={c.hash}
                      className={`p-2.5 rounded-xl border text-xs transition-all ${
                        c.status === 'ROLLED_BACK'
                          ? 'bg-slate-950/60 border-slate-800/60 opacity-60 text-slate-500'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10.5px] font-bold text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/50">
                            {c.hash}
                          </span>
                          <span className="font-semibold text-slate-100 truncate">
                            {c.message}
                          </span>
                          {c.isStub && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                              雛形スタブ
                            </span>
                          )}
                          {c.engine && (
                            <span className="text-[9.5px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                              {c.engine}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(c.timestamp).toLocaleTimeString()}
                          </span>

                          {c.status === 'ROLLED_BACK' ? (
                            <span className="text-[10px] font-bold text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded border border-rose-900/50">
                              復元済 (ROLLBACK)
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRollback(c.hash)}
                              disabled={isRollingBack === c.hash}
                              className="flex items-center gap-1 px-2.5 py-1 bg-rose-950/70 hover:bg-rose-900 text-rose-300 hover:text-rose-100 text-[10.5px] font-bold rounded-lg border border-rose-700/60 transition-all shadow-xs active:scale-95 disabled:opacity-50"
                              title="この変更前の物理ファイルスナップショットへ巻き戻します"
                            >
                              <RotateCcw className={`w-3 h-3 ${isRollingBack === c.hash ? 'animate-spin' : ''}`} />
                              <span>{isRollingBack === c.hash ? '復元中...' : 'スナップショット復元'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {c.files && c.files.length > 0 && (
                        <div className="mt-1.5 text-[10.5px] text-slate-400 flex items-center gap-2">
                          <FileCode className="w-3 h-3 text-slate-500" />
                          <span className="font-mono text-slate-300 truncate">{c.files.join(', ')}</span>
                          {c.snapshots && (
                            <span className="text-[9.5px] text-emerald-400">
                              (スナップショット {c.snapshots.length}件保管済)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: リアルタイム診断ログ */}
        {activeTab === 'logs' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
            {/* フィルターバー */}
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
                    onClick={() => setSelectedLogFilter(tab.key as any)}
                    className={`px-2 py-0.5 rounded-md transition-all font-medium ${
                      selectedLogFilter === tab.key
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

            {/* ログストリーム */}
            <div
              ref={logContainerRef}
              className="flex-1 overflow-y-auto p-3 sm:p-4 font-mono text-[11px] space-y-1.5 select-text"
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
          </div>
        )}

        {/* Footer */}
        <div className="p-2.5 sm:p-3 bg-slate-950 border-t border-slate-800 shrink-0 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px]">SystemLogger & Aider Engine リアルタイム同期中</span>
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
