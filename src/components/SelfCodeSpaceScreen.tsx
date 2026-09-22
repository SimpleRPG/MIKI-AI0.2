import React,{useEffect,useMemo,useState} from 'react';
import {RefreshCw,Search,FileCode2,ChevronLeft,Database,UploadCloud} from 'lucide-react';
import {typedCoreUiGatewayService} from '../miki/core/ui/typedCoreUiGatewayService';

export const SelfCodeSpaceScreen:React.FC=()=>{
 const [snapshot,setSnapshot]=useState(typedCoreUiGatewayService.getSelfCodeSnapshot());
 const [query,setQuery]=useState('');
 const [selected,setSelected]=useState<string>();
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [repository,setRepository]=useState(()=>typedCoreUiGatewayService.getSelfCodeGitHubSettings().repository);
 const [branch,setBranch]=useState(()=>typedCoreUiGatewayService.getSelfCodeGitHubSettings().branch);
 const [commitMessage,setCommitMessage]=useState(()=>typedCoreUiGatewayService.getSelfCodeGitHubSettings().commitMessage);

 const files=useMemo(()=>query?typedCoreUiGatewayService.searchSelfCode(query,100):typedCoreUiGatewayService.listSelfCodeFiles(),[query,snapshot]);
 const current=selected?typedCoreUiGatewayService.readSelfCodeFile(selected):undefined;

 const saveSettings=()=>{
  try{
   typedCoreUiGatewayService.saveSelfCodeGitHubSettings({repository,branch,commitMessage});
   setSettingsOpen(false);
   setMessage('GitHub設定を保存しました。再同期してください。');
  }catch(e){setMessage(e instanceof Error?e.message:String(e));}
 };

 const push=async()=>{setBusy(true);setMessage('');try{const result=await typedCoreUiGatewayService.pushSelfCode(commitMessage);if(result.status!=='SUCCESS')throw new Error(result.summary);setSnapshot(result.data);setMessage('GitHubへPUSH完了');}catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};

 const sync=async()=>{
  setBusy(true);setMessage('');
  try{
   const result=await typedCoreUiGatewayService.syncSelfCode();
   setSnapshot(result.snapshot);
   setSelected(undefined);
   setMessage(`同期完了: ${result.snapshot.files.length}ファイル / ${result.snapshot.repoSha256.slice(0,16)}`);
  }catch(e){setMessage(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };

 useEffect(()=>{
  if(!snapshot) void sync();
 },[]);

 if(current)return <div className="h-full overflow-y-auto bg-slate-950 p-4 pb-24 text-slate-100">
  <button onClick={()=>setSelected(undefined)} className="min-h-12 mb-3"><ChevronLeft className="inline"/>ファイル一覧</button>
  <header className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
   <h1 className="font-bold break-all">{current.path}</h1>
   <p className="mt-1 text-[10px] text-slate-500 font-mono break-all">{current.sha256}</p>
  </header>
  <pre className="mt-3 whitespace-pre-wrap break-words rounded-3xl border border-slate-800 bg-slate-900 p-4 text-[11px] leading-5 font-mono">{current.content}</pre>
 </div>;

 return <div className="h-full overflow-y-auto bg-slate-950 p-4 pb-24 text-slate-100">
  <header className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
   <div className="flex items-center gap-2">
    <Database className="h-5 w-5 text-indigo-300"/>
    <div><h1 className="text-lg font-bold">自己コードスペース</h1><p className="text-xs text-slate-400">みき自身の正本コード専用スペース</p></div>
   </div>
   <div className="mt-3 text-[10px] text-slate-500 font-mono break-all">
    {snapshot?`${snapshot.repository} · ${snapshot.branch} · ${snapshot.files.length} files · ${snapshot.repoSha256}`:'未同期'}
   </div>
   <button disabled={busy} onClick={sync} className="mt-3 min-h-12 w-full rounded-2xl bg-indigo-600 font-bold disabled:opacity-50">
    <RefreshCw className="mr-2 inline h-4 w-4"/>{busy?'同期中':'GitHubから正本を同期'}
   </button>
   <button disabled={busy} onClick={()=>setSettingsOpen(v=>!v)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 text-sm font-bold">
    GitHub PUSH設定 {settingsOpen?'▲':'▼'}
   </button>
   {settingsOpen&&<div className="mt-2 rounded-2xl border border-slate-700 bg-slate-950 p-3">
    <label className="block text-xs text-slate-400">自己コード用リポジトリ</label>
    <input value={repository} onChange={e=>setRepository(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm"/>
    <label className="mt-2 block text-xs text-slate-400">ブランチ</label>
    <input value={branch} onChange={e=>setBranch(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm"/>
    <label className="mt-2 block text-xs text-slate-400">コミットメッセージ</label>
    <input value={commitMessage} onChange={e=>setCommitMessage(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm"/>
    <button disabled={busy} onClick={saveSettings} className="mt-2 min-h-12 w-full rounded-xl bg-slate-700 font-bold">設定を保存</button>
   </div>}
   <button disabled={busy||!snapshot?.dirty} onClick={push} className="mt-2 min-h-12 w-full rounded-2xl bg-emerald-600 font-bold disabled:opacity-50">
    <UploadCloud className="mr-2 inline h-4 w-4"/>{busy?'処理中':snapshot?.dirty?'自己コードをGitHubへPUSH':'変更なし'}
   </button>
  </header>

  {message&&<div className="my-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 text-xs break-all">{message}</div>}

  <div className="mt-3 relative">
   <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500"/>
   <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ファイル名・コードを検索" className="min-h-12 w-full rounded-2xl border border-slate-700 bg-slate-900 pl-10 pr-3 text-sm"/>
  </div>

  <div className="mt-3 space-y-2">
   {files.map(file=><button key={file.path} onClick={()=>setSelected(file.path)} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 text-left">
    <FileCode2 className="h-4 w-4 shrink-0 text-indigo-300"/>
    <div className="min-w-0"><div className="truncate text-xs font-bold">{file.path}</div><div className="mt-1 text-[9px] text-slate-500 font-mono">{file.sha256.slice(0,16)}</div></div>
   </button>)}
  </div>
 </div>;
};
