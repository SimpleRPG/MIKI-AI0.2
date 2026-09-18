import React, { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, PackageCheck, AlertCircle, FileUp, X } from 'lucide-react';
import { typedCoreUiGatewayService, type ReviewPackageLedgerRecord, type ExternalReviewRecord, type ExternalReviewDecisionValue } from '../miki/core/ui/typedCoreUiGatewayService';

export const ReviewPackageLibrary: React.FC = () => {
  const [items,setItems]=useState<ReviewPackageLedgerRecord[]>([]);
  const [busy,setBusy]=useState<string>('');
  const [message,setMessage]=useState<string>('');
  const [selected,setSelected]=useState<ReviewPackageLedgerRecord>();
  const [rawResponse,setRawResponse]=useState('');
  const [fileName,setFileName]=useState('');
  const [reviews,setReviews]=useState<ExternalReviewRecord[]>([]);
  const [activeReview,setActiveReview]=useState<ExternalReviewRecord>();
  const [reason,setReason]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  const refresh=()=>setItems(typedCoreUiGatewayService.listReviewPackages());
  useEffect(()=>{refresh();},[]);
  useEffect(()=>{if(selected){setRawResponse(typedCoreUiGatewayService.getExternalReviewDraft(selected.packageId));setReviews(typedCoreUiGatewayService.listExternalReviews(selected.packageId));}},[selected]);
  useEffect(()=>{if(selected)typedCoreUiGatewayService.saveExternalReviewDraft(selected.packageId,rawResponse);},[selected,rawResponse]);

  const download=async(item:ReviewPackageLedgerRecord)=>{
    setBusy(item.packageId);setMessage('');
    const result=await typedCoreUiGatewayService.regenerateReviewPackage(item.packageId);
    if(!result.ok||!result.artifact){setMessage(`${result.code}: ${result.message}`);setBusy('');return;}
    const saved=typedCoreUiGatewayService.downloadReviewPackage(result.artifact);
    setMessage(`保存開始: ${saved.fileName} / ${saved.size} bytes / SHA-256 ${saved.sha256}`);refresh();setBusy('');
  };

  const loadFile=async(file:File)=>{
    if(!/\.(txt|json)$/i.test(file.name)){setMessage('TXTまたはJSONを選択してください。');return;}
    setRawResponse(await file.text());setFileName(file.name);
  };

  const importReview=async()=>{
    if(!selected||!rawResponse.trim())return;
    setBusy(selected.packageId);setMessage('coreで外部AI返信を確認中');
    try{
      const record=await typedCoreUiGatewayService.importExternalReview({packageId:selected.packageId,rawResponse,sourceType:fileName?/\.json$/i.test(fileName)?'IMPORTED_JSON':'IMPORTED_TXT':'PASTED_TEXT',importedFileName:fileName||undefined,importedFileSize:new TextEncoder().encode(rawResponse).length});
      setReviews(typedCoreUiGatewayService.listExternalReviews(selected.packageId));setActiveReview(record);setMessage(record.status==='MISMATCH'?'Package情報が一致しないため保留しました。':'外部AI返信をcore経由で登録しました。');
    }catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy('');}
  };

  const decide=async(decision:ExternalReviewDecisionValue)=>{
    if(!activeReview)return;
    if(decision==='REJECT'&&!reason.trim()){setMessage('却下理由は必須です。');return;}
    setBusy(activeReview.externalReviewId);setMessage('coreで採否を処理中');
    try{const result=await typedCoreUiGatewayService.submitExternalReviewDecision({externalReviewId:activeReview.externalReviewId,decision,reason});setMessage(`${decision}: ${result.status} / ${result.coreDecisionId}`);setReviews(typedCoreUiGatewayService.listExternalReviews(activeReview.packageId));}
    catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy('');}
  };

  return <div className="space-y-4 max-w-6xl mx-auto pb-28">
    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-100 flex items-center gap-2"><PackageCheck className="w-4 h-4 text-emerald-400"/>外部AI評価用ZIP</h3><p className="text-[11px] text-slate-400 mt-1">隔離候補の保存と、外部AI返信の登録・採否要求を行います。正本コードへの適用は行いません。</p></div><button onClick={refresh} className="min-h-11 px-3 rounded-lg bg-slate-800 text-slate-200 text-xs flex items-center gap-1"><RefreshCw className="w-4 h-4"/>更新</button></div>
    {message&&<div className="p-3 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-mono text-slate-300 break-all">{message}</div>}
    {items.length===0?<div className="p-8 text-center rounded-xl border border-dashed border-slate-700 text-slate-500 text-xs"><AlertCircle className="w-5 h-5 mx-auto mb-2"/>評価用Packageはまだありません。</div>:<div className="space-y-2">{items.map(item=><div key={item.packageId} className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3"><button onClick={()=>setSelected(item)} className="text-left w-full min-h-11"><div className="text-xs font-bold text-slate-200 font-mono truncate">{item.packageId}</div><div className="text-[10px] text-slate-500 mt-1">Revision {item.candidateRevision} / {item.status} / {item.inputs.files.length} files</div><div className="text-[10px] text-slate-500 font-mono truncate mt-1">Manifest {item.candidateManifestSha256}</div></button><div className="grid grid-cols-2 gap-2"><button disabled={busy===item.packageId} onClick={()=>download(item)} className="min-h-11 rounded-lg bg-indigo-600 disabled:bg-slate-700 text-white text-xs flex items-center justify-center gap-1"><Download className="w-4 h-4"/>ZIPを保存</button><button onClick={()=>setSelected(item)} className="min-h-11 rounded-lg bg-emerald-700 text-white text-xs flex items-center justify-center gap-1"><FileUp className="w-4 h-4"/>外部AI返信</button></div></div>)}</div>}

    {selected&&<div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto"><div className="max-w-md mx-auto min-h-screen p-4 pb-32 space-y-4"><div className="flex justify-between items-center"><div><div className="text-xs font-bold text-white">外部AI返信登録</div><div className="text-[10px] text-slate-400">Revision {selected.candidateRevision} / {selected.packageId.slice(0,22)}...</div></div><button onClick={()=>{setSelected(undefined);setActiveReview(undefined);}} className="min-h-11 min-w-11 grid place-items-center rounded-lg bg-slate-800"><X className="w-5 h-5"/></button></div><textarea value={rawResponse} onChange={event=>setRawResponse(event.target.value)} placeholder="外部AIの返信全文を貼り付け" className="w-full min-h-[40vh] p-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 resize-y"/><div className="text-[10px] text-slate-400">{rawResponse.length}文字 / 下書き自動保存 {fileName&&`/ ${fileName}`}</div><input ref={fileRef} type="file" accept=".txt,.json,text/plain,application/json" className="hidden" onChange={event=>{const file=event.target.files?.[0];if(file)void loadFile(file);}}/><div className="grid grid-cols-2 gap-2"><button onClick={()=>fileRef.current?.click()} className="min-h-11 rounded-lg bg-slate-800 text-xs">TXT/JSON選択</button><button disabled={!rawResponse.trim()||Boolean(busy)} onClick={importReview} className="min-h-11 rounded-lg bg-indigo-600 disabled:bg-slate-700 text-xs">coreへ取込み</button></div>{reviews.map(review=><button key={review.externalReviewId} onClick={()=>setActiveReview(review)} className="w-full text-left p-3 rounded-xl border border-slate-700 bg-slate-900"><div className="text-xs text-white">{review.externalVerdict} / {review.status}</div><div className="text-[10px] text-slate-500 truncate">SHA {review.rawResponseSha256}</div></button>)}{activeReview&&<div className="space-y-3"><div className="p-3 rounded-xl bg-slate-900 border border-slate-700"><div className="text-xs font-bold">評価確認: {activeReview.externalVerdict}</div><div className="text-[11px] text-slate-300 mt-2 whitespace-pre-wrap max-h-48 overflow-y-auto">{activeReview.reviewSummary}</div></div><textarea value={reason} onChange={event=>setReason(event.target.value)} placeholder="採否理由。却下時は必須" className="w-full min-h-24 p-3 rounded-xl bg-slate-900 border border-slate-700 text-sm"/></div>}</div>{activeReview&&<div className="fixed bottom-0 inset-x-0 z-50 bg-slate-950/95 border-t border-slate-700 p-3 safe-area-inset-bottom"><div className="max-w-md mx-auto grid grid-cols-2 gap-3"><button disabled={Boolean(busy)} onClick={()=>decide('ACCEPT')} className="min-h-12 rounded-xl bg-emerald-700 font-bold">採用</button><button disabled={Boolean(busy)} onClick={()=>decide('REQUEST_CHANGES')} className="min-h-12 rounded-xl bg-amber-600 font-bold">要修正</button><button disabled={Boolean(busy)} onClick={()=>decide('HOLD')} className="min-h-12 rounded-xl bg-slate-700 font-bold">保留</button><button disabled={Boolean(busy)} onClick={()=>decide('REJECT')} className="min-h-12 rounded-xl bg-red-700 font-bold">却下</button></div></div>}</div>}
  </div>;
};
