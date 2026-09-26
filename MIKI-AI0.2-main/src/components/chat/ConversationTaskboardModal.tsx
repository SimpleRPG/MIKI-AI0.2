/**
 * 設計思想 第31章 31.10: 会話からタスクボード生成 (Conversation Taskboard Modal)
 * & 31.14 自発提案強度 & 31.15 個人向け説明レベル手動上書き
 */

import React, { useState } from 'react';
import {
  ConversationTaskCard,
  ConversationTaskCategory,
  ManualExplanationOverride,
  ProactiveSuggestionLevel,
} from '../../types';
import {
  CheckSquare,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
  Sliders,
  Settings2,
  X,
} from 'lucide-react';

interface ConversationTaskboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: ConversationTaskCard[];
  proactiveLevel: ProactiveSuggestionLevel;
  explanationOverride: ManualExplanationOverride;
  onUpdateStatus: (taskId: string, status: 'BACKLOG' | 'IN_PROGRESS' | 'COMPLETED') => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (task: {
    title: string;
    goal: string;
    category: ConversationTaskCategory;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    completionCriteria: string;
  }) => void;
  onSetProactiveLevel: (level: ProactiveSuggestionLevel) => void;
  onSetExplanationOverride: (override: ManualExplanationOverride) => void;
}

