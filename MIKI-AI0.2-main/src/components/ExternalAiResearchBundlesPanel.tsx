import React, { useEffect, useMemo, useState } from 'react';
import {
  typedResearchUiGatewayService,
} from '../miki/core/ui/typedResearchUiGatewayService';

const downloadText = (fileName: string, content: string): void => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const ExternalAiResearchBundlesPanel: React.FC = () => {
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState('');
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const bundles = useMemo(
    () => typedResearchUiGatewayService.listExternalAiResearchBundles(),
    [revision],
  );
  const current = bundles.find((item) => item.bundleId === selected) || bundles[0];

  useEffect(() => {
    if (!selected && bundles[0]) {
      setSelected(bundles[0].bundleId);
    }
  }, [bundles, selected]);

  const run = async (operation: () => Promise<void>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await operation();
      setRevision((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '操作に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="mr-auto text-sm font-bold text-slate-200">外部AI 調査バンドル</h4>
        <button
          type="button"
          disabled={busy}
          className="min-h-11 rounded bg-violet-700 px-3 py-2 text-xs text-white disabled:opacity-50"
          onClick={() => run(async () => {
            const made = await typedResearchUiGatewayService.buildExternalAiResearchBundles('GEMINI');
            if (made[0]) setSelected(made[0].bundleId);
            setStatus(made.length ? `${made.length}件のバンドルを作成しました。` : '対象Gapはありません。');
          })}
        >
          Gapから作成
        </button>
        {current && (
          <button
            type="button"
            disabled={busy}
            className="min-h-11 rounded bg-cyan-700 px-3 py-2 text-xs text-white disabled:opacity-50"
            onClick={() => run(async () => {
              const sent = await typedResearchUiGatewayService.sendExternalAiResearchBundle(current.bundleId);
              if (!sent) throw new Error('BUNDLE_NOT_FOUND');
              setStatus(`自動質問を送信しました: ${sent.bundleId}`);
            })}
          >
            自動で質問
          </button>
        )}
      </div>

      {status && <p className="rounded bg-emerald-950/60 p-2 text-xs text-emerald-200">{status}</p>}
      {error && <p className="rounded bg-red-950/60 p-2 text-xs text-red-200">{error}</p>}

      {current ? (
        <>
          <select
            className="min-h-11 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs"
            value={current.bundleId}
            onChange={(event) => setSelected(event.target.value)}
          >
            {bundles.map((item) => (
              <option key={item.bundleId} value={item.bundleId}>
                {item.bundleId} / {item.status} / {item.gapIds.length} Gap
              </option>
            ))}
          </select>

          <textarea
            className="h-40 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs"
            readOnly
            value={current.promptText}
          />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              className="min-h-11 rounded bg-slate-700 px-3 py-2 text-xs"
              onClick={async () => {
                const text = typedResearchUiGatewayService.getExternalAiResearchPrompt(current.bundleId);
                if (!text) return;
                await navigator.clipboard.writeText(text);
                setStatus('質問文をコピーしました。');
              }}
            >
              コピー
            </button>
            <button
              type="button"
              className="min-h-11 rounded bg-slate-700 px-3 py-2 text-xs"
              onClick={() => {
                const item = typedResearchUiGatewayService.exportExternalAiResearchPrompt(current.bundleId);
                if (item) downloadText(item.fileName, item.content);
              }}
            >
              質問TXT
            </button>
            <button
              type="button"
              className="min-h-11 rounded bg-slate-700 px-3 py-2 text-xs"
              onClick={() => {
                const item = typedResearchUiGatewayService.exportExternalAiResearchResponseTemplate(current.bundleId);
                if (item) downloadText(item.fileName, item.content);
              }}
            >
              返信テンプレート
            </button>
          </div>

          <textarea
            className="h-40 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs"
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            placeholder="外部AIの返信を貼り付け"
          />
          <button
            type="button"
            disabled={busy || !response.trim()}
            className="min-h-12 w-full rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => run(async () => {
              const imported = await typedResearchUiGatewayService.importExternalAiResearchResponse(
                current.bundleId,
                response.trim(),
              );
              if (!imported) throw new Error('BUNDLE_NOT_FOUND');
              setResponse('');
              setStatus(`返信を取り込みました: Evidence ${imported.evidenceIds.length}件`);
            })}
          >
            返信を取り込む
          </button>
        </>
      ) : (
        <p className="text-xs text-slate-400">未解決Gapから調査バンドルを作成できます。</p>
      )}
    </div>
  );
};
