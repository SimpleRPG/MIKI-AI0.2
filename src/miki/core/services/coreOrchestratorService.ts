import { corePlanRevisionService } from './corePlanRevisionService';
import { coreLineageReadModelService } from './coreLineageReadModelService';
import { domainRouterService } from './domainRouterService';
import { taskBlackboardService, type BlackboardTask } from './taskBlackboardService';
import { adaptiveRoutePlannerService } from './adaptiveRoutePlannerService';
import type { MikiDomain } from './crossDomainCirculationService';
import { negativeKnowledgeService } from './negativeKnowledgeService';
import { plateauDetectorService } from './plateauDetectorService';
import { coreResultService, type CoreResult } from './coreResultService';
import { domainReplyLedgerService } from './domainReplyLedgerService';

export interface CoreOrchestrationResult { task:BlackboardTask; cycles:number; dispatched:number; coreResult?:CoreResult; }

class CoreOrchestratorService {
 async run(goal:string,source:MikiDomain='core',payload:Record<string,unknown>={},maxCycles=18):Promise<CoreOrchestrationResult>{
  const created=taskBlackboardService.create(goal,source,payload);
  const requestId=typeof payload.requestId==='string'?payload.requestId:created.taskId;
  coreResultService.createRequest({
   requestId,
   goal,
   sourceCategory:(source as any)||'core',
   payload,
   interactionId:typeof payload.interactionId==='string'?payload.interactionId:undefined,
   runId:typeof payload.runId==='string'?payload.runId:undefined,
   directiveId:typeof payload.directiveId==='string'?payload.directiveId:undefined,
   createdAt:Date.now()
  });
  taskBlackboardService.append(created.taskId,'DECISION','core','coreAccepted',{goal,source,mode:'CORE_18_DOMAIN_ORCHESTRATION',requestId});
  taskBlackboardService.setStatus(created.taskId,'ROUTING');
  coreResultService.updateStatus(requestId,'processing',{route:['core']});
  return this.continueTask(created.taskId,maxCycles,requestId);
 }
 async resume(taskId:string,maxCycles=18):Promise<CoreOrchestrationResult|undefined>{
  const currentTask=taskBlackboardService.get(taskId);
  const reqId=this.resolveRequestId(currentTask,taskId);
  const resumed=taskBlackboardService.resume(taskId);if(!resumed)return undefined;
  taskBlackboardService.append(taskId,'DECISION','core','coreResumed',{mode:'CORE_18_DOMAIN_ORCHESTRATION',requestId:reqId});
  coreResultService.updateStatus(reqId,'processing',{route:['core']});
  return this.continueTask(taskId,maxCycles,reqId);
 }
 pause(taskId:string,reason?:string){
  const currentTask=taskBlackboardService.get(taskId);
  const reqId=this.resolveRequestId(currentTask,taskId);
  coreResultService.waiting(reqId,{error:reason||'Task paused'});
  return taskBlackboardService.pause(taskId,reason);
 }
 cancel(taskId:string){
  const currentTask=taskBlackboardService.get(taskId);
  const reqId=this.resolveRequestId(currentTask,taskId);
  coreResultService.rejected(reqId,'Task cancelled');
  return taskBlackboardService.cancel(taskId);
 }
 finalizeConversationResponse(taskId:string,response:unknown):CoreOrchestrationResult|undefined{
  const currentTask=taskBlackboardService.get(taskId);
  if(!currentTask)return undefined;
  const reqId=this.resolveRequestId(currentTask,taskId);
  const cycles=currentTask.lastCycle||0;
  const replyRecords=domainReplyLedgerService.listByTask(taskId);
  taskBlackboardService.append(taskId,'RESULT','core','conversationResponseFinalized',{response,finalizedBy:'core',requestId:reqId,cycles,dispatched:replyRecords.length});
  taskBlackboardService.setStatus(taskId,'COMPLETED');
  const finalTask=taskBlackboardService.get(taskId)!;
  const completion=adaptiveRoutePlannerService.assessCompletion(finalTask);
  const payload={...this.buildRuntimeCirculationResult(finalTask,cycles,replyRecords.length,completion.requiredDomains),response,conversationFinalized:true,finalizedBy:'core'};
  const coreResult=coreResultService.complete(reqId,payload,{route:['core'],processedCategories:['conversation']});
  return {task:finalTask,cycles,dispatched:replyRecords.length,coreResult};
 }

