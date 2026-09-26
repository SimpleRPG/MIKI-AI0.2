import React, { useState } from 'react';
import { Brain, PackageCheck } from 'lucide-react';
import { ReviewPackageLibrary } from './ReviewPackageLibrary';

export const LibraryHub: React.FC<{ onOpenMemory: () => void }> = ({ onOpenMemory }) => {
  const [view, setView] = useState<'packages' | 'overview'>('packages');
  return <div className="h-full overflow-y-auto bg-slate-950 pb-24 text-white">
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">Library</p>
      <h1 className="text-xl font-black">ライブラリ</h1>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={()=>setView('packages')} className={`min-h-12 rounded-2xl text-sm font-bold ${view==='packages'?'bg-indigo-600':'bg-slate-900'}`}><PackageCheck className="mr-2 inline h-4 w-4"/>評価用ZIP</button>
        <button onClick={()=>setView('overview')} className={`min-h-12 rounded-2xl text-sm font-bold ${view==='overview'?'bg-indigo-600':'bg-slate-900'}`}><Brain className="mr-2 inline h-4 w-4"/>記憶・部品</button>
      </div>
    </header>
    {view==='packages' ? <ReviewPackageLibrary/> : <main className="space-y-3 p-4"><section className="rounded-3xl border border-slate-800 bg-slate-900 p-4"><h2 className="font-bold">記憶・学習部品</h2><p className="mt-2 text-sm leading-6 text-slate-400">既存の記憶管理画面を開き、保存済み記憶を確認します。知識・コード・会話部品の統合一覧は継続実装対象です。</p><button onClick={onOpenMemory} className="mt-4 min-h-12 w-full rounded-2xl bg-indigo-600 font-bold">記憶管理を開く</button></section></main>}
  </div>;
};
