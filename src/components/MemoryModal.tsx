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
} from 'lucide-react';
import { MemoryItem, PersonaConfig } from '../types';
import {
  JAPANESE_NATURAL_DIALOGUE_CORPUS,
  ANTI_ROBOTIC_JAPANESE_RULES,
  INITIAL_JAPANESE_MEMORIES,
} from '../data/japaneseKnowledgeData';
import { MASTER_EDUCATION_MEMORIES } from '../data/masterEducationKnowledge';

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
  const [activeSubTab, setActiveSubTab] = useState<'persona' | 'teach' | 'memory' | 'corpus'>('teach');
  const [exportedStatus, setExportedStatus] = useState<string | null>(null);

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
    const newItem: MemoryItem = {
      id: 'mem_teach_' + Date.now(),
      category,
      content: trimmed,
      importance: 5,
      pinned: true,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'manual',
      tags: ['ユーザー直接教育', category],
    };

    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)((prev: MemoryItem[]) => {
        const list = Array.isArray(prev) ? prev : memories;
        return [newItem, ...list];
      });
    }

    setTeachInput('');
    setExportedStatus(`✨ 「${trimmed.slice(0, 24)}${trimmed.length > 24 ? '...' : ''}」を教育完了！全LLMに即時自動反映されました！🌸`);
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
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)((prev: MemoryItem[]) => {
        const currentList = Array.isArray(prev) ? prev : memories;
        const existingIds = new Set(currentList.map((m) => m.id));
        const allMaster = [...INITIAL_JAPANESE_MEMORIES, ...MASTER_EDUCATION_MEMORIES];
        const toAdd = allMaster.filter((m) => !existingIds.has(m.id));
        if (toAdd.length === 0) {
          setExportedStatus('✨ 全マスター教育データは既に記憶に完全同期されています！');
          setTimeout(() => setExportedStatus(null), 4000);
          return currentList;
        }
        setExportedStatus(`✅ ${toAdd.length} 件のマスター教育ナレッジを記憶に同期・適用しました！`);
        setTimeout(() => setExportedStatus(null), 4000);
        return [...toAdd, ...currentList];
      });
    }
  };

  const handleDelete = (id: string) => {
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)((prev: MemoryItem[]) => {
        if (Array.isArray(prev)) return prev.filter((m) => m.id !== id);
        return memories.filter((m) => m.id !== id);
      });
    }
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
          {activeSubTab === 'memory' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">保持している知識・記憶一覧 ({memories.length}件)</span>
                <span className="text-slate-400 text-[11px]">端末内ストレージ永続保存中</span>
              </div>

              {/* Memory List */}
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {memories.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800">
                    保存された記憶はありません。「かんたんAI教育」タブから追加できます。
                  </div>
                ) : (
                  memories.map((mem) => (
                    <div
                      key={mem.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 ${
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
                        <span className="text-slate-200 truncate">{mem.content}</span>
                      </div>

                      <button
                        onClick={() => handleDelete(mem.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors shrink-0 ml-2"
                        title="記憶を削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

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

