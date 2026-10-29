import { corePlanRevisionService } from './corePlanRevisionService';
import { coreLineageReadModelService } from './coreLineageReadModelService';
import { domainRouterService, type DomainCommand } from './domainRouterService';
import { taskBlackboardService, unresolvedTaskErrors, type BlackboardTask } from './taskBlackboardService';
import { adaptiveRoutePlannerService } from './adaptiveRoutePlannerService';
import { rustCoreDecisionKernelService } from './rustCoreDecisionKernelService';
import { rustDomainParticipationKernelService } from './rustDomainParticipationKernelService';
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
import { canonicalServiceAliasRegistryService } from './canonicalServiceAliasRegistryService';
import { residualCapabilityIntegrationService } from './residualCapabilityIntegrationService';
import { complexCapabilityContractService } from './complexCapabilityContractService';
import { finalResidualServiceIntegrationService } from './finalResidualServiceIntegrationService';
import { actionLineageService } from './actionLineageService';
import { cumulativeRevalidationService } from './cumulativeRevalidationService';
import { candidateConstraintValidationService } from './candidateConstraintValidationService';
import { candidateGovernanceCoordinatorService } from './candidateGovernanceCoordinatorService';
import { candidateAutoRebaseService } from './candidateAutoRebaseService';
import { universalSynthesisService } from './universalSynthesisService';
import { longTermMemoryService } from '../../memory/services/longTermMemoryService';
import { memoryContextBridgeService } from '../../memory/services/memoryContextBridgeService';
import { advancedPipelineHandoffAuditService } from '../../selfDevelopment/services/advancedPipelineHandoffAuditService';
import { candidateDevelopmentCompletionService } from '../../selfDevelopment/services/candidateDevelopmentCompletionService';
import { acceptanceEvidenceMatrixService } from '../../selfDevelopment/services/acceptanceEvidenceMatrixService';
import { reviewManifestInclusionGateService } from '../../selfDevelopment/services/reviewManifestInclusionGateService';
import { workspaceTscAndIsolationE2EService } from '../../selfDevelopment/services/workspaceTscAndIsolationE2EService';
import { canaryPostReviewVerificationService } from '../../selfDevelopment/services/canaryPostReviewVerificationService';
import { autonomousE2EProofSuiteService } from '../../selfDevelopment/services/autonomousE2EProofSuiteService';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { cognitiveStateCheckpointService } from '../../autonomy/services/operationalGovernanceService';

export interface CoreOrchestrationResult { task:BlackboardTask; cycles:number; dispatched:number; coreResult?:CoreResult; }

export interface CoreImprovementGateEvidence { semantic:boolean; scope:boolean; contract:boolean; dependency:boolean; staticVerification:boolean; typecheck:boolean; regression:boolean; resource:boolean; packageIntegrity:boolean; externalEvaluation?:boolean; }
export interface CoreImprovementDecisionInput { instruction:string; baselineSha256:string; candidateSha256?:string; targetPaths:string[]; evidence:CoreImprovementGateEvidence; repairAttempt:number; maxRepairAttempts:number; currentFailureSignature?:string; previousFailureSignatures:string[]; reviewPackageId?:string; externalVerdict?:'ADOPT'|'HOLD'|'REJECT'; }
export interface CoreImprovementDecision { nextAction:'ANALYZE'|'BUILD'|'REPAIR'|'RUN_REGRESSION'|'BUILD_REVIEW_PACKAGE'|'WAIT_EXTERNAL_EVALUATION'|'PREPARE_ADOPTION'|'STOP'; reasons:string[]; canMutateCanonical:false; requiresExternalEvaluation:true; }

export interface UnifiedCognitiveStateSnapshot {
  schemaVersion:2; stateId:string; taskId:string; cycle:number; revision:number; goal:string; input:string; source:string;
  constraints:string[]; activeDomains:string[]; requiredDomains:string[]; pendingIntentIds:string[]; evidenceIds:string[]; unknowns:string[]; capabilityRefs:string[];
  hypothesisRefs?:Array<{id:string;kind:string;confidence:number;rationale:string}>;
  actionRefs?:string[]; safetyConstraints?:string[]; contradictions?:string[]; confidenceSummary?:{knownEvidence:number;unresolvedUnknowns:number;failedActions:number;verifiedOutcomes:number};
  activeTask?:{status:string;pausedReason?:string;resumeCount:number;lastCycle:number};
  latestOutcome?:{kind:string;domain:string;key:string;status?:string}; failureRefs?:string[]; learningRefs?:string[]; semanticCoreHash?:string;
  recentOutcomes:Array<{kind:string;domain:string;key:string;status?:string}>;
  learningCandidates:Array<{domain:string;key:string;valueHash:string}>;
  environmentSignature?:string; invariantsVersion:1; stateHash:string;
}

const DIAGNOSTIC_COMMANDS=new Set(['ASSESS_DOMAIN','HEALTH_CHECK','DESCRIBE','GET_STATUS','PARTICIPATE','VERIFY_CONNECTION','DISCOVER_IMPROVEMENT_ISSUE','RUN_SELF_IMPROVEMENT']);

