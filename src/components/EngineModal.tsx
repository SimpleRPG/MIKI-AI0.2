import React, { useState } from 'react';
import { EngineMode } from '../types';
import { ShieldCheck, X, Cloud, Cpu, Key, Eye, EyeOff, Check, Trash2, CheckCircle2 } from 'lucide-react';
import { getGeminiApiKey, setGeminiApiKey, getJinaApiKeyItem, setJinaApiKeyItem } from '../services/api';

interface EngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  engineMode: EngineMode;
  onSelectEngine: (mode: EngineMode) => void;
}

/**
 * Runtime selection surface & Terminal API Key Configuration.
 * Local generative-model management was retired. The application now has one
 * deterministic local execution path and one explicitly external teacher path.
 */
export const EngineModal: React.FC<EngineModalProps> = ({
  isOpen,
  onClose,
  engineMode,
  onSelectEngine,
}) => {
  const [geminiKey, setLocalGeminiKey] = useState(() => getGeminiApiKey());
  const [jinaKey, setLocalJinaKey] = useState(() => getJinaApiKeyItem());
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showJinaKey, setShowJinaKey] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const select = (mode: EngineMode) => {
    onSelectEngine(mode);
    onClose();
  };

  const handleSaveKeys = () => {
    setGeminiApiKey(geminiKey);
    setJinaApiKeyItem(jinaKey);
    setSaveNotice('API設定を端末内に保存しました。');
    setTimeout(() => setSaveNotice(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4 sticky top-0 bg-slate-900/95 backdrop-blur-xs z-10">
          <div>
            <h2 className="text-base font-bold">実行エンジン ＆ 外部API設定</h2>
            <p className="mt-1 text-xs text-slate-400">Non-LLM Core（決定論的自律ルール）が標準実行されます。</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="閉じる">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">動作モード</h3>
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
          </div>

          {/* 外部APIキー設定 (作業指示書 v23 第1.3節) */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-sky-400" />
                <span>外部連携APIキー設定 (端末内ローカル保管)</span>
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              キーはブラウザの端末内ローカルストレージにのみ保存され、サーバーやAPKのビルド成果物には一切埋め込まれません。
            </p>

            {/* Jina Reader APIキー */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <span>Jina Reader APIキー</span>
                  <span className="text-[10px] text-slate-500 font-normal">(任意)</span>
                </label>
                <span className="text-[10px] font-mono text-emerald-400">
                  {jinaKey ? '✓ 設定あり' : '未入力(DDG/Wikiで動作)'}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400">
                未入力でも動作しますが、入力するとより多く検索できるようになります。
              </p>
              <div className="relative">
                <input
                  type={showJinaKey ? 'text' : 'password'}
                  value={jinaKey}
                  onChange={(e) => setLocalJinaKey(e.target.value)}
                  placeholder="jina_... (空欄で未設定)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 pr-10 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowJinaKey(!showJinaKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showJinaKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Gemini APIキー */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <span>Gemini APIキー</span>
                  <span className="text-[10px] text-slate-500 font-normal">(外部教師用・任意)</span>
                </label>
                <span className="text-[10px] font-mono text-sky-400">
                  {geminiKey ? '✓ 設定あり' : '未入力'}
                </span>
              </div>
              <div className="relative">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => setLocalGeminiKey(e.target.value)}
                  placeholder="AIzaSy... (空欄で外部教師無効)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 pr-10 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between">
              {saveNotice ? (
                <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{saveNotice}</span>
                </div>
              ) : <div />}
              <button
                onClick={handleSaveKeys}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>キー設定を保存</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs leading-relaxed text-amber-200">
            <strong>退役済み:</strong> 旧式のローカル生成・重み更新経路はすべて退役し、Non-LLM Coreのみが実行されます。
          </div>
        </div>
      </div>
    </div>
  );
};
