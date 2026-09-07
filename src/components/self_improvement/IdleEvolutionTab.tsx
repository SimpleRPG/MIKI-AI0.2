import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Brain,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  BookOpen,
  ListTodo,
  Target,
  Clock,
  ShieldCheck,
  Award,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  AutonomousGrowthReport,
  HeuristicRuleItem,
  CounterfactualReflectionItem,
} from '../../types';
import { autonomousEvolutionService } from '../../services/autonomousEvolutionService';
import { workingAgendaService } from '../../services/workingAgendaService';
import { selfCodeArchitectService } from '../../services/selfCodeArchitectService';
import { Code2 } from 'lucide-react';

export const IdleEvolutionTab: React.FC = () => {
  const [reports, setReports] = useState<AutonomousGrowthReport[]>([]);
  const [rules, setRules] = useState<HeuristicRuleItem[]>([]);
  const [reflections, setReflections] = useState<CounterfactualReflectionItem[]>([]);
  const [pendingHomeworks, setPendingHomeworks] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentExecutionLog, setCurrentExecutionLog] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<AutonomousGrowthReport | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'rules' | 'reflections' | 'homework'>('overview');

  const refreshData = () => {
    const reps = autonomousEvolutionService.getGrowthReports();
    setReports(reps);
    if (reps.length > 0 && !selectedReport) {
      setSelectedReport(reps[0]);
    }
    setRules(autonomousEvolutionService.getHeuristicRules());
    setReflections(autonomousEvolutionService.getReflections());
    setPendingHomeworks(workingAgendaService.getHomeworkForAutonomousThought());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleRunCycle = async () => {
    setIsRunning(true);
    setCurrentExecutionLog('🌱 放置型自律進化サイクルを開始中: 反省 ➔ 知恵蒸留 ➔ 宿題解決 ➔ 弱点ドリル...');
    try {
      const rep = await autonomousEvolutionService.runIdleEvolutionCycle();
      setSelectedReport(rep);
      refreshData();
      setCurrentExecutionLog(`✓ 自律進化完了 (${rep.durationMs}ms): ${rep.welcomeGreetingCandidate}`);
    } catch (e: any) {
      setCurrentExecutionLog(`❌ エラー: ${e?.message || '自律進化の実行に失敗しました'}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-purple-950/70 border border-emerald-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <Sparkles className="w-5 h-5" />
              </span>
              <h3 className="text-base font-bold text-slate-100">
                第19章 放置型自律進化エンジン (Idle Autonomous Evolution)
              </h3>
            </div>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              ユーザーがチャット画面を離れているアイドル時・充電中（深夜含む）に、
              「反実仮想反省」「エピソード記憶からの定石蒸留」「未解決宿題の自律深掘り」「弱点ドリル」を自動実行し、
              <strong className="text-emerald-300"> ほっといてもAI自身が自動で賢くなる </strong>
              自律成長パイプラインです。
            </p>
          </div>

          <button
            onClick={handleRunCycle}
            disabled={isRunning}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shrink-0 transition-all shadow-lg ${
              isRunning
                ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 border border-emerald-400/30'
            }`}
          >
            {isRunning ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin text-emerald-300" />
                <span>自律進化を実行中...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>今すぐ自律進化サイクルを実行</span>
              </>
            )}
          </button>
        </div>

        {currentExecutionLog && (
          <div className="mt-3 p-2.5 rounded-lg bg-slate-950/80 border border-emerald-500/30 text-xs font-mono text-emerald-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span>{currentExecutionLog}</span>
          </div>
        )}
      </div>

      {/* 5 Core Pillars Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
            <Brain className="w-4 h-4" />
            <span>① 反実仮想反省</span>
          </div>
          <div className="mt-2 text-xl font-bold text-slate-100">{reflections.length}件</div>
          <div className="text-[10px] text-slate-400 mt-0.5">失敗の分析と理想回答の自己生成</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
            <BookOpen className="w-4 h-4" />
            <span>② 恒久知恵蒸留</span>
          </div>
          <div className="mt-2 text-xl font-bold text-slate-100">{rules.length}件</div>
          <div className="text-[10px] text-slate-400 mt-0.5">記憶から普遍的定石ルールを抽出</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold">
            <ListTodo className="w-4 h-4" />
            <span>③ 未解決宿題解決</span>
          </div>
          <div className="mt-2 text-xl font-bold text-slate-100">
            {pendingHomeworks.length}件<span className="text-xs font-normal text-slate-400"> 待機</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">自発思考＆Web学習で自律解決</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
            <Target className="w-4 h-4" />
            <span>④ 弱点ドリル熟達</span>
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-300">
            {selectedReport ? `${Math.round(selectedReport.masteryScore * 100)}%` : '未実施'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">自己生成問題の自動採点</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-purple-400 text-xs font-bold">
            <Code2 className="w-4 h-4" />
            <span>⑤ 自律コード改善</span>
          </div>
          <div className="mt-2 text-xl font-bold text-purple-300">
            {selfCodeArchitectService.getProposals().filter((p) => p.status === 'APPLIED').length}件
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">仕様書適合・変更契約適用</div>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeSubTab === 'overview'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          成長レポート一覧 ({reports.length})
        </button>
        <button
          onClick={() => setActiveSubTab('rules')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeSubTab === 'rules'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          蒸留された恒久知恵 ({rules.length})
        </button>
        <button
          onClick={() => setActiveSubTab('reflections')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeSubTab === 'reflections'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          反実仮想反省ログ ({reflections.length})
        </button>
        <button
          onClick={() => setActiveSubTab('homework')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeSubTab === 'homework'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          未解決宿題キュー ({pendingHomeworks.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeSubTab === 'overview' && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 text-sm">
              まだ自律成長レポートがありません。「今すぐ自律進化サイクルを実行」ボタンをクリックして、放置学習をシミュレーションしてみましょう！
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Report List */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-400 px-1">実行履歴</div>
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    onClick={() => setSelectedReport(rep)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedReport?.id === rep.id
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-slate-100 shadow-md'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(rep.timestamp).toLocaleString()}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {rep.durationMs}ms
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-2 line-clamp-2">
                      {rep.welcomeGreetingCandidate}
                    </p>
                  </div>
                ))}
              </div>

              {/* Report Detail */}
              {selectedReport && (
                <div className="md:col-span-2 p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        AUTONOMOUS GROWTH REPORT
                      </span>
                      <h4 className="text-sm font-bold text-slate-100 mt-0.5">
                        {new Date(selectedReport.timestamp).toLocaleString()} の自律進化
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                        熟達度 {Math.round(selectedReport.masteryScore * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Welcome Greeting Candidate */}
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40">
                    <div className="text-[10px] font-bold text-emerald-400 uppercase">
                      お出迎え挨拶 (ユーザー復帰時の報告文)
                    </div>
                    <p className="text-xs text-slate-200 font-medium mt-1">
                      「{selectedReport.welcomeGreetingCandidate}」
                    </p>
                  </div>

                  {/* Highlights */}
                  <div>
                    <div className="text-xs font-bold text-slate-300 mb-2">自律成長ハイライト:</div>
                    <ul className="space-y-1.5">
                      {selectedReport.growthHighlights.map((h, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Drill Results */}
                  {selectedReport.details?.drillResults && selectedReport.details.drillResults.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-slate-300 mb-2">自己生成ドリル結果:</div>
                      <div className="space-y-1.5">
                        {selectedReport.details.drillResults.map((dr, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                          >
                            <span className="text-slate-300">{dr.topic}</span>
                            <span className="text-emerald-400 font-mono font-bold">
                              合格 (スコア: {Math.round(dr.score * 100)}点)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Self-Code Improvements (第29章・第123章) */}
                  {selectedReport.selfCodeImprovementSummary && (
                    <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/40">
                      <div className="text-[10px] font-bold text-purple-400 uppercase flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5" />
                        <span>自律コード改善 & 仕様書適合</span>
                      </div>
                      <p className="text-xs text-purple-200 mt-1 font-medium">
                        {selectedReport.selfCodeImprovementSummary}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Rules Tab */}
      {activeSubTab === 'rules' && (
        <div className="space-y-3">
          {rules.length === 0 ? (
            <div className="p-6 text-center rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 text-xs">
              まだ蒸留された定石ルールがありません。自律進化サイクルを実行すると、過去の記憶から定石が自動抽出されます。
            </div>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="p-4 rounded-xl bg-slate-900/80 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                      {rule.category}
                    </span>
                    <span className="text-sm font-bold text-slate-100">{rule.title}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    信頼度: {Math.round(rule.confidence * 100)}%
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  {rule.ruleText}
                </p>
                <div className="text-[10px] text-slate-400 flex items-center gap-2">
                  <span>適用回数: {rule.appliedCount}回</span>
                  <span>•</span>
                  <span>元エピソード: {rule.derivedFromEpisodes.length}件</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Reflections Tab */}
      {activeSubTab === 'reflections' && (
        <div className="space-y-3">
          {reflections.length === 0 ? (
            <div className="p-6 text-center rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 text-xs">
              反省ログは現在ありません（失敗インシデントがゼロ、または未抽出）。
            </div>
          ) : (
            reflections.map((ref) => (
              <div key={ref.id} className="p-4 rounded-xl bg-slate-900/80 border border-rose-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400">【反省インシデント】</span>
                  <span className="text-[10px] text-slate-400">{new Date(ref.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-xs">
                  <span className="text-slate-400 font-bold">ユーザー入力: </span>
                  <span className="text-slate-200">「{ref.incidentPrompt}」</span>
                </div>
                <div className="text-xs">
                  <span className="text-rose-400 font-bold">根本原因: </span>
                  <span className="text-slate-300">{ref.rootCause}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold text-emerald-400">自己導出した理想の正解回答:</div>
                  <div className="text-xs text-slate-200">「{ref.idealResponse}」</div>
                </div>
                <div className="text-xs text-amber-300/90 font-medium">
                  {ref.lessonLearned}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Homework Tab */}
      {activeSubTab === 'homework' && (
        <div className="space-y-3">
          {pendingHomeworks.length === 0 ? (
            <div className="p-6 text-center rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 text-xs">
              未解決の宿題・課題キューは現在空です。会話中に「後で調べておくね」となった事項が自動でここに追加されます。
            </div>
          ) : (
            pendingHomeworks.map((hw) => (
              <div key={hw.id} className="p-3.5 rounded-xl bg-slate-900/80 border border-sky-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400">宿題トピック: {hw.topic}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-500/30">
                    優先度: {hw.priority}
                  </span>
                </div>
                {hw.unresolvedQuestions.length > 0 && (
                  <div className="text-xs text-slate-300">
                    <span className="text-slate-400 font-bold">未解決の問い: </span>
                    {hw.unresolvedQuestions.join(' / ')}
                  </div>
                )}
                <div className="text-[10px] text-slate-400">
                  放置学習（深い睡眠時）に自発思考モードと自律Web検索により自動解決されます。
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
