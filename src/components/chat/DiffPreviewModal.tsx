import React, { useState } from 'react';
import {
  X,
  Check,
  FileCode,
  ShieldCheck,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import {
  mikiSelfCodingSuperchargerService,
  DiffResult,
  SyntaxCheckResult,
} from '../../services/mikiSelfCodingSuperchargerService';

interface DiffPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  oldCode: string;
  newCode: string;
  onApply: (appliedCode: string) => void;
}

export const DiffPreviewModal: React.FC<DiffPreviewModalProps> = ({
  isOpen,
  onClose,
  fileName,
  oldCode,
  newCode,
  onApply,
}) => {
  if (!isOpen) return null;

  const [isApplying, setIsApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  // 差分計算
  const diff: DiffResult = React.useMemo(() => {
    return mikiSelfCodingSuperchargerService.computeUnifiedDiff(oldCode, newCode);
  }, [oldCode, newCode]);

  // 構文チェック
  const syntaxCheck: SyntaxCheckResult = React.useMemo(() => {
    return mikiSelfCodingSuperchargerService.checkCodeSyntax(newCode, fileName);
  }, [newCode, fileName]);

  const handleApply = async () => {
    setIsApplying(true);
    try {
      // 適用コールバック
      onApply(newCode);
      setApplySuccess(true);
      setTimeout(() => {
        setApplySuccess(false);
        onClose();
      }, 1200);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-purple-500/40 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* ヘッダー */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-purple-950/80 border border-purple-800/60 rounded-lg text-purple-300">
              <FileCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-100 flex items-center gap-2 truncate">
                <span>差分プレビュー & 安全適用</span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded truncate">
                  {fileName}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-3 mt-0.5 font-mono">
                <span className="text-emerald-400 font-bold">+{diff.additions} 行追加</span>
                <span className="text-rose-400 font-bold">-{diff.deletions} 行削除</span>
                <span>{diff.unchanged} 行変更なし</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 構文ステータスバー */}
        <div className="px-4 py-2 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {syntaxCheck.valid ? (
              <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5" />
                AST構文検証パス (構文エラーなし)
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1 font-mono text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5" />
                構文警告: {syntaxCheck.error}
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
            適用時に自動でスナップショットが退避されます
          </span>
        </div>

        {/* 差分ビューワー (スクロール可能) */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 font-mono text-[11px] leading-relaxed bg-black/90 select-text">
          {diff.lines.map((line, idx) => {
            const isAdded = line.type === 'added';
            const isRemoved = line.type === 'removed';

            return (
              <div
                key={idx}
                className={`flex items-start px-2 py-0.5 rounded-xs transition-colors ${
                  isAdded
                    ? 'bg-emerald-950/60 text-emerald-300 border-l-2 border-emerald-500'
                    : isRemoved
                    ? 'bg-rose-950/60 text-rose-300 border-l-2 border-rose-500 line-through opacity-80'
                    : 'text-slate-400 hover:bg-slate-900/50'
                }`}
              >
                {/* 行番号 */}
                <div className="w-12 text-right pr-3 select-none text-[10px] text-slate-600 shrink-0 font-mono">
                  {line.oldLineNumber || ''}
                  {isAdded ? '+' : isRemoved ? '-' : ' '}
                </div>

                {/* コード内容 */}
                <pre className="flex-1 whitespace-pre-wrap break-all font-mono">
                  {line.text || ' '}
                </pre>
              </div>
            );
          })}
        </div>

        {/* フッターアクションバー */}
        <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
          >
            キャンセル
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 active:scale-95 transition-all"
          >
            {applySuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>ワークスペースに適用完了！</span>
              </>
            ) : isApplying ? (
              <span>適用中...</span>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                <span>スナップショット保護付きで安全適用</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
