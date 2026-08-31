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
} from 'lucide-react';
import { MemoryItem, PersonaConfig } from '../types';
import {
  JAPANESE_NATURAL_DIALOGUE_CORPUS,
  ANTI_ROBOTIC_JAPANESE_RULES,
  INITIAL_JAPANESE_MEMORIES,
} from '../data/japaneseKnowledgeData';

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
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryItem['category']>('preference');
  const [activeSubTab, setActiveSubTab] = useState<'persona' | 'memory' | 'japanese' | 'evolution'>('persona');
  const [exportedStatus, setExportedStatus] = useState<string | null>(null);

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

  const handleSyncJapaneseMemories = () => {
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)((prev: MemoryItem[]) => {
        const currentList = Array.isArray(prev) ? prev : memories;
        const existingIds = new Set(currentList.map((m) => m.id));
        const toAdd = INITIAL_JAPANESE_MEMORIES.filter((m) => !existingIds.has(m.id));
        if (toAdd.length === 0) {
          setExportedStatus('✨ 日本語自然化データは既にすべて記憶に同期されています！');
          setTimeout(() => setExportedStatus(null), 4000);
          return currentList;
        }
        setExportedStatus(`✅ ${toAdd.length} 件の日本語自然化データを記憶に追加・同期しました！`);
        setTimeout(() => setExportedStatus(null), 4000);
        return [...toAdd, ...currentList];
      });
    }
  };

  const handleExportJapaneseCorpusJSON = () => {
    const data = {
      title: 'Miki Japanese Natural Dialogue & Anti-Robot Corpus',
      version: '1.0.0',
      timestamp: Date.now(),
      corpus: JAPANESE_NATURAL_DIALOGUE_CORPUS,
      antiRoboticRules: ANTI_ROBOTIC_JAPANESE_RULES,
      starterMemories: INITIAL_JAPANESE_MEMORIES,
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `miki_japanese_natural_corpus_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportedStatus('✅ 日本語自然化コーパス(JSON)をダウンロードしました！');
    setTimeout(() => setExportedStatus(null), 4000);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    const newItem: MemoryItem = {
      id: 'mem_' + Date.now(),
      category: newCategory,
      content: newContent.trim(),
      importance: 5,
      createdAt: Date.now(),
      source: 'manual',
    };

    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)((prev: MemoryItem[]) => {
        if (Array.isArray(prev)) return [newItem, ...prev];
        return [newItem, ...memories];
      });
    }
    setNewContent('');
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
                <span>{persona.name} の設定 ＆ 自己進化エンジン</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-semibold border border-pink-500/30">
                  親愛度 Lv.{persona.intimacyLevel}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                あなたとの対話・記憶・クラウドLLMの知見を蓄積し、端末内ローカルAIを進化させます
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
            onClick={() => setActiveSubTab('persona')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all shrink-0 ${
              activeSubTab === 'persona'
                ? 'border-pink-500 text-pink-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smile className="w-4 h-4" />
            <span>キャラクター・口調</span>
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
            <span>長期記憶 ({memories.length}件)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('japanese')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all shrink-0 ${
              activeSubTab === 'japanese'
                ? 'border-rose-500 text-rose-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="flex items-center gap-1">
              🌸 日本語自然化コーパス
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('evolution')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all shrink-0 ${
              activeSubTab === 'evolution'
                ? 'border-amber-500 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span className="flex items-center gap-1">
              自己進化・蒸留学習 <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            </span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: Persona Configuration */}
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

          {/* TAB 2: Long-Term Memory Cheat-sheet */}
          {activeSubTab === 'memory' && (
            <div className="space-y-4">
              {/* Add Memory Form */}
              <form onSubmit={handleAdd} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-sky-400" />
                  <span>新しい記憶・ルールを手動追加</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                  <select
                    value={newCategory}
                    onChange={(e: any) => setNewCategory(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="preference">開発の好み (UI/言語など)</option>
                    <option value="gamedev">ゲーム開発・コーディング規則</option>
                    <option value="profile">ユーザーの個人情報・趣味</option>
                    <option value="relationship">関係性・思い出</option>
                    <option value="chat">日常会話メモ</option>
                  </select>

                  <input
                    type="text"
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="例: 配色はネオンサイバーパンク調が好き、Tailwindを最優先"
                    className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />

                  <button
                    type="submit"
                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg px-3 py-1.5 text-xs transition-colors"
                  >
                    記憶を保存
                  </button>
                </div>
              </form>

              {/* Memory List */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400">現在保持している記憶 ({memories.length})</div>

                {memories.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800">
                    保存された記憶はありません。会話を重ねるか、上記から追加してください。
                  </div>
                ) : (
                  memories.map((mem) => (
                    <div
                      key={mem.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono shrink-0 bg-slate-800 text-slate-300 border border-slate-700">
                          {mem.category}
                        </span>
                        <span className="text-slate-200 truncate">{mem.content}</span>
                      </div>

                      <button
                        onClick={() => handleDelete(mem.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors shrink-0 ml-2"
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

          {/* TAB 3: Japanese Natural Dialogue Knowledge Corpus */}
          {activeSubTab === 'japanese' && (
            <div className="space-y-4 text-xs">
              {/* Header Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-rose-950/40 via-pink-950/30 to-slate-900 border border-rose-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                    <BookOpen className="w-4 h-4 text-rose-400" />
                    <span>日本語自然化コーパス ＆ 脱ロボット辞書</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSyncJapaneseMemories}
                      className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all shadow-md shadow-rose-900/30"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>記憶に即時同期</span>
                    </button>
                    <button
                      onClick={handleExportJapaneseCorpusJSON}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>JSON保存</span>
                    </button>
                  </div>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  小規模モデル（Qwen2.5等）やオンデバイスWebGPUで機械翻訳調・敬語オウム返しを防ぎ、
                  <strong>「自然な相槌・温かいタメ口・親友同士のテンポ」</strong>で会話できるように設計された統合日本語データです。
                </p>
                {exportedStatus && (
                  <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-[11px] font-bold">
                    {exportedStatus}
                  </div>
                )}
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
                <div className="space-y-2.5">
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

          {/* TAB 4: Self-Evolution & Distillation */}
          {activeSubTab === 'evolution' && (
            <div className="space-y-4 text-xs">
              {/* Overview Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/40 via-purple-950/30 to-slate-900 border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>自己成長・蒸留学習アーキテクチャ</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] border border-amber-500/30">
                    Growth Engine Active
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  <strong>「色んなLLMの知識を学んで自分自身で成長していく」</strong>
                  という最先端のAI蒸留（Knowledge Distillation）と継続学習（Continuous Fine-Tuning）の仕組みです。
                </p>
              </div>

              {/* 3-Step Growth Mechanism */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-sky-300 flex items-center gap-1 text-[11px]">
                    <span>1. 蒸留データ収集</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    ユーザーとの会話や、クラウドの強力なLLM（Gemini等）の高品質な回答を教師データとして端末内に自動蓄積。
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-purple-300 flex items-center gap-1 text-[11px]">
                    <span>2. オンデバイス記憶統合</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    好みのコーディングスタイルや口調・会話履歴をプロンプトキャッシュとWebGPU推論時メモリに直接反映。
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-emerald-300 flex items-center gap-1 text-[11px]">
                    <span>3. LoRA 微調整エクスポート</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    蓄積された会話・知識データを標準のJSONL形式で出力し、UnslothやHugging Faceでモデル自体の重み学習が可能。
                  </p>
                </div>
              </div>

              {/* Training Data Stats & Export */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-200 text-xs">蓄積された学習・記憶データセット</div>
                    <div className="text-[11px] text-slate-400">
                      現在 <span className="text-amber-300 font-bold">{memories.length}</span> 件の記憶 ＆ 対話履歴が端末内ストレージに完全永続保存されています
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleExportTrainingData}
                      className="px-3 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-900/30 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>LoRA学習用JSONL</span>
                    </button>
                    <button
                      onClick={handleExportBackupJSON}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>バックアップ(JSON)</span>
                    </button>
                  </div>
                </div>

                {/* Storage Info & Backup Restore */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      端末内ストレージ永続保存: 有効
                    </span>
                  </div>
                  <label className="cursor-pointer text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 underline underline-offset-2">
                    <span>バックアップJSONから復元</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackupJSON}
                      className="hidden"
                    />
                  </label>
                </div>

                {exportedStatus && (
                  <div className="p-2 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-[11px] text-center font-bold">
                    {exportedStatus}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md shadow-pink-600/20 transition-colors"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
};
