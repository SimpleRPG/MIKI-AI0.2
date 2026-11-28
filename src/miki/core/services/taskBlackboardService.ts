import { storageService } from '../../../services/storageService';
import {
  isStorageAuthoritativeNow,
  runWhenStorageAuthoritative,
} from '../../../services/deferredStoreLoad';
import type { MikiDomain } from './crossDomainCirculationService';

export type BlackboardStatus='OPEN'|'ROUTING'|'WAITING'|'PAUSED'|'COMPLETED'|'FAILED'|'CANCELLED';
export type BlackboardEntryKind='INPUT'|'OBSERVATION'|'EVIDENCE'|'CLAIM'|'DECISION'|'RESULT'|'ERROR'|'CHECKPOINT';
export interface BlackboardEntry { id:string; taskId:string; kind:BlackboardEntryKind; domain:MikiDomain; key:string; value:unknown; evidenceIds:string[]; createdAt:number; }
export interface BlackboardTask { taskId:string; title?:string; goal:string; source:MikiDomain; status:BlackboardStatus; revision:number; createdAt:number; updatedAt:number; visitedDomains:MikiDomain[]; pendingDomains:MikiDomain[]; entries:BlackboardEntry[]; pausedReason?:string; resumeCount:number; lastCycle:number; }

/**
 * P2004: 機械的な一時停止かどうか。キュー待ち・サイクル予算・
 * 背景予算による停止は、所有者（ループのキュー項目）が失われても
 * 再キュー・復旧してよい。人為・外部要因の停止（USER_REQUESTED、
 * FOREGROUND_USER_REQUEST_ACTIVE 等）は含めない。復旧可否の判定は
 * この関数に一本化し、判定箇所ごとに理由の解釈がずれないように
 * する。以前はサイクル予算の PAUSED が理由を持たず（setStatus
 * 経由）、どの復旧条件にも一致しない行き止まりになっていた。
 */
export function isAutoResumablePauseReason(pausedReason?: string): boolean {
  return pausedReason === 'SELF_IMPROVEMENT_QUEUED'
    || pausedReason === 'CORE_CYCLE_BUDGET_EXHAUSTED'
    // P2006: 会話優先でサイクル開始に駐車した背景タスクも、
    // 予算駐車と同じく自動再開の対象（会話が終われば続きを回す）。
    || pausedReason === 'CONVERSATION_PRIORITY'
    || (typeof pausedReason === 'string' && pausedReason.startsWith('BACKGROUND_BUDGET:'));
}

function entryRecord(entry:BlackboardEntry):Record<string,unknown>|undefined{
 const value=entry.value;
 return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
}
function successfulBusinessResult(entry:BlackboardEntry):boolean{
 if(entry.kind!=='RESULT')return false;
 const value=entryRecord(entry);
 if(!value)return false;
 const reply=value.reply&&typeof value.reply==='object'&&!Array.isArray(value.reply)?value.reply as Record<string,unknown>:undefined;
 const status=String(reply?.status||value.status||'').toUpperCase();
 return ['SUCCEEDED','SUCCESS','COMPLETED','ALREADY_APPLIED'].includes(status);
}

/**
 * An ERROR remains in the append-only audit trail after recovery. It blocks
 * completion only until a later successful result explicitly supersedes its
 * operation instance. Errors without an operation instance remain fail-closed.
 */
export function unresolvedTaskErrors(task:BlackboardTask):BlackboardEntry[]{
 const entries=task.entries;
 const unresolved:BlackboardEntry[]=[];
 entries.forEach((entry,index)=>{
  if(entry.kind!=='ERROR')return;
  const value=entryRecord(entry);
  const operationInstanceId=String(value?.operationInstanceId||'').trim();
  if(!operationInstanceId){unresolved.push(entry);return;}
  const recovered=entries.slice(index+1).some(later=>{
   if(!successfulBusinessResult(later))return false;
   const result=entryRecord(later);
   if(!result)return false;
   if(String(result.operationInstanceId||'')===operationInstanceId)return true;
   const supersedes=Array.isArray(result.supersedesOperationInstanceIds)?result.supersedesOperationInstanceIds.map(String):[];
   return supersedes.includes(operationInstanceId);
  });
  if(!recovered)unresolved.push(entry);
 });
 return unresolved;
}

