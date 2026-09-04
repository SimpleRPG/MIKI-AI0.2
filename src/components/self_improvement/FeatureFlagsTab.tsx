import React, { useState } from 'react';
import {
  Flag,
  CheckCircle2,
  Shield,
  HelpCircle,
  RotateCcw,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import { FeatureFlagState, SystemFeatureFlags } from '../../types';
import {
  featureFlagsService,
  FEATURE_FLAG_DESCRIPTIONS,
} from '../../services/featureFlagsService';

export const FeatureFlagsTab: React.FC = () => {
  const [flags, setFlags] = useState<SystemFeatureFlags>(() =>
    featureFlagsService.getAllFlags()
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleStateChange = (key: keyof SystemFeatureFlags, newState: FeatureFlagState) => {
    featureFlagsService.setFlagState(key, newState);
    setFlags({ ...featureFlagsService.getAllFlags() });
    setSuccessMsg(`フラグ [${key}] を「${newState}」に変更しました`);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleResetDefaults = () => {
    featureFlagsService.resetToDefaults();
    setFlags({ ...featureFlagsService.getAllFlags() });
    setSuccessMsg('全機能フラグを設計思想の初期規定値へリセットしました');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const stateColors: Record<FeatureFlagState, string> = {
    STABLE: 'bg-emerald-950 text-emerald-300 border-emerald-700',
    LIMITED: 'bg-sky-950 text-sky-300 border-sky-700',
    SHADOW: 'bg-indigo-950 text-indigo-300 border-indigo-700',
    DEVELOPMENT: 'bg-amber-950 text-amber-300 border-amber-700',
    DISABLED: 'bg-slate-900 text-slate-400 border-slate-700',
  };

  return (
    <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(85vh-120px)] text-slate-200">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950/50 border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs flex items-center gap-1 border border-indigo-500/30">
              <Flag className="w-3.5 h-3.5" />
              <span>設計思想 31章</span>
            </span>
            <h3 className="font-bold text-sm text-slate-100">
              システム機能フラグ管理 (System Feature Flags)
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            アーキテクチャの各モジュール（基盤チャット、短期文脈、長期検索、回答骨格、LoRA学習等）の稼働状態を個別に制御・昇格・降格します。
          </p>
        </div>

        <button
          onClick={handleResetDefaults}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all shrink-0"
        >
          <RotateCcw className="w-3 h-3" />
          <span>初期値に戻す</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 rounded-lg text-xs text-emerald-300 font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Feature Flags Grid */}
      <div className="space-y-3">
        {(Object.keys(flags) as Array<keyof SystemFeatureFlags>).map((key) => {
          const currentState = flags[key];
          const info = FEATURE_FLAG_DESCRIPTIONS[key];
          const isLora = key === 'LORA_TRAINING';

          return (
            <div
              key={key}
              className={`p-3.5 rounded-xl border text-xs space-y-2.5 transition-all ${
                isLora
                  ? 'bg-slate-950/90 border-purple-900/50'
                  : 'bg-slate-950/70 border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-200 text-xs">{key}</span>
                    <span className="text-slate-400 text-xs font-semibold">
                      ({info?.title || key})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed max-w-xl">
                    {info?.desc}
                  </p>
                </div>

                {/* State selector pills */}
                <div className="flex items-center gap-1 shrink-0">
                  {(['DISABLED', 'DEVELOPMENT', 'SHADOW', 'LIMITED', 'STABLE'] as FeatureFlagState[]).map(
                    (state) => {
                      const isActive = currentState === state;
                      return (
                        <button
                          key={state}
                          onClick={() => handleStateChange(key, state)}
                          className={`px-2 py-1 rounded text-[10px] font-bold font-mono transition-all border ${
                            isActive
                              ? stateColors[state] + ' shadow-sm ring-1 ring-white/20'
                              : 'bg-black/30 border-slate-800 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {state}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {isLora && currentState === 'DISABLED' && (
                <div className="p-2 bg-purple-950/20 border border-purple-800/40 rounded-lg text-[10.5px] text-purple-300/90 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>
                    【安全規約 16.2章】LoRA追加学習は、検索・記憶・回答骨格で制御が頭打ちになり発動条件を満たすまで恒久的にDISABLEDとして安全ロックされています。
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