class CoreOrchestratorService {
 public decideSelfCodeImprovementNextAction(input:CoreImprovementDecisionInput):CoreImprovementDecision {
  const reasons:string[]=[];let nextAction:CoreImprovementDecision['nextAction']='ANALYZE';const e=input.evidence;
  if(!input.instruction.trim()||!input.targetPaths.length){nextAction='STOP';reasons.push('EMPTY_INTENT_OR_TARGET');}
  else if(!e.semantic||!e.scope){nextAction='ANALYZE';reasons.push(!e.semantic?'SEMANTIC_GATE_PENDING':'SCOPE_GATE_PENDING');}
  else if(!input.candidateSha256){nextAction='BUILD';reasons.push('CANDIDATE_REQUIRED');}
  else if(input.candidateSha256===input.baselineSha256){nextAction='STOP';reasons.push('NO_EFFECTIVE_CHANGE');}
  else if(!e.contract||!e.dependency||!e.staticVerification||!e.typecheck||!e.resource){
   const repeated=Boolean(input.currentFailureSignature&&input.previousFailureSignatures.includes(input.currentFailureSignature));
   if(repeated||input.repairAttempt>=input.maxRepairAttempts){nextAction='STOP';reasons.push(repeated?'REPEATED_FAILURE_SIGNATURE':'REPAIR_BUDGET_EXHAUSTED');}
   else{nextAction='REPAIR';reasons.push('PRE_REGRESSION_GATE_FAILED');}
  }
  else if(!e.regression){nextAction='RUN_REGRESSION';reasons.push('REGRESSION_REQUIRED');}
  else if(!input.reviewPackageId||!e.packageIntegrity){nextAction='BUILD_REVIEW_PACKAGE';reasons.push('REVIEW_PACKAGE_REQUIRED');}
  else if(input.externalVerdict==='REJECT'){nextAction='STOP';reasons.push('EXTERNAL_REJECT');}
  else if(input.externalVerdict!=='ADOPT'||e.externalEvaluation!==true){nextAction='WAIT_EXTERNAL_EVALUATION';reasons.push(input.externalVerdict==='HOLD'?'EXTERNAL_HOLD':'EXTERNAL_EVALUATION_REQUIRED');}
  else{nextAction='PREPARE_ADOPTION';reasons.push('ALL_GATES_PASSED');}
  return{nextAction,reasons,canMutateCanonical:false,requiresExternalEvaluation:true};
 }
 async run(goal:string,source:MikiDomain='core',payload:Record<string,unknown>={},maxCycles=18,signal?:AbortSignal):Promise<CoreOrchestrationResult>{
  const created=taskBlackboardService.create(goal,source,payload);
  systemLogger.info(
    'SYSTEM',
    `[RUNTIME] CORE task start: ${created.taskId}`,
  );
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

  // 自律改善TASKは重いselfDevelopment系処理へ進む前に、
  // 既存の正規SelfImprovementController履歴へtaskId付きで確定記録する。
  // その直後にflushすることで、強制終了しても「Runtimeだけに存在するTASK」
  // にならないよう、TASK BlackboardとCanonical Historyを同じ永続境界で確定させる。
  if(payload.kind==='SELF_IMPROVEMENT'){
   const governancePreflight=candidateGovernanceCoordinatorService.preflight({
    invariantChange:payload.invariantChange&&typeof payload.invariantChange==='object'?payload.invariantChange as never:undefined,
    candidates:Array.isArray(payload.candidateAlternatives)?payload.candidateAlternatives as never:undefined
   });
   coreExecutionTraceService.record(created.taskId,0,'CANDIDATE_GOVERNANCE_PREFLIGHT',governancePreflight);
   if(!governancePreflight.allowed){taskBlackboardService.post(created.taskId,'OBSERVATION','core','CANDIDATE_GOVERNANCE_BLOCKED',governancePreflight,[]);}
   const autoRebase=payload.autoRebase&&typeof payload.autoRebase==='object'?payload.autoRebase as Parameters<typeof candidateAutoRebaseService.rebase>[0]:undefined;
   if(autoRebase){const rebaseResult=candidateAutoRebaseService.rebase(autoRebase);coreExecutionTraceService.record(created.taskId,0,'CANDIDATE_AUTO_REBASE',{...rebaseResult});taskBlackboardService.post(created.taskId,rebaseResult.accepted?'RESULT':'OBSERVATION','core',rebaseResult.accepted?'CANDIDATE_REBASED':'CANDIDATE_REBASE_CONFLICT',rebaseResult,rebaseResult.invalidatedEvidenceIds);}

   const finalResidual=finalResidualServiceIntegrationService.inspect({capability:typeof payload.capability==='string'?payload.capability:undefined,claimText:typeof payload.claimText==='string'?payload.claimText:undefined,searchQuery:typeof payload.searchQuery==='string'?payload.searchQuery:undefined,searchFiles:Array.isArray(payload.searchFiles)?payload.searchFiles as Array<{path:string;content:string}>:undefined,workspacePaths:Array.isArray(payload.workspacePaths)?payload.workspacePaths.filter((value):value is string=>typeof value==='string'):undefined,unknown:payload.unknown&&typeof payload.unknown==='object'?payload.unknown as Record<string,unknown>:undefined});
   coreExecutionTraceService.record(created.taskId,0,'FINAL_RESIDUAL_SERVICE_INTEGRATION',finalResidual);
   const rejectedPaths=finalResidual.paths.filter(item=>!item.decision.allowed);
   if(rejectedPaths.length){taskBlackboardService.post(created.taskId,'OBSERVATION','core','WORKSPACE_PATH_BOUNDARY_GAPS',{rejectedPaths},[]);}
   const complexRequest=payload.complexCapability&&typeof payload.complexCapability==='object'?payload.complexCapability as Record<string,unknown>:undefined;
   if(complexRequest&&typeof complexRequest.capability==='string'){
    const contractCheck=complexCapabilityContractService.validate(complexRequest.capability,complexRequest);
    coreExecutionTraceService.record(created.taskId,0,'COMPLEX_CAPABILITY_CONTRACT_CHECK',contractCheck);
    if(!contractCheck.accepted){taskBlackboardService.post(created.taskId,'OBSERVATION','core','COMPLEX_CAPABILITY_INPUT_GAPS',contractCheck,[]);}
    else{taskBlackboardService.post(created.taskId,'OBSERVATION','core','COMPLEX_CAPABILITY_READY',{capability:complexRequest.capability,consumer:contractCheck.contract?.consumer,rollbackTarget:contractCheck.contract?.rollbackTarget,invalidationTargets:contractCheck.contract?.invalidationTargets},contractCheck.evidenceIds);}
   }
   coreExecutionTraceService.record(created.taskId,0,'SERVICE_CONNECTIVITY_AUDIT_25',{records:canonicalServiceAliasRegistryService.list(),parallelAuthoritiesBlocked:canonicalServiceAliasRegistryService.list().filter(item=>item.classification==='DUPLICATE_CONSOLIDATED').map(item=>item.service)});
   const residualSnapshot=residualCapabilityIntegrationService.snapshot({workspaceId:typeof payload.workspaceId==='string'?payload.workspaceId:undefined,candidateSha256:typeof payload.candidateSha256==='string'?payload.candidateSha256:undefined,preloadTypeScript:payload.preloadTypeScript===true,vbaRequirement:typeof payload.vbaRequirement==='string'?payload.vbaRequirement:undefined});
   coreExecutionTraceService.record(created.taskId,0,'RESIDUAL_CAPABILITY_INFORMATION_FLOW',residualSnapshot);
   const runId=typeof payload.runId==='string'?payload.runId:'';
   const workspaceId=typeof payload.workspaceId==='string'?payload.workspaceId:'';
   if(runId&&workspaceId){
    const constraintValidation=candidateConstraintValidationService.validate(runId,workspaceId);
    coreExecutionTraceService.record(created.taskId,0,'CANDIDATE_CONSTRAINT_VALIDATION',{passed:constraintValidation.passed,reasons:constraintValidation.reasons,runId,workspaceId});
    if(!constraintValidation.passed){
     taskBlackboardService.post(created.taskId,'OBSERVATION','core','CANDIDATE_CONSTRAINT_GAPS',{runId,workspaceId,reasons:constraintValidation.reasons},[]);
    }
   }
   const acceptanceBindings=Array.isArray(payload.acceptanceBindings)?payload.acceptanceBindings:[];
   const acceptanceTests=Array.isArray(payload.acceptanceTests)?payload.acceptanceTests:[];
   const candidateSha256=typeof payload.candidateSha256==='string'?payload.candidateSha256:'';
   if(acceptanceBindings.length&&candidateSha256){
    const acceptanceMatrix=acceptanceEvidenceMatrixService.evaluate(acceptanceBindings as never[],acceptanceTests as never[],candidateSha256);
    const acceptancePassed=acceptanceMatrix.every(row=>row.passed);
    coreExecutionTraceService.record(created.taskId,0,'ACCEPTANCE_EVIDENCE_MATRIX',{passed:acceptancePassed,rows:acceptanceMatrix,candidateSha256});
    if(!acceptancePassed){taskBlackboardService.post(created.taskId,'OBSERVATION','core','ACCEPTANCE_EVIDENCE_GAPS',{candidateSha256,rows:acceptanceMatrix},[]);}
   }
   if(payload.completeCandidate===true&&workspaceId){
    const maxRepairAttempts=typeof payload.maxRepairAttempts==='number'?payload.maxRepairAttempts:3;
    const completion=await candidateDevelopmentCompletionService.complete(workspaceId,maxRepairAttempts);
    coreExecutionTraceService.record(created.taskId,0,'CANDIDATE_DEVELOPMENT_COMPLETION',{passed:completion.passed,completionId:completion.completionId,finalWorkspaceId:completion.finalWorkspaceId,reasons:completion.reasons,reviewPackageId:completion.reviewPackage?.workspaceId});
    taskBlackboardService.post(created.taskId,completion.passed?'RESULT':'OBSERVATION','core','CANDIDATE_DEVELOPMENT_COMPLETION',{passed:completion.passed,completionId:completion.completionId,finalWorkspaceId:completion.finalWorkspaceId,reasons:completion.reasons,reviewPackageId:completion.reviewPackage?.workspaceId},[completion.completionId]);
   }
   if(payload.runWorkspaceE2E===true&&runId&&workspaceId){
    const workspaceE2E=await workspaceTscAndIsolationE2EService.verify(runId,workspaceId);
    coreExecutionTraceService.record(created.taskId,0,'WORKSPACE_TSC_ISOLATION_E2E',workspaceE2E);
    if(!workspaceE2E.passed){taskBlackboardService.post(created.taskId,'OBSERVATION','core','WORKSPACE_TSC_ISOLATION_GAPS',workspaceE2E,[]);}
   }
   if(payload.runAutonomousProofSuite===true){
    const proofResults=await autonomousE2EProofSuiteService.runAll();
    const proofPassed=proofResults.every(result=>result.passed);
    coreExecutionTraceService.record(created.taskId,0,'AUTONOMOUS_E2E_PROOF_SUITE',{passed:proofPassed,results:proofResults});
    if(!proofPassed){taskBlackboardService.post(created.taskId,'OBSERVATION','core','AUTONOMOUS_E2E_PROOF_GAPS',{results:proofResults},[]);}
   }
   const reviewZipBase64=typeof payload.reviewZipBase64==='string'?payload.reviewZipBase64:'';
   const expectedManifestId=typeof payload.expectedManifestId==='string'?payload.expectedManifestId:'';
   if(reviewZipBase64&&expectedManifestId){
    const manifestGate=await reviewManifestInclusionGateService.verify(reviewZipBase64,expectedManifestId);
    coreExecutionTraceService.record(created.taskId,0,'REVIEW_MANIFEST_INCLUSION_GATE',manifestGate);
    if(!manifestGate.passed){taskBlackboardService.post(created.taskId,'OBSERVATION','core','REVIEW_MANIFEST_GAPS',manifestGate,[]);}
   }
   const cumulativeWorkspaceIds=Array.isArray(payload.cumulativeWorkspaceIds)?payload.cumulativeWorkspaceIds.filter((value):value is string=>typeof value==='string'):[];
   if(payload.runCumulativeRevalidation===true&&cumulativeWorkspaceIds.length){
    const cumulative=await cumulativeRevalidationService.run(cumulativeWorkspaceIds);
    coreExecutionTraceService.record(created.taskId,0,'CUMULATIVE_REVALIDATION',{...cumulative});
    if(!cumulative.passed){taskBlackboardService.post(created.taskId,'OBSERVATION','core','CUMULATIVE_REVALIDATION_GAPS',cumulative,[]);}
   }
   const reviewPackageSha=typeof payload.reviewPackageSha==='string'?payload.reviewPackageSha:'';
   const canaryChecks=payload.canaryChecks&&typeof payload.canaryChecks==='object'?payload.canaryChecks:undefined;
   if(payload.runCanaryVerification===true&&workspaceId&&reviewPackageSha&&canaryChecks){
    const canary=await canaryPostReviewVerificationService.dryRun(workspaceId,reviewPackageSha,canaryChecks as never);
    coreExecutionTraceService.record(created.taskId,0,'CANARY_POST_REVIEW_VERIFICATION',canary);
    if(!canary.passed){taskBlackboardService.post(created.taskId,'OBSERVATION','core','CANARY_VERIFICATION_GAPS',canary,[]);}
   }
   const handoffAudit=advancedPipelineHandoffAuditService.audit();
   coreExecutionTraceService.record(created.taskId,0,'SELF_IMPROVEMENT_HANDOFF_AUDIT',{passed:handoffAudit.passed,reasons:handoffAudit.reasons,checks:handoffAudit.checks});
   if(!handoffAudit.passed){
    taskBlackboardService.post(created.taskId,'OBSERVATION','core','SELF_IMPROVEMENT_HANDOFF_GAPS',{reasons:handoffAudit.reasons,checks:handoffAudit.checks},[]);
   }
   try{
    const { selfImprovementControllerService } = await import('../../improvement/services/selfImprovementControllerService');
    const directiveId=typeof payload.directiveId==='string'&&payload.directiveId.trim()
      ? payload.directiveId.trim()
      : undefined;
    selfImprovementControllerService.recordCanonicalRun(
      created.taskId,
      directiveId ? `CORE_SELF_IMPROVEMENT:${directiveId}` : 'CORE_SELF_IMPROVEMENT',
      `status=${created.status};taskRevision=${created.revision};cycle=${created.lastCycle};phase=TASK_CREATED`,
      {
       action:'AUTONOMOUS_CODE_EVOLUTION',
       reason:'Canonical CORE self-improvement TASK persisted immediately at creation boundary'
      }
    );
    await storageService.flushNow();
   }catch(error){
    console.warn('[CORE] failed to persist initial self-improvement canonical history',error);
   }
  }

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

  const cancelFromSignal=()=>{this.cancel(created.taskId);};
  if(signal){
   signal.addEventListener('abort',cancelFromSignal,{once:true});
   if(signal.aborted)cancelFromSignal();
  }
  const afterSignal=taskBlackboardService.get(created.taskId);
  if(afterSignal?.status==='CANCELLED'){
   if(signal)signal.removeEventListener('abort',cancelFromSignal);
   return {task:afterSignal,cycles:0,dispatched:0,coreResult:coreResultService.get(requestId)};
  }
  return this.continueTask(created.taskId,maxCycles,requestId).finally(()=>{
   if(signal)signal.removeEventListener('abort',cancelFromSignal);
  });
 }
 async resumeFromExecutionEvent(taskId:string,maxCycles=18):Promise<CoreOrchestrationResult|undefined>{
  const currentTask=taskBlackboardService.get(taskId);
  if(!currentTask)return undefined;
  if(currentTask.status==='COMPLETED'||currentTask.status==='CANCELLED')return undefined;
  const checkpointValidation=this.validateCognitiveCheckpointForResume(currentTask);
  if(!checkpointValidation.ok){
   taskBlackboardService.append(taskId,'ERROR','core','cognitiveCheckpointResumeRejected',{reason:checkpointValidation.reason,source:'executionEvent',failClosed:true});
   systemLogger.error('SYSTEM',`[CORE_RESUME_REJECTED] Cognitive checkpoint invalid for ${taskId}: ${checkpointValidation.reason}`);
   return undefined;
  }
  const reqId=this.resolveRequestId(currentTask,taskId);
  if(currentTask.status==='PAUSED'){
   const resumed=taskBlackboardService.resume(taskId);
   if(!resumed)return undefined;
  }else{
   taskBlackboardService.setStatus(taskId,'ROUTING');
  }
  taskBlackboardService.append(taskId,'DECISION','core','coreExecutionEventResumed',{
    mode:'CORE_18_DOMAIN_ORCHESTRATION',
    requestId:reqId,
    source:'executionEvent'
  });
  coreResultService.updateStatus(reqId,'processing',{route:['core','execution']});
  return this.continueTask(taskId,maxCycles,reqId);
 }
 async resume(taskId:string,maxCycles=18,allowRoutingRecovery=false):Promise<CoreOrchestrationResult|undefined>{
  const currentTask=taskBlackboardService.get(taskId);
  if(!currentTask)return undefined;
  const checkpointValidation=this.validateCognitiveCheckpointForResume(currentTask);
  if(!checkpointValidation.ok){
   taskBlackboardService.append(taskId,'ERROR','core','cognitiveCheckpointResumeRejected',{reason:checkpointValidation.reason,source:'manualResume',failClosed:true});
   systemLogger.error('SYSTEM',`[CORE_RESUME_REJECTED] Cognitive checkpoint invalid for ${taskId}: ${checkpointValidation.reason}`);
   return undefined;
  }
  const reqId=this.resolveRequestId(currentTask,taskId);
  const resumed=taskBlackboardService.resume(taskId,allowRoutingRecovery);if(!resumed)return undefined;
  taskBlackboardService.append(taskId,'DECISION','core','coreResumed',{mode:'CORE_18_DOMAIN_ORCHESTRATION',requestId:reqId,recovery:allowRoutingRecovery&&currentTask?.status==='ROUTING'});
  coreResultService.updateStatus(reqId,'processing',{route:['core']});
  return this.continueTask(taskId,maxCycles,reqId)
    .then((result)=>{
      systemLogger.info(
        'SYSTEM',
        `[RUNTIME] CORE task end: ${result.task.status} (${result.task.taskId})`,
        {cycles:result.cycles,dispatched:result.dispatched},
      );

      if(result.task.status==='FAILED'){
        const task=result.task;
        const payloadValue=task.entries.find(entry=>entry.kind==='INPUT'&&entry.key==='payload')?.value;
        const payload=payloadValue&&typeof payloadValue==='object'&&!Array.isArray(payloadValue)
          ? payloadValue as Record<string,unknown> : {};
        const unknowns=[...new Set(task.entries.flatMap(entry=>{
          const value=entry.value;
          if(!value || typeof value!=='object') return [];
          const candidate=(value as Record<string,unknown>).unknowns;
          return Array.isArray(candidate) ? candidate.map(String) : [];
        }))];

        systemLogger.error(
          'SYSTEM',
          `[RUNTIME_FAILURE] CORE task stopped: ${task.taskId}`,
          {
            taskId:task.taskId,
            runId:typeof payload.runId==='string'?payload.runId:undefined,
            goal:task.goal,
            source:task.source,
            status:task.status,
            revision:task.revision,
            lastCycle:task.lastCycle,
            visitedDomains:[...task.visitedDomains],
            pendingDomains:[...task.pendingDomains],
            evidenceIds:[...new Set(task.entries.flatMap(entry=>entry.evidenceIds||[]))],
            unknowns,
            lastEntries:task.entries.slice(-15).map(entry=>({
              kind:entry.kind,
              domain:entry.domain,
              key:entry.key,
              evidenceIds:entry.evidenceIds,
              value:entry.value,
            })),
          },
        );
      }
      return result;
    })
    .catch((error)=>{
      const task=taskBlackboardService.get(taskId);
      const failureTask=task??resumed;
      const payloadValue=failureTask.entries.find(entry=>entry.kind==='INPUT'&&entry.key==='payload')?.value;
      const payload=payloadValue&&typeof payloadValue==='object'&&!Array.isArray(payloadValue)
        ? payloadValue as Record<string,unknown> : {};
      systemLogger.error(
        'SYSTEM',
        `[RUNTIME_FAILURE] CORE task threw: ${taskId}`,
        {
          taskId,
          requestId:reqId,
          runId:typeof payload.runId==='string'?payload.runId:undefined,
          goal:failureTask.goal,
          source:failureTask.source,
          error:error instanceof Error?`${error.name}: ${error.message}`:String(error),
          stack:error instanceof Error?error.stack:undefined,
          status:task?.status,
          revision:task?.revision,
          lastCycle:task?.lastCycle,
          visitedDomains:task ? [...task.visitedDomains]:[],
          pendingDomains:task ? [...task.pendingDomains]:[],
          evidenceIds:task ? [...new Set(task.entries.flatMap(entry=>entry.evidenceIds||[]))]:[],
          lastEntries:task?.entries.slice(-20).map(entry=>({
            kind:entry.kind,
            domain:entry.domain,
            key:entry.key,
            evidenceIds:entry.evidenceIds,
            value:entry.value,
          })),
        },
      );
      throw error;
    });
 }
 pause(taskId:string,reason?:string){
  const currentTask=taskBlackboardService.get(taskId);
  const reqId=this.resolveRequestId(currentTask,taskId);
  coreResultService.waiting(reqId,{error:reason||'Task paused'});
  return taskBlackboardService.pause(taskId,reason);
 }
 cancel(taskId:string){
  const currentTask=taskBlackboardService.get(taskId);
  if(!currentTask||currentTask.status==='COMPLETED')return undefined;
  if(currentTask.status==='CANCELLED')return currentTask;
  const reqId=this.resolveRequestId(currentTask,taskId);
  const cancelled=taskBlackboardService.cancel(taskId);
  if(!cancelled)return undefined;
  coreResultService.rejected(reqId,'Task cancelled');
  return cancelled;
 }
 finalizeConversationResponse(taskId:string,response:unknown,validation:{passed:boolean;failedReasons:string[]}):CoreOrchestrationResult|undefined{
  const currentTask=taskBlackboardService.get(taskId);
  if(!currentTask)return undefined;
  const reqId=this.resolveRequestId(currentTask,taskId);
  const cycles=currentTask.lastCycle||0;
  const replyRecords=domainReplyLedgerService.listByTask(taskId);
  taskBlackboardService.append(taskId,validation.passed?'RESULT':'OBSERVATION','core','conversationResponseFinalized',{
   response,finalizedBy:'core',requestId:reqId,cycles,dispatched:replyRecords.length,
   answerValidation:{passed:validation.passed,failedReasons:[...validation.failedReasons]}
  });
  if(validation.passed){
   taskBlackboardService.append(taskId,'RESULT','core','conversationFinalResponse',{
    response,finalizedBy:'core',requestId:reqId,answerValidated:true,validationReasons:[]
   });
  }
  const assessedTask=taskBlackboardService.get(taskId)!;
  const completion=adaptiveRoutePlannerService.assessCompletion(assessedTask);
  const completed=validation.passed&&completion.businessCompletion;
  const payload={...this.buildRuntimeCirculationResult(assessedTask,cycles,replyRecords.length,completion.requiredDomains),response,conversationFinalized:true,finalizedBy:'core',answerValidated:validation.passed,completionReasons:completion.reasons};
  if(completed){
   taskBlackboardService.setStatus(taskId,'COMPLETED');
   const finalTask=taskBlackboardService.get(taskId)!;
   const coreResult=coreResultService.complete(reqId,payload,{route:['core'],processedCategories:['conversation']});
   this.recordTaskMemoryOutcome(finalTask,'SUCCESS');
   return {task:finalTask,cycles,dispatched:replyRecords.length,coreResult};
  }
  if(!validation.passed){
   taskBlackboardService.setStatus(taskId,'FAILED');
   const finalTask=taskBlackboardService.get(taskId)!;
   const coreResult=coreResultService.fail(reqId,`CONVERSATION_ANSWER_VALIDATION_FAILED:${validation.failedReasons.join('|')||'UNKNOWN'}`,{result:payload,route:['core'],processedCategories:['conversation']});
   this.recordTaskMemoryOutcome(finalTask,'FAILURE');
   return {task:finalTask,cycles,dispatched:replyRecords.length,coreResult};
  }
  taskBlackboardService.pause(taskId,`CONVERSATION_COMPLETION_GATE_FAILED:${completion.reasons.join('|')||'UNKNOWN'}`);
  const finalTask=taskBlackboardService.get(taskId)!;
  const coreResult=coreResultService.waiting(reqId,{result:payload,route:['core'],processedCategories:['conversation'],error:'CONVERSATION_COMPLETION_GATE_FAILED'});
  return {task:finalTask,cycles,dispatched:replyRecords.length,coreResult};
 }