/**
 * Only explicit positive validation results may feed verified cross-domain
 * transfer and causal outcome measurements. Entry names alone are not proof.
 */
export function isVerifiedTaskOutcome(task:BlackboardTask):boolean{
 if(task.status!=='COMPLETED'||unresolvedTaskErrors(task).length>0)return false;
 return task.entries.some(entry=>{
  if(entry.kind!=='RESULT'||entry.evidenceIds.length===0||
     !/(?:verif|validation|regression|test|e2e|acceptance)/i.test(entry.key))return false;
  const value=entryRecord(entry);
  if(!value)return false;
  const status=String(value.status??value.outcome??value.assertionStatus??'').trim().toUpperCase();
  const explicitlyFailed=
   value.passed===false||value.verified===false||value.failed===true||
   ['FAIL','FAILED','ERROR','BLOCKED','UNRESOLVED','INCONCLUSIVE'].includes(status);
  if(explicitlyFailed)return false;
  return value.passed===true||value.verified===true||value.assertionStatus==='PASS'||
   ['PASS','PASSED','SUCCESS','SUCCEEDED','VERIFIED','DEVICE_VERIFIED'].includes(status);
 });
}

/**
 * P3036: 終了タスクの圧縮（蒸留→圧縮→冷却）。台帳は 2026-11-28 の
 * 1日で 25.5MB → 64.5MB まで育ち、状態に触る全操作（起動時の
 * JSON.parse、保存、走査）を増幅させた。終了したタスクの per-cycle
 * 診断は誰も読み返さないが、読み手が実際に使う部分は残す必要が
 * あるため、単純な削除ではなく形を変えて残す：
 *  - DECISION / RESULT / ERROR と conversationResponseFinalized は
 *    「骨格」として残す（id・kind・domain・key・evidenceIds・
 *    createdAt は無変更、value は読み手が見るスカラー項目だけに
 *    蒸留）。unresolvedTaskErrors / isVerifiedTaskOutcome / 系譜の
 *    DECISION id 照合 / 会話想起（同一 goal の前回応答・最新
 *    cognitiveState・evidence union）は圧縮後も同じ答えを返す。
 *  - INPUT / OBSERVATION / EVIDENCE / CLAIM / CHECKPOINT は
 *    要約エントリ1件（key=blackboardCompactionSummary）に畳む。
 *    evidenceIds の union は要約エントリが引き継ぐ。
 * 猶予：終了から通常 6 時間。実働の読み手（完了ゲート・再開・
 * 再検証の重複判定）は分単位で終わり、24h 窓のメトリクスは骨格の
 * kind/key/createdAt で回答できる。ストア全体が
 * COMPACT_SIZE_TRIGGER_BYTES を超えたら猶予を 30 分に縮める
 * （台帳が育ちすぎた時の圧力バルブ）。稼働中・最近のタスクには
 * 一切触らない。冪等：要約済みタスクは再圧縮しない。
 */
export const COMPACTION_SUMMARY_KEY='blackboardCompactionSummary';
const COMPACT_GRACE_MS=6*60*60*1000;
const COMPACT_PRESSURE_GRACE_MS=30*60*1000;
const COMPACT_SIZE_TRIGGER_BYTES=16*1024*1024;
const COMPACT_MIN_ENTRIES=12;
const DISTILL_STRING_MAX=2048;
const DISTILL_LIST_MAX=200;

function isTerminalStatus(status:BlackboardStatus):boolean{
 return status==='COMPLETED'||status==='FAILED'||status==='CANCELLED';
}
function distillScalar(value:unknown):unknown{
 if(typeof value==='string')return value.length>DISTILL_STRING_MAX?`${value.slice(0,DISTILL_STRING_MAX)}…[distilled]`:value;
 if(typeof value==='number'||typeof value==='boolean'||value===null)return value;
 return undefined;
}
function distillStringList(value:unknown,cap:number):string[]|undefined{
 if(!Array.isArray(value))return undefined;
 return value.slice(0,cap).map(item=>String(item));
}
/**
 * 読み手が実際に見る項目だけを残して entry の value を蒸留する。
 * 残すのは：全てのスカラー項目、RESULT の reply.status、
 * supersedesOperationInstanceIds、answerValidation.passed、
 * cognitiveState のリスト項目（制約・未知・証拠・能力・学習参照）、
 * 会話の確定応答そのもの（conversationResponseFinalized /
 * conversationFinalResponse の response は想起が読む本文なので全文）。
 * それ以外の入れ子構造は落とし、落とした場合は __distilled を付ける。
 */
