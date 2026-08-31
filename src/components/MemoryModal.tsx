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
} from 'lucide-react';
import { MemoryItem, PersonaConfig } from '../types';

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
  const [activeSubTab, setActiveSubTab] = useState<'persona' | 'memory'>('persona');

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
                <span>{persona.name} の性格設定 ＆ 記憶カンペ</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-semibold border border-pink-500/30">
                  親愛度 Lv.{persona.intimacyLevel}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                あなたとの会話・開発の好みを永続記憶として保存し、推論時に自動適用します
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
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 gap-2 shrink-0">
          <button
            onClick={() => setActiveSubTab('persona')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeSubTab === 'persona'
                ? 'border-pink-500 text-pink-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smile className="w-4 h-4" />
            <span>キャラクター・口調設定</span>
          </button>

          <button
            onClick={() => setActiveSubTab('memory')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeSubTab === 'memory'
                ? 'border-sky-500 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="w-4 h-4" />
            <span>長期記憶・カンペ ({memories.length}件)</span>
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
