import React, { useState } from 'react';
import {
  FileCode,
  Plus,
  Trash2,
  Play,
  Copy,
  Check,
  Folder,
} from 'lucide-react';
import { WorkspaceFile } from '../types';

interface CodeEditorProps {
  files: WorkspaceFile[];
  activeFilePath: string;
  onSelectFile: (path: string) => void;
  onUpdateFileContent: (path: string, content: string) => void;
  onCreateFile: (name: string) => void;
  onDeleteFile: (path: string) => void;
  onApplySandbox: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  files,
  activeFilePath,
  onSelectFile,
  onUpdateFileContent,
  onCreateFile,
  onDeleteFile,
  onApplySandbox,
}) => {
  const [newFileName, setNewFileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeFile = files.find((f) => f.path === activeFilePath) || files[0];

  const handleCreate = () => {
    if (!newFileName.trim()) return;
    onCreateFile(newFileName.trim());
    setNewFileName('');
    setIsCreating(false);
  };

  const handleCopy = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate line numbers
  const lines = (activeFile?.content || '').split('\n');

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* File Tree Explorer Sidebar */}
      <div className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-sky-400" />
            <span>ファイル構成 ({files.length})</span>
          </span>
          <button
            onClick={() => setIsCreating(true)}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-sky-300 rounded transition-colors"
            title="新規ファイル作成"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* New file input */}
        {isCreating && (
          <div className="p-2 border-b border-slate-800 bg-slate-950/60 flex items-center gap-1">
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setIsCreating(false);
              }}
              placeholder="filename.js / style.css"
              autoFocus
              className="flex-1 bg-slate-900 border border-sky-500/50 rounded px-2 py-1 text-xs text-slate-100 outline-none"
            />
            <button
              onClick={handleCreate}
              className="px-2 py-1 bg-sky-600 hover:bg-sky-500 rounded text-[10px] font-bold text-white"
            >
              作成
            </button>
          </div>
        )}

        {/* File list */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {files.map((file) => {
            const isActive = file.path === activeFile?.path;
            const isIndex = file.path.endsWith('index.html');
            return (
              <div
                key={file.path}
                onClick={() => onSelectFile(file.path)}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
                  <span className="truncate">{file.name}</span>
                </div>

                {!isIndex && files.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`ファイル「${file.name}」を削除しますか？`)) {
                        onDeleteFile(file.path);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition-opacity"
                    title="削除"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Sync / Run Sandbox Button */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/80">
          <button
            onClick={onApplySandbox}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-2 px-3 rounded-lg text-xs shadow-md shadow-sky-500/20 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>プレビューへ即時反映</span>
          </button>
        </div>
      </div>

      {/* Code Editor Body */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Editor Tab Bar */}
        <div className="h-10 bg-slate-900/90 border-b border-slate-800 px-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
            {files.map((file) => (
              <button
                key={file.path}
                onClick={() => onSelectFile(file.path)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono transition-colors ${
                  file.path === activeFile?.path
                    ? 'bg-slate-950 text-sky-400 font-semibold border border-slate-800'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3 h-3" />
                <span>{file.name}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
              title="コードをコピー"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'コピー完了' : 'コピー'}</span>
            </button>
          </div>
        </div>

        {/* Code Content Area with Line Numbers */}
        <div className="flex-1 flex overflow-hidden bg-slate-950 font-mono text-xs">
          {/* Line Numbers */}
          <div className="w-12 bg-slate-950/90 border-r border-slate-800/80 p-3 select-none text-right font-mono text-slate-600 space-y-1 overflow-hidden">
            {lines.map((_, i) => (
              <div key={i} className="leading-5">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Textarea */}
          <div className="flex-1 relative overflow-hidden">
            <textarea
              value={activeFile?.content || ''}
              onChange={(e) => {
                if (activeFile) onUpdateFileContent(activeFile.path, e.target.value);
              }}
              spellCheck={false}
              className="w-full h-full p-3 bg-transparent text-slate-200 font-mono text-xs leading-5 border-none outline-none resize-none overflow-auto select-text whitespace-pre tab-4"
              style={{ tabSize: 2 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
