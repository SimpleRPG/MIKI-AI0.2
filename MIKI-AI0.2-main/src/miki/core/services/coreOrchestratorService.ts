import { corePlanRevisionService } from './corePlanRevisionService';
import { coreLineageReadModelService } from './coreLineageReadModelService';
import { domainRouterService } from './domainRouterService';
import { taskBlackboardService, type BlackboardTask } from './taskBlackboardService';
import { adaptiveRoutePlannerService } from './adaptiveRoutePlannerService';
import { improvementIntakeRouterService } from './improvementIntakeRouterService';
import type { MikiDomain } from './crossDomainCirculationService';
import { negativeKnowledgeService } from './negativeKnowledgeService';
import { plateauDetectorService } from './plateauDetectorService';
import { coreResultService, type CoreResult } from './coreResultService';
import { domainReplyLedgerService } from './domainReplyLedgerService';
import { resourceGovernanceService } from '../../safety/services/resourceGovernanceService';
import { canonicalSha256Object } from './canonicalSha256Service';
import { executionEnvironmentRouterService } from './executionEnvironmentRouterService';
import { schemaValidationService } from '../../verification/services/schemaValidationService';
import { githubSyncService } from '../../../services/githubSyncService';
import { sha256HexFromText } from './canonicalSha256Service';
import { coreExecutionTraceService } from './coreExecutionTraceService';
import { universalSynthesisService } from './universalSynthesisService';
import { longTermMemoryService } from '../../memory/services/longTermMemoryService';
import { storageService } from '../../../services/storageService';

export interface CoreOrchestrationResult { task:BlackboardTask; cycles:number; dispatched:number; coreResult?:CoreResult; }

export interface UnifiedCognitiveStateSnapshot {
  schemaVersion:2; taskId:string; cycle:number; revision:number; goal:string; input:string; source:string;
  constraints:string[]; activeDomains:string[]; requiredDomains:string[]; pendingIntentIds:string[]; evidenceIds:string[]; unknowns:string[]; capabilityRefs:string[];
  recentOutcomes:Array<{kind:string;domain:string;key:string;status?:string}>;
  learningCandidates:Array<{domain:string;key:string;valueHash:string}>;
  environmentSignature?:string; invariantsVersion:1; stateHash:string;
}

const DIAGNOSTIC_COMMANDS=new Set(['ASSESS_DOMAIN','HEALTH_CHECK','DESCRIBE','GET_STATUS','PARTICIPATE','VERIFY_CONNECTION','DISCOVER_IMPROVEMENT_ISSUE','RUN_SELF_IMPROVEMENT']);

