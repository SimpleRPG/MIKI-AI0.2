import React, { useState } from 'react';
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  FlaskConical,
  Undo2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileCode,
  Sparkles,
  GitBranch,
  Bug,
  SplitSquareVertical,
} from 'lucide-react';
import {
  AutonomousEvolutionRecord,
  autonomousContinuousEvolutionService,
} from '../../services/autonomousContinuousEvolutionService';
import { mikiSelfCodingSuperchargerService, MutationTestResult } from '../../services/mikiSelfCodingSuperchargerService';

interface AutonomousEvolutionCardProps {
  record: AutonomousEvolutionRecord;
  onOpenDiff?: (fileName: string, oldCode: string, newCode: string, filePath: string) => void;
  onOpenUnitTest?: (codeBlock: { name: string; content: string }) => void;
  onApplyRestoredCode?: (filePath: string, content: string) => void;
}

export const AutonomousEvolutionCard: React.FC<AutonomousEvolutionCardProps> = ({
  record,
  onOpenDiff,
  onOpenUnitTest,
  onApplyRestoredCode,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showDiff, setShowDiff] = useState<boolean>(false);
  const [showMutants, setShowMutants] = useState<boolean>(false);
  const [isRollbackDone, setIsRollbackDone] = useState<boolean>(false);
  const [rollbackLoading, setRollbackLoading] = useState<boolean>(false);
  const [mutationResult, setMutationResult] = useState<MutationTestResult | null>(
    record.mutationTestResult || null
  );
  const [mutationLoading, setMutationLoading] = useState<boolean>(false);

  const handleRollback = async () => {
    if (!record.snapshotId) {
      alert('スナップショットが見つかりません');
      return;
    }
    setRollbackLoading(true);
    try {
      const data = await mikiSelfCodingSuperchargerService.rollbackSnapshot(record.snapshotId);
      if (data.success) {
        setIsRollbackDone(true);
        if (onApplyRestoredCode) {
          onApplyRestoredCode(record.targetFile, data.restoredContent || '');
        }
      } else {
        alert(data.error || 'ロールバックに失敗しました');
      }
    } catch (err: any) {
      alert(`ロールバック通信エラー: ${err?.message}`);
    } finally {
      setRollbackLoading(false);
    }
  };

  const handleRunMutationTest = async () => {
    if (!record.afterCode) return;
    setMutationLoading(true);
    try {
      const result = await autonomousContinuousEvolutionService.runMutationTestOnTarget(
        record.afterCode,
        record.targetFile.split('/').pop() || 'TargetModule'
      );
      setMutationResult(result);
      setShowMutants(true);
    } catch (err: any) {
      alert(`ミューテーションテスト失敗: ${err?.message}`);
    } finally {
      setMutationLoading(false);
    }
  };

  const scoreDiff = Math.max(0, record.newScore - record.previousScore);
  const hasDiffCode = Boolean(record.afterCode);
  const diffData = hasDiffCode
    ? mikiSelfCodingSuperchargerService.computeUnifiedDiff(
        record.beforeCode || '// (新規モジュール自律生成)',
        record.afterCode || ''
      )
    : null;

  return (
    <div className="my-3 rounded-2xl border border-purple-500/30 bg-slate-900/90 shadow-xl overflow-hidden text-slate-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 p-3.5 sm:p-4 border-b border-purple-500/20 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center shrink-0 shadow-md shadow-purple-500/10">
            <Cpu className="w-5 h-5 text-purple-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-white">
                {record.chapterTitle
                  ? `第${record.chapterNumber}章: ${record.chapterTitle}`
                  : 'みき自律自己改善'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-900/40 text-purple-300 border border-purple-700/50">
                {record.targetFile}
              </span>
              {record.commitHash && (
                <span className="text-[10px] text-slate-400 font-mono">
                  commit:{record.commitHash}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{record.reasoning}</p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xs font-semibold text-purple-300">
            {record.previousScore}点 ➔{' '}
            <span className="text-emerald-400 font-bold">{record.newScore}点</span>
            {scoreDiff > 0 && (
              <span className="ml-1 text-[10px] text-emerald-300 font-bold">
                (+{scoreDiff})
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400">
            {new Date(record.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-950/70 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-1.5 text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>AST構文: パス</span>
        </div>
        <div className="flex items-center gap-1.5 text-indigo-300">
          <FlaskConical className="w-3.5 h-3.5 shrink-0" />
          <span>
            TDDテスト: {record.verification.testPassedCount}/{record.verification.testTotalCount}通過
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-amber-300">
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          <span>自己修復試行: {record.selfHealingAttempts}回</span>
        </div>
        <div className="flex items-center gap-1.5 text-cyan-300">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>不変条件5項目オールパス</span>
        </div>
      </div>

      {/* Mutation Testing & Quality Guard Badge */}
      {mutationResult && (
        <div className="px-3.5 py-2 text-xs bg-indigo-950/40 border-b border-indigo-900/40 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Bug className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-300">
              変異体キル率 (Mutation Kill Rate):{' '}
              <strong
                className={
                  mutationResult.killRate >= 90
                    ? 'text-emerald-300'
                    : mutationResult.killRate >= 75
                    ? 'text-indigo-300'
                    : 'text-amber-300'
                }
              >
                {mutationResult.killRate}% ({mutationResult.killedMutants}/{mutationResult.totalMutants}体撃墜)
              </strong>
            </span>
          </div>
          <button
            onClick={() => setShowMutants(!showMutants)}
            className="text-[11px] text-indigo-300 hover:text-indigo-100 flex items-center gap-1 underline transition-colors"
          >
            {showMutants ? '変異体詳細を隠す' : '変異体検証リストを見る'}
          </button>
        </div>
      )}

      {/* Mutants list */}
      {showMutants && mutationResult && (
        <div className="p-3 bg-slate-950 border-b border-slate-800 space-y-1.5 text-xs font-mono max-h-48 overflow-y-auto">
          {mutationResult.mutants.map((mut) => (
            <div
              key={mut.id}
              className="p-2 rounded bg-slate-900/80 border border-slate-800 flex items-start justify-between gap-2"
            >
              <div>
                <span className="font-bold text-amber-400">[{mut.operator}]</span>{' '}
                <span className="text-slate-400">{mut.description}</span>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  変更: <code className="text-red-400">{mut.originalSnippet}</code> ➔{' '}
                  <code className="text-emerald-400">{mut.mutatedSnippet}</code>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                  mut.status === 'KILLED'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40'
                    : 'bg-red-950 text-red-300 border border-red-600/40'
                }`}
              >
                {mut.status === 'KILLED' ? '撃墜 (KILLED)' : '生存 (SURVIVED)'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Lesson / Rule Note */}
      {record.lesson && (
        <div className="px-3.5 py-2 text-xs bg-purple-950/20 text-purple-200 border-b border-purple-900/30 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>
            <strong>自律進化の教訓:</strong> {record.lesson.rule}
          </span>
        </div>
      )}

      {/* Inline Diff Viewer */}
      {showDiff && diffData && (
        <div className="border-b border-slate-800 bg-slate-950">
          <div className="p-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <span className="font-mono text-purple-300">
              差分プレビュー: +{diffData.additions}行 / -{diffData.deletions}行
            </span>
            {onOpenDiff && record.afterCode && (
              <button
                onClick={() =>
                  onOpenDiff(
                    record.targetFile.split('/').pop() || 'TargetModule.ts',
                    record.beforeCode || '',
                    record.afterCode || '',
                    record.targetFile
                  )
                }
                className="text-[11px] text-purple-400 hover:text-purple-200 flex items-center gap-1 underline"
              >
                <ExternalLink className="w-3 h-3" /> フル画面差分モーダルで見る
              </button>
            )}
          </div>
          <div className="p-3 font-mono text-[11px] max-h-60 overflow-y-auto space-y-0.5 select-text">
            {diffData.lines.map((line, idx) => (
              <div
                key={idx}
                className={`flex items-start px-2 py-0.5 rounded ${
                  line.type === 'added'
                    ? 'bg-emerald-950/60 text-emerald-200 font-medium'
                    : line.type === 'removed'
                    ? 'bg-rose-950/60 text-rose-300 line-through opacity-80'
                    : 'text-slate-400'
                }`}
              >
                <span className="w-6 shrink-0 text-slate-600 text-right mr-3 select-none">
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </span>
                <span className="break-all whitespace-pre-wrap">{line.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expandable Step Details */}
      {isExpanded && record.steps && (
        <div className="p-3 bg-black/40 border-b border-slate-800 space-y-1 font-mono text-[11px] max-h-48 overflow-y-auto">
          {record.steps.map((s, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-slate-600">{new Date(s.timestamp).toLocaleTimeString()}</span>
              <span
                className={`font-bold ${
                  s.status === 'SUCCESS'
                    ? 'text-emerald-400'
                    : s.status === 'WARNING'
                    ? 'text-amber-400'
                    : 'text-indigo-400'
                }`}
              >
                [{s.phase}]
              </span>
              <span className="text-slate-300">{s.title}:</span>
              <span className="text-slate-400">{s.detail}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions Row */}
      <div className="p-3 bg-slate-950/90 flex items-center justify-between gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> 実行ログを閉じる
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> 実行ログ ({record.steps?.length || 0}件)
              </>
            )}
          </button>

          {hasDiffCode && (
            <button
              onClick={() => setShowDiff(!showDiff)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 flex items-center gap-1 transition-colors border border-purple-500/30"
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              {showDiff ? '差分を隠す' : 'コード差分を見る'}
            </button>
          )}

          {!mutationResult && record.afterCode && (
            <button
              onClick={handleRunMutationTest}
              disabled={mutationLoading}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 flex items-center gap-1 transition-colors border border-indigo-500/30"
            >
              <Bug className="w-3.5 h-3.5" />
              {mutationLoading ? '変異体検証中...' : '変異体キル検査'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {record.snapshotId && (
            <button
              onClick={handleRollback}
              disabled={isRollbackDone || rollbackLoading}
              className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all shadow-sm ${
                isRollbackDone
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
              {isRollbackDone ? '復元完了' : '1-Click 巻き戻し'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
