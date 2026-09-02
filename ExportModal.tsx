import React, { useState } from 'react';
import {
  Download,
  FileCode,
  Package,
  Check,
  Globe,
  Copy,
  Smartphone,
  Share2,
  QrCode,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { WorkspaceFile } from '../types';
import {
  downloadProjectZip,
  downloadSingleHtml,
  buildCleanStandaloneHtml,
  shareOrSaveZipOnMobile,
  downloadFullServerZipMobile,
} from '../utils/codeParser';

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
  const [urlCopied, setUrlCopied] = useState(false);
  const [zipUrlCopied, setZipUrlCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrType, setQrType] = useState<'app' | 'zip'>('zip');
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  // Determine current public accessible domain
  const publicBaseUrl =
    typeof window !== 'undefined' && window.location.origin.includes('ais-pre')
      ? window.location.origin
      : 'https://ais-pre-3wfkdwmq4s7d422alblgnd-387287333639.asia-northeast1.run.app';

  const directZipUrl = `${publicBaseUrl}/api/export-app-zip`;

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      await downloadProjectZip(name, files);
    } finally {
      setIsZipping(false);
    }
  };

  const handleMobileShare = async () => {
    setIsZipping(true);
    try {
      const success = await shareOrSaveZipOnMobile(name, files);
      if (success) {
        setShareStatus('✅ スマホの共有メニューを開きました');
      } else {
        setShareStatus('📥 ZIPダウンロードを開始しました');
      }
      setTimeout(() => setShareStatus(null), 3000);
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

  const handleCopyAppUrl = () => {
    navigator.clipboard.writeText(publicBaseUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  };

  const handleCopyZipUrl = () => {
    navigator.clipboard.writeText(directZipUrl);
    setZipUrlCopied(true);
    setTimeout(() => setZipUrlCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-600/20 border border-sky-500/30 text-sky-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>エクスポート ＆ スマホ保存</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px]">
                  📱 スマホ対応
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                スマホ・PCでそのまま使えるZIP・単一HTML・アプリ一式を出力
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
        <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto">
          {/* SECTION 1: Smartphone Dedicated Quick Action (スマホ専用ダウンロード) */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-sky-950/60 to-slate-950 border border-sky-500/40 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-300 font-bold text-sm">
                <Smartphone className="w-4 h-4 text-sky-400" />
                <span>📱 スマホで今すぐ保存・共有</span>
              </div>
              <span className="text-[10.5px] px-2 py-0.5 rounded bg-sky-900/80 text-sky-200 border border-sky-700/60 font-bold">
                iOS / Android OK
              </span>
            </div>

            <p className="text-slate-300 text-[11px] leading-relaxed">
              スマホのブラウザ（Safari/Chrome）から直接ダウンロード、または「ファイル」アプリやLINE/AirDropにワンタップで保存できます。
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {/* Direct ZIP Download button */}
              <a
                href="/api/export-app-zip"
                download="miki-project.zip"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-md shadow-sky-600/30 text-xs transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>スマホでZIP直接保存</span>
              </a>

              {/* Web Share API / Files Save */}
              <button
                onClick={handleMobileShare}
                disabled={isZipping}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                <span>{isZipping ? '準備中...' : 'スマホ共有 / ファイル保存'}</span>
              </button>
            </div>

            {shareStatus && (
              <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-center text-[11px] font-bold animate-in fade-in">
                {shareStatus}
              </div>
            )}

            {/* Quick Actions: Direct Links & QR */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyZipUrl}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors"
                  title="スマホで開ける直接ZIPダウンロードURLをコピー"
                >
                  {zipUrlCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{zipUrlCopied ? 'ZIPのURLをコピー済!' : 'ZIPの直接URLをコピー'}</span>
                </button>

                <button
                  onClick={() => {
                    setQrType('zip');
                    setShowQr(!showQr);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-purple-300 border border-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors"
                  title="PC画面からスマホカメラで読み取れるQRコードを表示"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{showQr ? 'QRを閉じる' : 'QRコードでスマホ読込'}</span>
                </button>
              </div>

              <a
                href={directZipUrl}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-sky-300 text-[10.5px] flex items-center gap-1 underline underline-offset-2"
              >
                <span>別タブで開く</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* QR Code Popup Display */}
            {showQr && (
              <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/40 text-center space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-purple-300">
                    📷 スマホのカメラでかざすとそのままDLできます
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setQrType('zip')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        qrType === 'zip' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      ZIPダウンロード
                    </button>
                    <button
                      onClick={() => setQrType('app')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        qrType === 'app' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Webアプリ開く
                    </button>
                  </div>
                </div>

                <div className="flex justify-center p-3 bg-white rounded-xl mx-auto w-fit shadow-lg">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                      qrType === 'zip' ? directZipUrl : publicBaseUrl
                    )}`}
                    alt="Smartphone Download QR Code"
                    className="w-36 h-36 sm:w-44 sm:h-44"
                    loading="lazy"
                  />
                </div>

                <p className="text-slate-400 text-[10.5px] font-mono break-all px-2">
                  {qrType === 'zip' ? directZipUrl : publicBaseUrl}
                </p>
              </div>
            )}
          </div>

          {/* SECTION 2: Public App URL Banner */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-200 font-bold">
                <Globe className="w-4 h-4 text-sky-400" />
                <span>🌐 スマホ・外部ブラウザ用 公開アクセスURL</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/60">
                誰でも接続可能 (ais-pre)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={publicBaseUrl}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-sky-200 font-mono select-all"
              />
              <button
                onClick={handleCopyAppUrl}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold shrink-0 text-xs transition-colors flex items-center gap-1"
              >
                {urlCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{urlCopied ? 'コピー済' : 'コピー'}</span>
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

          {/* SECTION 3: System Source Code ZIP */}
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
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-md shadow-purple-600/30 text-xs transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>全ソースコード ZIP をダウンロード (/api/export-app-zip)</span>
            </a>
          </div>

          {/* SECTION 4: Game files & Standalone HTML */}
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
          <div className="pt-1">
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
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex justify-end shrink-0">
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
