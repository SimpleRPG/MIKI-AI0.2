import { storageService } from '../../../services/storageService';
import { selfImprovementIngressService } from './selfImprovementIngressService';
export type ImprovementRunType='AUTONOMOUS_DISCOVERY'|'EXTERNAL_DIRECTIVE'|'USER_REQUEST'|'EXECUTION_FAILURE'|'REVALIDATION';
export type ImprovementIntakeStatus='RECEIVED'|'VALIDATED'|'QUEUED'|'IN_PROGRESS'|'COMPLETED'|'REJECTED';
export interface ImprovementIntakeRun { runId:string; runType:ImprovementRunType; sourceId:string; objective:string; sourceHash:string; payload:Record<string,unknown>; priority:number; status:ImprovementIntakeStatus; createdAt:number; updatedAt:number; taskId?:string; workspaceId?:string; relatedRunIds:string[]; }
const KEY='miki_improvement_intake_runs_v1';
class ImprovementIntakeRouterService{
 private runs=new Map<string,ImprovementIntakeRun>();private sequence=0;constructor(){this.load();}
 async receive(input:{runType:ImprovementRunType;sourceId:string;objective:string;payload?:Record<string,unknown>;priority?:number;relatedRunIds?:string[]}):Promise<ImprovementIntakeRun>{const now=Date.now();this.sequence+=1;const prefix=input.runType==='AUTONOMOUS_DISCOVERY'?'AUTO':input.runType==='EXTERNAL_DIRECTIVE'?'EXT':input.runType==='EXECUTION_FAILURE'?'EXEC':input.runType==='REVALIDATION'?'REVAL':'USER';const sourceHash=await this.sha(JSON.stringify({sourceId:input.sourceId,objective:input.objective,payload:input.payload||{}}));const duplicate=[...this.runs.values()].find(x=>x.runType===input.runType&&x.sourceHash===sourceHash&&x.status!=='COMPLETED'&&x.status!=='REJECTED');if(duplicate)return this.clone(duplicate);const run:ImprovementIntakeRun={runId:`RUN-${prefix}-${now}-${String(this.sequence).padStart(6,'0')}`,runType:input.runType,sourceId:input.sourceId,objective:input.objective.trim(),sourceHash,payload:{...(input.payload||{})},priority:Math.max(0,Math.min(100,input.priority??50)),status:'VALIDATED',createdAt:now,updatedAt:now,relatedRunIds:[...(input.relatedRunIds||[])]};this.runs.set(run.runId,run);const queued=selfImprovementIngressService.submitRun(run);run.status='QUEUED';run.taskId=queued.taskId;run.updatedAt=Date.now();this.save();return this.clone(run);}
 async ensureForCoreTask(input:{taskId:string;objective:string;payload?:Record<string,unknown>;sourceId?:string}):Promise<ImprovementIntakeRun>{
  const existing=[...this.runs.values()].find(run=>run.taskId===input.taskId);
  if(existing)return this.clone(existing);
  const now=Date.now();this.sequence+=1;
  const payload={...(input.payload||{}),taskId:input.taskId};
  const sourceId=input.sourceId||input.taskId;
  const sourceHash=await this.sha(JSON.stringify({sourceId,objective:input.objective,payload}));
  const run:ImprovementIntakeRun={
    runId:`RUN-USER-${now}-${String(this.sequence).padStart(6,'0')}`,
    runType:'USER_REQUEST',sourceId,objective:input.objective.trim(),sourceHash,payload,
    priority:50,status:'IN_PROGRESS',createdAt:now,updatedAt:now,taskId:input.taskId,relatedRunIds:[]
  };
  this.runs.set(run.runId,run);this.save();return this.clone(run);
 }

 update(runId:string,patch:Partial<Pick<ImprovementIntakeRun,'status'|'taskId'|'workspaceId'|'relatedRunIds'>>){const run=this.runs.get(runId);if(!run)return undefined;Object.assign(run,patch,{updatedAt:Date.now()});this.save();return this.clone(run);}
 get(runId:string){const run=this.runs.get(runId);return run?this.clone(run):undefined;}list(limit=200){return [...this.runs.values()].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,limit).map(x=>this.clone(x));}
 private clone(x:ImprovementIntakeRun):ImprovementIntakeRun{return {...x,payload:{...x.payload},relatedRunIds:[...x.relatedRunIds]};}
 private async sha(text:string){const data=new TextEncoder().encode(text);if(typeof crypto!=='undefined'&&crypto.subtle){const hash=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');}let h=2166136261;for(const v of data){h^=v;h=Math.imul(h,16777619);}return `fallback-${(h>>>0).toString(16).padStart(8,'0')}`;}
 private save(){storageService.setItem(KEY,JSON.stringify(this.list(500)));}private load(){try{const raw=storageService.getItem(KEY);const rows=raw?JSON.parse(raw):[];if(Array.isArray(rows))for(const row of rows)this.runs.set(row.runId,row);}catch{this.runs.clear();}}
}
export const improvementIntakeRouterService=new ImprovementIntakeRouterService();
