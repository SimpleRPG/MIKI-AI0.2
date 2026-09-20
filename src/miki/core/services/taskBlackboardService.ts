import { storageService } from '../../../services/storageService';
import type { MikiDomain } from './crossDomainCirculationService';

export type BlackboardStatus='OPEN'|'ROUTING'|'WAITING'|'PAUSED'|'COMPLETED'|'FAILED'|'CANCELLED';
export type BlackboardEntryKind='INPUT'|'OBSERVATION'|'EVIDENCE'|'CLAIM'|'DECISION'|'RESULT'|'ERROR'|'CHECKPOINT';
export interface BlackboardEntry { id:string; taskId:string; kind:BlackboardEntryKind; domain:MikiDomain; key:string; value:unknown; evidenceIds:string[]; createdAt:number; }
export interface BlackboardTask { taskId:string; goal:string; source:MikiDomain; status:BlackboardStatus; revision:number; createdAt:number; updatedAt:number; visitedDomains:MikiDomain[]; pendingDomains:MikiDomain[]; entries:BlackboardEntry[]; pausedReason?:string; resumeCount:number; lastCycle:number; }
const KEY='miki_task_blackboard_v1';
const MAX_TASKS=200;
class TaskBlackboardService{
 private tasks=new Map<string,BlackboardTask>(); private sequence=0;
 constructor(){this.load();}
 create(goal:string,source:MikiDomain,payload?:Record<string,unknown>):BlackboardTask{
  const now=Date.now();this.sequence+=1;const taskId=`TASK-${now}-${String(this.sequence).padStart(6,'0')}`;
  const task:BlackboardTask={taskId,goal:goal.trim(),source,status:'OPEN',revision:1,createdAt:now,updatedAt:now,visitedDomains:[],pendingDomains:[],entries:[],resumeCount:0,lastCycle:0};
  this.tasks.set(taskId,task);if(payload)this.append(taskId,'INPUT',source,'payload',payload);this.save();return this.clone(task);
 }
 append(taskId:string,kind:BlackboardEntryKind,domain:MikiDomain,key:string,value:unknown,evidenceIds:string[]=[]):BlackboardEntry|undefined{
  const task=this.tasks.get(taskId);if(!task)return undefined;this.sequence+=1;
  const entry:BlackboardEntry={id:`BBE-${Date.now()}-${String(this.sequence).padStart(6,'0')}`,taskId,kind,domain,key,value,evidenceIds:[...evidenceIds],createdAt:Date.now()};
  task.entries.push(entry);task.revision+=1;task.updatedAt=Date.now();if(!task.visitedDomains.includes(domain))task.visitedDomains.push(domain);this.save();return {...entry,evidenceIds:[...entry.evidenceIds]};
 }
 appendIfRevision(taskId:string,expectedRevision:number,kind:BlackboardEntryKind,domain:MikiDomain,key:string,value:unknown,evidenceIds:string[]=[]):BlackboardEntry|undefined{const task=this.tasks.get(taskId);if(!task)return undefined;if(task.revision!==expectedRevision)return undefined;this.sequence+=1;const entry:BlackboardEntry={id:`BBE-${Date.now()}-${String(this.sequence).padStart(6,'0')}`,taskId,kind,domain,key,value,evidenceIds:[...evidenceIds],createdAt:Date.now()};task.entries.push(entry);task.revision+=1;task.updatedAt=Date.now();if(!task.visitedDomains.includes(domain))task.visitedDomains.push(domain);this.save();return {...entry,evidenceIds:[...entry.evidenceIds]};}

 setStatus(taskId:string,status:BlackboardStatus):BlackboardTask|undefined{const task=this.tasks.get(taskId);if(!task)return undefined;task.status=status;task.revision+=1;task.updatedAt=Date.now();this.save();return this.clone(task);}

