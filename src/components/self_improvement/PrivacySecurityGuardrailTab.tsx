import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  FileCode,
  Key,
  Database,
  Server,
  UserCheck,
  RefreshCw,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { privacyGuardrailService } from '../../services/privacyGuardrailService';
import { abstractSanitizerService } from '../../services/abstractSanitizerService';
import { featureFlagsService } from '../../services/featureFlagsService';
import {
  PrivacyAuditLogEntry,
  PrivacyAuditResult,
  AbstractSymbolMapping,
} from '../../types';

export const PrivacySecurityGuardrailTab: React.FC = () => {
  const [logs, setLogs] = useState<PrivacyAuditLogEntry[]>([]);
  const [mappings, setMappings] = useState<AbstractSymbolMapping[]>([]);
  const [testInput, setTestInput] = useState<string>(
    `Sub ProcessSalesData()\n  ' 社内ファイルサーバーから売上データを取得\n  Dim filePath As String\n  filePath = "C:\\Users\\Tanaka\\Documents\\2026_Uriage_Tokyo.xlsx"\n  Dim connStr As String\n  connStr = "Server=192.168.1.50;Database=SalesDB;Uid=sa;Pwd=secretPassword123"\n  Dim apiKey As String\n  apiKey = "sk-proj-abc1234567890abcdef1234567890"\n  Dim contactEmail As String\n  contactEmail = "tanaka@yamada-corp.internal"\nEnd Sub`
  );
  const [auditResult, setAuditResult] = useState<PrivacyAuditResult | null>(null);
  const [targetService, setTargetService] = useState<string>('teacher_api');
  const [autoSanitize, setAutoSanitize] = useState<boolean>(true);
  const [showRestored, setShowRestored] = useState<boolean>(false);

  const refreshData = () => {
    setLogs(privacyGuardrailService.getLogs());
    setMappings(abstractSanitizerService.getAllMappings());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleRunAudit = () => {
    const result = privacyGuardrailService.auditOutboundContent(testInput, targetService, {
      autoSanitize,
    });
    setAuditResult(result);
    refreshData();
  };

  const handleClearLogs = () => {
    if (window.confirm('すべての外部送信プライバシー監査ログを消去しますか？')) {
      privacyGuardrailService.clearLogs();
      refreshData();
    }
  };

  const handleClearMappings = () => {
    if (window.confirm('抽象シンボル置換辞書をリセットしますか？')) {
      abstractSanitizerService.clearMappings();
      refreshData();
    }
  };

  const flags = featureFlagsService.getFlags();

  return (
    <div className="space-y-6 text-sm text-slate-700 dark:text-slate-300">
      {/* ヘッダー＆概要カード */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  セキュリティ境界 ＆ プライバシー監査ガードレール
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    Master v5.0 第11章 & 第10章2節
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  外部教師APIやWeb検索など外部送信に先立ち、個人情報・社内パス・認証情報・本番SQLを検知し、抽象シンボル化または遮断します。
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              ガードレール稼働中
            </span>
            <span className="text-[11px] text-slate-400">
              フラグ: {flags.PRIVACY_GUARDRAIL} / サニタイザー: {flags.ABSTRACT_SANITIZER}
            </span>
          </div>
        </div>

        {/* 境界ルール一覧 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-lg border border-emerald-200/50 dark:border-emerald-800/40">
            <span className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              外部送信可能 (Allowed)
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
              <li><strong className="text-slate-700 dark:text-slate-200">PUBLIC_SYNTHETIC</strong>: 人工合成された汎用教材・一般知識</li>
              <li><strong className="text-slate-700 dark:text-slate-200">ABSTRACTED</strong>: 固有名詞や機密が抽象シンボルに安全置換されたデータ</li>
            </ul>
          </div>
          <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 rounded-lg border border-rose-200/50 dark:border-rose-800/40">
            <span className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1 mb-1">
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              送信絶対禁止 (Strictly Blocked)
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
              <li>個人情報 (氏名・電話・メール・マイナンバー)</li>
              <li>社内パス (C:\Users\..., \\fileserver\..., /home/...)</li>
              <li>認証情報 (APIキー・トークン・DBパスワード・接続文字列)</li>
              <li>未検査のローカル会話生ログ・実機ファイル全文</li>
            </ul>
          </div>
        </div>
      </div>

      {/* インタラクティブ監査テスター */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500" />
            リアルタイム機密監査 ＆ 抽象サニタイズ・テスター
          </h4>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">送信先サービス:</span>
              <select
                value={targetService}
                onChange={(e) => setTargetService(e.target.value)}
                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs"
              >
                <option value="teacher_api">外部教師API (Gemini/Cloud)</option>
                <option value="web_search">自律Web検索 (Search Engine)</option>
                <option value="external_copilot">外部Copilot指示書 (Prompt)</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSanitize}
                onChange={(e) => setAutoSanitize(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              <span>抽象シンボル自動置換 (10.2節)</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
            検査対象のテキスト / VBAコード / プロンプト:
          </label>
          <textarea
            rows={5}
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            className="w-full font-mono text-xs p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="監査したい文章やVBAマクロを入力してください..."
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleRunAudit}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-medium text-xs rounded-lg transition-all shadow-sm flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            境界監査 ＆ サニタイズを実行
          </button>
        </div>

        {/* 監査結果表示 */}
        {auditResult && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">判定結果:</span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                    auditResult.classification === 'PUBLIC_SYNTHETIC'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : auditResult.classification === 'ABSTRACTED'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  {auditResult.allowed ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {auditResult.classification} (
                  {auditResult.allowed ? '送信承認' : '送信遮断'})
                </span>
              </div>
              <span className="text-xs text-slate-400">
                検出違反: {auditResult.violations.length}件 / 抽象置換: {Object.keys(auditResult.symbolReplacements).length}件
              </span>
            </div>

            {/* 違反項目 */}
            {auditResult.violations.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-lg space-y-1.5">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  検出されたセキュリティ境界項目 ({auditResult.violations.length}件):
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {auditResult.violations.map((v, i) => (
                    <div
                      key={i}
                      className="p-2 bg-white/70 dark:bg-slate-900/70 border border-amber-200/50 dark:border-amber-800/30 rounded"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {v.message}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
                          {v.type} ({v.severity})
                        </span>
                      </div>
                      <code className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block truncate">
                        {v.snippet}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 置換マッピングプレビュー */}
            {Object.keys(auditResult.symbolReplacements).length > 0 && (
              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/40 rounded-lg space-y-1.5">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5" />
                  抽象シンボルへの自動置換 ({Object.keys(auditResult.symbolReplacements).length}件):
                </span>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(auditResult.symbolReplacements).map(([orig, sym], idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded flex items-center gap-1.5 font-mono text-[11px]"
                    >
                      <span className="text-slate-400 truncate max-w-[120px]">{orig}</span>
                      <span className="text-blue-500">➔</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{sym}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* サニタイズ後テキスト */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  サニタイズ後（外部送信セーフテキスト）:
                </span>
                <button
                  onClick={() => setShowRestored(!showRestored)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showRestored ? 'サニタイズ版を表示' : 'ローカル復元プレビューを表示'}
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-slate-100 font-mono text-xs rounded-lg overflow-x-auto max-h-48 border border-slate-800">
                {showRestored
                  ? abstractSanitizerService.deSanitizeText(auditResult.sanitizedText)
                  : auditResult.sanitizedText}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* 2カラム構成: 置換シンボル辞書 ＆ 外部送信監査履歴 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 抽象シンボル辞書 (第10章 10.2節) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-500" />
              抽象シンボル割当辞書 (Session Symbol Map)
              <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500">
                {mappings.length}件
              </span>
            </h4>
            <button
              onClick={handleClearMappings}
              title="辞書をリセット"
              className="p-1.5 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            セッション内で同一の実体・パスに対し同一の抽象シンボルを一貫して維持します（外部送信には渡されません）。
          </p>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {mappings.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                現在登録されている置換シンボルはありません
              </div>
            ) : (
              mappings.map((m, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {m.category}
                      </span>
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {m.abstractSymbol}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {m.originalValue}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 外部送信監査ログ */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-500" />
              外部送信監査ログ (Audit History)
              <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500">
                {logs.length}件
              </span>
            </h4>
            <div className="flex items-center gap-1">
              <button
                onClick={refreshData}
                title="更新"
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleClearLogs}
                title="ログ消去"
                className="p-1.5 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            教師API、検索API、外部サービスへの通信時に自動記録されたセキュリティ境界監査結果です。
          </p>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                監査ログはまだありません
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          log.allowed ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {log.targetService || 'service'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {log.classification}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.auditedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                    {log.summary}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
