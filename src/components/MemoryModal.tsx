import React, { useState } from 'react';
import {
  Brain,
  Sparkles,
  Heart,
  Plus,
  Trash2,
  Lock,
  Smile,
  Zap,
  Download,
  Flame,
  Layers,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  Send,
  Wand2,
  Check,
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
  RefreshCw,
  Clock,
  Network,
  GitBranch,
  Search,
  Link,
  ChevronRight,
  AlertTriangle,
  Ban,
  Filter,
} from 'lucide-react';
import { MemoryItem, PersonaConfig, MemoryType } from '../types';
import {
  JAPANESE_NATURAL_DIALOGUE_CORPUS,
  ANTI_ROBOTIC_JAPANESE_RULES,
  INITIAL_JAPANESE_MEMORIES,
} from '../data/japaneseKnowledgeData';
import { MASTER_EDUCATION_MEMORIES } from '../data/masterEducationKnowledge';
import {
  retrieveScoredMemories,
  ScoredMemory,
  calculateDomainVector,
  SEMANTIC_DOMAINS,
  enrichMemoryMetadata,
  detectAndLinkConflicts,
  resolveMemoryConflict,
  dismissMemoryConflict,
} from '../utils/memoryRetrieval';
import { storageService } from '../services/storageService';

export interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  persona: PersonaConfig;
  onUpdatePersona: React.Dispatch<React.SetStateAction<PersonaConfig>> | ((persona: PersonaConfig) => void);
  memories: MemoryItem[];
  onUpdateMemories: React.Dispatch<React.SetStateAction<MemoryItem[]>> | ((memories: MemoryItem[]) => void);
}