 pause(taskId:string,reason='USER_REQUESTED'):BlackboardTask|undefined{const task=this.tasks.get(taskId);if(!task||task.status==='COMPLETED'||task.status==='CANCELLED')return undefined;task.status='PAUSED';task.pausedReason=reason;task.revision+=1;task.updatedAt=Date.now();this.save();return this.clone(task);}
 resume(taskId:string):BlackboardTask|undefined{const task=this.tasks.get(taskId);if(!task||task.status!=='PAUSED')return undefined;task.status='ROUTING';task.pausedReason=undefined;task.resumeCount+=1;task.revision+=1;task.updatedAt=Date.now();this.save();return this.clone(task);}
 cancel(taskId:string):BlackboardTask|undefined{const task=this.tasks.get(taskId);if(!task||task.status==='COMPLETED')return undefined;task.status='CANCELLED';task.pendingDomains=[];task.revision+=1;task.updatedAt=Date.now();this.save();return this.clone(task);}
 setCycle(taskId:string,cycle:number):void{const task=this.tasks.get(taskId);if(!task)return;task.lastCycle=cycle;task.updatedAt=Date.now();this.save();}
 setPending(taskId:string,domains:MikiDomain[]):void{const task=this.tasks.get(taskId);if(!task)return;task.pendingDomains=[...new Set(domains)];task.updatedAt=Date.now();this.save();}
 backgroundBudgetCycle(taskId:string):number {
  const task=this.tasks.get(taskId);if(!task)return 0;
  const markers=task.entries.filter(entry=>entry.kind==='CHECKPOINT'&&entry.key.startsWith('backgroundBudgetReallocated:'));
  const lastMarker=markers.at(-1);
  const markerAt=lastMarker?.createdAt||task.createdAt;
  return task.entries.filter(entry=>entry.kind==='CHECKPOINT'&&entry.key.startsWith('backgroundBudgetCycle:')&&entry.createdAt>=markerAt).length+1;
 }
 resumePausedBackgroundAfterForeground():string[]{
  if(this.hasActiveForegroundTask(''))return [];
  const resumed:string[]=[];
  for(const task of this.tasks.values()){
   if(task.status!=='PAUSED'||task.pausedReason!=='FOREGROUND_USER_REQUEST_ACTIVE')continue;
   task.status='ROUTING';task.pausedReason=undefined;task.resumeCount+=1;task.revision+=1;task.updatedAt=Date.now();
   task.entries.push({id:`BBE-${Date.now()}-${String(++this.sequence).padStart(6,'0')}`,taskId:task.taskId,kind:'CHECKPOINT',domain:'core',key:`backgroundBudgetReallocated:${task.resumeCount}`,value:{reason:'FOREGROUND_USER_REQUEST_COMPLETED',resumeCount:task.resumeCount,reallocatedAt:Date.now(),reallocationPolicy:'RESET_BACKGROUND_BUDGET_WINDOW'},evidenceIds:[],createdAt:Date.now()});
   task.revision+=1;
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
 get(taskId:string):BlackboardTask|undefined{const task=this.tasks.get(taskId);return task?this.clone(task):undefined;}
 list(limit=50):BlackboardTask[]{return [...this.tasks.values()].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,limit).map(t=>this.clone(t));}
 private clone(t:BlackboardTask):BlackboardTask{return {...t,visitedDomains:[...t.visitedDomains],pendingDomains:[...t.pendingDomains],entries:t.entries.map(e=>({...e,evidenceIds:[...e.evidenceIds]}))};}
 private save():void{const all=[...this.tasks.values()].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,MAX_TASKS);storageService.setItem(KEY,JSON.stringify(all));}
 private load():void{try{const raw=storageService.getItem(KEY);const all=raw?JSON.parse(raw):[];if(Array.isArray(all))for(const t of all)this.tasks.set(t.taskId,t);}catch{this.tasks.clear();}}
}
export const taskBlackboardService=new TaskBlackboardService();
