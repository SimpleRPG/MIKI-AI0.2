import { taskBlackboardService } from './taskBlackboardService';
import { corePlanRevisionService } from './corePlanRevisionService';
import { coreResultService } from './coreResultService';
import { reviewZipExportService } from './reviewZipExportService';

export type PriorityOneAllowedAction='WAIT'|'RETRY'|'REPLAN'|'REGENERATE_CANDIDATE'|'IMPORT_FEEDBACK'|'RECOVER'|'NONE';
export interface PriorityOneRuntimeItem {taskId:string;taskStatus:string;taskRevision:number;updatedAt:number;corePlanRevision?:number;operationInstanceId?:string;operationStatus?:string;packageIds:string[];waitingPackageIds:string[];allowedActions:PriorityOneAllowedAction[];stopReasons:string[];}
class PriorityOneRuntimeReadModelService {
 list():PriorityOneRuntimeItem[]{
  const packages=reviewZipExportService.list();
  return taskBlackboardService.list(200).map(task=>{
   const plan=corePlanRevisionService.latest(task);
   const operation=plan?.requiredOperations.find(item=>item.status==='RUNNING')||plan?.requiredOperations.find(item=>item.status==='PENDING'||item.status==='BLOCKED');
   const result=coreResultService.list(200).find(item=>item.result&&typeof item.result==='object'&&(item.result as Record<string,unknown>).taskId===task.taskId);
   const payload=result?.result&&typeof result.result==='object'?result.result as Record<string,unknown>:undefined;
   const taskPackages=packages.filter(item=>item.runId===task.taskId||item.inputs.issueId===task.taskId);
   const waitingPackageIds=taskPackages.filter(item=>item.status==='EXTERNAL_REVIEW_PENDING'||item.status==='READY_FOR_EXTERNAL_REVIEW').map(item=>item.packageId);
   const stopReasons=Array.isArray(payload?.completionReasons)?payload.completionReasons.filter((value):value is string=>typeof value==='string'):[];
   return {taskId:task.taskId,taskStatus:task.status,taskRevision:task.revision,updatedAt:task.updatedAt,corePlanRevision:plan?.planRevision,operationInstanceId:operation?.operationInstanceId,operationStatus:operation?.status,packageIds:taskPackages.map(item=>item.packageId),waitingPackageIds,allowedActions:this.actions(task.status,operation?.status,stopReasons,waitingPackageIds.length>0),stopReasons};
  });
 }
 private actions(taskStatus:string,operationStatus:string|undefined,reasons:string[],hasWaitingPackage:boolean):PriorityOneAllowedAction[]{
  const actions=new Set<PriorityOneAllowedAction>();
  if(hasWaitingPackage)actions.add('IMPORT_FEEDBACK');
  if(reasons.some(reason=>reason.includes('LINEAGE')||reason.includes('EVIDENCE')||reason.includes('RECEIPT')))actions.add('RETRY');
  if(reasons.some(reason=>reason.includes('OPERATION')||reason.includes('DOMAIN')))actions.add('REPLAN');
  if(reasons.some(reason=>reason.includes('CANDIDATE')))actions.add('REGENERATE_CANDIDATE');
  if(taskStatus==='failed'||operationStatus==='FAILED')actions.add('RECOVER');
  if(taskStatus==='waiting'||operationStatus==='BLOCKED')actions.add('WAIT');
  if(actions.size===0)actions.add('NONE');
  return [...actions];
 }
}
export const priorityOneRuntimeReadModelService=new PriorityOneRuntimeReadModelService();
