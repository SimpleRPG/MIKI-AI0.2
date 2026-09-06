import React, { useState } from 'react';
import {
  MessageSquare,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Layers,
  Zap,
  ArrowRight,
  ShieldAlert,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  conversationEvaluationService,
  CHAPTER_18_FIXED_SCENARIOS,
} from '../../services/conversationEvaluationService';
import {
  DualEvaluationReport,
  FixedScenarioEvaluationResult,
  DynamicEvaluationReport,
  ReasoningDecomposition3B,
  ConversationEvaluationCriterion,
} from '../../types';

export const ConversationEvaluationTab: React.FC = () => {
  const [dualReports, setDualReports] = useState<DualEvaluationReport[]>(
    conversationEvaluationService.getDualReports()
  );
  const [fixedResults, setFixedResults] = useState<FixedScenarioEvaluationResult[]>(
    conversationEvaluationService.getFixedResults()
  );
  const [dynamicReports, setDynamicReports] = useState<DynamicEvaluationReport[]>(
    conversationEvaluationService.getDynamicReports()
  );
  const [isRunning, setIsRunning] = useState(false);
  const [activeSubView, setActiveSubView] = useState<'verdict' | 'fixed' | 'dynamic' | 'compression_3b'>('verdict');
  const [expandedScenarioId, setExpandedScenarioId] = useState<string | null>(null);

  // 13章 3B向け圧縮用ステート
  const [sampleReasoning, setSampleReasoning] = useState<string>(
    `【推論過程】
ユーザーはスマホ単体で動作するAI環境の構築を望んでいる。
前提として、当初検討されたPCやクラウドのGPUサーバー環境は利用不可（訂正イベントあり）。
事実として、Galaxy S25のNPU/RAM容量（最大12GB）とバッテリー発熱の物理限界が存在する。
矛盾点として、過去ログに「毎日24回定期学習する」とあったが動的無料予算制に置換済みである。
判断点として、70Bモデルは即時却下し、3Bまたは4Bの指示調整済みモデルを候補とする。
回答方針として、過剰な前置きや謝罪を排除し、結論から先に提示し、親友タメ口トーンを堅持する。
最終回答: Galaxy S25単体なら3B〜4B級のQ4量子化モデルを選び、会話状態管理と回答骨格で推論量を節約するのがベストだよ！`
  );
  const [decompResult, setDecompResult] = useState<ReasoningDecomposition3B | null>(null);

  const latestDual = dualReports[0] || null;
  const latestDynamic = dynamicReports[0] || null;

  const handleRunFullDual = async () => {
    setIsRunning(true);
    try {
      const rep = await conversationEvaluationService.runFullDualEvaluation();
      setDualReports([rep, ...conversationEvaluationService.getDualReports().slice(1)]);
      setFixedResults(conversationEvaluationService.getFixedResults());
      setDynamicReports(conversationEvaluationService.getDynamicReports());
      setActiveSubView('verdict');
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunFixedOnly = async () => {
    setIsRunning(true);
    try {
      const res = await conversationEvaluationService.runFixedScenarioSuite();
      setFixedResults([...res]);
      setActiveSubView('fixed');
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunDynamicOnly = async () => {
    setIsRunning(true);
    try {
      const rep = await conversationEvaluationService.runDynamicConversationEvaluation();
      setDynamicReports([rep, ...conversationEvaluationService.getDynamicReports().slice(1)]);
      setActiveSubView('dynamic');
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRun3BCompression = () => {
    const res = conversationEvaluationService.compressReasoningFor3B(sampleReasoning);
    setDecompResult(res);
  };

  const criterionLabels: Record<ConversationEvaluationCriterion, { label: string; desc: string }> = {
    directness: { label: '直接性', desc: '結論先行・不要な前置きの排除' },
    context_maintenance: { label: '文脈維持', desc: '話題と最上位目的の維持' },
    intent_understanding: { label: '意図理解', desc: '表面質問と本質意図の把握' },
    correction_adaptation: { label: '訂正反映', desc: '古い前提の即時無効化' },
    contradiction_repair: { label: '矛盾修復', desc: '非防御的な論点修復' },
    natural_japanese: { label: '自然さ', desc: '親友タメ口・自然な日本語' },
    length_suitability: { label: '回答長', desc: '短文・標準・詳細の適切性' },
    no_redundancy: { label: '非冗長性', desc: '不要な繰り返しの排除' },
    handling_unknowns: { label: '不明点処理', desc: '勝手な断定・捏造の回避' },
    proper_memory_usage: { label: '記憶利用', desc: '無関係な記憶の混入防止' },
    response_latency: { label: '応答速度', desc: '日常対話の低遅延性' },
  };

  return (
    <div className="space-y-4 text-xs">
      {/* ヘッダーカード */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/50 via-slate-900 to-slate-950 border border-indigo-800/40 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-100">
                18章 会話評価 & 13章 3B思考圧縮スイート
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                設計思想 v3.2 準拠
              </span>
            </div>
            <p className="text-slate-400 text-[11px] mt-1">
              総合点だけでなく、11の評価項目・12の固定シナリオ・教師ユーザー役による動的会話評価を実行。「固定・動的の両方に合格した場合のみ改善認定」する原則を厳格適用します。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRunFullDual}
              disabled={isRunning}
              className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-950/50 transition-all"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>評価実行中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>両方実行 & 改善判定 (Dual Eval)</span>
                </>
              )}
            </button>
            <button
              onClick={handleRunFixedOnly}
              disabled={isRunning}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-[11px] flex items-center gap-1 border border-slate-700"
            >
              <span>固定12件のみ</span>
            </button>
            <button
              onClick={handleRunDynamicOnly}
              disabled={isRunning}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-[11px] flex items-center gap-1 border border-slate-700"
            >
              <span>動的対話のみ</span>
            </button>
          </div>
        </div>

        {/* サブビューナビゲーション */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setActiveSubView('verdict')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeSubView === 'verdict'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            🏆 総合改善判定 & 11項目分析
          </button>
          <button
            onClick={() => setActiveSubView('fixed')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeSubView === 'fixed'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            📋 12の固定会話シナリオ ({fixedResults.length > 0 ? `${fixedResults.filter((r) => r.passed).length}/12合格` : '12件'})
          </button>
          <button
            onClick={() => setActiveSubView('dynamic')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeSubView === 'dynamic'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            🎭 3ターン動的会話評価 (教師ユーザー役)
          </button>
          <button
            onClick={() => setActiveSubView('compression_3b')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeSubView === 'compression_3b'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            📦 13章 3B思考過程圧縮 (6要素分解)
          </button>
        </div>
      </div>

      {/* VIEW: 総合改善判定 */}
      {activeSubView === 'verdict' && (
        <div className="space-y-4">
          {latestDual ? (
            <>
              {/* Verdict Summary Banner */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  latestDual.bothPassed
                    ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {latestDual.bothPassed ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400" />
                    )}
                    <span className="font-bold text-sm">
                      {latestDual.bothPassed
                        ? '18章 改善認定 合格 (APPROVED_IMPROVEMENT)'
                        : '18章 改善見送り・要修正 (REJECTED_NEEDS_REFINEMENT)'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-900/60 border border-current">
                      両方合格原則適用
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90">
                    固定シナリオ評価: {latestDual.fixedOverallScore}点 ({latestDual.fixedPassedCount}/{latestDual.fixedTotalCount}件合格・{latestDual.fixedPassed ? '合格基準達成' : '基準未達'}) /
                    動的会話評価: {latestDual.dynamicOverallScore}点 ({latestDual.dynamicPassed ? '合格' : '要改善'})
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-400">最終評価日時</div>
                  <div className="font-mono text-[11px] text-slate-300">
                    {new Date(latestDual.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {/* 11の評価項目レーダー・バー */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span>18章 会話品質 11項目評価スコア</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(latestDual.criterionBreakdown).map(([crit, score]) => {
                    const info = criterionLabels[crit as ConversationEvaluationCriterion] || {
                      label: crit,
                      desc: '',
                    };
                    const isGood = score >= 80;
                    return (
                      <div key={crit} className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-300">{info.label}</span>
                          <span
                            className={`font-mono font-bold ${
                              isGood ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {score}点
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              score >= 85
                                ? 'bg-emerald-500'
                                : score >= 75
                                ? 'bg-cyan-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{info.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 提言・改善方針 */}
              {latestDual.recommendations.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>次世代モデル・回答骨格への提言</span>
                  </h4>
                  <ul className="space-y-1">
                    {latestDual.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                        <ArrowRight className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-slate-300 font-bold text-sm">
                会話評価（固定＋動的）のレポートがまだありません
              </div>
              <p className="text-slate-400 text-xs max-w-md mx-auto">
                右上の「両方実行 & 改善判定」ボタンをクリックして、18章で規定された12の固定シナリオと3ターンの動的会話評価を一括実行してください。
              </p>
            </div>
          )}
        </div>
      )}

      {/* VIEW: 12の固定シナリオ結果 */}
      {activeSubView === 'fixed' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>設計思想 18章: 固定シナリオ 12項目</span>
            <span>
              合格率: {fixedResults.filter((r) => r.passed).length} / {CHAPTER_18_FIXED_SCENARIOS.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CHAPTER_18_FIXED_SCENARIOS.map((scen) => {
              const res = fixedResults.find((r) => r.scenarioId === scen.id);
              const isExpanded = expandedScenarioId === scen.id;

              return (
                <div
                  key={scen.id}
                  className={`p-3 rounded-xl border transition-all ${
                    res
                      ? res.passed
                        ? 'bg-slate-900/90 border-slate-800'
                        : 'bg-rose-950/20 border-rose-900/50'
                      : 'bg-slate-900/40 border-slate-800/50 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-200 text-xs">{scen.name}</span>
                        {res ? (
                          res.passed ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                              合格 {res.score}点
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-950 border border-rose-800 text-rose-300">
                              要改善 {res.score}点
                            </span>
                          )
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            未評価
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{scen.description}</p>
                    </div>

                    <button
                      onClick={() => setExpandedScenarioId(isExpanded ? null : scen.id)}
                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="mt-2 text-[11px] bg-slate-950/70 p-2 rounded border border-slate-800/80 font-mono text-slate-300">
                    Q: {scen.prompt}
                  </div>

                  {res && (
                    <div className="mt-2 space-y-1.5">
                      <div className="text-[11px] text-slate-300 line-clamp-2 bg-slate-950/40 p-1.5 rounded border border-slate-800/50">
                        A: {res.generatedResponse}
                      </div>

                      {res.feedback.length > 0 && (
                        <div className="text-[10px] text-rose-400 space-y-0.5">
                          {res.feedback.map((fb, fIdx) => (
                            <div key={fIdx} className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{fb}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {isExpanded && (
                        <div className="pt-2 border-t border-slate-800 space-y-1 text-[10px]">
                          <div className="flex justify-between text-slate-400">
                            <span>実測文字数: {res.charCount}文字 (期待: {scen.expectedLengthRange[0]}〜{scen.expectedLengthRange[1]}文字)</span>
                            <span>応答遅延: {res.latencyMs}ms</span>
                          </div>
                          <div className="text-slate-400">
                            期待語彙: {scen.expectedKeywords.join(', ')} / 禁止語: {scen.forbiddenKeywords.join(', ') || 'なし'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: 動的会話評価 */}
      {activeSubView === 'dynamic' && (
        <div className="space-y-3">
          {latestDynamic ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-200 text-xs">
                    多ターン対話テスト結果 ({latestDynamic.modelName})
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {latestDynamic.summary}
                  </div>
                </div>
                <div
                  className={`text-xs px-2 py-1 rounded font-mono font-bold ${
                    latestDynamic.passed
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}
                >
                  総合: {latestDynamic.overallScore}点 ({latestDynamic.passed ? '合格' : '要改善'})
                </div>
              </div>

              <div className="space-y-3">
                {latestDynamic.turns.map((turn) => (
                  <div
                    key={turn.turnNumber}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-400">
                          Turn {turn.turnNumber}:
                        </span>
                        <span className="font-semibold text-slate-200 text-xs">{turn.stageName}</span>
                        <span className="text-[10px] text-slate-400">({turn.targetCapability})</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          turn.passed ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                        }`}
                      >
                        {turn.turnScore}点 {turn.passed ? 'PASS' : 'WARN'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div className="p-2 rounded bg-indigo-950/30 border border-indigo-800/30 text-indigo-200">
                        <strong className="text-indigo-400 mr-1.5">教師(ユーザー役):</strong>
                        {turn.teacherUserPrompt}
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200">
                        <strong className="text-emerald-400 mr-1.5">端末AI(みき):</strong>
                        {turn.deviceAiResponse}
                      </div>
                    </div>

                    {turn.notes.length > 0 && (
                      <div className="text-[10px] text-slate-400 flex flex-wrap gap-2 pt-1">
                        {turn.notes.map((n, idx) => (
                          <span key={idx} className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            💡 {n}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400">
              動的会話評価の実行結果がありません。「動的対話のみ」または「両方実行」を実行してください。
            </div>
          )}
        </div>
      )}

      {/* VIEW: 13章 3B思考過程圧縮 */}
      {activeSubView === 'compression_3b' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>13章: 3B向け思考過程の6要素分解エンジン</span>
              </h4>
              <button
                onClick={handleRun3BCompression}
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow"
              >
                <Sparkles className="w-3 h-3" />
                <span>6要素へ分解・圧縮</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              大型教師AIの長大な思考過程をそのまま3B/4Bへ与えず、「事実」「前提」「矛盾」「重要な判断点」「回答方針」「最終回答」の6つに分解・圧縮して提供します。
            </p>

            <textarea
              value={sampleReasoning}
              onChange={(e) => setSampleReasoning(e.target.value)}
              rows={4}
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
              placeholder="外部教師の長大な思考過程を入力..."
            />
          </div>

          {decompResult && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-800/40 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-slate-200 text-xs">
                  分解・圧縮結果 (圧縮率: {decompResult.compressionRatio}% / {decompResult.rawLength}文字 ➔ {decompResult.compressedLength}文字)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                  3B/4B 注入適合形式
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div className="font-semibold text-sky-400 mb-1">1. 事実 (Facts)</div>
                  <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                    {decompResult.facts.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div className="font-semibold text-indigo-400 mb-1">2. 前提 (Assumptions)</div>
                  <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                    {decompResult.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div className="font-semibold text-rose-400 mb-1">3. 矛盾 (Contradictions)</div>
                  <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                    {decompResult.contradictions.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div className="font-semibold text-amber-400 mb-1">4. 重要な判断点 (Key Decisions)</div>
                  <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                    {decompResult.keyDecisions.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] space-y-1">
                <div className="font-semibold text-emerald-400">5. 回答方針 (Response Policy)</div>
                <div className="text-slate-300">
                  {decompResult.responsePolicy.join(' / ')}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/50 text-[11px] space-y-1">
                <div className="font-semibold text-emerald-300">6. 最終回答 (Final Answer)</div>
                <div className="text-slate-200">{decompResult.finalAnswer}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
