import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Database,
  Trash2,
  RotateCcw,
  CheckCircle2,
  FileCheck,
  ShieldAlert,
  Server,
  Sparkles,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { storagePlanningService } from '../../services/storagePlanningService';
import { modelLifecycleService, ModelDecommissionEvaluation } from '../../services/modelLifecycleService';
import { StorageCapacityPlanReport } from '../../types';

export const StorageCapacityPlanTab: React.FC = () => {
  const [report, setReport] = useState<StorageCapacityPlanReport | null>(null);
  const [modelEvals, setModelEvals] = useState<ModelDecommissionEvaluation[]>([]);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanFeedback, setCleanFeedback] = useState<string | null>(null);
  const [evictFeedback, setEvictFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const rep = storagePlanningService.getCapacityReport();
    setReport(rep);
    const evals = modelLifecycleService.evaluateModelsForDecommission();
    setModelEvals(evals);
  };

  const handleRunCleanup = () => {
    setIsCleaning(true);
    setTimeout(() => {
      const res = storagePlanningService.runDeduplicationAndCleanup();
      setCleanFeedback(res.log);
      loadData();
      setIsCleaning(false);
    }, 600);
  };

  const handleEvictModel = async (evalItem: ModelDecommissionEvaluation) => {
    try {
      setEvictFeedback(null);
      const res = await modelLifecycleService.evictModel(evalItem.modelId, evalItem.modelName);
      setEvictFeedback(res.message);
      loadData();
    } catch (e: any) {
      setEvictFeedback(e.message || String(e));
    }
  };

  if (!report) {
    return <div className="text-xs text-slate-400">容量計画データを読み込み中...</div>;
  }

  const usedGb = (report.totalUsedMb / 1024).toFixed(2);
  const freeGb = (report.freeSpaceMb / 1024).toFixed(2);
  const usagePercentage = Math.round((report.totalUsedMb / (report.totalAllocatedGb * 1024)) * 100);

  return (
    <div className="space-y-6">
      {/* 第21章 & 第24章 設計思想ヘッダー */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-500/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
            <HardDrive className="w-5 h-5 text-cyan-400" />
            <span>設計思想 第21章: 保存容量配分 (Galaxy S25 60GB計画) ＆ 第24章 モデル自律退役思考</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-xs border border-cyan-500/30 flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Galaxy S25 60GB Quota</span>
          </span>
        </div>
        <p className="text-slate-300 text-xs leading-relaxed">
          Galaxy S25の本体ストレージのうち約60GBをAI専用領域として厳格に予算管理します。
          「モデル関係: 18GB」「会話・教材データ: 12GB」「評価・実験: 8GB」「LoRA・候補成果物: 8GB」「バックアップ: 6GB」「空き・一時領域: 8GB」に配分し、
          第21章の規定に従い<strong>同一ハッシュ教材の重複排除と監査ログ付き定期クリーンアップ</strong>を自動執行するとともに、
          第24章の<strong>モデル自律退役思考（Qwen 3B絶対保護）</strong>によりストレージを健全に保ちます。
        </p>

        {/* 60GB 全体ゲージ */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>使用済み容量: <strong>{usedGb} GB</strong> / {report.totalAllocatedGb} GB ({usagePercentage}%)</span>
            <span className="text-cyan-400 font-bold">空き容量: {freeGb} GB</span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex">
            {report.partitions.map((p) => {
              const widthPct = Math.max(2, (p.estimatedMb / (report.totalAllocatedGb * 1024)) * 100);
              const colorClass =
                p.category === 'models'
                  ? 'bg-indigo-500'
                  : p.category === 'dialogue_and_materials'
                  ? 'bg-amber-500'
                  : p.category === 'eval_and_experiments'
                  ? 'bg-emerald-500'
                  : p.category === 'lora_and_artifacts'
                  ? 'bg-pink-500'
                  : p.category === 'backups'
                  ? 'bg-purple-500'
                  : 'bg-cyan-500';
              return (
                <div
                  key={p.id}
                  style={{ width: `${widthPct}%` }}
                  title={`${p.name}: ${p.estimatedMb}MB`}
                  className={`${colorClass} h-full transition-all`}
                />
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleRunCleanup}
            disabled={isCleaning}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-900/30"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isCleaning ? 'クリーンアップ実行中...' : '21/24章 重複排除 ＆ モデル退役思考実行'}</span>
          </button>

          <span className="text-[10px] text-slate-400">
            重複排除回収済み: <strong>{report.deduplicationStats.spaceSavedMb} MB</strong> ({report.deduplicationStats.duplicateItemsFound}件の重複解消)
          </span>
        </div>

        {cleanFeedback && (
          <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{cleanFeedback}</span>
          </div>
        )}
      </div>

      {/* 各パーティションのカード一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {report.partitions.map((p) => {
          const quotaMb = p.allocatedGb * 1024;
          const pct = Math.min(100, Math.round((p.estimatedMb / quotaMb) * 100));
          return (
            <div
              key={p.id}
              className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-100">{p.name.split(' (')[0]}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-cyan-300 border border-slate-800">
                    上限 {p.allocatedGb} GB
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 mt-2">{p.description}</div>

                <div className="space-y-1 mt-3">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">使用量: <strong>{p.estimatedMb} MB</strong></span>
                    <span className="text-slate-400 font-mono">{pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full bg-cyan-500 rounded-full transition-all"
                    />
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-[10px] text-slate-400 bg-slate-950/70 p-2 rounded border border-slate-800/60">
                  <span className="text-slate-300 font-bold block mb-1">格納アイテム抜粋:</span>
                  {p.itemsDetail.map((item, i) => (
                    <div key={i} className="truncate">• {item}</div>
                  ))}
                </div>
              </div>

              <div className="pt-2 text-[10px] text-slate-500 flex items-center justify-between">
                <span>登録数: {p.itemCount} 件</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>正常</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 21章/24章 自動整理・重複排除 監査ログ */}
      <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-cyan-400" />
            <span>21章/24章 自動整理・モデル自律思考 監査ログ (最近10件)</span>
          </span>
          <span className="text-[10px] text-slate-500">SHA-256重複チェック＆モデル退役思考</span>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto text-[11px] font-mono text-slate-300 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
          {report.deduplicationStats.auditLog.length === 0 ? (
            <div className="text-slate-500">まだ監査ログはありません。上の「重複排除 ＆ 自動整理実行」ボタンを押して整理を実行してください。</div>
          ) : (
            report.deduplicationStats.auditLog.map((log, idx) => (
              <div key={idx} className="text-slate-300 leading-relaxed">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 第24章 実測データ駆動型モデル自律退役思考 ＆ Qwen 3B絶対保護モニター */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-indigo-500/20">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <div>
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>第24章: 端末リソース適応型モデル自律獲得・検証 ＆ 退役思考</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                  Qwen 3B絶対保護
                </span>
              </h4>
              <p className="text-[11px] text-slate-400">
                実測推論速度(tok/s)、TTFT遅延、直近14日利用頻度、回帰スコアを常時監視し、不要なサブモデルの削除思考・ストレージ回収を自律実行します。
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 self-end sm:self-auto transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>メトリクス再評価</span>
          </button>
        </div>

        {evictFeedback && (
          <div className="p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-500/60 text-indigo-200 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>{evictFeedback}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {modelEvals.map((evalItem) => (
            <div
              key={evalItem.modelId}
              className={`p-3.5 rounded-xl border transition-all ${
                evalItem.isProtected
                  ? 'bg-amber-950/20 border-amber-500/40'
                  : evalItem.recommendation === 'RECOMMEND_DELETION'
                  ? 'bg-rose-950/20 border-rose-500/40'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-slate-100">{evalItem.modelName}</span>
                    {evalItem.isProtected ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-amber-400" />
                        <span>不滅アンカー保護</span>
                      </span>
                    ) : evalItem.recommendation === 'RECOMMEND_DELETION' ? (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        <span>削除推奨候補</span>
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-semibold">
                        アクティブ運用
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    {evalItem.evaluationReason}
                  </p>
                </div>

                {!evalItem.isProtected && (
                  <button
                    onClick={() => handleEvictModel(evalItem)}
                    className="px-2.5 py-1 bg-rose-900/40 hover:bg-rose-800/60 text-rose-200 border border-rose-700/50 rounded-lg text-[10px] font-bold shrink-0 flex items-center gap-1 transition-colors"
                    title="モデルキャッシュを安全に整理・削除"
                  >
                    <Trash2 className="w-3 h-3 text-rose-400" />
                    <span>回収</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 mt-3 pt-2 border-t border-slate-800/60 text-[10px] font-mono">
                <div className="bg-slate-900/80 p-1.5 rounded text-center">
                  <span className="text-slate-500 block text-[9px]">推論速度</span>
                  <span className="text-slate-200 font-bold">{evalItem.metrics.avgTps} tok/s</span>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded text-center">
                  <span className="text-slate-500 block text-[9px]">初回遅延</span>
                  <span className="text-slate-200 font-bold">{evalItem.metrics.timeToFirstTokenMs}ms</span>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded text-center">
                  <span className="text-slate-500 block text-[9px]">14日利用</span>
                  <span className="text-slate-200 font-bold">{evalItem.metrics.usageCountLast14Days}回</span>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded text-center">
                  <span className="text-slate-500 block text-[9px]">回帰品質</span>
                  <span className="text-emerald-400 font-bold">{evalItem.metrics.regressionScore}点</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
