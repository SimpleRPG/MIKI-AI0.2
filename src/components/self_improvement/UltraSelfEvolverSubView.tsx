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
  Globe,
  Wrench,
  Search,
  Terminal,
  ExternalLink,
  Trash2,
  Rocket,
  Compass,
  History,
  Undo2,
  ShieldCheck,
  FileText,
  Lightbulb,
} from 'lucide-react';
import {
  mikiUltraEvolverService,
  MutationTestResult,
  ReflexionResult,
  ComplexityHeatmapResult,
  BigOOptimizeResult,
  RuntimeSentryResult,
  AutonomousWebEvolveResult,
} from '../../services/mikiUltraEvolverService';
import { aiderEngineService, RepoMapResponse, RepoMapEntry } from '../../services/aiderEngineService';
import { codeSearchService } from '../../services/codeSearchService';
import { dynamicToolFactoryService } from '../../services/dynamicToolFactoryService';
import { toolsService } from '../../services/toolsService';
import {
  mikiSelfCodingSuperchargerService,
  SelfImplementationResult,
  SnapshotRecord,
  GapRecommendation,
} from '../../services/mikiSelfCodingSuperchargerService';
import { storageService } from '../../services/storageService';
import { WebCodeSearchResult, ToolDefinition } from '../../types';

