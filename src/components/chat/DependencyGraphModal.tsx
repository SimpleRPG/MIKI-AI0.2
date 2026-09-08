import React, { useMemo, useState } from 'react';
import {
  X,
  Network,
  AlertOctagon,
  CheckCircle2,
  FileCode,
  Link2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Search,
  Filter,
} from 'lucide-react';
import {
  mikiSelfCodingSuperchargerService,
  DependencyGraphResult,
} from '../../services/mikiSelfCodingSuperchargerService';
import { WorkspaceFile } from '../../types';

interface DependencyGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: WorkspaceFile[];
  onSelectFile?: (filePath: string) => void;
  onRequestRefactor?: (prompt: string) => void;
}

export const DependencyGraphModal: React.FC<DependencyGraphModalProps> = ({
  isOpen,
  onClose,
  files,
  onSelectFile,
  onRequestRefactor,
}) => {
  if (!isOpen) return null;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'cycles' | 'orphans' | 'unresolved'>('all');

  // 依存グラフ計算
  const graph: DependencyGraphResult = useMemo(() => {
    return mikiSelfCodingSuperchargerService.analyzeDependencyGraph(
      files.map((f) => ({ path: f.path, content: f.content }))
    );
  }, [files]);

  // 最も多くインポートされているハブモジュール
  const topHubs = useMemo(() => {
    return Object.values(graph.nodes)
      .filter((n) => n.importedBy.length > 0)
      .sort((a, b) => b.importedBy.length - a.importedBy.length)
      .slice(0, 6);
  }, [graph]);

  // 検索・フィルタリングされたノード
  const filteredNodes = useMemo(() => {
    return Object.values(graph.nodes).filter((node) => {
      const matchSearch =
        !searchQuery || node.filePath.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      if (filterMode === 'orphans') {
        return graph.orphanFiles.includes(node.filePath);
      }
      if (filterMode === 'cycles') {
        return graph.cycles.some((c) => c.cycle.includes(node.filePath));
      }
      if (filterMode === 'unresolved') {
        return graph.unresolvedImports.some((u) => u.from === node.filePath);
      }
      return true;
    });
  }, [graph, searchQuery, filterMode]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-teal-500/40 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* ヘッダー */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 bg-teal-950/80 border border-teal-700/60 rounded-xl text-teal-300">
              <Network className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-100 flex items-center gap-2 truncate">
                <span>モジュール依存関係 & 循環参照 (Circular Import) インスペクター</span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-teal-300 rounded">
                  {graph.totalInternalModules} モジュール走査済み
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                import文を静的解析し、循環参照ループ・未解決リンク・孤立ファイルを即座に検知します
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

        {/* サマリーステータスバー */}
        <div className="px-4 py-2.5 bg-slate-950/50 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {/* 循環参照ステータス */}
          <div
            onClick={() => setFilterMode(graph.cycles.length > 0 ? 'cycles' : 'all')}
            className={`p-2 rounded-xl border cursor-pointer transition-colors ${
              graph.cycles.length > 0
                ? 'bg-rose-950/40 border-rose-600/70 text-rose-300 hover:bg-rose-900/40'
                : 'bg-slate-950 border-slate-800 text-emerald-400'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-[11px]">
              {graph.cycles.length > 0 ? (
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>循環参照 (Cycle)</span>
            </div>
            <div className="text-lg font-mono font-bold mt-0.5">
              {graph.cycles.length} <span className="text-[10px] font-normal font-sans">件検出</span>
            </div>
          </div>

          {/* 孤立ファイル */}
          <div
            onClick={() => setFilterMode('orphans')}
            className="p-2 rounded-xl border bg-slate-950 border-slate-800 hover:border-amber-500/50 text-amber-300 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-1.5 font-bold text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>参照されていない孤立ファイル</span>
            </div>
            <div className="text-lg font-mono font-bold mt-0.5">
              {graph.orphanFiles.length} <span className="text-[10px] font-normal font-sans">ファイル</span>
            </div>
          </div>

          {/* 未解決インポート */}
          <div
            onClick={() => setFilterMode('unresolved')}
            className="p-2 rounded-xl border bg-slate-950 border-slate-800 hover:border-sky-500/50 text-sky-300 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-1.5 font-bold text-[11px]">
              <Link2 className="w-3.5 h-3.5 text-sky-400" />
              <span>未解決の相対インポート</span>
            </div>
            <div className="text-lg font-mono font-bold mt-0.5">
              {graph.unresolvedImports.length} <span className="text-[10px] font-normal font-sans">件</span>
            </div>
          </div>

          {/* 総モジュール数 */}
          <div
            onClick={() => setFilterMode('all')}
            className="p-2 rounded-xl border bg-slate-950 border-slate-800 hover:border-teal-500/50 text-teal-300 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-1.5 font-bold text-[11px]">
              <Network className="w-3.5 h-3.5 text-teal-400" />
              <span>解析対象モジュール</span>
            </div>
            <div className="text-lg font-mono font-bold mt-0.5">
              {graph.totalInternalModules} <span className="text-[10px] font-normal font-sans">モジュール</span>
            </div>
          </div>
        </div>

        {/* 循環参照警告バナー (検知時) */}
        {graph.cycles.length > 0 && (
          <div className="px-4 py-3 bg-rose-950/60 border-b border-rose-600/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="font-bold text-rose-200 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                <span>循環参照ループが検知されました（バンドル肥大化や未定義バグの原因となります）:</span>
              </div>
              <div className="font-mono text-[11px] text-rose-300/90 pl-6 space-y-0.5">
                {graph.cycles.map((c, i) => (
                  <div key={i}>⚠️ {c.description}</div>
                ))}
              </div>
            </div>

            {onRequestRefactor && (
              <button
                type="button"
                onClick={() => {
                  const cycleDesc = graph.cycles.map((c) => c.description).join('\n');
                  onRequestRefactor(
                    `【循環参照の解消】以下の循環インポートを検知しました。共通インターフェースや型定義を別ファイルに抽出し、循環依存を排除してください：\n${cycleDesc}`
                  );
                  onClose();
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg flex items-center gap-1.5 shrink-0 shadow-md transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>みきに循環参照を解消させる</span>
              </button>
            )}
          </div>
        )}

        {/* フィルター＆検索ツールバー */}
        <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filterMode === 'all'
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              すべて ({graph.totalInternalModules})
            </button>
            <button
              onClick={() => setFilterMode('cycles')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filterMode === 'cycles'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              循環参照 ({graph.cycles.length})
            </button>
            <button
              onClick={() => setFilterMode('orphans')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filterMode === 'orphans'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              孤立ファイル ({graph.orphanFiles.length})
            </button>
            <button
              onClick={() => setFilterMode('unresolved')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filterMode === 'unresolved'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              未解決インポート ({graph.unresolvedImports.length})
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ファイル名で検索..."
              className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-teal-500"
            />
          </div>
        </div>

        {/* メインリスト */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* 主要ハブモジュール (上位インポート先) */}
          {filterMode === 'all' && !searchQuery && topHubs.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5 text-teal-400" />
                <span>コアハブモジュール (プロジェクト内で最も多く利用されているファイル)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {topHubs.map((hub) => (
                  <div
                    key={hub.filePath}
                    onClick={() => onSelectFile && onSelectFile(hub.filePath)}
                    className="p-2.5 bg-slate-950 border border-slate-800 hover:border-teal-500/50 rounded-xl cursor-pointer transition-colors"
                  >
                    <div className="font-mono text-xs text-teal-300 truncate font-semibold">
                      {hub.filePath.split('/').pop()}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{hub.filePath}</div>
                    <div className="text-[11px] text-slate-300 font-mono mt-1 flex items-center justify-between">
                      <span>被インポート数:</span>
                      <span className="font-bold text-teal-400">{hub.importedBy.length} 箇所</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ノード一覧 */}
          <div className="space-y-2">
            {filteredNodes.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 font-mono">
                該当するモジュールは見つかりませんでした
              </div>
            ) : (
              filteredNodes.map((node) => {
                const isOrphan = graph.orphanFiles.includes(node.filePath);
                const isCycle = graph.cycles.some((c) => c.cycle.includes(node.filePath));

                return (
                  <div
                    key={node.filePath}
                    className={`p-3 rounded-xl border transition-colors ${
                      isCycle
                        ? 'bg-rose-950/20 border-rose-600/50 hover:border-rose-500'
                        : isOrphan
                        ? 'bg-amber-950/10 border-amber-600/40 hover:border-amber-500'
                        : 'bg-slate-950/80 border-slate-800 hover:border-teal-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileCode className="w-4 h-4 text-teal-400 shrink-0" />
                          <span
                            onClick={() => onSelectFile && onSelectFile(node.filePath)}
                            className="font-mono text-xs font-bold text-slate-200 hover:text-teal-300 cursor-pointer truncate"
                          >
                            {node.filePath}
                          </span>

                          {isCycle && (
                            <span className="px-1.5 py-0.5 bg-rose-950 text-rose-300 border border-rose-600 rounded text-[9px] font-mono">
                              循環参照あり
                            </span>
                          )}
                          {isOrphan && (
                            <span className="px-1.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-600 rounded text-[9px] font-mono">
                              孤立ファイル
                            </span>
                          )}
                        </div>

                        {/* インポート詳細 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-[11px] font-mono">
                          {/* このファイルがインポートしているもの */}
                          <div className="p-2 bg-slate-900/70 rounded-lg border border-slate-800/80">
                            <div className="text-[10px] text-slate-400 mb-1 flex items-center justify-between">
                              <span>インポート先 ({node.imports.length}):</span>
                            </div>
                            {node.imports.length === 0 ? (
                              <div className="text-slate-600 text-[10px]">なし</div>
                            ) : (
                              <div className="max-h-20 overflow-y-auto space-y-0.5">
                                {node.imports.map((imp, idx) => (
                                  <div key={idx} className="text-slate-300 truncate">
                                    ➜ {imp}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* このファイルを利用しているモジュール */}
                          <div className="p-2 bg-slate-900/70 rounded-lg border border-slate-800/80">
                            <div className="text-[10px] text-slate-400 mb-1 flex items-center justify-between">
                              <span>被インポート元 ({node.importedBy.length}):</span>
                            </div>
                            {node.importedBy.length === 0 ? (
                              <div className="text-slate-600 text-[10px]">
                                {isOrphan ? 'どこからもインポートされていません' : 'エントリーポイント'}
                              </div>
                            ) : (
                              <div className="max-h-20 overflow-y-auto space-y-0.5">
                                {node.importedBy.map((impBy, idx) => (
                                  <div key={idx} className="text-teal-300 truncate">
                                    ⬅ {impBy.split('/').pop()}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>モジュール依存関係の健全性を保つことで、安全な大規模自律リファクタリングを実現します</span>
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
