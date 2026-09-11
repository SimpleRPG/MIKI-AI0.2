import React, { useState } from 'react';
import {
  ShieldAlert,
  Sparkles,
  Play,
  CheckCircle2,
  AlertTriangle,
  Flame,
  BrainCircuit,
  TrendingUp,
  Clock,
  Layers,
} from 'lucide-react';
import {
  autonomousHardeningService,
} from '../../../services/autonomousHardeningService';
import {
  FutureQuestionScenario,
  RedTeamAttackCase,
  PredictionErrorInsightRecord,
} from '../../../types';

export const AutonomousHardeningSubView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'future' | 'redteam' | 'prederr'>('future');

  // Future Question State
  const [scenarios, setScenarios] = useState<FutureQuestionScenario[]>(() =>
    autonomousHardeningService.getFutureScenarios()
  );
  const [selectedCondition, setSelectedCondition] = useState<FutureQuestionScenario['boundaryCondition']>(
    'LEADING_ZERO_PRESERVATION'
  );
  const [baseCapability, setBaseCapability] = useState('vba.dedup_dictionary_verified');

  // Red Team State
  const [attacks, setAttacks] = useState<RedTeamAttackCase[]>(() =>
    autonomousHardeningService.getRedTeamAttacks()
  );
  const [selectedAttackType, setSelectedAttackType] = useState<RedTeamAttackCase['attackType']>(
    'PROMPT_INJECTION_TRAP'
  );
  const [customPrompt, setCustomPrompt] = useState('');

  // Prediction Error State
  const [errors, setErrors] = useState<PredictionErrorInsightRecord[]>(() =>
    autonomousHardeningService.getPredictionErrors()
  );
  const [predAction, setPredAction] = useState('10万行データの重複排除マクロ生成');
  const [predDur, setPredDur] = useState(15);
  const [actDur, setActDur] = useState(18);

  const handleSimulateFuture = () => {
    const sc = autonomousHardeningService.simulateNewFutureScenario(baseCapability, selectedCondition);
    setScenarios([...autonomousHardeningService.getFutureScenarios()]);
  };

  const handleRunRedTeam = () => {
    autonomousHardeningService.executeRedTeamAttack(selectedAttackType, customPrompt || undefined);
    setAttacks([...autonomousHardeningService.getRedTeamAttacks()]);
    setCustomPrompt('');
  };

  const handleRecordPred = () => {
    autonomousHardeningService.recordPredictionError({
      actionName: predAction,
      predictedDurationMs: Number(predDur),
      actualDurationMs: Number(actDur),
      predictedMemoryMb: 12,
      actualMemoryMb: 14,
    });
    setErrors([...autonomousHardeningService.getPredictionErrors()]);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="p-3.5 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <BrainCircuit className="w-4 h-4" />
            </span>
            <h4 className="text-sm font-bold text-teal-300">
              第7.3節: 自動的に賢くなる仕組み (Autonomous Hardening & Red Teaming)
            </h4>
          </div>
          <span className="text-[10px] text-slate-400">
            未来質問シミュレーター / 自動レッドチーム / 予測誤差学習
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          能力習得時に次に聞かれそうな境界条件 (見出しなし、空欄、列順変更、大量行、先頭ゼロ) を先取りして自己テスト。
          さらに二重否定やプロンプトインジェクション等の攻撃を能動注入し、弱点を事前に防壁化します。
        </p>
      </div>

      {/* Mode Selector */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSection('future')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
            activeSection === 'future'
              ? 'bg-teal-950 text-teal-300 border border-teal-500/60 shadow'
              : 'bg-slate-900/70 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>未来質問シミュレーター ({scenarios.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('redteam')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
            activeSection === 'redteam'
              ? 'bg-rose-950 text-rose-300 border border-rose-500/60 shadow'
              : 'bg-slate-900/70 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>自動レッドチーム攻撃試験 ({attacks.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('prederr')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
            activeSection === 'prederr'
              ? 'bg-amber-950 text-amber-300 border border-amber-500/60 shadow'
              : 'bg-slate-900/70 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>予測誤差学習 ({errors.length})</span>
        </button>
      </div>

      {/* SECTION 1: Future Question Simulator */}
      {activeSection === 'future' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-slate-950/90 border border-teal-500/40 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span>新規境界条件の先取りシミュレーション合成</span>
              </span>
              <span className="text-[10px] text-slate-400">実運用前に脆弱なコーナーケースを事前担保</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">対象能力 (Base Capability):</label>
                <input
                  type="text"
                  value={baseCapability}
                  onChange={(e) => setBaseCapability(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">先取りする境界条件 (Boundary):</label>
                <select
                  value={selectedCondition}
                  onChange={(e) => setSelectedCondition(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                >
                  <option value="LEADING_ZERO_PRESERVATION">先頭ゼロ保持 (00123)</option>
                  <option value="HEADER_MISSING">見出し行なし (空振り防止)</option>
                  <option value="EMPTY_CELLS">虫食い・連続空行</option>
                  <option value="COLUMN_REORDER">列順序の左右入れ替え</option>
                  <option value="LARGE_SCALE_100K">10万行超の大量データ</option>
                  <option value="DATE_FORMAT_VARIATION">日付表記揺れ (YYYY/MM/DD)</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleSimulateFuture}
                  className="w-full py-1.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white rounded-lg text-xs font-semibold shadow transition flex items-center justify-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  <span>境界条件を自己テスト</span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-semibold px-1 block">先取り検証済みシナリオ一覧</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {scenarios.map((sc) => (
                <div
                  key={sc.scenarioId}
                  className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-slate-200 text-[11.5px]">{sc.title}</span>
                    <span className="px-2 py-0.5 rounded bg-teal-950 border border-teal-600 text-teal-300 text-[9.5px] font-mono shrink-0">
                      {sc.boundaryCondition}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] bg-slate-950/70 p-2 rounded border border-slate-800/80">
                    ❓ {sc.generatedQuestion}
                  </p>
                  <p className="text-emerald-300 text-[10.5px]">
                    🛡️ {sc.simulatedAnswer}
                  </p>
                  <div className="flex items-center justify-between text-[9.5px] text-slate-500 pt-1 border-t border-slate-800">
                    <span>防壁部品: <code className="text-sky-400">{sc.mitigationComponentId || '標準規則'}</code></span>
                    <span>{new Date(sc.testedAt).toLocaleTimeString()} 検証合格</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Automated Red Team */}
      {activeSection === 'redteam' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-slate-950/90 border border-rose-500/40 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>自動レッドチーム (攻撃・ストレス注入テスト)</span>
              </span>
              <span className="text-[10px] text-slate-400">故意の悪性入力に対する防壁の堅牢性を監査</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">攻撃カテゴリ:</label>
                <select
                  value={selectedAttackType}
                  onChange={(e) => setSelectedAttackType(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                >
                  <option value="PROMPT_INJECTION_TRAP">プロンプトインジェクション擬態</option>
                  <option value="DOUBLE_NEGATION">多重否定・逆論理混乱</option>
                  <option value="QUOTE_INSTRUCTION_BYPASS">引用内隠蔽命令バイパス</option>
                  <option value="TOPIC_HIJACK">話題ハイジャック攻撃</option>
                  <option value="PROTECTED_SHEET_ATTACK">保護シート強制破壊攻撃</option>
                  <option value="STALE_DATA_SPOOF">無効化主張(SUPERSEDED)偽装</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">カスタムプロンプト (任意):</label>
                <input
                  type="text"
                  placeholder="未入力時は既定テスト文"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleRunRedTeam}
                  className="w-full py-1.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-lg text-xs font-semibold shadow transition flex items-center justify-center gap-1"
                >
                  <Flame className="w-3 h-3" />
                  <span>レッドチーム攻撃を実走</span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-semibold px-1 block">防御監査ログ ({attacks.length}件)</span>
            <div className="space-y-2">
              {attacks.map((att) => (
                <div
                  key={att.attackId}
                  className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <span className="text-rose-400 font-mono">[{att.attackType}]</span>
                      <span>{att.title}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-300 text-[10px] font-bold">
                      🛡️ 防御成功 (Blocked)
                    </span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800/80 font-mono text-[10.5px] text-slate-300">
                    <span className="text-rose-400">注入プロンプト:</span> {att.prompt}
                  </div>
                  <div className="p-2 bg-emerald-950/40 rounded border border-emerald-900/60 text-[10.5px] text-emerald-200">
                    <span className="font-bold">防壁動作:</span> {att.defenseReason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: Prediction Error Learning */}
      {activeSection === 'prederr' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-slate-950/90 border border-amber-500/40 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span>予測誤差学習 (Prediction vs Actual Learning)</span>
              </span>
              <span className="text-[10px] text-slate-400">実行前に所要時間・リソースを予測し、乖離から知見を獲得</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <div className="sm:col-span-2">
                <label className="text-[10px] text-slate-400 block mb-1">実行アクション名:</label>
                <input
                  type="text"
                  value={predAction}
                  onChange={(e) => setPredAction(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">予測所要時間 (ms):</label>
                <input
                  type="number"
                  value={predDur}
                  onChange={(e) => setPredDur(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">実測所要時間 (ms):</label>
                <input
                  type="number"
                  value={actDur}
                  onChange={(e) => setActDur(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none font-mono"
                />
              </div>
            </div>
            <button
              onClick={handleRecordPred}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow transition"
            >
              誤差を計算し知見を蓄積
            </button>
          </div>

          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-semibold px-1 block">蓄積された予測誤差知見</span>
            {errors.length > 0 ? (
              <div className="space-y-1.5">
                {errors.map((pe) => (
                  <div
                    key={pe.predictionId}
                    className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-200">{pe.actionName}</span>
                      <p className="text-[11px] text-amber-300 mt-0.5">{pe.learnedInsight}</p>
                    </div>
                    <div className="text-right text-[10px] font-mono">
                      <span className="text-slate-400 block">予測 {pe.predictedDurationMs}ms ➔ 実測 {pe.actualDurationMs}ms</span>
                      <span className="text-emerald-400">誤差比率: {(pe.errorRatio * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-900/40 rounded-xl text-center text-slate-500 text-xs">
                誤差知見はまだありません
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
