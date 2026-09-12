import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  FileCode2,
  FlaskConical,
  XCircle,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Hash,
  ArrowRight,
  ListChecks,
  ChevronDown,
  ChevronUp,
  Info,
  Trash2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import {
  CompletionEvaluation,
  CompletionStatus,
  CompletionChecklist,
  WorkspaceFile,
} from '../../types';
import { completionJudgeService } from '../../services/completionJudgeService';

interface CompletionJudgeTabProps {
  onNotify?: (message: string) => void;
}

const PRESET_CASES = [
  {
    id: 'case_vba_normal',
    name: '【VBA】正常コード (外部コンパイル要)',
    goal: 'ExcelのA列を大文字にしてB列に出力するマクロを書いて',
    response: `A列のデータを一括で大文字に変換し、B列に出力する安全なマクロを作成しました。

\`\`\`vba
Option Explicit

Sub ConvertToUpperCase()
    Dim ws As Worksheet
    Dim lastRow As Long
    Dim i As Long

    On Error GoTo ErrHandler
    Set ws = ThisWorkbook.Sheets(1)
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row

    If lastRow < 2 Then Exit Sub

    For i = 2 To lastRow
        If Trim(ws.Cells(i, 1).Value) <> "" Then
            ws.Cells(i, 2).Value = UCase(Trim(ws.Cells(i, 1).Value))
        End If
    Next i
    Exit Sub

ErrHandler:
    MsgBox "エラーが発生しました: " & Err.Description, vbCritical
End Sub
\`\`\`

PCのExcelでVBE (Alt + F11) を開き、標準モジュールに貼り付けてデバッグ > コンパイルを実行してください。`,
  },
  {
    id: 'case_omission_bad',
    name: '【悪例】省略・プレースホルダー混入 (失格/一部完了)',
    goal: '売上データを集計してレポートシートを作るVBAを書いて',
    response: `売上データを集計するマクロです。

\`\`\`vba
Sub AggregateSales()
    ' // ここにデータ読み込み処理を書く
    Dim total As Long
    total = 0
    ' 省略... 各行の合計を計算
    Range("C1").Value = total
End Sub
\`\`\`

必要に応じてコードを埋めて使ってください！`,
  },
  {
    id: 'case_text_complete',
    name: '【通常解説】自然な日本語解説 (即座に完全完了)',
    goal: 'Termuxで旧ローカル生成ランタイムを使う利点を教えて',
    response: `Termux上で 旧ローカル生成ランタイム を運用する主なメリットは以下の3点です：

1. **メモリのオンデマンド切り替え**: 複数モデルを常にRAMに常駐させず、呼び出し時に動的にロード・アンロードするため、Galaxy S25の12GB RAMを無駄なく活用できます。
2. **モデル保護と安全終了**: モデル生成系ランタイムや軽量1.5Bモデルを安定したGGUF形式で実行でき、熱やスワップ負荷を最小化します。
3. **HTTP API標準準拠**: OpenAI互換の /v1/chat/completions エンドポイントを提供するため、アプリやスクリプトから簡単に呼び出せます。`,
  },
];

