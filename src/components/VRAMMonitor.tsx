import React from 'react';
import { Cpu } from 'lucide-react';

interface VRAMMonitorProps {
  compact?: boolean;
}

export const VRAMMonitor: React.FC<VRAMMonitorProps> = ({ compact = false }) => (
  <div className={"rounded-xl border border-slate-700 bg-slate-900/60 p-3 " + (compact ? 'text-xs' : '')}>
    <div className="flex items-center gap-2 font-semibold text-slate-200"><Cpu className="w-4 h-4" /> Non-LLM実行予算</div>
    <div className="mt-1 text-[11px] text-slate-400">生成モデルVRAMは使用しません。CPU/NPU/GPUの決定論的処理へ割り当てます。</div>
  </div>
);
