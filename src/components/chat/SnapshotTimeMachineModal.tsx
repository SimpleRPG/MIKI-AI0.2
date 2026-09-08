import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  RotateCcw,
  CheckCircle2,
  FileCode,
  Clock,
  ShieldCheck,
  AlertCircle,
  Eye,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import {
  mikiSelfCodingSuperchargerService,
  SnapshotRecord,
} from '../../services/mikiSelfCodingSuperchargerService';

interface SnapshotTimeMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRollbackComplete?: (filePath: string, restoredContent: string) => void;
}

export const SnapshotTimeMachineModal: React.FC<SnapshotTimeMachineModalProps> = ({
  isOpen,
  onClose,
  onRollbackComplete,
}) => {
  if (!isOpen) return null;

  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotRecord | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const data = await mikiSelfCodingSuperchargerService.fetchSnapshots();
      setSnapshots(data);
      if (data.length > 0 && !selectedSnapshot) {
        setSelectedSnapshot(data[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  const handleRollback = async (snap: SnapshotRecord) => {
    if (!confirm(`「${snap.filePath}」をこの時点 (${new Date(snap.timestamp).toLocaleTimeString()}) の状態に復元しますか？`)) {
      return;
    }

    setRollingBackId(snap.id);
    try {
      const res = await mikiSelfCodingSuperchargerService.rollbackSnapshot(snap.id);
      if (res.success) {
        setStatusMessage(`✅ ${snap.filePath} を安全に復元しました！`);
        if (onRollbackComplete) {
          onRollbackComplete(snap.filePath, snap.originalContent);
        }
        await loadSnapshots();
      } else {
        setStatusMessage(`❌ 復元に失敗しました: ${res.message}`);
      }
    } catch (e: any) {
      setStatusMessage(`❌ エラー: ${e.message || '復元処理中に例外が発生しました'}`);
    } finally {
      setRollingBackId(null);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-fuchsia-500/40 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* ヘッダー */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 bg-fuchsia-950/80 border border-fuchsia-700/60 rounded-xl text-fuchsia-300">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-100 flex items-center gap-2 truncate">
                <span>みき自律コード スナップショット・タイムマシン</span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-fuchsia-300 rounded">
                  {snapshots.length} 件の退避履歴
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                みきが自動でコード変更する直前の全状態が保存されています。いつでも1秒で安全に復元可能です
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ステータス通知 */}
        {statusMessage && (
          <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 text-xs text-white flex items-center justify-between animate-in slide-in-from-top-1">
            <span>{statusMessage}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white text-xs ml-2 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* メイン 2ペインレイアウト */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* 左側: スナップショット履歴一覧 */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/60 flex flex-col shrink-0">
            <div className="p-2.5 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>自動保存スナップショット</span>
              </span>
              <button
                type="button"
                onClick={loadSnapshots}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="再読み込み"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {snapshots.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 font-mono">
                  まだスナップショット履歴はありません
                </div>
              ) : (
                snapshots.map((snap) => {
                  const isSelected = selectedSnapshot?.id === snap.id;
                  const dateStr = new Date(snap.timestamp).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <div
                      key={snap.id}
                      onClick={() => setSelectedSnapshot(snap)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-fuchsia-950/40 border-fuchsia-500/60 text-fuchsia-200'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {dateStr}
                        </span>
                        <span className="px-1.5 py-0.2 bg-black/40 rounded text-slate-400 truncate max-w-[80px]">
                          {snap.id.slice(0, 8)}
                        </span>
                      </div>

                      <div className="font-bold truncate text-slate-200 flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                        <span className="truncate">{snap.filePath.split('/').pop()}</span>
                      </div>

                      <div className="text-[11px] text-slate-400 truncate mt-1">
                        {snap.message || '自律変更前の自動バックアップ'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 右側: 選択スナップショットのプレビュー & ロールバックアクション */}
          <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
            {selectedSnapshot ? (
              <>
                <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-200 font-mono truncate">
                      復元対象: {selectedSnapshot.filePath}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      保存時刻: {new Date(selectedSnapshot.timestamp).toLocaleString()}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRollback(selectedSnapshot)}
                    disabled={rollingBackId === selectedSnapshot.id}
                    className="px-3 py-1.5 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-fuchsia-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${rollingBackId === selectedSnapshot.id ? 'animate-spin' : ''}`} />
                    <span>この時点に復元 (Rollback)</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                    <span>退避されていたバックアップコード:</span>
                    <span className="font-mono text-[10px]">
                      {selectedSnapshot.originalContent.split('\n').length} 行
                    </span>
                  </div>
                  <pre className="p-3 bg-black/80 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 overflow-x-auto select-text leading-relaxed">
                    {selectedSnapshot.originalContent}
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-500 font-mono">
                スナップショットを選択してください
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-fuchsia-400" />
            <span>自律コード変更の安全スナップショットにより、破壊的変更のリスクをゼロ化します</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
