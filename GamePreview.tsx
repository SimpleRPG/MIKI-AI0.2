import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  RotateCcw,
  Maximize2,
  Terminal,
  Bug,
  Activity,
  Zap,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { ConsoleLogItem, WorkspaceFile } from '../types';
import { buildSandboxHtml } from '../utils/codeParser';

export interface GamePreviewProps {
  files: WorkspaceFile[];
  consoleLogs: ConsoleLogItem[];
  onClearLogs: () => void;
  onAutoDebug: (errorLogs: string[]) => Promise<void>;
  isDebugging: boolean;
  fps: number;
}

export const GamePreview: React.FC<GamePreviewProps> = ({
  files,
  consoleLogs,
  onClearLogs,
  onAutoDebug,
  isDebugging,
  fps,
}) => {
  const [showConsole, setShowConsole] = useState(true);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'all' | 'error'>('all');
  const [reloadCounter, setReloadCounter] = useState(0);

  const sandboxHtml = buildSandboxHtml(files);

  const errorCount = consoleLogs.filter((l) => l.level === 'error').length;
  const filteredLogs = consoleLogs.filter((l) =>
    activeConsoleTab === 'error' ? l.level === 'error' : true
  );

  const handleFullscreen = () => {
    const el = document.getElementById('preview-iframe');
    if (el) {
      if (el.requestFullscreen) el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
    }
  };

  const handleRestart = () => {
    setReloadCounter((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Preview Control Bar */}
      <div className="h-10 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <Play className="w-3.5 h-3.5 text-emerald-400 fill-current" />
            <span>WebGL / Canvas サンドボックス</span>
          </div>

          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400 font-bold">{fps} FPS</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRestart}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            title="再起動 (リロード)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowConsole(!showConsole)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              showConsole
                ? 'bg-slate-800 text-sky-300 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="コンソールログ表示切替"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>ログ</span>
            {errorCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-bold text-[10px]">
                {errorCount}
              </span>
            )}
          </button>

          <button
            onClick={handleFullscreen}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            title="フルスクリーン表示"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Sandbox Iframe Viewport */}
      <div className="flex-1 relative bg-slate-900 overflow-hidden flex items-center justify-center">
        <iframe
          key={reloadCounter}
          id="preview-iframe"
          title="Sandbox Preview"
          srcDoc={sandboxHtml}
          sandbox="allow-scripts allow-modals allow-pointer-lock allow-forms"
          className="w-full h-full border-none bg-slate-950"
        />
      </div>

      {/* Embedded Live Console Drawer */}
      {showConsole && (
        <div className="h-44 bg-slate-900 border-t border-slate-800 flex flex-col shrink-0">
          {/* Console Subheader */}
          <div className="px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                <span>DevTools コンソール</span>
              </span>

              <div className="flex items-center bg-slate-900 p-0.5 rounded border border-slate-800 text-[11px]">
                <button
                  onClick={() => setActiveConsoleTab('all')}
                  className={`px-2 py-0.5 rounded ${
                    activeConsoleTab === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'
                  }`}
                >
                  All ({consoleLogs.length})
                </button>
                <button
                  onClick={() => setActiveConsoleTab('error')}
                  className={`px-2 py-0.5 rounded ${
                    activeConsoleTab === 'error'
                      ? 'bg-rose-950 text-rose-300 font-bold border border-rose-500/40'
                      : 'text-slate-400'
                  }`}
                >
                  Errors ({errorCount})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {errorCount > 0 && (
                <button
                  onClick={() => {
                    const errorMsgs = consoleLogs.filter((l) => l.level === 'error').map((l) => l.message);
                    onAutoDebug(errorMsgs);
                  }}
                  disabled={isDebugging}
                  className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded text-[11px] font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  <Bug className="w-3 h-3" />
                  <span>{isDebugging ? 'AIデバッグ中...' : 'AIで自動修正・デバッグ'}</span>
                </button>
              )}

              <button
                onClick={onClearLogs}
                className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                title="ログ消去"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Console Log Lines */}
          <div className="flex-1 overflow-y-auto p-2 font-mono text-[11.5px] space-y-1 select-text">
            {filteredLogs.length === 0 ? (
              <div className="text-slate-500 text-center py-4">ログはありません</div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-2 px-2 py-0.5 rounded ${
                    log.level === 'error'
                      ? 'bg-rose-950/40 text-rose-300 border border-rose-800/40'
                      : log.level === 'warn'
                      ? 'bg-amber-950/30 text-amber-300'
                      : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <span className="text-slate-500 text-[10px] shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span className="font-bold uppercase text-[10px] shrink-0">[{log.level}]</span>
                  <span className="flex-1 break-all leading-relaxed">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
