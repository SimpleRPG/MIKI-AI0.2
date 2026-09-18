/**
 * 設計思想 第31章 31.3: 「なぜこの回答？」説明パネル (Why This Answer Inspector Modal)
 */

import React from 'react';
import { WhyAnswerInspection } from '../../types';
import { X, HelpCircle, Target, Database, GitFork, Wrench, AlertTriangle, FileText, Layers } from 'lucide-react';

interface WhyAnswerInspectorModalProps {
  inspection: WhyAnswerInspection | null;
  isOpen: boolean;
  onClose: () => void;
}

export const WhyAnswerInspectorModal: React.FC<WhyAnswerInspectorModalProps> = ({
  inspection,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !inspection) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* ヘッダー */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                なぜこの回答？ 内部推論インスペクター
                <span className="text-[10px] px-2 py-0.5 font-mono font-bold bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 rounded-full">
                  第31.3章仕様
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                AIが回答を導出する際に使用した前提・記憶・回答骨格・長さの理由を透過的に公開
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-200">
          {/* 1. 理解した質問 ＆ 推定した目的 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-sky-400 font-semibold text-[11px]">
                <HelpCircle className="w-3.5 h-3.5" />
                理解した質問
              </div>
              <p className="text-slate-300 leading-relaxed font-mono text-[11px]">
                {inspection.understoodQuestion}
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                <Target className="w-3.5 h-3.5" />
                推定した目的 (ユーザーゴール)
              </div>
              <p className="text-slate-300 leading-relaxed">
                {inspection.estimatedGoal}
              </p>
            </div>
          </div>

          {/* 2. 回答骨格 ＆ 回答長理由 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-violet-400 font-semibold text-[11px]">
                <Layers className="w-3.5 h-3.5" />
                選択した回答骨格 (第7章/第28章)
              </div>
              <p className="font-mono text-indigo-300 font-semibold">
                {inspection.selectedAnswerPlan}
              </p>
              <p className="text-[10px] text-slate-400">
                説明深度: {inspection.explanationDepth}
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                <FileText className="w-3.5 h-3.5" />
                回答長を選んだ理由
              </div>
              <p className="text-slate-300 leading-relaxed">
                {inspection.lengthReason}
              </p>
            </div>
          </div>

          {/* 3. 使用した記憶 ＆ 抑制した競合記憶 */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-teal-400 font-semibold">
                <Database className="w-3.5 h-3.5" />
                使用した記憶スニペット ({inspection.usedMemories.length} 件)
              </span>
              <span className="text-[10px] text-slate-400">第21章 記憶検索連動</span>
            </div>
            {inspection.usedMemories.length > 0 ? (
              <div className="space-y-1.5">
                {inspection.usedMemories.map((m, idx) => (
                  <div key={idx} className="p-2 bg-slate-900/90 border border-slate-800/80 rounded-lg flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 font-mono">"{m.snippet}"</span>
                    <span className="text-[10px] text-teal-400 px-1.5 py-0.5 bg-teal-950 rounded border border-teal-800/60">
                      {m.category || '確定記憶'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">会話文脈のみで完結（外部記憶の参照なし）</p>
            )}

            {inspection.suppressedMemories.length > 0 && (
              <div className="pt-2 border-t border-slate-800/60">
                <span className="text-[10px] text-slate-400 font-medium block mb-1">
                  使用しなかった競合記憶 (スコア抑制):
                </span>
                {inspection.suppressedMemories.map((sm, idx) => (
                  <div key={idx} className="text-[10px] text-slate-400 flex justify-between">
                    <span className="truncate max-w-[70%]">"{sm.snippet}"</span>
                    <span className="text-rose-400/80">{sm.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. 検索・ツール利用 ＆ 未確認事項 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-[11px]">
                <Wrench className="w-3.5 h-3.5" />
                検索・ツール利用
              </div>
              <ul className="space-y-1 text-slate-300 text-[11px]">
                {inspection.toolsOrSearchUsed.map((t, idx) => (
                  <li key={idx} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5" />
                未確認事項 (推定補完)
              </div>
              <ul className="space-y-1 text-slate-300 text-[11px]">
                {inspection.unconfirmedAssumptions.map((u, idx) => (
                  <li key={idx} className="flex items-center gap-1 text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>{u}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            内部透明性ガイド: 誤回答があれば「違う」と指摘すれば第31.1章ライブリペアが即座に起動します
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