export const CompletionJudgeTab: React.FC<CompletionJudgeTabProps> = ({ onNotify }) => {
  // シミュレーター用ステート
  const [inputGoal, setInputGoal] = useState<string>(PRESET_CASES[0].goal);
  const [inputResponse, setInputResponse] = useState<string>(PRESET_CASES[0].response);
  const [currentEvaluation, setCurrentEvaluation] = useState<CompletionEvaluation | null>(() => {
    return completionJudgeService.evaluateCompletion({
      userGoal: PRESET_CASES[0].goal,
      assistantResponse: PRESET_CASES[0].response,
    });
  });

  // 履歴リスト
  const [historyList, setHistoryList] = useState<CompletionEvaluation[]>(() => {
    return completionJudgeService.getHistory();
  });

  // 展開ステート
  const [expandedChecklist, setExpandedChecklist] = useState<boolean>(true);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<CompletionEvaluation | null>(null);

  // 統計集計
  const stats = useMemo(() => {
    return completionJudgeService.getJudgeStats();
  }, [historyList, currentEvaluation]);

  // 判定実行
  const handleRunJudge = () => {
    const res = completionJudgeService.evaluateCompletion({
      userGoal: inputGoal,
      assistantResponse: inputResponse,
    });
    setCurrentEvaluation(res);
    setHistoryList(completionJudgeService.getHistory());
    if (onNotify) {
      onNotify(`完了判定完了: [${res.status}] スコア ${res.score}点 - ${res.headline}`);
    }
  };

  // プリセット適用
  const handleSelectPreset = (presetId: string) => {
    const found = PRESET_CASES.find((p) => p.id === presetId);
    if (found) {
      setInputGoal(found.goal);
      setInputResponse(found.response);
      const res = completionJudgeService.evaluateCompletion({
        userGoal: found.goal,
        assistantResponse: found.response,
      });
      setCurrentEvaluation(res);
      setHistoryList(completionJudgeService.getHistory());
    }
  };

  // 履歴クリア
  const handleClearHistory = () => {
    completionJudgeService.clearHistory();
    setHistoryList([]);
    setSelectedHistoryItem(null);
    if (onNotify) onNotify('完了判定履歴を消去しました');
  };

  // バッジ設定情報取得
  const getBadgeMeta = (status: CompletionStatus) => {
    return completionJudgeService.getBadgeConfig(status);
  };

  const activeDisplayEval = selectedHistoryItem || currentEvaluation;

  return (
    <div className="space-y-6">
      {/* ヘッダー情報カード */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-cyan-950/30 border border-emerald-500/20 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  完成条件と完了判定器 (Completion Judge)
                </h3>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-500/30">
                  第48章仕様 (Master v5.6)
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                モデルの自己申告に頼らず、7大完了条件チェックリストに基づき客観的・機械的に回答とコードを厳格検査します。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-white/60 dark:bg-zinc-800/60 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
              VBA/外部要件: <strong>二段階検証必須</strong>
            </span>
          </div>
        </div>

        {/* 統計グリッド */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mt-4 pt-4 border-t border-emerald-500/15 text-center">
          <div className="bg-white/70 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
            <div className="text-xs text-zinc-500">総判定数</div>
            <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{stats.total}</div>
          </div>
          <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200/60 dark:border-emerald-800/50">
            <div className="text-xs text-emerald-700 dark:text-emerald-400">完全完了</div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-300">{stats.complete}</div>
          </div>
          <div className="bg-amber-50/70 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-800/50">
            <div className="text-xs text-amber-700 dark:text-amber-400">外部コンパイル要</div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-300">{stats.externalCompile}</div>
          </div>
          <div className="bg-violet-50/70 dark:bg-violet-950/40 p-2.5 rounded-lg border border-violet-200/60 dark:border-violet-800/50">
            <div className="text-xs text-violet-700 dark:text-violet-400">実機テスト要</div>
            <div className="text-lg font-bold text-violet-600 dark:text-violet-300">{stats.runtimeTest}</div>
          </div>
          <div className="bg-yellow-50/70 dark:bg-yellow-950/40 p-2.5 rounded-lg border border-yellow-200/60 dark:border-yellow-800/50">
            <div className="text-xs text-yellow-700 dark:text-yellow-400">一部未解決</div>
            <div className="text-lg font-bold text-yellow-600 dark:text-yellow-300">{stats.partial}</div>
          </div>
          <div className="bg-rose-50/70 dark:bg-rose-950/40 p-2.5 rounded-lg border border-rose-200/60 dark:border-rose-800/50">
            <div className="text-xs text-rose-700 dark:text-rose-400">ブロック中</div>
            <div className="text-lg font-bold text-rose-600 dark:text-rose-300">{stats.blocked}</div>
          </div>
          <div className="bg-red-50/70 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-200/60 dark:border-red-800/50">
            <div className="text-xs text-red-700 dark:text-red-400">失敗/エラー</div>
            <div className="text-lg font-bold text-red-600 dark:text-red-300">{stats.failed}</div>
          </div>
        </div>
      </div>

      {/* 2カラム構成: 左側シミュレーター、右側判定結果詳細 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左側: 入力・プリセット・シミュレーター (5カラム) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-500" />
                判定シミュレーター
              </h4>
              <span className="text-xs text-zinc-500">リアルタイム診断</span>
            </div>

            {/* プリセット選択 */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                テストプリセット事例:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_CASES.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset.id)}
                    className="text-xs px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* ユーザー目的入力 */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                ユーザー要求・目標 (User Goal):
              </label>
              <textarea
                value={inputGoal}
                onChange={(e) => setInputGoal(e.target.value)}
                rows={2}
                className="w-full text-xs font-mono p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                placeholder="例: ExcelのA列を大文字に変換するVBAを書いて..."
              />
            </div>

            {/* AI回答・コード入力 */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                生成回答本文 (Assistant Response / Code):
              </label>
              <textarea
                value={inputResponse}
                onChange={(e) => setInputResponse(e.target.value)}
                rows={9}
                className="w-full text-xs font-mono p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                placeholder="回答テキストまたはマークダウンコードブロックを入力..."
              />
            </div>

            <button
              onClick={handleRunJudge}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 transition"
            >
              <ShieldCheck className="w-4 h-4" />
              第48章 7大チェックリスト判定を実行
            </button>
          </div>

          {/* 直近の判定履歴 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                判定履歴 ({historyList.length})
              </h4>
              {historyList.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-zinc-400 hover:text-rose-600 flex items-center gap-1 transition"
                  title="履歴をクリア"
                >
                  <Trash2 className="w-3 h-3" />
                  消去
                </button>
              )}
            </div>

            {historyList.length === 0 ? (
              <p className="text-xs text-zinc-400 py-3 text-center">判定履歴はまだありません</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {historyList.slice(0, 10).map((item, idx) => {
                  const meta = getBadgeMeta(item.status);
                  const isSelected = selectedHistoryItem?.evaluatedAt === item.evaluatedAt;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedHistoryItem(item)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500 dark:bg-emerald-950/40'
                          : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${meta.bgColor} ${meta.textColor}`}>
                          {meta.shortLabel}
                        </span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          {item.score}点
                        </span>
                      </div>
                      <div className="text-zinc-700 dark:text-zinc-300 font-medium truncate">
                        {item.headline}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-1">
                        {new Date(item.evaluatedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 右側: 判定結果と7項目チェックリスト詳細 (7カラム) */}
        <div className="lg:col-span-7 space-y-4">
          {activeDisplayEval ? (
            <div className="space-y-4">
              {/* スコア・ステータス要約カード */}
              {(() => {
                const meta = getBadgeMeta(activeDisplayEval.status);
                return (
                  <div className={`p-4 rounded-xl border ${meta.bgColor} ${meta.borderColor} space-y-3`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${meta.bgColor} ${meta.textColor} ${meta.borderColor}`}>
                            {meta.label}
                          </span>
                          {activeDisplayEval.isCodeOrVba && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-700 dark:text-blue-300">
                              コード検出: {activeDisplayEval.detectedCodeTypes.join(', ')}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-2">
                          {activeDisplayEval.headline}
                        </h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">
                          {activeDisplayEval.reason}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100">
                          {activeDisplayEval.score}
                          <span className="text-xs font-normal text-zinc-500"> / 100</span>
                        </div>
                        <span className="text-[10px] text-zinc-500">完成度スコア</span>
                      </div>
                    </div>

                    {/* 推奨次アクション */}
                    <div className="bg-white/80 dark:bg-zinc-900/80 p-3 rounded-lg border border-zinc-200/60 dark:border-zinc-800 text-xs flex items-start gap-2">
                      <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">
                          次アクション ({activeDisplayEval.checklist.nextAction.actionType}):
                        </span>
                        <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">
                          {activeDisplayEval.checklist.nextAction.note}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 7大完了判定チェックリスト */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs space-y-3">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedChecklist(!expandedChecklist)}
                >
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-emerald-600" />
                    7大完了条件チェックリスト診断
                  </h4>
                  {expandedChecklist ? (
                    <ChevronUp className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  )}
                </div>

                {expandedChecklist && (
                  <div className="space-y-2.5 pt-2">
                    {/* 1. 目的充足性 */}
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] flex items-center justify-center font-bold">1</span>
                          依頼目的の充足 (Goal Satisfaction)
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
                          {activeDisplayEval.checklist.goalSatisfaction.note}
                        </p>
                      </div>
                      {activeDisplayEval.checklist.goalSatisfaction.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      )}
                    </div>

                    {/* 2. 成果物の存在 */}
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] flex items-center justify-center font-bold">2</span>
                          成果物の存在 (Artifact Presence)
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
                          {activeDisplayEval.checklist.artifactPresence.summary || '未検出'} ({activeDisplayEval.checklist.artifactPresence.type || 'none'})
                        </p>
                      </div>
                      {activeDisplayEval.checklist.artifactPresence.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      )}
                    </div>

                    {/* 3. 必須項目の充足 (省略なし) */}
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] flex items-center justify-center font-bold">3</span>
                          必須項目の充足・ゼロ省略 (Required Items)
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
                          {activeDisplayEval.checklist.requiredItems.missing.length === 0
                            ? '省略・プレースホルダーなし（完全提供）'
                            : `不足・省略検知: ${activeDisplayEval.checklist.requiredItems.missing.join(', ')}`}
                        </p>
                      </div>
                      {activeDisplayEval.checklist.requiredItems.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      )}
                    </div>

                    {/* 4. 検証結果 (静的スキャン等) */}
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] flex items-center justify-center font-bold">4</span>
                          検証結果 (Verification Status)
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
                          ステータス: <strong>{activeDisplayEval.checklist.verification.status}</strong>
                          {activeDisplayEval.checklist.verification.note && ` - ${activeDisplayEval.checklist.verification.note}`}
                        </p>
                      </div>
                      {activeDisplayEval.checklist.verification.status !== 'failed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      )}
                    </div>

                    {/* 5. 未解決事項の有無 */}
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] flex items-center justify-center font-bold">5</span>
                          未解決事項の有無と明示 (Unresolved Issues)
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
                          {activeDisplayEval.checklist.unresolvedIssues.hasIssues
                            ? `未解決事項あり: ${activeDisplayEval.checklist.unresolvedIssues.issues.join(', ')}`
                            : '未解決事項なし（完結）'}
                        </p>
                      </div>
                      {!activeDisplayEval.checklist.unresolvedIssues.hasIssues ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      )}
                    </div>

                    {/* 6. 保存先とハッシュの記録 */}
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] flex items-center justify-center font-bold">6</span>
                          保存先とハッシュの記録 (Storage Tracking & Hash)
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
                          保存先: <code>{activeDisplayEval.checklist.storageTracking.savedLocation || activeDisplayEval.checklist.storageTracking.filename || 'インライン出力'}</code>
                          {activeDisplayEval.checklist.storageTracking.contentHash && (
                            <span className="ml-2 font-mono text-[10px] bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded">
                              hash: {activeDisplayEval.checklist.storageTracking.contentHash}
                            </span>
                          )}
                        </p>
                      </div>
                      {activeDisplayEval.checklist.storageTracking.contentHash ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                      )}
                    </div>

                    {/* 7. 次操作の要否 */}
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] flex items-center justify-center font-bold">7</span>
                          次操作の要否 (Next Action)
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
                          種別: <strong>{activeDisplayEval.checklist.nextAction.actionType}</strong> - {activeDisplayEval.checklist.nextAction.note}
                        </p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              判定結果がありません。「判定を実行」をクリックしてください。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
