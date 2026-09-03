import React, { useState } from 'react';
import {
  Layers,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  ShieldCheck,
  Code2,
  Wrench,
  FileText,
} from 'lucide-react';
import { TaskPlan, TaskStep, TaskStepStatus } from '../types';

interface TaskPlanCardProps {
  plan: TaskPlan;
  onSelectStep?: (step: TaskStep) => void;
}

export const TaskPlanCard: React.FC<TaskPlanCardProps> = ({ plan }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  const getStatusIcon = (status: TaskStepStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'in_progress':
        return (
          <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
            <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        );
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />;
      case 'skipped':
        return <Clock className="w-4 h-4 text-neutral-400 shrink-0 opacity-60" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600 shrink-0 mx-1" />;
    }
  };

  const getActionBadge = (actionType?: string) => {
    switch (actionType) {
      case 'analysis':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40">
            <FileText className="w-3 h-3" />
            要件分析
          </span>
        );
      case 'tool_execution':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40">
            <Wrench className="w-3 h-3" />
            ツール実行
          </span>
        );
      case 'code_generation':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40">
            <Code2 className="w-3 h-3" />
            コード生成
          </span>
        );
      case 'verification':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
            <ShieldCheck className="w-3 h-3" />
            自己検証
          </span>
        );
      case 'synthesis':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/40">
            <Cpu className="w-3 h-3" />
            結論統合
          </span>
        );
      default:
        return null;
    }
  };

  const progressPercent =
    plan.totalSteps > 0 ? Math.round((plan.completedSteps / plan.totalSteps) * 100) : 0;

  return (
    <div className="my-2.5 rounded-xl border border-indigo-100 dark:border-indigo-950/60 bg-gradient-to-b from-indigo-50/40 to-white dark:from-indigo-950/20 dark:to-neutral-900/60 p-3 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                多段推論タスク計画
              </span>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                {plan.completedSteps}/{plan.totalSteps} 完了 ({progressPercent}%)
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded transition-colors"
          title={isExpanded ? '折りたたむ' : '展開する'}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-neutral-200/60 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden mb-2">
        <div
          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Steps List */}
      {isExpanded && (
        <div className="space-y-1.5 pt-1">
          {plan.steps.map((step) => {
            const isStepExpanded = expandedStepId === step.id;
            const isCurrent = step.status === 'in_progress';

            return (
              <div
                key={step.id}
                className={`rounded-lg p-2 text-xs transition-colors border ${
                  isCurrent
                    ? 'border-indigo-300 dark:border-indigo-800 bg-white/80 dark:bg-neutral-800/80 shadow-xs'
                    : step.status === 'completed'
                    ? 'border-neutral-200/70 dark:border-neutral-800/70 bg-neutral-50/50 dark:bg-neutral-900/30'
                    : 'border-transparent bg-transparent opacity-80'
                }`}
              >
                <div
                  className="flex items-center justify-between gap-2 cursor-pointer select-none"
                  onClick={() => setExpandedStepId(isStepExpanded ? null : step.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getStatusIcon(step.status)}
                    <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                      {step.stepNumber}. {step.title}
                    </span>
                    {getActionBadge(step.actionType)}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 text-neutral-400">
                    {step.durationMs ? (
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {step.durationMs}ms
                      </span>
                    ) : null}
                    {isStepExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>

                {isStepExpanded && (
                  <div className="mt-2 pl-6 space-y-1.5 text-neutral-600 dark:text-neutral-300">
                    <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                      {step.description}
                    </p>

                    {step.toolCall && (
                      <div className="p-1.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-mono">
                        🛠 ツール: {step.toolCall.toolName || step.toolCall.toolId}
                      </div>
                    )}

                    {step.result && (
                      <div className="p-2 rounded bg-neutral-100 dark:bg-neutral-800/80 text-[11px] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto border border-neutral-200/50 dark:border-neutral-700/50">
                        {step.result}
                      </div>
                    )}

                    {step.error && (
                      <div className="p-1.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px]">
                        ⚠️ {step.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Checkpoint / Summary Banner */}
      {plan.checkpoint && (
        <div className="mt-2 pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            チェックポイント保存済み
          </span>
          {plan.finalSummary && (
            <span className="truncate max-w-[200px] text-indigo-600 dark:text-indigo-400 font-medium">
              {plan.finalSummary}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
