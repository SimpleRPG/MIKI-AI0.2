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
import { resourceGovernanceService } from '../../safety/services/resourceGovernanceService';
import { canonicalSha256Object } from './canonicalSha256Service';
import { executionEnvironmentRouterService } from './executionEnvironmentRouterService';
import { schemaValidationService } from '../../verification/services/schemaValidationService';

export interface CoreOrchestrationResult { task:BlackboardTask; cycles:number; dispatched:number; coreResult?:CoreResult; }

export interface UnifiedCognitiveStateSnapshot {
  schemaVersion:2; taskId:string; cycle:number; revision:number; goal:string; input:string; source:string;
  constraints:string[]; activeDomains:string[]; requiredDomains:string[]; pendingIntentIds:string[]; evidenceIds:string[]; unknowns:string[]; capabilityRefs:string[];
  recentOutcomes:Array<{kind:string;domain:string;key:string;status?:string}>;
  learningCandidates:Array<{domain:string;key:string;valueHash:string}>;
  environmentSignature?:string; invariantsVersion:1; stateHash:string;
}


class CoreOrchestratorService {
 async run(goal:string,source:MikiDomain='core',payload:Record<string,unknown>={},maxCycles=18):Promise<CoreOrchestrationResult>{
  const created=taskBlackboardService.create(goal,source,payload);
  if(payload.kind==='USER_REQUEST' || payload.foreground===true){
   taskBlackboardService.pauseBackgroundTasksForForeground(created.taskId);
  }
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
  let dispatched=0;let cycles=taskBlackboardService.get(taskId)?.lastCycle||0;let cycleBudget=0;const cycleLimit=Math.max(1,Math.min(maxCycles,100));
  while(cycleBudget<cycleLimit){
   cycles+=1;cycleBudget+=1;taskBlackboardService.setCycle(taskId,cycles);
   const currentBeforeState=taskBlackboardService.get(taskId);if(!currentBeforeState||currentBeforeState.status==='PAUSED'||currentBeforeState.status==='CANCELLED')break;
   const currentPayloadEntry=currentBeforeState.entries.find(entry=>entry.kind==='INPUT'&&entry.key==='payload')?.value;
   const currentPayload=currentPayloadEntry&&typeof currentPayloadEntry==='object'&&!Array.isArray(currentPayloadEntry)?currentPayloadEntry as Record<string,unknown>:{ };
   const isBackground=currentPayload.background===true||currentPayload.orchestrationMode==='SELF_IMPROVEMENT_WORKER'||currentPayload.executionPriority==='BACKGROUND';
   if(isBackground&&taskBlackboardService.hasActiveForegroundTask(taskId)){
    taskBlackboardService.pause(taskId,'FOREGROUND_USER_REQUEST_ACTIVE');
    taskBlackboardService.append(taskId,'CHECKPOINT','core',`backgroundBudgetCycle:${cycles}`,{revision:currentBeforeState.revision,cycle:cycles,mode:'FOREGROUND_BLOCKED',replanRequired:true});
    coreResultService.waiting(reqId,{error:'Background task paused for foreground user request'});break;
   }
   if(isBackground){
    const budgetCycle=taskBlackboardService.backgroundBudgetCycle(taskId);
    const budgetCheckedAt=Date.now();
    const resourceSnapshot=resourceGovernanceService.getSnapshot();
    const budget=resourceGovernanceService.assessBackgroundBudget(
      true,
      false,
      budgetCycle,
      currentBeforeState.createdAt,
      budgetCheckedAt
    );

    const budgetDiagnostic={
      schemaVersion:1,
      taskId,
      requestId:reqId,
      cycle:cycles,
      budgetCycle,
      taskCreatedAt:currentBeforeState.createdAt,
      checkedAt:budgetCheckedAt,
      elapsedMs:budget.elapsedMs,
      background:true,
      orchestrationMode:currentPayload.orchestrationMode,
      executionPriority:currentPayload.executionPriority,
      resourceMode:budget.resourceMode,
      quotaBytes:resourceSnapshot.quotaBytes,
      usageBytes:resourceSnapshot.usageBytes,
      freeBytes:resourceSnapshot.freeBytes,
      freeGb:resourceSnapshot.freeGb,
      measuredAt:resourceSnapshot.measuredAt,
      maxCycles:budget.maxCycles,
      maxDurationMs:budget.maxDurationMs,
      reductionRatio:budget.reductionRatio,
      cycleExceeded:budget.cycleExceeded,
      durationExceeded:budget.durationExceeded,
      allowed:budget.allowed,
      reason:budget.reason,
      taskStatusBefore:currentBeforeState.status,
      visitedDomains:currentBeforeState.visitedDomains,
      pendingDomains:currentBeforeState.pendingDomains,
      evidenceIds:[...new Set(currentBeforeState.entries.flatMap(entry=>entry.evidenceIds||[]))],
      unknowns:[...new Set(
        currentBeforeState.entries
          .flatMap(entry=>Array.isArray((entry.value as any)?.unknowns)?(entry.value as any).unknowns:[])
          .filter((value):value is string=>typeof value==='string')
      )],
    };

    taskBlackboardService.append(
      taskId,
      'CHECKPOINT',
      'core',
      `backgroundBudgetDiagnostic:${cycles}`,
      budgetDiagnostic
    );

    if(!budget.allowed){
      const pauseReason=`BACKGROUND_BUDGET:${budget.reason}`;
      taskBlackboardService.pause(taskId,pauseReason);

      const pausedTask=taskBlackboardService.get(taskId);
      taskBlackboardService.append(
        taskId,
        'CHECKPOINT',
        'core',
        `backgroundBudgetPause:${cycles}`,
        {
          ...budgetDiagnostic,
          pauseReason,
          taskStatusAfter:pausedTask?.status,
          pausedAt:Date.now(),
        }
      );

      coreResultService.waiting(reqId,{
        error:`Background task paused by resource budget: ${budget.reason}`,
        budgetDiagnostic,
      });
      break;
    }
   }
   taskBlackboardService.append(taskId,'CHECKPOINT','core',`coreCycle:${cycles}`,{revision:currentBeforeState.revision,cycle:cycles});
   const stateBase=taskBlackboardService.get(taskId)!;
   const rawCognitiveState=this.buildUnifiedCognitiveState(stateBase,cycles);
   const migratedCognitiveState=schemaValidationService.migrateUnifiedCognitiveState(rawCognitiveState);
   if(!migratedCognitiveState.valid||!migratedCognitiveState.data){
    taskBlackboardService.append(taskId,'ERROR','core',`cognitiveStateInvariantFailed:${cycles}`,{schemaVersion:2,errors:migratedCognitiveState.errors,action:'REPLAN'});
    continue;
   }
   const cognitiveState=migratedCognitiveState.data as UnifiedCognitiveStateSnapshot;
   const cognitiveStateEntry=taskBlackboardService.appendIfRevision(taskId,stateBase.revision,'DECISION','core',`cognitiveState:${cycles}`,cognitiveState);

   if(!cognitiveStateEntry){

    taskBlackboardService.append(taskId,'DECISION','core',`cognitiveStateCommitConflict:${cycles}`,{expectedRevision:stateBase.revision,actualRevision:taskBlackboardService.get(taskId)?.revision||0,action:'REPLAN'});

    continue;

   }
   const current=taskBlackboardService.get(taskId)!;
   const plateau=plateauDetectorService.evaluate(current);
   if(plateau.plateau){
    taskBlackboardService.append(taskId,'DECISION','core',`coreCycleGuard:${cycles}`,plateau);
    taskBlackboardService.pause(taskId,plateau.reason);
    coreResultService.waiting(reqId,{error:plateau.reason});
    break;
   }
   const planEnvironment=executionEnvironmentRouterService.capture(this.readEnvironmentHints(current));
   const goalDecision=adaptiveRoutePlannerService.resolveGoalConflicts(current);
   if(goalDecision.conflictDetected){
    taskBlackboardService.append(taskId,'DECISION','core',`goalConflictResolution:${cycles}`,{
      selectedGoalId:goalDecision.selectedGoalId,
      selectedGoal:goalDecision.selectedGoal,
      pausedGoalIds:goalDecision.pausedGoalIds,
      blockedGoalIds:goalDecision.blockedGoalIds,
      decisions:goalDecision.decisions,
      ruleVersion:'V201'
    });
   }
   const planningTask=goalDecision.selectedGoal!==current.goal
     ? {...current,goal:goalDecision.selectedGoal}
     : current;
   const routes=adaptiveRoutePlannerService.plan(planningTask).filter(route=>negativeKnowledgeService.canRetry(route.target,route.command,route.reason));
   for(const route of routes) route.payload={...route.payload,environmentSignature:planEnvironment.signature};
   taskBlackboardService.append(taskId,'DECISION','core',`coreEnvironmentPlan:${cycles}`,planEnvironment);
   taskBlackboardService.append(taskId,'DECISION','core',`corePlan:${cycles}`,routes.map(route=>({target:route.target,command:route.command,reason:route.reason,environmentSignature:route.payload.environmentSignature})));
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
   const dispatchEnvironment=executionEnvironmentRouterService.capture(this.readEnvironmentHints(current));
   const environmentComparison=executionEnvironmentRouterService.compare(planEnvironment,dispatchEnvironment);
   if(environmentComparison.changed){
    const priorDriftCount=current.entries.filter(entry=>entry.kind==='DECISION'&&entry.key==='environmentDriftDetected').length;
    taskBlackboardService.append(taskId,'DECISION','core','environmentDriftDetected',{
      schemaVersion:1,phase:'PLAN_TO_EXECUTION',cycle:cycles,
      plannedSignature:planEnvironment.signature,currentSignature:dispatchEnvironment.signature,
      changedFields:environmentComparison.changedFields,action:'REPLAN',
      priorDriftCount
    });
    if(priorDriftCount>=2){
      taskBlackboardService.pause(taskId,'ENVIRONMENT_DRIFT_REPEATED');
      coreResultService.waiting(reqId,{error:'ENVIRONMENT_DRIFT_REPEATED',result:{changedFields:environmentComparison.changedFields}});
      break;
    }
    taskBlackboardService.append(taskId,'DECISION','core',`coreEnvironmentReplan:${cycles}`,{
      reason:'Environment changed after plan creation; Permission/Safety/Evidence must be reconsidered by the next CORE plan',
      previousSignature:planEnvironment.signature,nextSignature:dispatchEnvironment.signature,
      changedFields:environmentComparison.changedFields
    });
    continue;
   }
   taskBlackboardService.setPending(taskId,routes.map(route=>route.target));
   coreResultService.updateStatus(reqId,'processing',{route:routes.map(r=>r.target as any)});
   for(const route of routes){
    const idempotencyKey=typeof route.payload.idempotencyKey==='string'?route.payload.idempotencyKey.trim():'';
    if(idempotencyKey){
      const prior=domainReplyLedgerService.findSucceededByIdempotencyKey(idempotencyKey);
      if(prior){
        taskBlackboardService.append(taskId,'DECISION','core','actionIdempotencyReused',{
          schemaVersion:1,status:'REUSED_SUCCEEDED',idempotencyKey,reusedFromReplyId:prior.replyId,
          target:route.target,command:route.command,reason:'既に成功した同一Idempotency KeyのActionを再実行せず既存結果を再利用'
        });
        const reusedValue={
          schemaVersion:3,collectedBy:'core',coreCollected:true,sourceDomain:route.target,
          producerId:'domainReplyLedgerService',operation:route.command,
          operationInstanceId:route.payload.operationInstanceId,planRevision:route.payload.planRevision,
          planSha256:route.payload.planSha256,idempotencyKey,
          operationClass:'BUSINESS',status:'SUCCEEDED',
          reply:{status:'SUCCEEDED',operationClass:'BUSINESS',reused:true,reusedFromReplyId:prior.replyId,
            data:{summary:prior.summary,evidenceIds:prior.evidenceIds,receiptIds:prior.receiptIds}}
        };
        taskBlackboardService.append(taskId,'RESULT',route.target,`domainResult:${route.target}:${route.command}`,reusedValue,prior.evidenceIds);
        const proposalKey=typeof route.payload.dedupeKey==='string'?route.payload.dedupeKey:'';
        if(proposalKey)taskBlackboardService.append(taskId,'DECISION','core',`proposedOperationSucceeded:${proposalKey}`,{
          schemaVersion:1,operation:route.command,operationClass:'BUSINESS',status:'OPERATION_SUCCEEDED',
          dedupeKey:proposalKey,idempotencyKey,reusedFromReplyId:prior.replyId,completedAt:prior.completedAt
        });
        continue;
      }
    }
    if(idempotencyKey)taskBlackboardService.append(taskId,'DECISION','core','actionStarted',{
      schemaVersion:1,status:'STARTED',idempotencyKey,target:route.target,command:route.command,
      operationInstanceId:route.payload.operationInstanceId,attempt:route.payload.attempt||0,cycle:cycles
    });
    const envelope=domainRouterService.create('core',route.target,route.command,{...route.payload,taskId,requestId:reqId},{correlationId:taskId,causationId:taskId,depth:cycles});
    const reply=await domainRouterService.dispatch(envelope);dispatched+=1;
    const operationId=this.readPayloadString(current,'operationId')||this.readPayloadString(current,'operation')||taskId;
    const replyRecord=domainReplyLedgerService.record(taskId,operationId,envelope,reply);
    const operationClass=reply.normalized?.operationClass||'BUSINESS';
    const resultKind=operationClass==='DIAGNOSTIC'?'OBSERVATION':(reply.accepted?'RESULT':'ERROR');
    const proposalKey=typeof route.payload.dedupeKey==='string'?route.payload.dedupeKey:'';
    const operationSucceeded=reply.accepted&&reply.normalized?.status==='SUCCEEDED'&&operationClass==='BUSINESS';
    if(typeof route.payload.idempotencyKey==='string'&&route.payload.idempotencyKey)taskBlackboardService.append(taskId,'DECISION','core','actionCompleted',{
      schemaVersion:1,status:operationSucceeded?'SUCCEEDED':'FAILED',idempotencyKey:String(route.payload.idempotencyKey),
      target:route.target,command:route.command,operationInstanceId:route.payload.operationInstanceId,
      replyId:replyRecord.replyId,cycle:cycles
    });
    const expectedRevision=taskBlackboardService.get(taskId)?.revision ?? -1;
    const resultWrite=taskBlackboardService.appendIfRevision(taskId,expectedRevision,resultKind,route.target,`${resultKind==='OBSERVATION'?'domainObservation':'domainResult'}:${route.target}:${route.command}`,{schemaVersion:3,collectedBy:'core',coreCollected:true,sourceDomain:route.target,producerId:'domainRouterService',dispatchId:envelope.envelopeId,replyId:replyRecord.replyId,operation:route.command,operationInstanceId:route.payload.operationInstanceId,planRevision:route.payload.planRevision,intentPlanKey:route.payload.intentPlanKey,intentHypothesisId:route.payload.intentHypothesisId,intentHypothesisKind:route.payload.intentHypothesisKind,intentIds:Array.isArray(route.payload.intentIds)?route.payload.intentIds.map(String):[],planSha256:route.payload.planSha256,idempotencyKey:typeof route.payload.idempotencyKey==='string'?route.payload.idempotencyKey:'',operationClass,reply:reply.normalized||reply.error,auditTag:'coreCollected:'},replyRecord.evidenceIds);
    if(!resultWrite){
      const latest=taskBlackboardService.get(taskId);
      if(latest)taskBlackboardService.append(taskId,'CHECKPOINT','core',`coreRevisionConflict:${cycles}:${route.command}`,{schemaVersion:1,expectedRevision,currentRevision:latest.revision,operationInstanceId:route.payload.operationInstanceId,replyId:replyRecord.replyId,replanRequired:true});
    } else if(proposalKey&&operationSucceeded){
      const proposalRevision=taskBlackboardService.get(taskId)?.revision ?? -1;
      if(!taskBlackboardService.appendIfRevision(taskId,proposalRevision,'DECISION','core',`proposedOperationSucceeded:${proposalKey}`,{schemaVersion:1,operation:route.command,dispatchId:envelope.envelopeId,operationClass:'BUSINESS',status:'OPERATION_SUCCEEDED',dedupeKey:proposalKey,completedAt:reply.completedAt})){
        const latest=taskBlackboardService.get(taskId); if(latest)taskBlackboardService.append(taskId,'CHECKPOINT','core',`coreRevisionConflict:proposal:${cycles}:${route.command}`,{schemaVersion:1,currentRevision:latest.revision,operationInstanceId:route.payload.operationInstanceId,replyId:replyRecord.replyId,replanRequired:true});
      }
    }
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
   const finalStatus=hasError?'FAILED':cycleBudget>=cycleLimit?'PAUSED':'WAITING';
   taskBlackboardService.setStatus(taskId,finalStatus);
   if(finalStatus==='PAUSED') taskBlackboardService.append(taskId,'CHECKPOINT','core','coreCycleBudgetExhausted',{cycle:cycles,cycleBudget,cycleLimit,resumeRequired:true});
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
  return {taskId:task.taskId,operationId:this.readPayloadString(task,'operationId')||this.readPayloadString(task,'operation')||task.taskId,commandId:this.readPayloadString(task,'uiCommandId')||this.readPayloadString(task,'commandId'),cycles,dispatched,status:'COMPLETED',taskRevision:task.revision,corePlanRevision:plan?.planRevision,currentOperationInstanceId:currentOperation?.operationInstanceId,currentBusinessStage:currentOperation?.operation,nextOperationInstanceId:plan?.requiredOperations.find(operation=>operation.status==='PENDING'&&operation.operationInstanceId!==currentOperation?.operationInstanceId)?.operationInstanceId,requiredDomains,selectedClassificationIds:[...task.visitedDomains],replyIds:lineage.verifiedReplyIds,evidenceIds:lineage.verifiedEvidenceIds,decisionId:lineage.verifiedDecisionId,persistenceReceiptIds:lineage.verifiedReceiptIds,lineageVerified:lineage.lineageVerified,rejectedLineageIds:{replyIds:lineage.rejectedReplyIds,evidenceIds:lineage.rejectedEvidenceIds,receiptIds:lineage.rejectedReceiptIds,decisionIds:lineage.rejectedDecisionIds},unknowns,failures,cognitiveState:this.latestUnifiedCognitiveState(task)};
 }
 private readEnvironmentHints(task:BlackboardTask):Record<string,unknown>{
  const value=task.entries.find(entry=>entry.kind==='INPUT'&&entry.key==='payload')?.value;
  return value&&typeof value==='object'&&!Array.isArray(value)
    ? (value as Record<string,unknown>)
    : {};
 }
 private collectUnresolved(task:BlackboardTask,pattern:RegExp):string[] {
  for(const entry of [...task.entries].reverse()){
   if(entry.kind!=="ERROR"&&entry.kind!=="OBSERVATION"&&entry.kind!=="RESULT") continue;
   if(!pattern.test(entry.key)&&!pattern.test(JSON.stringify(entry.value||{}))) continue;
   const value=entry.value&&typeof entry.value==="object"&&!Array.isArray(entry.value)?entry.value as Record<string,unknown>:undefined;
   const values=value?.unresolvedItems??value?.unresolvedRequirements??value?.unknowns;
   if(Array.isArray(values)) return [...new Set(values.filter((item):item is string=>typeof item==="string"&&item.trim()).map(item=>item.trim()))];
  }
  return [];
 }
private collectValues(task:BlackboardTask,pattern:RegExp):string[] {
  const found=new Set<string>();
  for(const entry of task.entries){
   if(!pattern.test(entry.key)&&!pattern.test(JSON.stringify(entry.value||{}))) continue;
   const value=entry.value&&typeof entry.value==='object'&&!Array.isArray(entry.value) ? entry.value as Record<string,unknown> : undefined;
   const values=value?.reusableComponents||value?.componentIds||value?.usedCodeComponentIds||value?.capabilityRefs;
   if(Array.isArray(values)) for(const item of values) if(typeof item==='string'&&item.trim()) found.add(item.trim());
  }
  return [...found];
 }

 private buildUnifiedCognitiveState(task:BlackboardTask,cycle:number):UnifiedCognitiveStateSnapshot{
  const payload=task.entries.find(entry=>entry.kind==='INPUT'&&entry.key==='payload')?.value;
  const payloadObject=payload&&typeof payload==='object'&&!Array.isArray(payload) ? payload as Record<string,unknown> : {};
  const input=typeof payloadObject.input==='string' ? payloadObject.input : typeof payloadObject.text==='string' ? payloadObject.text : task.goal;
  const constraints=[
    ...(Array.isArray(payloadObject.constraints)?payloadObject.constraints:[]),
    ...(Array.isArray(payloadObject.prohibitions)?payloadObject.prohibitions:[]),
    ...(Array.isArray(payloadObject.acceptanceCriteria)?payloadObject.acceptanceCriteria:[]),
  ].filter((value):value is string=>typeof value==='string'&&value.trim().length>0).map(value=>value.trim()).slice(0,40);
  const evidenceIds=[...new Set(task.entries.flatMap(entry=>entry.evidenceIds).filter(Boolean))].slice(-120);
  const unknowns=this.collectUnresolved(task,/unknown|gap|missing|unresolved|blocked/i).slice(0,80);
  const capabilityRefs=this.collectValues(task,/capability|component/i).slice(0,80);
  const recentOutcomes=task.entries.filter(entry=>['RESULT','ERROR','OBSERVATION'].includes(entry.kind)).slice(-40).map(entry=>({
    kind:entry.kind,domain:entry.domain,key:entry.key,
    status:typeof entry.value==='object'&&entry.value!==null&&typeof (entry.value as Record<string,unknown>).status==='string' ? String((entry.value as Record<string,unknown>).status) : undefined
  }));
  const learningCandidates=task.entries.filter(entry=>entry.domain==='learning'||/learning|learn|confidence|knowledge update/i.test(entry.key)).slice(-30).map(entry=>({
    domain:entry.domain,key:entry.key,valueHash:canonicalSha256Object(entry.value)
  }));
  const requiredDomains=Array.isArray(payloadObject.requiredDomains)
    ? payloadObject.requiredDomains.filter((value):value is string=>typeof value==='string'&&value.trim().length>0).slice(0,18)
    : [];
  const intentPlanValue=payloadObject.intentPlan&&typeof payloadObject.intentPlan==='object'&&!Array.isArray(payloadObject.intentPlan) ? payloadObject.intentPlan as Record<string,unknown> : undefined;
  const intentUnits=Array.isArray(intentPlanValue?.units)?intentPlanValue.units.filter((item):item is Record<string,unknown>=>Boolean(item&&typeof item==='object')):[];
  const completedIntentIds=new Set(task.entries.filter(entry=>entry.kind==='RESULT').flatMap(entry=>{ const value=entry.value&&typeof entry.value==='object'&&!Array.isArray(entry.value)?entry.value as Record<string,unknown>:{}; return Array.isArray(value.intentIds)?value.intentIds.filter((x):x is string=>typeof x==='string'):[]; }));
  const pendingIntentIds=intentUnits.map(unit=>typeof unit.id==='string'?unit.id:'').filter(id=>Boolean(id)&&!completedIntentIds.has(id));
  const base={schemaVersion:2 as const,taskId:task.taskId,cycle,revision:task.revision,goal:task.goal,input,source:String(task.source),constraints:[...new Set(constraints)],activeDomains:[...task.visitedDomains],requiredDomains:[...new Set(requiredDomains)],pendingIntentIds:[...new Set(pendingIntentIds)],evidenceIds,unknowns,capabilityRefs,recentOutcomes,learningCandidates,environmentSignature:undefined as string|undefined,invariantsVersion:1 as const};
  return {...base,stateHash:canonicalSha256Object(base)};
 }

 private latestUnifiedCognitiveState(task:BlackboardTask):UnifiedCognitiveStateSnapshot|undefined{
  const entry=[...task.entries].reverse().find(item=>item.kind==='DECISION'&&item.domain==='core'&&item.key.startsWith('cognitiveState:'));
  if(!entry||!entry.value||typeof entry.value!=='object') return undefined;
  const value=entry.value as UnifiedCognitiveStateSnapshot;
  return value.schemaVersion===2&&typeof value.stateHash==='string' ? value : undefined;
 }

 private readPayloadString(task:BlackboardTask,key:string):string|undefined{
  const payload=task.entries.find(entry=>entry.key==='payload')?.value;
  if(typeof payload!=='object'||payload===null)return undefined;
  const value=(payload as Record<string,unknown>)[key];
  return typeof value==='string'&&value.length>0?value:undefined;
 }
}
export const coreOrchestratorService=new CoreOrchestratorService();
