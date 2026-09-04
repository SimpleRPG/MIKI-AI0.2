import React, { useState, useEffect } from 'react';
import {
  Compass,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  Wrench,
  Activity,
  Cpu,
  Archive,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  FolderTree,
  FileCode,
  Tag,
  BookOpen,
} from 'lucide-react';
import { MemoryItem, MemoryDestination, ExperienceRoutingResult } from '../../types';
import { experienceRouterService } from '../../services/experienceRouterService';
import { storageService } from '../../services/storageService';
import { skillsService } from '../../services/skillsService';
import { regressionBenchmarkService } from '../../services/regressionBenchmarkService';
import { selfImprovementService } from '../../services/selfImprovementService';

interface ExperienceRouterTabProps {
  onRefreshAll?: () => void;
}

const DESTINATION_CONFIG: Record<
  MemoryDestination,
  { label: string; icon: any; color: string; bg: string; border: string; desc: string }
> = {
  working_memory: {
    label: '作業記憶',
    icon: Compass,
    color: 'text-amber-400',
    bg: 'bg-amber-950/40',
    border: 'border-amber-700/60',
    desc: '会話・セッション限定の一時状態',
  },
  long_term_memory: {
    label: '長期記憶',
    icon: BookOpen,
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-700/60',
    desc: '確定した事実・普遍的なユーザー好み・継続ルール',
  },
  project_memory: {
    label: 'プロジェクト記憶',
    icon: FolderTree,
    color: 'text-sky-400',
    bg: 'bg-sky-950/40',
    border: 'border-sky-700/60',
    desc: '特定案件・リポジトリ・VBA仕様限定のコンテキスト',
  },
  skill: {
    label: 'スキル',
    icon: Wrench,
    color: 'text-indigo-400',
    bg: 'bg-indigo-950/40',
    border: 'border-indigo-700/60',
    desc: '手順化・再利用可能な実行可能手順',
  },
  search_policy: {
    label: '検索ポリシー',
    icon: Search,
    color: 'text-cyan-400',
    bg: 'bg-cyan-950/40',
    border: 'border-cyan-700/60',
    desc: 'どの情報をどう検索・取得すべきかの方針',
  },
  retrieval_policy: {
    label: '検索ポリシー',
    icon: Search,
    color: 'text-cyan-400',
    bg: 'bg-cyan-950/40',
    border: 'border-cyan-700/60',
    desc: '検索・情報探索の方針',
  },
  evaluation_set: {
    label: '評価セット',
    icon: Activity,
    color: 'text-pink-400',
    bg: 'bg-pink-950/40',
    border: 'border-pink-700/60',
    desc: '能力検証・回帰ベンチマークテストケース候補',
  },
  lora_dataset: {
    label: 'LoRA教材',
    icon: Cpu,
    color: 'text-purple-400',
    bg: 'bg-purple-950/40',
    border: 'border-purple-700/60',
    desc: 'モデル追加学習用の高品質instruction/outputペア',
  },
  quarantine: {
    label: '隔離',
    icon: ShieldAlert,
    color: 'text-rose-400',
    bg: 'bg-rose-950/40',
    border: 'border-rose-700/60',
    desc: '出典・正解不明または高リスク情報 (プロンプト注入完全除外)',
  },
  discard_candidate: {
    label: '破棄候補',
    icon: Trash2,
    color: 'text-slate-400',
    bg: 'bg-slate-900/60',
    border: 'border-slate-700/60',
    desc: '重複・誤り・低評価過多の削除候補',
  },
};

