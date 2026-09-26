import { storageService } from './storageService';
import { componentRegistryService } from './componentRegistryService';
import { failureMemoryService } from './failureMemoryService';
import { componentVersionHistoryService } from './componentVersionHistoryService';
import { systemLogger } from './systemLogger';

export type TaskCaseOutcome = 'SUCCESS'|'FAILURE';
export type TaskCaseMaturity = 'OBSERVED'|'REUSABLE'|'STABLE';
export interface TaskCaseRecord {
  case_id: string; task_id: string; goal: string; environment: string;
  component_ids: string[]; implementation_hashes: Record<string,string>;
  outcome: TaskCaseOutcome; maturity: TaskCaseMaturity;
  request_id?: string; evidence_event_ids: string[]; output_summary?: string; error_message?: string;
  created_at: number; updated_at: number;
}

/** 実行経験を「この要求ならこの構成が有効だった」というケースとして保持する。 */
export class TaskCaseMemoryService {
  private static instance: TaskCaseMemoryService; private records: TaskCaseRecord[]=[]; private initialized=false;
  private readonly storageKey='miki_task_case_memory_v1';
  private constructor(){this.load();}
  public static getInstance(){return this.instance||(this.instance=new TaskCaseMemoryService());}
  public initialize(){if(!this.initialized){this.initialized=true;systemLogger.info('TOOLS','📚 [TaskCaseMemory] initialized');}}
  public dispose(){this.initialized=false;}
  public recordSuccess(input:{taskId:string;goal:string;environment:string;componentIds:string[];hashes:Record<string,string>;requestId?:string;evidenceEventId:string;outputSummary?:string}):TaskCaseRecord|undefined{
    if(!input.componentIds.length) return undefined;
    for(const id of input.componentIds){const c=componentRegistryService.getComponent(id); if(!c||c.status!=='VERIFIED'||c.implementation_hash!==input.hashes[id]||failureMemoryService.shouldAvoid(id,input.environment,input.hashes[id])) return undefined;}
    const prior=this.records.filter(r=>r.outcome==='SUCCESS'&&r.goal.trim().toLowerCase()===input.goal.trim().toLowerCase()&&r.environment===input.environment&&this.same(r.component_ids,input.componentIds));
    const maturity: TaskCaseMaturity = prior.length >= 2 ? 'STABLE' : 'REUSABLE';
    return this.upsert({task_id:input.taskId,goal:input.goal,environment:input.environment,component_ids:[...input.componentIds],implementation_hashes:{...input.hashes},outcome:'SUCCESS',maturity,request_id:input.requestId,evidence_event_ids:[input.evidenceEventId],output_summary:input.outputSummary});
  }
  public recordFailure(input:{taskId:string;goal:string;environment:string;componentId:string;implementationHash:string;requestId?:string;evidenceEventId:string;errorMessage?:string}):TaskCaseRecord {
    return this.upsert({task_id:input.taskId,goal:input.goal,environment:input.environment,component_ids:[input.componentId],implementation_hashes:{[input.componentId]:input.implementationHash},outcome:'FAILURE',maturity:'OBSERVED',request_id:input.requestId,evidence_event_ids:[input.evidenceEventId],error_message:input.errorMessage});
  }
  public findReusable(goal:string, environment?:string):TaskCaseRecord[]{const n=goal.trim().toLowerCase();return this.records.filter(r=>r.outcome==='SUCCESS'&&(!environment||r.environment===environment)&&r.maturity!=='OBSERVED'&&this.match(r.goal,n)&&r.component_ids.every(id=>{const c=componentRegistryService.getComponent(id);return !!c&&c.status==='VERIFIED'&&c.implementation_hash===r.implementation_hashes[id]&&componentVersionHistoryService.isCurrent(id,c.version,r.implementation_hashes[id])&&!failureMemoryService.shouldAvoid(id,r.environment,r.implementation_hashes[id]);})).sort((a,b)=>this.score(b)-this.score(a)||b.updated_at-a.updated_at).slice(0,10);}
  public list(){return [...this.records];}
  private match(goal:string,n:string){const g=goal.toLowerCase();return g===n||g.includes(n)||n.includes(g);}
  private score(r:TaskCaseRecord){return (r.maturity==='STABLE'?300:200)+Math.min(50,r.evidence_event_ids.length*5);}
  private same(a:string[],b:string[]){return a.length===b.length&&a.every((x,i)=>x===b[i]);}
  private upsert(input:Omit<TaskCaseRecord,'case_id'|'created_at'|'updated_at'>){const now=Date.now();const existing=this.records.find(r=>r.task_id===input.task_id&&r.outcome===input.outcome&&this.same(r.component_ids,input.component_ids));if(existing){existing.evidence_event_ids=Array.from(new Set([...existing.evidence_event_ids,...input.evidence_event_ids]));existing.maturity=input.maturity==='STABLE'||existing.maturity==='STABLE'?'STABLE':input.maturity;existing.output_summary=input.output_summary||existing.output_summary;existing.error_message=input.error_message||existing.error_message;existing.updated_at=now;this.save();return existing;}const r={...input,case_id:`CASE-${this.hash(`${input.task_id}|${input.outcome}|${input.evidence_event_ids.join(',')}`)}`,created_at:now,updated_at:now};this.records.unshift(r);this.records=this.records.slice(0,2000);this.save();return r;}
  private load(){try{const raw=storageService.getItem(this.storageKey);if(raw)this.records=JSON.parse(raw);}catch{this.records=[];}}
  private save(){try{storageService.setItem(this.storageKey,JSON.stringify(this.records));}catch{}}
  private hash(raw:string){let h=2166136261;for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
}
export const taskCaseMemoryService=TaskCaseMemoryService.getInstance();
