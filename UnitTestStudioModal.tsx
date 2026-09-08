import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Copy,
  Check,
  ShieldCheck,
  Code2,
  RefreshCw,
  FlaskConical,
  Wand2,
  FilePlus,
  BarChart3,
} from 'lucide-react';
import {
  mikiSelfCodingSuperchargerService,
  UnitTestRunResult,
} from '../../services/mikiSelfCodingSuperchargerService';

interface UnitTestStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  code: string;
  onSaveTestFile?: (testFileName: string, content: string) => void;
  onRequestFix?: (failingTestInfo: string) => void;
}

export const UnitTestStudioModal: React.FC<UnitTestStudioModalProps> = ({
  isOpen,
  onClose,
  fileName,
  code,
  onSaveTestFile,
  onRequestFix,
}) => {
  if (!isOpen) return null;

  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<UnitTestRunResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'results' | 'code'>('results');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // モジュール名の抽出
  const moduleName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '');

  const runTests = async () => {
    setIsRunning(true);
    try {
      const res = await mikiSelfCodingSuperchargerService.runUnitTest(code, moduleName, 1);
      setTestResult(res);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runTests();
  }, [code, fileName]);

  const handleCopyTestCode = () => {
    if (!testResult?.generatedVitestSnippet) return;
    navigator.clipboard.writeText(testResult.generatedVitestSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAsTestFile = () => {
    if (!testResult?.generatedVitestSnippet || !onSaveTestFile) return;
    const testFileName = fileName.replace(/\.tsx?$/, '.test.ts');
    onSaveTestFile(testFileName, testResult.generatedVitestSnippet);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* ヘッダー */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 bg-indigo-950/80 border border-indigo-700/60 rounded-xl text-indigo-300">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-100 flex items-center gap-2 truncate">
                <span>みき TDD ユニットテスト自動合成＆検証スタジオ</span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-indigo-300 rounded truncate">
                  {fileName}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                関数の境界値・不変条件・性能契約を自動合成し、リアルタイムにテスト実行します
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* タブ切り替え & 再実行 */}
        <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('results')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'results'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>テスト実行結果</span>
              {testResult && (
                <span className="ml-1 px-1.5 py-0.2 bg-black/40 rounded text-[10px] font-mono">
                  {testResult.passedCount}/{testResult.totalCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'code'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>合成テストコード (Vitest)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={runTests}
            disabled={isRunning}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 hover:text-indigo-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>再実行</span>
          </button>
        </div>

        {/* コンテンツ領域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isRunning ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-mono">
                みきがモジュール仕様を解析し、テストケースを実行中...
              </p>
            </div>
          ) : activeTab === 'results' && testResult ? (
            <div className="space-y-4">
              {/* サマリーカード */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  testResult.allPassed
                    ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
                    : 'bg-rose-950/30 border-rose-500/50 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {testResult.allPassed ? (
                    <div className="p-2 bg-emerald-900/60 rounded-xl text-emerald-300">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  ) : (
                    <div className="p-2 bg-rose-900/60 rounded-xl text-rose-300">
                      <XCircle className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-bold">
                      {testResult.allPassed
                        ? '全テストケース合格 (All Pass)'
                        : `${testResult.totalCount - testResult.passedCount} 件のテストが失敗しました`}
                    </div>
                    <div className="text-xs text-slate-400">
                      {testResult.passedCount} / {testResult.totalCount} テスト成功 (モジュール: {testResult.moduleName})
                    </div>
                  </div>
                </div>

                {/* カバレッジバッジ */}
                <div className="flex items-center gap-2 text-xs font-mono">
                  {testResult.coverage ? (
                    <>
                      <div className="px-2.5 py-1 bg-black/40 rounded-lg border border-slate-700/60 text-center">
                        <span className="text-[10px] text-slate-400 block">総合カバレッジ</span>
                        <span className="font-bold text-indigo-300">{testResult.coverage.overall}%</span>
                      </div>
                      <div className="px-2.5 py-1 bg-black/40 rounded-lg border border-slate-700/60 text-center">
                        <span className="text-[10px] text-slate-400 block">行カバレッジ</span>
                        <span className="font-bold text-emerald-400">{testResult.coverage.lines}%</span>
                      </div>
                      <div className="px-2.5 py-1 bg-black/40 rounded-lg border border-slate-700/60 text-center">
                        <span className="text-[10px] text-slate-400 block">分岐網羅</span>
                        <span className="font-bold text-amber-400">{testResult.coverage.branches}%</span>
                      </div>
                    </>
                  ) : (
                    <div className="px-2.5 py-1 bg-black/40 rounded-lg border border-slate-700/60 text-center">
                      <span className="text-[10px] text-slate-400 block">カバレッジ</span>
                      <span className="font-bold text-slate-500">未計測 (実行ベース判定)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* テスト項目リスト */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>合成テストスイート一覧</span>
                </div>

                <div className="space-y-1.5">
                  {testResult.tests.map((t) => (
                    <div
                      key={t.id}
                      className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs transition-colors ${
                        t.passed
                          ? 'bg-slate-950/60 border-slate-800 hover:border-emerald-500/40'
                          : 'bg-rose-950/40 border-rose-600/60 text-rose-200'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        {t.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200">{t.title}</div>
                          <div className="text-[11px] font-mono text-slate-400 mt-1 bg-black/40 px-2 py-1 rounded">
                            {t.assertion}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 shrink-0 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{t.durationMs}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* テスト失敗時の自律修復ガイダンス */}
              {!testResult.allPassed && onRequestFix && (
                <div className="p-3 bg-fuchsia-950/40 border border-fuchsia-500/50 rounded-xl flex items-center justify-between gap-3">
                  <div className="text-xs text-fuchsia-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-fuchsia-400 shrink-0" />
                    <span>失敗したテストケースを満たすよう、みきに自動修復を依頼できます</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const failed = testResult.tests.filter((t) => !t.passed).map((t) => t.title).join(', ');
                      onRequestFix(`テスト失敗: ${failed}`);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>みきに自律修復させる</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>自動生成された Vitest / Jest 互換テストコード:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyTestCode}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'コピー完了' : 'コードコピー'}</span>
                  </button>

                  {onSaveTestFile && (
                    <button
                      type="button"
                      onClick={handleSaveAsTestFile}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1 font-bold transition-all shadow-xs cursor-pointer"
                    >
                      {savedSuccess ? (
                        <Check className="w-3 h-3 text-white" />
                      ) : (
                        <FilePlus className="w-3 h-3" />
                      )}
                      <span>{savedSuccess ? '保存完了！' : 'テストファイル作成'}</span>
                    </button>
                  )}
                </div>
              </div>

              <pre className="p-3 bg-black/80 border border-slate-800 rounded-xl font-mono text-xs text-indigo-200 overflow-x-auto select-text leading-relaxed">
                {testResult?.generatedVitestSnippet}
              </pre>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>テスト駆動開発 (TDD) 原則に基づき、安全なコード進化を保証します</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
