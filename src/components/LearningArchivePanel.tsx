import React, { useRef, useState } from 'react';
import { Archive, Download, Upload, RotateCcw } from 'lucide-react';
import {
  learningStateArchiveService,
  type LearningArchiveManifest,
} from '../miki/learning/services/learningStateArchiveService';

// P378: manual preservation of learned state. Export bundles the
// registered learning stores into one ZIP the user can keep or move
// to another device; import verifies hashes, keeps a rollback copy
// of the pre-import state, and asks for an app restart so every
// service re-reads the restored state.
export const LearningArchivePanel: React.FC = () => {
  const [localState, setLocalState] = useState(() => learningStateArchiveService.inspectLocalState());
  const [hasBackup, setHasBackup] = useState(() => learningStateArchiveService.hasPreImportBackup());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<LearningArchiveManifest | undefined>(undefined);
  const [pendingFile, setPendingFile] = useState<File | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  const formatBytes = (n: number): string =>
    n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;
  const totalBytes = localState.reduce((sum, item) => sum + item.bytes, 0);
  const refresh = () => {
    setLocalState(learningStateArchiveService.inspectLocalState());
    setHasBackup(learningStateArchiveService.hasPreImportBackup());
  };

  const handleExport = async () => {
    setBusy(true);
    setMessage('');
    try {
      const { blob, fileName, manifest } = await learningStateArchiveService.exportArchive();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(`書き出しました（${manifest.entries.length}件、合計 ${formatBytes(manifest.totalBytes)}）。このZIPを安全な場所に保管してください`);
      refresh();
    } catch (error) {
      setMessage(`書き出しに失敗しました: ${String(error instanceof Error ? error.message : error)}`);
    } finally {
      setBusy(false);
    }
  };

  const handlePick = async (file: File) => {
    setBusy(true);
    setMessage('');
    setPreview(undefined);
    setPendingFile(undefined);
    try {
      const result = await learningStateArchiveService.inspectArchive(file);
      if (!result.ok || !result.manifest) {
        setMessage(result.message);
        return;
      }
      setPreview(result.manifest);
      setPendingFile(file);
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!pendingFile) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await learningStateArchiveService.importArchive(pendingFile);
      setMessage(result.message);
      if (result.ok) {
        setPreview(undefined);
        setPendingFile(undefined);
        refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRollback = () => {
    const result = learningStateArchiveService.rollbackImport();
    setMessage(result.message);
    refresh();
  };

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100">
          <Archive className="h-4 w-4 text-indigo-300" />
          学習の保全（この端末で学んだ内容）
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          経験・教訓・知識・事例・証拠・予測の履歴は、この端末の中にだけあります。自己コードはGitHubから取り直せますが、
          学んだ内容は取り直せません。ZIPに書き出して手元に保管したり、別の端末へ移したりできます（常時同期はしません）。
        </p>
        <div className="mt-3 space-y-1">
          {localState.map(item => (
            <div key={item.key} className="flex items-center justify-between text-xs">
              <span className={item.present ? 'text-slate-300' : 'text-slate-500'}>{item.label}</span>
              <span className="font-mono text-slate-400">{item.present ? formatBytes(item.bytes) : 'なし'}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-slate-800 pt-1 text-xs font-bold">
            <span className="text-slate-200">合計</span>
            <span className="font-mono text-slate-200">{formatBytes(totalBytes)}</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            disabled={busy}
            onClick={handleExport}
            className="min-h-12 rounded-2xl bg-indigo-600 px-3 text-sm font-bold disabled:bg-slate-700"
          >
            <Download className="mr-2 inline h-4 w-4" />
            ZIPに書き出す
          </button>
          <button
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="min-h-12 rounded-2xl bg-slate-800 px-3 text-sm font-bold disabled:opacity-50"
          >
            <Upload className="mr-2 inline h-4 w-4" />
            ZIPを読み込む
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={event => {
            const file = event.target.files?.[0];
            if (file) void handlePick(file);
            event.target.value = '';
          }}
        />
        {preview && (
          <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <div>
              書き出し日時: {new Date(preview.exportedAt).toLocaleString()} / {preview.entries.length}件 / 合計{' '}
              {formatBytes(preview.totalBytes)}
            </div>
            <div className="mt-1">読み込むと現在の学習内容は置き換わります（読み込み前の状態は自動で控えます）。</div>
            <button
              disabled={busy}
              onClick={handleImport}
              className="mt-2 min-h-10 w-full rounded-xl bg-amber-600 px-3 font-bold text-white disabled:bg-slate-700"
            >
              この内容で復元する
            </button>
          </div>
        )}
        {hasBackup && (
          <button
            disabled={busy}
            onClick={handleRollback}
            className="mt-3 min-h-10 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 text-xs font-bold"
          >
            <RotateCcw className="mr-2 inline h-3.5 w-3.5" />
            前回の読み込み前に戻す
          </button>
        )}
        {message && (
          <div role="status" className="mt-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs">
            {message}
          </div>
        )}
      </section>
    </div>
  );
};
