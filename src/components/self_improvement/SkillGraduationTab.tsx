import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Flame,
  Layers,
  ArrowRight,
  RotateCcw,
  RefreshCw,
  Search,
  ExternalLink,
  BookOpen,
  HelpCircle,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import {
  SkillItem,
  SkillGraduationProgress,
  SkillDiversityTestResult,
} from '../../types';
import { skillsService } from '../../services/skillsService';
import { selfImprovementService } from '../../services/selfImprovementService';

export const SkillGraduationTab: React.FC = () => {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [progresses, setProgresses] = useState<SkillGraduationProgress[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<SkillDiversityTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'candidate' | 'tested' | 'official' | 'official_matured'>('all');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadData = () => {
    const all = skillsService.getAllSkills();
    setSkills(all);
    const progList = skillsService.getAllGraduationProgresses();
    setProgresses(progList);
    if (!selectedSkillId && all.length > 0) {
      setSelectedSkillId(all[0].id);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedSkill = skills.find((s) => s.id === selectedSkillId);
  const selectedProgress = progresses.find((p) => p.skillId === selectedSkillId);

  // 多様性再試験の実行
  const handleRunDiversityTest = (skillId: string) => {
    setIsTesting(true);
    setActionMessage(null);
    try {
      const res = skillsService.testSkillDiversity(skillId);
      setTestResult(res);
      loadData();
      setActionMessage(`🧪 スキル「${res.skillName}」の多様性再試験が完了しました (多様性スコア: ${Math.round(res.diversityScore * 100)}%)`);
    } catch (e: any) {
      setActionMessage(`❌ 再試験エラー: ${e.message || e}`);
    } finally {
      setIsTesting(false);
    }
  };

  // 手動強制卒業
  const handleForceGraduate = (skillId: string) => {
    const res = skillsService.forceGraduateSkill(skillId);
    loadData();
    setActionMessage(res.message);
  };

  // 卒業差し戻し
  const handleRevertGraduation = (skillId: string) => {
    const res = skillsService.revertGraduation(skillId);
    loadData();
    setActionMessage(res.message);
  };

  // 一括再評価
  const handleBatchEvaluate = () => {
    const res = skillsService.evaluateAllSkillsPromotion();
    loadData();
    setActionMessage(`✓ 技能昇格・卒業判定を実行しました: ${res.changedCount}件更新 (卒業: ${res.graduatedCount}件)`);
  };

  // フィルタリング
  const filteredSkills = skills.filter((s) => {
    const matchQuery = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.triggerCondition.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchQuery && matchStatus;
  });

  // 統計カウント
  const counts = {
    total: skills.length,
    candidate: skills.filter((s) => s.status === 'candidate').length,
    tested: skills.filter((s) => s.status === 'tested').length,
    official: skills.filter((s) => s.status === 'official').length,
    matured: skills.filter((s) => s.status === 'official_matured').length,
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ヘッダー＆概要 */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-slate-900 border border-purple-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-purple-600/20 text-purple-300 border border-purple-500/30">
                <GraduationCap className="w-5 h-5 text-purple-300" />
              </span>
              <div>
                <h2 className="text-base font-bold text-purple-100 flex items-center gap-2">
                  <span>技能の卒業制度 ＆ 多様性再試験</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700 font-mono">
                    設計思想 第50章
                  </span>
                </h2>
                <p className="text-xs text-slate-300">
                  単一文脈での局所適合（過学習）を防ぐ「多様性再試験」と、長期安定稼働した技能をプロンプト常時注入から卒業させ「LoRA教材」へ内部化する昇華サイクル
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchEvaluate}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              title="全スキルの運用日数・成功率・文脈多様性を再計算し昇格・卒業を判定"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>全技能の一括判定</span>
            </button>
          </div>
        </div>

        {/* 4段階ステータスカウントバー */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
          <div
            onClick={() => setStatusFilter('candidate')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              statusFilter === 'candidate'
                ? 'bg-amber-950/60 border-amber-500 shadow-sm'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[10.5px] text-amber-300 font-semibold flex items-center justify-between">
              <span>① 候補 (candidate)</span>
              <span className="text-xs font-mono font-bold">{counts.candidate}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">抽出直後。多様性試験(3種)未達</p>
          </div>

          <div
            onClick={() => setStatusFilter('tested')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              statusFilter === 'tested'
                ? 'bg-sky-950/60 border-sky-500 shadow-sm'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[10.5px] text-sky-300 font-semibold flex items-center justify-between">
              <span>② 検証中 (tested)</span>
              <span className="text-xs font-mono font-bold">{counts.tested}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">多文脈合格(3種以上)＆成功率70%</p>
          </div>

          <div
            onClick={() => setStatusFilter('official')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              statusFilter === 'official'
                ? 'bg-emerald-950/60 border-emerald-500 shadow-sm'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[10.5px] text-emerald-300 font-semibold flex items-center justify-between">
              <span>③ 正式運用 (official)</span>
              <span className="text-xs font-mono font-bold">{counts.official}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">15回以上＆成功率85%の高信頼性</p>
          </div>

          <div
            onClick={() => setStatusFilter('official_matured')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              statusFilter === 'official_matured'
                ? 'bg-purple-950/60 border-purple-500 shadow-sm'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[10.5px] text-purple-300 font-semibold flex items-center justify-between">
              <span>🎓 卒業 (official_matured)</span>
              <span className="text-xs font-mono font-bold">{counts.matured}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">30日＆50回成功。LoRA教材投入</p>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-lg bg-purple-950/50 border border-purple-800/80 text-purple-200 text-xs flex items-center justify-between animate-fadeIn">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-200 text-xs">✕</button>
        </div>
      )}

      {/* メインレイアウト: 左側スキル一覧、右側卒業ダッシュボード＆多様性再試験 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 左側リスト */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="技能名・トリガー検索..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="px-2 py-1.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg whitespace-nowrap"
              >
                全件表示
              </button>
            )}
          </div>

          <div className="max-h-[640px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {filteredSkills.map((skill) => {
              const prog = progresses.find((p) => p.skillId === skill.id);
              const isSelected = skill.id === selectedSkillId;
              const statusColor =
                skill.status === 'official_matured'
                  ? 'border-purple-500/80 bg-purple-950/20'
                  : skill.status === 'official'
                  ? 'border-emerald-500/80 bg-emerald-950/20'
                  : skill.status === 'tested'
                  ? 'border-sky-500/80 bg-sky-950/20'
                  : 'border-amber-500/80 bg-amber-950/20';

              return (
                <div
                  key={skill.id}
                  onClick={() => {
                    setSelectedSkillId(skill.id);
                    setTestResult(null);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? `${statusColor} ring-1 ring-purple-500 shadow-md`
                      : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="font-bold text-xs text-slate-200 line-clamp-1">
                      {skill.name}
                    </div>
                    <span
                      className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                        skill.status === 'official_matured'
                          ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
                          : skill.status === 'official'
                          ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                          : skill.status === 'tested'
                          ? 'bg-sky-900/60 text-sky-300 border border-sky-700'
                          : 'bg-amber-900/60 text-amber-300 border border-amber-700'
                      }`}
                    >
                      {skill.status === 'official_matured'
                        ? '🎓 卒業'
                        : skill.status === 'official'
                        ? '正式'
                        : skill.status === 'tested'
                        ? '検証済'
                        : '候補'}
                    </span>
                  </div>

                  <p className="text-[10.5px] text-slate-400 line-clamp-2 mt-1">
                    {skill.description}
                  </p>

                  {/* 卒業進捗ミニバー */}
                  {prog && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-slate-400">卒業準備度</span>
                        <span className="font-mono font-bold text-purple-300">
                          {prog.overallGraduationReadiness}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                          style={{ width: `${prog.overallGraduationReadiness}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1">
                        <span>文脈多様性: {prog.requirements.contextDiversity.current}/3種</span>
                        <span>成功: {prog.requirements.successCount.current}/50回</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredSkills.length === 0 && (
              <div className="p-6 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                該当するスキルがありません
              </div>
            )}
          </div>
        </div>

        {/* 右側詳細：卒業進捗メトリクス＆多様性再試験スタジオ */}
        <div className="lg:col-span-8 space-y-4">
          {selectedSkill && selectedProgress ? (
            <>
              {/* スキルサマリーカード */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-100">{selectedSkill.name}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        {selectedSkill.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{selectedSkill.description}</p>
                  </div>

                  {/* アクションボタン */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleRunDiversityTest(selectedSkill.id)}
                      disabled={isTesting}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                      title="言い回し変形・別ドメイン・エッジケース・複合指示の4文脈で多様性再試験を模擬実行"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isTesting ? '再試験中...' : '多様性再試験を実行'}</span>
                    </button>

                    {selectedSkill.status !== 'official_matured' ? (
                      <button
                        onClick={() => handleForceGraduate(selectedSkill.id)}
                        className="px-3 py-1.5 bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                        title="50章要件を満たしたスキルを正式に卒業させLoRA教材プールへ投入"
                      >
                        <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
                        <span>卒業＆LoRA教材化</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRevertGraduation(selectedSkill.id)}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-all flex items-center gap-1"
                        title="卒業ステータスを official (正式運用中) へ差し戻します"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>差し戻し</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 卒業要件 4大メトリクス */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800">
                  {/* 要件1: 運用日数 */}
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-sky-400" />
                        <span>正式運用期間</span>
                      </span>
                      {selectedProgress.requirements.daysSinceOfficial.met ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                      )}
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-sm font-bold font-mono text-slate-200">
                        {selectedProgress.requirements.daysSinceOfficial.current}日
                      </span>
                      <span className="text-[10px] text-slate-500">/ 30日目標</span>
                    </div>
                    <div className="w-full h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-sky-500"
                        style={{
                          width: `${Math.min(100, (selectedProgress.requirements.daysSinceOfficial.current / 30) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* 要件2: 成功件数 */}
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" />
                        <span>成功実績数</span>
                      </span>
                      {selectedProgress.requirements.successCount.met ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                      )}
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-sm font-bold font-mono text-slate-200">
                        {selectedProgress.requirements.successCount.current}回
                      </span>
                      <span className="text-[10px] text-slate-500">/ 50回目標</span>
                    </div>
                    <div className="w-full h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-amber-500"
                        style={{
                          width: `${Math.min(100, (selectedProgress.requirements.successCount.current / 50) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* 要件3: 成功率 */}
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                        <span>成功信頼度</span>
                      </span>
                      {selectedProgress.requirements.successRate.met ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                      )}
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-sm font-bold font-mono text-slate-200">
                        {Math.round(selectedProgress.requirements.successRate.current * 100)}%
                      </span>
                      <span className="text-[10px] text-slate-500">/ 85%目標</span>
                    </div>
                    <div className="w-full h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{
                          width: `${Math.min(100, (selectedProgress.requirements.successRate.current / 0.85) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* 要件4: 文脈多様性 */}
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-purple-400" />
                        <span>文脈多様性</span>
                      </span>
                      {selectedProgress.requirements.contextDiversity.met ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                      )}
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-sm font-bold font-mono text-slate-200">
                        {selectedProgress.requirements.contextDiversity.current}種
                      </span>
                      <span className="text-[10px] text-slate-500">/ 3種目標</span>
                    </div>
                    <div className="w-full h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-purple-500"
                        style={{
                          width: `${Math.min(100, (selectedProgress.requirements.contextDiversity.current / 3) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 次のマイルストーン案内 */}
                <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-800/40 flex items-center gap-2 text-xs text-purple-200">
                  <span className="font-semibold shrink-0">🚩 次のマイルストーン:</span>
                  <span>{selectedProgress.nextMilestone}</span>
                </div>
              </div>

              {/* 50章: 多様性再試験 結果スタジオ */}
              {testResult ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-300">
                        <Sparkles className="w-4 h-4" />
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-indigo-100">
                          多様性再試験 (Cross-Context Retesting) 評価結果
                        </h4>
                        <p className="text-[10.5px] text-slate-400">
                          合格率 {testResult.passedTests}/{testResult.totalTests} ({Math.round(testResult.diversityScore * 100)}%) • 汎化度評価: <span className="font-bold text-indigo-300">{testResult.generalizationVerdict}</span>
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        testResult.recommendation === 'READY_FOR_OFFICIAL'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : testResult.recommendation === 'NEEDS_MORE_DIVERSITY'
                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                          : 'bg-rose-950 text-rose-300 border border-rose-700'
                      }`}
                    >
                      {testResult.recommendation === 'READY_FOR_OFFICIAL'
                        ? '✓ 正式昇格基準合格'
                        : testResult.recommendation === 'NEEDS_MORE_DIVERSITY'
                        ? '⚠️ 多様性蓄積が必要'
                        : '案件固有記憶推奨'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {testResult.testCases.map((tc, idx) => (
                      <div
                        key={tc.contextId}
                        className={`p-2.5 rounded-lg border text-xs ${
                          tc.passed
                            ? 'bg-emerald-950/20 border-emerald-800/40'
                            : 'bg-rose-950/20 border-rose-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-slate-200">{tc.prompt}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${tc.passed ? 'bg-emerald-900/60 text-emerald-300' : 'bg-rose-900/60 text-rose-300'}`}>
                            {tc.passed ? 'PASS' : 'FAIL'} (信頼度 {Math.round(tc.confidenceScore * 100)}%)
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          <span className="text-slate-500">期待動作:</span> {tc.expectedBehavior}
                        </div>
                        <div className="text-[10.5px] text-slate-400 mt-0.5">
                          <span className="text-slate-500">評価理由:</span> {tc.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* 登録済み文脈多様性パターン一覧 */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span>蓄積された検証済み実行文脈 ({selectedSkill.distinctContexts?.length || 0}パターン)</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    目標: 3パターン以上で一般スキルとして昇格可能
                  </span>
                </div>

                {selectedSkill.distinctContexts && selectedSkill.distinctContexts.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedSkill.distinctContexts.map((ctx, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex items-start gap-2"
                      >
                        <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 text-[10px] font-mono shrink-0">
                          文脈 #{idx + 1}
                        </span>
                        <span className="line-clamp-2">{ctx}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-slate-500 text-xs bg-slate-900/30 rounded-lg border border-dashed border-slate-800">
                    多様性文脈がまだ記録されていません。「多様性再試験を実行」をクリックして異なる文脈での模擬試験を実施してください。
                  </div>
                )}
              </div>

              {/* スキル詳細定義 */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                  <span>スキル定義仕様</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-[10.5px] text-slate-400 font-semibold block mb-1">適用トリガー条件</span>
                    <span className="text-slate-200 font-mono text-[11px]">{selectedSkill.triggerCondition}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-[10.5px] text-slate-400 font-semibold block mb-1">必要入力 & ツール</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedSkill.requiredInputs.map((inp, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 text-[10px]">
                          {inp}
                        </span>
                      ))}
                      {selectedSkill.usedTools.map((tool, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px]">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-[10.5px] text-slate-400 font-semibold block mb-1.5">実行ステップ</span>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-slate-300">
                    {selectedSkill.steps.map((st, idx) => (
                      <li key={idx}>{st.replace(/^\d+\.\s*/, '')}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs bg-slate-950 rounded-xl border border-slate-800">
              左側からスキルを選択してください
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