class CoreOrchestratorService {
 async run(goal:string,source:MikiDomain='core',payload:Record<string,unknown>={},maxCycles=18):Promise<CoreOrchestrationResult>{
  const created=taskBlackboardService.create(goal,source,payload);
  coreExecutionTraceService.record(created.taskId,0,'RUN_START',{
    goal,
    source,
    payloadKind:payload.kind,
    requestId:payload.requestId,
    runId:payload.runId,
    foreground:payload.foreground,
    background:payload.background,
    orchestrationMode:payload.orchestrationMode,
    executionPriority:payload.executionPriority
  });
  if(payload.kind==='USER_REQUEST' || payload.foreground===true){
   taskBlackboardService.pauseBackgroundTasksForForeground(created.taskId);
  }
  // CORE owns the self-improvement run identity.
  // Candidate preparation requires a real ImprovementIntakeRun.
  if(payload.kind==='SELF_IMPROVEMENT'){
   const existingRunId=String(payload.runId||'').trim();
   const existingRun=existingRunId
    ? improvementIntakeRouterService.get(existingRunId)
    : undefined;

   if(existingRun){
    improvementIntakeRouterService.update(existingRun.runId,{taskId:created.taskId});
    taskBlackboardService.append(
     created.taskId,
     'DECISION',
     'core',
     'coreSelfImprovementRun',
     {
      runId:existingRun.runId,
      runType:existingRun.runType,
      sourceId:existingRun.sourceId,
      status:existingRun.status,
      linkedBy:'CORE'
     }
    );
   }else{
    const run=await improvementIntakeRouterService.ensureForCoreTask({
     taskId:created.taskId,
     objective:goal,
     payload,
     sourceId:typeof payload.sourceId==='string'
      ? payload.sourceId
      : created.taskId
    });

    taskBlackboardService.append(
     created.taskId,
     'DECISION',
     'core',
     'coreSelfImprovementRun',
     {
      runId:run.runId,
      runType:run.runType,
      sourceId:run.sourceId,
      status:run.status,
      linkedBy:'CORE'
     }
    );
   }
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
 async resumeFromExecutionEvent(taskId:string,maxCycles=18):Promise<CoreOrchestrationResult|undefined>{
  const currentTask=taskBlackboardService.get(taskId);
  if(!currentTask)return undefined;
  if(currentTask.status==='COMPLETED'||currentTask.status==='CANCELLED')return undefined;
  const reqId=this.resolveRequestId(currentTask,taskId);
  taskBlackboardService.setStatus(taskId,'ROUTING');
  taskBlackboardService.append(taskId,'DECISION','core','coreExecutionEventResumed',{
    mode:'CORE_18_DOMAIN_ORCHESTRATION',
    requestId:reqId,
    source:'executionEvent'
  });
  coreResultService.updateStatus(reqId,'processing',{route:['core','execution']});
  return this.continueTask(taskId,maxCycles,reqId);
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

 private async buildSynthesisContext(
  task:BlackboardTask,
  payload:Record<string,unknown>
 ):Promise<NonNullable<Parameters<typeof universalSynthesisService.synthesize>[0]['synthesisContext']>>{
  const evidenceRefs=new Set<string>();
  const knowledgeRefs=new Set<string>();
  const memoryRefs=new Set<string>();
  const experienceRefs=new Set<string>();
  const failureExperienceRefs=new Set<string>();
  const verificationRefs=new Set<string>();
  const recentDecisions:string[]=[];
  const unresolvedRefs:string[]=[];
  const semanticContext:string[]=[];

  for(const entry of task.entries){
    for(const id of entry.evidenceIds||[]) evidenceRefs.add(String(id));

    const key=String(entry.key||'').toLowerCase();
    const value=entry.value;

    const category =
      /knowledge|research|unknown|claim/.test(key)
        ? 'KNOWLEDGE'
        : /memory/.test(key)
          ? 'MEMORY'
          : /experience|learning|episode|pattern/.test(key)
            ? 'EXPERIENCE'
            : /failure|negative|error/.test(key)||entry.kind==='ERROR'
              ? 'FAILURE_EXPERIENCE'
              : /verif|validation|audit|check/.test(key)
                ? 'VERIFICATION'
                : entry.kind==='DECISION'
                  ? 'DECISION'
                  : '';

    if(category==='KNOWLEDGE') {
      knowledgeRefs.add(entry.id);
    }
    if(category==='MEMORY') {
      memoryRefs.add(entry.id);
    }
    if(category==='EXPERIENCE') {
      experienceRefs.add(entry.id);
    }
    if(category==='FAILURE_EXPERIENCE') {
      failureExperienceRefs.add(entry.id);
    }
    if(category==='VERIFICATION') {
      verificationRefs.add(entry.id);
    }

    if(category){
      let serialized='';
      try {
        serialized=JSON.stringify(value);
      } catch {
        serialized=String(value ?? '');
      }

      semanticContext.push(
        `${category}|domain=${entry.domain}|kind=${entry.kind}|key=${entry.key}|value=${serialized}`
      );
    }
    if(entry.kind==='DECISION') {
      recentDecisions.push(entry.key);
    }

    if(entry.kind==='ERROR' || /unresolved|unknown|missing|blocked/.test(key)){
      unresolvedRefs.push(entry.id);
      if(typeof value==='object'&&value!==null){
        const v=value as Record<string,unknown>;
        if(Array.isArray(v.unresolved)){
          for(const item of v.unresolved.slice(0,12)){
            unresolvedRefs.push(String(item));
          }
        }
      }
    }
  }

  const recallQuery = [
    task.goal,
    typeof payload.input === 'string' ? payload.input : '',
    ...semanticContext.slice(-24),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (recallQuery) {
    try {
      const memories = storageService.getMemories();
      const recalledMemories = new Map<string, { memory: typeof memories[number]; score: number }>();
      const recalledExcerpts = new Map<string, { sourceRef?: string; rawExcerpt?: string }>();

      const collectRecall = (result: Awaited<ReturnType<typeof longTermMemoryService.searchPipeline>>) => {
        for (const hit of result.scoredMemories) {
          const memoryId = String(hit.memory.id);
          const prior = recalledMemories.get(memoryId);
          if (!prior || Number(hit.score) > prior.score) {
            recalledMemories.set(memoryId, {
              memory: hit.memory,
              score: Number(hit.score),
            });
          }
        }

        for (const excerpt of result.retrievedRawExcerpts) {
          const memoryId = String(excerpt.memoryId);
          if (!recalledExcerpts.has(memoryId)) {
            recalledExcerpts.set(memoryId, {
              sourceRef: String(excerpt.sourceRef || ''),
              rawExcerpt: String(excerpt.rawExcerpt || ''),
            });
          }
        }
      };

      const initialRecall = await longTermMemoryService.searchPipeline(
        recallQuery,
        memories,
        null,
        [],
        {
          limit:12,
          onlyApprovedForFacts:false,
          minScoreThreshold:6.0,
        }
      );

      collectRecall(initialRecall);

      let additionalRecallPerformed = false;

      if (initialRecall.scoredMemories.length > 0) {
        const relatedHints = initialRecall.scoredMemories
          .flatMap((hit) =>
            Array.isArray(hit.memory.semanticKeywords)
              ? hit.memory.semanticKeywords.map(String)
              : []
          )
          .filter(Boolean);

        const relatedRecallQuery = [
          task.goal,
          typeof payload.input === 'string' ? payload.input : '',
          ...relatedHints,
          ...unresolvedRefs.slice(-8),
        ]
          .filter(Boolean)
          .join(' ')
          .trim();

        if (relatedRecallQuery && relatedRecallQuery !== recallQuery) {
          const relatedRecall = await longTermMemoryService.searchPipeline(
            relatedRecallQuery,
            memories,
            null,
            [],
            {
              limit:12,
              onlyApprovedForFacts:false,
              minScoreThreshold:6.0,
            }
          );

          collectRecall(relatedRecall);
          additionalRecallPerformed = true;
        }
      }

      for (const hit of recalledMemories.values()) {
        memoryRefs.add(String(hit.memory.id));
        const memoryLifecycle=String(hit.memory.lifecycleStatus||'');
        const memoryApproved=String(hit.memory.approved===true);
        const memoryVerificationStatus=String(hit.memory.verificationStatus||(
          hit.memory.approved===true ? 'VERIFIED' : 'UNVERIFIED'
        ));
        const memoryEvidenceIds=Array.isArray(hit.memory.evidenceIds)
          ? hit.memory.evidenceIds.map(String).filter(Boolean).slice(0,24).join(',')
          : '';
        const memoryClaimIds=Array.isArray(hit.memory.claimIds)
          ? hit.memory.claimIds.map(String).filter(Boolean).slice(0,24).join(',')
          : '';
        semanticContext.push(
          `MEMORY_RECALL|memoryId=${hit.memory.id}|score=${hit.score}|lifecycleStatus=${memoryLifecycle}|approved=${memoryApproved}|verificationStatus=${memoryVerificationStatus}|sourceRef=${String(hit.memory.sourceRef||'')}|researchGapId=${String(hit.memory.researchGapId||'')}|evidenceIds=${memoryEvidenceIds}|claimIds=${memoryClaimIds}|content=${String(hit.memory.content||'')}`
        );
      }

      for (const [memoryId, excerpt] of recalledExcerpts) {
        semanticContext.push(
          `MEMORY_EVIDENCE|memoryId=${memoryId}|sourceRef=${String(excerpt.sourceRef||'')}|excerpt=${String(excerpt.rawExcerpt||'')}`
        );
      }

      const recallStatus =
        memories.length === 0
          ? 'NO_PERSISTED_MEMORY'
          : recalledMemories.size === 0
            ? 'CONTEXT_INSUFFICIENT'
            : 'SUFFICIENT';

      semanticContext.push(
        `MEMORY_RECALL_CHECK|status=${recallStatus}|initialHits=${initialRecall.scoredMemories.length}|mergedHits=${recalledMemories.size}|additionalRecall=${additionalRecallPerformed}|queryHash=${sha256HexFromText(recallQuery)}`
      );

      if (recallStatus === 'CONTEXT_INSUFFICIENT') {
        unresolvedRefs.push('CONTEXT_INSUFFICIENT:long-term-memory');

        taskBlackboardService.append(
          task.taskId,
          'DECISION',
          'core',
          `coreMemoryRecallCheck:${task.lastCycle}:${sha256HexFromText(recallQuery)}`,
          {
            schemaVersion:1,
            status:'CONTEXT_INSUFFICIENT',
            recallQueryHash:sha256HexFromText(recallQuery),
            initialHits:initialRecall.scoredMemories.length,
            mergedHits:recalledMemories.size,
            additionalRecall:additionalRecallPerformed,
            reason:'CORE long-term memory recall remained insufficient after initial and related-memory retrieval'
          }
        );
      } else {
        taskBlackboardService.append(
          task.taskId,
          'DECISION',
          'core',
          `coreMemoryRecallCheck:${task.lastCycle}:${sha256HexFromText(recallQuery)}`,
          {
            schemaVersion:1,
            status:recallStatus,
            recallQueryHash:sha256HexFromText(recallQuery),
            initialHits:initialRecall.scoredMemories.length,
            mergedHits:recalledMemories.size,
            additionalRecall:additionalRecallPerformed,
            reason:'CORE long-term memory recall completed'
          }
        );
      }
    } catch (error) {
      unresolvedRefs.push(
        `memory-recall-error:${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    currentState:[
      `status=${task.status}`,
      `revision=${task.revision}`,
      `cycle=${task.lastCycle}`,
      `resumeCount=${task.resumeCount}`,
      `goal=${task.goal}`,
      `operation=${String(payload.operation||payload.command||'')}`,
    ].join('|'),
    visitedDomains:[...task.visitedDomains].map(String),
    pendingDomains:[...task.pendingDomains].map(String),
    evidenceRefs:[...evidenceRefs].slice(-80),
    knowledgeRefs:[...knowledgeRefs].slice(-40),
    memoryRefs:[...memoryRefs].slice(-40),
    experienceRefs:[...experienceRefs].slice(-40),
    failureExperienceRefs:[...failureExperienceRefs].slice(-40),
    verificationRefs:[...verificationRefs].slice(-40),
    recentDecisions:[...new Set(recentDecisions)].slice(-40),
    unresolvedRefs:[...new Set(unresolvedRefs)],
    semanticContext,
    validatedCandidate:
      payload.validatedCandidate &&
      typeof payload.validatedCandidate === 'object' &&
      !Array.isArray(payload.validatedCandidate)
        ? payload.validatedCandidate as Record<string, unknown>
        : undefined,
    validationResult:
      payload.validationResult &&
      typeof payload.validationResult === 'object' &&
      !Array.isArray(payload.validationResult)
        ? payload.validationResult as Record<string, unknown>
        : undefined,
    priorSynthesisId:
      typeof payload.priorSynthesisId === 'string'
        ? payload.priorSynthesisId
        : undefined,
  };
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
 private async assessCoreMemoryContext(
  task:BlackboardTask,
  payload:Record<string,unknown>,
  cycle:number
 ):Promise<void>{
  const memories=storageService.getMemories();
  const decisionHints=task.entries
    .filter(entry=>entry.kind==='DECISION')
    .slice(-12)
    .map(entry=>String(entry.key||''))
    .filter(Boolean);

  const unresolvedHints=this.collectUnresolved(
    task,
    /unknown|gap|missing|unresolved|blocked/i
  ).slice(-12);

  const recallQuery=[
    task.goal,
    typeof payload.input==='string' ? payload.input : '',
    ...decisionHints,
    ...unresolvedHints,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  if(!recallQuery){
    taskBlackboardService.append(
      task.taskId,
      'DECISION',
      'core',
      `coreMemoryContextAssessment:${cycle}`,
      {
        schemaVersion:1,
        status:'NO_RECALL_QUERY',
        cycle,
        reason:'CORE could not construct a persistent-memory recall query from the current task context'
      }
    );
    return;
  }

  if(memories.length===0){
    taskBlackboardService.append(
      task.taskId,
      'DECISION',
      'core',
      `coreMemoryContextAssessment:${cycle}`,
      {
        schemaVersion:1,
        status:'NO_PERSISTED_MEMORY',
        cycle,
        queryHash:sha256HexFromText(recallQuery),
        reason:'No persisted long-term memories are currently available'
      }
    );
    return;
  }

  try{
    const initialRecall=await longTermMemoryService.searchPipeline(
      recallQuery,
      memories,
      null,
      [],
      {
        limit:12,
        onlyApprovedForFacts:false,
        minScoreThreshold:6.0,
      }
    );

    const recalledIds=new Set<string>(
      initialRecall.scoredMemories.map(hit=>String(hit.memory.id))
    );

    let additionalRecallPerformed=false;

    if(initialRecall.scoredMemories.length>0){
      const relatedHints=initialRecall.scoredMemories
        .flatMap(hit=>[
          ...(Array.isArray(hit.memory.semanticKeywords)
            ? hit.memory.semanticKeywords.map(String)
            : []),
          String(hit.memory.sourceRef||'')
        ])
        .filter(Boolean);

      const relatedRecallQuery=[
        task.goal,
        typeof payload.input==='string' ? payload.input : '',
        ...relatedHints,
        ...unresolvedHints,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();

      if(relatedRecallQuery && relatedRecallQuery!==recallQuery){
        const relatedRecall=await longTermMemoryService.searchPipeline(
          relatedRecallQuery,
          memories,
          null,
          [],
          {
            limit:12,
            onlyApprovedForFacts:false,
            minScoreThreshold:6.0,
          }
        );

        for(const hit of relatedRecall.scoredMemories){
          recalledIds.add(String(hit.memory.id));
        }

        additionalRecallPerformed=true;
      }
    }

    const currentContextEntries=task.entries.filter(entry =>
      entry.kind==='EVIDENCE' ||
      entry.kind==='CLAIM' ||
      (
        entry.kind==='RESULT' &&
        (
          entry.domain==='research' ||
          entry.domain==='verification' ||
          entry.domain==='unknown'
        )
      )
    );

    const currentContextEvidenceIds=currentContextEntries
      .flatMap(entry=>entry.evidenceIds||[])
      .filter(Boolean);

    const currentContextAvailable=currentContextEntries.length>0;

    const status=
      recalledIds.size>0 || currentContextAvailable
        ? 'SUFFICIENT'
        : 'CONTEXT_INSUFFICIENT';

    taskBlackboardService.append(
      task.taskId,
      'DECISION',
      'core',
      `coreMemoryContextAssessment:${cycle}`,
      {
        schemaVersion:1,
        status,
        cycle,
        queryHash:sha256HexFromText(recallQuery),
        initialHits:initialRecall.scoredMemories.length,
        mergedHits:recalledIds.size,
        additionalRecall:additionalRecallPerformed,
        currentContextEntries:currentContextEntries.length,
        currentContextEvidenceIds:[...new Set(currentContextEvidenceIds)].slice(0,24),
        memoryIds:[...recalledIds].slice(0,24),
        reason:status==='SUFFICIENT'
          ? (
              recalledIds.size>0
                ? 'CORE context is sufficient through persistent memory recall'
                : 'CORE context is sufficient through current task Evidence/Research/Verification state'
            )
          : 'CORE context is insufficient after current-task context inspection and persistent-memory recall'
      }
    );
  }catch(error){
    taskBlackboardService.append(
      task.taskId,
      'DECISION',
      'core',
      `coreMemoryContextAssessment:${cycle}`,
      {
        schemaVersion:1,
        status:'CONTEXT_INSUFFICIENT',
        cycle,
        queryHash:sha256HexFromText(recallQuery),
        reason:`CORE memory context assessment failed: ${error instanceof Error ? error.message : String(error)}`
      }
    );
  }
 }



 private async continueTask(taskId:string,maxCycles:number,reqId:string=taskId):Promise<CoreOrchestrationResult>{
  let dispatched=0;let cycles=taskBlackboardService.get(taskId)?.lastCycle||0;let cycleBudget=0;const cycleLimit=Math.max(1,Math.min(maxCycles,100));
  coreCycle: while(cycleBudget<cycleLimit){
   cycles+=1;cycleBudget+=1;taskBlackboardService.setCycle(taskId,cycles);
   coreExecutionTraceService.record(taskId,cycles,'CYCLE_START',{
     cycleBudget,
     cycleLimit,
     maxCycles,
     status:taskBlackboardService.get(taskId)?.status,
     revision:taskBlackboardService.get(taskId)?.revision,
     visitedDomains:taskBlackboardService.get(taskId)?.visitedDomains,
     pendingDomains:taskBlackboardService.get(taskId)?.pendingDomains
   });
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
   await this.assessCoreMemoryContext(stateBase,currentPayload,cycles);
   const current=taskBlackboardService.get(taskId)!;
   const plateau=plateauDetectorService.evaluate(current);
   if(plateau.plateau){
    coreExecutionTraceService.record(taskId,cycles,'CYCLE_GUARD',{
      plateau:true,
      repeatedRoutes:plateau.repeatedRoutes,
      unchangedCycles:plateau.unchangedCycles,
      oscillation:plateau.oscillation,
      repeatedFailure:plateau.repeatedFailure,
      sameResearchQuery:plateau.sameResearchQuery,
      reason:plateau.reason,
      revision:current.revision,
      entryCount:current.entries.length,
      evidenceIds:[...new Set(
        current.entries.flatMap(entry=>entry.evidenceIds||[])
      )]
    });
    if(plateau.reason==='NO_PROGRESS'){
      coreExecutionTraceService.record(taskId,cycles,'NO_PROGRESS',{
        reason:plateau.reason,
        repeatedRoutes:plateau.repeatedRoutes,
        unchangedCycles:plateau.unchangedCycles,
        oscillation:plateau.oscillation,
        repeatedFailure:plateau.repeatedFailure,
        sameResearchQuery:plateau.sameResearchQuery,
        revision:current.revision,
        entryCount:current.entries.length,
        lastEntries:current.entries.slice(-12).map(entry=>({
          kind:entry.kind,
          domain:entry.domain,
          key:entry.key,
          evidenceIds:entry.evidenceIds
        }))
      });
    }
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
   const routes=adaptiveRoutePlannerService.plan(planningTask).filter(route=>{
     const latestFailure=[...planningTask.entries]
       .reverse()
       .find(entry=>{
         if(entry.kind!=='ERROR') return false;

         const value=entry.value&&typeof entry.value==='object'
           ? entry.value as Record<string,unknown>
           : {};

         return String(value.operation||'')===route.command;
       });

     const failureValue=latestFailure?.value&&typeof latestFailure.value==='object'
       ? latestFailure.value as Record<string,unknown>
       : undefined;

     const failureReply=failureValue?.reply&&typeof failureValue.reply==='object'
       ? failureValue.reply as Record<string,unknown>
       : undefined;

     const failureNormalized=failureValue?.normalized&&typeof failureValue.normalized==='object'
       ? failureValue.normalized as Record<string,unknown>
       : undefined;

     const replyNormalized=failureReply?.normalized&&typeof failureReply.normalized==='object'
       ? failureReply.normalized as Record<string,unknown>
       : undefined;

     const retryReason=String(
       failureValue?.error||
       failureValue?.summary||
       failureNormalized?.error||
       failureNormalized?.summary||
       failureReply?.error||
       failureReply?.summary||
       replyNormalized?.error||
       replyNormalized?.summary||
       route.reason
     ).trim();

     return negativeKnowledgeService.canRetry(
       route.target,
       route.command,
       retryReason
     );
   });
   for(const route of routes) route.payload={...route.payload,environmentSignature:planEnvironment.signature};
   taskBlackboardService.append(taskId,'DECISION','core',`coreEnvironmentPlan:${cycles}`,planEnvironment);
   taskBlackboardService.append(taskId,'DECISION','core',`corePlan:${cycles}`,routes.map(route=>({target:route.target,command:route.command,reason:route.reason,environmentSignature:route.payload.environmentSignature})));
   coreExecutionTraceService.record(taskId,cycles,'PLAN',{
     routeCount:routes.length,
     routes:routes.map(route=>({
       target:route.target,
       command:route.command,
       reason:route.reason,
       operationInstanceId:route.payload.operationInstanceId,
       dedupeKey:route.payload.dedupeKey,
       idempotencyKey:route.payload.idempotencyKey,
       attempt:route.payload.attempt,
       planRevision:route.payload.planRevision,
       planSha256:route.payload.planSha256,
       environmentSignature:route.payload.environmentSignature
     }))
   });
   const proposedRequirements=routes.filter(route=>!DIAGNOSTIC_COMMANDS.has(route.command)).map(route=>{
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
      const operationInstanceId=String(route.payload.operationInstanceId||'');
      const dedupeKey=String(route.payload.dedupeKey||`${taskId}:${route.command}`);
      const idempotencyKey=String(route.payload.idempotencyKey||dedupeKey);
      const required=plan.revision.requiredOperations.find(item=>item.operationInstanceId===operationInstanceId);
      route.payload={...route.payload,dedupeKey,idempotencyKey};
      if(required) route.payload={...route.payload,operationInstanceId:required.operationInstanceId,planRevision:plan.revision.planRevision,planSha256:plan.revision.planSha256};
    }
   }else{
    for(const route of routes){
      const dedupeKey=String(route.payload.dedupeKey||`${taskId}:${route.command}`);
      const idempotencyKey=String(route.payload.idempotencyKey||dedupeKey);
      route.payload={...route.payload,dedupeKey,idempotencyKey};
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
        const diagnostic=DIAGNOSTIC_COMMANDS.has(route.command);
        const operationClass=diagnostic?'DIAGNOSTIC':'BUSINESS';
        const status=diagnostic?'OBSERVED':'SUCCEEDED';
        taskBlackboardService.append(taskId,'DECISION','core','actionIdempotencyReused',{
          schemaVersion:1,status:'REUSED_SUCCEEDED',idempotencyKey,reusedFromReplyId:prior.replyId,
          target:route.target,command:route.command,reason:'既に成功した同一Idempotency KeyのActionを再実行せず既存結果を再利用'
        });
        const reusedValue={
          schemaVersion:3,collectedBy:'core',coreCollected:true,sourceDomain:route.target,
          producerId:'domainReplyLedgerService',operation:route.command,
          operationInstanceId:route.payload.operationInstanceId,planRevision:route.payload.planRevision,
          planSha256:route.payload.planSha256,idempotencyKey,
          operationClass,status,
          reply:{status,operationClass,reused:true,reusedFromReplyId:prior.replyId,
            data:{summary:prior.summary,evidenceIds:prior.evidenceIds,receiptIds:prior.receiptIds}}
        };
        taskBlackboardService.append(taskId,diagnostic?'OBSERVATION':'RESULT',route.target,`domainResult:${route.target}:${route.command}`,reusedValue,prior.evidenceIds);
        const proposalKey=typeof route.payload.dedupeKey==='string'?route.payload.dedupeKey:'';
        if(proposalKey&&!diagnostic)taskBlackboardService.append(taskId,'DECISION','core',`proposedOperationSucceeded:${proposalKey}`,{
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

    // CORE-owned universal synthesis.
    // This is intentionally not dispatched through a 17-domain adapter.
    // The synthesis engine is a reusable CORE capability, not a 19th domain.
    if(route.command==='SYNTHESIZE_UNIVERSAL'){
      const synthesis=universalSynthesisService.synthesize({
        requestId:reqId,
        taskId,
        goal:String(route.payload.goal||current.goal),
        input:route.payload.input,
        constraints:Array.isArray(route.payload.constraints)
          ? route.payload.constraints.map(String) : [],
        requiredOutput:String(route.payload.requiredOutput||''),
        environment:String(route.payload.environment||'universal'),
        availableComponentIds:Array.isArray(route.payload.availableComponentIds)
          ? route.payload.availableComponentIds.map(String) : undefined,
        maxComponents:Number(route.payload.maxComponents||4),
        synthesisContext:await this.buildSynthesisContext(current, route.payload)
      });

      dispatched+=1;

      const succeeded=synthesis.validation.status==='PASSED';

      const coreReplyRecord=domainReplyLedgerService.recordCoreOwned(
        taskId,
        reqId,
        {
          command:'SYNTHESIZE_UNIVERSAL',
          operationInstanceId:String(route.payload.operationInstanceId||''),
          corePlanRevision:Number(route.payload.planRevision||0),
          idempotencyKey:typeof route.payload.idempotencyKey==='string'
            ? route.payload.idempotencyKey
            : undefined,
          status:succeeded?'SUCCEEDED':'FAILED',
          summary:succeeded
            ? 'CORE-owned universal synthesis completed and returned for re-evaluation'
            : synthesis.validation.reasons.join('|') || 'CORE-owned universal synthesis blocked',
          evidenceIds:[],
          unknowns:synthesis.unresolved,
          data:{
            synthesisId:synthesis.synthesisId,
            componentIds:synthesis.usedComponentIds,
            candidateComponentIds:synthesis.candidateComponentIds
          }
        }
      );

      taskBlackboardService.append(
        taskId,
        succeeded ? 'RESULT' : 'ERROR',
        'core',
        'coreUniversalSynthesis',
        {
          schemaVersion:1,
          operation:'SYNTHESIZE_UNIVERSAL',
          operationClass:'BUSINESS',
          status:succeeded?'SUCCEEDED':'BLOCKED',
          synthesisId:synthesis.synthesisId,
          synthesisArtifact:synthesis.synthesisArtifact,
          selectionMode:synthesis.selectionMode,
          usedComponentIds:synthesis.usedComponentIds,
          adaptedComponentIds:synthesis.adaptedComponentIds,
          candidateComponentIds:synthesis.candidateComponentIds,
          compositionPlan:synthesis.compositionPlan,
          validation:synthesis.validation,
          unresolved:synthesis.unresolved,
          evidenceRefs:synthesis.evidenceRefs,
          lineage:synthesis.lineage,
          nextCoreAction:synthesis.nextCoreAction,
          reply:{
            status:succeeded?'SUCCEEDED':'BLOCKED',
            operationClass:'BUSINESS',
            operation:'SYNTHESIZE_UNIVERSAL',
            data:synthesis
          },
          operationInstanceId:route.payload.operationInstanceId,
          planRevision:route.payload.planRevision,
          planSha256:route.payload.planSha256,
          idempotencyKey:route.payload.idempotencyKey,
          coreReplyId:coreReplyRecord.replyId
        },
        synthesis.evidenceRefs
      );

      coreExecutionTraceService.record(
        taskId,
        cycles,
        'CORE_SYNTHESIS',
        {
          operation:'SYNTHESIZE_UNIVERSAL',
          synthesisId:synthesis.synthesisId,
          status:synthesis.validation.status,
          selectionMode:synthesis.selectionMode,
          usedComponentIds:synthesis.usedComponentIds,
          unresolved:synthesis.unresolved,
          nextCoreAction:synthesis.nextCoreAction
        }
      );

      // SynthesisResult must return to CORE and be re-evaluated
      // before Completion Gate / CoreResult.
      taskBlackboardService.append(
        taskId,
        'DECISION',
        'core',
        `coreSynthesisReevaluation:${cycles}`,
        {
          schemaVersion: 1,
          synthesisId: synthesis.synthesisId,
          synthesisArtifact: synthesis.synthesisArtifact,
          synthesisStatus: synthesis.validation.status,
          selectionMode: synthesis.selectionMode,
          usedComponentIds: synthesis.usedComponentIds,
          adaptedComponentIds: synthesis.adaptedComponentIds,
          candidateComponentIds: synthesis.candidateComponentIds,
          unresolved: synthesis.unresolved,
          nextCoreAction: synthesis.nextCoreAction,
          reEvaluateBeforeCompletion: true,
          reason: 'SynthesisResult must be evaluated by CORE before Completion Gate / CoreResult'
        },
        synthesis.evidenceRefs
      );

      coreResultService.recordCategoryStep(
        reqId,
        'core' as any,
        succeeded ? 'processing' : 'failed'
      );

      if(!succeeded){
        negativeKnowledgeService.record(
          'core',
          'SYNTHESIZE_UNIVERSAL' as DomainCommand,
          synthesis.unresolved.join('; ') || 'SYNTHESIS_BLOCKED',
          ['research','strategy','capability']
        );
      }

      continue;
    }

    if(
      route.target==='selfDevelopment' &&
      route.command==='GENERATE_CANDIDATE'
    ){
      const runId=String(route.payload.runId||'').trim();
      const existingRun=runId
        ? improvementIntakeRouterService.get(runId)
        : undefined;

      if(existingRun){
        await improvementIntakeRouterService.ensureForCoreTask({
          taskId,
          objective:current.goal,
          payload:{
            ...route.payload,
            taskId,
            runId
          },
          sourceId:existingRun.sourceId
        });
      }else{
        await improvementIntakeRouterService.ensureForCoreTask({
          taskId,
          objective:current.goal,
          payload:{
            ...route.payload,
            taskId
          },
          sourceId:taskId
        });
      }
    }

    const envelope=domainRouterService.create('core',route.target,route.command,{...route.payload,taskId,requestId:reqId},{correlationId:taskId,causationId:taskId,depth:cycles});
    coreExecutionTraceService.record(taskId,cycles,'DISPATCH_START',{
      target:route.target,
      command:route.command,
      operationInstanceId:route.payload.operationInstanceId,
      dedupeKey:route.payload.dedupeKey,
      idempotencyKey:route.payload.idempotencyKey,
      attempt:route.payload.attempt,
      envelopeId:envelope.envelopeId,
      correlationId:envelope.correlationId,
      causationId:envelope.causationId,
      depth:envelope.depth,
      payloadKeys:Object.keys(route.payload)
    });
    const reply=await domainRouterService.dispatch(envelope);dispatched+=1;
    coreExecutionTraceService.record(taskId,cycles,'DISPATCH_RESULT',{
      target:route.target,
      command:route.command,
      envelopeId:envelope.envelopeId,
      accepted:reply.accepted,
      error:reply.error,
      normalized:reply.normalized,
      result:reply.result
    });
    const operationId=this.readPayloadString(current,'operationId')||this.readPayloadString(current,'operation')||taskId;
    const replyRecord=domainReplyLedgerService.record(taskId,operationId,envelope,reply);
    coreExecutionTraceService.record(taskId,cycles,'REPLY_LEDGER',{
      operationId,
      replyId:replyRecord.replyId,
      envelopeId:envelope.envelopeId,
      evidenceIds:replyRecord.evidenceIds,
      receiptIds:replyRecord.receiptIds,
      accepted:replyRecord.accepted,
      normalizedStatus:replyRecord.normalized?.status,
      normalizedOperationClass:replyRecord.normalized?.operationClass
    });
    const operationClass=reply.normalized?.operationClass||'BUSINESS';
    const resultKind=operationClass==='DIAGNOSTIC'?'OBSERVATION':(reply.accepted?'RESULT':'ERROR');

    coreExecutionTraceService.record(taskId,cycles,'REPLY_NORMALIZED',{
      command:route.command,
      target:route.target,
      accepted:reply.accepted,
      operationClass,
      normalizedStatus:reply.normalized?.status,
      normalizedOperation:reply.normalized?.operation,
      normalizedEvidenceIds:reply.normalized?.evidenceIds,
      normalizedReceiptIds:reply.normalized?.receiptIds,
      resultKind,
      normalizedKeys:reply.normalized ? Object.keys(reply.normalized) : [],
      rawResultType:typeof reply.result,
      rawResultKeys:reply.result && typeof reply.result==='object'
        ? Object.keys(reply.result as Record<string,unknown>)
        : []
    });
    const proposalKey=typeof route.payload.dedupeKey==='string'?route.payload.dedupeKey:'';
    const normalizedStatus=String(reply.normalized?.status||'').toUpperCase();
    const waitingForExternalExecution=
      reply.accepted &&
      operationClass==='BUSINESS' &&
      ['WAITING_EXECUTION','WAITING_CANARY','CANARY'].includes(normalizedStatus);

    const operationSucceeded=reply.accepted&&normalizedStatus==='SUCCEEDED'&&operationClass==='BUSINESS';
    const actionCompletedStatus=operationClass==='DIAGNOSTIC'
      ? (reply.accepted&&normalizedStatus==='OBSERVED'?'OBSERVED':'FAILED')
      : (operationSucceeded?'SUCCEEDED':waitingForExternalExecution?'WAITING':'FAILED');
    if(typeof route.payload.idempotencyKey==='string'&&route.payload.idempotencyKey)taskBlackboardService.append(taskId,'DECISION','core','actionCompleted',{
      schemaVersion:1,status:actionCompletedStatus,idempotencyKey:String(route.payload.idempotencyKey),
      target:route.target,command:route.command,operationInstanceId:route.payload.operationInstanceId,
      replyId:replyRecord.replyId,cycle:cycles
    });
    const expectedRevision=taskBlackboardService.get(taskId)?.revision ?? -1;
    const resultWrite=taskBlackboardService.appendIfRevision(taskId,expectedRevision,resultKind,route.target,`${resultKind==='OBSERVATION'?'domainObservation':'domainResult'}:${route.target}:${route.command}`,{schemaVersion:3,collectedBy:'core',coreCollected:true,sourceDomain:route.target,producerId:'domainRouterService',dispatchId:envelope.envelopeId,replyId:replyRecord.replyId,operation:route.command,operationInstanceId:route.payload.operationInstanceId,planRevision:route.payload.planRevision,intentPlanKey:route.payload.intentPlanKey,intentHypothesisId:route.payload.intentHypothesisId,intentHypothesisKind:route.payload.intentHypothesisKind,intentIds:Array.isArray(route.payload.intentIds)?route.payload.intentIds.map(String):[],planSha256:route.payload.planSha256,idempotencyKey:typeof route.payload.idempotencyKey==='string'?route.payload.idempotencyKey:'',operationClass,reply:reply.normalized||reply.error,auditTag:'coreCollected:'},replyRecord.evidenceIds);
    coreExecutionTraceService.record(taskId,cycles,'BLACKBOARD_WRITE',{
      kind:resultKind,
      target:route.target,
      command:route.command,
      operationClass,
      evidenceIds:replyRecord.evidenceIds,
      expectedRevision,
      currentRevision:taskBlackboardService.get(taskId)?.revision,
      writeSucceeded:Boolean(resultWrite)
    });
    if(!resultWrite){
      const latest=taskBlackboardService.get(taskId);
      if(latest)taskBlackboardService.append(taskId,'CHECKPOINT','core',`coreRevisionConflict:${cycles}:${route.command}`,{schemaVersion:1,expectedRevision,currentRevision:latest.revision,operationInstanceId:route.payload.operationInstanceId,replyId:replyRecord.replyId,replanRequired:true});
    } else if(proposalKey&&operationSucceeded){
      const proposalRevision=taskBlackboardService.get(taskId)?.revision ?? -1;
      if(!taskBlackboardService.appendIfRevision(taskId,proposalRevision,'DECISION','core',`proposedOperationSucceeded:${proposalKey}`,{schemaVersion:1,operation:route.command,dispatchId:envelope.envelopeId,operationClass:'BUSINESS',status:'OPERATION_SUCCEEDED',dedupeKey:proposalKey,completedAt:reply.completedAt})){
        const latest=taskBlackboardService.get(taskId); if(latest)taskBlackboardService.append(taskId,'CHECKPOINT','core',`coreRevisionConflict:proposal:${cycles}:${route.command}`,{schemaVersion:1,currentRevision:latest.revision,operationInstanceId:route.payload.operationInstanceId,replyId:replyRecord.replyId,replanRequired:true});
      }
    }
    coreResultService.recordCategoryStep(
      reqId,
      route.target as any,
      reply.accepted?'processing':'failed'
    );

    if(waitingForExternalExecution){
      taskBlackboardService.append(
        taskId,
        'CHECKPOINT',
        'core',
        `externalExecutionWaiting:${cycles}:${route.command}`,
        {
          schemaVersion:1,
          status:'WAITING_EXTERNAL_EXECUTION',
          operation:route.command,
          operationInstanceId:route.payload.operationInstanceId,
          runId:typeof (reply.result as any)?.runId==='string'
            ? (reply.result as any).runId
            : typeof (reply.result as any)?.canaryRunId==='string'
              ? (reply.result as any).canaryRunId
              : undefined,
          normalizedStatus,
          reason:typeof (reply.result as any)?.reason==='string'
            ? (reply.result as any).reason
            : '外部実行/Canary Evidence待ちのためCOREを一時停止'
        }
      );

      taskBlackboardService.pause(taskId,'WAITING_EXTERNAL_EXECUTION');
      coreResultService.waiting(reqId,{
        error:'WAITING_EXTERNAL_EXECUTION',
        operation:route.command,
        operationInstanceId:route.payload.operationInstanceId,
        normalizedStatus
      });

      break coreCycle;
    }

    if(!reply.accepted)negativeKnowledgeService.record(route.target,route.command,reply.error||route.reason,['research','strategy','safety']);
   }
   taskBlackboardService.setPending(taskId,[]);
   const reevaluated=taskBlackboardService.get(taskId);if(!reevaluated)break;
   coreExecutionTraceService.record(taskId,cycles,'REEVALUATION_INPUT',{
     revision:reevaluated.revision,
     visitedDomains:[...reevaluated.visitedDomains],
     pendingDomains:[...reevaluated.pendingDomains],
     entryCount:reevaluated.entries.length,
     observations:reevaluated.entries
       .filter(entry=>entry.kind==='OBSERVATION')
       .slice(-10)
       .map(entry=>({
         key:entry.key,
         domain:entry.domain,
         evidenceIds:entry.evidenceIds,
         operation:typeof entry.value==='object'&&entry.value!==null
           ?(entry.value as Record<string,unknown>).operation
           :undefined,
         operationClass:typeof entry.value==='object'&&entry.value!==null
           ?(entry.value as Record<string,unknown>).operationClass
           :undefined
       })),
     evidenceIds:[...new Set(
       reevaluated.entries.flatMap(entry=>entry.evidenceIds||[])
     )]
   });
   taskBlackboardService.append(taskId,'DECISION','core',`coreReevaluation:${cycles}`,{revision:reevaluated.revision,visitedDomains:[...reevaluated.visitedDomains]});
   const completion=adaptiveRoutePlannerService.assessCompletion(reevaluated);
   coreExecutionTraceService.record(taskId,cycles,'COMPLETION_ASSESSMENT',{
     businessCompletion:completion.businessCompletion,
     failClosed:completion.failClosed,
     requiredDomains:completion.requiredDomains,
     missingDomains:completion.missingDomains,
     failedDomains:completion.failedDomains,
     missingReceipts:completion.missingReceipts,
     persistenceConfirmed:completion.persistenceConfirmed,
     evidenceQualityPassed:completion.evidenceQualityPassed,
     reasons:completion.reasons
   });
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
  const synthesisResults=task.entries
    .filter(entry=>entry.domain==='core'&&(entry.kind==='RESULT'||entry.kind==='ERROR')&&objectValue(entry)?.operation==='SYNTHESIZE_UNIVERSAL')
    .map(entry=>objectValue(entry))
    .filter(Boolean);
  return {taskId:task.taskId,operationId:this.readPayloadString(task,'operationId')||task.taskId,commandId:this.readPayloadString(task,'commandId'),cycles,dispatched,status:'WAITING',taskRevision:task.revision,corePlanRevision:plan?.planRevision,currentOperationInstanceId:currentOperation?.operationInstanceId,currentBusinessStage:currentOperation?.operation,nextOperationInstanceId:plan?.requiredOperations.find(operation=>operation.status==='PENDING'&&operation.operationInstanceId!==currentOperation?.operationInstanceId)?.operationInstanceId,requiredDomains:completion.requiredDomains,missingDomains:completion.missingDomains,failedDomains:completion.failedDomains,missingReceipts:completion.missingReceipts,missingRequiredOperations:completion.missingRequiredOperations,completionReasons:completion.reasons,replyIds:lineage.verifiedReplyIds,evidenceIds:lineage.verifiedEvidenceIds,persistenceReceiptIds:lineage.verifiedReceiptIds,decisionId:lineage.verifiedDecisionId,lineageVerified:lineage.lineageVerified,rejectedLineageIds:{replyIds:lineage.rejectedReplyIds,evidenceIds:lineage.rejectedEvidenceIds,receiptIds:lineage.rejectedReceiptIds,decisionIds:lineage.rejectedDecisionIds},unknowns:[...new Set(replyRecords.flatMap(record=>record.unknowns))],synthesisResults,latestSynthesisResult:synthesisResults.at(-1)||null};
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
  const synthesisResults=task.entries
    .filter(entry=>entry.domain==='core'&&(entry.kind==='RESULT'||entry.kind==='ERROR')&&objectValue(entry)?.operation==='SYNTHESIZE_UNIVERSAL')
    .map(entry=>objectValue(entry))
    .filter(Boolean);
  return {taskId:task.taskId,operationId:this.readPayloadString(task,'operationId')||this.readPayloadString(task,'operation')||task.taskId,commandId:this.readPayloadString(task,'uiCommandId')||this.readPayloadString(task,'commandId'),cycles,dispatched,status:'COMPLETED',taskRevision:task.revision,corePlanRevision:plan?.planRevision,currentOperationInstanceId:currentOperation?.operationInstanceId,currentBusinessStage:currentOperation?.operation,nextOperationInstanceId:plan?.requiredOperations.find(operation=>operation.status==='PENDING'&&operation.operationInstanceId!==currentOperation?.operationInstanceId)?.operationInstanceId,requiredDomains,selectedClassificationIds:[...task.visitedDomains],replyIds:lineage.verifiedReplyIds,evidenceIds:lineage.verifiedEvidenceIds,decisionId:lineage.verifiedDecisionId,persistenceReceiptIds:lineage.verifiedReceiptIds,lineageVerified:lineage.lineageVerified,rejectedLineageIds:{replyIds:lineage.rejectedReplyIds,evidenceIds:lineage.rejectedEvidenceIds,receiptIds:lineage.rejectedReceiptIds,decisionIds:lineage.rejectedDecisionIds},unknowns,failures,synthesisResults,latestSynthesisResult:synthesisResults.at(-1)||null,cognitiveState:this.latestUnifiedCognitiveState(task)};
 }
 private readEnvironmentHints(task:BlackboardTask):Record<string,unknown>{
  const value=task.entries.find(entry=>entry.kind==='INPUT'&&entry.key==='payload')?.value;
  const payload=value&&typeof value==='object'&&!Array.isArray(value)
    ? {...(value as Record<string,unknown>)}
    : {};

  const repository=typeof payload.repository==='string'&&payload.repository.trim()
    ? payload.repository.trim()
    : 'SimpleRPG/MIKI-AI0.2';
  const branch=typeof payload.branch==='string'&&payload.branch.trim()
    ? payload.branch.trim()
    : 'main';

  const sync=githubSyncService.get(repository,branch);
  if(sync?.complete&&sync.files.length){
    const targetSnapshotSha256=sha256HexFromText(
      JSON.stringify(
        sync.files.map(file=>({path:file.path,sha256:file.sha256}))
      )
    );

    if(!payload.gitHead&&sync.commitSha)payload.gitHead=sync.commitSha;
    if(!payload.targetSnapshotSha256)payload.targetSnapshotSha256=targetSnapshotSha256;
  }

  return payload;
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
