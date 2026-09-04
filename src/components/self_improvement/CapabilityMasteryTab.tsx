import React, { useState } from 'react';
import {
  Target,
  AlertOctagon,
  TrendingUp,
  Cpu,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  ShieldAlert,
  HelpCircle,
  Activity,
  Layers,
} from 'lucide-react';
import {
  CapabilityMasteryProfile,
  CapabilityGapEntry,
  VirtualTrainingTrial,
  LoraTriggerAssessment,
} from '../../types';
import { capabilityGapService } from '../../services/capabilityGapService';
import { virtualTrainingService } from '../../services/virtualTrainingService';

export const CapabilityMasteryTab: React.FC = () => {
  const [profiles, setProfiles] = useState<CapabilityMasteryProfile[]>(() =>
    capabilityGapService.getAllProfiles()
  );
  const [gaps, setGaps] = useState<CapabilityGapEntry[]>(() =>
    capabilityGapService.getAllGaps()
  );
  const [trials, setTrials] = useState<VirtualTrainingTrial[]>(() =>
    virtualTrainingService.getAllTrials()
  );
  const [assessment, setAssessment] = useState<LoraTriggerAssessment>(() =>
    virtualTrainingService.evaluateLoraTriggerCondition()
  );

  const [isRunningTrial, setIsRunningTrial] = useState(false);
  const [selectedTrial, setSelectedTrial] = useState<VirtualTrainingTrial | null>(null);
  const [filterGapType, setFilterGapType] = useState<string>('ALL');

  const refreshData = () => {
    setProfiles([...capabilityGapService.getAllProfiles()]);
    setGaps([...capabilityGapService.getAllGaps()]);
    setTrials([...virtualTrainingService.getAllTrials()]);
    setAssessment(virtualTrainingService.evaluateLoraTriggerCondition());
  };

  const handleRunVirtualTrial = async (capId: string) => {
    setIsRunningTrial(true);
    try {
      const trial = await virtualTrainingService.runVirtualTrainingTrial(capId);
      refreshData();
      setSelectedTrial(trial);
    } catch (e) {
      console.error('Virtual trial error:', e);
    } finally {
      setIsRunningTrial(false);
    }
  };

  const filteredGaps = gaps.filter((g) => {
    if (filterGapType === 'ALL') return true;
    return g.gap_type === filterGapType;
  });

  return (
    <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(85vh-120px)] text-slate-200">
      {/* 16.2 LoRA 発動条件判定バナー */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg ${
          assessment.triggered
            ? 'bg-amber-950/60 border-amber-500/80 text-amber-200'
            : 'bg-slate-950/80 border-slate-800 text-slate-300'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border ${
                assessment.triggered
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>設計思想 16.2章</span>
            </span>
            <h3 className="font-bold text-sm text-slate-100">
              LoRA検討の発動条件判定モニター (Trigger Condition Assessment)
            </h3>
          </div>
          <p className="text-xs leading-relaxed max-w-2xl text-slate-300">
            検索・記憶・回答骨格の導入でも抑制できず、同一能力で3回以上の言い換え失敗・汎化不足が反復した場合のみLoRA検討を発動します。
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="text-[10.5px] text-slate-400">判定ステータス</div>
            <div
              className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${
                assessment.triggered
                  ? 'bg-amber-900/60 text-amber-300 border-amber-500'
                  : 'bg-emerald-950 text-emerald-300 border-emerald-700'
              }`}
            >
              {assessment.triggered ? '⚠️ 条件該当 (要仮想試験)' : '🛡️ 検索/骨格で制御良好 (LoRA不要)'}
            </div>
          </div>
        </div>
      </div>

      {/* 16.2 詳細理由カード (発動または注意点) */}
      <div className="p-3 bg-black/40 rounded-xl border border-slate-800 text-xs space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>客観的発動条件チェック (3項目)</span>
          </span>
          <span className="text-slate-400 font-mono text-[10px]">
            推奨措置: {assessment.recommendation}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10.5px]">
          <div
            className={`p-2 rounded-lg border ${
              assessment.paraphraseFailureRepeated
                ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <div className="font-bold">1. 言い換え評価の反復失敗</div>
            <div>{assessment.paraphraseFailureRepeated ? '⚠️ 2件以上の汎化不足を検出' : '✓ 正常'}</div>
          </div>
          <div
            className={`p-2 rounded-lg border ${
              assessment.skeletonAddedButFailurePersists
                ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <div className="font-bold">2. 骨格保存後の失敗継続</div>
            <div>
              {assessment.skeletonAddedButFailurePersists
                ? '⚠️ 骨格適用済みで失敗継続'
                : '✓ 骨格で安定制御中'}
            </div>
          </div>
          <div
            className={`p-2 rounded-lg border ${
              assessment.weakCapabilityStagnated
                ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <div className="font-bold">3. 弱点能力の停滞・悪化</div>
            <div>{assessment.weakCapabilityStagnated ? '⚠️ 停滞状態' : '✓ 停滞なし'}</div>
          </div>
        </div>
      </div>

      {/* 21章: 能力習得プロファイル (Capability Mastery Profiles) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-sky-400" />
            <span>能力習得プロファイル (21章 習得状態管理)</span>
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">全{profiles.length}項目</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {profiles.map((p) => {
            const stateColors = {
              SATURATED: 'bg-emerald-950 text-emerald-300 border-emerald-700',
              STABLE: 'bg-sky-950 text-sky-300 border-sky-700',
              LEARNING: 'bg-amber-950 text-amber-300 border-amber-700',
              WEAK: 'bg-rose-950 text-rose-300 border-rose-700',
              UNASSESSED: 'bg-slate-800 text-slate-400 border-slate-700',
              REGRESSED: 'bg-purple-950 text-purple-300 border-purple-700',
            }[p.state];

            return (
              <div
                key={p.capabilityId}
                className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2.5 text-xs shadow-sm hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-bold text-slate-200 text-xs">{p.name}</span>
                    <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                      {p.category}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold border font-mono ${stateColors}`}>
                    {p.state}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-mono">
                  <div className="p-1.5 bg-slate-900 rounded border border-slate-800/80">
                    <div className="text-slate-400">成功</div>
                    <div className="text-emerald-400 font-bold">{p.successCount}</div>
                  </div>
                  <div className="p-1.5 bg-slate-900 rounded border border-slate-800/80">
                    <div className="text-slate-400">失敗</div>
                    <div className="text-rose-400 font-bold">{p.failureCount}</div>
                  </div>
                  <div className="p-1.5 bg-slate-900 rounded border border-slate-800/80">
                    <div className="text-slate-400">言い換え失敗</div>
                    <div className="text-amber-400 font-bold">{p.paraphraseFailureCount}</div>
                  </div>
                  <div className="p-1.5 bg-slate-900 rounded border border-slate-800/80">
                    <div className="text-slate-400">汎化不足</div>
                    <div className="text-purple-400 font-bold">{p.generalizationGapCount}</div>
                  </div>
                </div>

                {/* Associated Skeletons */}
                {p.associatedSkeletons.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span>紐づく骨格:</span>
                    {p.associatedSkeletons.map((sk, skIdx) => (
                      <span
                        key={skIdx}
                        className="px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 font-mono"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions: Run Virtual Trial */}
                <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[10.5px]">
                  <span className="text-slate-500 text-[10px]">
                    最終評価: {new Date(p.lastAssessedAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleRunVirtualTrial(p.capabilityId)}
                    disabled={isRunningTrial}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-bold text-[10.5px] flex items-center gap-1 shadow transition-all"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>16.3 仮想学習試験を実行</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 20 & 32章: 不足能力レジストリ (Capability Gap Registry) */}
      <div className="space-y-2.5 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
              <span>不足能力レジストリ (32章 & 20章 汎化不足トラッカー)</span>
            </h4>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
              {filteredGaps.length}件
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[10px] text-slate-400">種別絞り込み:</span>
            <select
              value={filterGapType}
              onChange={(e) => setFilterGapType(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
            >
              <option value="ALL">すべて</option>
              <option value="failure">単体失敗 (failure)</option>
              <option value="generalization_gap">汎化不足 (generalization_gap)</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {filteredGaps.map((gap) => (
            <div
              key={gap.gap_id}
              className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-rose-300 bg-rose-950/80 border border-rose-500/40 px-2 py-0.5 rounded text-[10.5px]">
                    {gap.gap_id}
                  </span>
                  <span
                    className={`text-[9.5px] px-2 py-0.5 rounded font-bold border ${
                      gap.gap_type === 'generalization_gap'
                        ? 'bg-purple-950 text-purple-300 border-purple-800'
                        : 'bg-rose-950 text-rose-300 border-rose-800'
                    }`}
                  >
                    {gap.gap_type === 'generalization_gap'
                      ? '🧠 汎化不足型 (20章)'
                      : '⚠️ 単体失敗型'}
                  </span>
                  <span className="text-[10px] text-slate-400">頻度: {gap.frequency}回</span>
                </div>
                <span
                  className={`text-[9.5px] px-2 py-0.5 rounded font-bold border ${
                    gap.impact === 'CRITICAL' || gap.impact === 'HIGH'
                      ? 'bg-rose-950 text-rose-300 border-rose-800'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  影響: {gap.impact}
                </span>
              </div>

              <div className="font-medium text-slate-200">{gap.description}</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px] pt-1 border-t border-slate-900">
                <div className="p-2 bg-black/40 rounded border border-slate-900">
                  <span className="text-amber-400 font-bold block mb-0.5">現行回避策:</span>
                  <span className="text-slate-300">{gap.current_workaround}</span>
                </div>
                <div className="p-2 bg-black/40 rounded border border-slate-900">
                  <span className="text-emerald-400 font-bold block mb-0.5">恒久候補策:</span>
                  <span className="text-slate-300">{gap.candidate_solution}</span>
                </div>
              </div>

              {gap.associatedPatternId && (
                <div className="text-[10px] text-amber-300/90 flex items-center gap-1">
                  <span>紐づく既存骨格:</span>
                  <span className="font-mono bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-500/30">
                    {gap.associatedPatternId}
                  </span>
                  <span className="text-slate-400">(※この骨格があるにも関わらず別表現で再発)</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 16.3 仮想学習試験履歴 (Virtual Training Trials) */}
      <div className="space-y-2.5 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span>16.3 仮想学習試験履歴 (Virtual Training Trials)</span>
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">{trials.length}件実行済</span>
        </div>

        {trials.length === 0 ? (
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
            まだ仮想学習試験は実行されていません。上の各能力プロファイルから「仮想学習試験を実行」してください。
          </div>
        ) : (
          <div className="space-y-2">
            {trials.map((tr) => (
              <div
                key={tr.trialId}
                className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-indigo-300 font-bold text-[10.5px]">
                      {tr.trialId}
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      対象: {tr.capabilityId}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold border font-mono ${
                      tr.verdict === 'LORA_CANDIDATE'
                        ? 'bg-purple-950 text-purple-300 border-purple-700'
                        : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    }`}
                  >
                    判定: {tr.verdict}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-mono">
                  <div className="p-1 bg-black/40 rounded border border-slate-900">
                    <div>同問再テスト</div>
                    <div
                      className={
                        tr.step3_sameProblemRetestPassed ? 'text-emerald-400' : 'text-rose-400'
                      }
                    >
                      {tr.step3_sameProblemRetestPassed ? '✓ 合格' : '✗ 失敗'}
                    </div>
                  </div>
                  <div className="p-1 bg-black/40 rounded border border-slate-900">
                    <div>言い換え再テスト</div>
                    <div
                      className={
                        tr.step4_paraphraseRetestPassed ? 'text-emerald-400' : 'text-rose-400'
                      }
                    >
                      {tr.step4_paraphraseRetestPassed ? '✓ 合格' : '✗ 失敗'}
                    </div>
                  </div>
                  <div className="p-1 bg-black/40 rounded border border-slate-900">
                    <div>別分野再テスト</div>
                    <div
                      className={
                        tr.step5_crossDomainRetestPassed ? 'text-emerald-400' : 'text-rose-400'
                      }
                    >
                      {tr.step5_crossDomainRetestPassed ? '✓ 合格' : '✗ 失敗'}
                    </div>
                  </div>
                  <div className="p-1 bg-black/40 rounded border border-slate-900">
                    <div>退行なし</div>
                    <div
                      className={
                        tr.step6_regressionCheckPassed ? 'text-emerald-400' : 'text-rose-400'
                      }
                    >
                      {tr.step6_regressionCheckPassed ? '✓ 合格' : '✗ 失敗'}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded border border-slate-800/80">
                  {tr.verdictDetails}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
