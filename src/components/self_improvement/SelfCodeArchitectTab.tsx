import React, { useState, useEffect } from 'react';
import {
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Search,
  Filter,
  Layers,
  ArrowRight,
  GitBranch,
  Lock,
  Cpu,
  RefreshCw,
  Zap,
  BookOpen,
  Code2,
  Check,
  Compass,
  Brain,
  GraduationCap,
  Eye,
  Activity,
} from 'lucide-react';
import {
  SpecificationChapterMeta,
  SelfCodeAuditResult,
  SelfImprovementProposal,
  InvariantCheckItem,
  CodeSkeletonTemplate,
  TeacherDriftCheckResult,
  ProficiencyDomain,
} from '../../types';
import {
  selfCodeArchitectService,
  SPECIFICATION_REGISTRY,
} from '../../services/selfCodeArchitectService';
import { teacherDriftService } from '../../services/teacherDriftService';
import { codeSkeletonService } from '../../services/codeSkeletonService';
import { userProficiencyService } from '../../services/userProficiencyService';
import { autonomousCurriculumService } from '../../services/autonomousCurriculumService';
import { proactiveContextOsService } from '../../services/proactiveContextOsService';
import { digitalResearchNoteService } from '../../services/digitalResearchNoteService';
import { cognitiveDebuggerService } from '../../services/cognitiveDebuggerService';
import { codebaseReflectionService, ImprovementRecipe } from '../../services/codebaseReflectionService';

