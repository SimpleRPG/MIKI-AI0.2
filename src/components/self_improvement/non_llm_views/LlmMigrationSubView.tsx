import React, { useState } from 'react';
import {
  GitMerge,
  Zap,
  Play,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingDown,
  Cpu,
  History,
} from 'lucide-react';
import {
  llmMigrationProtocolService,
} from '../../../services/llmMigrationProtocolService';
import {
  LlmMigrationTask,
  LlmMigrationStatus,
  ShadowComparisonRecord,
} from '../../../types';

export const LlmMigrationSubView: React.FC = () => {
  const [tasks, setTasks] = useState<LlmMigrationTask[]>(() =>
    llmMigrationProtocolService.getAllTasks()
  );
  const [selectedTask, setSelectedTask] = useState<LlmMigrationTask | null>(() =>
    tasks[0] || null
  );
  const [testInput, setTestInput] = useState('重複行を消すマクロ作って');
  const [lastShadowRecord, setLastShadowRecord] = useState<ShadowComparisonRecord | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const refreshTasks = () => {
    const updated = llmMigrationProtocolService.getAllTasks();
    setTasks(updated);
    if (selectedTask) {
      const match = updated.find((t: LlmMigrationTask) => t.taskId === selectedTask.taskId);
      if (match) setSelectedTask(match);
    }
  };

  const handleRunShadow = () => {
    if (!selectedTask || !testInput.trim()) return;
    setIsExecuting(true);
    setTimeout(() => {
      const record = llmMigrationProtocolService.runShadowComparison(selectedTask.taskId, testInput);
      setLastShadowRecord(record);
      refreshTasks();
      setIsExecuting(false);
    }, 200);
  };

  const handleUpdateStatus = (newStatus: LlmMigrationStatus) => {
    if (!selectedTask) return;
    llmMigrationProtocolService.updateStatus(selectedTask.taskId, newStatus, 'ユーザー手動審査');
    refreshTasks();
  };

  const getStatusBadge = (status: LlmMigrationStatus) => {
    switch (status) {
      case 'NON_LLM_DEFAULT':
        return <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/60 font-semibold">⚡ 非LLM既定 (Default)</span>;
      case 'NON_LLM_LIMITED':
        return <span className="px-2 py-0.5 rounded text-[10px] bg-teal-950 text-teal-300 border border-teal-500/50">🌿 限定非LLM運用</span>;
      case 'SHADOW_COMPARISON':
        return <span className="px-2 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-500/60 font-semibold animate-pulse">⚖️ シャドー比較中</span>;
      case 'NON_LLM_CANDIDATE':
        return <span className="px-2 py-0.5 rounded text-[10px] bg-sky-950 text-sky-300 border border-sky-500/50">📋 移管候補</span>;
      case 'LLM_FALLBACK_ONLY':
        return <span className="px-2 py-0.5 rounded text-[10px] bg-purple-950 text-purple-300 border border-purple-500/40">🛡️ LLMフォールバック限定</span>;
      case 'ROLLBACK_TO_LLM':
        return <span className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-500/60">⚠️ LLMへロールバック済</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">LLM単独 (LLM_ONLY)</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Overview Banner */}
      <div className="p-3.5 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <GitMerge className="w-4 h-4" />
            </span>
            <h4 className="text-sm font-bold text-amber-300">
              第13.3節: LLM機能の移管判定プロトコル (LLM to Non-LLM Migration)
            </h4>
          </div>
          <span className="text-[10px] text-slate-400">
            LLM_ONLY ➔ SHADOW_COMPARISON ➔ NON_LLM_DEFAULT
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          反復して定型入出力を扱う処理 (意図ラベル付け、検索語展開、JSON整形、定型説明、構文チェック、VBA合成等) を
          非LLM決定論的部品へ移管。シャドー実行により「レイテンシ99%削減」「Vulkan Device Lostゼロ」「決定論的完全再現性」を自動検証します。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Task List (5 cols) */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-semibold">
            <span>移管対象タスク一覧 ({tasks.length}件)</span>
            <span className="text-[10px] text-emerald-400">非LLM化率: {Math.round((tasks.filter(t => t.status === 'NON_LLM_DEFAULT').length / tasks.length) * 100)}%</span>
          </div>

          <div className="space-y-2">
            {tasks.map((task) => {
              const isSelected = selectedTask?.taskId === task.taskId;
              return (
                <div
                  key={task.taskId}
                  onClick={() => setSelectedTask(task)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800/95 border-amber-500/70 shadow-md shadow-amber-950/20 ring-1 ring-amber-500/30'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        <span>{task.taskName}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        ID: <code className="text-sky-300 font-mono">{task.taskId}</code> | カテゴリ: {task.category}
                      </span>
                    </div>
                    {getStatusBadge(task.status)}
                  </div>

                  {/* Metrics bar */}
                  <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2 border-t border-slate-800/80 text-[10px]">
                    <div className="bg-slate-950/60 p-1 rounded text-center">
                      <span className="text-slate-400 block text-[9px]">短縮率</span>
                      <span className="font-bold text-emerald-300 font-mono">-{task.metrics.latencyReductionRatio.toFixed(1)}%</span>
                    </div>
                    <div className="bg-slate-950/60 p-1 rounded text-center">
                      <span className="text-slate-400 block text-[9px]">RAM削減</span>
                      <span className="font-bold text-sky-300 font-mono">-{task.metrics.ramReductionMb}MB</span>
                    </div>
                    <div className="bg-slate-950/60 p-1 rounded text-center">
                      <span className="text-slate-400 block text-[9px]">正確性</span>
                      <span className="font-bold text-amber-300 font-mono">{task.metrics.accuracyScore.toFixed(0)}点</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Task Detail & Shadow Sandbox (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {selectedTask ? (
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h5 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <span>{selectedTask.taskName}</span>
                    {getStatusBadge(selectedTask.status)}
                  </h5>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedTask.description}</p>
                </div>

                {/* Status Switcher */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleUpdateStatus('NON_LLM_DEFAULT')}
                    disabled={selectedTask.status === 'NON_LLM_DEFAULT'}
                    className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-[10.5px] disabled:opacity-40"
                    title="非LLMを標準経路へ昇格"
                  >
                    ⚡ 非LLM既定化
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('SHADOW_COMPARISON')}
                    disabled={selectedTask.status === 'SHADOW_COMPARISON'}
                    className="px-2 py-1 rounded bg-amber-950 hover:bg-amber-900 border border-amber-500/50 text-amber-300 text-[10.5px] disabled:opacity-40"
                    title="シャドー比較モードへ移行"
                  >
                    ⚖️ 比較検証
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('ROLLBACK_TO_LLM')}
                    disabled={selectedTask.status === 'ROLLBACK_TO_LLM'}
                    className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 border border-rose-500/50 text-rose-300 text-[10.5px] disabled:opacity-40"
                    title="問題発生時にLLMへ安全ロールバック"
                  >
                    ↩️ ロールバック
                  </button>
                </div>
              </div>

              {/* Contracts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-semibold block">入力構造定義 (Input Contract)</span>
                  <code className="text-slate-200 text-[11px] font-mono block mt-1">{selectedTask.inputStructureDefinition}</code>
                </div>
                <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-semibold block">出力契約 (Output Contract)</span>
                  <code className="text-emerald-300 text-[11px] font-mono block mt-1">{selectedTask.outputContract}</code>
                </div>
              </div>

              {/* Shadow Comparison Sandbox */}
              <div className="p-3.5 bg-slate-950/90 rounded-xl border border-amber-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>第13.3節 シャドー実行サンドボックス (LLM vs 非LLM ベンチマーク)</span>
                  </div>
                  <span className="text-[10px] text-slate-400">同一入力・同一契約での比較</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400">テスト入力文章 / 要求プロンプト:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:border-amber-500 outline-none"
                    />
                    <button
                      onClick={handleRunShadow}
                      disabled={isExecuting}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
                    >
                      <Play className={`w-3 h-3 ${isExecuting ? 'animate-spin' : ''}`} />
                      <span>{isExecuting ? '比較中...' : 'シャドー比較実走'}</span>
                    </button>
                  </div>
                </div>

                {/* Comparison Result Card */}
                {lastShadowRecord && (
                  <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2.5 animate-fadeIn text-xs">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                      <span className="text-[11px] font-bold text-slate-200">比較検証結果:</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-600 text-emerald-200 text-[10px] font-bold">
                        🏆 勝者: {lastShadowRecord.winner === 'NON_LLM' ? '非LLM決定論的経路 (完全優位)' : 'LLM'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* LLM Column */}
                      <div className="p-2 bg-purple-950/30 rounded border border-purple-800/40 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-purple-300 font-bold">
                          <span>ローカルLLM (3B Vulkan)</span>
                          <span className="font-mono">{lastShadowRecord.latencyLlmMs} ms</span>
                        </div>
                        <p className="text-[10px] text-slate-300 font-mono break-all">{lastShadowRecord.llmOutput}</p>
                        <span className="text-[9px] text-purple-400 block">確率的推論 / 25〜60秒遅延リスク有</span>
                      </div>

                      {/* Non-LLM Column */}
                      <div className="p-2 bg-emerald-950/30 rounded border border-emerald-800/40 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-emerald-300 font-bold">
                          <span>非LLM決定論的経路 (CPU)</span>
                          <span className="font-mono text-emerald-300 font-bold">{lastShadowRecord.latencyNonLlmMs} ms</span>
                        </div>
                        <p className="text-[10px] text-emerald-200 font-mono break-all">{lastShadowRecord.nonLlmOutput}</p>
                        <span className="text-[9px] text-emerald-400 block font-semibold">
                          ⚡ 約{Math.round(lastShadowRecord.latencyLlmMs / lastShadowRecord.latencyNonLlmMs)}倍高速 / 一致度 {lastShadowRecord.semanticMatchScore}%
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 italic">
                      💡 監査メモ: {lastShadowRecord.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* History of comparisons */}
              {selectedTask.shadowRecords.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
                    <History className="w-3.5 h-3.5" />
                    <span>過去のシャドー検証履歴 ({selectedTask.shadowRecords.length}件)</span>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {selectedTask.shadowRecords.map((rec: ShadowComparisonRecord) => (
                      <div
                        key={rec.id}
                        className="p-2 bg-slate-950/60 rounded border border-slate-800 flex items-center justify-between text-[10px]"
                      >
                        <div className="space-y-0.5">
                          <div className="text-slate-200 font-mono truncate max-w-xs">入力: 「{rec.sampleInput}」</div>
                          <div className="text-slate-500 text-[9px]">{rec.notes}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-emerald-400 font-bold block">{rec.latencyNonLlmMs}ms</span>
                          <span className="text-slate-500 text-[9px]">LLM: {rec.latencyLlmMs}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              左側の一覧から移管タスクを選択してください
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
