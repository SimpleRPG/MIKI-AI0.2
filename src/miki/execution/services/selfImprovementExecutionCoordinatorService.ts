import { storageService } from '../../../services/storageService';
export type SelfImprovementEntryPoint='GROWTH_GOVERNOR'|'CONTINUOUS_EVOLUTION'|'CONTINUOUS_BATCH'|'SELF_CODE_ARCHITECT'|'SELF_CODE_BATCH';
export interface SelfImprovementExecutionContext { runId:string; rootEntryPoint:SelfImprovementEntryPoint; owner:string; startedAt:number; maxCycles:number; }
interface ExecutionState extends SelfImprovementExecutionContext { status:'RUNNING'|'COMPLETED'|'FAILED'; depth:number; heartbeatAt:number; lastError?:string; }
const KEY='miki_self_improvement_execution_v2';
const SEQ='miki_self_improvement_execution_sequence_v1';
class SelfImprovementExecutionCoordinatorService {
 private active?:ExecutionState;
 constructor(){this.recoverAbandoned();}
 async runExclusive<T>(entryPoint:SelfImprovementEntryPoint,operation:(context:SelfImprovementExecutionContext)=>Promise<T>,context?:SelfImprovementExecutionContext,maxCycles=1):Promise<T>{
  if(context){if(!this.active||this.active.runId!==context.runId)throw new Error('SELF_IMPROVEMENT_CONTEXT_MISMATCH');this.active.depth+=1;this.touch();try{return await operation(context);}finally{if(this.active?.runId===context.runId){this.active.depth=Math.max(1,this.active.depth-1);this.touch();}}}
  if(this.active?.status==='RUNNING')throw new Error(`SELF_IMPROVEMENT_REENTRY_BLOCKED:${this.active.runId}:${this.active.rootEntryPoint}`);
  const now=Date.now();const sequence=this.nextSequence();const created:SelfImprovementExecutionContext={runId:`sir_${now}_${String(sequence).padStart(8,'0')}`,rootEntryPoint:entryPoint,owner:entryPoint,startedAt:now,maxCycles:Math.max(1,maxCycles)};
  this.active={...created,status:'RUNNING',depth:1,heartbeatAt:now};this.save();
  try{const result=await operation(created);if(this.active?.runId===created.runId){this.active.status='COMPLETED';this.active.heartbeatAt=Date.now();this.save();this.active=undefined;}return result;}
  catch(error){if(this.active?.runId===created.runId){this.active.status='FAILED';this.active.lastError=String(error);this.active.heartbeatAt=Date.now();this.save();this.active=undefined;}throw error;}
 }
 getActive(){return this.active?{...this.active}:undefined;}
 private nextSequence(){const current=Number(storageService.getItem(SEQ)||'0');const next=Number.isFinite(current)&&current>=0?current+1:1;storageService.setItem(SEQ,String(next));return next;}
 private touch(){if(this.active){this.active.heartbeatAt=Date.now();this.save();}}
 private recoverAbandoned(){try{const raw=storageService.getItem(KEY);if(!raw)return;const saved=JSON.parse(raw) as ExecutionState;if(saved.status==='RUNNING'){saved.status='FAILED';saved.lastError='ABANDONED_PROCESS_RESTART';saved.heartbeatAt=Date.now();storageService.setItem(KEY,JSON.stringify(saved));}}catch(error){console.error('[SelfImprovementCoordinator] recovery failed',error);}}
 private save(){if(this.active)storageService.setItem(KEY,JSON.stringify(this.active));}
}
export const selfImprovementExecutionCoordinatorService=new SelfImprovementExecutionCoordinatorService();
