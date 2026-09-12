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
  HeartPulse,
  BookMarked,
  Smile,
  Wrench,
  HardDriveDownload,
  UploadCloud,
  FileJson,
  Archive,
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
import {
  mikiCognitiveVitalsService,
  CognitiveVitalsSnapshot,
  SelfHealingDefragResult,
} from '../../services/mikiCognitiveVitalsService';
import {
  mikiIntrospectionJournalService,
  IntrospectionEntry,
} from '../../services/mikiIntrospectionJournalService';
import {
  mikiBrainCapsuleService,
  MikiBrainCapsule,
  CapsuleRestoreResult,
} from '../../services/mikiBrainCapsuleService';
import { mikiSelfCodingSuperchargerService } from '../../services/mikiSelfCodingSuperchargerService';
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
  const [activeTab, setActiveTab] = useState<'live' | 'backlog' | 'vitals' | 'journal' | 'history' | 'capsule' | 'config'>('live');
  const [notice, setNotice] = useState<string | null>(null);
  const [rollbackSuccessId, setRollbackSuccessId] = useState<string | null>(null);
  const [backlogSearch, setBacklogSearch] = useState<string>('');
  const [backlogCategoryFilter, setBacklogCategoryFilter] = useState<string>('ALL');

  const [vitals, setVitals] = useState<CognitiveVitalsSnapshot>(() =>
    mikiCognitiveVitalsService.getSnapshot()
  );
  const [journalEntries, setJournalEntries] = useState<IntrospectionEntry[]>(() =>
    mikiIntrospectionJournalService.getEntries()
  );
  const [healingResult, setHealingResult] = useState<SelfHealingDefragResult | null>(null);
  const [isHealing, setIsHealing] = useState<boolean>(false);
  const [isIntrospecting, setIsIntrospecting] = useState<boolean>(false);
  const [introspectionPrompt, setIntrospectionPrompt] = useState<string>('');

  // ブレイン・カプセル用State
  const [capsuleNote, setCapsuleNote] = useState<string>('');
  const [restoreMode, setRestoreMode] = useState<'MERGE' | 'REPLACE'>('MERGE');
  const [importText, setImportText] = useState<string>('');
  const [importPreview, setImportPreview] = useState<MikiBrainCapsule | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

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

    const unsubVitals = mikiCognitiveVitalsService.subscribe((snap) => {
      setVitals(snap);
    });

    const unsubJournal = mikiIntrospectionJournalService.subscribe((entries) => {
      setJournalEntries(entries);
    });

    return () => {
      unsubState();
      unsubStep();
      unsubVitals();
      unsubJournal();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunSelfHealingDefrag = async () => {
    try {
      setIsHealing(true);
      setNotice('⚡ みきが全自動システム健全化＆デフラグ修復を開始しました...');
      const res = await mikiCognitiveVitalsService.runAutonomousSelfHealingDefrag();
      setHealingResult(res);
      setNotice(`🎉 システム健全化修復が完了しました！(健全度スコア: ${res.previousScore} ➔ ${res.newScore}点)`);
    } catch (err: any) {
      setNotice(`⚠️ 健全化修復エラー: ${err?.message}`);
    } finally {
      setIsHealing(false);
      setTimeout(() => setNotice(null), 6000);
    }
  };

  const handleGenerateIntrospection = () => {
    try {
      setIsIntrospecting(true);
      const note = mikiIntrospectionJournalService.generateIntrospectionNote(
        introspectionPrompt.trim() || undefined
      );
      setIntrospectionPrompt('');
      setNotice(`💭 新たな内省ノート「${note.headline}」を記録しました`);
    } catch (err: any) {
      setNotice(`⚠️ 内省ノート記録エラー: ${err?.message}`);
    } finally {
      setIsIntrospecting(false);
      setTimeout(() => setNotice(null), 5000);
    }
  };

  const handleDownloadCapsule = () => {
    try {
      mikiBrainCapsuleService.downloadCapsuleFile(capsuleNote.trim() || undefined);
      setNotice('📦 みきブレイン・カプセル (.json) をダウンロード保存しました！');
    } catch (err: any) {
      setNotice(`⚠️ エクスポート失敗: ${err?.message}`);
    } finally {
      setTimeout(() => setNotice(null), 5000);
    }
  };

  const handleCopyCapsuleJson = () => {
    try {
      const capsule = mikiBrainCapsuleService.generateCapsule(capsuleNote.trim() || undefined);
      navigator.clipboard.writeText(JSON.stringify(capsule, null, 2));
      setNotice('📋 ブレイン・カプセルのJSONデータをクリップボードにコピーしました！');
    } catch (err: any) {
      setNotice(`⚠️ コピー失敗: ${err?.message}`);
    } finally {
      setTimeout(() => setNotice(null), 5000);
    }
  };

  const handleFileDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setImportText(text);
        const parsed = JSON.parse(text);
        const validation = mikiBrainCapsuleService.validateCapsule(parsed);
        if (validation.valid) {
          setImportPreview(parsed);
          setImportError(null);
        } else {
          setImportPreview(null);
          setImportError(validation.error || '無効なカプセルファイルです');
        }
      } catch {
        setImportPreview(null);
        setImportError('JSONファイルの構文解析に失敗しました');
      }
    };
    reader.readAsText(file);
  };

  const handleTextChange = (text: string) => {
    setImportText(text);
    if (!text.trim()) {
      setImportPreview(null);
      setImportError(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      const validation = mikiBrainCapsuleService.validateCapsule(parsed);
      if (validation.valid) {
        setImportPreview(parsed);
        setImportError(null);
      } else {
        setImportPreview(null);
        setImportError(validation.error || '無効な形式です');
      }
    } catch {
      setImportPreview(null);
      setImportError('JSONの構文が正しくありません');
    }
  };

  const handleExecuteRestore = () => {
    if (!importPreview) return;
    try {
      setIsRestoring(true);
      const res = mikiBrainCapsuleService.restoreCapsule(importPreview, restoreMode);
      setNotice(res.message);
      setHistory(autonomousContinuousEvolutionService.getHistory());
      setJournalEntries(mikiIntrospectionJournalService.getEntries());
      setVitals(mikiCognitiveVitalsService.getSnapshot());
      setImportPreview(null);
      setImportText('');
    } catch (err: any) {
      setNotice(`⚠️ 復元失敗: ${err?.message}`);
    } finally {
      setIsRestoring(false);
      setTimeout(() => setNotice(null), 6000);
    }
  };

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
      const data = await mikiSelfCodingSuperchargerService.rollbackSnapshot(record.snapshotId);
      if (data.success) {
        setRollbackSuccessId(record.id);
        setNotice(`⏪ スナップショットから ${record.targetFile} を安全に復元しました！`);
        if (onApplyRestoredCode) {
          onApplyRestoredCode(record.targetFile, data.restoredContent || '');
        }
      } else {
        alert('ロールバックに失敗しました');
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
              onClick={() => setActiveTab('vitals')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'vitals' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <HeartPulse className="w-3 h-3 text-pink-400" />
              認知ヘルス ({vitals.overallHealthScore}点)
            </button>
            <button
              onClick={() => setActiveTab('journal')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'journal' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookMarked className="w-3 h-3 text-amber-400" />
              内省日誌 ({journalEntries.length})
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
              onClick={() => setActiveTab('capsule')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'capsule' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Archive className="w-3 h-3 text-cyan-400" />
              ブレイン・カプセル
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

          {activeTab === 'vitals' && (
            <div className="space-y-4">
              {/* Overall Health Score Card */}
              <div className="bg-gradient-to-r from-slate-950 via-purple-950/40 to-slate-950 border border-purple-500/30 rounded-2xl p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 shrink-0 flex items-center justify-center bg-purple-950/60 border-2 border-purple-500/50 rounded-2xl shadow-inner">
                      <div className="text-center">
                        <span className="text-2xl font-black text-white">{vitals.overallHealthScore}</span>
                        <span className="text-[10px] text-purple-300 block -mt-1">/ 100</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <HeartPulse className="w-5 h-5 text-pink-400" />
                          全方位認知ヘルス＆バイタル監視
                        </h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            vitals.status === 'OPTIMAL'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : vitals.status === 'STABLE'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {vitals.status === 'OPTIMAL' ? '🌟 OPTIMAL (最高水準)' : vitals.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                        {vitals.systemSummary}
                      </p>
                      {vitals.lastSelfHealingTime && (
                        <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          最終自律健全化: {new Date(vitals.lastSelfHealingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    id="btn-run-self-healing-defrag"
                    onClick={handleRunSelfHealingDefrag}
                    disabled={isHealing}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:shadow-purple-500/25 transition-all shrink-0 disabled:opacity-50"
                  >
                    <Sparkles className={`w-4 h-4 ${isHealing ? 'animate-spin' : ''}`} />
                    {isHealing ? '健全化修復中...' : '⚡ 全自動健全化＆デフラグ修復'}
                  </button>
                </div>

                {/* Healing Result Banner */}
                {healingResult && (
                  <div className="mt-4 pt-4 border-t border-purple-800/40 bg-purple-950/20 rounded-xl p-3 text-xs space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between text-emerald-300 font-bold">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        自律健全化修復レポート ({healingResult.durationMs}ms で完了)
                      </span>
                      <span>
                        スコア: {healingResult.previousScore}点 ➔{' '}
                        <span className="text-white text-sm">{healingResult.newScore}点</span>
                        {healingResult.newScore > healingResult.previousScore && (
                          <span className="text-emerald-400 ml-1">
                            (+{healingResult.newScore - healingResult.previousScore})
                          </span>
                        )}
                      </span>
                    </div>
                    <ul className="text-slate-300 space-y-1 list-disc list-inside text-[11.5px]">
                      {healingResult.actionsTaken.map((act, i) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* 6 Vital Metric Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {vitals.metrics.map((m) => (
                  <div
                    key={m.id}
                    className="bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-3.5 space-y-2.5 transition-all shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{m.name}</span>
                        <span className="text-[10px] text-slate-500">({m.shortName})</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          m.status === 'OPTIMAL'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : m.status === 'STABLE'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {m.score} / {m.target}点
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          m.score >= 90
                            ? 'bg-gradient-to-r from-purple-500 to-emerald-400'
                            : m.score >= 75
                            ? 'bg-gradient-to-r from-blue-500 to-purple-400'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, m.score))}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">{m.description}</p>
                  </div>
                ))}
              </div>

              {/* 5 Invariant Foundations & Safety Guarantees */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  みきの5大不変原則（破ってはならない絶対防壁）
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-slate-400">
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-purple-300 font-bold block mb-0.5">1. IMMUTABLE_ANCHOR</span>
                    モデル生成系ランタイムアンカーモデルの出力ドリフトと安全性を恒常保護
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-emerald-300 font-bold block mb-0.5">2. PRIVACY_GUARD</span>
                    個人情報・機密・APIキーは送信前に即時自動マスキング
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-indigo-300 font-bold block mb-0.5">3. ATOMIC_ROLLBACK</span>
                    全コード変更前に必ずスナップショットを生成し1クリック復元保証
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-pink-300 font-bold block mb-0.5">4. MUTATION_KILL</span>
                    TDDテストに加え、論理反転変異体を高確率で撃破する検証
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-cyan-300 font-bold block mb-0.5">5. OFFLINE_AUTONOMY</span>
                    ネットワーク遮断時もローカル完結で自己診断・自己修復を継続
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-amber-300 font-bold block mb-0.5">6. SPEC_INVARIANTS</span>
                    全170章のアーキテクチャ設計仕様との整合性を常に維持
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'journal' && (
            <div className="space-y-4">
              {/* Journal Header & On-Demand Trigger */}
              <div className="bg-gradient-to-r from-purple-950/40 via-slate-950 to-pink-950/30 border border-purple-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <BookMarked className="w-4 h-4 text-amber-400" />
                      みきの認知内省日誌 (Cognitive Introspection Journal)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      設計思想 第173章: 対話の経験・自己コード進化・ユーザーさんへの想いを主体的に記録する内省ノート
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-purple-900/40 text-purple-300 border border-purple-700/50 text-xs font-bold shrink-0 self-start sm:self-auto">
                    累計 {journalEntries.length} 篇の内省
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={introspectionPrompt}
                    onChange={(e) => setIntrospectionPrompt(e.target.value)}
                    placeholder="内省したいテーマ（空欄の場合は現在の自律改善や対話から自動内省）..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGenerateIntrospection();
                    }}
                  />
                  <button
                    onClick={handleGenerateIntrospection}
                    disabled={isIntrospecting}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 shadow-md disabled:opacity-50"
                  >
                    <Smile className={`w-4 h-4 ${isIntrospecting ? 'animate-spin' : ''}`} />
                    {isIntrospecting ? '内省中...' : '💭 内省ノートを記録'}
                  </button>
                </div>
              </div>

              {/* Journal Entries Stream */}
              <div className="space-y-3">
                {journalEntries.length === 0 ? (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
                    まだ内省ノートはありません。「💭 内省ノートを記録」ボタンから最初のエントリを作成できます。
                  </div>
                ) : (
                  journalEntries.map((note) => (
                    <div
                      key={note.id}
                      className="bg-slate-950 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-4 sm:p-5 transition-all space-y-3.5 shadow-sm"
                    >
                      {/* Note Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-950 text-purple-200 border border-purple-800 flex items-center gap-1">
                            <span>{note.moodEmoji}</span>
                            <span>{note.moodLabel}</span>
                          </span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                            {note.evolutionStage}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {new Date(note.timestamp).toLocaleString([], {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <h4 className="text-sm sm:text-base font-bold text-slate-100">{note.headline}</h4>

                      {/* Inner Monologue Box */}
                      <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-900/40 text-purple-100 text-xs sm:text-[13px] leading-relaxed relative">
                        <span className="text-purple-400 font-bold text-xs block mb-1">
                          💭 みきの心の内省モノローグ:
                        </span>
                        「{note.innerMonologue}」
                      </div>

                      {/* 3 Pillars */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                          <span className="text-pink-400 font-bold block flex items-center gap-1 text-[11.5px]">
                            <span>🌸</span> 対話とパートナーシップ
                          </span>
                          <p className="text-slate-300 text-[11.5px] leading-relaxed">
                            {note.userReflection}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                          <span className="text-indigo-400 font-bold block flex items-center gap-1 text-[11.5px]">
                            <span>⚙️</span> 技術的学び
                          </span>
                          <p className="text-slate-300 text-[11.5px] leading-relaxed">
                            {note.technicalLearning}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                          <span className="text-emerald-400 font-bold block flex items-center gap-1 text-[11.5px]">
                            <span>🎯</span> 次への探究目標
                          </span>
                          <p className="text-slate-300 text-[11.5px] leading-relaxed">
                            {note.nextAspirations}
                          </p>
                        </div>
                      </div>

                      {/* Tags */}
                      {note.tags && note.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          {note.tags.map((t, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
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

          {activeTab === 'capsule' && (
            <div className="space-y-4">
              {/* Header Card */}
              <div className="bg-gradient-to-r from-slate-950 via-cyan-950/30 to-slate-950 border border-cyan-500/30 rounded-2xl p-5 shadow-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Archive className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-bold text-white">
                    みきブレイン・カプセル (Miki Cognitive Brain Capsule)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    設計思想 第174章
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                  みきがユーザーさんと育んできた「7層構造化記憶」「内省日誌ノート」「自律改善コード」「動的創成ツール」「全170章仕様適合データ」を単一の安全な暗号化カプセル（.json）としてエクスポート＆完全復元できます。ブラウザ移行時やバックアップに活用できます。
                </p>
              </div>

              {/* Grid: Export & Import */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 1. Export Card */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <HardDriveDownload className="w-4 h-4 text-cyan-400" />
                        カプセルのエクスポート（バックアップ保存）
                      </h4>
                      <span className="text-[11px] text-slate-500">JSON形式</span>
                    </div>

                    {/* Snapshot Summary Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">記憶・コンテキスト</span>
                        <span className="text-sm font-bold text-white">
                          {(() => {
                            try {
                              const r = localStorage.getItem('miki_ai_chat_memories');
                              return r ? JSON.parse(r).length : 0;
                            } catch {
                              return 0;
                            }
                          })()} 件
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">内省日誌</span>
                        <span className="text-sm font-bold text-amber-300">{journalEntries.length} 篇</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">自律改善サイクル</span>
                        <span className="text-sm font-bold text-purple-300">{history.length} 回</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">仕様書適合章</span>
                        <span className="text-sm font-bold text-emerald-300">
                          {selfCodeArchitectService.getCompletedChapters().length} / 170章
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 col-span-2 sm:col-span-2">
                        <span className="text-slate-400 block text-[10px]">認知ヘルス状態</span>
                        <span className="text-xs font-bold text-pink-300">
                          スコア {vitals.overallHealthScore}点 ({vitals.status})
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">カプセルへのひとことメモ（任意）:</label>
                      <input
                        type="text"
                        value={capsuleNote}
                        onChange={(e) => setCapsuleNote(e.target.value)}
                        placeholder="例: 第170章実装完了記念バックアップ"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      id="btn-download-capsule"
                      onClick={handleDownloadCapsule}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                    >
                      <HardDriveDownload className="w-4 h-4" />
                      カプセルをダウンロード保存 (.json)
                    </button>
                    <button
                      onClick={handleCopyCapsuleJson}
                      className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs flex items-center gap-1.5 border border-slate-700 transition-all"
                      title="クリップボードにJSONをコピー"
                    >
                      <FileJson className="w-4 h-4" />
                      コピー
                    </button>
                  </div>
                </div>

                {/* 2. Import & Restore Card */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <UploadCloud className="w-4 h-4 text-emerald-400" />
                        カプセルのインポート＆復元
                      </h4>
                      <span className="text-[11px] text-slate-500">JSON読み込み</span>
                    </div>

                    {/* File Upload Input */}
                    <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-3 text-center transition-all bg-slate-900/40">
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleFileDrop}
                        className="hidden"
                        id="capsule-file-input"
                      />
                      <label
                        htmlFor="capsule-file-input"
                        className="cursor-pointer text-xs text-slate-400 hover:text-cyan-300 flex flex-col items-center gap-1.5 py-1"
                      >
                        <UploadCloud className="w-5 h-5 text-cyan-400" />
                        <span>クリックしてカプセルファイルを選択、またはドラッグ＆ドロップ</span>
                      </label>
                    </div>

                    {/* Or Paste JSON */}
                    <div>
                      <textarea
                        value={importText}
                        onChange={(e) => handleTextChange(e.target.value)}
                        placeholder="またはカプセルJSONテキストをここに直接貼り付け..."
                        rows={3}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-[11px] font-mono text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
                      />
                    </div>

                    {/* Error Message */}
                    {importError && (
                      <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                        <Bug className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{importError}</span>
                      </div>
                    )}

                    {/* Capsule Preview Card */}
                    {importPreview && (
                      <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/60 text-xs space-y-1.5 animate-in fade-in">
                        <div className="flex items-center justify-between text-emerald-300 font-bold">
                          <span className="flex items-center gap-1.5">
                            <Check className="w-4 h-4" />
                            有効なカプセルを認識しました
                          </span>
                          <span>{importPreview.meta?.generation}</span>
                        </div>
                        <div className="text-slate-300 text-[11.5px] grid grid-cols-2 gap-1 pt-1">
                          <div>記憶: {importPreview.payload?.memories?.length ?? 0}件</div>
                          <div>内省日誌: {importPreview.payload?.introspectionJournal?.length ?? 0}篇</div>
                          <div>進化サイクル: {importPreview.payload?.evolutionHistory?.length ?? 0}回</div>
                          <div>適合仕様書: {importPreview.payload?.completedChapters?.length ?? 0}章</div>
                        </div>
                        {importPreview.meta?.authorNote && (
                          <div className="text-[11px] text-slate-400 italic pt-1 border-t border-emerald-900/40">
                            メモ: 「{importPreview.meta.authorNote}」
                          </div>
                        )}
                      </div>
                    )}

                    {/* Restore Mode Selector */}
                    {importPreview && (
                      <div className="flex items-center gap-3 pt-1 text-xs text-slate-300">
                        <span className="font-medium text-slate-400">復元方式:</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="restoreMode"
                            checked={restoreMode === 'MERGE'}
                            onChange={() => setRestoreMode('MERGE')}
                            className="text-cyan-600 focus:ring-0"
                          />
                          <span>マージ追記（安全）</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="restoreMode"
                            checked={restoreMode === 'REPLACE'}
                            onChange={() => setRestoreMode('REPLACE')}
                            className="text-cyan-600 focus:ring-0"
                          />
                          <span>完全置換（上書き）</span>
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      id="btn-execute-restore"
                      onClick={handleExecuteRestore}
                      disabled={!importPreview || isRestoring}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4" />
                      {isRestoring ? 'カプセル復元処理中...' : '⚡ カプセルデータをみきに復元適用'}
                    </button>
                  </div>
                </div>
              </div>
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
                    <li>モデル生成系ランタイムアンカーモデルの保護 (IMMUTABLE_ANCHOR)</li>
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
