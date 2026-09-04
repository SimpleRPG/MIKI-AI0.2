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
} from 'lucide-react';
import { storagePlanningService } from '../../services/storagePlanningService';
import { StorageCapacityPlanReport } from '../../types';

export const StorageCapacityPlanTab: React.FC = () => {
  const [report, setReport] = useState<StorageCapacityPlanReport | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanFeedback, setCleanFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const rep = storagePlanningService.getCapacityReport();
    setReport(rep);
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

  if (!report) {
    return <div className="text-xs text-slate-400">容量計画データを読み込み中...</div>;
  }

  const usedGb = (report.totalUsedMb / 1024).toFixed(2);
  const freeGb = (report.freeSpaceMb / 1024).toFixed(2);
  const usagePercentage = Math.round((report.totalUsedMb / (report.totalAllocatedGb * 1024)) * 100);

  return (
    <div className="space-y-6">
      {/* 28章 設計思想ヘッダー */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-500/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
            <HardDrive className="w-5 h-5 text-cyan-400" />
            <span>設計思想 28章: 保存容量計画 (60GB配分モニター) ＆ 29章 自動整理</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-xs border border-cyan-500/30 flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Galaxy S25 60GB Quota</span>
          </span>
        </div>
        <p className="text-slate-300 text-xs leading-relaxed">
          Galaxy S25の本体ストレージのうち約60GBをAI専用領域として厳格に予算管理します。
          「モデル関係: 18GB」「会話・教材データ: 12GB」「評価・実験: 8GB」「LoRA・候補成果物: 8GB」「バックアップ: 6GB」「空き・一時領域: 8GB」に配分し、
          29章の規定に従い、<strong>同一ハッシュ教材の重複排除と監査ログ付き定期クリーンアップ</strong>を自動執行します。
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
            <span>{isCleaning ? 'クリーンアップ実行中...' : '29章 重複排除 ＆ 自動整理実行'}</span>
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

      {/* 29章 自動整理・重複排除 監査ログ */}
      <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-cyan-400" />
            <span>29章 自動整理 監査ログ (最近10件)</span>
          </span>
          <span className="text-[10px] text-slate-500">SHA-256重複チェック＆キャッシュパージ</span>
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
    </div>
  );
};