 private resolveRequestId(task?:BlackboardTask,fallbackTaskId:string=''):string{
  if(!task)return fallbackTaskId;
  const accepted=task.entries.find(e=>e.key==='coreAccepted');
  if(accepted&&typeof accepted.value==='object'&&accepted.value!==null&&'requestId' in accepted.value){
   const id=(accepted.value as any).requestId;
   if(typeof id==='string'&&id)return id;
  }
  const payloadEntry=task.entries.find(e=>e.key==='payload');
  if(payloadEntry&&typeof payloadEntry.value==='object'&&payloadEntry.value!==null&&'requestId' in payloadEntry.value){
   const id=(payloadEntry.value as any).requestId;
   if(typeof id==='string'&&id)return id;
  }
  return task.taskId||fallbackTaskId;
 }
 private async continueTask(taskId:string,maxCycles:number,reqId:string=taskId):Promise<CoreOrchestrationResult>{
  let dispatched=0;let cycles=taskBlackboardService.get(taskId)?.lastCycle||0;
  while(cycles<Math.max(1,Math.min(maxCycles,100))){
   cycles+=1;taskBlackboardService.setCycle(taskId,cycles);
   const current=taskBlackboardService.get(taskId);if(!current||current.status==='PAUSED'||current.status==='CANCELLED')break;
   taskBlackboardService.append(taskId,'CHECKPOINT','core',`coreCycle:${cycles}`,{revision:current.revision,cycle:cycles});
   const plateau=plateauDetectorService.evaluate(current);
   if(plateau.plateau){
    taskBlackboardService.pause(taskId,plateau.reason);
    coreResultService.waiting(reqId,{error:plateau.reason});
    break;
   }
   const routes=adaptiveRoutePlannerService.plan(current).filter(route=>negativeKnowledgeService.canRetry(route.target,route.command,route.reason));
   taskBlackboardService.append(taskId,'DECISION','core',`corePlan:${cycles}`,routes.map(route=>({target:route.target,command:route.command,reason:route.reason})));
   const proposedRequirements=routes.map(route=>{
    const operationInstanceId=String(route.payload.operationInstanceId||'');
    const dedupeKey=String(route.payload.dedupeKey||`${taskId}:${route.command}`);
    const proposalSha256=String(route.payload.proposalSha256||route.payload.inputHash||dedupeKey);
    return {
      operationInstanceId,operation:route.command,targetDomain:route.target,dedupeKey,
      idempotencyKey:String(route.payload.idempotencyKey||dedupeKey),proposalSha256,
      assessmentDispatchId:String(route.payload.assessmentDispatchId||''),
      assessmentEvidenceIds:Array.isArray(route.payload.assessmentEvidenceIds)?route.payload.assessmentEvidenceIds.map(String):[],
      dependsOn:Array.isArray(route.payload.dependsOn)?route.payload.dependsOn.map(String):[],
      preconditions:Array.isArray(route.payload.preconditions)?route.payload.preconditions.map(String):[],
      priority:Number(route.payload.priority||0),attempt:Number(route.payload.attempt||0),
      status:'PENDING' as const,inputHash:proposalSha256
    };
   }).filter(item=>item.operationInstanceId.length>0);
   if(proposedRequirements.length>0){
    const currentPlanTask=taskBlackboardService.get(taskId)!;
    const plan=corePlanRevisionService.build(currentPlanTask,proposedRequirements);
    if(plan.changed) taskBlackboardService.append(taskId,'DECISION','core',`corePlanRevision:${plan.revision.planRevision}`,{
      ...plan.revision,
      operationInstanceIds:plan.revision.requiredOperations.map(item=>item.operationInstanceId)
    });
    for(const route of routes){
      const required=plan.revision.requiredOperations.find(item=>item.operationInstanceId===String(route.payload.operationInstanceId||''));
      if(required) route.payload={...route.payload,operationInstanceId:required.operationInstanceId,planRevision:plan.revision.planRevision,planSha256:plan.revision.planSha256};
    }
   }
   if(routes.length===0)break;
   taskBlackboardService.setPending(taskId,routes.map(route=>route.target));
   coreResultService.updateStatus(reqId,'processing',{route:routes.map(r=>r.target as any)});
   for(const route of routes){
    const envelope=domainRouterService.create('core',route.target,route.command,{...route.payload,taskId,requestId:reqId},{correlationId:taskId,causationId:taskId,depth:cycles});
    const reply=await domainRouterService.dispatch(envelope);dispatched+=1;
    const operationId=this.readPayloadString(current,'operationId')||this.readPayloadString(current,'operation')||taskId;
    const replyRecord=domainReplyLedgerService.record(taskId,operationId,envelope,reply);
    const operationClass=reply.normalized?.operationClass||'BUSINESS';
    const resultKind=operationClass==='DIAGNOSTIC'?'OBSERVATION':(reply.accepted?'RESULT':'ERROR');
    const proposalKey=typeof route.payload.dedupeKey==='string'?route.payload.dedupeKey:'';
    const operationSucceeded=reply.accepted&&reply.normalized?.status==='SUCCEEDED'&&operationClass==='BUSINESS';
    if(proposalKey&&operationSucceeded)taskBlackboardService.append(taskId,'DECISION','core',`proposedOperationSucceeded:${proposalKey}`,{schemaVersion:1,operation:route.command,dispatchId:envelope.envelopeId,operationClass:'BUSINESS',status:'OPERATION_SUCCEEDED',dedupeKey:proposalKey,completedAt:reply.completedAt});
    taskBlackboardService.append(taskId,resultKind,route.target,`${resultKind==='OBSERVATION'?'domainObservation':'domainResult'}:${route.target}:${route.command}`,{schemaVersion:3,collectedBy:'core',coreCollected:true,sourceDomain:route.target,producerId:'domainRouterService',dispatchId:envelope.envelopeId,replyId:replyRecord.replyId,operation:route.command,operationInstanceId:route.payload.operationInstanceId,planRevision:route.payload.planRevision,planSha256:route.payload.planSha256,operationClass,reply:reply.normalized||reply.error,auditTag:'coreCollected:'},replyRecord.evidenceIds);
    coreResultService.recordCategoryStep(reqId,route.target as any,reply.accepted?'processing':'failed');
    if(!reply.accepted)negativeKnowledgeService.record(route.target,route.command,reply.error||route.reason,['research','strategy','safety']);
   }
   taskBlackboardService.setPending(taskId,[]);
   const reevaluated=taskBlackboardService.get(taskId);if(!reevaluated)break;
   taskBlackboardService.append(taskId,'DECISION','core',`coreReevaluation:${cycles}`,{revision:reevaluated.revision,visitedDomains:[...reevaluated.visitedDomains]});
   const completion=adaptiveRoutePlannerService.assessCompletion(reevaluated);
   taskBlackboardService.append(taskId,'DECISION','core',`coreCompletionAssessment:${cycles}`,completion);
   if(completion.businessCompletion){
    taskBlackboardService.append(taskId,'RESULT','core','coreCompletion',{completedBy:'core',cycle:cycles,failClosed:true,requiredDomains:completion.requiredDomains});
    taskBlackboardService.setStatus(taskId,'COMPLETED');
    break;
   }
  }
  const finalTask=taskBlackboardService.get(taskId)!;
  if(finalTask.status==='ROUTING'){
   const hasError=finalTask.entries.some(entry=>entry.kind==='ERROR');
   const finalStatus=hasError?'FAILED':'WAITING';
   taskBlackboardService.setStatus(taskId,finalStatus);
   const completion=adaptiveRoutePlannerService.assessCompletion(finalTask);
   const waitingResult=this.buildIncompleteCirculationResult(finalTask,cycles,dispatched,completion);
   if(hasError){
    coreResultService.fail(reqId,'Core domain execution encountered errors',{...waitingResult,route:[...finalTask.visitedDomains] as any,processedCategories:[...finalTask.visitedDomains] as any});
   }else{
    coreResultService.waiting(reqId,{...waitingResult,route:[...finalTask.visitedDomains] as any,processedCategories:[...finalTask.visitedDomains] as any});
   }
  }else if(finalTask.status==='COMPLETED'){
   const completion=adaptiveRoutePlannerService.assessCompletion(finalTask);
   if(!completion.businessCompletion){
    taskBlackboardService.setStatus(taskId,'FAILED');
    coreResultService.fail(reqId,`CORE_COMPLETION_GATE_FAILED:${completion.reasons.join('|')}`);
   }else{
    coreResultService.complete(reqId,this.buildRuntimeCirculationResult(finalTask,cycles,dispatched,completion.requiredDomains),{route:[...finalTask.visitedDomains] as any,processedCategories:[...finalTask.visitedDomains] as any});
   }
  }else if(finalTask.status==='PAUSED'){
   coreResultService.waiting(reqId,{error:'Task paused'});
  }else if(finalTask.status==='CANCELLED'){
   coreResultService.rejected(reqId,'Task cancelled');
  }else{
   coreResultService.inconclusive(reqId,'Task ended without definitive status');
  }
  return {task:taskBlackboardService.get(taskId)!,cycles,dispatched,coreResult:coreResultService.get(reqId)};
 }
 private buildIncompleteCirculationResult(task:BlackboardTask,cycles:number,dispatched:number,completion:ReturnType<typeof adaptiveRoutePlannerService.assessCompletion>):Record<string,unknown>{
  const replyRecords=domainReplyLedgerService.listByTask(task.taskId);
  const lastDecision=task.entries.filter(entry=>entry.domain==='core'&&entry.kind==='DECISION').at(-1);
  const lineage=coreLineageReadModelService.verify(task,{replyIds:replyRecords.map(record=>record.replyId),evidenceIds:[...new Set(replyRecords.flatMap(record=>record.evidenceIds))],receiptIds:[...new Set(replyRecords.flatMap(record=>record.receiptIds))],decisionId:lastDecision?.id});
  const plan=corePlanRevisionService.latest(task);
  const currentOperation=plan?.requiredOperations.find(operation=>operation.status==='RUNNING')||plan?.requiredOperations.find(operation=>operation.status==='PENDING'||operation.status==='BLOCKED');
  return {taskId:task.taskId,operationId:this.readPayloadString(task,'operationId')||task.taskId,commandId:this.readPayloadString(task,'commandId'),cycles,dispatched,status:'WAITING',taskRevision:task.revision,corePlanRevision:plan?.planRevision,currentOperationInstanceId:currentOperation?.operationInstanceId,currentBusinessStage:currentOperation?.operation,nextOperationInstanceId:plan?.requiredOperations.find(operation=>operation.status==='PENDING'&&operation.operationInstanceId!==currentOperation?.operationInstanceId)?.operationInstanceId,requiredDomains:completion.requiredDomains,missingDomains:completion.missingDomains,failedDomains:completion.failedDomains,missingReceipts:completion.missingReceipts,missingRequiredOperations:completion.missingRequiredOperations,completionReasons:completion.reasons,replyIds:lineage.verifiedReplyIds,evidenceIds:lineage.verifiedEvidenceIds,persistenceReceiptIds:lineage.verifiedReceiptIds,decisionId:lineage.verifiedDecisionId,lineageVerified:lineage.lineageVerified,rejectedLineageIds:{replyIds:lineage.rejectedReplyIds,evidenceIds:lineage.rejectedEvidenceIds,receiptIds:lineage.rejectedReceiptIds,decisionIds:lineage.rejectedDecisionIds},unknowns:[...new Set(replyRecords.flatMap(record=>record.unknowns))]};
 }
 private buildRuntimeCirculationResult(task:BlackboardTask,cycles:number,dispatched:number,requiredDomains:MikiDomain[]):Record<string,unknown>{
  const replyRecords=domainReplyLedgerService.listByTask(task.taskId);
  const replyIds=replyRecords.map(record=>record.replyId);
  const evidenceIds=[...new Set(replyRecords.flatMap(record=>record.evidenceIds))];
  const persistenceReceiptIds=[...new Set(replyRecords.flatMap(record=>record.receiptIds))];
  const unknowns=[...new Set(replyRecords.flatMap(record=>record.unknowns))];
  const failures=replyRecords.filter(record=>record.failure).map(record=>({replyId:record.replyId,classificationId:record.classificationId,failure:record.failure}));
  const decision=task.entries.filter(entry=>entry.domain==='core'&&entry.kind==='DECISION').at(-1);
  const lineage=coreLineageReadModelService.verify(task,{replyIds,evidenceIds,receiptIds:persistenceReceiptIds,decisionId:decision?.id});
  const plan=corePlanRevisionService.latest(task);
  const currentOperation=plan?.requiredOperations.find(operation=>operation.status==='RUNNING')||plan?.requiredOperations.find(operation=>operation.status==='PENDING'||operation.status==='BLOCKED');
  return {taskId:task.taskId,operationId:this.readPayloadString(task,'operationId')||this.readPayloadString(task,'operation')||task.taskId,commandId:this.readPayloadString(task,'uiCommandId')||this.readPayloadString(task,'commandId'),cycles,dispatched,status:'COMPLETED',taskRevision:task.revision,corePlanRevision:plan?.planRevision,currentOperationInstanceId:currentOperation?.operationInstanceId,currentBusinessStage:currentOperation?.operation,nextOperationInstanceId:plan?.requiredOperations.find(operation=>operation.status==='PENDING'&&operation.operationInstanceId!==currentOperation?.operationInstanceId)?.operationInstanceId,requiredDomains,selectedClassificationIds:[...task.visitedDomains],replyIds:lineage.verifiedReplyIds,evidenceIds:lineage.verifiedEvidenceIds,decisionId:lineage.verifiedDecisionId,persistenceReceiptIds:lineage.verifiedReceiptIds,lineageVerified:lineage.lineageVerified,rejectedLineageIds:{replyIds:lineage.rejectedReplyIds,evidenceIds:lineage.rejectedEvidenceIds,receiptIds:lineage.rejectedReceiptIds,decisionIds:lineage.rejectedDecisionIds},unknowns,failures};
 }
 private readPayloadString(task:BlackboardTask,key:string):string|undefined{
  const payload=task.entries.find(entry=>entry.key==='payload')?.value;
  if(typeof payload!=='object'||payload===null)return undefined;
  const value=(payload as Record<string,unknown>)[key];
  return typeof value==='string'&&value.length>0?value:undefined;
 }
}
export const coreOrchestratorService=new CoreOrchestratorService();
