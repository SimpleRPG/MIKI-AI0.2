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
 setStatus(taskId:string,status:BlackboardStatus):BlackboardTask|undefined{const task=this.tasks.get(taskId);if(!task)return undefined;task.status=status;task.revision+=1;task.updatedAt=Date.now();this.save();return this.clone(task);}

 pause(taskId:string,reason='USER_REQUESTED'):BlackboardTask|undefined{const task=this.tasks.get(taskId);if(!task||task.status==='COMPLETED'||task.status==='CANCELLED')return undefined;task.status='PAUSED';task.pausedReason=reason;task.revision+=1;task.updatedAt=Date.now();this.save();return this.clone(task);}
 resume(taskId:string):BlackboardTask|undefined{const task=this.tasks.get(taskId);if(!task||task.status!=='PAUSED')return undefined;task.status='ROUTING';task.pausedReason=undefined;task.resumeCount+=1;task.revision+=1;task.updatedAt=Date.now();this.save();return this.clone(task);}
 cancel(taskId:string):BlackboardTask|undefined{const task=this.tasks.get(taskId);if(!task||task.status==='COMPLETED')return undefined;task.status='CANCELLED';task.pendingDomains=[];task.revision+=1;task.updatedAt=Date.now();this.save();return this.clone(task);}
 setCycle(taskId:string,cycle:number):void{const task=this.tasks.get(taskId);if(!task)return;task.lastCycle=cycle;task.updatedAt=Date.now();this.save();}
 setPending(taskId:string,domains:MikiDomain[]):void{const task=this.tasks.get(taskId);if(!task)return;task.pendingDomains=[...new Set(domains)];task.updatedAt=Date.now();this.save();}
 get(taskId:string):BlackboardTask|undefined{const task=this.tasks.get(taskId);return task?this.clone(task):undefined;}
 list(limit=50):BlackboardTask[]{return [...this.tasks.values()].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,limit).map(t=>this.clone(t));}
 private clone(t:BlackboardTask):BlackboardTask{return {...t,visitedDomains:[...t.visitedDomains],pendingDomains:[...t.pendingDomains],entries:t.entries.map(e=>({...e,evidenceIds:[...e.evidenceIds]}))};}
 private save():void{const all=[...this.tasks.values()].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,MAX_TASKS);storageService.setItem(KEY,JSON.stringify(all));}
 private load():void{try{const raw=storageService.getItem(KEY);const all=raw?JSON.parse(raw):[];if(Array.isArray(all))for(const t of all)this.tasks.set(t.taskId,t);}catch{this.tasks.clear();}}
}
export const taskBlackboardService=new TaskBlackboardService();
