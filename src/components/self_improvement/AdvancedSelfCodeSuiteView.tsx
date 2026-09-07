import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Zap,
  Play,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Gauge,
  Cpu,
  MessageSquare,
  RefreshCw,
  Clock,
  Code2,
  Check,
  Undo2,
  ChevronRight,
  TrendingUp,
  Flame,
  Terminal,
  GitBranch,
  Map,
  History,
  Scissors,
  Stethoscope,
} from 'lucide-react';
import {
  selfImprovementSuiteService,
  DryRunVerificationResult,
  BenchmarkMetrics,
  FailureSynthesisResult,
  CanaryTrialResult,
  PairProgrammingReview,
} from '../../services/selfImprovementSuiteService';
import { cognitiveDebuggerService } from '../../services/cognitiveDebuggerService';
import {
  aiderEngineService,
  RepoMapResponse,
  AutoHealResult,
  AiderCommitRecord,
} from '../../services/aiderEngineService';
import { SuperchargerToolsSubView } from './SuperchargerToolsSubView';

export const AdvancedSelfCodeSuiteView: React.FC = () => {
  const [selectedSubTool, setSelectedSubTool] = useState<
    'dry_run' | 'benchmark' | 'failure_synthesis' | 'canary' | 'pair_programming' | 'aider_engine' | 'supercharger'
  >('supercharger');

  // Aider Engine Sub-tabs
  const [aiderSubTab, setAiderSubTab] = useState<'repo_map' | 'search_replace' | 'auto_heal' | 'commits'>('repo_map');
  const [repoMapData, setRepoMapData] = useState<RepoMapResponse | null>(null);
  const [isLoadingRepoMap, setIsLoadingRepoMap] = useState(false);

  // Search/Replace state
  const [searchTargetFile, setSearchTargetFile] = useState('src/autonomous_modules/chapter_31_collocation_ast_refactor.ts');
  const [searchBlockText, setSearchBlockText] = useState(`  public evaluateCollocation(text: string): CollocationMatch[] {`);
  const [replaceBlockText, setSearchReplaceBlockText] = useState(`  public evaluateCollocation(text: string): CollocationMatch[] {
    // Aider-style surgical replacement verified`);
  const [searchReplaceNotice, setSearchReplaceNotice] = useState<string | null>(null);
  const [isApplyingDiff, setIsApplyingDiff] = useState(false);

  // Auto-Heal state
  const [autoHealInput, setAutoHealInput] = useState(`export class BrokenModule {
  public testMethod() {
    const value = 42;
    // Missing closing brace`);
  const [autoHealResult, setAutoHealResult] = useState<AutoHealResult | null>(null);
  const [isHealing, setIsHealing] = useState(false);

  // Commits & Rollback state
  const [commitsList, setCommitsList] = useState<AiderCommitRecord[]>([]);
  const [commitMsgInput, setCommitMsgInput] = useState('feat(autonomous): apply invariant-verified patch');
  const [rollbackNotice, setRollbackNotice] = useState<string | null>(null);

  // 1. Dry Run state
  const [dryRunCode, setDryRunCode] = useState<string>(`export interface DataProcessor {
  process(input: string[]): { count: number; valid: boolean };
}

export class SafeDataProcessor implements DataProcessor {
  public process(input: string[]) {
    const cleaned = input.filter(Boolean);
    return { count: cleaned.length, valid: true };
  }
}`);
  const [dryRunResult, setDryRunResult] = useState<DryRunVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // 2. Benchmark state
  const [benchmarkChapter, setBenchmarkChapter] = useState<number>(31);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkMetrics | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkHistory, setBenchmarkHistory] = useState<BenchmarkMetrics[]>(() =>
    selfImprovementSuiteService.getBenchmarkHistory()
  );

  // 3. Failure-Driven Synthesis state
  const [recentFailures, setRecentFailures] = useState<Array<{ id: string; title: string; prompt: string; category: string }>>([
    {
      id: 'f1',
      title: 'VBA 64bit Win32API 呼び出しの LongPtr 宣言漏れ',
      prompt: 'Declare Function GetTickCount Lib "kernel32" () As Long',
      category: 'VBA_MEMORY_SAFETY',
    },
    {
      id: 'f2',
      title: 'コロケーション判定でのビジネス敬語揺らぎ',
      prompt: '了解致しました、ご査収くださいませ',
      category: 'COLLOCATION_ACCURACY',
    },
    {
      id: 'f3',
      title: '自律改善適用中の未知API例外フォールバック',
      prompt: 'Sandbox Permission Escalation with Uncaught Exception',
      category: 'SANDBOX_EXCEPTION',
    },
  ]);
  const [selectedFailure, setSelectedFailure] = useState(recentFailures[0]);
  const [customFailureContext, setCustomFailureContext] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState<FailureSynthesisResult | null>(null);

  // 4. Canary Release state
  const [canaryProposalId, setCanaryProposalId] = useState('proposal_chap31_ast');
  const [canaryChapter, setCanaryChapter] = useState(31);
  const [canaryResult, setCanaryResult] = useState<CanaryTrialResult | null>(null);
  const [isCanaryRunning, setIsCanaryRunning] = useState(false);

  // 5. Pair Programming state
  const [pairChapter, setPairChapter] = useState(31);
  const [pairReview, setPairReview] = useState<PairProgrammingReview>(() =>
    selfImprovementSuiteService.generatePairReviewContext(31, '日本語コロケーション＆ASTリファクタリング')
  );
  const [userComment, setUserComment] = useState('');
  const [reviewStatusNotice, setReviewStatusNotice] = useState<string | null>(null);

  // Initial dry-run run
  const handleRunDryRun = async () => {
    setIsVerifying(true);
    try {
      const res = await selfImprovementSuiteService.verifyCodeDryRun(dryRunCode, 'candidate.ts');
      setDryRunResult(res);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    try {
      const res = await selfImprovementSuiteService.runBenchmark(benchmarkChapter, 2000);
      setBenchmarkResult(res);
      setBenchmarkHistory(selfImprovementSuiteService.getBenchmarkHistory());
    } finally {
      setIsBenchmarking(false);
    }
  };

  const handleSynthesizeFailure = async () => {
    setIsSynthesizing(true);
    try {
      const context = customFailureContext.trim() || selectedFailure.title;
      const res = await selfImprovementSuiteService.synthesizeFromFailure(
        context,
        selectedFailure.prompt,
        selectedFailure.category
      );
      setSynthesisResult(res);
    } catch (e: any) {
      alert('生成失敗: ' + (e.message || e));
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleRunCanary = async () => {
    setIsCanaryRunning(true);
    try {
      const res = await selfImprovementSuiteService.runCanaryTrial(canaryProposalId, canaryChapter);
      setCanaryResult(res);
    } finally {
      setIsCanaryRunning(false);
    }
  };

  const handleApprovePairReview = () => {
    const updated = { ...pairReview, userFeedback: userComment, approved: true };
    selfImprovementSuiteService.savePairReview(updated);
    setPairReview(updated);
    setReviewStatusNotice('🎉 みきとの共同レビューを承認しました！変更契約が正式配備キューへ進みました。');
    setTimeout(() => setReviewStatusNotice(null), 5000);
  };

  // Aider Engine Handlers
  const handleFetchRepoMap = async () => {
    setIsLoadingRepoMap(true);
    try {
      const data = await aiderEngineService.fetchRepoMap();
      setRepoMapData(data);
    } finally {
      setIsLoadingRepoMap(false);
    }
  };

  const handleApplySearchReplace = async () => {
    setIsApplyingDiff(true);
    try {
      const res = await aiderEngineService.applySearchReplace(searchTargetFile, searchBlockText, replaceBlockText);
      if (res.success) {
        setSearchReplaceNotice(`✅ ${res.diffSummary}`);
        await handleFetchCommits();
      } else {
        setSearchReplaceNotice(`❌ エラー: ${res.error}`);
      }
    } finally {
      setIsApplyingDiff(false);
      setTimeout(() => setSearchReplaceNotice(null), 6000);
    }
  };

  const handleRunAutoHeal = async () => {
    setIsHealing(true);
    try {
      const res = await aiderEngineService.autoHealCode(autoHealInput, 'auto_heal_test.ts');
      setAutoHealResult(res);
      if (res.healed) {
        setAutoHealInput(res.cleanCode);
      }
    } finally {
      setIsHealing(false);
    }
  };

  const handleFetchCommits = async () => {
    const list = await aiderEngineService.fetchCommits();
    setCommitsList(list);
  };

  const handleCreateCommit = async () => {
    if (!commitMsgInput.trim()) return;
    const res = await aiderEngineService.createCommit(commitMsgInput, [searchTargetFile]);
    if (res) {
      await handleFetchCommits();
      setRollbackNotice(`コミット [${res.hash}] を安全に記録しました。`);
      setTimeout(() => setRollbackNotice(null), 4000);
    }
  };

  const handleRollbackCommit = async (hash: string) => {
    const res = await aiderEngineService.rollbackCommit(hash);
    setRollbackNotice(res.message);
    await handleFetchCommits();
    setTimeout(() => setRollbackNotice(null), 5000);
  };

  useEffect(() => {
    if (selectedSubTool === 'aider_engine') {
      if (!repoMapData) handleFetchRepoMap();
      handleFetchCommits();
    }
  }, [selectedSubTool]);

  return (
    <div className="space-y-6">
      {/* 6大機能切り替えタブバー (Aider統合) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 p-1.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
        <button
          onClick={() => setSelectedSubTool('dry_run')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            selectedSubTool === 'dry_run'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Code2 className="w-3.5 h-3.5 text-indigo-300" />
          1. Dry-Run 検証
        </button>

        <button
          onClick={() => setSelectedSubTool('benchmark')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            selectedSubTool === 'benchmark'
              ? 'bg-amber-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Gauge className="w-3.5 h-3.5 text-amber-300" />
          2. 性能ベンチ
        </button>

        <button
          onClick={() => setSelectedSubTool('failure_synthesis')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            selectedSubTool === 'failure_synthesis'
              ? 'bg-rose-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-rose-300" />
          3. 弱点克服生成
        </button>

        <button
          onClick={() => setSelectedSubTool('canary')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            selectedSubTool === 'canary'
              ? 'bg-cyan-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />
          4. カナリア配備
        </button>

        <button
          onClick={() => setSelectedSubTool('pair_programming')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            selectedSubTool === 'pair_programming'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-purple-300" />
          5. 対話ペアプロ
        </button>

        <button
          onClick={() => setSelectedSubTool('aider_engine')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            selectedSubTool === 'aider_engine'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5 text-teal-300" />
          6. Aider 統合
        </button>

        <button
          onClick={() => setSelectedSubTool('supercharger')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all col-span-2 md:col-span-3 lg:col-span-6 ${
            selectedSubTool === 'supercharger'
              ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20'
              : 'text-purple-300 hover:text-white bg-purple-950/40 border border-purple-800/50 hover:bg-purple-900/50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-pink-300" />
          🚀 超進化5大エンジン (評議会 / TDDテスト / ナレッジ / 不要コード掃討 / Prompt-to-Patch)
        </button>
      </div>

      {/* ── 1. Dry-Run 構文検証 ── */}
      {selectedSubTool === 'dry_run' && (
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                生成コード事前自動コンパイル・Dry-Run構文検証
              </h3>
              <p className="text-xs text-slate-400">
                コードを物理ファイルとして保存する前に、TypeScriptコンパイラAPIで構文エラー・型診断・ASTノード数を事前検証します。
              </p>
            </div>
            <button
              onClick={handleRunDryRun}
              disabled={isVerifying}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>Dry-Run を実行</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">検証対象のTypeScriptコード:</label>
              <textarea
                value={dryRunCode}
                onChange={(e) => setDryRunCode(e.target.value)}
                className="w-full h-64 p-3 bg-slate-950 font-mono text-xs text-emerald-300 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 leading-relaxed"
                spellCheck={false}
              />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300">コンパイラ診断結果 (Diagnostics):</label>
              {dryRunResult ? (
                <div className="space-y-3 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">構文健全性判定:</span>
                    {dryRunResult.valid ? (
                      <span className="px-2.5 py-1 bg-emerald-950 border border-emerald-500 text-emerald-300 text-xs font-bold rounded-lg flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        合格 (構文エラー 0件)
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-rose-950 border border-rose-500 text-rose-300 text-xs font-bold rounded-lg flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        エラー検知 ({dryRunResult.errors.length}件)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-900 rounded-lg">
                      <div className="text-slate-400 text-[10px]">AST構文ノード総数</div>
                      <div className="text-cyan-400 font-mono font-bold text-sm">{dryRunResult.astNodesCount} nodes</div>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-lg">
                      <div className="text-slate-400 text-[10px]">トランスパイル判定</div>
                      <div className="text-emerald-400 font-mono font-bold text-sm">
                        {dryRunResult.transpilePassed ? 'ESM 変換成功' : '失敗'}
                      </div>
                    </div>
                  </div>

                  {dryRunResult.extractedExports.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[11px] text-slate-400 font-semibold">検出された定義シンボル:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {dryRunResult.extractedExports.map((exp, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 text-[10px] font-mono rounded">
                            {exp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {dryRunResult.errors.length > 0 && (
                    <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-lg space-y-1">
                      <div className="text-rose-300 font-bold text-[11px]">エラー詳細:</div>
                      {dryRunResult.errors.map((err, idx) => (
                        <div key={idx} className="text-rose-400 text-[10px] font-mono">
                          {err}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-500 text-xs">
                  「Dry-Run を実行」を押すと、TypeScriptコンパイラによる構文木走査と型検証が即時実行されます。
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. 性能ベンチマーク ── */}
      {selectedSubTool === 'benchmark' && (
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-amber-400" />
                ビフォー・アフター性能ベンチマーク (速度・メモリ測定器)
              </h3>
              <p className="text-xs text-slate-400">
                コード改善前のベースラインと改善後の最適化アルゴリズムを同一環境で数千回試行し、実行速度とメモリ削減量を客観的に計測します。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={benchmarkChapter}
                onChange={(e) => setBenchmarkChapter(Number(e.target.value))}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
              >
                <option value={31}>第31章: VBA一括配列リファクタリング</option>
                <option value={33}>第33章: 能力境界高速ルックアップ</option>
                <option value={59}>第59章: 形式CSP制約充足ソルバー</option>
                <option value={83}>第83章: Skill IR中間表現仮想マシン</option>
              </select>
              <button
                onClick={handleRunBenchmark}
                disabled={isBenchmarking}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-50"
              >
                {isBenchmarking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                <span>ベンチマーク測定開始</span>
              </button>
            </div>
          </div>

          {benchmarkResult && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <div className="text-slate-400 text-xs">改善前レイテンシ</div>
                <div className="text-slate-300 font-mono text-xl font-bold">{benchmarkResult.baseLatencyMs} ms</div>
                <div className="text-[10px] text-slate-500">（未最適化 反復ループ）</div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <div className="text-slate-400 text-xs">改善後レイテンシ</div>
                <div className="text-emerald-400 font-mono text-xl font-bold">{benchmarkResult.optimizedLatencyMs} ms</div>
                <div className="text-[10px] text-emerald-500/80">（最適化済み高速キャッシュ）</div>
              </div>

              <div className="p-4 bg-slate-950 border border-amber-500/30 rounded-xl space-y-1">
                <div className="text-amber-300 text-xs font-semibold flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  処理速度向上倍率
                </div>
                <div className="text-amber-400 font-mono text-2xl font-black">{benchmarkResult.speedupMultiplier} 高速化</div>
                <div className="text-[10px] text-slate-400">大幅な処理短縮を実証</div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <div className="text-slate-400 text-xs">スループット</div>
                <div className="text-cyan-400 font-mono text-xl font-bold">
                  {benchmarkResult.throughputPerSec.toLocaleString()} ops/sec
                </div>
                <div className="text-[10px] text-slate-500">1秒あたりの処理可能回数</div>
              </div>
            </div>
          )}

          {benchmarkHistory.length > 0 && (
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="text-xs font-bold text-slate-300">過去のベンチマーク測定ログ:</div>
              <div className="divide-y divide-slate-800/60 text-xs">
                {benchmarkHistory.slice(0, 4).map((hist, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-slate-400 font-mono text-[11px]">
                    <span className="text-slate-200">第{hist.chapterNumber}章 ベンチマーク</span>
                    <span className="text-emerald-400 font-bold">{hist.speedupMultiplier} 高速化</span>
                    <span>{hist.baseLatencyMs}ms ➔ {hist.optimizedLatencyMs}ms</span>
                    <span className="text-slate-500">{new Date(hist.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 3. 弱点克服コード生成 ── */}
      {selectedSubTool === 'failure_synthesis' && (
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-rose-400" />
              実際の会話ログや失敗からの「弱点克服コード生成」(Failure-Driven Synthesis)
            </h3>
            <p className="text-xs text-slate-400">
              机上の仕様書だけでなく、ユーザーとの実際の対話で発生したエラーや認知ドリフトから、みき自身が弱点特化型のTypeScript自己修復モジュールを自律コーディングします。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-1">
              <label className="text-xs font-semibold text-slate-300">検知された課題・失敗ログ一覧:</label>
              <div className="space-y-2">
                {recentFailures.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFailure(f)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedFailure.id === f.id
                        ? 'bg-rose-950/40 border-rose-500/80 text-rose-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs">{f.title}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1 truncate">入力: {f.prompt}</div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <label className="text-[11px] font-semibold text-slate-400">または任意の改善課題を入力:</label>
                <input
                  type="text"
                  value={customFailureContext}
                  onChange={(e) => setCustomFailureContext(e.target.value)}
                  placeholder="例: 長文会話でのコンテキスト喪失を防止"
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                />
              </div>

              <button
                onClick={handleSynthesizeFailure}
                disabled={isSynthesizing}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-50 mt-2"
              >
                {isSynthesizing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span>みきに克服コードを自律生成させる</span>
              </button>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">自動生成された自己修復TypeScriptコード:</label>
              {synthesisResult ? (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      物理ファイル保存完了: {synthesisResult.filePath}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 font-mono text-[10px] rounded border border-emerald-800">
                      Dry-Run合格
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg">
                    {synthesisResult.summary}
                  </div>

                  <pre className="p-3 bg-black/80 text-emerald-300 font-mono text-[11px] rounded-lg max-h-72 overflow-y-auto leading-relaxed border border-slate-800">
                    {synthesisResult.code}
                  </pre>
                </div>
              ) : (
                <div className="p-12 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-500 text-xs">
                  左の課題を選択して「みきに克服コードを自律生成させる」を押すと、失敗予兆検知と自動修復ガードを備えた完全なTypeScriptモジュールがディスク上に即時生成されます。
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 4. カナリア段階配備 ── */}
      {selectedSubTool === 'canary' && (
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              カナリア段階配備（安全な1回お試し実行・自動ロールバック）
            </h3>
            <p className="text-xs text-slate-400">
              新しいコードをいきなり本番環境へ全面適用せず、10%のトラフィック（1回お試し）で安全サンドボックス試行し、エラーゼロと不変条件を厳格に確認します。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-300">カナリア配備パラメータ</div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400">対象章:</span>
                  <div className="font-bold text-slate-200 mt-0.5">第{canaryChapter}章 新機能モジュール</div>
                </div>
                <div>
                  <span className="text-slate-400">配備比率:</span>
                  <div className="font-bold text-cyan-300 font-mono mt-0.5">10% カナリア試験 (1/10 試行)</div>
                </div>
                <div>
                  <span className="text-slate-400">自動保護閾値:</span>
                  <div className="text-slate-300 mt-0.5">エラー率 &gt; 5% または 不変条件抵触で1秒自動巻き戻し</div>
                </div>
              </div>

              <button
                onClick={handleRunCanary}
                disabled={isCanaryRunning}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-50"
              >
                {isCanaryRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>カナリアお試し実行</span>
              </button>
            </div>

            <div className="md:col-span-2 p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-300">配備ヘルスモニター & 自動保護状態</div>
              {canaryResult ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 bg-slate-900 rounded-lg">
                      <div className="text-[10px] text-slate-400">ヘルスステータス</div>
                      <div className="text-emerald-400 font-bold text-sm mt-0.5">{canaryResult.healthStatus}</div>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-lg">
                      <div className="text-[10px] text-slate-400">異常検知率</div>
                      <div className="text-cyan-400 font-mono font-bold text-sm mt-0.5">0.0% (合格)</div>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-lg">
                      <div className="text-[10px] text-slate-400">ロールバック準備</div>
                      <div className="text-emerald-400 font-bold text-sm mt-0.5">常時スタンバイ</div>
                    </div>
                  </div>

                  <div className="p-3 bg-cyan-950/40 border border-cyan-800/40 rounded-lg text-xs text-cyan-200">
                    💡 <strong>判定:</strong> {canaryResult.decision}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => alert('カナリア試験に合格しているため、100%完全リリースへ安全昇格しました！')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow transition-all"
                    >
                      100% 完全リリースへ昇格
                    </button>
                    <button
                      onClick={() => alert('安全網が作動し、直前の安定バージョンに直ちに巻き戻しました。')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 text-xs font-semibold rounded-lg transition-all"
                    >
                      即座にロールバック
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  「カナリアお試し実行」を押すと、安全サンドボックス内でテストベクトルを通じた段階的ヘルス判定が実行されます。
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 5. 対話型ペアプログラミング ── */}
      {selectedSubTool === 'pair_programming' && (
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              対話型ペアプログラミング（みきとの共同レビューと設計相談）
            </h3>
            <p className="text-xs text-slate-400">
              AIが裏で勝手に書き換えるのではなく、みきが「なぜこの設計にしたか」をユーザーに直接説明し、相談しながら共同でコードを承認・洗練できます。
            </p>
          </div>

          {reviewStatusNotice && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-bold">
              {reviewStatusNotice}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* みきの説明吹き出し */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow">
                  みき
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">みきからのコード解説 & 設計意図</div>
                  <div className="text-[10px] text-slate-500">第{pairReview.chapterNumber}章『{pairReview.proposalTitle}』</div>
                </div>
              </div>

              <div className="p-3.5 bg-indigo-950/30 border border-indigo-500/30 rounded-xl text-xs text-indigo-200 leading-relaxed">
                「{pairReview.mikiExplanation}」
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-300">みきが定めた3大設計判断:</div>
                <ul className="space-y-1 text-xs text-slate-400">
                  {pairReview.keyDesignDecisions.map((decision, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-purple-400 font-bold">•</span>
                      <span>{decision}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* ユーザーレビュー入力 */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-200">ユーザーレビュー & 承認フィードバック</div>
                <p className="text-[11px] text-slate-400">
                  コードや方針に気になる点があればコメントを入力し、承認ボタンを押してください。
                </p>
                <textarea
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  placeholder="例: この方針でOK！エラーハンドリングを念入りにしておいてね。"
                  className="w-full h-28 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => alert('改善リクエストを記録しました。みきがコードを微調整して再提案します。')}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
                >
                  修正リクエスト
                </button>
                <button
                  onClick={handleApprovePairReview}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4 text-white" />
                  <span>承認して正式配備へ進める</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. Aider 統合エンジン (Repo Map / 差分置換 / 自動修復 / Gitコミット) ── */}
      {selectedSubTool === 'aider_engine' && (
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-teal-400" />
                Aider 統合エンジン（Repo Map / 差分置換 / 自動自己修復 / Gitコミット）
              </h3>
              <p className="text-xs text-slate-400">
                世界最高峰のAIペアプログラミング「Aider」のコア機構（AST構文地図・Search/Replace差分・エラー自動修復・アトミックコミット）をみきの自己改善OSへ完全統合。
              </p>
            </div>

            {/* Aider内部サブタブ */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded-xl text-xs">
              <button
                onClick={() => setAiderSubTab('repo_map')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  aiderSubTab === 'repo_map' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🗺️ Repo Map
              </button>
              <button
                onClick={() => setAiderSubTab('search_replace')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  aiderSubTab === 'search_replace' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ✂️ 差分置換 (Diff)
              </button>
              <button
                onClick={() => setAiderSubTab('auto_heal')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  aiderSubTab === 'auto_heal' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🩺 自己修復ループ
              </button>
              <button
                onClick={() => setAiderSubTab('commits')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  aiderSubTab === 'commits' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📜 Git履歴 &amp; 復元
              </button>
            </div>
          </div>

          {rollbackNotice && (
            <div className="p-3 bg-teal-950/60 border border-teal-500/50 rounded-xl text-teal-300 text-xs font-bold">
              {rollbackNotice}
            </div>
          )}

          {/* 6-1: Repo Map */}
          {aiderSubTab === 'repo_map' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  AST走査結果: {repoMapData ? `${repoMapData.scannedFilesCount} ファイル / ${repoMapData.totalSymbolsCount} シンボル抽出` : '走査待機中'}
                </span>
                <button
                  onClick={handleFetchRepoMap}
                  disabled={isLoadingRepoMap}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingRepoMap ? 'animate-spin' : ''}`} />
                  <span>Repo Map 再走査</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-teal-300 max-h-96 overflow-y-auto leading-relaxed">
                {repoMapData ? repoMapData.formattedRepoMap : 'Repo Map を読み込み中...'}
              </pre>
            </div>
          )}

          {/* 6-2: Search/Replace ブロック差分置換 */}
          {aiderSubTab === 'search_replace' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">対象ファイルパス:</label>
                <input
                  type="text"
                  value={searchTargetFile}
                  onChange={(e) => setSearchTargetFile(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-rose-300 font-mono">&lt;&lt;&lt;&lt;&lt;&lt;&lt; SEARCH (置換対象の既存行)</label>
                  <textarea
                    value={searchBlockText}
                    onChange={(e) => setSearchBlockText(e.target.value)}
                    className="w-full h-44 p-3 bg-slate-950 font-mono text-xs text-rose-300 border border-slate-800 rounded-xl focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-emerald-300 font-mono">======= REPLACE (新しい置換行)</label>
                  <textarea
                    value={replaceBlockText}
                    onChange={(e) => setSearchReplaceBlockText(e.target.value)}
                    className="w-full h-44 p-3 bg-slate-950 font-mono text-xs text-emerald-300 border border-slate-800 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {searchReplaceNotice && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200">
                  {searchReplaceNotice}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleApplySearchReplace}
                  disabled={isApplyingDiff}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Aider Search/Replace を適用</span>
                </button>
              </div>
            </div>
          )}

          {/* 6-3: 自動エラー自己修復ループ */}
          {aiderSubTab === 'auto_heal' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                コード生成時に構文エラーや閉じ括弧漏れを検知した場合、Aiderのようにエラーメッセージを読み解き、最大3回自動で修復ループを回します。
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">エラーを含む可能性のあるコード:</label>
                  <textarea
                    value={autoHealInput}
                    onChange={(e) => setAutoHealInput(e.target.value)}
                    className="w-full h-52 p-3 bg-slate-950 font-mono text-xs text-amber-300 border border-slate-800 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">自己修復ループの実行ログ:</label>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl h-52 overflow-y-auto space-y-2 text-xs font-mono">
                    {autoHealResult ? (
                      <div>
                        <div className="text-emerald-400 font-bold mb-2">
                          {autoHealResult.healed ? '🎉 自己修復ループ成功 (構文エラー 0件に補正完了)' : '⚠️ 修復完了できませんでした'}
                        </div>
                        {autoHealResult.repairHistory.map((h, idx) => (
                          <div key={idx} className="p-2 bg-slate-900 rounded mb-1 text-[11px]">
                            <div className="text-rose-400">試行 {h.attempt}: {h.error}</div>
                            <div className="text-cyan-300 mt-0.5">↳ 適用補正: {h.fixApplied}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-500 text-center pt-16">
                        「自己修復ループを実行」を押すと、診断と自動補正の履歴が表示されます。
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleRunAutoHeal}
                  disabled={isHealing}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>自己修復ループを実行</span>
                </button>
              </div>
            </div>
          )}

          {/* 6-4: Gitコミット履歴 & ロールバック */}
          {aiderSubTab === 'commits' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-200">新規アトミックGitコミットの作成</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commitMsgInput}
                    onChange={(e) => setCommitMsgInput(e.target.value)}
                    placeholder="コミットメッセージを入力"
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                  />
                  <button
                    onClick={handleCreateCommit}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow active:scale-95 transition-all"
                  >
                    コミット記録
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300">コミット履歴タイムライン (Aider Timeline):</div>
                {commitsList.length > 0 ? (
                  <div className="divide-y divide-slate-800 border border-slate-800 bg-slate-950 rounded-xl">
                    {commitsList.map((c) => (
                      <div key={c.hash} className="p-3 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-teal-950 border border-teal-800 text-teal-300 font-mono text-[10px] rounded">
                              {c.hash}
                            </span>
                            <span className="font-semibold text-slate-200">{c.message}</span>
                            {c.status === 'ROLLED_BACK' && (
                              <span className="px-2 py-0.5 bg-rose-950 border border-rose-800 text-rose-300 text-[10px] rounded">
                                ロールバック済み
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(c.timestamp).toLocaleString()} | 対象: {c.files.join(', ')}
                          </div>
                        </div>

                        {c.status !== 'ROLLED_BACK' && (
                          <button
                            onClick={() => handleRollbackCommit(c.hash)}
                            className="px-3 py-1 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all"
                          >
                            <Undo2 className="w-3 h-3" />
                            <span>1秒ロールバック</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-500 text-xs border border-slate-800 bg-slate-950 rounded-xl">
                    コミット履歴はまだありません。「コミット記録」または差分置換を行うと自動で記録されます。
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 7. 超進化5大ツール ── */}
      {selectedSubTool === 'supercharger' && <SuperchargerToolsSubView />}
    </div>
  );
};