export const ConversationTaskboardModal: React.FC<ConversationTaskboardModalProps> = ({
  isOpen,
  onClose,
  tasks,
  proactiveLevel,
  explanationOverride,
  onUpdateStatus,
  onDeleteTask,
  onAddTask,
  onSetProactiveLevel,
  onSetExplanationOverride,
}) => {
  const [activeTab, setActiveTab] = useState<'board' | 'settings'>('board');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<ConversationTaskCategory>('INVESTIGATE_LATER');
  const [newPriority, setNewPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [newCriteria, setNewCriteria] = useState('');

  if (!isOpen) return null;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddTask({
      title: newTitle.trim(),
      goal: 'ユーザー手動登録タスク',
      category: newCategory,
      priority: newPriority,
      completionCriteria: newCriteria.trim() || '動作検証および確認完了',
    });
    setNewTitle('');
    setNewCriteria('');
    setIsAdding(false);
  };

  const filteredTasks = tasks.filter((t) => {
    if (selectedCategory === 'ALL') return true;
    return t.category === selectedCategory;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* ヘッダー */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                会話タスクボード ＆ 自律適応設定
                <span className="text-[10px] px-2 py-0.5 font-mono font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 rounded-full">
                  第31.10 / 31.14 / 31.15章
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                会話中の「後で調べる/保留」を自動カード化。勝手完了を防ぐ第48章完了判定器ゲート連携
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* タブ切り替えバー */}
        <div className="px-5 pt-3 pb-2 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('board')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'board'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              タスクカード一覧 ({tasks.length})
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'settings'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              自発提案 ＆ 説明レベル設定
            </button>
          </div>

          {activeTab === 'board' && (
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all border border-slate-700"
            >
              <Plus className="w-3 h-3 text-emerald-400" />
              手動タスク追加
            </button>
          )}
        </div>

        {/* コンテンツ */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-200 flex-1">
          {activeTab === 'board' && (
            <div className="space-y-3">
              {/* 新規追加フォーム */}
              {isAdding && (
                <form onSubmit={handleAddSubmit} className="p-3 bg-slate-950 border border-emerald-500/40 rounded-xl space-y-2">
                  <div className="font-semibold text-emerald-300 text-xs">新規タスク追加</div>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="タスク名 (例: 外部APIのレートリミット仕様を確認)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as ConversationTaskCategory)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                    >
                      <option value="INVESTIGATE_LATER">【調査】後で調べる</option>
                      <option value="UNRESOLVED">【未解決】課題・エラー</option>
                      <option value="NEXT_IMPLEMENT">【実装予定】次回追加</option>
                      <option value="ON_HOLD">【保留】ペンディング</option>
                    </select>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as 'HIGH' | 'MEDIUM' | 'LOW')}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                    >
                      <option value="HIGH">優先度: 高 (High)</option>
                      <option value="MEDIUM">優先度: 中 (Medium)</option>
                      <option value="LOW">優先度: 低 (Low)</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={newCriteria}
                    onChange={(e) => setNewCriteria(e.target.value)}
                    placeholder="完了条件 (第48章 判定器用)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="px-2.5 py-1 text-slate-400 hover:text-slate-200 text-xs"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      disabled={!newTitle.trim()}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                    >
                      追加
                    </button>
                  </div>
                </form>
              )}

              {/* カテゴリフィルター */}
              <div className="flex gap-1 overflow-x-auto pb-1">
                {['ALL', 'INVESTIGATE_LATER', 'UNRESOLVED', 'NEXT_IMPLEMENT', 'ON_HOLD'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                      selectedCategory === cat
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat === 'ALL'
                      ? 'すべて'
                      : cat === 'INVESTIGATE_LATER'
                      ? '調査'
                      : cat === 'UNRESOLVED'
                      ? '未解決'
                      : cat === 'NEXT_IMPLEMENT'
                      ? '実装予定'
                      : '保留'}
                  </button>
                ))}
              </div>

              {/* タスクリスト */}
              {filteredTasks.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs italic bg-slate-950/40 rounded-xl border border-slate-800">
                  現在登録されている会話タスクはありません。「後で調べる」「未解決」を含む対話を行うと自動抽出されます。
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTasks.map((t) => {
                    const isCompleted = t.status === 'COMPLETED';

                    return (
                      <div
                        key={t.id}
                        className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                          isCompleted
                            ? 'bg-slate-950/40 border-slate-800/60 opacity-70'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold font-mono ${
                                t.category === 'UNRESOLVED'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : t.category === 'INVESTIGATE_LATER'
                                  ? 'bg-sky-950 text-sky-300 border border-sky-800'
                                  : t.category === 'NEXT_IMPLEMENT'
                                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800'
                              }`}
                            >
                              {t.category === 'UNRESOLVED'
                                ? '未解決'
                                : t.category === 'INVESTIGATE_LATER'
                                ? '要調査'
                                : t.category === 'NEXT_IMPLEMENT'
                                ? '実装'
                                : '保留'}
                            </span>
                            <span className={`font-semibold text-xs ${isCompleted ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                              {t.title}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400 leading-snug">
                            {t.goal}
                          </div>

                          <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-0.5">
                            <span>完了条件: {t.completionCriteria}</span>
                            {t.completionJudgePassed && (
                              <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3" />
                                第48章 完了判定器 合格
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 操作ボタン */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isCompleted ? (
                            <button
                              onClick={() => onUpdateStatus(t.id, 'IN_PROGRESS')}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                            >
                              再開
                            </button>
                          ) : (
                            <button
                              onClick={() => onUpdateStatus(t.id, 'COMPLETED')}
                              className="px-2.5 py-1 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              完了判定
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteTask(t.id)}
                            className="p-1 text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              {/* 31.14 自発提案の強度調整 */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      31.14 自発提案の強度調整 (Proactive Suggestions)
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      AIからの自発的な改善提案・先回りアドバイスの頻度を制御
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold">
                    現在: {proactiveLevel}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {(['OFF', 'MODEST', 'STANDARD', 'ACTIVE'] as ProactiveSuggestionLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => onSetProactiveLevel(lvl)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        proactiveLevel === lvl
                          ? 'bg-indigo-600/80 border-indigo-400 text-white font-bold shadow'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs">{lvl}</div>
                      <div className="text-[9px] mt-0.5 opacity-80">
                        {lvl === 'OFF'
                          ? '一切提案なし'
                          : lvl === 'MODEST'
                          ? '控えめ'
                          : lvl === 'STANDARD'
                          ? '標準推奨'
                          : '積極的'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 31.15 個人向け説明レベルの手動上書き */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                      <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
                      31.15 個人向け説明レベルの手動上書き (Explanation Depth Override)
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      第28.4章の自動習熟度推定にかかわらず、好みの説明深度を常時固定指定可能
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                    設定: {explanationOverride}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {(['AUTO', 'CONCISE', 'STANDARD', 'DETAILED', 'TUTORIAL'] as ManualExplanationOverride[]).map(
                    (ov) => (
                      <button
                        key={ov}
                        onClick={() => onSetExplanationOverride(ov)}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          explanationOverride === ov
                            ? 'bg-emerald-600/80 border-emerald-400 text-white font-bold shadow'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="text-xs">{ov}</div>
                        <div className="text-[9px] mt-0.5 opacity-80">
                          {ov === 'AUTO'
                            ? '自動推定'
                            : ov === 'CONCISE'
                            ? '簡潔'
                            : ov === 'STANDARD'
                            ? '標準'
                            : ov === 'DETAILED'
                            ? '詳細'
                            : '学習用'}
                        </div>
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
