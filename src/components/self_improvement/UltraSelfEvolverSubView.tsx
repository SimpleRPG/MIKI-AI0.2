import React, { useState, useEffect } from 'react';
import {
  Dna,
  RotateCcw,
  Activity,
  Zap,
  ShieldAlert,
  Play,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  Code2,
  FileCode,
  Gauge,
  Sparkles,
  RefreshCw,
  Cpu,
  Check,
  Layers,
  Copy,
} from 'lucide-react';
import {
  mikiUltraEvolverService,
  MutationTestResult,
  ReflexionResult,
  ComplexityHeatmapResult,
  BigOOptimizeResult,
  RuntimeSentryResult,
} from '../../services/mikiUltraEvolverService';
import { aiderEngineService } from '../../services/aiderEngineService';

export const UltraSelfEvolverSubView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'mutation' | 'reflexion' | 'complexity' | 'big_o' | 'sentry'
  >('mutation');

  // 1. Mutation Test State
  const [mutationCode, setMutationCode] = useState(`export class AutonomousTaskScheduler {
  private queue: Array<{ id: string; runAt: number }> = [];

  public schedule(id: string, delayMs: number): boolean {
    if (!id || typeof id !== 'string') return false;
    if (delayMs < 0) return false;
    this.queue.push({ id, runAt: Date.now() + delayMs });
    return true;
  }

  public flush(): number {
    const now = Date.now();
    const ready = this.queue.filter(q => q.runAt <= now);
    this.queue = this.queue.filter(q => q.runAt > now);
    return ready.length;
  }
}`);
  const [mutationResult, setMutationResult] = useState<MutationTestResult | null>(null);
  const [isRunningMutation, setIsRunningMutation] = useState(false);

  // 2. Reflexion State
  const [failureReason, setFailureReason] = useState(
    'Invariant #2 failed: Boundary check delayMs < 0 rejected negative inputs but allowed 0 without proper callback'
  );
  const [reflexionResult, setReflexionResult] = useState<ReflexionResult | null>(null);
  const [isReflecting, setIsReflecting] = useState(false);
  const [reflexionNotice, setReflexionNotice] = useState<string | null>(null);

  // 3. Complexity Heatmap State
  const [heatmapResult, setHeatmapResult] = useState<ComplexityHeatmapResult | null>(null);
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM'>('ALL');

  // 4. Big-O Optimizer State
  const [bigOCode, setBigOCode] = useState(`export function matchUserInterests(users: any[], tags: any[]) {
  const matches = [];
  for (let i = 0; i < users.length; i++) {
    for (let j = 0; j < tags.length; j++) {
      if (users[i].tagId === tags[j].id) {
        matches.push({ user: users[i], tag: tags[j] });
      }
    }
  }
  return matches;
}`);
  const [bigOResult, setBigOResult] = useState<BigOOptimizeResult | null>(null);
  const [isOptimizingBigO, setIsOptimizingBigO] = useState(false);
  const [bigONotice, setBigONotice] = useState<string | null>(null);

  // 5. Runtime Sentry State
  const [sentryError, setSentryError] = useState(
    "TypeError: Cannot read properties of undefined (reading 'length')"
  );
  const [sentryStack, setSentryStack] = useState(
    'at AutonomousTaskScheduler.flush (scheduler.ts:14:26)\nat AutonomousCoordinator.step (coordinator.ts:42:12)'
  );
  const [sentryResult, setSentryResult] = useState<RuntimeSentryResult | null>(null);
  const [isHealingSentry, setIsHealingSentry] = useState(false);
  const [sentryNotice, setSentryNotice] = useState<string | null>(null);

  // Handlers
  const handleRunMutationTest = async () => {
    setIsRunningMutation(true);
    try {
      const res = await mikiUltraEvolverService.runMutationTest(mutationCode, 'AutonomousTaskScheduler');
      setMutationResult(res);
    } finally {
      setIsRunningMutation(false);
    }
  };

  const handleTriggerReflexion = async () => {
    setIsReflecting(true);
    try {
      const res = await mikiUltraEvolverService.triggerReflexionLoop(failureReason, 1, 45, 'scheduler.ts');
      setReflexionResult(res);
      setReflexionNotice('✅ 自己反省メモを生成し、根本原因に基づいた改善パッチを策定しました');
      setTimeout(() => setReflexionNotice(null), 4000);
    } finally {
      setIsReflecting(false);
    }
  };

  const handleLoadHeatmap = async () => {
    setIsLoadingHeatmap(true);
    try {
      const res = await mikiUltraEvolverService.fetchComplexityHeatmap();
      setHeatmapResult(res);
    } finally {
      setIsLoadingHeatmap(false);
    }
  };

  const handleOptimizeBigO = async () => {
    setIsOptimizingBigO(true);
    try {
      const res = await mikiUltraEvolverService.optimizeBigOComplexity(bigOCode, 'matchUserInterests');
      setBigOResult(res);
      setBigONotice('⚡ アルゴリズムのO(N)ハッシュインデックス化とLRUメモ化パッチを生成しました');
      setTimeout(() => setBigONotice(null), 4000);
    } finally {
      setIsOptimizingBigO(false);
    }
  };

  const handleTriggerSentryHeal = async () => {
    setIsHealingSentry(true);
    try {
      const res = await mikiUltraEvolverService.triggerRuntimeSentryHeal(sentryError, sentryStack, 'scheduler.ts');
      setSentryResult(res);
      setSentryNotice('🛡️ スタックトレースから欠陥を特定し、ホットフィックスを自動適用しました！');
      setTimeout(() => setSentryNotice(null), 5000);
    } finally {
      setIsHealingSentry(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'complexity' && !heatmapResult) {
      handleLoadHeatmap();
    }
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* 5大 Ultra Evolver タブナビゲーション */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 bg-slate-900/90 border border-purple-900/40 rounded-2xl shadow-inner">
        <button
          onClick={() => setActiveTab('mutation')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'mutation'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Dna className="w-3.5 h-3.5 text-purple-300" />
          1. 変異体テスト
        </button>

        <button
          onClick={() => setActiveTab('reflexion')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'reflexion'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
          2. Reflexion反省
        </button>

        <button
          onClick={() => setActiveTab('complexity')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'complexity'
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-rose-300" />
          3. 複雑度ヒートマップ
        </button>

        <button
          onClick={() => setActiveTab('big_o')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'big_o'
              ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-teal-300" />
          4. Big-Oオプティマイザ
        </button>

        <button
          onClick={() => setActiveTab('sentry')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all col-span-2 sm:col-span-1 ${
            activeTab === 'sentry'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-cyan-300" />
          5. 実行時自己治癒
        </button>
      </div>

      {/* ── 1. ミューテーションテスト ── */}
      {activeTab === 'mutation' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Dna className="w-4 h-4 text-purple-400" />
                  ミューテーションテスト（変異体注入によるテスト網羅性・頑健性監査）
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  コード内の不等号や条件式を意図的に反転させた「変異体（Mutant）」を生成。みきのテストがバグを確実にキル（検知）できるか測定し、テストの抜け穴をゼロにします。
                </p>
              </div>
              <button
                onClick={handleRunMutationTest}
                disabled={isRunningMutation}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${isRunningMutation ? 'animate-spin' : ''}`} />
                {isRunningMutation ? '変異体注入＆キル測定中...' : 'ミューテーションテスト実行'}
              </button>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                変異体注入対象コード (TypeScript):
              </label>
              <textarea
                value={mutationCode}
                onChange={(e) => setMutationCode(e.target.value)}
                rows={5}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {mutationResult && (
            <div className="space-y-4">
              {/* スコアバナー */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  mutationResult.mutationScore >= 80
                    ? 'bg-purple-950/40 border-purple-500/40 text-purple-200'
                    : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-black/40">
                    <Dna className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">
                      ミューテーションスコア: {mutationResult.mutationScore}%
                      <span className="ml-2 text-xs font-normal opacity-90">
                        ({mutationResult.killedCount} / {mutationResult.totalMutants} 変異体を撃破)
                      </span>
                    </div>
                    <div className="text-xs opacity-80 mt-0.5">{mutationResult.assessment}</div>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-2xl font-bold">{mutationResult.mutationScore}%</div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70">
                    {mutationResult.survivedCount === 0 ? '全変異体撃破' : `${mutationResult.survivedCount}件の抜け穴あり`}
                  </div>
                </div>
              </div>

              {/* 変異体一覧 */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300">生成された変異体 (Mutants) 判定ログ:</div>
                {mutationResult.mutants.map((mutant) => (
                  <div
                    key={mutant.id}
                    className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            mutant.status === 'KILLED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {mutant.status === 'KILLED' ? '⚔️ KILLED (撃破・検知成功)' : '⚠️ SURVIVED (生き残り・テスト漏れ)'}
                        </span>
                        <span className="text-xs font-mono text-slate-300">{mutant.operator}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{mutant.description}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 bg-black/50 rounded-lg border border-slate-800 text-slate-400">
                        <span className="text-[10px] text-slate-500 block">原典コード:</span>
                        {mutant.originalSnippet}
                      </div>
                      <div className="p-2 bg-purple-950/30 rounded-lg border border-purple-800/40 text-purple-300">
                        <span className="text-[10px] text-purple-400 block">注入された変異:</span>
                        {mutant.mutatedSnippet}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 pt-0.5">
                      検知テスト: <span className="font-mono text-slate-300">{mutant.killedByTest}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 2. Reflexion 反省ループ ── */}
      {activeTab === 'reflexion' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                Reflexion 自己反省・反復認知ループ（Self-Critique Engine）
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                改善試行で失敗や不変条件抵触が起きた際、人間が指摘しなくてもみき自身が「なぜ失敗したのか」の根本原因を多角的に自己分析し、反省メモから即時修正パッチを生成してリトライします。
              </p>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                発生した失敗事由・抵触ログ:
              </label>
              <textarea
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">
                対象モジュール: <span className="font-mono text-amber-300">scheduler.ts (第45章)</span>
              </span>
              <button
                onClick={handleTriggerReflexion}
                disabled={isReflecting}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isReflecting ? 'animate-spin' : ''}`} />
                {isReflecting ? '自己反省ループ起動中...' : 'Reflexion自己反省を実行'}
              </button>
            </div>

            {reflexionNotice && (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl">
                {reflexionNotice}
              </div>
            )}
          </div>

          {reflexionResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 根本原因 ＆ 自己批判 */}
                <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    根本原因分析 (5 Whys Root Cause):
                  </div>
                  <p className="text-xs text-slate-300 bg-black/40 p-3 rounded-xl border border-slate-800 leading-relaxed">
                    {reflexionResult.rootCause}
                  </p>

                  <div className="text-xs font-bold text-amber-300 pt-2">自己批判メモ (Self-Critique):</div>
                  <p className="text-xs text-slate-300 bg-black/40 p-3 rounded-xl border border-slate-800 leading-relaxed italic">
                    "{reflexionResult.selfCritique}"
                  </p>
                </div>

                {/* 解決戦略 & 生成パッチ */}
                <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
                  <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    次回試行の解決戦略 (Resolution Strategy):
                  </div>
                  <p className="text-xs text-slate-300 bg-black/40 p-3 rounded-xl border border-slate-800 leading-relaxed">
                    {reflexionResult.resolutionStrategy}
                  </p>

                  <div className="text-xs font-bold text-emerald-300 pt-2">
                    反省から自動生成された修正コード:
                  </div>
                  <pre className="p-3 bg-black/60 rounded-xl font-mono text-[11px] text-emerald-300 overflow-x-auto border border-slate-800">
                    {reflexionResult.generatedPatch}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 3. 複雑度ヒートマップ ── */}
      {activeTab === 'complexity' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-400" />
                  循環的複雑度（Cyclomatic Complexity）＆ ネスト深度ヒートマップ
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  全TypeScriptファイルをAST解析し、条件分岐の多さ・ネスト深さ・行数から「みきが次にリファクタリングすべき最優先ターゲット」を自動算出します。
                </p>
              </div>
              <button
                onClick={handleLoadHeatmap}
                disabled={isLoadingHeatmap}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHeatmap ? 'animate-spin' : ''}`} />
                {isLoadingHeatmap ? 'ASTスキャン中...' : 'ヒートマップ再計測'}
              </button>
            </div>

            {/* フィルタ */}
            <div className="flex gap-2">
              {(['ALL', 'HIGH', 'MEDIUM'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setUrgencyFilter(filter)}
                  className={`px-3 py-1 text-xs rounded-lg font-bold transition-all ${
                    urgencyFilter === filter
                      ? 'bg-rose-600 text-white shadow'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {filter === 'ALL' && 'すべて表示'}
                  {filter === 'HIGH' && '🔥 高緊急度 (優先リファクタリング)'}
                  {filter === 'MEDIUM' && '⚡ 中緊急度'}
                </button>
              ))}
            </div>
          </div>

          {heatmapResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {heatmapResult.heatmap
                  .filter((item) => urgencyFilter === 'ALL' || item.urgencyLevel === urgencyFilter)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2 hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-slate-200 truncate max-w-[220px]">
                          {item.file}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.urgencyLevel === 'HIGH'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          優先度スコア: {item.urgencyScore}点
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono py-1">
                        <div className="p-1.5 bg-black/40 rounded-lg">
                          <span className="text-[10px] text-slate-500 block">総行数</span>
                          <span className="text-slate-200">{item.lineCount}行</span>
                        </div>
                        <div className="p-1.5 bg-black/40 rounded-lg">
                          <span className="text-[10px] text-slate-500 block">循環複雑度</span>
                          <span className="text-rose-400">{item.cyclomaticComplexity}</span>
                        </div>
                        <div className="p-1.5 bg-black/40 rounded-lg">
                          <span className="text-[10px] text-slate-500 block">最大ネスト</span>
                          <span className="text-amber-400">{item.maxNestingDepth}階層</span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded-xl border border-slate-800/80">
                        推奨アクション: <span className="text-slate-300">{item.recommendedAction}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4. Big-O オプティマイザ ── */}
      {activeTab === 'big_o' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-teal-400" />
                  計算量（Big-O）オプティマイザ ＆ 自動インラインメモ化
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  重い二重ループや過剰走査コードを検知し、O(N)ハッシュマップ・インデックス化およびLRUキャッシュを自動注入して大幅高速化します。
                </p>
              </div>
              <button
                onClick={handleOptimizeBigO}
                disabled={isOptimizingBigO}
                className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 ${isOptimizingBigO ? 'animate-spin' : ''}`} />
                {isOptimizingBigO ? 'アルゴリズム最適化中...' : 'Big-O最適化を実行'}
              </button>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                最適化対象コード (例: 二重ループ・反復走査):
              </label>
              <textarea
                value={bigOCode}
                onChange={(e) => setBigOCode(e.target.value)}
                rows={6}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>

            {bigONotice && (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl">
                {bigONotice}
              </div>
            )}
          </div>

          {bigOResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center">
                  <div className="text-[11px] text-slate-400 font-mono">改善前計算量</div>
                  <div className="text-xl font-bold text-rose-400 font-mono mt-0.5">
                    {bigOResult.originalComplexity}
                  </div>
                  <div className="text-[10px] text-slate-500">Quadratic Loop</div>
                </div>

                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center">
                  <div className="text-[11px] text-slate-400 font-mono">最適化後計算量</div>
                  <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
                    {bigOResult.optimizedComplexity}
                  </div>
                  <div className="text-[10px] text-emerald-300">Linear Hash Map</div>
                </div>

                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center">
                  <div className="text-[11px] text-slate-400 font-mono">推定高速化倍率</div>
                  <div className="text-xl font-bold text-teal-400 font-mono mt-0.5">
                    {bigOResult.estimatedSpeedupFactor}
                  </div>
                  <div className="text-[10px] text-slate-400">Throughput Gain</div>
                </div>

                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center">
                  <div className="text-[11px] text-slate-400 font-mono">メモリ影響</div>
                  <div className="text-xl font-bold text-indigo-400 font-mono mt-0.5">
                    {bigOResult.memoryImpact}
                  </div>
                  <div className="text-[10px] text-slate-400">Cache Footprint</div>
                </div>
              </div>

              {/* 最適化後コード */}
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-teal-400" />
                  自動生成された O(N) ハッシュインデックス化コード:
                </div>
                <pre className="p-3 bg-black/60 rounded-xl font-mono text-[11px] text-teal-300 overflow-x-auto leading-relaxed border border-slate-800">
                  {bigOResult.optimizedCode}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 5. 実行時自己治癒セントリー ── */}
      {activeTab === 'sentry' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                実行時自己治癒セントリー（Runtime Self-Healing Sentry / 自動ホットフィックス）
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                アプリ実行中に起きた例外や未処理エラーのスタックトレースを捕捉。みきが瞬時に対象ファイルと行番号を特定し、緊急ホットフィックスパッチを生成してクラッシュを未然に防ぎます。
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">エラーメッセージ:</label>
                <input
                  type="text"
                  value={sentryError}
                  onChange={(e) => setSentryError(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">スタックトレース:</label>
                <input
                  type="text"
                  value={sentryStack}
                  onChange={(e) => setSentryStack(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleTriggerSentryHeal}
                disabled={isHealingSentry}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <ShieldAlert className={`w-3.5 h-3.5 ${isHealingSentry ? 'animate-spin' : ''}`} />
                {isHealingSentry ? '自己治癒ホットフィックス生成中...' : 'スタックトレースから緊急自己治癒'}
              </button>
            </div>

            {sentryNotice && (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl">
                {sentryNotice}
              </div>
            )}
          </div>

          {sentryResult && (
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    特定ファイル: <span className="font-mono text-cyan-300">{sentryResult.resolvedFile} : {sentryResult.resolvedLine}行</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    診断結果: {sentryResult.diagnosedFault}
                  </div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl">
                  {sentryResult.recoveryStatus} (即時復旧済み)
                </span>
              </div>

              <div>
                <div className="text-[11px] font-mono text-slate-400 mb-1">
                  自動適用された Aider Search/Replace ホットフィックスパッチ:
                </div>
                <pre className="p-3 bg-black/70 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800 leading-relaxed">
                  {sentryResult.searchReplacePatch}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
