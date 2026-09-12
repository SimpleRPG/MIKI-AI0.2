import React from 'react';
import { ShieldCheck, Cpu } from 'lucide-react';

export const GgufModelManager: React.FC = () => (
  <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-sm space-y-2">
    <div className="flex items-center gap-2 font-bold text-emerald-300"><ShieldCheck className="w-4 h-4" /> ローカル生成モデルは退役済み</div>
    <p className="text-slate-300 text-xs leading-relaxed">旧式の生成モデル管理機能は退役しています。現在は決定論的 Non-LLM Core の部品・検証・実行予算を使用します。</p>
    <div className="flex items-center gap-2 text-xs text-slate-400"><Cpu className="w-3.5 h-3.5" /> Runtime policy: NON_LLM_ONLY</div>
  </div>
);
