import React, { useMemo, useState } from 'react';

export interface DestructiveActionConfirmDialogProps {
  open: boolean;
  title: string;
  summary: string;
  target: string;
  expectedPhrase?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export const DestructiveActionConfirmDialog: React.FC<DestructiveActionConfirmDialogProps> = ({
  open,
  title,
  summary,
  target,
  expectedPhrase = '実行',
  busy = false,
  onCancel,
  onConfirm,
}) => {
  const [phrase, setPhrase] = useState('');
  const allowed = useMemo(() => phrase.trim() === expectedPhrase && !busy, [phrase, expectedPhrase, busy]);
  if (!open) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="destructive-action-title">
      <div className="w-full max-w-md rounded-3xl border border-red-800 bg-slate-950 p-4 text-white shadow-2xl">
        <h2 id="destructive-action-title" className="text-lg font-black text-red-300">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{summary}</p>
        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 text-xs break-all">対象: {target}</div>
        <label className="mt-4 block text-xs font-bold text-slate-300">
          確認のため「{expectedPhrase}」と入力
          <input value={phrase} onChange={event => setPhrase(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-base" autoComplete="off" />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-12 rounded-xl bg-slate-800 font-bold disabled:opacity-50">戻る</button>
          <button type="button" onClick={() => void onConfirm()} disabled={!allowed} className="min-h-12 rounded-xl bg-red-700 font-bold disabled:bg-slate-700">{busy ? '処理中' : '実行'}</button>
        </div>
      </div>
    </div>
  );
};
