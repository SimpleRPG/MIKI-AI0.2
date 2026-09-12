/**
 * 設計思想 7.4「知識の成熟度」/ 9.3「状態遷移」
 * エビデンス駆動・昇格ゲート (Evidence-Based Promotion Gate) サブビュー
 *
 * LLM比較への依存を完全に廃止し、実測件数・意味一致率・決定性・ユーザー訂正率の
 * 4大客観的基準による部品/能力の品質保証・昇格可否を可視化・検証する。
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  evidenceBasedPromotionGateService,
  PromotionEvidenceInput,
  PromotionEvaluationResult,
  PROMOTION_GATE_CRITERIA,
} from '../../../services/evidenceBasedPromotionGateService';
import { componentRegistryService } from '../../../services/componentRegistryService';

export const PromotionGateSubView: React.FC = () => {
  const [recordCount, setRecordCount] = useState('12');
  const [accuracyScore, setAccuracyScore] = useState('98.5');
  const [determinismRate, setDeterminismRate] = useState('99.5');
  const [userCorrectionRate, setUserCorrectionRate] = useState('1.2');

  const [lastResult, setLastResult] = useState<PromotionEvaluationResult | null>(() =>
    evidenceBasedPromotionGateService.evaluatePromotionReadiness({
      recordCount: 12,
      accuracyScore: 98.5,
      determinismRate: 99.5,
      userCorrectionRate: 1.2,
    })
  );

  const [testComponentId, setTestComponentId] = useState('ir.surface_generator_v1');
  const [transitionMessage, setTransitionMessage] = useState<string | null>(null);

  const handleEvaluate = () => {
    const evidence: PromotionEvidenceInput = {
      recordCount: Number(recordCount),
      accuracyScore: Number(accuracyScore),
      determinismRate: Number(determinismRate),
      userCorrectionRate: Number(userCorrectionRate),
    };
    const result = evidenceBasedPromotionGateService.evaluatePromotionReadiness(evidence);
    setLastResult(result);
    setTransitionMessage(null);
  };

  const handleApplyPreset = (preset: 'PASS' | 'FAIL_COUNT' | 'FAIL_ACCURACY' | 'FAIL_CORRECTION') => {
    if (preset === 'PASS') {
      setRecordCount('15');
      setAccuracyScore('99.2');
      setDeterminismRate('100');
      setUserCorrectionRate('0.8');
    } else if (preset === 'FAIL_COUNT') {
      setRecordCount('7');
      setAccuracyScore('99.0');
      setDeterminismRate('100');
      setUserCorrectionRate('1.0');
    } else if (preset === 'FAIL_ACCURACY') {
      setRecordCount('15');
      setAccuracyScore('96.5');
      setDeterminismRate('99.5');
      setUserCorrectionRate('1.0');
    } else if (preset === 'FAIL_CORRECTION') {
      setRecordCount('20');
      setAccuracyScore('98.5');
      setDeterminismRate('99.5');
      setUserCorrectionRate('4.5');
    }
    setTransitionMessage(null);
  };

  const handleTestComponentPromotion = () => {
    const evidence: PromotionEvidenceInput = {
      recordCount: Number(recordCount),
      accuracyScore: Number(accuracyScore),
      determinismRate: Number(determinismRate),
      userCorrectionRate: Number(userCorrectionRate),
    };
    const res = componentRegistryService.advanceComponentStatus(
      testComponentId,
      'VERIFIED',
      'UIからの昇格ゲート試験実行',
      evidence
    );
    setTransitionMessage(
      res.success
        ? `✅ 昇格成功: ${res.message}`
        : `🚫 昇格拒否: ${res.message}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="p-4 bg-slate-800/90 border border-slate-700/80 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h4 className="font-bold text-white text-sm md:text-base">
              7.4 & 9.3 汎用エビデンス昇格ゲート (品質保証4大客観基準)
            </h4>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
            LLM非依存・決定論的ゲート
          </span>
        </div>
        <p className="text-xs text-slate-300">
          旧来の「LLM出力比較」から完全脱却し、コンポーネントおよび能力プロファイルの正式昇格(DEVICE_TESTED ➔ VERIFIED / SATURATED)を判定する客観的エビデンス評価ゲートです。
        </p>
      </div>

      {/* Criteria Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-900/80 border border-slate-700 rounded-lg">
          <span className="text-[10px] text-slate-400 block font-medium">① 実測件数</span>
          <span className="text-lg font-bold text-white font-mono">{PROMOTION_GATE_CRITERIA.MIN_RECORD_COUNT}件以上</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">サンプル規模の担保</span>
        </div>
        <div className="p-3 bg-slate-900/80 border border-slate-700 rounded-lg">
          <span className="text-[10px] text-slate-400 block font-medium">② 意味一致率 (精度)</span>
          <span className="text-lg font-bold text-emerald-400 font-mono">{PROMOTION_GATE_CRITERIA.MIN_ACCURACY_SCORE}%以上</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">意図・仕様の適合</span>
        </div>
        <div className="p-3 bg-slate-900/80 border border-slate-700 rounded-lg">
          <span className="text-[10px] text-slate-400 block font-medium">③ 決定性比率</span>
          <span className="text-lg font-bold text-teal-400 font-mono">{PROMOTION_GATE_CRITERIA.MIN_DETERMINISM_RATE}%以上</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">同一入力同一出力</span>
        </div>
        <div className="p-3 bg-slate-900/80 border border-slate-700 rounded-lg">
          <span className="text-[10px] text-slate-400 block font-medium">④ ユーザー訂正率</span>
          <span className="text-lg font-bold text-rose-400 font-mono">{PROMOTION_GATE_CRITERIA.MAX_USER_CORRECTION_RATE}%以下</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">運用実環境での違和感ゼロ</span>
        </div>
      </div>

      {/* Interactive Simulator */}
      <div className="p-4 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            エビデンス評価シミュレーター
          </h5>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">プリセット:</span>
            <button
              onClick={() => handleApplyPreset('PASS')}
              className="px-2 py-0.5 text-[10px] rounded bg-emerald-900/40 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/60"
            >
              合格ケース
            </button>
            <button
              onClick={() => handleApplyPreset('FAIL_COUNT')}
              className="px-2 py-0.5 text-[10px] rounded bg-rose-900/40 text-rose-300 border border-rose-500/40 hover:bg-rose-900/60"
            >
              件数不足
            </button>
            <button
              onClick={() => handleApplyPreset('FAIL_ACCURACY')}
              className="px-2 py-0.5 text-[10px] rounded bg-rose-900/40 text-rose-300 border border-rose-500/40 hover:bg-rose-900/60"
            >
              精度不足
            </button>
            <button
              onClick={() => handleApplyPreset('FAIL_CORRECTION')}
              className="px-2 py-0.5 text-[10px] rounded bg-rose-900/40 text-rose-300 border border-rose-500/40 hover:bg-rose-900/60"
            >
              訂正過多
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">実測件数 (件)</label>
            <input
              type="number"
              value={recordCount}
              onChange={(e) => setRecordCount(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">意味一致率 / 精度 (%)</label>
            <input
              type="number"
              step="0.1"
              value={accuracyScore}
              onChange={(e) => setAccuracyScore(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">決定性比率 (%)</label>
            <input
              type="number"
              step="0.1"
              value={determinismRate}
              onChange={(e) => setDeterminismRate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">ユーザー訂正率 (%)</label>
            <input
              type="number"
              step="0.1"
              value={userCorrectionRate}
              onChange={(e) => setUserCorrectionRate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleEvaluate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            ゲート判定を実行
          </button>
        </div>

        {/* Evaluation Output */}
        {lastResult && (
          <div
            className={`p-3 rounded-lg border text-xs space-y-2 ${
              lastResult.ready
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <div className="flex items-center gap-1.5">
                {lastResult.ready ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                )}
                <span>{lastResult.summary}</span>
              </div>
              <span className="text-[10px] font-mono">
                判定ステータス: {lastResult.ready ? 'PROMOTION_READY' : 'PROMOTION_BLOCKED'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {lastResult.requirements.map((req, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded border text-[11px] flex items-center justify-between ${
                    req.passed
                      ? 'bg-slate-950/60 border-emerald-500/30 text-slate-200'
                      : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div>
                    <span className="font-semibold block">{req.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      実測値: {req.value} / 基準: {req.operator} {req.threshold}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      req.passed
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {req.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Component Promotion Integration Test */}
      <div className="p-4 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-3">
        <h5 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-teal-400" />
          Component Registry 実機連携テスト (DEVICE_TESTED ➔ VERIFIED)
        </h5>
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <input
            type="text"
            value={testComponentId}
            onChange={(e) => setTestComponentId(e.target.value)}
            placeholder="コンポーネントID (例: ir.surface_generator_v1)"
            className="w-full sm:w-80 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white"
          />
          <button
            onClick={handleTestComponentPromotion}
            className="w-full sm:w-auto px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold whitespace-nowrap"
          >
            入力エビデンスでVERIFIED昇格を実行
          </button>
        </div>
        {transitionMessage && (
          <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono">
            {transitionMessage}
          </div>
        )}
      </div>
    </div>
  );
};