export const ExperienceRouterTab: React.FC<ExperienceRouterTabProps> = ({ onRefreshAll }) => {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [filterDest, setFilterDest] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [routingResults, setRoutingResults] = useState<{ [id: string]: ExperienceRoutingResult }>({});
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadData = () => {
    const raw = storageService.getItem('miki_memories');
    if (raw) {
      try {
        const parsed: MemoryItem[] = JSON.parse(raw);
        setMemories(parsed);

        // 各記憶のルーティング判定を算出
        const resMap: { [id: string]: ExperienceRoutingResult } = {};
        parsed.forEach((m) => {
          resMap[m.id] = experienceRouterService.routeExperience(m, parsed);
        });
        setRoutingResults(resMap);
      } catch (e) {
        console.warn('Failed to parse memories:', e);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 1. 全記憶の一括ルーティング再評価
  const handleReevaluateAll = () => {
    setIsBatchProcessing(true);
    try {
      const resMap: { [id: string]: ExperienceRoutingResult } = {};
      const updated = memories.map((m) => {
        const r = experienceRouterService.routeExperience(m, memories);
        resMap[m.id] = r;
        return {
          ...m,
          destination: r.destination,
          routingFactors: r.factors,
        };
      });

      storageService.setItem('miki_memories', JSON.stringify(updated));
      setMemories(updated);
      setRoutingResults(resMap);
      setActionMessage('✓ 全記憶を49章ルール（9分類）に基づき自動再評価・仕分けしました。');
      setTimeout(() => setActionMessage(null), 4000);
      if (onRefreshAll) onRefreshAll();
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // 2. 隔離からの安全昇格
  const handlePromoteFromQuarantine = (mem: MemoryItem, targetDest: MemoryDestination = 'long_term_memory') => {
    const res = experienceRouterService.promoteFromQuarantine(mem, targetDest);
    loadData();
    setActionMessage(`✓ 記憶「${mem.content.slice(0, 25)}...」を隔離から解除し、【${DESTINATION_CONFIG[targetDest]?.label || targetDest}】へ昇格しました。`);
    setTimeout(() => setActionMessage(null), 4000);
    if (onRefreshAll) onRefreshAll();
  };

  // 3. スキルライブラリへのエクスポート
  const handleExportToSkill = (mem: MemoryItem) => {
    const skill = experienceRouterService.exportToSkill(mem);
    if (skill) {
      setActionMessage(`🎉 スキル「${skill.name}」としてスキルライブラリへ正式登録しました！`);
    } else {
      setActionMessage('⚠️ スキルへの変換要件（手順または再利用性）を満たしていません。');
    }
    loadData();
    setTimeout(() => setActionMessage(null), 4000);
    if (onRefreshAll) onRefreshAll();
  };

  // 4. ベンチマーク退行テストケースへのエクスポート
  const handleExportToBenchmark = (mem: MemoryItem) => {
    const tc = experienceRouterService.exportToRegressionBenchmark(mem);
    if (tc) {
      setActionMessage(`🧪 退行テストケース「${tc.title}」としてベンチマークへ自動登録しました！`);
    } else {
      setActionMessage('⚠️ テストケース形式の要件を満たしていません。');
    }
    loadData();
    setTimeout(() => setActionMessage(null), 4000);
    if (onRefreshAll) onRefreshAll();
  };

  // 5. 破棄候補の一括クリーンアップ
  const handleCleanDiscardCandidates = () => {
    const candidates = memories.filter(
      (m) => m.destination === 'discard_candidate' || (routingResults[m.id]?.destination === 'discard_candidate')
    );
    if (candidates.length === 0) {
      setActionMessage('破棄候補の記憶はありません。');
      setTimeout(() => setActionMessage(null), 3000);
      return;
    }

    const remaining = memories.filter(
      (m) => m.destination !== 'discard_candidate' && routingResults[m.id]?.destination !== 'discard_candidate'
    );
    storageService.setItem('miki_memories', JSON.stringify(remaining));
    setMemories(remaining);
    setActionMessage(`✓ 破棄候補 ${candidates.length} 件を一括クリーンアップしました。`);
    setTimeout(() => setActionMessage(null), 4000);
    if (onRefreshAll) onRefreshAll();
  };

  // フィルタリング
  const filteredMemories = memories.filter((m) => {
    const r = routingResults[m.id];
    const currentDest = m.destination || r?.destination || 'working_memory';

    if (filterDest !== 'all' && currentDest !== filterDest) {
      return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return m.content.toLowerCase().includes(q) || (m.tags || []).some((t) => t.toLowerCase().includes(q));
    }

    return true;
  });

  // 統計集計
  const countsByDest: Record<string, number> = {};
  memories.forEach((m) => {
    const dest = m.destination || routingResults[m.id]?.destination || 'working_memory';
    countsByDest[dest] = (countsByDest[dest] || 0) + 1;
  });

  const quarantineCount = countsByDest['quarantine'] || 0;
  const discardCount = countsByDest['discard_candidate'] || 0;
  const skillCount = countsByDest['skill'] || 0;
  const benchmarkCount = countsByDest['evaluation_set'] || 0;

  return (
    <div className="space-y-4 text-slate-200">
      {/* 49章 ヘッダーバナー */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xl">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>第49章 経験の保存先ルーター (Experience Destination Router)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30">
                自律9分類仕分け
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              更新頻度・適用範囲・再利用性・機械検証性・出典信頼度・機密情報を評価し、経験を適切な記憶階層・スキル・教材へ自動配分
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReevaluateAll}
            disabled={isBatchProcessing}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBatchProcessing ? 'animate-spin' : ''}`} />
            <span>全件再評価・自律仕分け</span>
          </button>
          {discardCount > 0 && (
            <button
              onClick={handleCleanDiscardCandidates}
              className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>破棄候補を一括削除 ({discardCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* アクション完了通知 */}
      {actionMessage && (
        <div className="p-2.5 bg-purple-950/50 border border-purple-500/50 rounded-lg text-xs text-purple-200 animate-fadeIn flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* 9分類サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-[10.5px]">総記憶・経験数</div>
          <div className="text-lg font-bold text-slate-100 font-mono mt-0.5">{memories.length} 件</div>
        </div>
        <div className="p-2.5 bg-rose-950/30 rounded-xl border border-rose-900/40">
          <div className="text-rose-400 text-[10.5px] flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            <span>隔離 (要安全確認)</span>
          </div>
          <div className="text-lg font-bold text-rose-200 font-mono mt-0.5">{quarantineCount} 件</div>
        </div>
        <div className="p-2.5 bg-indigo-950/30 rounded-xl border border-indigo-900/40">
          <div className="text-indigo-400 text-[10.5px] flex items-center gap-1">
            <Wrench className="w-3 h-3" />
            <span>スキル候補</span>
          </div>
          <div className="text-lg font-bold text-indigo-200 font-mono mt-0.5">{skillCount} 件</div>
        </div>
        <div className="p-2.5 bg-pink-950/30 rounded-xl border border-pink-900/40">
          <div className="text-pink-400 text-[10.5px] flex items-center gap-1">
            <Activity className="w-3 h-3" />
            <span>評価セット候補</span>
          </div>
          <div className="text-lg font-bold text-pink-200 font-mono mt-0.5">{benchmarkCount} 件</div>
        </div>
        <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-[10.5px] flex items-center gap-1">
            <Trash2 className="w-3 h-3" />
            <span>破棄候補 (重複/低評価)</span>
          </div>
          <div className="text-lg font-bold text-slate-300 font-mono mt-0.5">{discardCount} 件</div>
        </div>
      </div>

      {/* フィルタ & 検索バー */}
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterDest('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              filterDest === 'all' ? 'bg-purple-600 text-white shadow' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            すべて ({memories.length})
          </button>
          {Object.entries(DESTINATION_CONFIG)
            .filter(([k]) => k !== 'retrieval_policy')
            .map(([destKey, conf]) => {
              const cnt = countsByDest[destKey] || 0;
              if (cnt === 0 && filterDest !== destKey) return null;
              return (
                <button
                  key={destKey}
                  onClick={() => setFilterDest(destKey)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                    filterDest === destKey
                      ? `${conf.bg} ${conf.color} border ${conf.border} shadow`
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{conf.label}</span>
                  <span className="text-[10px] font-mono opacity-80">({cnt})</span>
                </button>
              );
            })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="記憶を検索 (キーワード/タグ)..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* 経験カード一覧 */}
      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
        {filteredMemories.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-900">
            該当する経験・記憶レコードはありません。
          </div>
        ) : (
          filteredMemories.map((mem) => {
            const routing = routingResults[mem.id] || experienceRouterService.routeExperience(mem, memories);
            const currentDest = mem.destination || routing.destination;
            const destConf = DESTINATION_CONFIG[currentDest] || DESTINATION_CONFIG['working_memory'];
            const DestIcon = destConf.icon;

            return (
              <div
                key={mem.id}
                className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 hover:border-slate-700 transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold border flex items-center gap-1 ${destConf.bg} ${destConf.color} ${destConf.border}`}
                    >
                      <DestIcon className="w-3 h-3" />
                      <span>{destConf.label}</span>
                    </span>

                    <span className="text-[10px] text-slate-500 font-mono">ID: {mem.id}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded font-mono">
                      種別: {mem.memoryType || 'semantic'}
                    </span>
                    {mem.routingFactors?.scope && (
                      <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded font-mono">
                        適用: {mem.routingFactors.scope}
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-500 font-mono">
                    リスク: {routing.riskScore}点
                  </div>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed bg-black/40 p-2 rounded-lg border border-slate-800/80 font-sans whitespace-pre-wrap">
                  {mem.content}
                </p>

                {/* 判定理由 & 要因 */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-purple-300">
                    <span className="font-bold">49章判定理由:</span>
                    <span>{routing.reason}</span>
                  </div>

                  {/* アクションボタン */}
                  <div className="flex items-center gap-1.5">
                    {currentDest === 'quarantine' && (
                      <button
                        onClick={() => handlePromoteFromQuarantine(mem, 'long_term_memory')}
                        className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold text-[10px] flex items-center gap-1 transition-colors"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        <span>安全承認・隔離解除</span>
                      </button>
                    )}

                    {(currentDest === 'skill' || routing.suggestedAction === 'export_skill') && (
                      <button
                        onClick={() => handleExportToSkill(mem)}
                        className="px-2 py-1 bg-indigo-700 hover:bg-indigo-600 text-white rounded font-bold text-[10px] flex items-center gap-1 transition-colors"
                      >
                        <Wrench className="w-3 h-3" />
                        <span>スキルへ昇格</span>
                      </button>
                    )}

                    {(currentDest === 'evaluation_set' || routing.suggestedAction === 'export_benchmark') && (
                      <button
                        onClick={() => handleExportToBenchmark(mem)}
                        className="px-2 py-1 bg-pink-700 hover:bg-pink-600 text-white rounded font-bold text-[10px] flex items-center gap-1 transition-colors"
                      >
                        <Activity className="w-3 h-3" />
                        <span>評価セットへ登録</span>
                      </button>
                    )}

                    {currentDest !== 'discard_candidate' && (
                      <button
                        onClick={() => {
                          const updated = experienceRouterService.markForDiscard(mem, 'ユーザーによる手動破棄指定');
                          loadData();
                          setActionMessage(`記憶「${mem.content.slice(0, 20)}...」を破棄候補に移動しました。`);
                          setTimeout(() => setActionMessage(null), 3000);
                        }}
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-300 rounded transition-colors"
                        title="破棄候補へ移動"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}

                    {currentDest === 'discard_candidate' && (
                      <button
                        onClick={() => {
                          experienceRouterService.unmarkDiscard(mem);
                          loadData();
                          setActionMessage(`記憶「${mem.content.slice(0, 20)}...」を破棄候補から復元しました。`);
                          setTimeout(() => setActionMessage(null), 3000);
                        }}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] transition-colors"
                      >
                        復元
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
