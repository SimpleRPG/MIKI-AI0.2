import React from 'react';
import type { UiCommandResult } from '../../miki/core/ui/typedCoreUiGatewayService';

export const CoreActionStatus: React.FC<{ result?: UiCommandResult; className?: string }> = ({ result, className = '' }) => {
  if (!result) {
    return null;
  }
  const tone = result.status === 'SUCCESS'
    ? 'border-emerald-700 bg-emerald-950/50 text-emerald-200'
    : result.status === 'BLOCKED'
      ? 'border-amber-700 bg-amber-950/50 text-amber-200'
      : 'border-red-700 bg-red-950/50 text-red-200';
  return (
    <section className={`rounded-2xl border p-3 text-xs ${tone} ${className}`} aria-live="polite">
      <div className="font-bold">{result.status}: {result.summary}</div>
      <div className="mt-1 break-all opacity-80">Command {result.commandId}</div>
      {result.taskId ? <div className="break-all opacity-80">Task {result.taskId}</div> : null}
      {result.receiptIds.length > 0 ? <div className="break-all opacity-80">Receipt {result.receiptIds.join(', ')}</div> : null}
    </section>
  );
};
