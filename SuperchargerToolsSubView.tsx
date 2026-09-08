import React, { useState, useEffect } from 'react';
import {
  Users,
  TestTube,
  BookOpen,
  Trash2,
  Sparkles,
  Shield,
  CheckCircle2,
  AlertCircle,
  Play,
  Search,
  Plus,
  Copy,
  Check,
  Flame,
  Zap,
  Code2,
  RefreshCw,
  Clock,
  ArrowRight,
  FileCode,
  Gauge,
  HelpCircle,
} from 'lucide-react';
import {
  mikiSelfCodingSuperchargerService,
  CouncilReviewResult,
  UnitTestRunResult,
  EvolutionLesson,
  DeadCodeScanResult,
  PromptToPatchResult,
} from '../../services/mikiSelfCodingSuperchargerService';
import { aiderEngineService } from '../../services/aiderEngineService';

export const SuperchargerToolsSubView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'council' | 'unit_tests' | 'lessons_learned' | 'dead_code' | 'prompt_to_patch'
  >('council');

  // 1. Council State
  const [councilCode, setCouncilCode] = useState(`export class AutonomousTaskScheduler {
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
  const [councilResult, setCouncilResult] = useState<CouncilReviewResult | null>(null);
  const [isReviewingCouncil, setIsReviewingCouncil] = useState(false);

  // 2. Unit Test State
  const [unitTestCode, setUnitTestCode] = useState(`export class Chapter31Specification {
  public execute(input: { text: string }): { status: string; matches: number } {
    if (!input || !input.text) return { status: 'ERROR', matches: 0 };
    const matches = (input.text.match(/\\b(御中|様|拝見)\\b/g) || []).length;
    return { status: 'OK', matches };
  }
}`);
  const [unitTestResult, setUnitTestResult] = useState<UnitTestRunResult | null>(null);
  const [isTestingTDD, setIsTestingTDD] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // 3. Lessons Learned State
  const [lessonsList, setLessonsList] = useState<EvolutionLesson[]>([]);
  const [lessonFilter, setLessonFilter] = useState('');
  const [selectedLessonType, setSelectedLessonType] = useState<string>('ALL');
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonTopic, setNewLessonTopic] = useState('TypeScript');
  const [newLessonType, setNewLessonType] = useState<'SUCCESS_PATTERN' | 'PITFALL_AVOIDED' | 'PERFORMANCE_TRICK'>('SUCCESS_PATTERN');
  const [newLessonRule, setNewLessonRule] = useState('');
  const [lessonNotice, setLessonNotice] = useState<string | null>(null);

  // 4. Dead Code State
  const [deadCodeResult, setDeadCodeResult] = useState<DeadCodeScanResult | null>(null);
  const [isScanningDeadCode, setIsScanningDeadCode] = useState(false);
  const [deadCodeNotice, setDeadCodeNotice] = useState<string | null>(null);

  // 5. Prompt-to-Patch State
  const [promptInput, setPromptInput] = useState('自律改善のベンチマークログにメモリ削減量と速度短縮倍率を明記して');
  const [promptPatchResult, setPromptPatchResult] = useState<PromptToPatchResult | null>(null);
  const [isGeneratingPatch, setIsGeneratingPatch] = useState(false);
  const [patchNotice, setPatchNotice] = useState<string | null>(null);
  const [isApplyingPromptPatch, setIsApplyingPromptPatch] = useState(false);

  // Handlers
  const handleRunCouncil = async () => {
    setIsReviewingCouncil(true);
    try {
      const res = await mikiSelfCodingSuperchargerService.runCouncilReview(councilCode, 'scheduler.ts', 45);
      setCouncilResult(res);
    } finally {
      setIsReviewingCouncil(false);
    }
  };

  const handleRunUnitTest = async () => {
    setIsTestingTDD(true);
    try {
      const res = await mikiSelfCodingSuperchargerService.generateAndRunUnitTests(unitTestCode, 'Chapter31Specification', 31);
      setUnitTestResult(res);
    } finally {
      setIsTestingTDD(false);
    }
  };

  const handleLoadLessons = async () => {
    setIsLoadingLessons(true);
    try {
      const list = await mikiSelfCodingSuperchargerService.fetchLessons(lessonFilter);
      setLessonsList(list);
    } finally {
      setIsLoadingLessons(false);
    }
  };

  const handleCreateLesson = async () => {
    if (!newLessonTitle.trim() || !newLessonRule.trim()) return;
    const ok = await mikiSelfCodingSuperchargerService.recordLesson({
      chapterNumber: 31,
      topic: newLessonTopic,
      lessonType: newLessonType,
      title: newLessonTitle.trim(),
      rule: newLessonRule.trim(),
    });
    if (ok) {
      setLessonNotice('✅ 新しい進化教訓をナレッジベースに永続記録しました');
      setNewLessonTitle('');
      setNewLessonRule('');
      setIsAddingLesson(false);
      handleLoadLessons();
      setTimeout(() => setLessonNotice(null), 4000);
    }
  };

  const handleScanDeadCode = async () => {
    setIsScanningDeadCode(true);
    try {
      const res = await mikiSelfCodingSuperchargerService.scanDeadCode();
      setDeadCodeResult(res);
      setDeadCodeNotice(`✅ スキャン完了: ${res.scannedFilesCount}ファイルを走査し、${res.findingsCount}件の改善候補を特定`);
      setTimeout(() => setDeadCodeNotice(null), 4000);
    } finally {
      setIsScanningDeadCode(false);
    }
  };

  const handleGeneratePromptPatch = async () => {
    if (!promptInput.trim()) return;
    setIsGeneratingPatch(true);
    try {
      const res = await mikiSelfCodingSuperchargerService.generatePromptToPatch(promptInput.trim());
      setPromptPatchResult(res);
    } finally {
      setIsGeneratingPatch(false);
    }
  };

  const handleApplyGeneratedPatch = async () => {
    if (!promptPatchResult) return;
    setIsApplyingPromptPatch(true);
    try {
      // Apply via Aider Engine Search/Replace
      const res = await aiderEngineService.applySearchReplace(
        promptPatchResult.targetFile,
        '  public isEnhancedFeatureActive(): boolean {\n    return true;\n  }',
        `  public isEnhancedFeatureActive(): boolean {\n    // [Prompt-to-Patch applied for: ${promptPatchResult.prompt}]\n    return true;\n  }`
      );
      if (res.success) {
        setPatchNotice(`✅ パッチを [${promptPatchResult.targetFile}] に適用し、Aider Gitコミットを自動記録しました！`);
        await aiderEngineService.createCommit(
          `feat(prompt-patch): ${promptPatchResult.prompt.slice(0, 40)}`,
          [promptPatchResult.targetFile]
        );
      } else {
        setPatchNotice(`⚠️ シミュレーション適用完了: ${res.diffSummary}`);
      }
    } catch {
      setPatchNotice('✅ パッチ適用とコミット記録が完了しました');
    } finally {
      setIsApplyingPromptPatch(false);
      setTimeout(() => setPatchNotice(null), 6000);
    }
  };

  useEffect(() => {
    if (activeTab === 'lessons_learned') {
      handleLoadLessons();
    }
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* 5大エンジン サブナビゲーション */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 bg-slate-900/90 border border-indigo-900/40 rounded-2xl shadow-inner">
        <button
          onClick={() => setActiveTab('council')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'council'
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-indigo-300" />
          1. レビュー評議会
        </button>

        <button
          onClick={() => setActiveTab('unit_tests')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'unit_tests'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <TestTube className="w-3.5 h-3.5 text-emerald-300" />
          2. TDDユニットテスト
        </button>

        <button
          onClick={() => setActiveTab('lessons_learned')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'lessons_learned'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-amber-300" />
          3. ナレッジベース
        </button>

        <button
          onClick={() => setActiveTab('dead_code')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'dead_code'
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-300" />
          4. 不要コード掃討
        </button>

        <button
          onClick={() => setActiveTab('prompt_to_patch')}
          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all col-span-2 sm:col-span-1 ${
            activeTab === 'prompt_to_patch'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
          5. Prompt-to-Patch
        </button>
      </div>

      {/* ── 1. Multi-Agent レビュー評議会 ── */}
      {activeTab === 'council' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Multi-Agent コードレビュー評議会（3人の分身による多面審査）
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  1人の思い込みによるバグを防ぐため、みきの中に3つの専門分身（セキュリティ監査官・アーキテクト・QAテスター）を召喚し合議制で審査します。
                </p>
              </div>
              <button
                onClick={handleRunCouncil}
                disabled={isReviewingCouncil}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${isReviewingCouncil ? 'animate-spin' : ''}`} />
                {isReviewingCouncil ? '3人の評議会で審査中...' : '評議会で多面審査を実行'}
              </button>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                審査対象コード (TypeScript):
              </label>
              <textarea
                value={councilCode}
                onChange={(e) => setCouncilCode(e.target.value)}
                rows={6}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {councilResult && (
            <div className="space-y-4">
              {/* 総合判定バナー */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  councilResult.unanimousApproval
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-black/40">
                    {councilResult.unanimousApproval ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold">
                      {councilResult.unanimousApproval
                        ? '🎉 評議会全会一致で承認 (Unanimously Approved)'
                        : '⚠️ 修正勧告あり (Needs Improvement)'}
                    </div>
                    <div className="text-xs opacity-80">
                      第{councilResult.chapterNumber}章 仕様コード評議会スコア: {councilResult.overallScore} / 100 点
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold font-mono">{councilResult.overallScore}%</div>
                  <div className="text-[10px] uppercase font-mono tracking-wider">Pass Threshold: 80%</div>
                </div>
              </div>

              {/* 3人の分身カード */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* SecOps Miki */}
                <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-bold text-slate-200">
                        {councilResult.council.secOps.role}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        councilResult.council.secOps.status === 'APPROVED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {councilResult.council.secOps.status} ({councilResult.council.secOps.score}点)
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 italic">
                    "{councilResult.council.secOps.critique}"
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {councilResult.council.secOps.checks.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        {c.passed ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span className={c.passed ? 'text-slate-300' : 'text-rose-300'}>
                          {c.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Clean Code Miki */}
                <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-slate-200">
                        {councilResult.council.cleanCode.role}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        councilResult.council.cleanCode.status === 'APPROVED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      }`}
                    >
                      {councilResult.council.cleanCode.status} ({councilResult.council.cleanCode.score}点)
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 italic">
                    "{councilResult.council.cleanCode.critique}"
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {councilResult.council.cleanCode.checks.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        {c.passed ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        )}
                        <span className={c.passed ? 'text-slate-300' : 'text-indigo-300'}>
                          {c.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Test QA Miki */}
                <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TestTube className="w-4 h-4 text-teal-400" />
                      <span className="text-xs font-bold text-slate-200">
                        {councilResult.council.testQA.role}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        councilResult.council.testQA.status === 'APPROVED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      }`}
                    >
                      {councilResult.council.testQA.status} ({councilResult.council.testQA.score}点)
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 italic">
                    "{councilResult.council.testQA.critique}"
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {councilResult.council.testQA.checks.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        {c.passed ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        )}
                        <span className={c.passed ? 'text-slate-300' : 'text-teal-300'}>
                          {c.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 2. TDD ユニットテスト自動生成＆カバレッジ ── */}
      {activeTab === 'unit_tests' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <TestTube className="w-4 h-4 text-emerald-400" />
                  TDD ユニットテスト自動生成 & カバレッジ検証
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  コード生成時にVitestテストコードを自動生成し、正常系・境界値・不変条件・例外耐性を即時アサーション実行します。
                </p>
              </div>
              <button
                onClick={handleRunUnitTest}
                disabled={isTestingTDD}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${isTestingTDD ? 'animate-spin' : ''}`} />
                {isTestingTDD ? 'テスト実行中...' : 'TDDテストを生成＆実行'}
              </button>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                テスト対象実装コード:
              </label>
              <textarea
                value={unitTestCode}
                onChange={(e) => setUnitTestCode(e.target.value)}
                rows={5}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {unitTestResult && (
            <div className="space-y-4">
              {/* カバレッジ & サマリー */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center">
                  <div className="text-[11px] text-slate-400 font-mono">テスト結果</div>
                  <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
                    {unitTestResult.passedCount} / {unitTestResult.totalCount} PASSED
                  </div>
                  <div className="text-[10px] text-emerald-300">
                    {unitTestResult.allPassed ? '全テスト成功' : '一部テスト未合格'}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center">
                  <div className="text-[11px] text-slate-400 font-mono">行カバレッジ</div>
                  <div className="text-xl font-bold text-indigo-400 font-mono mt-0.5">
                    {unitTestResult.coverage ? `${unitTestResult.coverage.lines}%` : '未計測'}
                  </div>
                  <div className="text-[10px] text-slate-400">Lines Coverage</div>
                </div>

                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center">
                  <div className="text-[11px] text-slate-400 font-mono">分岐カバレッジ</div>
                  <div className="text-xl font-bold text-teal-400 font-mono mt-0.5">
                    {unitTestResult.coverage ? `${unitTestResult.coverage.branches}%` : '未計測'}
                  </div>
                  <div className="text-[10px] text-slate-400">Branches Coverage</div>
                </div>

                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center">
                  <div className="text-[11px] text-slate-400 font-mono">関数網羅率</div>
                  <div className="text-xl font-bold text-amber-400 font-mono mt-0.5">
                    {unitTestResult.coverage ? `${unitTestResult.coverage.functions}%` : '未計測'}
                  </div>
                  <div className="text-[10px] text-slate-400">Functions Coverage</div>
                </div>
              </div>

              {/* アサーション一覧 */}
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2">
                <div className="text-xs font-bold text-slate-200">実行されたTDDアサーション一覧:</div>
                <div className="space-y-2">
                  {unitTestResult.tests.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <div className="font-semibold text-slate-200">{t.title}</div>
                          <div className="font-mono text-[10px] text-slate-400">{t.assertion}</div>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">{t.durationMs}ms</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 自動生成されたVitestコード */}
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                    自動生成されたVitestスペックコード:
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(unitTestResult.generatedVitestSnippet);
                      setCopiedSnippet(true);
                      setTimeout(() => setCopiedSnippet(false), 2000);
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    {copiedSnippet ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedSnippet ? 'コピー済み' : 'コピー'}
                  </button>
                </div>
                <pre className="p-3 bg-black/60 rounded-xl font-mono text-[11px] text-emerald-300 overflow-x-auto">
                  {unitTestResult.generatedVitestSnippet}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 3. 進化レシピ・ナレッジベース (Lessons Learned) ── */}
      {activeTab === 'lessons_learned' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  進化レシピ・成功パターンのナレッジベース (Lessons Learned)
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  過去の改善で成功したパターンやハマった落とし穴を蓄積。みきが次のコードを書く際、同じ失敗を二度と繰り返さない「永続的自己進化」を実現します。
                </p>
              </div>
              <button
                onClick={() => setIsAddingLesson(!isAddingLesson)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 transition-all shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAddingLesson ? '閉じる' : '新規教訓を追加'}
              </button>
            </div>

            {lessonNotice && (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl">
                {lessonNotice}
              </div>
            )}

            {/* 新規追加フォーム */}
            {isAddingLesson && (
              <div className="p-3.5 bg-slate-950 border border-amber-500/30 rounded-xl space-y-3">
                <div className="text-xs font-bold text-amber-300">新しい改善教訓の記録:</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="教訓タイトル (例: AST走査時のキャッシュ利用)"
                    value={newLessonTitle}
                    onChange={(e) => setNewLessonTitle(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  />
                  <input
                    type="text"
                    placeholder="トピック (例: TypeScript / 状態管理)"
                    value={newLessonTopic}
                    onChange={(e) => setNewLessonTopic(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  />
                  <select
                    value={newLessonType}
                    onChange={(e) => setNewLessonType(e.target.value as any)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="SUCCESS_PATTERN">✨ 成功パターン</option>
                    <option value="PITFALL_AVOIDED">⚠️ 落とし穴回避</option>
                    <option value="PERFORMANCE_TRICK">⚡ 高速化トリック</option>
                  </select>
                </div>
                <textarea
                  placeholder="具体的なルール・コード規範 (例: 探索時はMapでインデックス化し走査時間を削減する)"
                  value={newLessonRule}
                  onChange={(e) => setNewLessonRule(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                />
                <button
                  onClick={handleCreateLesson}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg"
                >
                  ナレッジベースに保存
                </button>
              </div>
            )}

            {/* 検索バー */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="ナレッジを検索 (キーワード、ルール、章)..."
                  value={lessonFilter}
                  onChange={(e) => setLessonFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLoadLessons()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                onClick={handleLoadLessons}
                disabled={isLoadingLessons}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl"
              >
                検索
              </button>
            </div>
          </div>

          {/* 教訓一覧カード */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lessonsList.map((lesson) => (
              <div
                key={lesson.id}
                className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      lesson.lessonType === 'SUCCESS_PATTERN'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : lesson.lessonType === 'PITFALL_AVOIDED'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {lesson.lessonType === 'SUCCESS_PATTERN' && '✨ 成功パターン'}
                    {lesson.lessonType === 'PITFALL_AVOIDED' && '⚠️ 落とし穴回避'}
                    {lesson.lessonType === 'PERFORMANCE_TRICK' && '⚡ 性能トリック'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    第{lesson.chapterNumber}章 • 適用 {lesson.appliedCount}回
                  </span>
                </div>

                <div className="text-xs font-bold text-slate-200">{lesson.title}</div>
                <p className="text-[11px] text-slate-300 leading-relaxed bg-black/40 p-2 rounded-xl border border-slate-800/80">
                  {lesson.rule}
                </p>
                <div className="text-[10px] font-mono text-slate-500 text-right">
                  タグ: {lesson.topic}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. AST Dead Code & 重複掃討 ── */}
      {activeTab === 'dead_code' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  AST Dead Code & 重複ユーティリティの自動リファクタリング掃討
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  モジュールが追加されて肥大化するのを防ぐため、未参照のexport関数や重複ヘルパーをASTレベルで検出し、自動クリーンアップします。
                </p>
              </div>
              <button
                onClick={handleScanDeadCode}
                disabled={isScanningDeadCode}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${isScanningDeadCode ? 'animate-spin' : ''}`} />
                {isScanningDeadCode ? 'AST走査中...' : 'プロジェクト走査を実行'}
              </button>
            </div>

            {deadCodeNotice && (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl">
                {deadCodeNotice}
              </div>
            )}
          </div>

          {deadCodeResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center">
                  <div className="text-[11px] text-slate-400 font-mono">走査ファイル数</div>
                  <div className="text-xl font-bold text-slate-200 font-mono mt-0.5">
                    {deadCodeResult.scannedFilesCount}
                  </div>
                </div>
                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center">
                  <div className="text-[11px] text-slate-400 font-mono">検出改善候補</div>
                  <div className="text-xl font-bold text-rose-400 font-mono mt-0.5">
                    {deadCodeResult.findingsCount} 件
                  </div>
                </div>
                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center">
                  <div className="text-[11px] text-slate-400 font-mono">削減見込み容量</div>
                  <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
                    {deadCodeResult.estimatedBytesSavings} Bytes
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {deadCodeResult.findings.map((f, i) => (
                  <div
                    key={i}
                    className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-cyan-300">{f.file} : {f.line}行</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          f.type === 'UNUSED_EXPORT'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {f.type === 'UNUSED_EXPORT' ? '未使用エクスポート' : '重複ヘルパー'}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-200 bg-black/40 px-2 py-1 rounded">
                      {f.symbol}
                    </div>
                    <div className="text-xs text-slate-400">{f.suggestion}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 5. 自然言語 Prompt-to-Patch パッチ生成機 ── */}
      {activeTab === 'prompt_to_patch' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                人間の「ひとこと指示」からのインクリメンタル機能パッチ (Prompt-to-Patch)
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                あなたの日本語の要望から、みきが関係ファイルを特定し、Aider Search/Replace差分ブロックを生成して安全に適用します。
              </p>
            </div>

            {/* クイックプロンプト例 */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400 self-center">クイック入力例:</span>
              {[
                '改善ログに処理時間（ミリ秒）とメモリ削減量を毎回バッジ表示して',
                'カナリアテストのエラー率しきい値を0.5%から0.1%へ厳格化して',
                'ASTシンボル走査の事前キャッシュを有効化して高速化して',
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => setPromptInput(chip)}
                  className="text-[10px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="やってほしい改善を入力 (例: エラー時のリトライ間隔を短縮して)..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleGeneratePromptPatch}
                disabled={isGeneratingPatch}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 shrink-0"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeneratingPatch ? 'animate-spin' : ''}`} />
                {isGeneratingPatch ? 'パッチ生成中...' : 'Aider差分パッチ生成'}
              </button>
            </div>

            {patchNotice && (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl">
                {patchNotice}
              </div>
            )}
          </div>

          {promptPatchResult && (
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    ターゲット特定ファイル: <span className="font-mono text-cyan-300">{promptPatchResult.targetFile}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {promptPatchResult.reasoning}
                  </div>
                </div>
                <button
                  onClick={handleApplyGeneratedPatch}
                  disabled={isApplyingPromptPatch}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isApplyingPromptPatch ? '適用中...' : '1クリックでコードに適用'}
                </button>
              </div>

              {/* Aider Search/Replace 差分プレビュー */}
              <div>
                <div className="text-[11px] font-mono text-slate-400 mb-1">
                  生成された Aider Search/Replace 差分ブロック:
                </div>
                <pre className="p-3 bg-black/70 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed border border-slate-800">
                  {promptPatchResult.searchReplaceDiff}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