export function distillEntryValue(entry:BlackboardEntry):unknown{
 const value=entry.value;
 if(!value||typeof value!=='object'||Array.isArray(value)){
  const serialized=typeof value==='string'?value:JSON.stringify(value??null);
  if(serialized.length<=DISTILL_STRING_MAX)return value;
  return {__distilled:true,originalChars:serialized.length};
 }
 const record=value as Record<string,unknown>;
 const out:Record<string,unknown>={};
 let dropped=false;
 for(const [field,fieldValue] of Object.entries(record)){
  if((entry.key==='conversationResponseFinalized'||entry.key==='conversationFinalResponse')&&field==='response'&&typeof fieldValue==='string'){out[field]=fieldValue;continue;}
  const scalar=distillScalar(fieldValue);
  if(scalar!==undefined){out[field]=scalar;continue;}
  if(field==='reply'&&fieldValue&&typeof fieldValue==='object'&&!Array.isArray(fieldValue)){
   const replyStatus=distillScalar((fieldValue as Record<string,unknown>).status);
   if(replyStatus!==undefined){out[field]={status:replyStatus};continue;}
  }
  if(field==='supersedesOperationInstanceIds'){
   const list=distillStringList(fieldValue,50);
   if(list){out[field]=list;continue;}
  }
  if(field==='answerValidation'&&fieldValue&&typeof fieldValue==='object'&&!Array.isArray(fieldValue)){
   out[field]={passed:(fieldValue as Record<string,unknown>).passed===true};continue;
  }
  if(entry.key.startsWith('cognitiveState:')&&['constraints','unknowns','evidenceIds','capabilityRefs','learningRefs'].includes(field)){
   const list=distillStringList(fieldValue,DISTILL_LIST_MAX);
   if(list){out[field]=list;continue;}
  }
  dropped=true;
 }
 if(dropped)out.__distilled=true;
 return out;
}
function isPreservedEntry(entry:BlackboardEntry):boolean{
 return entry.kind==='DECISION'||entry.kind==='RESULT'||entry.kind==='ERROR'
  ||entry.key==='conversationResponseFinalized';
}

const KEY='miki_task_blackboard_v1';
// P3034: 永続化バッチ化の窓。変更が続く間は最大でも
// SAVE_MAX_WAIT_MS に1回、静まれば最後の変更から
// SAVE_DEBOUNCE_MS 後に書き込む。
const SAVE_DEBOUNCE_MS=1500;
const SAVE_MAX_WAIT_MS=15000;