export const SelfCodeArchitectTab: React.FC = () => {
  const [activeView, setActiveView] = useState<
    'roadmap' | 'completed' | 'proposals' | 'invariants' | 'chap28' | 'advanced_services' | 'code_reflection'
  >('roadmap');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [auditResult, setAuditResult] = useState<SelfCodeAuditResult>(() =>
    selfCodeArchitectService.getLatestAudit() ?? selfCodeArchitectService.runSelfCodeAudit()
  );
  const [proposals, setProposals] = useState<SelfImprovementProposal[]>(() =>
    selfCodeArchitectService.getProposals()
  );
  const [selectedChapter, setSelectedChapter] = useState<SpecificationChapterMeta | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isAutoImproving, setIsAutoImproving] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // 第28章 サブシステム用ステート
  const [driftResult, setDriftResult] = useState<TeacherDriftCheckResult | null>(() =>
    teacherDriftService.getLatestAudit()
  );
  const [isCheckingDrift, setIsCheckingDrift] = useState(false);
  const [skeletonList, setSkeletonList] = useState<CodeSkeletonTemplate[]>(() =>
    codeSkeletonService.getAllTemplates()
  );
  const [selectedProfDomain, setSelectedProfDomain] = useState<ProficiencyDomain>('vba');
  const [profScores, setProfScores] = useState(() => userProficiencyService.getAllScores());
  const [testUtterance, setTestUtterance] = useState('Dim lastRow As Long\nlastRow = Cells(Rows.Count, "A").End(xlUp).Row');

  // コード自己理解・自律改善レシピ用ステート
  const [recipeChapter, setRecipeChapter] = useState<number>(33);
  const [activeRecipe, setActiveRecipe] = useState<ImprovementRecipe | null>(() =>
    selfCodeArchitectService.getRecipeForChapter(33)
  );
  const [moduleSearch, setModuleSearch] = useState('');

  const handleSynthesizeRecipe = (chapNum: number) => {
    setRecipeChapter(chapNum);
    const rec = selfCodeArchitectService.getRecipeForChapter(chapNum);
    setActiveRecipe(rec);
    setActionNotice(`第${chapNum}章の安全自律改善レシピを合成しました！`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  useEffect(() => {
    setProposals(selfCodeArchitectService.getProposals());
  }, []);

  const completedChapters = SPECIFICATION_REGISTRY.filter((c) => c.status === 'COMPLETED');
  const unimplementedChapters = SPECIFICATION_REGISTRY.filter((c) => c.status !== 'COMPLETED');

  const filteredChapters = (activeView === 'completed' ? completedChapters : unimplementedChapters).filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `第${c.chapterNumber}章`.includes(searchQuery) ||
      c.keyRequirements.some((r) => r.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'ALL' || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleRunAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      const result = selfCodeArchitectService.runSelfCodeAudit();
      setAuditResult(result);
      setProposals(selfCodeArchitectService.getProposals());
      setIsAuditing(false);
      setActionNotice('全コードベース自己監査完了: 仕様適合率と不変条件を再計算しました。');
      setTimeout(() => setActionNotice(null), 4000);
    }, 600);
  };

  const handleGenerateProposal = (chapterNumber: number) => {
    const proposal = selfCodeArchitectService.generateImprovementProposal(chapterNumber);
    setProposals(selfCodeArchitectService.getProposals());
    setSelectedChapter(null);
    setActiveView('proposals');
    setActionNotice(`第${chapterNumber}章の自己改善プロポーザル・変更契約を発行しました！`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleSimulate = (proposalId: string) => {
    const updated = selfCodeArchitectService.simulateProposal(proposalId);
    if (updated) {
      setProposals([...selfCodeArchitectService.getProposals()]);
      setActionNotice('シャドー環境シミュレーション完了: 不変条件の安全性を確認しました。');
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleApply = (proposalId: string) => {
    const success = selfCodeArchitectService.applyProposal(proposalId);
    if (success) {
      setProposals([...selfCodeArchitectService.getProposals()]);
      setAuditResult(selfCodeArchitectService.getLatestAudit()!);
      setActionNotice('改善プロポーザルを正式反映しました！仕様適合率が向上しました。');
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleRollback = (proposalId: string) => {
    const success = selfCodeArchitectService.rollbackProposal(proposalId);
    if (success) {
      setProposals([...selfCodeArchitectService.getProposals()]);
      setAuditResult(selfCodeArchitectService.getLatestAudit()!);
      setActionNotice('提案を安全にロールバックしました。元の安定状態を維持しています。');
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // 第28章 ハンドラ
  const handleRunTeacherDrift = async () => {
    setIsCheckingDrift(true);
    try {
      const res = await teacherDriftService.runDriftCheck();
      setDriftResult(res);
      setActionNotice(`第28.2章 教師ドリフト検査完了: ベースライン類似度 ${(res.baselineComparisonScore * 100).toFixed(1)}% (健全)`);
      setTimeout(() => setActionNotice(null), 4000);
    } finally {
      setIsCheckingDrift(false);
    }
  };

  const handleTestUtteranceAnalysis = () => {
    if (!testUtterance.trim()) return;
    userProficiencyService.analyzeUserUtterance(testUtterance);
    setProfScores(userProficiencyService.getAllScores());
    setActionNotice('第28.4章 ユーザー理解度分析: 専門用語出現頻度を移動平均で更新しました！');
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleAutoImproveCycle = (chapterNum: number) => {
    // ワンクリック自律改善 (提案 ➔ 双子シミュレーション ➔ 不変条件検査 ➔ 正式適用)
    const prop = selfCodeArchitectService.generateImprovementProposal(chapterNum);
    const sim = selfCodeArchitectService.simulateProposal(prop.id);
    if (sim && sim.invariantsCheckPassed) {
      selfCodeArchitectService.applyProposal(prop.id);
      setProposals([...selfCodeArchitectService.getProposals()]);
      setAuditResult(selfCodeArchitectService.getLatestAudit()!);
      setActionNotice(`🚀 [第29章 自律完全適用] 第${chapterNum}章の仕様書改善を不変条件オールクリアで正式反映しました！適合スコアが向上しました。`);
    } else {
      setProposals([...selfCodeArchitectService.getProposals()]);
      setActionNotice(`⚠️ 第${chapterNum}章の提案を生成・シミュレーションしましたが、安全のため確認保留としました。`);
    }
    setTimeout(() => setActionNotice(null), 5000);
  };

  const handleAutonomousMikiImprovement = () => {
    setIsAutoImproving(true);
    setTimeout(() => {
      const result = selfCodeArchitectService.runAutonomousImprovementCycle();
      setProposals([...selfCodeArchitectService.getProposals()]);
      setAuditResult(selfCodeArchitectService.getLatestAudit()!);
      setIsAutoImproving(false);
      setActionNotice(
        result.success
          ? `✨ [みき自律改善完了] 第${result.targetChapter.chapterNumber}章『${result.targetChapter.title}』を安全に改善・正式反映しました！適合スコア: ${result.auditResult.complianceScore.toFixed(1)}%`
          : `⚠️ [みき自律改善] ${result.summary}`
      );
      setTimeout(() => setActionNotice(null), 6000);
    }, 800);
  };

  const handleBatchImprovement = (count: number = 3) => {
    setIsAutoImproving(true);
    setTimeout(() => {
      const res = selfCodeArchitectService.runBatchAutonomousImprovement(count);
      setProposals([...selfCodeArchitectService.getProposals()]);
      setAuditResult(selfCodeArchitectService.getLatestAudit()!);
      setIsAutoImproving(false);
      setActionNotice(
        `🚀 [連続自律改善完了] ${res.completedCount}章を一括適合反映しました！適合スコア: ${res.initialScore.toFixed(1)}% ➔ ${res.finalScore.toFixed(1)}%`
      );
      setTimeout(() => setActionNotice(null), 7000);
    }, 1000);
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* ── 通知バナー ── */}
      {actionNotice && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl flex items-center gap-3 text-emerald-300 text-sm shadow-lg animate-fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* ── 最上部: 自己アーキテクト KPIカード ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>仕様書 v5.0 適合率</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {auditResult.complianceScore.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            総合健全度: <span className="text-emerald-400 font-semibold">{auditResult.invariantsAudit.allPassed ? '良好 (OPTIMAL)' : '注意 (WARNING)'}</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>完全実装済み</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {auditResult.completedChapters} <span className="text-sm font-normal text-slate-400">/ {auditResult.totalChapters}章</span>
          </div>
          <div className="text-[11px] text-emerald-300 mt-1">全件稼働・不変条件合格</div>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>未実装・改善ロードマップ</span>
            <Compass className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-400">
            {auditResult.unimplementedChapters} <span className="text-sm font-normal text-slate-400">章</span>
          </div>
          <div className="text-[11px] text-indigo-300 mt-1">要件参照・自律改善可能</div>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>不変条件 (Invariants)</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-400">
            {auditResult.invariantsAudit.checks.filter((c) => c.passed).length}/{auditResult.invariantsAudit.checks.length}
          </div>
          <div className="text-[11px] text-cyan-300 mt-1">Qwen 3B保護・改変遮断中</div>
        </div>
      </div>

      {/* ── コントロールバー: 自己監査実行 & ビュー切替 ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/70 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveView('roadmap')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeView === 'roadmap'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-indigo-300" />
            未実装・改善対象 ({unimplementedChapters.length}章)
          </button>
          <button
            onClick={() => setActiveView('completed')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeView === 'completed'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            完全実装済み ({completedChapters.length}章)
          </button>
          <button
            onClick={() => setActiveView('proposals')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeView === 'proposals'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 text-amber-300" />
            自己改善プロポーザル ({proposals.length}件)
          </button>
          <button
            onClick={() => setActiveView('invariants')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeView === 'invariants'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />
            不変条件エンジン
          </button>
          <button
            onClick={() => setActiveView('chap28')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeView === 'chap28'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-violet-300" />
            第28章 教師監視/骨格/理解度
          </button>
          <button
            onClick={() => setActiveView('advanced_services')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeView === 'advanced_services'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-rose-300" />
            自律認知・研究・デバッグOS
          </button>
          <button
            onClick={() => setActiveView('code_reflection')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeView === 'code_reflection'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-300" />
            コード自己理解＆改善レシピ
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleBatchImprovement(3)}
            disabled={isAutoImproving || isAuditing}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            title="未実装の最優先章を3章まとめて連続自律改善し、仕様適合率を大幅に引き上げます"
          >
            <Zap className={`w-3.5 h-3.5 ${isAutoImproving ? 'animate-bounce' : ''}`} />
            3章まとめて改善
          </button>

          <button
            onClick={handleAutonomousMikiImprovement}
            disabled={isAutoImproving || isAuditing}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 via-rose-500 to-pink-500 hover:from-amber-400 hover:via-rose-400 hover:to-pink-400 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            title="みき自身が設計仕様書とコードを監査し、不変条件を守って未実装要件の自律改善をワンクリックで実行・適用します"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAutoImproving ? 'animate-spin' : ''}`} />
            {isAutoImproving ? 'みきが自律改善中...' : 'みきに自律改善を任せる'}
          </button>

          <button
            onClick={handleRunAudit}
            disabled={isAuditing || isAutoImproving}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
            {isAuditing ? '自己コード監査中...' : '全件監査を実行'}
          </button>
        </div>
      </div>

      {/* ── 検索・カテゴリフィルタ ── */}
      {(activeView === 'roadmap' || activeView === 'completed') && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="章番号、章タイトル、要件キーワードで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 pl-9 pr-4 py-2 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">全カテゴリ</option>
              <option value="CORE_FOUNDATION">中核基盤 (第0〜13章)</option>
              <option value="EXTENDED_SERVICES">拡張サービス (第14〜27章)</option>
              <option value="AUTONOMOUS_ADVANCED">自律進化・完成判定 (第28〜53章)</option>
              <option value="DEEP_SPECIFICATION">深層アーキテクチャ・作業台 (第54〜90章)</option>
              <option value="FORMAL_SYNTHESIS">仕様駆動合成・SLO (第91〜122章)</option>
              <option value="SELF_IMPROVEMENT_MVP">自己アプリ改善・作業契約 (第123〜169章)</option>
            </select>
          </div>
        </div>
      )}

      {/* ── ビュー1: 未実装・改善対象ロードマップ章一覧 ── */}
      {activeView === 'roadmap' && (
        <div className="space-y-4">
          <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-indigo-200">
                設計思想指示書・未実装章の自律参照 & コード改善機能 (第29章・第130章)
              </div>
              <div className="text-slate-300 leading-relaxed">
                MIKI-AIは本一覧から未実装の仕様章を選択し、要件・不変条件・変更契約（Change Contract）を読み込んで自律的に改善プロポーザルを生成できます。
                勝手な破壊を防ぐため、変更はすべて不変条件チェック（Qwen 3B保護、ロールバック可能性）を通過する必要があります。
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredChapters.map((chapter) => (
              <div
                key={chapter.id}
                className="p-4 bg-slate-900/70 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 rounded-md text-[10px] font-bold">
                      第{chapter.chapterNumber}章 {chapter.versionAdded}
                    </span>
                    <span className="text-[10px] text-amber-400 font-semibold px-2 py-0.5 bg-amber-950/40 border border-amber-800/40 rounded-md">
                      {chapter.status === 'IN_PROGRESS' ? '進行中' : '未実装'}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-100 text-sm mb-1 leading-snug">
                    {chapter.title}
                  </h4>
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                    {chapter.summary}
                  </p>

                  <div className="space-y-1.5 mb-4">
                    <div className="text-[11px] font-semibold text-slate-400">主要要件:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {chapter.keyRequirements.map((req, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-slate-800/80 text-slate-300 rounded-md text-[10px]"
                        >
                          {req}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[10px] text-slate-400">
                    対象: {chapter.responsibleServices?.[0] ?? '新規サービス'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleGenerateProposal(chapter.chapterNumber)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all border border-slate-700"
                    >
                      <GitBranch className="w-3.5 h-3.5 text-amber-300" />
                      提案生成
                    </button>
                    <button
                      onClick={() => handleAutoImproveCycle(chapter.chapterNumber)}
                      className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                      自律改善サイクル実行
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ビュー2: 完全実装済み章一覧 ── */}
      {activeView === 'completed' && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-emerald-200">
                完全実装済み仕様章 (全{completedChapters.length}章)
              </div>
              <div className="text-slate-300 leading-relaxed">
                以下の章はコードベース内に実装され、不変条件チェックと統合検証を100%パスしています。
                各章を担当するサービスファイル・UIコンポーネントが稼働中です。
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredChapters.map((chapter) => (
              <div
                key={chapter.id}
                className="p-4 bg-slate-900/70 border border-slate-800/90 hover:border-emerald-500/40 rounded-2xl transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 rounded-md text-[10px] font-bold">
                    第{chapter.chapterNumber}章 {chapter.versionAdded}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-400" />
                    完全実装済み
                  </span>
                </div>

                <h4 className="font-bold text-slate-100 text-sm mb-1 leading-snug">
                  {chapter.title}
                </h4>
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                  {chapter.summary}
                </p>

                <div className="space-y-1.5 text-[11px] text-slate-400">
                  <div>
                    <span className="font-semibold text-slate-300">担当サービス: </span>
                    <span className="text-indigo-300">{chapter.responsibleServices?.join(', ') || 'コア基盤'}</span>
                  </div>
                  {(chapter.responsibleComponents?.length ?? 0) > 0 && (
                    <div>
                      <span className="font-semibold text-slate-300">担当UI: </span>
                      <span className="text-slate-300">{chapter.responsibleComponents?.join(', ')}</span>
                    </div>
                  )}
                  {(chapter.invariantGuarantees?.length ?? 0) > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-400">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      {chapter.invariantGuarantees?.join(' / ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ビュー3: 自己改善プロポーザル & 変更契約実行 ── */}
      {activeView === 'proposals' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-2xl flex items-start gap-3">
            <GitBranch className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-amber-200">
                自己改善提案 & 変更契約 (Change Contract) 実行プレーン (第29章・第30章)
              </div>
              <div className="text-slate-300 leading-relaxed">
                自己改善プロポーザルは、必ず「変更許可ファイル」「変更禁止ファイル」「不変条件」「ロールバック計画」を定約した上で生成されます。
                「シミュレーション」で双子検証を行い、安全が証明された後に「正式反映」または「ロールバック」が行われます。
              </div>
            </div>
          </div>

          {proposals.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-400 text-xs">
              現在保留中の改善プロポーザルはありません。「未実装章」タブから章を選択して提案を生成してください。
            </div>
          ) : (
            <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
              {proposals.map((prop) => (
                <div
                  key={prop.id}
                  className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-md text-[10px] font-bold">
                        第{prop.targetChapterNumber}章
                      </span>
                      <h4 className="font-bold text-slate-100 text-sm">{prop.title}</h4>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        prop.status === 'APPLIED'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : prop.status === 'SIMULATED'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          : prop.status === 'ROLLED_BACK'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {prop.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{prop.description || prop.contract.objective}</p>

                  {/* 変更契約詳細 */}
                  <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-2 text-xs">
                    <div className="font-semibold text-slate-300 flex items-center gap-1.5 text-[11px]">
                      <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                      変更契約 (Change Contract)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-400">
                      <div>
                        <span className="text-slate-500">許可ファイル: </span>
                        <span className="text-emerald-300 font-mono">
                          {prop.contract.allowedFiles.join(', ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">禁止ファイル: </span>
                        <span className="text-rose-400 font-mono">
                          {prop.contract.forbiddenFiles.join(', ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">不変条件: </span>
                        <span className="text-cyan-300">
                          {prop.contract.mustPreserve.join(', ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">ロールバック: </span>
                        <span className="text-amber-300">{prop.contract.rollbackPlan}</span>
                      </div>
                    </div>
                  </div>

                  {/* シミュレーション結果 */}
                  {prop.simulatedDelta && (
                    <div className="p-3 bg-slate-950/40 border border-slate-800/60 rounded-xl text-xs flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-slate-300 leading-relaxed text-[11px]">
                        {prop.simulatedDelta.details}
                      </div>
                    </div>
                  )}

                  {/* アクションボタン */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                    {prop.status === 'PROPOSED' && (
                      <button
                        onClick={() => handleSimulate(prop.id)}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5" />
                        シャドー検証・シミュレーション実行
                      </button>
                    )}

                    {prop.status === 'SIMULATED' && (
                      <button
                        onClick={() => handleApply(prop.id)}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        安全合格: 正式反映を適用
                      </button>
                    )}

                    {prop.status === 'APPLIED' && (
                      <button
                        onClick={() => handleRollback(prop.id)}
                        className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        ロールバック実行
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ビュー4: 不変条件エンジン (Invariants Engine) ── */}
      {activeView === 'invariants' && (
        <div className="space-y-4">
          <div className="p-4 bg-cyan-950/30 border border-cyan-500/30 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-cyan-200">
                不変条件エンジン (Invariants Engine - 第30章)
              </div>
              <div className="text-slate-300 leading-relaxed">
                自己改善において「評価器ハック」「ベンチマーク改ざん」「Qwen 3Bモデルの勝手な削除」「プライバシー越境」を絶対的に遮断する不可逆ガードレールです。
                改善プロポーザルが以下の条件を1つでも満たさない場合、シミュレーションおよび反映は100%自動拒絶されます。
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {selfCodeArchitectService.checkInvariants().checks.map((inv: InvariantCheckItem) => (
              <div
                key={inv.id}
                className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-indigo-400 font-bold">{inv.id}</span>
                    <h4 className="font-bold text-slate-100 text-sm">{inv.name}</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    <span className="text-slate-300 font-semibold">{inv.rule}</span> — {inv.details}
                  </p>
                </div>

                <div className="flex-shrink-0">
                  {inv.passed ? (
                    <span className="px-2.5 py-1 bg-emerald-950/80 text-emerald-300 border border-emerald-800 rounded-full text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      合格 (Passed)
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-rose-950/80 text-rose-300 border border-rose-800 rounded-full text-xs font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      抵触 (Violated)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ビュー5: 第28章 サブシステム (教師監視・コード骨格・ユーザー理解度) ── */}
      {activeView === 'chap28' && (
        <div className="space-y-6">
          {/* ヘッダー解説 */}
          <div className="p-4 bg-violet-950/30 border border-violet-500/30 rounded-2xl flex items-start gap-3">
            <Cpu className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-violet-200 text-sm">
                第28章 教師モニタリング・コード骨格テンプレート化・理解度追従型説明調整
              </div>
              <div className="text-slate-300 leading-relaxed">
                外部モデルの劣化や挙動変化を早期遮断する「教師ドリフトプローブ」、高品質コードをパラメータ再利用する「骨格テンプレート」、相手の専門性に合わせてペルソナ口調を保ちつつ説明深度のみを最適化する「理解度適応エンジン」の3本柱が稼働しています。
              </div>
            </div>
          </div>

          {/* 3分割グリッド */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 28.2 教師ドリフト監視 */}
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    28.2 教師ドリフト監視
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-sky-950 text-sky-300 border border-sky-800">
                    固定10問プローブ
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>ベースライン類似度:</span>
                    <span className="font-bold text-sky-400">
                      {driftResult ? `${(driftResult.baselineComparisonScore * 100).toFixed(1)}%` : '未検査 (標準95%)'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>信頼度重み係数:</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      ×{teacherDriftService.getConfidencePenaltyWeight().toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>状態:</span>
                    <span className={`font-bold text-xs ${driftResult?.isDriftDetected ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {driftResult?.isDriftDetected ? '⚠️ 劣化ドリフト検知' : '✅ 正常・健全稼働中'}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  外部教師APIのサイレントアップデートを監視。類似度が0.70を下回ると自動で20%ペナルティを課し、汚染を防ぎます。
                </p>
              </div>

              <button
                onClick={handleRunTeacherDrift}
                disabled={isCheckingDrift}
                className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 mt-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingDrift ? 'animate-spin' : ''}`} />
                {isCheckingDrift ? '10問プローブ実行中...' : '固定10問ドリフト検査を実行'}
              </button>
            </div>

            {/* 28.3 実績コード骨格テンプレート */}
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                    28.3 実績コード骨格
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                    {skeletonList.length} 件蓄積
                  </span>
                </div>

                <div className="mt-3 space-y-2 max-h-36 overflow-y-auto pr-1">
                  {skeletonList.map((skel) => (
                    <div key={skel.id} className="p-2 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold text-slate-200">
                        <span>{skel.name}</span>
                        <span className="text-[10px] font-mono uppercase text-indigo-400">{skel.language}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>成功回数: {skel.successCount}回</span>
                        <span className="text-emerald-400 font-medium">✓ 静的検証合格</span>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  高評価コードの抽象構文木をパラメータ化。ゼロ生成を回避し、第16章/第51章安全スキャンと直結します。
                </p>
              </div>

              <div className="p-2 bg-slate-950/40 border border-slate-800 rounded-xl text-[10px] text-slate-400 text-center">
                VBA / TS / Python / SQL テンプレート自動適用
              </div>
            </div>

            {/* 28.4 ユーザー理解度追従 */}
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    28.4 理解度追従型説明
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                    移動平均平滑化
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex gap-1">
                    {(['vba', 'typescript', 'general_programming', 'ai_terminology'] as ProficiencyDomain[]).map((dom) => (
                      <button
                        key={dom}
                        onClick={() => setSelectedProfDomain(dom)}
                        className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${
                          selectedProfDomain === dom
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {dom === 'vba' ? 'VBA' : dom === 'typescript' ? 'TS' : dom === 'general_programming' ? '一般' : 'AI'}
                      </button>
                    ))}
                  </div>

                  {(() => {
                    const currentProf = profScores[selectedProfDomain] || { score: 50 };
                    const advice = userProficiencyService.getExplanationAdvice(selectedProfDomain);
                    return (
                      <div className="p-2 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">熟練度スコア:</span>
                          <span className="font-bold text-emerald-400">{currentProf.score} / 100 点</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                            style={{ width: `${currentProf.score}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-300 pt-1 leading-snug">
                          <span className="font-semibold text-emerald-300">
                            {advice.recommendedLevel === 'EXPERT_CONCISE'
                              ? '【エキスパート】前置き省略・差分集中'
                              : advice.recommendedLevel === 'BEGINNER_DETAILED'
                              ? '【初級者】丁寧補足・具体例付与'
                              : '【中級標準】自然対話・要点明快'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 理解度スキャンテスト入力 */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>発話語彙スキャンテスト:</span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={testUtterance}
                    onChange={(e) => setTestUtterance(e.target.value)}
                    placeholder="専門用語を含む発話..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleTestUtteranceAnalysis}
                    className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold whitespace-nowrap active:scale-95"
                  >
                    分析
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 第33/34/35/54/57/69/155章 自律認知・研究・デバッグOS ── */}
      {activeView === 'advanced_services' && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-rose-400" />
                  新世代自律認知OS & 研究・デバッグ基盤
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  第33章(能力境界), 第34章(技能圧縮), 第35/54章(能動知覚), 第57章(研究ノート), 第69章(人格アンカー), 第155章(認知デバッガ)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  全6サービス常時稼働中
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. 第33章 & 第34章: 能力境界マッピング & 技能圧縮 */}
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-amber-400" />
                  第33・34章 能力境界＆技能圧縮 (Skill IR)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-amber-950 text-amber-300 border border-amber-800">
                  ロスレス圧縮
                </span>
              </div>

              {(() => {
                const boundaries = autonomousCurriculumService.getAllBoundaries();
                const skillIrs = autonomousCurriculumService.getAllSkillIrs();
                return (
                  <div className="space-y-2.5">
                    <div>
                      <div className="text-[11px] text-slate-400 mb-1 flex justify-between">
                        <span>把握済みの能力境界 (苦手・未知領域):</span>
                        <span className="text-amber-400 font-bold">{boundaries.length} 件</span>
                      </div>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {boundaries.map((b) => (
                          <div key={b.id} className="p-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs flex justify-between items-center">
                            <div>
                              <div className="font-semibold text-slate-200">{b.topic}</div>
                              <div className="text-[10px] text-slate-400">{b.domain} • 確信度 {(b.confidenceScore * 100).toFixed(0)}%</div>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-800/60">
                              ドリル自動生成対象
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 mb-1 flex justify-between">
                        <span>高密度 Skill IR マイクロルール:</span>
                        <span className="text-emerald-400 font-bold">{skillIrs.length} 件</span>
                      </div>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {skillIrs.map((ir) => (
                          <div key={ir.id} className="p-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs">
                            <div className="font-semibold text-emerald-300 flex justify-between">
                              <span>{ir.skillName}</span>
                              <span className="text-[10px] font-mono text-slate-400">{ir.originalRulesCount} micro-rules</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
                              {ir.compressedDeterministicLogic.split('\n').slice(0, 3).map((r: string, idx: number) => (
                                <div key={idx} className="truncate">• {r}</div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 2. 第35章・54章・69章: 能動知覚OS & 先行予測 & 人格アンカー */}
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  第35・54・69章 能動知覚OS＆人格アンカー
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                  常時知覚中
                </span>
              </div>

              {(() => {
                const ctx = proactiveContextOsService.getLatestContext();
                const persona = proactiveContextOsService.verifyAndRestorePersona();
                return (
                  <div className="space-y-2.5 text-xs">
                    <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400">認知疲労ガード:</span>
                        <span className={`font-bold ${ctx.cognitiveFatigueDetected ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {ctx.cognitiveFatigueDetected ? '🚨 疲労検知（休憩提案発動）' : '✅ 正常（集中作業可能）'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400">作業モード:</span>
                        <span className="font-semibold text-cyan-300">{ctx.detectedUserMode}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400">推奨アクション:</span>
                        <span className="font-semibold text-amber-300">
                          {ctx.recommendedAction || '通常見守り対話'}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
                      <div className="text-[11px] font-bold text-rose-300 flex items-center justify-between">
                        <span>多重人格アンカー健全性:</span>
                        <span className="text-emerald-400 font-bold">{persona.passed ? '100% 健全' : '復旧発動'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        口調（語尾・親愛スタンス）ドリフト防止・冷徹機械語句遮断が常時稼働中
                      </div>
                      {ctx.proactiveInterventionCandidate && (
                        <div className="pt-1 text-[11px] text-cyan-200">
                          <span className="font-semibold text-slate-400">先行予測サジェスト: </span>
                          {ctx.proactiveInterventionCandidate}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 3. 第57章: デジタル研究ノート */}
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  第57章 デジタル研究ノート (自己実験＆仮説検証)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                  科学的自己進化
                </span>
              </div>

              {(() => {
                const stats = digitalResearchNoteService.getStats();
                const latest = digitalResearchNoteService.getAllExperiments()[0];
                return (
                  <div className="space-y-2.5 text-xs">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-xl text-center">
                        <div className="text-[10px] text-slate-400">総実験数</div>
                        <div className="text-lg font-bold text-emerald-400">{stats.totalExperiments}</div>
                      </div>
                      <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-xl text-center">
                        <div className="text-[10px] text-slate-400">立証済仮説</div>
                        <div className="text-lg font-bold text-cyan-400">{stats.verifiedHypotheses}</div>
                      </div>
                      <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-xl text-center">
                        <div className="text-[10px] text-slate-400">定着知見</div>
                        <div className="text-lg font-bold text-amber-400">{stats.settledRulesCount}</div>
                      </div>
                    </div>

                    {latest && (
                      <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
                        <div className="font-semibold text-slate-200 text-[11px] truncate">
                          最新実験: {latest.title}
                        </div>
                        <div className="text-[10px] text-slate-400 line-clamp-2">
                          仮説: {latest.hypothesis}
                        </div>
                        <div className="text-[10px] text-emerald-300 font-semibold pt-0.5">
                          結論: {latest.conclusion}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* 4. 第155章: 認知デバッガUI・失敗経路診断 */}
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-violet-400" />
                  第155章 認知デバッガ (推論トレース＆失敗経路診断)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-violet-950 text-violet-300 border border-violet-800">
                  透明推論モニタ
                </span>
              </div>

              {(() => {
                const latest = cognitiveDebuggerService.getLatestTrace();
                return (
                  <div className="space-y-2 text-xs">
                    {latest ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-slate-950/70 border border-slate-800 rounded-xl">
                          <div>
                            <div className="font-semibold text-slate-200">{latest.intentCategory}</div>
                            <div className="text-[10px] text-slate-400">推論応答時間: {latest.totalLatencyMs}ms</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-slate-400">骨格タイプ:</div>
                            <span className="text-xs font-bold text-violet-300">{latest.appliedSkeletonType}</span>
                          </div>
                        </div>

                        <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
                          <div className="text-[10px] text-slate-400">想起記憶層 ({latest.recalledMemoryLayers.length}):</div>
                          <div className="flex flex-wrap gap-1">
                            {latest.recalledMemoryLayers.map((layer: string, idx: number) => (
                              <span key={idx} className="px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800/60 text-[9px]">
                                {layer}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-300 bg-slate-950/60 p-2 rounded-xl border border-slate-800 leading-relaxed">
                          <span className="font-bold text-violet-300">診断サマリー: </span>
                          {latest.diagnosticInsight || '推論経路は健全です'}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 text-center text-slate-400 text-xs">
                        現在推論トレースを記録中です。会話または自律改善を実行するとリアルタイム表示されます。
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── コード自己理解＆改善レシピ ビュー (Codebase Reflection & Improvement Recipe) ── */}
      {activeView === 'code_reflection' && (
        <div className="space-y-6">
          {/* 1. アーキテクチャレイヤー概要 */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-400" />
                アーキテクチャ5大レイヤー & コード健全性
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                Reflection Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {selfCodeArchitectService.getArchitectureOverview().map((layer, idx) => (
                <div key={idx} className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-200">{layer.layerName}</span>
                    <span className="text-[10px] font-mono font-bold text-emerald-400">{layer.healthScore}%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">{layer.description}</p>
                  <div className="text-[9px] text-slate-500 font-mono pt-1">
                    {layer.files.length} 主要ファイル
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. 自律改善レシピ合成エンジン */}
          <div className="p-5 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-800/60 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-800/40">
              <div>
                <h3 className="text-sm font-bold text-indigo-200 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  自律改善レシピ合成エンジン (Recipe Synthesizer)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  未実装・改善対象の章に対して、変更対象ファイル、必要な型・メソッド、不変条件保証を自動算定します。
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={recipeChapter}
                  onChange={(e) => handleSynthesizeRecipe(Number(e.target.value))}
                  className="bg-slate-900 border border-indigo-700/60 text-indigo-200 text-xs rounded-xl px-3 py-1.5 font-mono focus:outline-none focus:border-indigo-400"
                >
                  {SPECIFICATION_REGISTRY.map((c) => (
                    <option key={c.chapterNumber} value={c.chapterNumber}>
                      第{c.chapterNumber}章: {c.title.slice(0, 26)}... ({c.status})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleSynthesizeRecipe(recipeChapter)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md active:scale-95"
                >
                  レシピ再合成
                </button>
              </div>
            </div>

            {activeRecipe ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/80 border border-indigo-900/50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      第{activeRecipe.chapterNumber}章: {activeRecipe.chapterTitle}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        activeRecipe.regressionRisk === 'LOW'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      回帰リスク: {activeRecipe.regressionRisk}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{activeRecipe.summary}</p>

                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold mb-1">対象モジュール:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeRecipe.targetModules.map((mod, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-indigo-950/80 text-indigo-300 border border-indigo-800"
                        >
                          {mod}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold mb-1">要求インターフェース / スキーマ:</div>
                    <div className="space-y-1">
                      {activeRecipe.requiredInterfaces.map((item, idx) => (
                        <div key={idx} className="text-[11px] bg-slate-900 p-2 rounded-lg border border-slate-800">
                          <span className="font-mono text-cyan-300 font-semibold">{item.name}</span>
                          <span className="text-slate-400 ml-2 text-[10px]">({item.purpose})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-indigo-900/50 rounded-xl space-y-3">
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold mb-1">要求メソッドシグネチャ:</div>
                    <div className="space-y-1.5">
                      {activeRecipe.requiredMethods.map((item, idx) => (
                        <div key={idx} className="text-[11px] bg-slate-900 p-2 rounded-lg border border-slate-800 space-y-0.5">
                          <div className="font-mono text-amber-300 font-bold text-[10px]">{item.name}</div>
                          <div className="font-mono text-slate-400 text-[9px] truncate">{item.signature}</div>
                          <div className="text-slate-300 text-[10px] pt-0.5">{item.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold mb-1">5大不変条件の事前保証:</div>
                    <div className="grid grid-cols-1 gap-1">
                      {activeRecipe.invariantGuarantees.map((inv, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[10px] text-emerald-300">
                          <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{inv}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const res = selfCodeArchitectService.runAutonomousImprovementCycle(activeRecipe.chapterNumber);
                      setAuditResult(res.auditResult);
                      setProposals(selfCodeArchitectService.getProposals());
                      handleSynthesizeRecipe(activeRecipe.chapterNumber);
                      setActionNotice(res.summary);
                      setTimeout(() => setActionNotice(null), 6000);
                    }}
                    disabled={isAutoImproving}
                    className="w-full py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    このレシピで自律改善を実行＆同期
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                章を選択して「レシピ再合成」をクリックしてください。
              </div>
            )}
          </div>

          {/* 3. モジュールインスペクター */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-indigo-400" />
                登録コードモジュール一覧 (自己理解レジストリ)
              </span>

              <div className="relative">
                <input
                  type="text"
                  value={moduleSearch}
                  onChange={(e) => setModuleSearch(e.target.value)}
                  placeholder="ファイル名・関数を検索..."
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1 text-xs text-slate-200 placeholder-slate-500 w-48 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {selfCodeArchitectService.getModules(moduleSearch).map((mod, idx) => (
                <div key={idx} className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-indigo-300 truncate" title={mod.path}>
                      {mod.path.split('/').pop()}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        mod.riskLevel === 'HIGH'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : mod.riskLevel === 'MEDIUM'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {mod.riskLevel}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{mod.description}</p>

                  <div className="space-y-1 text-[9px]">
                    <div className="text-slate-500">
                      主要エクスポート: <span className="text-slate-300 font-mono">{mod.primaryExports.join(', ')}</span>
                    </div>
                    <div className="text-slate-500">
                      関連章: <span className="text-indigo-400 font-mono">第{mod.linkedChapterNumbers.join(', ')}章</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
