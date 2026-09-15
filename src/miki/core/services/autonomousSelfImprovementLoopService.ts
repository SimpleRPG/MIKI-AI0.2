import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { adaptiveWorkflowOrchestratorService } from './adaptiveWorkflowOrchestratorService';
import { taskBlackboardService } from './taskBlackboardService';
import { evidenceQualityGateService } from './evidenceQualityGateService';
import { resourceGovernanceService } from '../../safety/services/resourceGovernanceService';
import { candidateCodeGenerationService } from './candidateCodeGenerationService';
import { candidateConstraintValidationService } from './candidateConstraintValidationService';
import { candidateValidationRunnerService } from './candidateValidationRunnerService';
import { reviewZipExportService } from './reviewZipExportService';

export type AutonomousLoopStatus='IDLE'|'RUNNING'|'WAITING_RESOURCE'|'WAITING_EVIDENCE'|'PAUSED'|'FAILED';
export interface AutonomousImprovementRequest { id:string; trigger:string; source:'AUTOPILOT'|'UI'|'EXECUTION'|'SYSTEM'; runId?:string; runType?:string; sourceId?:string; priority?:number; payload?:Record<string,unknown>; createdAt:number; attempts:number; taskId?:string; }
export interface AutonomousLoopState { status:AutonomousLoopStatus; queue:AutonomousImprovementRequest[]; activeRequestId?:string; lastTaskId?:string; lastReason?:string; updatedAt:number; }
const KEY='miki_autonomous_self_improvement_loop_v1';
const MAX_ATTEMPTS=3;
class AutonomousSelfImprovementLoopService{
 private state:AutonomousLoopState={status:'IDLE',queue:[],updatedAt:0};
 private running=false;private sequence=0;
 constructor(){this.load();}
 initialize():void{if(this.state.status==='RUNNING'){this.state.status='PAUSED';this.state.lastReason='APPLICATION_RESTART_RECOVERY';this.save();}void this.drain();}
 enqueueRun(run:{runId:string;runType:string;sourceId:string;objective:string;priority:number;payload:Record<string,unknown>}):AutonomousImprovementRequest{return this.enqueue(run.objective,run.runType==='AUTONOMOUS_DISCOVERY'?'SYSTEM':run.runType==='EXECUTION_FAILURE'?'EXECUTION':'UI',{runId:run.runId,runType:run.runType,sourceId:run.sourceId,priority:run.priority,payload:run.payload});}
 enqueue(trigger:string,source:AutonomousImprovementRequest['source'],meta:Partial<AutonomousImprovementRequest>={}):AutonomousImprovementRequest{
  const duplicate=this.state.queue.find(item=>item.trigger===trigger&&item.source===source);
  if(duplicate)return {...duplicate};
  const now=Date.now();this.sequence+=1;const item:AutonomousImprovementRequest={id:`AIR-${now}-${String(this.sequence).padStart(6,'0')}`,trigger,source,runId:meta.runId,runType:meta.runType,sourceId:meta.sourceId,priority:meta.priority,payload:meta.payload?{...meta.payload}:undefined,createdAt:now,attempts:0};
  this.state.queue.push(item);this.state.updatedAt=now;this.save();void this.drain();return {...item};
 }
 pause(reason='USER_REQUESTED'):void{this.state.status='PAUSED';this.state.lastReason=reason;this.state.updatedAt=Date.now();this.save();if(this.state.lastTaskId)adaptiveWorkflowOrchestratorService.pause(this.state.lastTaskId,reason);}
 resume():void{if(this.state.status!=='PAUSED'&&this.state.status!=='WAITING_RESOURCE'&&this.state.status!=='WAITING_EVIDENCE')return;this.state.status='IDLE';this.state.lastReason=undefined;this.state.updatedAt=Date.now();this.save();void this.drain();}
 getState():AutonomousLoopState{return {...this.state,queue:this.state.queue.map(item=>({...item}))};}
 private async drain():Promise<void>{
  if(this.running||this.state.status==='PAUSED')return;
  this.running=true;
  try{
   while(this.state.queue.length>0){
    if(this.getState().status==='PAUSED')break;
    const request=this.state.queue[0];this.state.activeRequestId=request.id;this.state.status='RUNNING';this.save();
    await resourceGovernanceService.refresh();
    if(!resourceGovernanceService.canRunComponentTests()){this.state.status='WAITING_RESOURCE';this.state.lastReason='RESOURCE_GOVERNANCE_BLOCKED';this.save();break;}
    request.attempts+=1;
    const goal=`自己改善要求を18分類Blackboardで評価・検証し、安全条件を満たす範囲で進める: ${request.trigger}`;
    const result=request.taskId?await adaptiveWorkflowOrchestratorService.resume(request.taskId,18):await adaptiveWorkflowOrchestratorService.run(goal,request.source==='AUTOPILOT'?'autonomy':'core',{trigger:request.trigger,requestId:request.id,runId:request.runId,runType:request.runType,sourceId:request.sourceId,priority:request.priority,...(request.payload||{})},18);
    if(!result){this.failOrRetry(request,'WORKFLOW_RESUME_FAILED');continue;}
    request.taskId=result.task.taskId;this.state.lastTaskId=result.task.taskId;
    if(request.runId){
     const generation=await candidateCodeGenerationService.generate(request.runId);
     if(generation.accepted&&generation.workspaceId){
      const constraints=candidateConstraintValidationService.validate(request.runId,generation.workspaceId);
      if(!constraints.passed){this.state.status='FAILED';this.state.lastReason=constraints.reasons.join(',');this.save();break;}
      const validation=await candidateValidationRunnerService.run(generation.workspaceId);if(!validation.passed){this.state.status='WAITING_EVIDENCE';this.state.lastReason=validation.reasons.join(',')||`VALIDATION_FAILED:${generation.workspaceId}`;this.save();break;}const artifact=await reviewZipExportService.create(request.runId,generation.workspaceId);if(!artifact){this.state.status='WAITING_EVIDENCE';this.state.lastReason=`REVIEW_ZIP_NOT_PROMOTABLE:${generation.workspaceId}`;this.save();break;}this.state.queue.shift();this.state.status='IDLE';this.state.lastReason=`SELF_IMPROVEMENT_COMPLETED:${artifact.fileName}:${artifact.sha256}`;this.save();continue;
     }
     if(generation.reasons.some(reason=>reason.includes('HTTP_')||reason.includes('FAILED'))){this.state.status='WAITING_EVIDENCE';this.state.lastReason=generation.reasons.join(',');this.save();break;}
    }
    const quality=evidenceQualityGateService.evaluate(result.task);
    if(result.task.status==='COMPLETED'&&quality.passed){this.state.queue.shift();this.state.status='IDLE';this.state.lastReason='IMPROVEMENT_CYCLE_COMPLETED';this.save();continue;}
    if(result.task.status==='PAUSED'&&result.task.pausedReason==='NO_PROGRESS_DETECTED'){this.failOrRetry(request,'NO_PROGRESS_DETECTED');continue;}
    if(!quality.passed){this.state.status='WAITING_EVIDENCE';this.state.lastReason=quality.reasons.join(',');this.save();break;}
    this.failOrRetry(request,`WORKFLOW_${result.task.status}`);
   }
   if(this.state.queue.length===0&&this.state.status==='RUNNING'){this.state.status='IDLE';this.state.activeRequestId=undefined;this.save();}
  }catch(error){this.state.status='FAILED';this.state.lastReason=String(error);this.save();systemLogger.warn('SELF_IMPROVEMENT','[AutonomousLoop] cycle failed',String(error));}
  finally{this.running=false;}
 }
 private failOrRetry(request:AutonomousImprovementRequest,reason:string):void{if(request.attempts>=MAX_ATTEMPTS){this.state.queue.shift();this.state.status='FAILED';this.state.lastReason=`${reason}:MAX_ATTEMPTS`;this.save();}else{this.state.status='PAUSED';this.state.lastReason=reason;this.save();}}
 private save():void{this.state.updatedAt=Date.now();storageService.setItem(KEY,JSON.stringify(this.state));}
 private load():void{try{const raw=storageService.getItem(KEY);if(raw)this.state={...this.state,...JSON.parse(raw)};}catch{this.state={status:'IDLE',queue:[],updatedAt:0};}}
}
export const autonomousSelfImprovementLoopService=new AutonomousSelfImprovementLoopService();