function summarizeTaskTitle(
 goal:string,
 payload?:Record<string,unknown>
):string{
 const directiveContext=payload?.directiveContext;
 const contextTitle=
  directiveContext&&typeof directiveContext==='object'&&!Array.isArray(directiveContext)
   ? (directiveContext as Record<string,unknown>).title
   : undefined;

 const candidates=[
  payload?.title,
  payload?.directiveTitle,
  contextTitle,
  goal
 ];

 for(const candidate of candidates){
  if(typeof candidate!=='string')continue;
  let value=candidate
   .replace(/^#+\s*/,'')
   .replace(/^\s*(?:目的|作業内容|指示内容|goal|objective)\s*[:：]\s*/i,'')
   .replace(/[\t ]+/g,' ')
   .replace(/^[-*]\s*/,'')
   .trim();

  if(!value)continue;

  // 自動生成された日付だけの汎用タイトルは、goal側へフォールバックする。
  if(/^作業指示(?:書)?\s*[（(].*[）)]\s*(?:受領)?$/u.test(value)){
   continue;
  }

  value=value.split(/[。！？!?\n]/u)[0].trim();
  if(!value)continue;

  return value.length>64
   ? `${value.slice(0,61).trim()}…`
   : value;
 }

 return '作業タスク';
}
const MAX_TASKS=200;
class TaskBlackboardService{
 private tasks=new Map<string,BlackboardTask>(); private sequence=0; private persistenceBlocked=false;
 private saveTimer: ReturnType<typeof setTimeout> | null = null;
 private saveMaxTimer: ReturnType<typeof setTimeout> | null = null;
 // P3037: 権威ある初回読み込みが済むまでは true。この間は全体保存
 // を行わない（provisional な空の像で動き、作成・追記はメモリに
 // だけ残る）。P3022 の6ストアから漏れていたため、未ハイドレー
 // ション起動で空の像＋ループの初回追記が実台帳を上書きした
 // （2026-11-28 に2回発火、64.5MB の台帳喪失を含む）。
 private loadPending=false;
 constructor(){
  if(isStorageAuthoritativeNow()){this.load();return;}
  this.loadPending=true;
  runWhenStorageAuthoritative(()=>{
   // 保留中に作成・追記されたタスクを退避し、権威ある読み込み
   // （従来手順そのまま）の後で taskId／エントリ id で合体させる。
   const provisional=[...this.tasks.values()];
   this.tasks.clear();
   this.loadPending=false;
   this.load();
   if(this.mergeProvisionalTasks(provisional))this.save();
  });
 }
 /**
  * P3037: 保留中のタスクを、読み込めた実データへ合体させる。実
  * データ側が土台。同一 taskId はエントリ id で合体し（読み込み
  * 側に無いエントリだけ足す）、状態は新しい方を採る。
  */
 private mergeProvisionalTasks(provisional:BlackboardTask[]):boolean{
  let merged=false;
  for(const p of provisional){
   const existing=this.tasks.get(p.taskId);
   if(!existing){this.tasks.set(p.taskId,p);merged=true;continue;}
   const known=new Set(existing.entries.map(entry=>entry.id));
   let added=0;
   for(const entry of p.entries){
    if(known.has(entry.id))continue;
    existing.entries.push(entry);added+=1;
   }
   if(added>0){
    merged=true;
    existing.entries.sort((a,b)=>a.createdAt-b.createdAt);
    if(p.updatedAt>existing.updatedAt){existing.status=p.status;existing.updatedAt=p.updatedAt;}
    existing.revision=Math.max(existing.revision,p.revision);
    for(const domain of p.visitedDomains)if(!existing.visitedDomains.includes(domain))existing.visitedDomains.push(domain);
   }
  }
  return merged;
 }
 create(goal:string,source:MikiDomain,payload?:Record<string,unknown>):BlackboardTask{
  const now=Date.now();this.sequence+=1;const taskId=`TASK-${now}-${String(this.sequence).padStart(6,'0')}`;
  const task:BlackboardTask={taskId,title:summarizeTaskTitle(goal,payload),goal:goal.trim(),source,status:'OPEN',revision:1,createdAt:now,updatedAt:now,visitedDomains:[],pendingDomains:[],entries:[],resumeCount:0,lastCycle:0};
  this.tasks.set(taskId,task);if(payload)this.append(taskId,'INPUT',source,'payload',payload);this.save();return this.clone(task);
 }
 post(taskId:string,kind:BlackboardEntryKind,domain:MikiDomain,key:string,value:unknown,evidenceIds:string[]=[]):BlackboardEntry|undefined{
  return this.append(taskId,kind,domain,key,value,evidenceIds);
 }
 append(taskId:string,kind:BlackboardEntryKind,domain:MikiDomain,key:string,value:unknown,evidenceIds:string[]=[]):BlackboardEntry|undefined{
  const task=this.tasks.get(taskId);if(!task)return undefined;this.sequence+=1;
  const entry:BlackboardEntry={id:`BBE-${Date.now()}-${String(this.sequence).padStart(6,'0')}`,taskId,kind,domain,key,value,evidenceIds:[...evidenceIds],createdAt:Date.now()};
  task.entries.push(entry);task.revision+=1;task.updatedAt=Date.now();if(!task.visitedDomains.includes(domain))task.visitedDomains.push(domain);this.save();return {...entry,evidenceIds:[...entry.evidenceIds]};
 }
 appendIfRevision(taskId:string,expectedRevision:number,kind:BlackboardEntryKind,domain:MikiDomain,key:string,value:unknown,evidenceIds:string[]=[]):BlackboardEntry|undefined{const task=this.tasks.get(taskId);if(!task)return undefined;if(task.revision!==expectedRevision)return undefined;this.sequence+=1;const entry:BlackboardEntry={id:`BBE-${Date.now()}-${String(this.sequence).padStart(6,'0')}`,taskId,kind,domain,key,value,evidenceIds:[...evidenceIds],createdAt:Date.now()};task.entries.push(entry);task.revision+=1;task.updatedAt=Date.now();if(!task.visitedDomains.includes(domain))task.visitedDomains.push(domain);this.save();return {...entry,evidenceIds:[...entry.evidenceIds]};}

 setStatus(taskId:string,status:BlackboardStatus):BlackboardTask|undefined{const task=this.tasks.get(taskId);if(!task)return undefined;task.status=status;task.revision+=1;task.updatedAt=Date.now();this.save();return this.clone(task);}

 pause(taskId:string,reason='USER_REQUESTED'):BlackboardTask|undefined{const task=this.tasks.get(taskId);if(!task||task.status==='COMPLETED'||task.status==='CANCELLED')return undefined;task.status='PAUSED';task.pausedReason=reason;task.revision+=1;task.updatedAt=Date.now();this.save();return this.clone(task);}
 resume(taskId:string,allowRoutingRecovery=false):BlackboardTask|undefined{
  const task=this.tasks.get(taskId);
  if(!task)return undefined;
  const paused=task.status==='PAUSED';
  const routingRecovery=allowRoutingRecovery&&task.status==='ROUTING';
  if(!paused&&!routingRecovery)return undefined;
  task.status='ROUTING';
  task.pausedReason=undefined;
  task.resumeCount+=1;
  task.revision+=1;
  task.updatedAt=Date.now();
  this.reallocateBackgroundBudgetWindow(taskId,'TASK_RESUMED');
  this.save();
  return this.clone(task);
 }
 cancel(taskId:string):BlackboardTask|undefined{const task=this.tasks.get(taskId);if(!task||task.status==='COMPLETED')return undefined;task.status='CANCELLED';task.pendingDomains=[];task.revision+=1;task.updatedAt=Date.now();this.save();return this.clone(task);}
 setCycle(taskId:string,cycle:number):void{const task=this.tasks.get(taskId);if(!task)return;task.lastCycle=cycle;task.updatedAt=Date.now();this.save();}
 setPending(taskId:string,domains:MikiDomain[]):void{const task=this.tasks.get(taskId);if(!task)return;task.pendingDomains=[...new Set(domains)];task.updatedAt=Date.now();this.save();}
 reallocateBackgroundBudgetWindow(taskId:string,reason:string):void{
  const task=this.tasks.get(taskId);
  if(!task)return;
  this.sequence+=1;
  const now=Date.now();
  task.entries.push({
   id:`BBE-${now}-${String(this.sequence).padStart(6,'0')}`,
   taskId:task.taskId,
   kind:'CHECKPOINT',
   domain:'core',
   key:`backgroundBudgetReallocated:${task.resumeCount}`,
   value:{
    reason,
    resumeCount:task.resumeCount,
    reallocatedAt:now,
    reallocationPolicy:'RESET_BACKGROUND_BUDGET_WINDOW'
   },
   evidenceIds:[],
   createdAt:now
  });
  task.revision+=1;
  task.updatedAt=now;
 }
 backgroundBudgetCycle(taskId:string):number {
  const task=this.tasks.get(taskId);if(!task)return 0;
  const markers=task.entries.filter(entry=>entry.kind==='CHECKPOINT'&&entry.key.startsWith('backgroundBudgetReallocated:'));
  const lastMarker=markers.at(-1);
  const markerAt=lastMarker?.createdAt||task.createdAt;
  return task.entries.filter(entry=>entry.kind==='CHECKPOINT'&&entry.key.startsWith('backgroundBudgetCycle:')&&entry.createdAt>=markerAt).length+1;
 }
 backgroundBudgetWindowStartedAt(taskId:string):number {
  const task=this.tasks.get(taskId);if(!task)return Date.now();
  const markers=task.entries.filter(entry=>entry.kind==='CHECKPOINT'&&entry.key.startsWith('backgroundBudgetReallocated:'));
  return markers.at(-1)?.createdAt||task.createdAt;
 }
 resumePausedBackgroundAfterForeground():string[]{
  if(this.hasActiveForegroundTask(''))return [];
  const resumed:string[]=[];
  for(const task of this.tasks.values()){
   if(task.status!=='PAUSED'||task.pausedReason!=='FOREGROUND_USER_REQUEST_ACTIVE')continue;
   task.status='ROUTING';task.pausedReason=undefined;task.resumeCount+=1;task.revision+=1;task.updatedAt=Date.now();
   this.reallocateBackgroundBudgetWindow(task.taskId,'FOREGROUND_USER_REQUEST_COMPLETED');

   resumed.push(task.taskId);
  }
  if(resumed.length)this.save();
  return resumed;
 }
 pauseBackgroundTasksForForeground(foregroundTaskId:string):string[]{
  const paused:string[]=[];
  for(const task of this.tasks.values()){
   if(task.taskId===foregroundTaskId||!['OPEN','ROUTING','WAITING'].includes(task.status))continue;
   const input=task.entries.find(entry=>entry.kind==='INPUT'&&entry.key==='payload')?.value;
   if(!input||typeof input!=='object'||Array.isArray(input))continue;
   const x=input as Record<string,unknown>;
   const isBackground=x.background===true||x.orchestrationMode==='SELF_IMPROVEMENT_WORKER'||x.executionPriority==='BACKGROUND';
   if(!isBackground)continue;
   task.status='PAUSED';
   task.pausedReason='FOREGROUND_USER_REQUEST_ACTIVE';
   task.revision+=1;
   task.updatedAt=Date.now();
   paused.push(task.taskId);
  }
  if(paused.length)this.save();
  return paused;
 }
 hasActiveForegroundTask(excludeTaskId:string):boolean{
  for(const task of this.tasks.values()){
   if(task.taskId===excludeTaskId||!['OPEN','ROUTING','WAITING'].includes(task.status))continue;
   const input=task.entries.find(entry=>entry.kind==='INPUT'&&entry.key==='payload')?.value;
   if(!input||typeof input!=='object'||Array.isArray(input))continue;
   const x=input as Record<string,unknown>;
   const kind=String(x.kind||'');
   const foreground=x.foreground===true||kind==='USER_REQUEST';
   const background=x.background===true||x.orchestrationMode==='SELF_IMPROVEMENT_WORKER'||x.executionPriority==='BACKGROUND';
   if(foreground&&!background)return true;
  }
  return false;
 }
 /**
  * P3036: 終了して猶予を過ぎたタスクを圧縮する（設計は
  * COMPACTION_SUMMARY_KEY のコメント参照）。updatedAt / revision /
  * status には触らない（年齢判定とメトリクスの窓を汚さないため）。
  * 冪等：要約済みのタスクは数に入らない。戻り値は検証・記録用。
  */
 compactTerminalTasks(now=Date.now(),pressure=false):{tasksCompacted:number;entriesBefore:number;entriesAfter:number;bytesBefore:number;bytesAfter:number}{
  const grace=pressure?COMPACT_PRESSURE_GRACE_MS:COMPACT_GRACE_MS;
  let tasksCompacted=0,entriesBefore=0,entriesAfter=0,bytesBefore=0,bytesAfter=0;
  for(const task of this.tasks.values()){
   if(!isTerminalStatus(task.status))continue;
   if(now-task.updatedAt<grace)continue;
   if(task.entries.length<=COMPACT_MIN_ENTRIES)continue;
   if(task.entries.some(entry=>entry.key===COMPACTION_SUMMARY_KEY))continue;
   const beforeBytes=JSON.stringify(task).length;
   const beforeEntries=task.entries.length;
   if(!this.compactTask(task,now))continue;
   tasksCompacted+=1;entriesBefore+=beforeEntries;entriesAfter+=task.entries.length;bytesBefore+=beforeBytes;bytesAfter+=JSON.stringify(task).length;
  }
  return {tasksCompacted,entriesBefore,entriesAfter,bytesBefore,bytesAfter};
 }
 private compactTask(task:BlackboardTask,now:number):boolean{
  const entries=task.entries;
  const unresolvedCount=unresolvedTaskErrors(task).length;
  const verified=isVerifiedTaskOutcome(task);
  const evidenceUnion=[...new Set(entries.flatMap(entry=>entry.evidenceIds).filter(Boolean))];
  const kindCounts:Record<string,number>={};
  for(const entry of entries)kindCounts[entry.kind]=(kindCounts[entry.kind]||0)+1;
  const inputEntry=entries.find(entry=>entry.kind==='INPUT'&&entry.key==='payload');
  const inputRecord=inputEntry?.value&&typeof inputEntry.value==='object'&&!Array.isArray(inputEntry.value)?inputEntry.value as Record<string,unknown>:undefined;
  const inputFlags:Record<string,unknown>={};
  if(inputRecord){
   for(const field of ['kind','background','foreground','orchestrationMode','executionPriority','autonomousKnowledgeGapId','gapId']){
    const scalar=distillScalar(inputRecord[field]);
    if(scalar!==undefined)inputFlags[field]=scalar;
   }
  }
  const summary:BlackboardEntry={
   id:`BBE-COMPACT-${task.taskId}`,
   taskId:task.taskId,
   kind:'RESULT',
   domain:'core',
   key:COMPACTION_SUMMARY_KEY,
   value:{
    compacted:true,
    version:1,
    compactedAt:now,
    outcomeStatus:task.status,
    originalEntryCount:entries.length,
    originalBytes:entries.reduce((sum,entry)=>sum+JSON.stringify(entry).length,0),
    kindCounts,
    cycleCount:task.lastCycle,
    resumeCount:task.resumeCount,
    unresolvedErrorCount:unresolvedCount,
    verifiedOutcome:verified,
    errorKeys:entries.filter(entry=>entry.kind==='ERROR').map(entry=>entry.key).slice(-20),
    resultKeys:entries.filter(entry=>entry.kind==='RESULT').map(entry=>entry.key).slice(-20),
    capabilityRefs:[...new Set(entries.filter(entry=>/capability/i.test(entry.key)).map(entry=>entry.key))].slice(-20),
    decisionIds:entries.filter(entry=>entry.domain==='core'&&entry.kind==='DECISION').map(entry=>entry.id).slice(0,500),
    checkpointCount:kindCounts['CHECKPOINT']||0,
    contributingDomains:[...new Set(entries.filter(entry=>entry.kind==='EVIDENCE'||entry.kind==='CLAIM'||entry.kind==='RESULT').map(entry=>entry.domain))],
    evidenceIdCount:evidenceUnion.length,
    inputFlags,
    firstEntryAt:entries[0]?.createdAt??task.createdAt,
    lastEntryAt:entries.at(-1)?.createdAt??task.updatedAt,
   },
   evidenceIds:evidenceUnion.slice(0,1000),
   createdAt:task.updatedAt,
  };
  const preserved=entries.filter(isPreservedEntry).map(entry=>({...entry,value:distillEntryValue(entry),evidenceIds:[...entry.evidenceIds]}));
  task.entries=[...preserved,summary];
  return true;
 }
 get(taskId:string):BlackboardTask|undefined{const task=this.tasks.get(taskId);return task?this.clone(task):undefined;}
 list(limit=50):BlackboardTask[]{return [...this.tasks.values()].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,limit).map(t=>this.clone(t));}
 private clone(t:BlackboardTask):BlackboardTask{return {...t,visitedDomains:[...t.visitedDomains],pendingDomains:[...t.pendingDomains],entries:t.entries.map(e=>({...e,evidenceIds:[...e.evidenceIds]}))};}
 private save():void{
  // P3037: 権威ある読み込みが済むまでの保存は、provisional な
  // 部分像で実台帳を上書きするため見送る（合体時に改めて保存）。
  if(this.loadPending)return;
  if(this.persistenceBlocked)return;
  // P3034: 保存を短い窓でまとめる（claim 台帳の P499 と同型）。
  // 従来は append・setCycle 等の変更のたびに全タスクを JSON 化
  // して保存しており、台帳が 25MB 級まで育った結果、CORE の
  // サイクルが回る間ずっとメインスレッドの大半を JSON 化が
  // 占有し、会話ターンの着地が数分〜数十分まで遅れていた。
  // メモリ上の Map が正で、永続化だけをバッチ化する。変更が
  // 続く間も SAVE_MAX_WAIT_MS に1回は書き込むため、失われる
  // 変更は最大でその窓の分までに限られる。
  if(this.saveTimer)clearTimeout(this.saveTimer);
  this.saveTimer=setTimeout(()=>this.flushSave(),SAVE_DEBOUNCE_MS);
  if(!this.saveMaxTimer)this.saveMaxTimer=setTimeout(()=>this.flushSave(),SAVE_MAX_WAIT_MS);
 }
 private flushSave():void{
  if(this.saveTimer){clearTimeout(this.saveTimer);this.saveTimer=null;}
  if(this.saveMaxTimer){clearTimeout(this.saveMaxTimer);this.saveMaxTimer=null;}
  if(this.loadPending)return;
  if(this.persistenceBlocked)return;
  const all=[...this.tasks.values()].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,MAX_TASKS);
  let payload=JSON.stringify(all);
  // P3036: 台帳が育ちすぎたら、書く前に圧力モード（猶予30分）で
  // 終了タスクを圧縮してから書き直す。1回の flush で試行は1度だけ。
  if(payload.length>COMPACT_SIZE_TRIGGER_BYTES&&!this.persistenceBlocked){
   const stats=this.compactTerminalTasks(Date.now(),true);
   if(stats.tasksCompacted>0){
    const compacted=[...this.tasks.values()].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,MAX_TASKS);
    payload=JSON.stringify(compacted);
   }
  }
  storageService.setItem(KEY,payload);
 }
 private load():void{
  let raw:string|null=null;
  try{
   raw=storageService.getItem(KEY);
   const all=raw?JSON.parse(raw):[];
   if(!Array.isArray(all))throw new Error('BLACKBOARD_SNAPSHOT_NOT_ARRAY');
   let migrated=false;
   for(const t of all){
    if(!t||typeof t!=='object'||Array.isArray(t)||typeof t.taskId!=='string'||!t.taskId.trim()||!Array.isArray(t.entries))throw new Error('BLACKBOARD_TASK_RECORD_INVALID');
    if(t.entries.some(entry=>!entry||typeof entry!=='object'||Array.isArray(entry)||typeof entry.id!=='string'||typeof entry.kind!=='string'||typeof entry.domain!=='string'||typeof entry.key!=='string'||!Array.isArray(entry.evidenceIds)))throw new Error('BLACKBOARD_ENTRY_RECORD_INVALID');
    const task=t as BlackboardTask;
    if(!task.title||!task.title.trim()){
     const payload=task.entries?.find(
      entry=>entry.kind==='INPUT'&&entry.key==='payload'
     )?.value;
     const payloadObject=
      payload&&typeof payload==='object'&&!Array.isArray(payload)
       ? payload as Record<string,unknown>
       : undefined;
     task.title=summarizeTaskTitle(task.goal,payloadObject);
     migrated=true;
    }
    this.tasks.set(task.taskId,task);
   }
   // P3036: 読み込めた正本に対して、終了タスクの圧縮を起動時に
   // 1回かける。読めなかった（隔離された）場合は save 側の
   // persistenceBlocked が書き込みを止めるので、ここでは何もしない。
   const compacted=this.compactTerminalTasks();
   if(migrated||compacted.tasksCompacted>0)this.save();
  }catch(error){
   this.tasks.clear();
   // Preserve the original bytes before any later save can overwrite the only copy.
   // If storage cannot preserve them, block writes for this process instead.
   let preserved=false;
   if(raw!==null){
    const quarantineBaseKey=`${KEY}_quarantine_v1`;
    const quarantineValue={version:1,sourceKey:KEY,quarantinedAt:Date.now(),reason:String(error instanceof Error?error.message:error).slice(0,500),raw};
    try{
     const existing=storageService.getItem(quarantineBaseKey);
     if(existing){
      const parsed=JSON.parse(existing) as Record<string,unknown>;
      if(parsed.raw===raw)preserved=true;
      else{
       const alternateKey=`${quarantineBaseKey}_${Date.now()}`;
       storageService.setItem(alternateKey,JSON.stringify(quarantineValue));
       const written=storageService.getItem(alternateKey);
       preserved=Boolean(written&&JSON.parse(written).raw===raw);
      }
     }else{
      storageService.setItem(quarantineBaseKey,JSON.stringify(quarantineValue));
      const written=storageService.getItem(quarantineBaseKey);
      preserved=Boolean(written&&JSON.parse(written).raw===raw);
     }
    }catch{preserved=false;}
   }
   this.persistenceBlocked=!preserved;
  }
 }
}
export const taskBlackboardService=new TaskBlackboardService();
