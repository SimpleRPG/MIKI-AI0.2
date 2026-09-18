import React from 'react';
import { Activity, Cable, FolderCode, MessageCircle, PackageCheck, Settings, Sparkles } from 'lucide-react';

interface HomeDashboardProps {
  onOpenConversation: () => void;
  onOpenImprovement: () => void;
  onOpenWorkspace: () => void;
  onOpenLibrary: () => void;
  onOpenConnections: () => void;
}

const ActionCard: React.FC<{ title: string; summary: string; icon: React.ReactNode; onClick: () => void }> = ({ title, summary, icon, onClick }) => (
  <button onClick={onClick} className="min-h-24 rounded-3xl border border-slate-800 bg-slate-900 p-4 text-left active:scale-[0.99]">
    <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300">{icon}</span>
    <span className="block text-sm font-bold text-white">{title}</span>
    <span className="mt-1 block text-xs leading-5 text-slate-400">{summary}</span>
  </button>
);

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onOpenConversation, onOpenImprovement, onOpenWorkspace, onOpenLibrary, onOpenConnections }) => (
  <div className="h-full overflow-y-auto bg-slate-950 px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))] text-white">
    <header className="mb-5">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-300">MIKI-AI</p>
      <h1 className="mt-1 text-2xl font-black">ホーム</h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">会話、改善、Workspace、評価用ZIP、外部接続を一つの入口から開きます。</p>
    </header>
    <section className="mb-5 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4">
      <div className="flex items-center gap-3"><Activity className="h-5 w-5 text-emerald-300"/><div><p className="text-sm font-bold">core統括</p><p className="text-xs text-slate-300">副作用を伴う操作はcore Taskの結果で確定します。</p></div></div>
    </section>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <ActionCard title="会話" summary="通常対話とTask進捗を開く" icon={<MessageCircle className="h-5 w-5"/>} onClick={onOpenConversation}/>
      <ActionCard title="改善" summary="自己改善、候補、外部AI評価を確認" icon={<Sparkles className="h-5 w-5"/>} onClick={onOpenImprovement}/>
      <ActionCard title="Workspace" summary="VBAや一般コード資産を隔離して扱う" icon={<FolderCode className="h-5 w-5"/>} onClick={onOpenWorkspace}/>
      <ActionCard title="ライブラリ" summary="評価用Packageと学習資産を確認" icon={<PackageCheck className="h-5 w-5"/>} onClick={onOpenLibrary}/>
      <ActionCard title="外部接続" summary="SearXNG、Gemini、GitHubなどを設定" icon={<Cable className="h-5 w-5"/>} onClick={onOpenConnections}/>
      <ActionCard title="設定" summary="接続診断と安全な設定Export" icon={<Settings className="h-5 w-5"/>} onClick={onOpenConnections}/>
    </div>
  </div>
);
