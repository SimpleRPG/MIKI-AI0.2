import React, { useState } from 'react';
import {
  Download,
  FileCode,
  Package,
  Check,
  Globe,
  Copy,
} from 'lucide-react';
import { WorkspaceFile } from '../types';
import { downloadProjectZip, downloadSingleHtml, buildCleanStandaloneHtml } from '../utils/codeParser';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: WorkspaceFile[];
  projectName?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  files,
  projectName = 'miki-game-app',
}) => {
  const [name, setName] = useState(projectName);
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  if (!isOpen) return null;

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      await downloadProjectZip(name, files);
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownloadHtml = () => {
    const singleHtml = buildCleanStandaloneHtml(files);
    downloadSingleHtml(name, singleHtml);
  };

  const handleCopyCode = () => {
    const singleHtml = buildCleanStandaloneHtml(files);
    navigator.clipboard.writeText(singleHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-600/20 border border-sky-500/30 text-sky-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">エクスポート ＆ ローカル保存</h2>
              <p className="text-xs text-slate-400">
                作成したゲーム/アプリをZIPアーカイブまたは単一HTMLとして保存
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Public Accessible URL Banner */}
          <div className="p-4 rounded-xl bg-sky-950/40 border border-sky-600/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-300 font-bold">
                <Globe className="w-4 h-4 text-sky-400" />
                <span>🌐 スマホ・外部ブラウザ用 公開アクセスURL</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-sky-900/60 text-sky-200 border border-sky-700/50">
                誰でも接続可能 (ais-pre)
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              ※ <code className="text-rose-300">ais-dev-...</code> のURLは Google AI Studio 内部セッション限定のため外部端末では接続エラーになります。スマホや知人に共有する際は下記の<strong>公開URL (<code className="text-sky-300">ais-pre-...</code>)</strong>をご使用ください。
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                readOnly
                value="https://ais-pre-lmii4pykmv4ucirau7mbyp-23659957062.asia-northeast1.run.app"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-sky-200 font-mono select-all"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText('https://ais-pre-lmii4pykmv4ucirau7mbyp-23659957062.asia-northeast1.run.app');
                  alert('公開URLをコピーしました！スマホや別ブラウザでそのまま開けます。');
                }}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold shrink-0 text-xs transition-colors flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>コピー</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">プロジェクト名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Full App Source Code ZIP for Claude / AI Review */}
          <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/60 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-300 font-bold">
                <Package className="w-4 h-4 text-purple-400" />
                <span>全システム一式 ZIP (Claude / 外部AI / バックアップ用)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-700/50">
                src/・server.ts・全設定含む
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              このWebアプリ「みき」の全ソースコード・UIコンポーネント・バックエンド構成をまるごとZIPで取得します。Claudeや外部AIに渡して診断・改修してもらうのに最適です。
            </p>
            <a
              href="/api/export-app-zip"
              download="miki-ai-studio-full-project.zip"
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg shadow-md shadow-purple-600/30 text-xs transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>全ソースコード ZIP をダウンロード (/api/export-app-zip)</span>
            </a>
          </div>

          {/* Android APK Build via Capacitor */}
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <Package className="w-4 h-4 text-emerald-400" />
                <span>📱 Android APK 化 (Capacitor 構成済み)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-200 border border-emerald-700/50">
                GPU・ストレージ無制限
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Capacitor設定ファイル (<code className="text-emerald-300">capacitor.config.ts</code>) を生成済みです。上記で全ZIPをダウンロード後、<code className="text-emerald-300">npx cap add android</code> &rarr; <code className="text-emerald-300">npx cap open android</code> でAndroid StudioからワンクリックでスタンドアロンAPKを出力できます。
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Full ZIP of active game */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 text-sky-400 font-bold">
                  <Package className="w-4 h-4" />
                  <span>作成したゲーム ZIP</span>
                </div>
                <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">
                  ワークスペースのファイル ({files.length}件) をフォルダ構造を維持してZIP保存
                </p>
              </div>

              <button
                onClick={handleDownloadZip}
                disabled={isZipping}
                className="w-full py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold rounded-lg shadow-md shadow-sky-500/20 text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isZipping ? '圧縮中...' : 'ゲーム ZIP を保存'}</span>
              </button>
            </div>

            {/* Standalone HTML */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Globe className="w-4 h-4" />
                  <span>単一 HTML (スタンドアロン)</span>
                </div>
                <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">
                  CSS/JSをインライン埋め込み。ダブルクリックですぐ遊べる単一ファイル
                </p>
              </div>

              <button
                onClick={handleDownloadHtml}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>.html を保存</span>
              </button>
            </div>
          </div>

          {/* Copy Single HTML to clipboard */}
          <div className="pt-2">
            <button
              onClick={handleCopyCode}
              className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700/80 flex items-center justify-center gap-2 transition-colors font-medium"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'クリップボードにコピーしました！' : '全コードを1つのHTMLとしてコピー'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
