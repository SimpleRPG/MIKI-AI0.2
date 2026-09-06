import React, { useState, useRef, useMemo } from 'react';
import {
  FileCode,
  Plus,
  Trash2,
  Play,
  Copy,
  Check,
  Folder,
  FolderOpen,
  Upload,
  Download,
  ChevronRight,
  ChevronDown,
  X,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Music,
  Menu,
  Type,
  ListFilter,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { WorkspaceFile } from '../types';
import { extractFilesFromZip, ZipExtractionResult } from '../utils/codeParser';

interface CodeEditorProps {
  files: WorkspaceFile[];
  activeFilePath: string;
  onSelectFile: (path: string) => void;
  onUpdateFileContent: (path: string, content: string) => void;
  onCreateFile: (name: string) => void;
  onDeleteFile: (path: string) => void;
  onDeleteFolder?: (folderPath: string) => void;
  onApplySandbox: () => void;
  onImportZip?: (importedFiles: WorkspaceFile[], projectName?: string) => void;
  onExportZip?: () => void;
}

// フォルダツリー構造の型定義
interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  file?: WorkspaceFile;
  children: Record<string, TreeNode>;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  files,
  activeFilePath,
  onSelectFile,
  onUpdateFileContent,
  onCreateFile,
  onDeleteFile,
  onDeleteFolder,
  onApplySandbox,
  onImportZip,
  onExportZip,
}) => {
  const [newFileName, setNewFileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('sm');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // 削除確認モーダル状態 (誤削除防止・スマホフレンドリー)
  const [pendingDelete, setPendingDelete] = useState<{
    type: 'file' | 'folder';
    path: string;
    displayName: string;
    fileCount?: number;
  } | null>(null);

  // ZIPインポート関連状態
  const [isExtractingZip, setIsExtractingZip] = useState(false);
  const [zipResultModal, setZipResultModal] = useState<ZipExtractionResult | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const activeFile = files.find((f) => f.path === activeFilePath) || files[0];

  // フォルダツリー構造の自動構築
  const fileTree = useMemo(() => {
    const root: TreeNode = {
      name: '',
      path: '',
      isFolder: true,
      children: {},
    };

    files.forEach((file) => {
      const parts = file.path.split('/').filter(Boolean);
      let current = root;

      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join('/');

        if (isLast) {
          current.children[part] = {
            name: part,
            path: currentPath,
            isFolder: false,
            file,
            children: {},
          };
        } else {
          if (!current.children[part]) {
            current.children[part] = {
              name: part,
              path: currentPath,
              isFolder: true,
              children: {},
            };
          }
          current = current.children[part];
        }
      });
    });

    return root;
  }, [files]);

  const toggleFolder = (folderPath: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

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

  // ファイル削除リクエスト (確認ダイアログを開く)
  const requestDeleteFile = (file: WorkspaceFile) => {
    setPendingDelete({
      type: 'file',
      path: file.path,
      displayName: file.name,
    });
  };

  // フォルダ削除リクエスト (確認ダイアログを開く)
  const requestDeleteFolder = (folderPath: string) => {
    const containedFiles = files.filter(
      (f) => f.path === folderPath || f.path.startsWith(`${folderPath}/`)
    );
    setPendingDelete({
      type: 'folder',
      path: folderPath,
      displayName: folderPath.split('/').pop() || folderPath,
      fileCount: containedFiles.length,
    });
  };

  // 削除確定実行
  const confirmDelete = () => {
    if (!pendingDelete) return;

    if (pendingDelete.type === 'file') {
      onDeleteFile(pendingDelete.path);
    } else if (pendingDelete.type === 'folder') {
      if (onDeleteFolder) {
        onDeleteFolder(pendingDelete.path);
      } else {
        // フォールバック: フォルダ内の全ファイルを順次削除
        const contained = files.filter(
          (f) => f.path === pendingDelete.path || f.path.startsWith(`${pendingDelete.path}/`)
        );
        contained.forEach((f) => onDeleteFile(f.path));
      }
    }

    setPendingDelete(null);
  };

  // ZIPファイル選択処理
  const handleZipFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processZipFile(file);
    if (zipInputRef.current) zipInputRef.current.value = '';
  };

  // ZIP処理本体 (ドラッグ＆ドロップ対応)
  const processZipFile = async (file: File | Blob) => {
    setIsExtractingZip(true);
    try {
      const result = await extractFilesFromZip(file);
      if (result.success && result.files.length > 0) {
        setZipResultModal(result);
      } else {
        alert(`ZIPの解凍に失敗しました: ${result.error || '有効なファイルがありません'}`);
      }
    } catch (err: any) {
      alert(`ZIP読み込みエラー: ${err?.message || '不明なエラー'}`);
    } finally {
      setIsExtractingZip(false);
    }
  };

  // 解凍したZIPをワークスペースに適用
  const applyImportedZip = (replace: boolean) => {
    if (!zipResultModal) return;

    if (onImportZip) {
      onImportZip(zipResultModal.files, zipResultModal.projectName);
    } else {
      // フォールバック: 既存ファイルを削除してから追加、またはマージ
      if (replace) {
        files.forEach((f) => onDeleteFile(f.path));
      }
      zipResultModal.files.forEach((f) => {
        onUpdateFileContent(f.path, f.content);
      });
      if (zipResultModal.files[0]) {
        onSelectFile(zipResultModal.files[0].path);
      }
    }

    setZipResultModal(null);
    setIsMobileSidebarOpen(false);
  };

  // ドラッグ＆ドロップ
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const item = e.dataTransfer.files?.[0];
    if (item && item.name.toLowerCase().endsWith('.zip')) {
      await processZipFile(item);
    }
  };

  // 拡張子アイコン
  const getFileIcon = (fileName: string, language?: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['html', 'htm'].includes(ext)) return <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) return <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    if (['css', 'scss'].includes(ext)) return <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    if (['json'].includes(ext)) return <FileText className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || language === 'image')
      return <ImageIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    if (['mp3', 'wav', 'ogg'].includes(ext) || language === 'audio')
      return <Music className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
    return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  };

  // 再帰的ファイルツリーレンダリング
  const renderTreeNodes = (nodes: Record<string, TreeNode>, depth = 0) => {
    const sortedKeys = Object.keys(nodes).sort((a, b) => {
      const nodeA = nodes[a];
      const nodeB = nodes[b];
      if (nodeA.isFolder && !nodeB.isFolder) return -1;
      if (!nodeA.isFolder && nodeB.isFolder) return 1;
      return a.localeCompare(b);
    });

    return sortedKeys.map((key) => {
      const node = nodes[key];
      const isCollapsed = collapsedFolders[node.path];

      if (node.isFolder) {
        return (
          <div key={node.path} className="select-none">
            <div
              onClick={() => toggleFolder(node.path)}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              className="group flex items-center justify-between py-1.5 pr-2 rounded hover:bg-slate-800/70 text-slate-300 text-xs cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-1.5 truncate">
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                )}
                {isCollapsed ? (
                  <Folder className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                ) : (
                  <FolderOpen className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                )}
                <span className="font-medium truncate">{node.name}</span>
              </div>

              {/* フォルダ削除ボタン */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  requestDeleteFolder(node.path);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 rounded transition-opacity"
                title={`フォルダ「${node.name}」を削除`}
              >
                <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-400" />
              </button>
            </div>

            {!isCollapsed && renderTreeNodes(node.children, depth + 1)}
          </div>
        );
      }

      const file = node.file!;
      const isActive = file.path === activeFile?.path;

      return (
        <div
          key={file.path}
          onClick={() => {
            onSelectFile(file.path);
            setIsMobileSidebarOpen(false);
          }}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded text-xs cursor-pointer transition-colors ${
            isActive
              ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
              : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            {getFileIcon(file.name, file.language)}
            <span className="truncate">{file.name}</span>
          </div>

          {files.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                requestDeleteFile(file);
              }}
              className="opacity-70 group-hover:opacity-100 p-1 hover:text-rose-400 rounded transition-opacity"
              title={`ファイル「${file.name}」を削除`}
            >
              <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-400" />
            </button>
          )}
        </div>
      );
    });
  };

  const lines = (activeFile?.content || '').split('\n');

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
      className="relative flex flex-col md:flex-row h-full bg-slate-950 text-slate-100 overflow-hidden select-none"
    >
      {/* 隠しZIP入力 */}
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={handleZipFileSelected}
        className="hidden"
      />

      {/* ドラッグ＆ドロップ オーバーレイ */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-sky-950/80 backdrop-blur-sm border-2 border-dashed border-sky-400 flex flex-col items-center justify-center gap-3">
          <Upload className="w-12 h-12 text-sky-400 animate-bounce" />
          <div className="text-lg font-bold text-sky-200">ZIPファイルをドロップして解凍・インポート</div>
          <div className="text-xs text-sky-400">フォルダ階層・コード・アセットをそのまま復元します</div>
        </div>
      )}

      {/* ======================================================== */}
      {/* モバイル用 トップバー (スマホ幅で快適操作) */}
      {/* ======================================================== */}
      <div className="md:hidden flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 text-sky-300 text-xs font-bold border border-slate-700 active:bg-slate-700"
        >
          <Menu className="w-4 h-4" />
          <span>ファイル一覧 ({files.length})</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => zipInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold border border-slate-700 active:scale-95 transition-all"
            title="アプリのZIPを解凍インポート"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span>ZIP読込</span>
          </button>

          <button
            onClick={onApplySandbox}
            className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-sky-500 to-indigo-600 text-white rounded-lg text-xs font-bold shadow-md shadow-sky-500/20 active:scale-95 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>反映</span>
          </button>
        </div>
      </div>

      {/* モバイル用 横スクロール ファイルピルバー */}
      <div className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border-b border-slate-800/80 overflow-x-auto shrink-0 scrollbar-none">
        {files.map((file) => {
          const isActive = file.path === activeFile?.path;
          return (
            <button
              key={file.path}
              onClick={() => onSelectFile(file.path)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono whitespace-nowrap shrink-0 transition-all ${
                isActive
                  ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {getFileIcon(file.name, file.language)}
              <span className="max-w-[120px] truncate">{file.name}</span>
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* デスクトップ用 サイドバー / モバイル用 スライドドロワー */}
      {/* ======================================================== */}
      <div
        className={`
          fixed inset-0 z-40 md:static md:z-auto
          ${isMobileSidebarOpen ? 'flex' : 'hidden md:flex'}
          md:w-64 bg-slate-900/95 md:bg-slate-900 border-r border-slate-800 flex-col shrink-0
        `}
      >
        {/* モバイル表示時の背景タップクローズ */}
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="md:hidden absolute inset-0 bg-black/60 backdrop-blur-xs"
        />

        <div className="relative z-10 flex flex-col h-full w-4/5 max-w-xs md:w-full bg-slate-900 border-r border-slate-800">
          {/* サイドバーヘッダー */}
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-sky-400" />
              <span>ワークスペース ({files.length})</span>
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsCreating(true)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-sky-300 rounded transition-colors"
                title="新規ファイル作成"
              >
                <Plus className="w-4 h-4" />
              </button>

              <button
                onClick={() => zipInputRef.current?.click()}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-sky-300 rounded transition-colors"
                title="ZIPファイルを解凍インポート"
              >
                <Upload className="w-4 h-4" />
              </button>

              {/* モバイル用クローズボタン */}
              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="md:hidden p-1.5 hover:bg-slate-800 text-slate-400 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 新規ファイル作成入力 */}
          {isCreating && (
            <div className="p-2 border-b border-slate-800 bg-slate-950/80 flex items-center gap-1">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') setIsCreating(false);
                }}
                placeholder="src/main.js または index.html"
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

          {/* フォルダツリー一覧 */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {renderTreeNodes(fileTree.children)}
          </div>

          {/* サイドバー下部アクション */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/90 space-y-2">
            <button
              onClick={() => {
                onApplySandbox();
                setIsMobileSidebarOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-2.5 px-3 rounded-lg text-xs shadow-md shadow-sky-500/20 active:scale-98 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>プレビューへ即時反映</span>
            </button>

            {onExportZip && (
              <button
                onClick={onExportZip}
                className="w-full flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-1.5 px-3 rounded-lg text-xs border border-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>ZIPでエクスポート</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* メイン エディタ領域 */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* エディタ ツールバー */}
        <div className="h-11 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 truncate">
            {activeFile && (
              <div className="flex items-center gap-1.5 font-mono text-xs text-sky-400 font-bold truncate">
                {getFileIcon(activeFile.name, activeFile.language)}
                <span className="truncate">{activeFile.path}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* 行番号トグル (スマホでコード幅を確保) */}
            <button
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                showLineNumbers
                  ? 'bg-slate-800 text-sky-300 border-slate-700'
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}
              title="行番号の表示/非表示"
            >
              #
            </button>

            {/* 文字サイズ切替 */}
            <button
              onClick={() => {
                if (fontSize === 'sm') setFontSize('base');
                else if (fontSize === 'base') setFontSize('lg');
                else setFontSize('sm');
              }}
              className="px-2 py-1 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
              title="フォントサイズ切り替え"
            >
              <Type className="w-3 h-3 inline mr-0.5" />
              {fontSize.toUpperCase()}
            </button>

            {/* コピーボタン */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
              title="コードをコピー"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? '完了' : 'コピー'}</span>
            </button>
          </div>
        </div>

        {/* コードテキストエリア (行番号付き) */}
        <div className="flex-1 flex overflow-hidden bg-slate-950 font-mono text-xs">
          {/* 行番号 */}
          {showLineNumbers && (
            <div className="w-10 sm:w-12 bg-slate-950/90 border-r border-slate-800/80 p-2 sm:p-3 select-none text-right font-mono text-slate-600 space-y-1 overflow-hidden shrink-0">
              {lines.map((_, i) => (
                <div key={i} className="leading-5 text-[11px]">
                  {i + 1}
                </div>
              ))}
            </div>
          )}

          {/* テキスト入力エリア */}
          <div className="flex-1 relative overflow-hidden">
            <textarea
              value={activeFile?.content || ''}
              onChange={(e) => {
                if (activeFile) onUpdateFileContent(activeFile.path, e.target.value);
              }}
              spellCheck={false}
              className={`w-full h-full p-3 bg-transparent text-slate-200 font-mono leading-5 border-none outline-none resize-none overflow-auto select-text whitespace-pre tab-4 ${
                fontSize === 'sm' ? 'text-xs' : fontSize === 'base' ? 'text-sm' : 'text-base'
              }`}
              style={{ tabSize: 2 }}
            />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 削除確認モーダル (React製リッチダイアログ: 誤操作防止) */}
      {/* ======================================================== */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-950/80 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  {pendingDelete.type === 'folder' ? 'フォルダの削除確認' : 'ファイルの削除確認'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">この操作は取り消せません。</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="text-slate-400">削除対象:</div>
              <div className="font-mono text-rose-300 font-bold break-all">
                {pendingDelete.path}
              </div>
              {pendingDelete.type === 'folder' && typeof pendingDelete.fileCount === 'number' && (
                <div className="text-amber-400 font-medium pt-1">
                  ※フォルダ内の全 {pendingDelete.fileCount} 個のファイルが削除されます。
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={confirmDelete}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 shadow-md shadow-rose-900/30 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>削除する</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ZIP解凍完了・インポート確認モーダル */}
      {/* ======================================================== */}
      {zipResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-500/50 flex items-center justify-center text-sky-400">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">ZIP解凍の完了</h3>
                  <p className="text-[11px] text-slate-400">フォルダ階層とコードを復元しました</p>
                </div>
              </div>
              <button
                onClick={() => setZipResultModal(null)}
                className="p-1 hover:bg-slate-800 text-slate-400 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400">プロジェクト名:</span>
                <span className="font-mono text-sky-300 font-bold">{zipResultModal.projectName}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-500 text-[10px]">展開ファイル数</div>
                  <div className="text-sm font-bold text-slate-100">{zipResultModal.totalExtracted} 件</div>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-500 text-[10px]">検出フォルダ数</div>
                  <div className="text-sm font-bold text-slate-100">{zipResultModal.folders.length} 個</div>
                </div>
              </div>

              {/* ファイル一覧プレビュー */}
              <div className="text-xs text-slate-400 mt-2">展開ファイルプレビュー:</div>
              <div className="max-h-36 overflow-y-auto p-2 bg-slate-950 rounded border border-slate-800 font-mono text-[11px] space-y-1">
                {zipResultModal.files.slice(0, 15).map((f) => (
                  <div key={f.path} className="flex items-center gap-1.5 text-slate-300 truncate">
                    {getFileIcon(f.name, f.language)}
                    <span className="truncate">{f.path}</span>
                  </div>
                ))}
                {zipResultModal.files.length > 15 && (
                  <div className="text-slate-500 text-[10px] pl-4">
                    ...他 {zipResultModal.files.length - 15} 件
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setZipResultModal(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                破棄
              </button>
              <button
                onClick={() => applyImportedZip(false)}
                className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                title="既存のファイルを残したまま新規ファイルを追加"
              >
                マージ統合
              </button>
              <button
                onClick={() => applyImportedZip(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 active:scale-95 shadow-md shadow-sky-500/20 transition-all"
                title="ワークスペースをこのZIPの内容で全置換"
              >
                <Check className="w-3.5 h-3.5" />
                <span>全置換でインポート</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

