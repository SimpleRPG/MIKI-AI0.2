import React from 'react';
import { EngineMode } from '../types';
import { ShieldCheck, X, Cloud, Cpu } from 'lucide-react';

interface EngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  engineMode: EngineMode;
  onSelectEngine: (mode: EngineMode) => void;
}

/**
 * Runtime selection surface.
 * Local generative-model management was retired. The application now has one
 * deterministic local execution path and one explicitly external teacher path.
 */
export const EngineModal: React.FC<EngineModalProps> = ({
  isOpen,
  onClose,
  engineMode,
  onSelectEngine,
}) => {
  if (!isOpen) return null;

  const select = (mode: EngineMode) => {
    onSelectEngine(mode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <div>
            <h2 className="text-base font-bold">実行エンジン</h2>
            <p className="mt-1 text-xs text-slate-400">ローカル生成モデルはアーキテクチャから退役済みです。</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="閉じる">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <button
            onClick={() => select('autonomous_rule')}
            className={`w-full rounded-xl border p-4 text-left transition ${engineMode === 'autonomous_rule' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'}`}
          >
            <div className="flex items-start gap-3">
              <Cpu className="mt-0.5 h-5 w-5 text-emerald-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold">Non-LLM Core <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">標準</span></div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">記憶・状態・規則・制約・検証・回答構造を決定論的に実行します。モデルのダウンロードや推論待機はありません。</p>
              </div>
              {engineMode === 'autonomous_rule' && <ShieldCheck className="h-5 w-5 text-emerald-400" />}
            </div>
          </button>

          <button
            onClick={() => select('gemini_cloud')}
            className={`w-full rounded-xl border p-4 text-left transition ${engineMode === 'gemini_cloud' ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'}`}
          >
            <div className="flex items-start gap-3">
              <Cloud className="mt-0.5 h-5 w-5 text-sky-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold">外部教師（Gemini）</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">必要時だけ外部知識を取得する教師経路です。取得結果はNon-LLM Core側で検証・構造化して利用します。</p>
              </div>
              {engineMode === 'gemini_cloud' && <ShieldCheck className="h-5 w-5 text-sky-400" />}
            </div>
          </button>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs leading-relaxed text-amber-200">
            <strong>退役済み:</strong> 旧式のローカル生成・重み更新経路はすべて退役し、Non-LLM Coreのみが実行されます。
          </div>
        </div>
      </div>
    </div>
  );
};
