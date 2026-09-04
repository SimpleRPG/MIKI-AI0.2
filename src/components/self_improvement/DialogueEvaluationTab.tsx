import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Award,
  Layers,
  Zap,
} from 'lucide-react';
import {
  dialogueEvaluationService,
  FIXED_SCENARIOS_12,
} from '../../services/dialogueEvaluationService';
import {
  FixedScenarioResult,
  DynamicDialogueEvaluationResult,
  FixedScenarioTestCase,
} from '../../types';

interface DialogueEvaluationTabProps {
  engineMode: string;
}

export const DialogueEvaluationTab: React.FC<DialogueEvaluationTabProps> = ({ engineMode }) => {
  const [fixedResults, setFixedResults] = useState<FixedScenarioResult[]>([]);
  const [dynamicResults, setDynamicResults] = useState<DynamicDialogueEvaluationResult[]>([]);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runningIndex, setRunningIndex] = useState<{ current: number; total: number; title: string } | null>(null);
  const [selectedTestCase, setSelectedTestCase] = useState<FixedScenarioTestCase>(FIXED_SCENARIOS_12[0]);
  const [isRunningSingle, setIsRunningSingle] = useState(false);
  const [isRunningDynamic, setIsRunningDynamic] = useState(false);
  const [dynamicEvaluation, setDynamicEvaluation] = useState<DynamicDialogueEvaluationResult | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setFixedResults(dialogueEvaluationService.getFixedResults());
    const dyn = dialogueEvaluationService.getDynamicResults();
    setDynamicResults(dyn);
    if (dyn.length > 0) setDynamicEvaluation(dyn[0]);
  };

  const handleRunSingle = async (tc: FixedScenarioTestCase) => {
    setIsRunningSingle(true);
    try {
      await dialogueEvaluationService.runSingleFixedScenario(tc, engineMode);
      loadData();
    } finally {
      setIsRunningSingle(false);
    }
  };

  const handleRunAll = async () => {
    setIsRunningAll(true);
    try {
      await dialogueEvaluationService.runAllFixedScenarios(engineMode, (current, total, title) => {
        setRunningIndex({ current, total, title });
      });
      loadData();
    } finally {
      setIsRunningAll(false);
      setRunningIndex(null);
    }
  };

  const handleRunDynamic = async () => {
    setIsRunningDynamic(true);
    try {
      const res = await dialogueEvaluationService.runDynamicDialogueEvaluation(engineMode);
      setDynamicEvaluation(res);
      loadData();
    } finally {
      setIsRunningDynamic(false);
    }
  };

  const handleClear = () => {
    if (confirm('会話評価のテスト結果ログを初期化しますか？')) {
      dialogueEvaluationService.clearResults();
      loadData();
      setDynamicEvaluation(null);
    }
  };

  const passedCount = fixedResults.filter((r) => r.passed).length;
  const passRate = fixedResults.length > 0 ? Math.round((passedCount / fixedResults.length) * 100) : 0;
  const currentResult = fixedResults.find((r) => r.testCaseId === selectedTestCase.id);

  return (
    <div className="space-y-6">
      {/* 18章 設計思想ヘッダー */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            <span>設計思想 18章: 会話評価 (固定シナリオ12種 & 動的会話評価)</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-xs border border-indigo-500/30 flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-indigo-400" />
            <span>Chapter 18 Evaluation</span>
          </span>
        </div>
        <p className="text-slate-300 text-xs leading-relaxed">
          日常の自然な会話を評価するため、<strong>12種類の固定シナリオ</strong>と、教師役がリアルタイムに発言を変化させる<strong>動的会話評価（曖昧相談 ➔ 前提訂正 ➔ 矛盾修復）</strong>を並行実施します。
          設計思想18章の規定により、<strong>「固定評価と動的評価の両方に合格した場合のみ改善扱い」</strong>として厳格に認定されます。
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleRunAll}
            disabled={isRunningAll || isRunningDynamic}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-900/30"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isRunningAll ? '全12シナリオ実行中...' : '固定12シナリオ全実行'}</span>
          </button>

          <button
            onClick={handleRunDynamic}
            disabled={isRunningAll || isRunningDynamic}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-900/30"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-300" />
            <span>{isRunningDynamic ? '動的対話試験実行中...' : '動的会話評価 (3ターン試験) 実行'}</span>
          </button>

          <button
            onClick={handleClear}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ログ初期化</span>
          </button>
        </div>

        {isRunningAll && runningIndex && (
          <div className="p-3 rounded-lg bg-indigo-950/60 border border-indigo-500/50 flex items-center gap-3 animate-pulse">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            <div className="text-xs text-indigo-200 flex-1">
              実行中 ({runningIndex.current}/{runningIndex.total}): <strong>{runningIndex.title}</strong>
            </div>
          </div>
        )}
      </div>

      {/* 総合ステータスサマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
            12
          </div>
          <div>
            <div className="text-[11px] text-slate-400">固定評価シナリオ</div>
            <div className="text-sm font-bold text-slate-100">
              {fixedResults.length} / 12 実行済み
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
            passRate >= 75 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
          }`}>
            {passRate}%
          </div>
          <div>
            <div className="text-[11px] text-slate-400">固定シナリオ合格率</div>
            <div className="text-sm font-bold text-slate-100">
              {passedCount} 合格 / {fixedResults.length} 試行
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
            dynamicEvaluation?.overallPassed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
          }`}>
            {dynamicEvaluation?.overallPassed ? '合格' : '未達'}
          </div>
          <div>
            <div className="text-[11px] text-slate-400">18章 総合認定判定</div>
            <div className="text-xs font-bold text-slate-100">
              {dynamicEvaluation?.overallPassed ? '固定＆動的 双方合格' : '両方合格で改善認定'}
            </div>
          </div>
        </div>
      </div>

      {/* 動的会話評価 (Dynamic Evaluation) レポート */}
      {dynamicEvaluation && (
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-200 font-bold text-xs">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>動的会話評価 最新実行結果: {dynamicEvaluation.scenarioName}</span>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              dynamicEvaluation.overallPassed
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'bg-rose-950 text-rose-300 border-rose-800'
            }`}>
              総合得点: {dynamicEvaluation.overallScore}点 ({dynamicEvaluation.overallPassed ? '認定合格' : '要改善'})
            </span>
          </div>

          <div className="text-[11px] text-slate-300 bg-slate-900/70 p-2.5 rounded-lg border border-slate-800/80">
            {dynamicEvaluation.summary}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {dynamicEvaluation.turns.map((turn) => (
              <div
                key={turn.turnIndex}
                className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80 space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold pb-1 border-b border-slate-800">
                    <span className="text-indigo-300">
                      ターン {turn.turnIndex}: {turn.stage === 'AMBIGUOUS_START' ? '曖昧相談' : turn.stage === 'PREMISE_CORRECTION' ? '前提訂正' : '矛盾指摘'}
                    </span>
                    <span className={`flex items-center gap-1 ${turn.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {turn.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      <span>{turn.turnScore}点</span>
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    <span className="text-slate-500 font-bold">ユーザー:</span> {turn.userMessage}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-200 bg-slate-950/60 p-2 rounded border border-slate-800/60 max-h-24 overflow-y-auto">
                    <span className="text-indigo-400 font-bold">応答:</span> {turn.assistantResponse}
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 italic pt-1">
                  基準: {turn.critique}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 固定シナリオ12種 セレクター & 詳細表示 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 左: シナリオ一覧リスト */}
        <div className="lg:col-span-5 space-y-2">
          <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>固定シナリオ (12種)</span>
            </span>
            <span className="text-[10px] text-slate-500">クリックで詳細・単体実行</span>
          </div>

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {FIXED_SCENARIOS_12.map((tc) => {
              const res = fixedResults.find((r) => r.testCaseId === tc.id);
              const isSelected = selectedTestCase.id === tc.id;
              return (
                <div
                  key={tc.id}
                  onClick={() => setSelectedTestCase(tc)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-950/50 border-indigo-500 text-indigo-200 shadow'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {res ? (
                      res.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
                    )}
                    <div className="text-xs font-medium truncate max-w-[200px]">{tc.title}</div>
                  </div>
                  {res && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      res.passed ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                    }`}>
                      {res.metrics.overallScore}点
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 右: 選択中シナリオの詳細とテスト実行結果 */}
        <div className="lg:col-span-7 p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                <span>{selectedTestCase.title}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {selectedTestCase.scenarioType}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{selectedTestCase.description}</div>
            </div>

            <button
              onClick={() => handleRunSingle(selectedTestCase)}
              disabled={isRunningSingle || isRunningAll}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 shrink-0"
            >
              <Play className="w-3 h-3" />
              <span>{isRunningSingle ? '検証中...' : '単体検証実行'}</span>
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="text-[11px] text-slate-400">
              <strong className="text-slate-300">入力プロンプト:</strong>
              <div className="mt-1 p-2 rounded bg-slate-950 border border-slate-800 text-slate-200">
                {selectedTestCase.initialPrompt}
              </div>
            </div>

            {selectedTestCase.contextHistory && selectedTestCase.contextHistory.length > 0 && (
              <div className="text-[11px] text-slate-400">
                <strong className="text-slate-300">直前文脈履歴:</strong>
                <div className="mt-1 space-y-1 p-2 rounded bg-slate-950 border border-slate-800 max-h-28 overflow-y-auto">
                  {selectedTestCase.contextHistory.map((h, i) => (
                    <div key={i} className="text-[10px]">
                      <span className="text-indigo-400 font-bold">{h.role}:</span> {h.content}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="p-2 rounded bg-emerald-950/30 border border-emerald-900/50 text-emerald-300">
                <strong>期待される要素:</strong>
                <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[10px]">
                  {selectedTestCase.expectedAspects.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
              <div className="p-2 rounded bg-rose-950/30 border border-rose-900/50 text-rose-300">
                <strong>避けるべき要素 (減点):</strong>
                <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[10px]">
                  {selectedTestCase.avoidAspects.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 直近のテスト結果 */}
          {currentResult ? (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-3 pt-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-slate-200">
                  {currentResult.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                  <span>実行結果 ({currentResult.passed ? '合格' : '不合格'})</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  遅延: {currentResult.metrics.latencyMs}ms / 得点: <strong>{currentResult.metrics.overallScore}点</strong>
                </span>
              </div>

              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-200 max-h-32 overflow-y-auto">
                {currentResult.response || '(応答なし)'}
              </div>

              {/* 11指標スコアバー */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-slate-300 pt-1">
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  直接性: <strong>{currentResult.metrics.directness}点</strong>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  文脈維持: <strong>{currentResult.metrics.contextRetention}点</strong>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  訂正反映: <strong>{currentResult.metrics.correctionUpdate}点</strong>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  矛盾修復: <strong>{currentResult.metrics.contradictionRecovery}点</strong>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  自然さ: <strong>{currentResult.metrics.naturalness}点</strong>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  回答長適合: <strong>{currentResult.metrics.lengthConformity}点</strong>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  重複排除: <strong>{currentResult.metrics.noRepetition}点</strong>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  不明点扱い: <strong>{currentResult.metrics.uncertaintyHandling}点</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-slate-950/60 border border-dashed border-slate-800 text-center text-xs text-slate-500">
              このシナリオの実行履歴はありません。「単体検証実行」または「固定12シナリオ全実行」を押してテストしてください。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