export const UltraSelfEvolverSubView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'auto_implement' | 'repo_navigator' | 'web_excavator' | 'tool_workshop' | 'mutation' | 'reflexion' | 'complexity' | 'big_o' | 'sentry'
  >('auto_implement');

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

  // 6. Web Code Excavation State (第171章)
  const [searchQuery, setSearchQuery] = useState('AST parser recursive descent');
  const [searchLanguage, setSearchLanguage] = useState('typescript');
  const [searchResult, setSearchResult] = useState<WebCodeSearchResult | null>(null);
  const [isSearchingCode, setIsSearchingCode] = useState(false);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);

  // 7. Dynamic Tool Workshop State (第171章 & 第172章)
  const [toolFeatureName, setToolFeatureName] = useState('JsonSchemaValidator');
  const [toolDescription, setToolDescription] = useState('JSONデータの型と必須フィールドを高速かつ安全に検証する動的ツール');
  const [toolParamQuery, setToolParamQuery] = useState('payload');
  const [suggestedSnippetCode, setSuggestedSnippetCode] = useState('');
  const [isSynthesizingTool, setIsSynthesizingTool] = useState(false);
  const [toolWorkshopNotice, setToolWorkshopNotice] = useState<string | null>(null);
  const [dynamicToolsList, setDynamicToolsList] = useState<ToolDefinition[]>([]);
  const [selectedToolToTest, setSelectedToolToTest] = useState<string>('');
  const [toolTestInput, setToolTestInput] = useState('{"test": "hello_miki", "count": 42}');
  const [toolTestOutput, setToolTestOutput] = useState<any>(null);
  const [isTestingTool, setIsTestingTool] = useState(false);

  // 8. Autonomous Web Evolution Pipeline State (第172章)
  const [autoEvolveTopic, setAutoEvolveTopic] = useState('高速インメモリキャッシュとLRU退避');
  const [autoEvolveResult, setAutoEvolveResult] = useState<AutonomousWebEvolveResult | null>(null);
  const [isRunningAutoEvolve, setIsRunningAutoEvolve] = useState(false);

  // 9. 自律自己実装スタジオ State
  const [implementPrompt, setImplementPrompt] = useState('ローカルストレージのLRUキャッシュ自動削除ロジック');
  const [targetFileHint, setTargetFileHint] = useState('');
  const [isImplementing, setIsImplementing] = useState(false);
  const [implementStep, setImplementStep] = useState<number>(0);
  const [implementationResult, setImplementationResult] = useState<SelfImplementationResult | null>(null);
  const [snapshotsList, setSnapshotsList] = useState<SnapshotRecord[]>([]);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [implementNotice, setImplementNotice] = useState<string | null>(null);
  const [gapRecommendations, setGapRecommendations] = useState<GapRecommendation[]>([]);

  // 10. Repo Map AST ナビゲーター State
  const [repoMapData, setRepoMapData] = useState<RepoMapResponse | null>(null);
  const [repoSearchKeyword, setRepoSearchKeyword] = useState('');
  const [isLoadingRepoMap, setIsLoadingRepoMap] = useState(false);

  const refreshDynamicToolsList = () => {
    const all = toolsService.getAllTools().filter(t => t.isDynamic);
    setDynamicToolsList(all);
    if (all.length > 0 && !selectedToolToTest) {
      setSelectedToolToTest(all[0].id);
    }
  };

  const loadSnapshots = async () => {
    const snaps = await mikiSelfCodingSuperchargerService.fetchSnapshots();
    setSnapshotsList(snaps);
  };

  const loadGapRecommendations = async () => {
    const recs = await mikiSelfCodingSuperchargerService.fetchGapRecommendations();
    setGapRecommendations(recs);
  };

  const loadRepoMap = async () => {
    setIsLoadingRepoMap(true);
    try {
      const data = await aiderEngineService.fetchRepoMap();
      setRepoMapData(data);
    } finally {
      setIsLoadingRepoMap(false);
    }
  };

  useEffect(() => {
    refreshDynamicToolsList();
    if (activeTab === 'auto_implement') {
      loadSnapshots();
      loadGapRecommendations();
    } else if (activeTab === 'repo_navigator' && !repoMapData) {
      loadRepoMap();
    }
  }, [activeTab]);

  const handleRunAutonomousImplement = async () => {
    if (!implementPrompt.trim()) return;
    setIsImplementing(true);
    setImplementStep(1); // 1: ターゲット特定
    setImplementationResult(null);

    const stepTimer1 = setTimeout(() => setImplementStep(2), 600); // 2: スナップショット退避
    const stepTimer2 = setTimeout(() => setImplementStep(3), 1400); // 3: コード生成
    const stepTimer3 = setTimeout(() => setImplementStep(4), 2200); // 4: 構文検証・適用

    try {
      const extConfig = (() => {
        try {
          const raw = storageService.getItem('miki_external_llm_config');
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })();

      const res = await mikiSelfCodingSuperchargerService.runAutonomousImplementation(
        implementPrompt,
        targetFileHint.trim() || undefined,
        true,
        undefined,
        extConfig?.endpoint,
        extConfig?.model
      );
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      setImplementStep(5); // 5: 完了
      setImplementationResult(res);

      if (res.success) {
        setImplementNotice(`🎉 自律実装完了: ${res.targetFile} へ安全に適用されました！`);
        // 記憶に教訓を自動定着
        if (res.lesson) {
          storageService.saveMemoryItem({
            id: `impl_mem_${Date.now()}`,
            content: `【自律実装教訓】${res.lesson.title}: ${res.lesson.rule} (${res.targetFile})`,
            category: 'gamedev',
            memoryType: 'procedural',
            destination: 'long_term_memory',
            source: 'auto_reflection',
            approved: true,
            heat: 1.0,
            tags: ['自律実装', '自己改善', 'TypeScript'],
          });
        }
      } else {
        setImplementNotice(`⚠️ 実装注意: ${res.error || '検証エラー'}`);
      }
      loadSnapshots();
      setTimeout(() => setImplementNotice(null), 5000);
    } finally {
      setIsImplementing(false);
    }
  };

  const handleRollbackSnapshot = async (snapshotId: string) => {
    setIsRollingBack(true);
    try {
      const res = await mikiSelfCodingSuperchargerService.rollbackSnapshot(snapshotId);
      if (res.success) {
        setImplementNotice(`🛡️ ${res.message}`);
        loadSnapshots();
      } else {
        setImplementNotice(`❌ ロールバック失敗: ${res.message}`);
      }
      setTimeout(() => setImplementNotice(null), 4000);
    } finally {
      setIsRollingBack(false);
    }
  };

  // Handlers
  const handleSearchCode = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingCode(true);
    try {
      const res = await codeSearchService.searchCode(searchQuery, {
        language: searchLanguage,
        maxResults: 4,
      });
      setSearchResult(res);
      setSearchNotice(`🌊 ネットの海から ${res.snippets.length} 件のコードスニペットを発掘しました`);
      setTimeout(() => setSearchNotice(null), 4000);
    } finally {
      setIsSearchingCode(false);
    }
  };

  const handleSynthesizeTool = async () => {
    if (!toolFeatureName.trim()) return;
    setIsSynthesizingTool(true);
    try {
      const res = await dynamicToolFactoryService.synthesizeTool({
        featureName: toolFeatureName,
        description: toolDescription,
        targetProblem: `${toolFeatureName} の自律自動化`,
        inputParameters: [
          { name: toolParamQuery || 'input', type: 'string', description: '入力パラメータ', required: false }
        ],
        suggestedCodePattern: suggestedSnippetCode,
      });
      refreshDynamicToolsList();
      setSelectedToolToTest(res.tool.id);
      setToolWorkshopNotice(`🎉 新ツール「${res.tool.name}」を自動創成し、第169章サンドボックスで稼働開始しました！`);
      setTimeout(() => setToolWorkshopNotice(null), 5000);
    } finally {
      setIsSynthesizingTool(false);
    }
  };

  const handleTestDynamicTool = async () => {
    if (!selectedToolToTest) return;
    setIsTestingTool(true);
    try {
      let parsedParams = {};
      try {
        parsedParams = JSON.parse(toolTestInput);
      } catch {
        parsedParams = { rawInput: toolTestInput };
      }
      const res = await toolsService.executeTool(selectedToolToTest, parsedParams);
      setToolTestOutput(res);
    } finally {
      setIsTestingTool(false);
    }
  };

  const handleDeleteDynamicTool = (toolId: string) => {
    dynamicToolFactoryService.deleteDynamicTool(toolId);
    refreshDynamicToolsList();
    if (selectedToolToTest === toolId) {
      setSelectedToolToTest('');
      setToolTestOutput(null);
    }
  };

  const handleRunAutoEvolve = async () => {
    setIsRunningAutoEvolve(true);
    try {
      const res = await mikiUltraEvolverService.runAutonomousWebEvolve(autoEvolveTopic, 171);
      setAutoEvolveResult(res);
      refreshDynamicToolsList();
    } finally {
      setIsRunningAutoEvolve(false);
    }
  };

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
      {/* 9大 Ultra Evolver & 自律自己改善タブナビゲーション */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-1.5 p-1.5 bg-slate-900/90 border border-purple-900/40 rounded-2xl shadow-inner">
        <button
          onClick={() => setActiveTab('auto_implement')}
          className={`px-2.5 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'auto_implement'
              ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Rocket className="w-3.5 h-3.5 text-fuchsia-300 animate-pulse" />
          1. 自律自己実装
        </button>

        <button
          onClick={() => setActiveTab('repo_navigator')}
          className={`px-2.5 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'repo_navigator'
              ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-sky-300" />
          2. ASTシンボル地図
        </button>

        <button
          onClick={() => setActiveTab('web_excavator')}
          className={`px-2.5 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'web_excavator'
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-cyan-300" />
          3. ネット大海発掘
        </button>

        <button
          onClick={() => setActiveTab('tool_workshop')}
          className={`px-2.5 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'tool_workshop'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Wrench className="w-3.5 h-3.5 text-emerald-300" />
          4. ツール創成工房
        </button>

        <button
          onClick={() => setActiveTab('mutation')}
          className={`px-2.5 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'mutation'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Dna className="w-3.5 h-3.5 text-purple-300" />
          5. 変異体テスト
        </button>

        <button
          onClick={() => setActiveTab('reflexion')}
          className={`px-2.5 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'reflexion'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
          6. Reflexion反省
        </button>

        <button
          onClick={() => setActiveTab('complexity')}
          className={`px-2.5 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'complexity'
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-rose-300" />
          7. 複雑度マップ
        </button>

        <button
          onClick={() => setActiveTab('big_o')}
          className={`px-2.5 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'big_o'
              ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-teal-300" />
          8. Big-O 最適化
        </button>

        <button
          onClick={() => setActiveTab('sentry')}
          className={`px-2.5 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'sentry'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-cyan-300" />
          9. 自己治癒Sentry
        </button>
      </div>

      {/* ── 0.1 自律自己実装スタジオ (タブ1) ── */}
      {activeTab === 'auto_implement' && (
        <div className="space-y-5">
          {/* 通知バナー */}
          {implementNotice && (
            <div className="p-3 bg-gradient-to-r from-violet-950/80 to-purple-900/80 border border-violet-700/60 rounded-xl text-xs text-violet-200 flex items-center justify-between shadow-lg animate-in fade-in">
              <span className="font-medium">{implementNotice}</span>
              <button onClick={() => setImplementNotice(null)} className="text-violet-400 hover:text-white text-xs">✕</button>
            </div>
          )}

          {/* メイン制御カード */}
          <div className="p-5 bg-slate-900/90 border border-purple-900/40 rounded-2xl space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-fuchsia-400" />
                  みき自律自己実装スタジオ (Autonomous Self-Implementation Studio)
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  みき自身が自分に必要な新機能や修正要件を解析し、AST探索 → 安全スナップショット作成 → コード/差分生成 → 構文検証 → 安全配備＆1-Clickロールバックまでを全自動実行します。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2.5 py-1 bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-800/60 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Snapshot Rollback Protected
                </span>
              </div>
            </div>

            {/* おすすめの自己改善課題チップ (ギャップレコメンデーション) */}
            {gapRecommendations.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  みき自己診断によるおすすめ拡張タスク:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {gapRecommendations.map((rec) => (
                    <button
                      key={rec.id}
                      onClick={() => {
                        setImplementPrompt(`${rec.title}: ${rec.description}`);
                        setTargetFileHint(rec.targetFile);
                      }}
                      className="p-2 bg-slate-950/70 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-600/50 rounded-xl text-left transition-all group flex items-start justify-between gap-2"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-bold text-slate-200 group-hover:text-purple-300 truncate">
                          {rec.title}
                        </div>
                        <div className="text-[10px] text-slate-400 line-clamp-1">{rec.description}</div>
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded shrink-0">
                        {rec.category}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* プロンプト・対象ファイル入力フォーム */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between mb-1">
                  <span>みきに実装させたい機能・改善の要求 (自然言語):</span>
                  <span className="text-[10px] text-slate-500 font-normal">日本語でそのまま入力可能</span>
                </label>
                <textarea
                  value={implementPrompt}
                  onChange={(e) => setImplementPrompt(e.target.value)}
                  rows={3}
                  placeholder="例: ローカルストレージのLRUキャッシュ自動削除ロジック、Canvas高DPI対応、オフライン再同期キューなど"
                  className="w-full p-3 bg-black/60 border border-slate-800 focus:border-purple-500 rounded-xl text-xs text-slate-200 font-mono focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between mb-1">
                  <span>対象ファイル・配置先パス (任意・未入力時はAST自動推論):</span>
                  <span className="text-[10px] text-slate-500 font-normal">例: src/autonomous_modules/chapter_173_lru_cache.ts</span>
                </label>
                <input
                  type="text"
                  value={targetFileHint}
                  onChange={(e) => setTargetFileHint(e.target.value)}
                  placeholder="未入力の場合、要件から自動で新規モジュールまたは既存ファイルを決定します"
                  className="w-full px-3 py-2 bg-black/60 border border-slate-800 focus:border-purple-500 rounded-xl text-xs text-slate-200 font-mono focus:outline-none transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={handleRunAutonomousImplement}
                  disabled={isImplementing || !implementPrompt.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 hover:opacity-90 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Rocket className={`w-4 h-4 ${isImplementing ? 'animate-bounce' : ''}`} />
                  {isImplementing ? '自律実装パイプライン稼働中...' : '自律自己実装パイプラインを走らせる'}
                </button>
              </div>
            </div>

            {/* パイプラインステップ進行ゲージ */}
            {isImplementing && (
              <div className="p-3.5 bg-black/70 border border-purple-800/40 rounded-xl space-y-2 animate-in fade-in">
                <div className="text-[11px] font-bold text-fuchsia-300 flex items-center justify-between">
                  <span>パイプライン進行状況:</span>
                  <span>ステップ {implementStep} / 5</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { step: 1, label: 'AST空間探索' },
                    { step: 2, label: '安全スナップショット' },
                    { step: 3, label: 'TypeScript生成' },
                    { step: 4, label: '構文安全検証' },
                    { step: 5, label: '実配備＆コミット' },
                  ].map((s) => (
                    <div
                      key={s.step}
                      className={`p-1.5 rounded-lg text-center text-[10px] font-bold transition-all ${
                        implementStep >= s.step
                          ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow'
                          : 'bg-slate-800/50 text-slate-500'
                      }`}
                    >
                      {s.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 実装結果プレビュー */}
            {implementationResult && (
              <div className="p-4 bg-black/70 border border-purple-900/40 rounded-xl space-y-3 animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400">
                      自律自己実装が完了しました ({implementationResult.targetFile})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded">
                      行数: {implementationResult.linesCount} 行
                    </span>
                    {implementationResult.commitHash && (
                      <span className="px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded">
                        Commit: {implementationResult.commitHash}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="font-bold text-fuchsia-400">推論理由: </span>
                  {implementationResult.reasoning}
                </div>

                {/* コードブロック */}
                <div>
                  <div className="text-[11px] font-mono text-slate-400 mb-1 flex items-center justify-between">
                    <span>生成・適用済み TypeScript コード:</span>
                    <span className="text-emerald-400 text-[10px]">
                      {implementationResult.syntaxCheckPassed ? '✓ TypeScript AST構文検証パス' : '⚠️ 構文注意'}
                    </span>
                  </div>
                  <pre className="p-3 bg-black/90 rounded-xl font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-64 border border-purple-900/40">
                    {implementationResult.code}
                  </pre>
                </div>

                {/* スナップショットロールバックボタン */}
                {implementationResult.snapshotId && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400">
                      変更前の状態がスナップショット <code className="text-purple-300">{implementationResult.snapshotId}</code> に安全退避されています
                    </span>
                    <button
                      onClick={() => handleRollbackSnapshot(implementationResult.snapshotId!)}
                      disabled={isRollingBack}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-200 text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <Undo2 className="w-3.5 h-3.5 text-rose-400" />
                      {isRollingBack ? '復元中...' : '直前のスナップショットにロールバック'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* スナップショット履歴＆ロールバックマネージャー */}
          {snapshotsList.length > 0 && (
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
              <h5 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <History className="w-4 h-4 text-purple-400" />
                安全バックアップ・スナップショット履歴 ({snapshotsList.length} 件)
              </h5>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {snapshotsList.map((s) => (
                  <div
                    key={s.id}
                    className="p-2.5 bg-black/50 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-mono text-slate-200 text-[11px] truncate flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span>{s.filePath}</span>
                        <span className="text-[10px] text-slate-500">({s.sizeBytes} B)</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{s.message}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(s.timestamp).toLocaleTimeString()}
                      </span>
                      <button
                        onClick={() => handleRollbackSnapshot(s.id)}
                        disabled={isRollingBack}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-800 text-[11px] rounded-lg flex items-center gap-1 transition-all"
                      >
                        <Undo2 className="w-3 h-3 text-rose-400" />
                        復元
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 0.2 コードベース ASTシンボル地図 (タブ2) ── */}
      {activeTab === 'repo_navigator' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-sky-400" />
                  コードベース ASTシンボル地図 (Repo Map Navigator)
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  プロジェクト全体のファイルと、そこにエクスポートされているクラス・関数・インターフェース定義を高速走査してインデックス化。みき自身が「どこを変更すべきか」を一瞬で逆引きできます。
                </p>
              </div>
              <button
                onClick={loadRepoMap}
                disabled={isLoadingRepoMap}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRepoMap ? 'animate-spin text-sky-400' : ''}`} />
                {isLoadingRepoMap ? '走査中...' : '再スキャン'}
              </button>
            </div>

            {/* 検索・絞り込みバー */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={repoSearchKeyword}
                  onChange={(e) => setRepoSearchKeyword(e.target.value)}
                  placeholder="ファイル名、クラス名、関数名で絞り込み (例: ChatPanel, cache, memory)..."
                  className="w-full pl-9 pr-3 py-2 bg-black/60 border border-slate-800 focus:border-sky-500 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                />
              </div>
              {repoMapData && (
                <div className="text-[11px] font-mono text-slate-400 px-3 py-1.5 bg-slate-800/80 rounded-xl shrink-0">
                  {repoMapData.scannedFilesCount} ファイル / {repoMapData.totalSymbolsCount} シンボル
                </div>
              )}
            </div>

            {/* シンボル一覧リスト */}
            {isLoadingRepoMap ? (
              <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                AST構文ツリーからリポジトリマップを構築中...
              </div>
            ) : repoMapData ? (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {repoMapData.entries
                  .filter((entry) => {
                    if (!repoSearchKeyword) return true;
                    const kw = repoSearchKeyword.toLowerCase();
                    return (
                      entry.file.toLowerCase().includes(kw) ||
                      entry.symbols.some((s) => s.name.toLowerCase().includes(kw))
                    );
                  })
                  .map((entry, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-black/50 border border-slate-800 hover:border-sky-900/60 rounded-xl space-y-2 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-mono text-xs text-sky-300 font-bold flex items-center gap-1.5 truncate">
                          <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span className="truncate">{entry.file}</span>
                        </div>
                        <button
                          onClick={() => {
                            setTargetFileHint(entry.file);
                            setImplementPrompt(`${entry.file} に対する機能拡張・改善`);
                            setActiveTab('auto_implement');
                          }}
                          className="px-2.5 py-1 bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-800/60 rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0 transition-all"
                        >
                          <Rocket className="w-3 h-3" />
                          このファイルを自律実装
                        </button>
                      </div>

                      {/* シンボルバッジ一覧 */}
                      <div className="flex flex-wrap gap-1.5">
                        {entry.symbols.map((sym, sIdx) => {
                          const isClass = sym.kind === 'class';
                          const isInterface = sym.kind === 'interface';
                          const isFunction = sym.kind === 'function';

                          return (
                            <span
                              key={sIdx}
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                isClass
                                  ? 'bg-purple-950/70 border-purple-800/60 text-purple-300'
                                  : isInterface
                                  ? 'bg-blue-950/70 border-blue-800/60 text-blue-300'
                                  : isFunction
                                  ? 'bg-emerald-950/70 border-emerald-800/60 text-emerald-300'
                                  : 'bg-slate-800 border-slate-700 text-slate-300'
                              }`}
                            >
                              <span className="text-[9px] opacity-70 uppercase">{sym.kind}</span>
                              <span className="font-bold">{sym.name}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500">
                リポジトリマップが読み込まれていません。「再スキャン」ボタンを押してください。
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* ── 6. ネット大海コード発掘 (第171章) ── */}
      {activeTab === 'web_excavator' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  ネット大海探索・自律コード発掘 (第171章)
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  モデル生成系ランタイム が GitHub、NPM、技術Wikiからアルゴリズム・型定義を発掘し、高密度ASTスライスに整形します
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 rounded-lg">
                AST LEAN SLICE ENGINE
              </span>
            </div>

            {/* クイックキーワードタグ */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                'AST parser recursive descent',
                'LRU Cache TypeScript',
                'Token Bucket Rate Limiter',
                'Levenshtein Distance Algorithm',
                'Graph Topological Sort',
              ].map((kw) => (
                <button
                  key={kw}
                  onClick={() => {
                    setSearchQuery(kw);
                  }}
                  className="px-2.5 py-1 text-[11px] font-mono bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/60 transition-colors"
                >
                  #{kw}
                </button>
              ))}
            </div>

            {/* 検索入力フォーム */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="検索したいアルゴリズム、ライブラリ、コードパターンを入力..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearchCode();
                  }}
                />
              </div>

              <select
                value={searchLanguage}
                onChange={(e) => setSearchLanguage(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="rust">Rust</option>
              </select>

              <button
                onClick={handleSearchCode}
                disabled={isSearchingCode}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 min-w-[120px]"
              >
                <Search className={`w-3.5 h-3.5 ${isSearchingCode ? 'animate-spin' : ''}`} />
                {isSearchingCode ? '発掘中...' : 'ネット探索実行'}
              </button>
            </div>

            {searchNotice && (
              <div className="p-2.5 bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs rounded-xl">
                {searchNotice}
              </div>
            )}
          </div>

          {/* 検索結果スニペット一覧 */}
          {searchResult && (
            <div className="space-y-4">
              {/* サマリーバー */}
              <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-200">
                    発掘サマリー: {searchResult.snippets.length} 件のコードパターンを特定
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {new Date(searchResult.searchedAt).toLocaleTimeString()} 発掘完了
                </span>
              </div>

              {/* 提案された動的ツール */}
              {searchResult.suggestedTools && searchResult.suggestedTools.length > 0 && (
                <div className="p-3.5 bg-purple-950/20 border border-purple-800/40 rounded-2xl space-y-2">
                  <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-purple-400" />
                    発掘コードに基づく推奨ツール候補 (ワンクリックで創成可能):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {searchResult.suggestedTools.map((tool, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-black/40 border border-purple-900/30 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-200">{tool.name}</div>
                          <div className="text-[11px] text-slate-400">{tool.description}</div>
                        </div>
                        <button
                          onClick={() => {
                            setToolFeatureName(tool.name);
                            setToolDescription(tool.description);
                            setActiveTab('tool_workshop');
                          }}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-lg shadow transition-colors shrink-0 ml-2"
                        >
                          工房へ転送
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* スニペットカード */}
              <div className="space-y-3">
                {searchResult.snippets.map((snip) => (
                  <div
                    key={snip.id}
                    className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-cyan-300">{snip.title}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md">
                          {snip.sourceType.toUpperCase()}
                        </span>
                        {snip.stars !== undefined && (
                          <span className="text-[10px] text-amber-300 font-mono">
                            ★ {snip.stars.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={snip.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                        >
                          出典
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          onClick={() => {
                            setSuggestedSnippetCode(snip.code);
                            setToolFeatureName(snip.title.split(/[/:]/).pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'HelperTool');
                            setActiveTab('tool_workshop');
                          }}
                          className="px-2 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 text-[11px] font-bold rounded-lg border border-cyan-500/40 transition-colors flex items-center gap-1"
                        >
                          <Wrench className="w-3 h-3" />
                          ツール化
                        </button>
                      </div>
                    </div>

                    {snip.description && (
                      <div className="text-[11px] text-slate-400">{snip.description}</div>
                    )}

                    <pre className="p-3 bg-black/80 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800 max-h-48">
                      {codeSearchService.sliceToLeanAst(snip.code, 25)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 7. 動的ツール創成工房 & サンドボックス実行 (第171章 & 第172章) ── */}
      {activeTab === 'tool_workshop' && (
        <div className="space-y-6">
          {/* ツール自動合成フォーム */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-emerald-400" />
                  自律動的ツール創成工房 (第171章)
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  モデル生成系ランタイム が機能要件から安全な動的ツールコードを合成し、第169章サンドボックスで即座に配備します
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 rounded-lg">
                LEVEL 1 SANDBOX ISOLATION
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 mb-1 block">ツール機能名:</label>
                <input
                  type="text"
                  value={toolFeatureName}
                  onChange={(e) => setToolFeatureName(e.target.value)}
                  placeholder="例: StringCompressor, AstInspector..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 mb-1 block">引数パラメータ名:</label>
                <input
                  type="text"
                  value={toolParamQuery}
                  onChange={(e) => setToolParamQuery(e.target.value)}
                  placeholder="例: payload, query, data..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 mb-1 block">ツールの目的・処理仕様:</label>
              <input
                type="text"
                value={toolDescription}
                onChange={(e) => setToolDescription(e.target.value)}
                placeholder="例: データの型チェックと正規化を行い、エラーを防止する"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={handleSynthesizeTool}
                disabled={isSynthesizingTool}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isSynthesizingTool ? 'animate-spin' : ''}`} />
                {isSynthesizingTool ? '安全合成・サンドボックス検証中...' : 'モデル生成系ランタイム で動的ツールを自動創成'}
              </button>
            </div>

            {toolWorkshopNotice && (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl">
                {toolWorkshopNotice}
              </div>
            )}
          </div>

          {/* 稼働中の動的ツール管理 & サンドボックス実行テスト */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 左側: 稼働中ツール一覧 */}
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  稼働中の動的ツール一覧 ({dynamicToolsList.length} 件)
                </div>
                <button
                  onClick={refreshDynamicToolsList}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  更新
                </button>
              </div>

              {dynamicToolsList.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  現在登録されている動的ツールはありません。「モデル生成系ランタイム で動的ツールを自動創成」または「ネット大海発掘」から作成できます。
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {dynamicToolsList.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedToolToTest(t.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        selectedToolToTest === t.id
                          ? 'bg-emerald-950/40 border-emerald-500/50'
                          : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-200">{t.name}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-900/50 text-emerald-300 rounded border border-emerald-700/40">
                            {t.dynamicSandboxLevel || 'LEVEL_1'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDynamicTool(t.id);
                            }}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                            title="ツールを削除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">{t.description}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">
                        実行回数: {t.executionCount || 0}回 • 作成元: {t.createdBy || 'QWEN_3B'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 右側: リアルタイムサンドボックス実行テスト */}
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  サンドボックス安全実行テスト
                </div>
                {selectedToolToTest && (
                  <span className="text-[10px] font-mono text-cyan-400">
                    対象: {selectedToolToTest}
                  </span>
                )}
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 mb-1 block">
                  入力引数 (JSON形式または文字列):
                </label>
                <textarea
                  value={toolTestInput}
                  onChange={(e) => setToolTestInput(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleTestDynamicTool}
                  disabled={isTestingTool || !selectedToolToTest}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${isTestingTool ? 'animate-spin' : ''}`} />
                  {isTestingTool ? '実行中...' : 'サンドボックスでテスト実行'}
                </button>
              </div>

              {toolTestOutput && (
                <div className="p-3 bg-black/80 border border-slate-800 rounded-xl space-y-1.5 font-mono text-[11px]">
                  <div className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    実行時間: {toolTestOutput.executionTimeMs}ms
                  </div>
                  <div className="text-slate-300">
                    概要: {toolTestOutput.outputSummary}
                  </div>
                  <pre className="text-slate-400 text-[10px] overflow-x-auto p-1.5 bg-slate-950 rounded">
                    {JSON.stringify(toolTestOutput.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* セクション3: 第172章 決定論的自己改善ループ & 自律Web進化統合サイクル */}
          <div className="p-4 bg-slate-900/80 border border-purple-900/40 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Dna className="w-4 h-4 text-purple-400" />
                  決定論的自己改善ループ & 自律Web進化サイクル (第172章)
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  ネット探索 ➔ 不足ツール創成 ➔ 自己改善コードパッチ ➔ 変異体キル検証 ➔ カナリア配備を一貫自動実行
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-purple-950/80 text-purple-300 border border-purple-500/40 rounded-lg">
                END-TO-END AUTONOMOUS EVOLUTION
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={autoEvolveTopic}
                onChange={(e) => setAutoEvolveTopic(e.target.value)}
                placeholder="改善したいテーマ (例: 高速ASTパース、インメモリLRUキャッシュ)..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleRunAutoEvolve}
                disabled={isRunningAutoEvolve}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 min-w-[140px]"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isRunningAutoEvolve ? 'animate-spin' : ''}`} />
                {isRunningAutoEvolve ? '自律進化サイクル実行中...' : '自律自己改善を実行'}
              </button>
            </div>

            {autoEvolveResult && (
              <div className="p-4 bg-black/60 border border-purple-900/30 rounded-xl space-y-3">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {autoEvolveResult.summary}
                </div>

                {/* ステップ一覧 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {autoEvolveResult.steps.map((st, i) => (
                    <div key={i} className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 text-[11px] space-y-1">
                      <div className="font-bold text-slate-200 flex items-center justify-between">
                        <span>{st.step}</span>
                        <span className="text-[10px] font-mono text-emerald-400">SUCCESS</span>
                      </div>
                      <div className="text-slate-400 text-[10px]">{st.detail}</div>
                    </div>
                  ))}
                </div>

                {/* 生成パッチ差分 */}
                <div>
                  <div className="text-[11px] font-mono text-slate-400 mb-1">
                    生成・検証済み Aider Search/Replace 改善パッチ:
                  </div>
                  <pre className="p-3 bg-black/90 rounded-xl font-mono text-[11px] text-emerald-300 overflow-x-auto border border-purple-900/40">
                    {autoEvolveResult.patchPreview}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
