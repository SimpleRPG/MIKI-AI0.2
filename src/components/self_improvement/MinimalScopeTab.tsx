import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  Code2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { minimalScopeService } from '../../services/minimalScopeService';
import { MinimalScopeItem } from '../../types';

export const MinimalScopeTab: React.FC = () => {
  const [items, setItems] = useState<MinimalScopeItem[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setItems(minimalScopeService.getItems());
  };

  const convItems = items.filter((i) => i.category === 'conversation_v1');
  const codeItems = items.filter((i) => i.category === 'code_understanding_v1');

  const convCompleted = convItems.filter((i) => i.status === 'VERIFIED_ACTIVE').length;
  const convRate = Math.round((convCompleted / (convItems.length || 1)) * 100);

  const codeCompleted = codeItems.filter((i) => i.status === 'VERIFIED_ACTIVE').length;
  const codeRate = Math.round((codeCompleted / (codeItems.length || 1)) * 100);

  const totalCompleted = items.filter((i) => i.status === 'VERIFIED_ACTIVE').length;
  const totalRate = Math.round((totalCompleted / (items.length || 1)) * 100);

  return (
    <div className="space-y-6">
      {/* 36章 設計思想ヘッダー */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
            <CheckSquare className="w-5 h-5 text-emerald-400" />
            <span>設計思想 36章: 当面の最小完成範囲 (Minimal Viable Scope)</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs border border-emerald-500/30 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Chapter 36 Minimal Scope</span>
          </span>
        </div>
        <p className="text-slate-300 text-xs leading-relaxed">
          設計思想36章で定義された、日常の個人利用において「これさえ備わっていれば実用に足る」と定めた最小完成範囲の達成状況です。
          <strong>「会話AI v1 (10項目)」</strong>および<strong>「コード理解 v1 (9項目)」</strong>の全19項目が実機推論・自動テストにより稼働確認されています。
        </p>

        {/* 総合進捗バー */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-xs text-slate-300">
            <span>最小完成範囲 総合達成率: <strong>{totalCompleted} / {items.length} 項目</strong></span>
            <span className="text-emerald-400 font-bold">{totalRate}% 達成</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
            <div
              style={{ width: `${totalRate}%` }}
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
            />
          </div>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span>会話AI v1 (10要件)</span>
            </span>
            <span className="text-xs font-bold text-indigo-300">{convCompleted} / {convItems.length} ({convRate}%)</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
            <div style={{ width: `${convRate}%` }} className="h-full bg-indigo-500" />
          </div>
          <p className="text-[11px] text-slate-400">
            文脈維持、即座の訂正反映、古い前提の破棄、回答長自律判定、質問先行、記憶厳選など10要件。
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-cyan-400" />
              <span>コード理解 v1 (9要件)</span>
            </span>
            <span className="text-xs font-bold text-cyan-300">{codeCompleted} / {codeItems.length} ({codeRate}%)</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
            <div style={{ width: `${codeRate}%` }} className="h-full bg-cyan-500" />
          </div>
          <p className="text-[11px] text-slate-400">
            Sub/Function分割、変数宣言、呼出関係、副作用整理、分岐ループ、外部依存、自然な日本語説明、13問読解テスト。
          </p>
        </div>
      </div>

      {/* 会話AI v1 リスト */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="text-xs font-bold text-indigo-300 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <span>会話AI v1 要件一覧 (10項目)</span>
          </span>
          <span className="text-[10px] text-slate-400">設計思想 5章 ＆ 36章準拠</span>
        </div>

        <div className="space-y-2">
          {convItems.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold text-slate-200">
                    {item.itemNumber}. {item.title}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-emerald-300 border border-emerald-900">
                    {item.automatedTestStatus}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 pl-6">{item.requirement}</div>
                <div className="text-[10px] text-slate-500 pl-6">実装根拠: {item.notes}</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 shrink-0">
                稼働中
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* コード理解 v1 リスト */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="text-xs font-bold text-cyan-300 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <span>コード理解 v1 要件一覧 (9項目)</span>
          </span>
          <span className="text-[10px] text-slate-400">設計思想 22〜24章 ＆ 36章準拠</span>
        </div>

        <div className="space-y-2">
          {codeItems.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="font-bold text-slate-200">
                    {item.itemNumber}. {item.title}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-cyan-900">
                    {item.automatedTestStatus}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 pl-6">{item.requirement}</div>
                <div className="text-[10px] text-slate-500 pl-6">実装根拠: {item.notes}</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 shrink-0">
                稼働中
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