 private recordTaskMemoryOutcome(task:BlackboardTask,outcome:'SUCCESS'|'FAILURE'):void{
  const memoryIds=new Set<string>();
  for(const entry of task.entries){
   if(entry.kind!=='DECISION'||!entry.key.startsWith('cognitiveState:')||!entry.value||typeof entry.value!=='object'||Array.isArray(entry.value))continue;
   const ids=(entry.value as Record<string,unknown>).evidenceIds;
   if(Array.isArray(ids))for(const id of ids)if(typeof id==='string'&&id.startsWith('MEM-'))memoryIds.add(id);
  }
  if(memoryIds.size)memoryContextBridgeService.recordOutcome([...memoryIds],outcome,`${task.taskId}:${outcome}`);
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
  const explanationPlan=payload.explanationPlan&&typeof payload.explanationPlan==='object'&&!Array.isArray(payload.explanationPlan)?payload.explanationPlan as Record<string,unknown>:undefined;
  if(explanationPlan)semanticContext.push(`ANSWER_DETAIL_PLAN|level=${String(explanationPlan.level||'STANDARD')}|rationale=${JSON.stringify(explanationPlan.rationale||[])}`);
  const clarificationPlan=payload.clarificationPlan&&typeof payload.clarificationPlan==='object'&&!Array.isArray(payload.clarificationPlan)?payload.clarificationPlan as Record<string,unknown>:undefined;
  const selectedClarification=clarificationPlan?.selected&&typeof clarificationPlan.selected==='object'&&!Array.isArray(clarificationPlan.selected)?clarificationPlan.selected as Record<string,unknown>:undefined;
  if(selectedClarification)semanticContext.push(`INFORMATION_GAIN_CLARIFICATION|question=${String(selectedClarification.question||'')}|score=${String(selectedClarification.score||0)}|must_not_guess=true`);
  const potentialUnknowns=Array.isArray(payload.potentialUnknownCandidates)?payload.potentialUnknownCandidates.filter((value):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value))):[];
  if(potentialUnknowns.length)semanticContext.push(`POTENTIAL_UNKNOWN_HYPOTHESES|candidates=${JSON.stringify(potentialUnknowns.slice(0,12))}|must_research_and_verify=true`);
  const learningOpportunities=Array.isArray(payload.learningOpportunities)?payload.learningOpportunities.filter((value):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value))):[];
  if(learningOpportunities.length)semanticContext.push(`LEARNING_OPPORTUNITY_CANDIDATES|candidates=${JSON.stringify(learningOpportunities.slice(0,12))}|requires_outcome_evaluation=true`);
  const transferCandidates=Array.isArray(payload.crossDomainTransferCandidates)?payload.crossDomainTransferCandidates.filter((value):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value))):[];
  if(transferCandidates.length)semanticContext.push(`CROSS_DOMAIN_TRANSFER_CANDIDATES|candidates=${JSON.stringify(transferCandidates.slice(0,12))}|reuse_is_hypothesis_until_target_outcome_is_verified=true`);
  const intentPlan=payload.intentPlan&&typeof payload.intentPlan==='object'&&!Array.isArray(payload.intentPlan)?payload.intentPlan as Record<string,unknown>:undefined;
  if(intentPlan)semanticContext.push(`MULTI_INTENT_PLAN|planKey=${String(intentPlan.deterministicKey||'')}|units=${JSON.stringify(Array.isArray(intentPlan.units)?intentPlan.units:[])}`);

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
    const budgetCheckedAt=Date.now();
    const resourceSnapshot=resourceGovernanceService.getSnapshot();
    const budget=resourceGovernanceService.assessBackgroundBudget(
      true,
      false,
      cycles,
      taskBlackboardService.backgroundBudgetWindowStartedAt(taskId),
      budgetCheckedAt,
      cycleLimit
    );

    const budgetDiagnostic={
      schemaVersion:1,
      taskId,
      requestId:reqId,
      cycle:cycles,
      budgetCycle:cycles,
      taskCreatedAt:currentBeforeState.createdAt,
      budgetWindowStartedAt:taskBlackboardService.backgroundBudgetWindowStartedAt(taskId),
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
        result:{budgetDiagnostic},
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
   try {
    const checkpointEntries=stateBase.entries.filter(entry=>entry.kind==='CHECKPOINT'&&entry.key.startsWith('cognitiveStateCheckpoint:'));
    const priorCheckpointValue=checkpointEntries.at(-1)?.value;
    const priorCheckpointId=priorCheckpointValue&&typeof priorCheckpointValue==='object'&&!Array.isArray(priorCheckpointValue)&&typeof (priorCheckpointValue as Record<string,unknown>).id==='string'?String((priorCheckpointValue as Record<string,unknown>).id):undefined;
    const priorChain=priorCheckpointId?cognitiveStateCheckpointService.chain(priorCheckpointId):undefined;
    if(priorCheckpointId&&(!priorChain||!priorChain.ok))throw new Error('COGNITIVE_CHECKPOINT_PARENT_CHAIN_INVALID');
    const compactCheckpointChain=Boolean(priorChain?.ok&&(priorChain.checkpoints.length>=50||priorChain.checkpoints.some(item=>item.hashAlgorithm!=='CANONICAL_SHA256_V1')));
    const checkpointParentId=compactCheckpointChain?undefined:priorCheckpointId;
    const priorEvidenceIds=new Set(compactCheckpointChain?[]:(priorChain?.ok?priorChain.checkpoints:[]).flatMap(item=>item.addedEvidence));
    const newlyAddedEvidence=compactCheckpointChain?[...cognitiveState.evidenceIds]:cognitiveState.evidenceIds.filter(id=>!priorEvidenceIds.has(id));
    const checkpoint=cognitiveStateCheckpointService.create({parentCheckpointId:checkpointParentId,baseSnapshotId:`${cognitiveState.stateId}:${cognitiveState.stateHash}`,changedFacts:[cognitiveState.semanticCoreHash||cognitiveState.stateHash,...(compactCheckpointChain&&priorChain?.ok?[`COMPACTED_PARENT_CHAIN:${canonicalSha256Object(priorChain.checkpoints.map(item=>item.stateHash))}`]:[])],addedEvidence:newlyAddedEvidence,invalidatedAssumptions:[...new Set(cognitiveState.contradictions||[])],supersededRequirements:[],taskStateChanges:[`status:${stateBase.status}`,`cycle:${cycles}`,`revision:${stateBase.revision}`],memoryStateChanges:[...new Set(cognitiveState.evidenceIds.filter(id=>id.startsWith('MEM-')))],skillStateChanges:[...cognitiveState.capabilityRefs],artifactReferences:[...new Set(stateBase.entries.filter(entry=>/artifact|candidate|reviewPackage/i.test(entry.key)).map(entry=>entry.id))],configurationChanges:[],layer:'HOT'});
    taskBlackboardService.append(taskId,'CHECKPOINT','core',`cognitiveStateCheckpoint:${cycles}`,{id:checkpoint.id,stateHash:checkpoint.stateHash,integrityHash:checkpoint.integrityHash,verified:checkpoint.verified,baseSnapshotId:checkpoint.baseSnapshotId,parentCheckpointId:checkpoint.parentCheckpointId},cognitiveState.evidenceIds);
   } catch(error) {
    taskBlackboardService.append(taskId,'ERROR','core',`cognitiveStateCheckpointPersistFailed:${cycles}`,{error:error instanceof Error?error.message:String(error),stateId:cognitiveState.stateId,stateHash:cognitiveState.stateHash,action:'PERSISTENCE_RETRY_REQUIRED'},cognitiveState.evidenceIds);
   }
   await this.assessCoreMemoryContext(stateBase,currentPayload,cycles);
   if(taskBlackboardService.get(taskId)?.status==='CANCELLED')break coreCycle;
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
   const goalDecision=await rustCoreDecisionKernelService.resolveGoalConflicts(current);
   if(goalDecision.conflictDetected){
    taskBlackboardService.append(taskId,'DECISION','core',`goalConflictResolution:${cycles}`,{
      selectedGoalId:goalDecision.selectedGoalId,
      selectedGoal:goalDecision.selectedGoal,
      pausedGoalIds:goalDecision.pausedGoalIds,
      blockedGoalIds:goalDecision.blockedGoalIds,
      decisions:goalDecision.decisions,
      ruleVersion:'RUST_CORE_KERNEL_V1'
    });
   }
   const planningTask=goalDecision.selectedGoal!==current.goal
     ? {...current,goal:goalDecision.selectedGoal}
     : current;
   let routes=adaptiveRoutePlannerService.plan(planningTask).filter(route=>{
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
   const domainParticipation=await rustDomainParticipationKernelService.rank(routes);
   if(taskBlackboardService.get(taskId)?.status==='CANCELLED')break coreCycle;
   routes=domainParticipation.routes;
   taskBlackboardService.append(taskId,'DECISION','core',`rustDomainParticipation:${cycles}`,{
     participatingDomains:domainParticipation.participatingDomains,
     skippedDuplicateIndexes:domainParticipation.skippedDuplicateIndexes,
     workerDomainCount:17,
     ruleVersion:'RUST_DOMAIN_KERNEL_V1'
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
          operationInstanceId:route.payload.operationInstanceId,
          supersedesOperationInstanceIds:Array.isArray(route.payload.supersedesOperationInstanceIds)?route.payload.supersedesOperationInstanceIds.map(String):[],
          operationScopeKey:typeof route.payload.operationScopeKey==='string'?route.payload.operationScopeKey:'',
          planRevision:route.payload.planRevision,
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
      if(taskBlackboardService.get(taskId)?.status==='CANCELLED')break coreCycle;

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
          supersedesOperationInstanceIds:Array.isArray(route.payload.supersedesOperationInstanceIds)?route.payload.supersedesOperationInstanceIds.map(String):[],
          operationScopeKey:typeof route.payload.operationScopeKey==='string'?route.payload.operationScopeKey:'',
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

    if(taskBlackboardService.get(taskId)?.status==='CANCELLED')break coreCycle;
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
    let reply: Awaited<ReturnType<typeof domainRouterService.dispatch>>;
    try{
      reply=await domainRouterService.dispatch(envelope);
      if(taskBlackboardService.get(taskId)?.status==='CANCELLED')break coreCycle;
    }catch(error){
      const task=taskBlackboardService.get(taskId);
      systemLogger.error(
        'SYSTEM',
        `[RUNTIME_FAILURE] domain dispatch threw: ${taskId}`,
        {
          taskId,
          cycle:cycles,
          target:route.target,
          command:route.command,
          operationInstanceId:route.payload.operationInstanceId,
          envelopeId:envelope.envelopeId,
          error:error instanceof Error?`${error.name}: ${error.message}`:String(error),
          stack:error instanceof Error?error.stack:undefined,
          status:task?.status,
          revision:task?.revision,
          visitedDomains:task ? [...task.visitedDomains]:[],
          pendingDomains:task ? [...task.pendingDomains]:[],
          evidenceIds:task ? [...new Set(task.entries.flatMap(entry=>entry.evidenceIds||[]))]:[],
          lastEntries:task?.entries.slice(-15).map(entry=>({
            kind:entry.kind,
            domain:entry.domain,
            key:entry.key,
            evidenceIds:entry.evidenceIds,
            value:entry.value,
          })),
        },
      );
      throw error;
    }
    dispatched+=1;

    if(reply.accepted){
      systemLogger.info(
        'SYSTEM',
        `[RUNTIME] dispatch OK: ${route.target}.${route.command}`,
      );
    }else{
      systemLogger.warn(
        'SYSTEM',
        `[RUNTIME] dispatch rejected: ${route.target}.${route.command}`,
      );
    }

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
      accepted:reply.accepted,
      normalizedStatus:reply.normalized?.status,
      normalizedOperationClass:reply.normalized?.operationClass
    });
    const operationClass=reply.normalized?.operationClass||'BUSINESS';
    const resultKind=operationClass==='DIAGNOSTIC'?'OBSERVATION':(reply.accepted?'RESULT':'ERROR');

    coreExecutionTraceService.record(taskId,cycles,'REPLY_NORMALIZED',{
      command:route.command,
      target:route.target,
      accepted:reply.accepted,
      operationClass,
      normalizedStatus:reply.normalized?.status,
      normalizedOperation:reply.normalized?.command,
      normalizedEvidenceIds:reply.normalized?.evidenceIds,
      normalizedReceiptIds:replyRecord.receiptIds,
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
    const resultWrite=taskBlackboardService.appendIfRevision(taskId,expectedRevision,resultKind,route.target,`${resultKind==='OBSERVATION'?'domainObservation':'domainResult'}:${route.target}:${route.command}`,{schemaVersion:3,collectedBy:'core',coreCollected:true,sourceDomain:route.target,producerId:'domainRouterService',dispatchId:envelope.envelopeId,replyId:replyRecord.replyId,operation:route.command,operationInstanceId:route.payload.operationInstanceId,supersedesOperationInstanceIds:Array.isArray(route.payload.supersedesOperationInstanceIds)?route.payload.supersedesOperationInstanceIds.map(String):[],operationScopeKey:typeof route.payload.operationScopeKey==='string'?route.payload.operationScopeKey:'',planRevision:route.payload.planRevision,intentPlanKey:route.payload.intentPlanKey,intentHypothesisId:route.payload.intentHypothesisId,intentHypothesisKind:route.payload.intentHypothesisKind,intentIds:Array.isArray(route.payload.intentIds)?route.payload.intentIds.map(String):[],planSha256:route.payload.planSha256,idempotencyKey:typeof route.payload.idempotencyKey==='string'?route.payload.idempotencyKey:'',operationClass,reply:reply.normalized||reply.error,auditTag:'coreCollected:'},replyRecord.evidenceIds);
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
        result:{
          operation:route.command,
          operationInstanceId:route.payload.operationInstanceId,
          normalizedStatus
        }
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
   // 進行中のawaitから戻った後に取消済みなら、遅延した完了判定で上書きしない。
   if(taskBlackboardService.get(taskId)?.status==='CANCELLED')break coreCycle;
   if(completion.businessCompletion){
    taskBlackboardService.append(taskId,'RESULT','core','coreCompletion',{completedBy:'core',cycle:cycles,failClosed:true,requiredDomains:completion.requiredDomains});
    taskBlackboardService.setStatus(taskId,'COMPLETED');
    break;
   }
  }
  const finalTask=taskBlackboardService.get(taskId)!;
  if(finalTask.status==='ROUTING'){
   const hasError=unresolvedTaskErrors(finalTask).length>0;
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
  const settledTask=taskBlackboardService.get(taskId)!;
  if(settledTask.status==='COMPLETED')this.recordTaskMemoryOutcome(settledTask,'SUCCESS');
  else if(settledTask.status==='FAILED')this.recordTaskMemoryOutcome(settledTask,'FAILURE');
  return {task:settledTask,cycles,dispatched,coreResult:coreResultService.get(reqId)};
 }
 private buildIncompleteCirculationResult(task:BlackboardTask,cycles:number,dispatched:number,completion:ReturnType<typeof adaptiveRoutePlannerService.assessCompletion>):Record<string,unknown>{
  const replyRecords=domainReplyLedgerService.listByTask(task.taskId);
  const lastDecision=task.entries.filter(entry=>entry.domain==='core'&&entry.kind==='DECISION').at(-1);
  const lineage=coreLineageReadModelService.verify(task,{replyIds:replyRecords.map(record=>record.replyId),evidenceIds:[...new Set(replyRecords.flatMap(record=>record.evidenceIds))],receiptIds:[...new Set(replyRecords.flatMap(record=>record.receiptIds))],decisionId:lastDecision?.id});
  const plan=corePlanRevisionService.latest(task);
  const currentOperation=plan?.requiredOperations.find(operation=>operation.status==='RUNNING')||plan?.requiredOperations.find(operation=>operation.status==='PENDING'||operation.status==='BLOCKED');
  const synthesisResults=task.entries
    .filter(entry=>entry.domain==='core'&&(entry.kind==='RESULT'||entry.kind==='ERROR')&&(entry.value&&typeof entry.value==='object'&&!Array.isArray(entry.value)?entry.value as Record<string,unknown>:undefined)?.operation==='SYNTHESIZE_UNIVERSAL')
    .map(entry=>(entry.value&&typeof entry.value==='object'&&!Array.isArray(entry.value)?entry.value as Record<string,unknown>:undefined))
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
    .filter(entry=>entry.domain==='core'&&(entry.kind==='RESULT'||entry.kind==='ERROR')&&(entry.value&&typeof entry.value==='object'&&!Array.isArray(entry.value)?entry.value as Record<string,unknown>:undefined)?.operation==='SYNTHESIZE_UNIVERSAL')
    .map(entry=>(entry.value&&typeof entry.value==='object'&&!Array.isArray(entry.value)?entry.value as Record<string,unknown>:undefined))
    .filter(Boolean);
  const cognitiveState=this.latestUnifiedCognitiveState(task);return {taskId:task.taskId,operationId:this.readPayloadString(task,'operationId')||this.readPayloadString(task,'operation')||task.taskId,commandId:this.readPayloadString(task,'uiCommandId')||this.readPayloadString(task,'commandId'),cycles,dispatched,status:'COMPLETED',taskRevision:task.revision,corePlanRevision:plan?.planRevision,cognitiveStateId:cognitiveState?.stateId,cognitiveStateRevision:cognitiveState?.revision,currentOperationInstanceId:currentOperation?.operationInstanceId,currentBusinessStage:currentOperation?.operation,nextOperationInstanceId:plan?.requiredOperations.find(operation=>operation.status==='PENDING'&&operation.operationInstanceId!==currentOperation?.operationInstanceId)?.operationInstanceId,requiredDomains,selectedClassificationIds:[...task.visitedDomains],replyIds:lineage.verifiedReplyIds,evidenceIds:lineage.verifiedEvidenceIds,decisionId:lineage.verifiedDecisionId,persistenceReceiptIds:lineage.verifiedReceiptIds,lineageVerified:lineage.lineageVerified,rejectedLineageIds:{replyIds:lineage.rejectedReplyIds,evidenceIds:lineage.rejectedEvidenceIds,receiptIds:lineage.rejectedReceiptIds,decisionIds:lineage.rejectedDecisionIds},unknowns,failures,synthesisResults,latestSynthesisResult:synthesisResults.at(-1)||null,cognitiveState};
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
   if(Array.isArray(values)) return [...new Set(values.filter((item):item is string=>typeof item==="string"&&Boolean(item.trim())).map(item=>item.trim()))];
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
  const predictedUnknowns=Array.isArray(payloadObject.potentialUnknownCandidates)?payloadObject.potentialUnknownCandidates.filter((value):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value))).map(value=>`POTENTIAL_UNKNOWN:${String(value.term||'')}`).filter(value=>!value.endsWith(':')):[];
  const unknowns=[...new Set([...this.collectUnresolved(task,/unknown|gap|missing|unresolved|blocked/i),...predictedUnknowns])].slice(0,80);
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
  const hypotheses=Array.isArray(intentPlanValue?.hypotheses)?intentPlanValue.hypotheses.filter((item):item is Record<string,unknown>=>Boolean(item&&typeof item==='object')).map(item=>({id:String(item.id||''),kind:String(item.kind||'UNKNOWN'),confidence:Math.max(0,Math.min(1,Number(item.confidence)||0)),rationale:String(item.rationale||'')})).filter(item=>item.id).slice(0,24):[];
  const actions=task.entries.filter(entry=>entry.kind==='DECISION'||entry.kind==='RESULT').map(entry=>`${entry.domain}:${entry.key}`).slice(-80);
  const safetyConstraints=[...new Set([...constraints,...task.entries.filter(entry=>entry.domain==='safety'||/safety|prohibit|invariant|permission|approval/i.test(entry.key)).map(entry=>entry.key)])].slice(0,80);
  const contradictions=task.entries.filter(entry=>/contradict|conflict|counterexample|dispute/i.test(entry.key)).map(entry=>`${entry.domain}:${entry.key}`).slice(-40);
  const failureRefs=task.entries.filter(entry=>entry.kind==='ERROR'||/failure|failed|blocked|rejected/i.test(entry.key)).map(entry=>`${entry.id}:${entry.key}`).slice(-60);
  const learningRefs=task.entries.filter(entry=>entry.domain==='learning'||/learning|learn|causal|transfer|lesson/i.test(entry.key)).map(entry=>`${entry.id}:${entry.key}`).slice(-60);
  const verifiedOutcomes=task.entries.filter(entry=>entry.kind==='RESULT'&&entry.evidenceIds.length>0&&/verified|passed|completed/i.test(entry.key)).length;
  const latestEntry=[...task.entries].reverse().find(entry=>['RESULT','ERROR','OBSERVATION'].includes(entry.kind));
  const latestValue=latestEntry?.value&&typeof latestEntry.value==='object'&&!Array.isArray(latestEntry.value)?latestEntry.value as Record<string,unknown>:{};
  const completedIntentIds=new Set(task.entries.filter(entry=>entry.kind==='RESULT').flatMap(entry=>{ const value=entry.value&&typeof entry.value==='object'&&!Array.isArray(entry.value)?entry.value as Record<string,unknown>:{}; return Array.isArray(value.intentIds)?value.intentIds.filter((x):x is string=>typeof x==='string'):[]; }));
  const pendingIntentIds=intentUnits.map(unit=>typeof unit.id==='string'?unit.id:'').filter(id=>Boolean(id)&&!completedIntentIds.has(id));
  const governedMemory=memoryContextBridgeService.cognitiveEvidence({scopeType:'TASK',scopeId:task.taskId,limit:80});
  const actionLineage=actionLineageService.summarizeTask(task.taskId);
  const lineageEvidenceIds=[...new Set(actionLineage.actions.flatMap(action=>action.evidenceIds))];
  const lineageUnknowns=actionLineage.failed+actionLineage.rejected>0?[`ACTION_LINEAGE_FAILURES:${actionLineage.failed+actionLineage.rejected}`]:[];
  const mergedEvidenceIds=[...new Set([...evidenceIds,...governedMemory.evidenceIds,...governedMemory.memoryIds,...lineageEvidenceIds])];
  const base={schemaVersion:2 as const,stateId:`CSTATE-${task.taskId}`,taskId:task.taskId,cycle,revision:task.revision,goal:task.goal,input,source:String(task.source),constraints:[...new Set([...constraints,...governedMemory.constraints])],activeDomains:[...task.visitedDomains],requiredDomains:[...new Set(requiredDomains)],pendingIntentIds:[...new Set(pendingIntentIds)],evidenceIds:mergedEvidenceIds,unknowns:[...new Set([...unknowns,...lineageUnknowns])],capabilityRefs,hypothesisRefs:hypotheses,actionRefs:actions,safetyConstraints,contradictions,confidenceSummary:{knownEvidence:mergedEvidenceIds.length,unresolvedUnknowns:[...new Set([...unknowns,...lineageUnknowns])].length,failedActions:actionLineage.failed+actionLineage.rejected,verifiedOutcomes},activeTask:{status:task.status,pausedReason:task.pausedReason,resumeCount:task.resumeCount,lastCycle:task.lastCycle},latestOutcome:latestEntry?{kind:latestEntry.kind,domain:latestEntry.domain,key:latestEntry.key,status:typeof latestValue.status==='string'?latestValue.status:undefined}:undefined,failureRefs,learningRefs,semanticCoreHash:canonicalSha256Object({goal:task.goal,constraints:[...new Set([...constraints,...governedMemory.constraints])],evidenceIds:mergedEvidenceIds,unknowns:[...new Set([...unknowns,...lineageUnknowns])]}),recentOutcomes,learningCandidates,environmentSignature:undefined as string|undefined,invariantsVersion:1 as const};
  return {...base,stateHash:canonicalSha256Object(base)};
 }

 private validateCognitiveCheckpointForResume(task:BlackboardTask):{ok:boolean;reason:string}{
  const states=task.entries.filter(entry=>entry.kind==='DECISION'&&entry.domain==='core'&&entry.key.startsWith('cognitiveState:'));
  const checkpoints=task.entries.filter(entry=>entry.kind==='CHECKPOINT'&&entry.key.startsWith('cognitiveStateCheckpoint:'));
  if(states.length===0&&checkpoints.length===0)return {ok:true,reason:'NO_COGNITIVE_STATE_TO_RESTORE'};
  if(states.length===0)return {ok:false,reason:'COGNITIVE_STATE_SNAPSHOT_MISSING'};
  const latestStateEntry=states.at(-1);
  const latestStateValue=latestStateEntry?.value;
  if(!latestStateValue||typeof latestStateValue!=='object'||Array.isArray(latestStateValue))return {ok:false,reason:'COGNITIVE_STATE_SNAPSHOT_INVALID'};
  const latestState=latestStateValue as Partial<UnifiedCognitiveStateSnapshot>;
  const recordedStateHash=typeof latestState.stateHash==='string'?latestState.stateHash:'';
  const {stateHash:_discardedStateHash,...snapshotBody}=latestState as Record<string,unknown>;
  if(!/^[a-f0-9]{64}$/i.test(recordedStateHash)||canonicalSha256Object(snapshotBody)!==recordedStateHash){
   return {ok:false,reason:'BLACKBOARD_COGNITIVE_SNAPSHOT_HASH_MISMATCH'};
  }

  const latestCheckpointValue=checkpoints.at(-1)?.value;
  const checkpointRef=latestCheckpointValue&&typeof latestCheckpointValue==='object'&&!Array.isArray(latestCheckpointValue)
   ? latestCheckpointValue as Record<string,unknown> : undefined;
  const checkpointId=typeof checkpointRef?.id==='string'?checkpointRef.id:'';
  let failureReason='COGNITIVE_CHECKPOINT_REFERENCE_MISSING';
  if(checkpointId){
   const reconstruction=cognitiveStateCheckpointService.reconstruct(checkpointId);
   if(!reconstruction.ok||!reconstruction.checkpoints.length)failureReason='COGNITIVE_CHECKPOINT_CHAIN_INVALID';
   else{
    const checkpoint=reconstruction.checkpoints.at(-1);
    if(!checkpoint||!checkpoint.verified)failureReason='COGNITIVE_CHECKPOINT_NOT_VERIFIED';
    else if(checkpoint.stateHash!==checkpointRef?.stateHash||checkpoint.integrityHash!==checkpointRef?.integrityHash)failureReason='BLACKBOARD_CHECKPOINT_RECEIPT_MISMATCH';
    else if(checkpoint.baseSnapshotId!==`${latestState.stateId}:${recordedStateHash}`)failureReason='BLACKBOARD_SNAPSHOT_DOES_NOT_MATCH_CHECKPOINT';
    else return {ok:true,reason:'CHECKPOINT_CHAIN_AND_BLACKBOARD_SNAPSHOT_HASH_VERIFIED'};
   }
  }

  // The Blackboard snapshot is the authoritative current state. If its own SHA-256 is valid but
  // the checkpoint receipt/chain was lost, re-root a verified checkpoint on that exact snapshot.
  // Never rewrite an invalid snapshot: that case remains fail-closed for manual/CORE repair.
  try{
   const snapshot=latestState as UnifiedCognitiveStateSnapshot;
   const recovered=cognitiveStateCheckpointService.create({
    baseSnapshotId:`${snapshot.stateId}:${recordedStateHash}`,
    changedFacts:[`CHECKPOINT_RECOVERY_FROM_VALID_SNAPSHOT:${failureReason}`,snapshot.semanticCoreHash||recordedStateHash],
    addedEvidence:[...(snapshot.evidenceIds||[])].slice(-200),
    invalidatedAssumptions:[...(snapshot.contradictions||[])].slice(-100),
    supersededRequirements:[],
    taskStateChanges:[`recovery:${failureReason}`,`status:${task.status}`,`cycle:${snapshot.cycle}`,`revision:${task.revision}`],
    memoryStateChanges:[...(snapshot.evidenceIds||[]).filter(value=>value.startsWith('MEM-'))].slice(-100),
    skillStateChanges:[...(snapshot.capabilityRefs||[])].slice(-100),
    artifactReferences:[],configurationChanges:[],layer:'HOT',
   });
   taskBlackboardService.append(task.taskId,'CHECKPOINT','core',`cognitiveStateCheckpoint:recovered:${Date.now()}`,{
    id:recovered.id,stateHash:recovered.stateHash,integrityHash:recovered.integrityHash,hashAlgorithm:recovered.hashAlgorithm,
    verified:recovered.verified,baseSnapshotId:recovered.baseSnapshotId,recovery:true,recoveryReason:failureReason,previousCheckpointId:checkpointId||undefined,
   },snapshot.evidenceIds||[]);
   systemLogger.warn('SYSTEM',`[CORE_CHECKPOINT_RECOVERED] ${task.taskId}: rebuilt checkpoint receipt from SHA-256-valid Blackboard snapshot after ${failureReason}`);
   return {ok:true,reason:`VALID_SNAPSHOT_RECHECKPOINTED:${failureReason}`};
  }catch(error){
   return {ok:false,reason:`COGNITIVE_CHECKPOINT_RECOVERY_FAILED:${error instanceof Error?error.message:String(error)}`};
  }
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
