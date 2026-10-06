export type StartupPhase='ENTRY'|'STORAGE_WAIT'|'APP_IMPORT'|'APP_RENDERED'|'SELF_CODE_SEED'|'RUNTIME_INIT'|'NATIVE_MORPHOLOGY'|'READY'|'FAILED';
export interface StartupDiagnostic{phase:StartupPhase;startedAt:number;updatedAt:number;message:string;error?:string;userAgent:string;}
const KEY='miki_startup_diagnostic_v1';

class StartupRecoveryService{
 private diagnostic:StartupDiagnostic={
  phase:'ENTRY',
  startedAt:Date.now(),
  updatedAt:Date.now(),
  message:'JavaScript entry loaded',
  userAgent:typeof navigator==='undefined'?'unknown':navigator.userAgent
 };
 private overlay:HTMLElement|null=null;
 private elapsedTimer:number|undefined;

 private phaseLabel(phase:StartupPhase):string{
  const labels:Record<StartupPhase,string>={
   ENTRY:'起動入口',
   STORAGE_WAIT:'永続データ準備',
   APP_IMPORT:'アプリ本体読み込み',
   APP_RENDERED:'画面表示',
   SELF_CODE_SEED:'初期コード資産準備',
   RUNTIME_INIT:'MIKIランタイム初期化',
   NATIVE_MORPHOLOGY:'日本語解析エンジン初期化',
   READY:'起動完了',
   FAILED:'起動失敗'
  };
  return labels[phase];
 }

 update(phase:StartupPhase,message:string,error?:unknown):StartupDiagnostic{
  this.diagnostic={
   ...this.diagnostic,
   phase,
   message,
   error:error instanceof Error?`${error.name}: ${error.message}`:error?String(error):undefined,
   updatedAt:Date.now()
  };
  try{localStorage.setItem(KEY,JSON.stringify(this.diagnostic));}catch{}
  this.renderStatus();
  if(phase==='READY'){
   window.setTimeout(()=>{if(this.diagnostic.phase==='READY')this.clear();},1500);
  }
  return {...this.diagnostic};
 }

 get():StartupDiagnostic{return {...this.diagnostic};}

 mountStatusOverlay():void{
  if(this.overlay)return;

  const box=document.createElement('main');
  box.id='miki-startup-status';
  box.setAttribute('role','status');
  box.setAttribute('aria-live','polite');
  box.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#020617;color:#e2e8f0;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,sans-serif';

  const panel=document.createElement('section');
  panel.style.cssText='width:min(720px,100%);border:1px solid #334155;background:#0f172a;border-radius:18px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.45)';

  const title=document.createElement('h1');
  title.dataset.role='title';
  title.style.cssText='font-size:24px;font-weight:800;margin:0 0 18px;color:#f8fafc';
  title.textContent='MIKI 起動中';

  const phase=document.createElement('div');
  phase.dataset.role='phase';
  phase.style.cssText='font-size:13px;font-weight:700;color:#a78bfa;margin-bottom:8px';

  const message=document.createElement('div');
  message.dataset.role='message';
  message.style.cssText='font-size:17px;line-height:1.6;color:#e2e8f0;margin-bottom:14px';

  const elapsed=document.createElement('div');
  elapsed.dataset.role='elapsed';
  elapsed.style.cssText='font-size:12px;color:#94a3b8;font-variant-numeric:tabular-nums';

  const bar=document.createElement('div');
  bar.style.cssText='height:4px;background:#1e293b;border-radius:999px;overflow:hidden;margin-top:18px';

  const progress=document.createElement('div');
  progress.dataset.role='progress';
  progress.style.cssText='height:100%;width:20%;background:#8b5cf6;border-radius:999px;transition:width .25s ease';

  bar.append(progress);
  panel.append(title,phase,message,elapsed,bar);
  box.append(panel);
  document.body.append(box);

  this.overlay=box;

  this.elapsedTimer=window.setInterval(()=>{
   this.renderStatus();
  },250);

  this.renderStatus();
 }

 private renderStatus():void{
  if(!this.overlay)return;

  const phase=this.overlay.querySelector<HTMLElement>('[data-role="phase"]');
  const message=this.overlay.querySelector<HTMLElement>('[data-role="message"]');
  const elapsed=this.overlay.querySelector<HTMLElement>('[data-role="elapsed"]');
  const progress=this.overlay.querySelector<HTMLElement>('[data-role="progress"]');

  if(phase)phase.textContent=`現在の処理：${this.phaseLabel(this.diagnostic.phase)}`;
  if(message)message.textContent=this.diagnostic.message;

  if(elapsed){
   const seconds=((Date.now()-this.diagnostic.startedAt)/1000).toFixed(1);
   elapsed.textContent=`経過時間：${seconds}秒`;
  }

  if(progress){
   const widths:Record<StartupPhase,string>={
    ENTRY:'8%',
    STORAGE_WAIT:'18%',
    APP_IMPORT:'32%',
    APP_RENDERED:'45%',
    SELF_CODE_SEED:'58%',
    RUNTIME_INIT:'72%',
    NATIVE_MORPHOLOGY:'88%',
    READY:'100%',
    FAILED:'100%'
   };
   progress.style.width=widths[this.diagnostic.phase];
   if(this.diagnostic.phase==='FAILED'){
    progress.style.background='#e11d48';
   }
  }
 }

 clear():void{
  if(this.elapsedTimer!==undefined){
   window.clearInterval(this.elapsedTimer);
   this.elapsedTimer=undefined;
  }
  this.overlay?.remove();
  this.overlay=null;
  try{localStorage.removeItem(KEY);}catch{}
 }

 renderFatal(root:HTMLElement,error:unknown):void{
  const detail=error instanceof Error?`${error.name}: ${error.message}`:String(error);
  this.update('FAILED','Application bootstrap failed',error);
  root.innerHTML='';
  this.overlay?.remove();
  this.overlay=null;

  const box=document.createElement('main');
  box.style.cssText='min-height:100vh;background:#020617;color:#e2e8f0;padding:24px;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif';

  const panel=document.createElement('section');
  panel.style.cssText='max-width:720px;width:100%;border:1px solid #e11d48;background:#0f172a;border-radius:16px;padding:20px';

  const title=document.createElement('h1');
  title.textContent='MIKIの起動に失敗しました';
  title.style.cssText='font-size:20px;color:#fecdd3;margin:0 0 12px';

  const text=document.createElement('p');
  text.textContent='起動処理の実際の失敗内容を表示しています。下の内容を診断ログとして使用できます。';
  text.style.cssText='line-height:1.7;color:#cbd5e1';

  const pre=document.createElement('pre');
  pre.textContent=detail;
  pre.style.cssText='white-space:pre-wrap;word-break:break-word;background:#020617;border-radius:8px;padding:12px;color:#fda4af';

  const retry=document.createElement('button');
  retry.textContent='再起動';
  retry.style.cssText='border:0;border-radius:8px;padding:10px 18px;background:#7c3aed;color:white;font-weight:700';
  retry.onclick=()=>location.reload();

  panel.append(title,text,pre,retry);
  box.append(panel);
  root.append(box);
 }
}

export const startupRecoveryService=new StartupRecoveryService();
