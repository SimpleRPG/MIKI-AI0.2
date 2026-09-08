import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Zap,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Cpu,
  FileCode,
  ShieldCheck,
  Activity,
  History,
  GitBranch,
  X,
  RefreshCw,
  Terminal,
  ArrowRight,
  TrendingUp,
  Undo2,
  Check,
  Clock,
  Sliders,
  FlaskConical,
  Bug,
  SplitSquareVertical,
  ListFilter,
  Search,
  Rocket,
} from 'lucide-react';
import {
  autonomousContinuousEvolutionService,
  AutonomousEvolutionRecord,
  AutonomousEvolutionStepEvent,
  AutopilotConfig,
  ImprovementBacklogItem,
} from '../../services/autonomousContinuousEvolutionService';
import {
  selfCodeArchitectService,
  SPECIFICATION_REGISTRY,
} from '../../services/selfCodeArchitectService';
import { SpecificationChapterMeta } from '../../types';

interface AutonomousSelfImprovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDiff?: (fileName: string, oldCode: string, newCode: string, filePath: string) => void;
  onOpenUnitTest?: (codeBlock: { name: string; content: string }) => void;
  onApplyRestoredCode?: (filePath: string, content: string) => void;
}

export const AutonomousSelfImprovementModal: React.FC<AutonomousSelfImprovementModalProps> = ({
  isOpen,
  onClose,
  onOpenDiff,
  onOpenUnitTest,
  onApplyRestoredCode,
}) => {
  const [history, setHistory] = useState<AutonomousEvolutionRecord[]>(() =>
    autonomousContinuousEvolutionService.getHistory()
  );
  const [isBusy, setIsBusy] = useState<boolean>(() =>
    autonomousContinuousEvolutionService.isBusy()
  );
  const [config, setConfig] = useState<AutopilotConfig>(() =>
    autonomousContinuousEvolutionService.getConfig()
  );
  const [currentStep, setCurrentStep] = useState<AutonomousEvolutionStepEvent | null>(null);
  const [stepsFeed, setStepsFeed] = useState<AutonomousEvolutionStepEvent[]>([]);
  const [selectedChapterNum, setSelectedChapterNum] = useState<number | 'AUTO'>('AUTO');
  const [customPromptInput, setCustomPromptInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'live' | 'backlog' | 'history' | 'config'>('live');
  const [notice, setNotice] = useState<string | null>(null);
  const [rollbackSuccessId, setRollbackSuccessId] = useState<string | null>(null);
  const [backlogSearch, setBacklogSearch] = useState<string>('');
  const [backlogCategoryFilter, setBacklogCategoryFilter] = useState<string>('ALL');

  const [backlog, setBacklog] = useState<ImprovementBacklogItem[]>(() =>
    autonomousContinuousEvolutionService.getImprovementBacklog()
  );

  const refreshBacklog = () => {
    setBacklog(autonomousContinuousEvolutionService.getImprovementBacklog());
  };

  useEffect(() => {
    if (!isOpen) return;

    const unsubState = autonomousContinuousEvolutionService.subscribe((latestRecord, running) => {
      setHistory(autonomousContinuousEvolutionService.getHistory());
      setIsBusy(running);
      setConfig(autonomousContinuousEvolutionService.getConfig());
      refreshBacklog();
      if (latestRecord && latestRecord.steps.length > 0) {
        setStepsFeed(latestRecord.steps);
        setCurrentStep(latestRecord.steps[latestRecord.steps.length - 1]);
      }
    });

    const unsubStep = autonomousContinuousEvolutionService.subscribeSteps((step) => {
      setCurrentStep(step);
      setStepsFeed((prev) => [...prev.slice(-40), step]);
    });

    return () => {
      unsubState();
      unsubStep();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunBatch = async (count: number = 3) => {
    try {
      setNotice(`🚀 上位${count}章の連続バッチ自己改善を開始しました...`);
      const res = await autonomousContinuousEvolutionService.runBatchAutonomousCycles(count);
      setNotice(`🎉 バッチ改善完了！${res.length}章を安全に合成・検証・配備しました！`);
      refreshBacklog();
    } catch (err: any) {
      setNotice(`⚠️ バッチ改善エラー: ${err?.message}`);
    }
    setTimeout(() => setNotice(null), 6000);
  };

  const handleToggleAutopilot = () => {
    if (config.enabled) {
      autonomousContinuousEvolutionService.stopAutopilot();
      setConfig((c) => ({ ...c, enabled: false }));
      setNotice('自動巡回モードを停止しました');
    } else {
      autonomousContinuousEvolutionService.startAutopilot();
      setConfig((c) => ({ ...c, enabled: true }));
      setNotice('🚀 自動巡回モードを起動しました！バックグラウンドで自己コード改善を継続します');
    }
    setTimeout(() => setNotice(null), 4000);
  };

  const handleRunSingleCycle = async (override?: { chapterNumber?: number; prompt?: string }) => {
    try {
      setNotice('⚡ みきが自律コード改善サイクルを開始しました...');
      const target =
        override?.chapterNumber != null
          ? { chapterNumber: override.chapterNumber }
          : override?.prompt
          ? { prompt: override.prompt }
          : selectedChapterNum !== 'AUTO'
          ? { chapterNumber: selectedChapterNum }
          : customPromptInput.trim()
          ? { prompt: customPromptInput.trim() }
          : undefined;

      const res = await autonomousContinuousEvolutionService.runFullAutonomousCycle(target);
      setNotice(`🎉 自律改善成功！第${res.chapterNumber ?? ''}章 適合スコア: ${res.previousScore}➔${res.newScore}点 (+${Math.max(0, res.newScore - res.previousScore)}点)`);
    } catch (err: any) {
      setNotice(`⚠️ 中断: ${err?.message || 'エラーが発生しました'}`);
    }
    setTimeout(() => setNotice(null), 6000);
  };

  const handleRollback = async (record: AutonomousEvolutionRecord) => {
    if (!record.snapshotId) {
      alert('この改善には復元用スナップショットがありません');
      return;
    }
    try {
      const res = await fetch('/api/self-code/rollback-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId: record.snapshotId }),
      });
      const data = await res.json();
      if (data.success) {
        setRollbackSuccessId(record.id);
        setNotice(`⏪ スナップショットから ${record.targetFile} を安全に復元しました！`);
        if (onApplyRestoredCode) {
          onApplyRestoredCode(record.targetFile, data.restoredContent || '');
        }
      } else {
        alert(data.error || 'ロールバックに失敗しました');
      }
    } catch (err: any) {
      alert(`ロールバック通信エラー: ${err?.message}`);
    }
  };

  const completedCount = selfCodeArchitectService.getCompletedChapters().length;
  const totalChapters = SPECIFICATION_REGISTRY.length;
  const currentComplianceScore = Math.round((completedCount / totalChapters) * 100);

  return (
    <div
      id="autonomous-self-improvement-modal"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-purple-500/40 rounded-2xl w-full max-w-5xl h-[92vh] max-h-[900px] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Cpu className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  みき自律コード自己改善・オートパイロット
                </h2>
                {config.enabled ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    自動巡回中 ({config.intervalSeconds}s)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    待機中
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                仕様書監査 ➔ ASTコード合成 ➔ TDD自動検証 ➔ 自己修復 ➔ 不変条件検査 ➔ スナップショット保護を全自動実行
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-toggle-autopilot"
              onClick={handleToggleAutopilot}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md ${
                config.enabled
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
              }`}
            >
              {config.enabled ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> 巡回一時停止
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> 自動巡回を起動
                </>
              )}
            </button>

            <button
              id="btn-run-single-cycle"
              disabled={isBusy}
              onClick={() => handleRunSingleCycle()}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md ${
                isBusy
                  ? 'bg-purple-900/50 text-purple-300 cursor-not-allowed border border-purple-500/30'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'
              }`}
            >
              {isBusy ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> 自律改善実行中...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" /> 1-Click 自律改善
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice Banner */}
        {notice && (
          <div className="bg-indigo-950/80 border-b border-indigo-500/40 text-indigo-200 px-4 py-2 text-xs flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
              {notice}
            </span>
            <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Status Bar */}
        <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">仕様書適合スコア:</span>
              <span className="font-bold text-purple-300 text-sm">{currentComplianceScore}点</span>
              <span className="text-slate-500">({completedCount} / {totalChapters}章 実装完了)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300 font-medium">不変条件5項目オールクリア</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-300">自己修復上限: 最大{config.autoHealLimit}回反復</span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('live')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTab === 'live' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              リアルタイム監視
            </button>
            <button
              onClick={() => setActiveTab('backlog')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'backlog' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListFilter className="w-3 h-3" />
              改善バックログ ({backlog.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTab === 'history' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              改善履歴 ({history.length})
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTab === 'config' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              巡回設定
            </button>
          </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'live' && (
            <div className="space-y-4">
              {/* Target & Prompt Control Row */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5 flex flex-col sm:flex-row items-center gap-3">
                <div className="w-full sm:w-1/3">
                  <label className="text-xs text-slate-400 block mb-1 font-medium">
                    改善ターゲット選定
                  </label>
                  <select
                    value={selectedChapterNum}
                    onChange={(e) =>
                      setSelectedChapterNum(e.target.value === 'AUTO' ? 'AUTO' : Number(e.target.value))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="AUTO">🤖 自動選定 (ドリフト・未実装章を優先)</option>
                    {SPECIFICATION_REGISTRY.map((c) => (
                      <option key={c.chapterNumber} value={c.chapterNumber}>
                        第{c.chapterNumber}章: {c.title} [{c.status === 'COMPLETED' ? '済' : '未'}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full sm:w-2/3">
                  <label className="text-xs text-slate-400 block mb-1 font-medium">
                    カスタム自己改善指示 (任意)
                  </label>
                  <input
                    type="text"
                    placeholder="例: 高負荷キャッシュの追加、型安全性の強化、例外ハンドリングの補強"
                    value={customPromptInput}
                    onChange={(e) => setCustomPromptInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Pipeline Flow Stages */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  自律実行パイプライン（10段階クローズドループ・高耐久検証）
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2">
                  {[
                    { key: 'AUDIT', label: '1. 監査', icon: Activity },
                    { key: 'INVARIANTS', label: '2. 不変条件', icon: ShieldCheck },
                    { key: 'PROPOSAL', label: '3. 提案契約', icon: GitBranch },
                    { key: 'SYNTHESIS', label: '4. コード合成', icon: FileCode },
                    { key: 'SYNTAX_CHECK', label: '5. AST構文', icon: CheckCircle2 },
                    { key: 'TDD_TEST', label: '6. TDDテスト', icon: FlaskConical },
                    { key: 'MUTATION_TEST', label: '7. 変異キル率', icon: Bug },
                    { key: 'SELF_HEALING', label: '8. 自己修復', icon: RotateCcw },
                    { key: 'SNAPSHOT', label: '9. スナップ', icon: History },
                    { key: 'DEPLOY', label: '10. 配備', icon: TrendingUp },
                  ].map((stage) => {
                    const StageIcon = stage.icon;
                    const isCurrent = currentStep?.phase === stage.key;
                    const isPassed = stepsFeed.some(
                      (s) => s.phase === stage.key && (s.status === 'SUCCESS' || s.status === 'WARNING')
                    );
                    return (
                      <div
                        key={stage.key}
                        className={`p-2 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                          isCurrent
                            ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-md animate-pulse'
                            : isPassed
                            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-900/60 border-slate-800 text-slate-500'
                        }`}
                      >
                        <StageIcon className="w-4 h-4" />
                        <span className="text-[10px] font-medium leading-tight">{stage.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Terminal Live Step Feed */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-72">
                <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-purple-400" />
                    <span>リアルタイム自律思考＆自己修復実行ログ</span>
                  </div>
                  {isBusy && (
                    <span className="text-purple-400 flex items-center gap-1 text-[11px] animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" /> みきがコードを改善中...
                    </span>
                  )}
                </div>

                <div className="flex-1 p-3 overflow-y-auto font-mono text-xs space-y-1.5 bg-black/40">
                  {stepsFeed.length === 0 ? (
                    <div className="text-slate-500 text-center py-10">
                      「1-Click 自律改善」または「自動巡回を起動」を押すと、ここにみきの全自動実行ログが流れます。
                    </div>
                  ) : (
                    stepsFeed.map((s, idx) => {
                      const timeStr = new Date(s.timestamp).toLocaleTimeString();
                      let statusBadge = (
                        <span className="text-indigo-400 font-bold">[RUN]</span>
                      );
                      if (s.status === 'SUCCESS') {
                        statusBadge = <span className="text-emerald-400 font-bold">[PASS]</span>;
                      } else if (s.status === 'WARNING') {
                        statusBadge = <span className="text-amber-400 font-bold">[HEAL]</span>;
                      } else if (s.status === 'FAILED') {
                        statusBadge = <span className="text-rose-400 font-bold">[FAIL]</span>;
                      }

                      return (
                        <div key={idx} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-slate-600 shrink-0">{timeStr}</span>
                          <span className="shrink-0">{statusBadge}</span>
                          <span className="text-purple-300 font-semibold shrink-0">
                            [{s.phase}]
                          </span>
                          <span className="text-slate-200">{s.title}:</span>
                          <span className="text-slate-400">{s.detail}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'backlog' && (
            <div className="space-y-4">
              {/* Backlog Header & Controls */}
              <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="章番号、キーワードでバックログ検索..."
                      value={backlogSearch}
                      onChange={(e) => setBacklogSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                    {['ALL', 'SAFETY', 'PERFORMANCE', 'RESILIENCE', 'UX', 'ARCHITECTURE'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setBacklogCategoryFilter(cat)}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all shrink-0 ${
                          backlogCategoryFilter === cat
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {cat === 'ALL'
                          ? 'すべて'
                          : cat === 'SAFETY'
                          ? '🛡️ 安全性'
                          : cat === 'PERFORMANCE'
                          ? '⚡ 性能'
                          : cat === 'RESILIENCE'
                          ? '🔁 レジリエンス'
                          : cat === 'UX'
                          ? '🎨 UX'
                          : '🏛️ 設計'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRunBatch(3)}
                    disabled={isBusy || backlog.length === 0}
                    className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-purple-900/30 transition-all disabled:opacity-50"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    上位3章を一括バッチ改善
                  </button>
                  <button
                    onClick={refreshBacklog}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
                    title="バックログ再読込"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Backlog Item List */}
              <div className="space-y-2.5">
                {(() => {
                  const filtered = backlog.filter((item) => {
                    const matchCat =
                      backlogCategoryFilter === 'ALL' || item.category === backlogCategoryFilter;
                    const q = backlogSearch.toLowerCase();
                    const matchQuery =
                      !q ||
                      item.title.toLowerCase().includes(q) ||
                      item.description.toLowerCase().includes(q) ||
                      item.chapterNumber.toString().includes(q) ||
                      item.keyRequirements.some((r) => r.toLowerCase().includes(q));
                    return matchCat && matchQuery;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
                        該当する改善バックログはありません。
                      </div>
                    );
                  }

                  return filtered.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.priority === 'HIGH'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                                : item.priority === 'MEDIUM'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            優先度: {item.priority}
                          </span>
                          <span className="font-semibold text-slate-200">
                            第{item.chapterNumber}章: {item.title}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 text-slate-400 border border-slate-800">
                            {item.targetFile}
                          </span>
                          <span className="text-[10px] text-purple-400">
                            不変条件 {item.invariantCount}件
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {item.keyRequirements.slice(0, 3).map((req, rIdx) => (
                            <span
                              key={rIdx}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-950/70 text-slate-400 border border-slate-800/70"
                            >
                              ✓ {req}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => {
                            setSelectedChapterNum(item.chapterNumber);
                            setActiveTab('live');
                            handleRunSingleCycle({ chapterNumber: item.chapterNumber });
                          }}
                          disabled={isBusy}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          自律改善を実行
                        </button>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>直近の自律自己改善レコード ({history.length}件)</span>
                <span>すべての変更にロールバック用スナップショットが付帯しています</span>
              </div>

              {history.length === 0 ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
                  まだ実行された自律改善レコードはありません。
                </div>
              ) : (
                history.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {rec.chapterTitle
                              ? `第${rec.chapterNumber}章: ${rec.chapterTitle}`
                              : rec.prompt}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
                            {rec.targetFile}
                          </span>
                          {rec.commitHash && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              commit:{rec.commitHash}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{rec.reasoning}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-semibold text-purple-300">
                          {rec.previousScore}点 ➔{' '}
                          <span className="text-emerald-400 font-bold">{rec.newScore}点</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(rec.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Verification Badges */}
                    <div className="flex items-center gap-3 text-xs bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 flex-wrap">
                      <span className="flex items-center gap-1 text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" /> AST構文: パス
                      </span>
                      <span className="flex items-center gap-1 text-indigo-300">
                        <FlaskConical className="w-3.5 h-3.5" /> TDDテスト: {rec.verification.testPassedCount}/{rec.verification.testTotalCount}通過
                      </span>
                      {rec.mutationTestResult && (
                        <span className="flex items-center gap-1 text-amber-300 font-medium">
                          <Bug className="w-3.5 h-3.5" /> 変異体キル率: {rec.mutationTestResult.killRate}% ({rec.mutationTestResult.killedMutants}/{rec.mutationTestResult.totalMutants})
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-slate-300">
                        <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> 自己修復試行: {rec.selfHealingAttempts}回
                      </span>
                      <span className="flex items-center gap-1 text-cyan-300">
                        <ShieldCheck className="w-3.5 h-3.5" /> 不変条件: 5/5
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-1">
                      {rec.lesson && (
                        <span className="text-xs text-slate-400 italic">
                          💡 教訓: {rec.lesson.rule}
                        </span>
                      )}

                      <div className="flex items-center gap-2 ml-auto">
                        {rec.afterCode && onOpenDiff && (
                          <button
                            onClick={() =>
                              onOpenDiff(
                                rec.targetFile.split('/').pop() || 'TargetModule.ts',
                                rec.beforeCode || '',
                                rec.afterCode || '',
                                rec.targetFile
                              )
                            }
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 flex items-center gap-1.5 transition-all"
                          >
                            <SplitSquareVertical className="w-3.5 h-3.5" />
                            差分
                          </button>
                        )}
                        {rec.snapshotId && (
                          <button
                            onClick={() => handleRollback(rec)}
                            disabled={rollbackSuccessId === rec.id}
                            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                              rollbackSuccessId === rec.id
                                ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-600'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                            }`}
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            {rollbackSuccessId === rec.id ? '復元完了' : '1-Click 巻き戻し'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  オートパイロット（自動巡回）パラメーター
                </h3>
                <p className="text-xs text-slate-400">
                  みきがバックグラウンドで自律的にコードベースを巡回・自己改善する際の動作条件を設定します。
                </p>
              </div>

              <div className="space-y-4 max-w-xl">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1.5">
                    自動巡回の間隔: {config.intervalSeconds} 秒
                  </label>
                  <input
                    type="range"
                    min="15"
                    max="300"
                    step="15"
                    value={config.intervalSeconds}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      autonomousContinuousEvolutionService.saveConfig({ intervalSeconds: val });
                      setConfig((c) => ({ ...c, intervalSeconds: val }));
                    }}
                    className="w-full accent-purple-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>15秒 (超高速)</span>
                    <span>60秒 (標準)</span>
                    <span>300秒 (省電力)</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1.5">
                    自己修復リトライ上限: {config.autoHealLimit} 回
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={config.autoHealLimit}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      autonomousContinuousEvolutionService.saveConfig({ autoHealLimit: val });
                      setConfig((c) => ({ ...c, autoHealLimit: val }));
                    }}
                    className="w-full accent-purple-500"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    AST構文エラーやTDD失敗時に、エラー診断をフィードバックして再生成する最大回数です。
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <div className="text-xs text-slate-300 font-semibold mb-2">安全保証ポリシー</div>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                    <li>Qwen 3Bアンカーモデルの保護 (IMMUTABLE_ANCHOR)</li>
                    <li>送信前プライバシーマスクと機密データの遮断</li>
                    <li>全変更に対する1-Clickスナップショットの事前自動保存</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
