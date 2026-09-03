import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  FileCode,
  FlaskConical,
  Ban,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  FolderOpen,
  Hash,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { CompletionEvaluation, CompletionStatus } from '../types';
import { completionJudgeService } from '../services/completionJudgeService';

interface CompletionBadgeProps {
  evaluation: CompletionEvaluation;
  onMarkCompleted?: () => void;
  onMarkFailed?: (reason: string) => void;
}

export const CompletionBadge: React.FC<CompletionBadgeProps> = ({
  evaluation,
  onMarkCompleted,
  onMarkFailed,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  const badgeConfig = completionJudgeService.getBadgeConfig(evaluation.status);
  const checklist = evaluation.checklist;

  const handleCopyHash = () => {
    if (checklist.storageTracking.contentHash) {
      navigator.clipboard.writeText(checklist.storageTracking.contentHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const renderStatusIcon = (status: CompletionStatus) => {
    switch (status) {
      case 'COMPLETE':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'EXTERNAL_COMPILE_REQUIRED':
        return <FileCode className="w-3.5 h-3.5 text-amber-400" />;
      case 'RUNTIME_TEST_REQUIRED':
        return <FlaskConical className="w-3.5 h-3.5 text-violet-400" />;
      case 'PARTIAL':
        return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />;
      case 'BLOCKED':
        return <Ban className="w-3.5 h-3.5 text-rose-400" />;
      case 'FAILED':
        return <XCircle className="w-3.5 h-3.5 text-red-400" />;
      case 'CANCELLED':
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div className="w-full flex flex-col gap-1.5 my-1 font-sans">
      {/* 完了状態バッジバー */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all shadow-sm ${badgeConfig.bgColor} ${badgeConfig.borderColor} ${badgeConfig.textColor} hover:brightness-110`}
          title={`${badgeConfig.description} (クリックして7大チェックリストを展開)`}
        >
          {renderStatusIcon(evaluation.status)}
          <span>{badgeConfig.label}</span>
          <span className="px-1.5 py-0.2 rounded bg-black/20 text-[10.5px] font-mono opacity-90">
            {evaluation.score}点
          </span>
          {isExpanded ? (
            <ChevronUp className="w-3 h-3 ml-0.5 opacity-70 group-hover:opacity-100" />
          ) : (
            <ChevronDown className="w-3 h-3 ml-0.5 opacity-70 group-hover:opacity-100" />
          )}
        </button>

        {/* VBAまたはコードが含まれる場合の注意喚起ミニタグ */}
        {evaluation.isCodeOrVba && evaluation.requiresExternalVerification && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10.5px] text-amber-300/80 bg-amber-950/40 border border-amber-500/20 px-2 py-0.5 rounded-md">
            <span>⚠️ スマホ静的検証済 → 外部環境確認必須</span>
          </span>
        )}
      </div>

      {/* 展開時: 文書48章 7大完成条件チェックリスト詳細ドロワー */}
      {isExpanded && (
        <div className="w-full bg-slate-950/95 border border-slate-800 rounded-xl p-3 text-xs space-y-3 shadow-xl backdrop-blur-sm animate-fadeIn">
          {/* ヘッダー: 判定サマリー */}
          <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-1.5 text-slate-200 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                <span>文書48章 完了判定器 (Completion Judge)</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  ({new Date(evaluation.evaluatedAt).toLocaleTimeString()})
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                {evaluation.reason}
              </p>
            </div>

            {/* 手動状態更新アクション */}
            {evaluation.status !== 'COMPLETE' && onMarkCompleted && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={onMarkCompleted}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all"
                  title="Excel等の実機環境で動作・コンパイルを確認できたため完了にする"
                >
                  <Check className="w-3 h-3" />
                  <span>実機確認完了 (COMPLETEへ)</span>
                </button>
                {onMarkFailed && (
                  <button
                    type="button"
                    onClick={() => {
                      const reason = window.prompt('エラーや問題の内容を入力してください:');
                      if (reason) onMarkFailed(reason);
                    }}
                    className="px-2 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded-lg text-[11px] flex items-center gap-1 transition-all"
                    title="実機実行でエラーが出たことを記録"
                  >
                    <XCircle className="w-3 h-3" />
                    <span>エラー報告</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 7大チェックリストグリッド */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
            {/* 1. 依頼の目的を満たしたか */}
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                {checklist.goalSatisfaction.passed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-200">1. 依頼目的の充足</div>
                <div className="text-slate-400 text-[10.5px] mt-0.5">
                  {checklist.goalSatisfaction.note}
                </div>
              </div>
            </div>

            {/* 2. 成果物の存在 */}
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                {checklist.artifactPresence.passed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-200">2. 成果物の存在</div>
                <div className="text-slate-400 text-[10.5px] mt-0.5">
                  {checklist.artifactPresence.summary || '未検出'}
                </div>
              </div>
            </div>

            {/* 3. 必須項目の充足 */}
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                {checklist.requiredItems.passed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-200">3. 必須項目の充足</div>
                <div className="text-[10.5px] mt-0.5">
                  {checklist.requiredItems.fulfilled.length > 0 && (
                    <div className="text-emerald-400">
                      ✓ {checklist.requiredItems.fulfilled.join(', ')}
                    </div>
                  )}
                  {checklist.requiredItems.missing.length > 0 && (
                    <div className="text-amber-400 mt-0.5">
                      ⚠️ 不足: {checklist.requiredItems.missing.join(', ')}
                    </div>
                  )}
                  {checklist.requiredItems.fulfilled.length === 0 &&
                    checklist.requiredItems.missing.length === 0 && (
                      <span className="text-slate-400">要件を満たしています</span>
                    )}
                </div>
              </div>
            </div>

            {/* 4. 検証結果の有無 */}
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                {checklist.verification.status === 'verified' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : checklist.verification.status === 'static_only' ? (
                  <FileCode className="w-3.5 h-3.5 text-amber-400" />
                ) : checklist.verification.status === 'failed' ? (
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <span>4. 検証結果</span>
                  <span
                    className={`text-[9.5px] px-1.5 py-0.2 rounded font-mono ${
                      checklist.verification.status === 'verified'
                        ? 'bg-emerald-950 text-emerald-300'
                        : checklist.verification.status === 'static_only'
                        ? 'bg-amber-950 text-amber-300'
                        : checklist.verification.status === 'failed'
                        ? 'bg-rose-950 text-rose-300'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {checklist.verification.status}
                  </span>
                </div>
                <div className="text-slate-400 text-[10.5px] mt-0.5">
                  {checklist.verification.note}
                </div>
              </div>
            </div>

            {/* 5. 未解決事項の有無と明示 */}
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                {!checklist.unresolvedIssues.hasIssues ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : checklist.unresolvedIssues.explicitlyNoted ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-200">5. 未解決事項の有無と明示</div>
                <div className="text-[10.5px] mt-0.5">
                  {checklist.unresolvedIssues.hasIssues ? (
                    <div className="text-yellow-300">
                      {checklist.unresolvedIssues.issues.join(' / ')}
                      <span className="text-[9.5px] text-slate-400 ml-1">
                        (本文中に明記{checklist.unresolvedIssues.explicitlyNoted ? '済' : '無'})
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400">特になし (クリア)</span>
                  )}
                </div>
              </div>
            </div>

            {/* 6. 保存先とハッシュの記録 */}
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-200 flex items-center justify-between">
                  <span>6. 保存先とハッシュ</span>
                  {checklist.storageTracking.contentHash && (
                    <button
                      type="button"
                      onClick={handleCopyHash}
                      className="text-[9.5px] text-slate-400 hover:text-white flex items-center gap-1 font-mono"
                      title="ハッシュ値をコピー"
                    >
                      <Hash className="w-2.5 h-2.5" />
                      <span>{checklist.storageTracking.contentHash}</span>
                      {copiedHash ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                    </button>
                  )}
                </div>
                <div className="text-slate-400 text-[10.5px] mt-0.5 truncate">
                  保存先: {checklist.storageTracking.savedLocation || '未設定'}
                </div>
              </div>
            </div>
          </div>

          {/* 7. 次操作の要否 */}
          <div className="p-2.5 rounded-lg bg-sky-950/30 border border-sky-500/20 text-[11px] flex items-start gap-2">
            <ArrowRight className="w-3.5 h-3.5 text-sky-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-sky-200">7. 次に行う操作: </span>
              <span className="text-slate-300">{checklist.nextAction.note}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
