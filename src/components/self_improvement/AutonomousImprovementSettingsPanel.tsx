import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Clock3, FileUp, Save, RefreshCw } from 'lucide-react';
import { typedImprovementUiGatewayService } from '../../miki/core/ui/typedImprovementUiGatewayService';
import { storageService } from '../../services/storageService';

const STORAGE_KEY = 'miki.autonomousImprovementSettings.v1';

type DurationMode = '15m' | '1h' | '6h' | '24h' | 'forever';
interface Settings { duration: DurationMode; intervalSeconds: number; title: string; directive: string; }
const defaults: Settings = { duration: '1h', intervalSeconds: 15, title: 'アプリからの自律改善指示', directive: '' };

const durationMs = (mode: DurationMode) => mode === 'forever' ? Number.POSITIVE_INFINITY : ({ '15m': 15, '1h': 60, '6h': 360, '24h': 1440 }[mode] * 60_000);

export const AutonomousImprovementSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<Settings>(() => {
    try { return { ...defaults, ...storageService.getJson(STORAGE_KEY, {}) }; } catch { return defaults; }
  });
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [message, setMessage] = useState('待機中');
  const stopRef = useRef(false);

  useEffect(() => {
    try { storageService.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* localStorage unavailable */ }
  }, [settings]);

  const saveSettings = () => {
    try { storageService.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
    setMessage('設定を保存しました');
  };

  const ingestDirective = (text: string) => {
    if (!text.trim()) return;
    const directive = typedImprovementUiGatewayService.ingestDirectiveText(text, settings.title || undefined);
    setSettings(s => ({ ...s, directive: text }));
    setMessage(`作業指示書を取り込みました: ${directive.title}`);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    ingestDirective(text);
  };

  const runLoop = async () => {
    if (running) return;
    stopRef.current = false;
    setRunning(true);
    const started = Date.now();
    setStartedAt(started);
    try {
      const limit = durationMs(settings.duration);
      let cycle = 0;
      while (!stopRef.current && (limit === Number.POSITIVE_INFINITY || Date.now() - started < limit)) {
        cycle += 1;
        try {
          const result = settings.directive.trim()
            ? await typedImprovementUiGatewayService.startSpecifiedImprovement(settings.directive.trim(), settings.title.trim() || 'アプリからの自律改善指示')
            : await typedImprovementUiGatewayService.discoverImprovementTarget(settings.title.trim() || undefined);
          setMessage(`サイクル ${cycle}: Task=${result.taskId || '未発行'} / Plan=${result.corePlanRevision ?? result.planRevision ?? '未確定'} / Stage=${result.currentStage}`);
          if (result.stopReason) {
            setMessage(`サイクル ${cycle} 停止: ${result.stopReason}`);
            break;
          }
        } catch (error) {
          setMessage(`サイクル ${cycle} エラー: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (stopRef.current) break;
        await new Promise(resolve => setTimeout(resolve, Math.max(5, settings.intervalSeconds) * 1000));
      }
      if (!stopRef.current) setMessage('設定した時間が終了しました');
    } finally {
      setRunning(false);
      setStartedAt(null);
      stopRef.current = false;
    }
  };

  const stopLoop = () => { stopRef.current = true; setMessage('停止要求を送信しました…'); };

  return (
    <div className="mb-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Clock3 className="w-4 h-4 text-indigo-600" />アプリから自律改善を設定</h3>
          <p className="text-xs text-slate-500 mt-1">Termuxを操作せず、このアプリ画面から正規自己改善サイクルを繰り返します。</p>
        </div>
        <div className="text-xs text-slate-500">状態: <span className={running ? 'text-emerald-600 font-semibold' : 'text-slate-700'}>{running ? '実行中' : '停止中'}</span></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <label className="text-xs text-slate-600">実行時間
          <select value={settings.duration} disabled={running} onChange={e => setSettings(s => ({ ...s, duration: e.target.value as DurationMode }))} className="mt-1 w-full border rounded-lg p-2 text-sm bg-slate-50">
            <option value="15m">15分</option><option value="1h">1時間</option><option value="6h">6時間</option><option value="24h">24時間</option><option value="forever">ずっと（停止するまで）</option>
          </select>
        </label>
        <label className="text-xs text-slate-600">サイクル間隔（秒）
          <input type="number" min={5} max={3600} value={settings.intervalSeconds} disabled={running} onChange={e => setSettings(s => ({ ...s, intervalSeconds: Math.max(5, Number(e.target.value) || 15) }))} className="mt-1 w-full border rounded-lg p-2 text-sm bg-slate-50" />
        </label>
        <label className="text-xs text-slate-600">指示書タイトル
          <input value={settings.title} disabled={running} onChange={e => setSettings(s => ({ ...s, title: e.target.value }))} className="mt-1 w-full border rounded-lg p-2 text-sm bg-slate-50" />
        </label>
      </div>

      <label className="block text-xs text-slate-600 mb-1">作業指示書（Markdown / TXT）</label>
      <textarea value={settings.directive} disabled={running} onChange={e => setSettings(s => ({ ...s, directive: e.target.value }))} placeholder="目的・対象・要求内容・禁止事項・完了条件を入力…" className="w-full h-28 border rounded-xl p-3 text-xs font-mono bg-slate-50 resize-none" />
      <div className="flex flex-wrap gap-2 mt-3">
        <label className="px-3 py-2 rounded-lg border bg-white text-xs cursor-pointer flex items-center gap-1.5"><FileUp className="w-3.5 h-3.5" />指示書ファイルを読み込む<input type="file" accept=".md,.txt,text/markdown,text/plain" className="hidden" onChange={e => handleFile(e.target.files?.[0])} /></label>
        <button onClick={() => ingestDirective(settings.directive)} disabled={running || !settings.directive.trim()} className="px-3 py-2 rounded-lg border bg-white text-xs flex items-center gap-1.5 disabled:opacity-40"><RefreshCw className="w-3.5 h-3.5" />指示書を取り込む</button>
        <button onClick={saveSettings} disabled={running} className="px-3 py-2 rounded-lg border bg-white text-xs flex items-center gap-1.5 disabled:opacity-40"><Save className="w-3.5 h-3.5" />設定保存</button>
        {!running ? <button onClick={runLoop} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1.5"><Play className="w-3.5 h-3.5" />自律改善を開始</button> : <button onClick={stopLoop} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5"><Square className="w-3.5 h-3.5" />停止</button>}
      </div>
      <div className="mt-3 text-xs text-slate-500">{message}{startedAt ? ` / 開始: ${new Date(startedAt).toLocaleTimeString()}` : ''}</div>
      <div className="mt-2 text-[11px] text-slate-400">既存のEvidence/Safety/Canoary等の正規パイプラインを経由します。指示書から任意のシェルコマンドを実行する機能は追加していません。</div>
    </div>
  );
};