export const MemoryModal: React.FC<MemoryModalProps> = ({
  isOpen,
  onClose,
  persona,
  onUpdatePersona,
  memories,
  onUpdateMemories,
}) => {
  const [teachInput, setTeachInput] = useState('');
  const [selectedMemoryType, setSelectedMemoryType] = useState<MemoryType>('semantic');
  const [activeSubTab, setActiveSubTab] = useState<'persona' | 'teach' | 'memory' | 'corpus' | 'graph'>('teach');
  const [exportedStatus, setExportedStatus] = useState<string | null>(null);
  const [memoryFilter, setMemoryFilter] = useState<'all' | 'approved' | 'unapproved' | 'conflicted' | MemoryType>('all');
  const [expandedConflictId, setExpandedConflictId] = useState<string | null>(null);

  // 知識グラフ & 多層ベクトル検索シミュレーター用ステート
  const [graphSearchQuery, setGraphSearchQuery] = useState('ゲームの脱ロボットとタメ口会話');
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);
  const [graphTraverseEnabled, setGraphTraverseEnabled] = useState(true);

  // Auto classify category behind the scenes so user doesn't need to pick
  const detectCategory = (text: string): MemoryItem['category'] => {
    const t = text.toLowerCase();
    if (t.includes('ゲーム') || t.includes('canvas') || t.includes('コード') || t.includes('ボタン') || t.includes('css') || t.includes('js') || t.includes('html') || t.includes('バグ')) {
      return 'gamedev';
    }
    if (t.includes('好き') || t.includes('嫌い') || t.includes('好み') || t.includes('カラー') || t.includes('スタイル') || t.includes('テーマ')) {
      return 'preference';
    }
    if (t.includes('私') || t.includes('僕') || t.includes('俺') || t.includes('名前') || t.includes('趣味') || t.includes('仕事') || t.includes('年齢')) {
      return 'profile';
    }
    if (t.includes('約束') || t.includes('相棒') || t.includes('仲良') || t.includes('二人') || t.includes('友達')) {
      return 'relationship';
    }
    return 'preference';
  };

  // Quick Direct Freeform Teaching (No category selection required!)
  const handleQuickTeach = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = teachInput.trim();
    if (!trimmed) return;

    const category = detectCategory(trimmed);
    const rawMemories = storageService.getMemories();
    const newItem = enrichMemoryMetadata(
      {
        id: 'mem_teach_' + Date.now(),
        category,
        content: trimmed,
        importance: 5,
        pinned: true,
        active: true,
        approved: true, // ユーザー直接手動教育は承認
        memoryType: selectedMemoryType,
        goodCount: 1,
        badCount: 0,
        source: 'manual',
        tags: ['ユーザー直接教育', category],
      },
      {
        rawUserText: trimmed,
        sourceRef: 'user_direct',
        existingMemories: rawMemories,
      }
    );

    storageService.saveMemoryItem(newItem);
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }

    setTeachInput('');
    setExportedStatus(`✨ 「${trimmed.slice(0, 24)}${trimmed.length > 24 ? '...' : ''}」を教育完了！全LLMに即時自動反映されました！🌸`);
    setTimeout(() => setExportedStatus(null), 4000);
  };

  const handleToggleApproved = (id: string) => {
    const mem = memories.find((m) => m.id === id);
    if (!mem) return;
    const nextApproved = !mem.approved;
    storageService.saveMemoryItem({ ...mem, approved: nextApproved, updatedAt: Date.now() });
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setExportedStatus(nextApproved ? '✅ 記憶を承認しました（推論で確定事実として利用）' : '⚠️ 記憶を未承認（仮推論情報）に設定しました');
    setTimeout(() => setExportedStatus(null), 3000);
  };

  const handleApproveMemory = (id: string) => {
    const mem = memories.find((m) => m.id === id);
    if (!mem) return;
    storageService.saveMemoryItem({ ...mem, approved: true, updatedAt: Date.now() });
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setExportedStatus('✅ 記憶を承認しました！');
    setTimeout(() => setExportedStatus(null), 3000);
  };

  const handleAdjustFeedback = (id: string, delta: number) => {
    const mem = memories.find((m) => m.id === id);
    if (!mem) return;
    const currentGood = mem.goodCount ?? 0;
    const nextGood = Math.max(0, currentGood + delta);
    storageService.saveMemoryItem({ ...mem, goodCount: nextGood, updatedAt: Date.now() });
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
  };

  const handleDelete = (id: string) => {
    storageService.deleteMemoryItem(id);
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
  };

  // 競合解決ハンドラー: keepId を正（approved: true, active: true）とし、discardId を無効化（active: false）
  const handleResolveConflict = (keepId: string, discardId: string) => {
    storageService.resolveConflict(keepId, discardId);
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setExportedStatus('✅ 記憶の競合を解決しました（選択した記憶を有効化・承認し、競合相手をアーカイブ）');
    setTimeout(() => setExportedStatus(null), 4000);
  };

  // 競合解除ハンドラー: 両方を保持したまま相互の conflictWith を削除
  const handleDismissConflict = (idA: string, idB: string) => {
    storageService.dismissConflict(idA, idB);
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setExportedStatus('🤝 競合フラグを解除し、両方の記憶を保持しました');
    setTimeout(() => setExportedStatus(null), 4000);
  };

  // 重複記憶の自動統合・整理 & 競合検出 (設計思想 12 & 25)
  const handleConsolidateMemories = () => {
    const seen = new Set<string>();
    const deduplicated: MemoryItem[] = [];
    let mergedCount = 0;

    for (const mem of memories) {
      const normalized = mem.content.trim().toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        deduplicated.push(mem);
      } else {
        mergedCount++;
      }
    }

    // 競合関係の検出とリンク
    const resolvedList = detectAndLinkConflicts(deduplicated);
    storageService.setMemories(resolvedList);

    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(resolvedList);
    }
    setExportedStatus(`🧹 記憶の自動整理完了: ${mergedCount} 件の重複を統合し、競合関係を再計算しました！`);
    setTimeout(() => setExportedStatus(null), 4000);
  };

  const handleExportBackupJSON = () => {
    const backupData = {
      version: 1,
      timestamp: Date.now(),
      persona,
      memories,
      stats: {
        totalMemories: memories.length,
        intimacyLevel: persona.intimacyLevel,
      },
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `miki_memories_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportedStatus('✅ 記憶・設定の完全バックアップ (JSON) を保存しました！');
    setTimeout(() => setExportedStatus(null), 4000);
  };

  const handleImportBackupJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.persona && typeof onUpdatePersona === 'function') {
          onUpdatePersona(data.persona);
        }
        if (Array.isArray(data.memories) && typeof onUpdateMemories === 'function') {
          onUpdateMemories(data.memories);
        }
        setExportedStatus('✅ バックアップから記憶と設定を正常に復元しました！');
        setTimeout(() => setExportedStatus(null), 4000);
      } catch (err) {
        setExportedStatus('❌ バックアップファイルの読み込みに失敗しました');
        setTimeout(() => setExportedStatus(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportTrainingData = () => {
    const dataset = memories.map((m, idx) => ({
      id: idx + 1,
      conversations: [
        { from: 'system', value: `あなたは${persona.name}です。${persona.userNickname}の専属AIパートナーとして、${persona.speakingStyle}口調で自然に応答してください。` },
        { from: 'human', value: `${persona.name}、${m.category}について覚えてる？` },
        { from: 'gpt', value: `もちろん！${m.content}だよね😊✨` },
      ],
    }));

    const jsonlContent = dataset.map((d) => JSON.stringify(d)).join('\n');
    const blob = new Blob([jsonlContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `miki_evolution_dataset_${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
    setExportedStatus('✅ LoRA学習用データセット(JSONL)をダウンロードしました！');
    setTimeout(() => setExportedStatus(null), 4000);
  };

  const handleSyncAllMasterKnowledge = () => {
    const currentList = storageService.getMemories();
    const existingIds = new Set(currentList.map((m) => m.id));
    const allMaster = [...INITIAL_JAPANESE_MEMORIES, ...MASTER_EDUCATION_MEMORIES];
    const toAdd = allMaster.filter((m) => !existingIds.has(m.id));
    if (toAdd.length === 0) {
      setExportedStatus('✨ 全マスター教育データは既に記憶に完全同期されています！');
      setTimeout(() => setExportedStatus(null), 4000);
      return;
    }
    const updated = [...toAdd, ...currentList];
    storageService.setMemories(updated);
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setExportedStatus(`✅ ${toAdd.length} 件のマスター教育ナレッジを記憶に同期・適用しました！`);
    setTimeout(() => setExportedStatus(null), 4000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 text-lg">
              {persona.avatar}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>{persona.name} の教育・記憶 ＆ 自己進化エンジン</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-semibold border border-pink-500/30">
                  親愛度 Lv.{persona.intimacyLevel}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                カテゴリ選択不要で教えたいことを入力するだけで、全推論モデルに即座に教育・反映されます
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

        {/* SubTab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('teach')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all shrink-0 ${
              activeSubTab === 'teach'
                ? 'border-amber-500 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-amber-400" />
            <span className="flex items-center gap-1.5">
              ⚡ かんたんAI教育（自動反映） <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('memory')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all shrink-0 ${
              activeSubTab === 'memory'
                ? 'border-sky-500 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="w-4 h-4" />
            <span>記憶・ナレッジ一覧 ({memories.length}件)</span>
            {storageService.getConflictedMemories().length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[9px] font-mono flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" />
                {storageService.getConflictedMemories().length}件競合
              </span>
            )}
            {storageService.getUnapprovedMemories().length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-mono">
                {storageService.getUnapprovedMemories().length}件未承認
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('persona')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all shrink-0 ${
              activeSubTab === 'persona'
                ? 'border-pink-500 text-pink-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smile className="w-4 h-4" />
            <span>性格・口調</span>
          </button>

          <button
            onClick={() => setActiveSubTab('corpus')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all shrink-0 ${
              activeSubTab === 'corpus'
                ? 'border-rose-500 text-rose-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>日本語自然化コーパス</span>
          </button>

          <button
            onClick={() => setActiveSubTab('graph')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all shrink-0 ${
              activeSubTab === 'graph'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-4 h-4 text-indigo-400" />
            <span>🕸️ 知識グラフ & 多層RAG</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: Quick Auto Education (Category-Free) */}
          {activeSubTab === 'teach' && (
            <div className="space-y-4 text-xs">
              {/* Feature Intro Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/40 via-purple-950/30 to-slate-900 border border-amber-500/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>カテゴリ不要！入力するだけで全エンジンへ即時自動教育</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Auto-Reflection Active
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  基礎的な日本語やゲーム開発知識は<strong>最初からファイル内に合成済み</strong>です！
                  さらに「好みの配色」「作りたいゲームの仕様」「二人の約束」「口調の好み」などを自由に入力するだけで、
                  <strong>AIが自動で分類して長期記憶とプロンプトへ即時反映</strong>します。
                </p>
              </div>

              {/* Instant Input Box */}
              <form onSubmit={handleQuickTeach} className="bg-slate-950/90 border border-amber-500/30 rounded-xl p-3.5 space-y-3 shadow-lg shadow-amber-950/20">
                <label className="block font-bold text-amber-200 text-xs flex items-center gap-1.5">
                  <Wand2 className="w-4 h-4 text-amber-400" />
                  <span>みきに教えたいこと・覚えてほしいこと（何でも自由に入力）</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={teachInput}
                    onChange={(e) => setTeachInput(e.target.value)}
                    placeholder="例: 配色はダークネオン調が好き / ボタンは角丸16pxにして / 好きなゲームはRPG"
                    className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={!teachInput.trim()}
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-400 hover:to-pink-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all shrink-0 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>教育・即時反映</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400">ワンクリック例:</span>
                  {[
                    'HTML/Canvasゲームの操作説明は常に画面上に大きく出す',
                    'サイバーパンク風のネオンカラーが好き',
                    'タメ口で友達みたいに明るく励ましてほしい',
                    'JavaScriptはES6+で綺麗にモジュール分割して',
                  ].map((exampleText, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setTeachInput(exampleText)}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] border border-slate-800 transition-colors"
                    >
                      + {exampleText}
                    </button>
                  ))}
                </div>
              </form>

              {exportedStatus && (
                <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{exportedStatus}</span>
                </div>
              )}

              {/* Quick Status Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <div className="font-bold text-sky-300 flex items-center gap-1 text-[11px]">
                    <span>1. ファイル初期合成済み</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    自然な日本語＆ゲーム制作マスターデータはビルド内に全合成済み。
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <div className="font-bold text-amber-300 flex items-center gap-1 text-[11px]">
                    <span>2. オンデバイス自動同期</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    入力された教育データは端末ストレージに保存され、全推論で参照。
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <div className="font-bold text-emerald-300 flex items-center gap-1 text-[11px]">
                    <span>3. 自己進化エクスポート</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    蓄積された知識はLoRA学習データ(JSONL)やバックアップとしていつでも保存可能。
                  </p>
                </div>
              </div>

              {/* Data Export & Sync Actions */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-slate-300 font-medium">
                  現在 <span className="text-amber-400 font-bold">{memories.length}</span> 件の教育・知識ナレッジを保持中
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSyncAllMasterKnowledge}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>マスター知識の再同期</span>
                  </button>
                  <button
                    onClick={handleExportTrainingData}
                    className="px-2.5 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>LoRAデータ(JSONL)</span>
                  </button>
                  <button
                    onClick={handleExportBackupJSON}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSON保存</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Long-Term Memory & Knowledge List */}
          {activeSubTab === 'memory' && (() => {
            const conflictedList = storageService.getConflictedMemories();
            const unapprovedList = storageService.getUnapprovedMemories();
            const approvedList = storageService.getApprovedMemories();

            // storageService の各種クエリメソッドを活用した表示リストの決定
            const displayMemories = (() => {
              if (memoryFilter === 'approved') return approvedList;
              if (memoryFilter === 'unapproved') return unapprovedList;
              if (memoryFilter === 'conflicted') return conflictedList;
              if (memoryFilter !== 'all') return storageService.getMemoriesByType(memoryFilter as MemoryType);
              return memories;
            })();

            return (
              <div className="space-y-4">
                {/* 競合発生時の警告＆解決誘導バナー (設計思想 12 & 25) */}
                {conflictedList.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-amber-300">
                          矛盾・競合する記憶が {conflictedList.length} 件検出されました
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                          設定やユーザープロフィールの不整合を防ぐため、優先する記憶を選択して解決してください。
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setMemoryFilter('conflicted')}
                      className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/50 rounded-lg font-bold text-[11px] shrink-0 self-start sm:self-auto transition-all"
                    >
                      競合記憶のみ表示
                    </button>
                  </div>
                )}

                {/* Header & Filter Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setMemoryFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        memoryFilter === 'all'
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      すべて ({memories.length})
                    </button>
                    <button
                      onClick={() => setMemoryFilter('approved')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        memoryFilter === 'approved'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      承認済 ({approvedList.length})
                    </button>
                    <button
                      onClick={() => setMemoryFilter('unapproved')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        memoryFilter === 'unapproved'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      未検証 ({unapprovedList.length})
                    </button>
                    {conflictedList.length > 0 && (
                      <button
                        onClick={() => setMemoryFilter('conflicted')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                          memoryFilter === 'conflicted'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-rose-950/50 text-rose-300 hover:bg-rose-950 border border-rose-800/60'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>競合中 ({conflictedList.length})</span>
                      </button>
                    )}

                    {/* 7-Tier MemoryType Filter */}
                    <select
                      value={['all', 'approved', 'unapproved', 'conflicted'].includes(memoryFilter) ? '' : memoryFilter}
                      onChange={(e) => setMemoryFilter((e.target.value as MemoryType) || 'all')}
                      className="bg-slate-900 border border-slate-800 text-slate-300 text-[11px] rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">階層別絞り込み...</option>
                      <option value="semantic">意味記憶 (semantic)</option>
                      <option value="episodic">エピソード記憶 (episodic)</option>
                      <option value="procedural">手続き記憶 (procedural)</option>
                      <option value="structural">構造記憶 (structural)</option>
                      <option value="associative">連想記憶 (associative)</option>
                      <option value="core">コア記憶 (core)</option>
                      <option value="emotional">感情記憶 (emotional)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleConsolidateMemories}
                      className="px-2.5 py-1 bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-500/40 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all"
                      title="重複の統合と競合の再検出を実行"
                    >
                      <RefreshCw className="w-3 h-3 text-purple-400" />
                      <span>重複統合・競合再計算</span>
                    </button>
                  </div>
                </div>

                {/* Memory List */}
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {displayMemories.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800">
                      条件に一致する記憶はありません。
                    </div>
                  ) : (
                    displayMemories.map((mem) => {
                      const good = mem.goodCount ?? 0;
                      const bad = mem.badCount ?? 0;
                      const hasConflict = Boolean(mem.active !== false && mem.conflictWith && mem.conflictWith.length > 0);
                      const isExpanded = expandedConflictId === mem.id;

                      // 競合相手の記憶オブジェクト群
                      const conflictingOpponents = hasConflict
                        ? (mem.conflictWith || []).map((cid) => memories.find((m) => m.id === cid)).filter(Boolean) as MemoryItem[]
                        : [];

                      return (
                        <div
                          key={mem.id}
                          className={`flex flex-col p-3 rounded-xl transition-colors gap-2.5 border ${
                            hasConflict
                              ? 'bg-amber-950/20 border-amber-500/50 hover:border-amber-500'
                              : mem.approved === false
                              ? 'bg-slate-950/70 border-slate-800 hover:border-amber-500/30'
                              : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700'
                          } text-xs`}
                        >
                          {/* Row 1: Badges, Content & Action Buttons */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-[9.5px] font-mono shrink-0 ${
                                mem.category === 'gamedev'
                                  ? 'bg-sky-950 text-sky-300 border border-sky-800'
                                  : mem.category === 'preference'
                                  ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                  : mem.category === 'profile'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}>
                                {mem.category}
                              </span>

                              {mem.memoryType && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-900 text-slate-400 border border-slate-700 shrink-0">
                                  {mem.memoryType}
                                </span>
                              )}

                              {mem.source && (
                                <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-mono shrink-0 ${
                                  mem.source === 'manual'
                                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                                }`}>
                                  {mem.source === 'manual' ? '手動' : '自動抽出'}
                                </span>
                              )}

                              {hasConflict && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0 flex items-center gap-1 animate-pulse">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  競合あり ({mem.conflictWith?.length}件)
                                </span>
                              )}

                              <span className="text-slate-200 truncate flex-1 font-medium">{mem.content}</span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                              {/* 競合解決アコーディオン展開ボタン */}
                              {hasConflict && (
                                <button
                                  onClick={() => setExpandedConflictId(isExpanded ? null : mem.id)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border transition-all ${
                                    isExpanded
                                      ? 'bg-amber-600 text-white border-amber-500'
                                      : 'bg-amber-950/80 text-amber-300 border-amber-500/50 hover:bg-amber-900'
                                  }`}
                                  title="競合相手の確認と解決フロー"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>{isExpanded ? '解決を閉じる' : '競合を解決'}</span>
                                </button>
                              )}

                              {/* 未検証時のクイック承認ボタン */}
                              {mem.approved === false ? (
                                <button
                                  onClick={() => handleApproveMemory(mem.id)}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 flex items-center gap-1 transition-all"
                                  title="この記憶を承認し、推論の確定事実として利用可能にします"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>承認する</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleApproved(mem.id)}
                                  className="px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border bg-emerald-950/80 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60 transition-all"
                                  title="クリックで未承認に切り替え"
                                >
                                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                  <span>承認済</span>
                                </button>
                              )}

                              {/* 👍 / 👎 Feedback Controls */}
                              <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                                <button
                                  onClick={() => handleAdjustFeedback(mem.id, 1)}
                                  className="text-slate-400 hover:text-emerald-400 p-0.5"
                                  title="高評価を追加"
                                >
                                  <ThumbsUp className="w-2.5 h-2.5" />
                                </button>
                                <span className={good > bad ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                                  {good - bad}
                                </span>
                                <button
                                  onClick={() => handleAdjustFeedback(mem.id, -1)}
                                  className="text-slate-400 hover:text-rose-400 p-0.5"
                                  title="低評価を追加"
                                >
                                  <ThumbsDown className="w-2.5 h-2.5" />
                                </button>
                              </div>

                              <button
                                onClick={() => handleDelete(mem.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors shrink-0"
                                title="記憶を削除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Row 2: 競合解決フロー・インラインパネル (アコーディオン) */}
                          {hasConflict && isExpanded && (
                            <div className="p-3 mt-1 rounded-lg bg-slate-900/90 border border-amber-500/40 space-y-2.5 animate-in fade-in">
                              <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                <span>競合解決フロー: 矛盾する記憶のどちらを正としますか？</span>
                              </div>

                              <div className="space-y-2">
                                {conflictingOpponents.map((opponent) => (
                                  <div
                                    key={opponent.id}
                                    className="p-2.5 rounded-md bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                  >
                                    <div className="space-y-1 min-w-0 flex-1">
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        相手の記憶 [{opponent.category}]:
                                      </div>
                                      <div className="text-slate-200 text-xs font-medium">
                                        {opponent.content}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        onClick={() => handleResolveConflict(mem.id, opponent.id)}
                                        className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 rounded-lg font-bold text-[10.5px] flex items-center gap-1 transition-all"
                                        title="この記憶を採用し、相手の記憶を無効化（アーカイブ）します"
                                      >
                                        <Check className="w-3 h-3 text-emerald-300" />
                                        <span>この記憶を採用（相手を無効化）</span>
                                      </button>
                                      <button
                                        onClick={() => handleDismissConflict(mem.id, opponent.id)}
                                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[10.5px] transition-all"
                                        title="両方の記憶を保持し、競合フラグを解除します"
                                      >
                                        両方保持
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}

          {/* TAB 3: Persona Configuration */}
          {activeSubTab === 'persona' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">AIパートナーのお名前</label>
                  <input
                    type="text"
                    value={persona.name}
                    onChange={(e) => {
                      if (typeof onUpdatePersona === 'function') {
                        (onUpdatePersona as any)((prev: any) => ({ ...prev, name: e.target.value }));
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">あなたの呼び名</label>
                  <input
                    type="text"
                    value={persona.userNickname}
                    onChange={(e) => {
                      if (typeof onUpdatePersona === 'function') {
                        (onUpdatePersona as any)((prev: any) => ({ ...prev, userNickname: e.target.value }));
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">アバター絵文字</label>
                  <input
                    type="text"
                    value={persona.avatar}
                    onChange={(e) => {
                      if (typeof onUpdatePersona === 'function') {
                        (onUpdatePersona as any)((prev: any) => ({ ...prev, avatar: e.target.value }));
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 text-center text-lg focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">口調スタイル</label>
                  <select
                    value={persona.speakingStyle}
                    onChange={(e: any) => {
                      if (typeof onUpdatePersona === 'function') {
                        (onUpdatePersona as any)((prev: any) => ({ ...prev, speakingStyle: e.target.value }));
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-pink-500"
                  >
                    <option value="friendly">明るく親しみやすい (フレンドリー)</option>
                    <option value="polite">丁寧・敬語 (プロフェッショナル)</option>
                    <option value="tsundere">ツンデレ (ちょっぴり強がり)</option>
                    <option value="mentor">頼れるメンター・先輩エンジニア</option>
                  </select>
                </div>
              </div>

              <div className="text-xs">
                <label className="block text-slate-400 font-medium mb-1">基本性格・タグライン</label>
                <textarea
                  value={persona.basePersonality}
                  onChange={(e) => {
                    if (typeof onUpdatePersona === 'function') {
                      (onUpdatePersona as any)((prev: any) => ({ ...prev, basePersonality: e.target.value }));
                    }
                  }}
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-pink-500 leading-relaxed font-mono"
                  placeholder="例: あなた専属の親身なAIパートナー。一緒にアプリ開発やゲーム制作を楽しみながら成長する。"
                />
              </div>
            </div>
          )}

          {/* TAB 4: Japanese Natural Dialogue Knowledge Corpus */}
          {activeSubTab === 'corpus' && (
            <div className="space-y-4 text-xs">
              {/* Header Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-rose-950/40 via-pink-950/30 to-slate-900 border border-rose-500/30 space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                  <BookOpen className="w-4 h-4 text-rose-400" />
                  <span>日本語自然化コーパス ＆ 脱ロボット辞書</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  機械翻訳調や堅苦しい敬語オウム返しを防ぎ、
                  <strong>「自然な相槌・温かいタメ口・親友同士のテンポ」</strong>で会話できるように設計された統合知識データです。
                </p>
              </div>

              {/* Anti-Robotic Rules */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>機械翻訳調 ➔ 自然な日本語 変換辞書</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ANTI_ROBOTIC_JAPANESE_RULES.map((rule, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between text-[11px] gap-2"
                    >
                      <span className="text-rose-400 line-through shrink-0 font-mono">{rule.avoid}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="text-emerald-300 font-semibold truncate">{rule.prefer}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Natural Dialogue Examples */}
              <div className="space-y-2.5">
                <div className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>対話シチュエーション別・自然な応答パターン</span>
                </div>
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {JAPANESE_NATURAL_DIALOGUE_CORPUS.map((cat, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-2">
                      <div className="font-bold text-slate-200 text-[11px] flex items-center justify-between">
                        <span>{cat.category}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{cat.description}</span>
                      </div>
                      <div className="space-y-1.5">
                        {cat.examples.map((ex, eIdx) => (
                          <div key={eIdx} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 text-[11px] space-y-1">
                            <div className="text-[10px] text-slate-400 font-mono">情景: {ex.scenario}</div>
                            <div className="text-emerald-300 font-medium flex items-start gap-1">
                              <span className="text-emerald-400 shrink-0">⭕</span>
                              <span>{ex.natural}</span>
                            </div>
                            <div className="text-rose-400/80 line-through text-[10px] flex items-start gap-1">
                              <span className="shrink-0">❌</span>
                              <span>{ex.unnaturalAvoid}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: 知識グラフ & 多層ベクトル検索 (設計思想 4 & 12) */}
          {activeSubTab === 'graph' && (
            <div className="space-y-4 text-xs">
              {/* Feature Header Banner */}
              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-indigo-300 text-sm">
                    <Network className="w-4 h-4 text-indigo-400" />
                    <span>多層ベクトル検索 ＆ 知識グラフ依存関係エンジン</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 font-mono text-[10px] border border-indigo-700/50">
                    設計思想 4 & 12 準拠
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  単純なキーワード一致だけでなく、<strong>「8次元ドメイン意味ベクトル類似度」</strong>と、記憶同士の<strong>「前提条件・親子・関連リンク」</strong>をグラフ探索して、必要な文脈を漏れなくプロンプトへ適応注入します。
                </p>
              </div>

              {/* RAG Simulator Controls */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-indigo-400" />
                    <span>多層RAG 検索シミュレーター (リアルタイム検証)</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={graphTraverseEnabled}
                      onChange={(e) => setGraphTraverseEnabled(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>知識グラフ依存関係トラバーサルを適用</span>
                  </label>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={graphSearchQuery}
                    onChange={(e) => setGraphSearchQuery(e.target.value)}
                    placeholder="テスト検索クエリ (例: ゲームのバグ修正ルール、脱ロボットタメ口)"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const queryVec = calculateDomainVector(graphSearchQuery);
                      setExportedStatus(`📊 クエリ「${graphSearchQuery}」の意味ベクトル: [${queryVec.map((v) => v.toFixed(1)).join(', ')}]`);
                      setTimeout(() => setExportedStatus(null), 3000);
                    }}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs"
                  >
                    検索
                  </button>
                </div>

                {/* Scored Results Display */}
                {(() => {
                  const scoredResults = retrieveScoredMemories(graphSearchQuery, memories, {
                    limit: 5,
                    traverseGraph: graphTraverseEnabled,
                  });

                  return (
                    <div className="space-y-2 pt-1">
                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>プロンプト注入候補記憶 (上位 {scoredResults.length} 件):</span>
                        <span className="font-mono text-[10px] text-indigo-400">
                          {graphTraverseEnabled ? '多層類似度 + グラフ連鎖' : '多層類似度のみ'}
                        </span>
                      </div>

                      {scoredResults.length === 0 ? (
                        <div className="p-4 rounded-lg bg-slate-900 text-slate-500 text-center text-xs">
                          一致する記憶がありません
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {scoredResults.map((s, idx) => {
                            const isPrereq = s.retrievalSource === 'prerequisite_dependency';
                            const isParent = s.retrievalSource === 'parent_context';
                            const isRel = s.retrievalSource === 'graph_relation';

                            return (
                              <div
                                key={s.memory.id || idx}
                                className={`p-2.5 rounded-lg border space-y-1.5 transition-colors ${
                                  isPrereq
                                    ? 'bg-amber-950/20 border-amber-800/60'
                                    : isParent
                                    ? 'bg-purple-950/20 border-purple-800/60'
                                    : isRel
                                    ? 'bg-sky-950/20 border-sky-800/60'
                                    : 'bg-slate-900/90 border-slate-800'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-[10px] text-indigo-300">
                                      #{idx + 1}
                                    </span>
                                    <span className="font-bold text-slate-200 text-[11px] truncate max-w-[200px] sm:max-w-xs">
                                      {s.memory.content}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                                        isPrereq
                                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                                          : isParent
                                          ? 'bg-purple-950 text-purple-300 border border-purple-700'
                                          : isRel
                                          ? 'bg-sky-950 text-sky-300 border border-sky-700'
                                          : 'bg-slate-800 text-slate-300'
                                      }`}
                                    >
                                      {isPrereq
                                        ? '⚡ 前提依存'
                                        : isParent
                                        ? '👑 上位親'
                                        : isRel
                                        ? '🔗 関連リンク'
                                        : '🎯 直接一致'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 font-mono text-[10px]">
                                      スコア: {s.score}点
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                                  {s.matchReasons.map((r, rIdx) => (
                                    <span key={rIdx} className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                                      {r}
                                    </span>
                                  ))}
                                  {s.semanticSimilarity > 0 && (
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-900">
                                      意味類似度: {(s.semanticSimilarity * 100).toFixed(0)}%
                                    </span>
                                  )}
                                  {s.memory.approved && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-900">
                                      ✓ 確定承認
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Knowledge Graph Dependencies & Linking Editor */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="font-bold text-slate-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                    <span>知識グラフ・依存関係ネットワーク設定</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    全 {memories.length} ノード
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Node Selector List */}
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    <div className="text-[10px] text-slate-400 font-bold">対象ノードを選択:</div>
                    {memories.map((m) => {
                      const isSelected = selectedGraphNodeId === m.id;
                      const hasPrereq = m.prerequisiteMemoryIds && m.prerequisiteMemoryIds.length > 0;
                      const hasParent = Boolean(m.parentMemoryId);

                      return (
                        <div
                          key={m.id}
                          onClick={() => setSelectedGraphNodeId(m.id)}
                          className={`p-2 rounded-lg border text-[11px] cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-indigo-950/60 border-indigo-500 text-white font-semibold'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900'
                          }`}
                        >
                          <span className="truncate max-w-[180px]">{m.content}</span>
                          <div className="flex items-center gap-1 text-[9px] shrink-0">
                            {hasPrereq && (
                              <span className="px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                                前提有
                              </span>
                            )}
                            {hasParent && (
                              <span className="px-1 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                                親有
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected Node Inspector & Prerequisite Linker */}
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2.5">
                    {selectedGraphNodeId ? (() => {
                      const currentMem = memories.find((m) => m.id === selectedGraphNodeId);
                      if (!currentMem) return <div className="text-slate-400 text-xs">ノードが見つかりません</div>;

                      return (
                        <div className="space-y-2 text-[11px]">
                          <div className="font-bold text-indigo-300 flex items-center gap-1">
                            <Link className="w-3 h-3" />
                            <span>ノード詳細 & 依存関係</span>
                          </div>
                          <p className="text-slate-200 bg-slate-950 p-2 rounded border border-slate-800">
                            {currentMem.content}
                          </p>

                          {/* Quick Set Parent Node */}
                          <div className="space-y-1">
                            <label className="block text-slate-400 text-[10px]">👑 上位親ノード (Parent Concept):</label>
                            <select
                              value={currentMem.parentMemoryId || ''}
                              onChange={(e) => {
                                const newParentId = e.target.value || undefined;
                                if (typeof onUpdateMemories === 'function') {
                                  (onUpdateMemories as any)((prev: MemoryItem[]) => {
                                    const list = Array.isArray(prev) ? prev : memories;
                                    return list.map((m) => (m.id === currentMem.id ? { ...m, parentMemoryId: newParentId } : m));
                                  });
                                }
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                            >
                              <option value="">なし (独立ノード)</option>
                              {memories
                                .filter((m) => m.id !== currentMem.id)
                                .map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.content.substring(0, 30)}...
                                  </option>
                                ))}
                            </select>
                          </div>

                          {/* Quick Add Prerequisite Node */}
                          <div className="space-y-1">
                            <label className="block text-slate-400 text-[10px]">⚡ 前提条件ノード (Prerequisite):</label>
                            <select
                              value=""
                              onChange={(e) => {
                                const prereqId = e.target.value;
                                if (!prereqId) return;
                                const currentPrereqs = currentMem.prerequisiteMemoryIds || [];
                                if (currentPrereqs.includes(prereqId)) return;

                                if (typeof onUpdateMemories === 'function') {
                                  (onUpdateMemories as any)((prev: MemoryItem[]) => {
                                    const list = Array.isArray(prev) ? prev : memories;
                                    return list.map((m) =>
                                      m.id === currentMem.id
                                        ? { ...m, prerequisiteMemoryIds: [...currentPrereqs, prereqId] }
                                        : m
                                    );
                                  });
                                }
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                            >
                              <option value="">+ 前提ノードを追加選択...</option>
                              {memories
                                .filter((m) => m.id !== currentMem.id && !(currentMem.prerequisiteMemoryIds || []).includes(m.id))
                                .map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.content.substring(0, 30)}...
                                  </option>
                                ))}
                            </select>

                            {/* Prereq Chips */}
                            {currentMem.prerequisiteMemoryIds && currentMem.prerequisiteMemoryIds.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {currentMem.prerequisiteMemoryIds.map((pid) => {
                                  const pMem = memories.find((m) => m.id === pid);
                                  return (
                                    <span
                                      key={pid}
                                      className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] flex items-center gap-1"
                                    >
                                      <span>⚡ {pMem ? pMem.content.substring(0, 15) + '...' : pid}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (typeof onUpdateMemories === 'function') {
                                            (onUpdateMemories as any)((prev: MemoryItem[]) => {
                                              const list = Array.isArray(prev) ? prev : memories;
                                              return list.map((m) =>
                                                m.id === currentMem.id
                                                  ? {
                                                      ...m,
                                                      prerequisiteMemoryIds: (m.prerequisiteMemoryIds || []).filter((id) => id !== pid),
                                                    }
                                                  : m
                                              );
                                            });
                                          }
                                        }}
                                        className="text-amber-400 hover:text-rose-400 ml-1 font-bold"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="p-6 text-center text-slate-500 text-xs">
                        左側のリストから記憶ノードを選択すると、親ノードや前提条件のグラフ依存関係を設定できます
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md shadow-pink-600/20 transition-colors cursor-pointer"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
};

