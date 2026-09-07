/**
 * 設計思想 第31章 31.2: 会話分岐・巻き戻し (Conversation Branch Modal)
 */

import React, { useState } from 'react';
import { ConversationBranch } from '../../types';
import { GitBranch, GitMerge, Plus, Trash2, CheckCircle2, ArrowRight, X } from 'lucide-react';

interface ConversationBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: ConversationBranch[];
  activeBranchId: string;
  onSwitchBranch: (branchId: string) => void;
  onMergeIntoMain: (sourceBranchId: string) => void;
  onDeleteBranch: (branchId: string) => void;
  onCreateNewBranch: (name: string, note?: string) => void;
}

export const ConversationBranchModal: React.FC<ConversationBranchModalProps> = ({
  isOpen,
  onClose,
  branches,
  activeBranchId,
  onSwitchBranch,
  onMergeIntoMain,
  onDeleteBranch,
  onCreateNewBranch,
}) => {
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchNote, setNewBranchNote] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    onCreateNewBranch(newBranchName.trim(), newBranchNote.trim() || undefined);
    setNewBranchName('');
    setNewBranchNote('');
    setIsCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* ヘッダー */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-violet-500/20 text-violet-400 rounded-lg">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                会話ブランチ・巻き戻しマネージャー
                <span className="text-[10px] px-2 py-0.5 font-mono font-bold bg-violet-900/60 text-violet-300 border border-violet-700/50 rounded-full">
                  第31.2章仕様
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                現在の対話を壊さずに別案を並列検証し、採用した仮説のみを本線へ統合マージ
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

        {/* コンテンツ */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-200">
          {/* 新規ブランチ作成フォーム */}
          {isCreating ? (
            <form onSubmit={handleCreate} className="p-3.5 bg-slate-950 border border-violet-500/40 rounded-xl space-y-3">
              <div className="font-semibold text-violet-300 text-xs flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                現在地点から新規仮説ブランチを分岐
              </div>
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="例: 別案A: 非同期Fetch実装案"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-violet-500"
                autoFocus
              />
              <input
                type="text"
                value={newBranchNote}
                onChange={(e) => setNewBranchNote(e.target.value)}
                placeholder="仮説メモ (任意): パフォーマンス比較のため"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-violet-500"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1 text-slate-400 hover:text-slate-200 text-xs"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={!newBranchName.trim()}
                  className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                >
                  ブランチ作成
                </button>
              </div>
            </form>
          ) : (
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">登録ブランチ一覧 ({branches.length})</span>
              <button
                onClick={() => setIsCreating(true)}
                className="px-3 py-1.5 bg-violet-600/90 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                現在の会話から分岐
              </button>
            </div>
          )}

          {/* ブランチ一覧カード */}
          <div className="space-y-2.5">
            {branches.map((b) => {
              const isActive = b.id === activeBranchId;
              const isMain = b.id === 'branch_main';

              return (
                <div
                  key={b.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isActive
                      ? 'bg-violet-950/40 border-violet-500/60 shadow-md'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className={`w-4 h-4 ${isActive ? 'text-violet-400' : 'text-slate-500'}`} />
                      <div>
                        <div className="font-semibold text-slate-100 flex items-center gap-2">
                          {b.name}
                          {isMain && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded">
                              本線 (Main)
                            </span>
                          )}
                          {isActive && (
                            <span className="text-[10px] font-medium text-violet-300 flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3 text-violet-400" />
                              アクティブ
                            </span>
                          )}
                        </div>
                        {b.hypothesisNote && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            仮説メモ: {b.hypothesisNote}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          メッセージ数: {b.messages?.length || 0} 件 • 更新: {new Date(b.updatedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isActive && (
                        <button
                          onClick={() => onSwitchBranch(b.id)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                        >
                          切り替え
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      {!isMain && (
                        <>
                          <button
                            onClick={() => onMergeIntoMain(b.id)}
                            title="本線(Main)へマージ"
                            className="px-2.5 py-1 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                          >
                            <GitMerge className="w-3 h-3" />
                            本線へマージ
                          </button>
                          <button
                            onClick={() => onDeleteBranch(b.id)}
                            title="ブランチ削除"
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
