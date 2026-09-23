import { domainParticipationService } from './domainParticipationService';
import { storageService } from '../../../services/storageService';
import { conversationCompositionResearchSchedulerService } from '../../conversation/services/conversationCompositionResearchSchedulerService';
import { systemLogger } from '../../../services/systemLogger';
import { executionEventBusService } from '../../execution/services/executionEventBusService';
import { claimVerificationEventService } from '../../verification/services/claimVerificationEventService';
import { selfImprovementRequestEventService } from '../../improvement/services/selfImprovementRequestEventService';
import { crossDomainCirculationService, type MikiDomain } from './crossDomainCirculationService';
import { domainRouterService, type DomainCommand, type DomainEnvelope, type DomainReply } from './domainRouterService';
import { blackboardRecoveryService } from './blackboardRecoveryService';
import { autonomousSelfImprovementLoopService } from './autonomousSelfImprovementLoopService';
import { selfImprovementIngressService } from './selfImprovementIngressService';
import { autonomousIssueDiscoveryService } from './autonomousIssueDiscoveryService';
import { domainSequentialConnectionService } from './domainSequentialConnectionService';
import { MIKI_DOMAINS } from './domainCatalogService';
import { persistenceReceiptLedgerService } from './persistenceReceiptLedgerService';
import { canonicalSha256 } from './canonicalSha256Service';

const BASE_COMMANDS:DomainCommand[]=['HEALTH_CHECK','DESCRIBE','GET_STATUS','ASSESS_DOMAIN','PARTICIPATE','VERIFY_CONNECTION'];

class DomainIntegrationBootstrapService{
 private initialized=false;
 private unsubscribers:Array<()=>void>=[];

 async initialize():Promise<void>{
  if(this.initialized)return;
  this.initialized=true;
  // Register every domain before the fail-closed audit. The previous order
  // audited an empty router on a cold start and could not prove connectivity.
  for(const domain of MIKI_DOMAINS)domainRouterService.register(domain,[...BASE_COMMANDS,...this.extraCommands(domain)],(envelope)=>this.handle(domain,envelope));
  const connectivityAudit=await domainParticipationService.auditAll();
  if(!connectivityAudit.passed){this.dispose();throw new Error('DOMAIN_CONNECTIVITY_AUDIT_FAILED');}
  autonomousSelfImprovementLoopService.initialize();
  autonomousIssueDiscoveryService.initialize();
  conversationCompositionResearchSchedulerService.initialize();
  const recovery=blackboardRecoveryService.recoverInterrupted();
  if(recovery.recovered.length>0)systemLogger.info('SELF_IMPROVEMENT',`[DomainIntegration] interrupted tasks recovered: ${recovery.recovered.length}`);
  this.unsubscribers.push(
   executionEventBusService.subscribe('execution.completed',e=>{crossDomainCirculationService.record('execution','learning','EXECUTION_COMPLETED',e.event_id);crossDomainCirculationService.record('execution','experience','EXECUTION_EXPERIENCE',e.event_id);}),
   executionEventBusService.subscribe('execution.failed',e=>{crossDomainCirculationService.record('execution','safety','EXECUTION_FAILED',e.event_id);crossDomainCirculationService.record('safety','improvement','FAILURE_REQUIRES_IMPROVEMENT',e.event_id);selfImprovementIngressService.submit({trigger:`execution.failed:${e.event_id}:${e.component_id}`,source:'EXECUTION'});}),
   claimVerificationEventService.subscribe(e=>{crossDomainCirculationService.record('verification',(e.outcome==='SUPPORTED'||e.outcome==='DEVICE_VERIFIED')?'promotion':'unknown',`CLAIM_${e.outcome}`,e.claimId);if(e.outcome==='CONTRADICTED'||e.outcome==='UNRESOLVED'){autonomousIssueDiscoveryService.recordContradiction(e.claimId,e.outcome);selfImprovementIngressService.submit({trigger:`claim.${e.outcome}:${e.claimId}`,source:'SYSTEM'});}}),
   selfImprovementRequestEventService.subscribe(e=>{crossDomainCirculationService.record(e.source==='AUTOPILOT'?'autonomy':'conversation','improvement','SELF_IMPROVEMENT_REQUESTED',e.trigger);selfImprovementIngressService.submit({trigger:e.trigger,source:e.source});}),
  );
  systemLogger.info('SELF_IMPROVEMENT',`[DomainIntegration] ${MIKI_DOMAINS.length} domains registered`);
 }

 dispose():void{
  for(const domain of MIKI_DOMAINS)domainRouterService.unregister(domain);conversationCompositionResearchSchedulerService.dispose();autonomousIssueDiscoveryService.dispose();autonomousSelfImprovementLoopService.dispose();for(const unsubscribe of this.unsubscribers)unsubscribe();this.unsubscribers=[];this.initialized=false;}
 getStatus(){return {initialized:this.initialized,registered:domainRouterService.getRegistrations(),missing:domainRouterService.getMissingDomains([...MIKI_DOMAINS]),coverage:crossDomainCirculationService.getCoverage(),connectivityAudit:domainParticipationService.getLastAudit()};}

 private extraCommands(domain:MikiDomain):DomainCommand[]{
  if(domain==='conversation')return ['ANALYZE_TEXT'];
  if(domain==='unknown')return ['RESOLVE_UNKNOWN'];
  if(domain==='research')return ['RUN_RESEARCH'];
  if(domain==='autonomy')return ['RUN_SELF_IMPROVEMENT','SAVE_AUTONOMY_CONFIG'];
  if(domain==='improvement')return ['RUN_SELF_IMPROVEMENT','DISCOVER_IMPROVEMENT_ISSUE'];
  if(domain==='learning')return ['LEARN_FROM_CORE_RESULT','APPROVE_REUSABLE_COMPONENTS'];
  if(domain==='strategy')return ['PLAN_PENDING_IMPROVEMENT_RUN'];
  if(domain==='capability')return ['RESOLVE_CAPABILITY_GAPS'];
  if(domain==='memory')return ['FLUSH'];
  if(domain==='verification')return ['VALIDATE_CANDIDATE','VERIFY_RESEARCH_CLAIMS'];
  if(domain==='selfDevelopment')return ['GENERATE_CANDIDATE'];
  if(domain==='promotion')return ['CREATE_REVIEW_PACKAGE','APPROVE_REVIEWED_CANDIDATE'];
  return [];
 }

 private async handle(domain:MikiDomain,envelope:DomainEnvelope):Promise<DomainReply>{
  const done=(result:unknown):DomainReply=>({accepted:true,domain,command:envelope.command,result,completedAt:Date.now()});
  if(envelope.command==='PARTICIPATE')return done(domainParticipationService.assess(domain,envelope.payload));
  if(envelope.command==='VERIFY_CONNECTION')return done(domainSequentialConnectionService.verify(domain,envelope.correlationId,envelope.evidenceIds[0]));
  if(envelope.command==='HEALTH_CHECK'||envelope.command==='DESCRIBE'||envelope.command==='GET_STATUS')return done({domain,registered:true,commands:domainRouterService.getRegistrations().find(x=>x.domain===domain)?.commands||[]});
  if(envelope.command==='ASSESS_DOMAIN'){
   const {domainOperationalAdapterService}=await import('./domainOperationalAdapterService');
   const operational=domainOperationalAdapterService.inspect(domain,envelope.payload);
   if(!operational.available)return {accepted:false,domain,command:envelope.command,result:operational,error:operational.unresolvedRequirements.join(','),completedAt:Date.now()};
   return done(operational);
  }
  if(domain==='conversation'&&envelope.command==='ANALYZE_TEXT'){
   const {conversationComponentPipelineService}=await import('../../conversation/services/conversationComponentPipelineService');
   return done(await conversationComponentPipelineService.analyze(String(envelope.payload.text||'')));
  }
  if(domain==='unknown'&&envelope.command==='RESOLVE_UNKNOWN'){
   const {unifiedUnknownResolutionCoordinatorService}=await import('../../unknown/services/unifiedUnknownResolutionCoordinatorService');
   return done(await unifiedUnknownResolutionCoordinatorService.resolveForChat({question:String(envelope.payload.question||''),useSearch:Boolean(envelope.payload.useSearch),unknownTerms:Array.isArray(envelope.payload.unknownTerms)?envelope.payload.unknownTerms.map(String).slice(0,3):undefined,hasAttachments:Boolean(envelope.payload.hasAttachments)}));
  }
  if(domain==='research'&&envelope.command==='RUN_RESEARCH'){
   const {researchService}=await import('../../research/services/researchService');
   const {knowledgeGapService}=await import('../../unknown/services/knowledgeGapService');
   const gapId=String(envelope.payload.gapId||'');
   const gap=gapId?knowledgeGapService.getById(gapId):undefined;
   const query=typeof envelope.payload.query==='string'?envelope.payload.query.trim():'';
   if(!gap&&!query)return {accepted:false,domain,command:envelope.command,error:'RESEARCH_QUERY_OR_GAP_REQUIRED',completedAt:Date.now()};
   if(!gap&&query){
    const result=await researchService.executeSearch(query, typeof envelope.payload.options==='object'&&envelope.payload.options!==null ? envelope.payload.options as any : undefined);
    return done({operation:'EXECUTE_AUTONOMOUS_SEARCH',operationClass:'BUSINESS',status:'SUCCEEDED',...result,evidenceIds:[]});
   }
   const adaptive = envelope.payload.adaptive !== false;
   const requestedQuery = typeof envelope.payload.query === 'string' ? envelope.payload.query.trim() : '';
   const requestedRound = Number.isFinite(Number(envelope.payload.continuationRound))
     ? Math.max(0, Math.floor(Number(envelope.payload.continuationRound)))
     : 0;
   return done(await researchService.researchGap(gap,{
     adaptive,
     query: requestedQuery || undefined,
     continuationRound: requestedRound,
     maxPasses: Number.isFinite(Number(envelope.payload.maxPasses)) ? Number(envelope.payload.maxPasses) : undefined,
     maxPagesPerPass: Number.isFinite(Number(envelope.payload.maxPagesPerPass)) ? Number(envelope.payload.maxPagesPerPass) : undefined
   }));
  }
  if(domain==='autonomy'&&envelope.command==='SAVE_AUTONOMY_CONFIG'){
   const {autonomousContinuousEvolutionService}=await import('../../autonomy/services/autonomousContinuousEvolutionService');
   const raw=envelope.payload.config;
   if(!raw||typeof raw!=='object')return {accepted:false,domain,command:envelope.command,error:'AUTONOMY_CONFIG_REQUIRED',completedAt:Date.now()};
   const source=raw as Record<string,unknown>;
   autonomousContinuousEvolutionService.saveConfig({enabled:typeof source.enabled==='boolean'?source.enabled:undefined,intervalMinutes:typeof source.intervalMinutes==='number'?source.intervalMinutes:undefined,requireApproval:typeof source.requireApproval==='boolean'?source.requireApproval:undefined,targetDomain:typeof source.targetDomain==='string'?source.targetDomain as any:undefined,maxContinuousRuns:typeof source.maxContinuousRuns==='number'?source.maxContinuousRuns:undefined,autoHealLimit:typeof source.autoHealLimit==='number'?source.autoHealLimit:undefined});
   return done({operation:'SAVE_AUTONOMY_CONFIG',operationClass:'BUSINESS',config:autonomousContinuousEvolutionService.getConfig(),mutationApplied:true,evidenceIds:[]});
  }
  if((domain==='improvement'||domain==='autonomy')&&envelope.command==='RUN_SELF_IMPROVEMENT'){
   const {improvementAssessmentService}=await import('../../improvement/services/improvementAssessmentService');
   return done(improvementAssessmentService.assess({trigger:String(envelope.payload.trigger||'domain-router'),taskId:String(envelope.payload.taskId||''),correlationId:envelope.correlationId,sourceDomain:envelope.source}));
  }
  if(domain==='strategy'&&envelope.command==='PLAN_PENDING_IMPROVEMENT_RUN'){
   const {improvementIntakeRouterService}=await import('./improvementIntakeRouterService');
   const requested=Array.isArray(envelope.payload.runIds)?envelope.payload.runIds.map(String):[];
   const runs=improvementIntakeRouterService.list().filter((run)=>requested.includes(run.runId)&&!['COMPLETED','REJECTED'].includes(run.status));
   if(runs.length===0)return {accepted:false,domain,command:envelope.command,error:'PENDING_RUN_NOT_FOUND',completedAt:Date.now()};
   return done({operation:'PLAN_PENDING_IMPROVEMENT_RUN',operationClass:'BUSINESS',plannedRunIds:runs.map((run)=>run.runId),mutationApplied:false,evidenceIds:[]});
  }
  if(domain==='capability'&&envelope.command==='RESOLVE_CAPABILITY_GAPS'){
   const {capabilityGapService}=await import('../../capability/services/capabilityGapService');
   const requested=Array.isArray(envelope.payload.gapIds)?envelope.payload.gapIds.map(String):[];
   const gaps=capabilityGapService.getAllGaps().filter((gap)=>requested.includes(gap.gap_id)&&gap.status!=='RESOLVED');
   if(gaps.length===0)return {accepted:false,domain,command:envelope.command,error:'CAPABILITY_GAP_NOT_FOUND',completedAt:Date.now()};
   return done({operation:'RESOLVE_CAPABILITY_GAPS',operationClass:'BUSINESS',gapIds:gaps.map((gap)=>gap.gap_id),unresolvedRequirements:gaps.map((gap)=>gap.description),mutationApplied:false,evidenceIds:[]});
  }
  if(domain==='improvement'&&envelope.command==='DISCOVER_IMPROVEMENT_ISSUE'){
   const result=await autonomousIssueDiscoveryService.scan();
   return done({operation:'DISCOVER_IMPROVEMENT_ISSUE',operationClass:'BUSINESS',...result,mutationApplied:false,evidenceIds:[]});
  }
  if(domain==='learning'&&envelope.command==='LEARN_FROM_CORE_RESULT'){
   const {mikiUnifiedLearningContinuumService}=await import('../../learning/services/mikiUnifiedLearningContinuumService');
   const evidenceIds=Array.isArray(envelope.payload.evidenceIds)?envelope.payload.evidenceIds.map(String).filter(Boolean):[];
   if(evidenceIds.length===0)return {accepted:false,domain,command:envelope.command,error:'LEARNING_EVIDENCE_REQUIRED',completedAt:Date.now()};
   const rawOutcome=String(envelope.payload.outcome||'SUCCESS').toUpperCase();
   const outcome=rawOutcome==='FAILURE'?'FAILURE':rawOutcome==='BLOCKED'?'BLOCKED':'SUCCESS';
   const verified=Boolean(envelope.payload.verified);
   const capabilityIds=Array.isArray(envelope.payload.capabilityIds)?envelope.payload.capabilityIds.map(String).filter(Boolean):[];
   const concepts=Array.isArray(envelope.payload.concepts)?envelope.payload.concepts.map(String).filter(Boolean).slice(0,20):[];
   const key=String(envelope.payload.key||envelope.payload.sourceOperation||envelope.payload.taskId||'core-result');
   const lesson=String(envelope.payload.lesson||`${String(envelope.payload.sourceDomain||'unknown')}:${String(envelope.payload.sourceOperation||'unknown')} learned by CORE`);
   mikiUnifiedLearningContinuumService.initialize();
   mikiUnifiedLearningContinuumService.observe({domain:String(envelope.payload.learningDomain||'system') as any,key,action:String(envelope.payload.sourceOperation||'core-result'),input:String(envelope.payload.input||envelope.payload.goal||'').slice(0,500),outcome,verified,capabilityIds,concepts,lesson});
   return done({operation:'LEARN_FROM_CORE_RESULT',operationClass:'BUSINESS',status:'SUCCEEDED',learningRecorded:true,sourceDomain:String(envelope.payload.sourceDomain||''),sourceOperation:String(envelope.payload.sourceOperation||''),sourceOperationInstanceId:String(envelope.payload.sourceOperationInstanceId||''),verified,evidenceIds,capabilityIds,concepts,lesson});
  }
  if(domain==='learning'&&envelope.command==='APPROVE_REUSABLE_COMPONENTS'){
   const {reusableComponentFactoryService}=await import('./reusableComponentFactoryService');
   const result=reusableComponentFactoryService.approveByCore();
   return done({operation:'APPROVE_REUSABLE_COMPONENTS',operationClass:'BUSINESS',status:'SUCCEEDED',...result,evidenceIds:[]});
  }
  if(domain==='memory'&&envelope.command==='FLUSH'){
   if(storageService.getBackendName()==='memory')return {accepted:false,domain,command:envelope.command,error:'MEMORY_ONLY_PERSISTENCE',completedAt:Date.now()};
   await storageService.flushNow();return done({backend:storageService.getBackendName(),persisted:true});
  }

  if(domain==='verification'&&envelope.command==='VERIFY_RESEARCH_CLAIMS'){
   const {verifierService}=await import('../../verification/services/verifierService');
   const claimIds=Array.isArray(envelope.payload.claimIds)?envelope.payload.claimIds.map(String).filter(Boolean):[];
   if(claimIds.length===0)return {accepted:false,domain,command:envelope.command,error:'RESEARCH_CLAIM_IDS_REQUIRED',completedAt:Date.now()};
   const verification=verifierService.verifyMany({claimIds,requireFresh:envelope.payload.requireFresh===true,maxAgeDays:Number.isFinite(Number(envelope.payload.maxAgeDays))?Number(envelope.payload.maxAgeDays):undefined});
   return done({operation:'VERIFY_RESEARCH_CLAIMS',operationClass:'BUSINESS',status:'SUCCEEDED',verification,verified:verification.length>0&&verification.every(x=>x.outcome==='SUPPORTED'||x.outcome==='DEVICE_VERIFIED'),evidenceIds:[]});
  }
  if(domain==='selfDevelopment'&&envelope.command==='GENERATE_CANDIDATE'){
   const {candidateCodeGenerationService}=await import('./candidateCodeGenerationService');
   const {improvementIntakeRouterService}=await import('./improvementIntakeRouterService');
   const taskId=String(envelope.payload.taskId||'');
   if(!taskId)return {accepted:false,domain,command:envelope.command,error:'TASK_ID_REQUIRED',completedAt:Date.now()};
   const run=await improvementIntakeRouterService.ensureForCoreTask({
     taskId,objective:String(envelope.payload.goal||`Self improvement ${taskId}`),
     payload:{...(envelope.payload),taskId},sourceId:taskId
   });
   const result=await candidateCodeGenerationService.generate(run.runId);
   if(!result.accepted||!result.workspaceId)return {
     accepted:false,domain,command:envelope.command,error:result.reasons.join('|')||'CANDIDATE_GENERATION_FAILED',
     result:{operation:'GENERATE_CANDIDATE',operationClass:'BUSINESS',...result,runId:run.runId,evidenceIds:[]},completedAt:Date.now()
   };
   const {isolatedCandidateWorkspaceService}=await import('./isolatedCandidateWorkspaceService');
   const workspace=isolatedCandidateWorkspaceService.get(result.workspaceId);
   if(!workspace)return {accepted:false,domain,command:envelope.command,error:'CANDIDATE_WORKSPACE_NOT_FOUND_AFTER_GENERATION',completedAt:Date.now()};
   const candidateId=`CAND-${workspace.workspaceId}`;
   const candidateManifestSha256=workspace.candidateRevisionSha256;
   const candidateRevision=Number(envelope.payload.candidateRevision||1);
   const operationInstanceId=String(envelope.payload.operationInstanceId||'');
   const corePlanRevision=Number(envelope.payload.planRevision||0);
   const receiptId=`PR-CAND-${workspace.workspaceId}-${canonicalSha256(operationInstanceId).slice(0,12)}`;
   const receipt=persistenceReceiptLedgerService.register({
     receiptId,entityType:'CANDIDATE_WORKSPACE',entityId:workspace.workspaceId,entitySha256:candidateManifestSha256,
     storageKey:'miki_isolated_candidate_workspaces_v1',persistedAt:Date.now(),reloaded:true,
     taskId,corePlanRevision,operationInstanceId,targetSha256:candidateManifestSha256
   },'miki_candidate_persistence_receipts_v1');
   const changedFilePaths=workspace.files.filter(file=>file.baselineSha256!==file.candidateSha256).map(file=>file.path);
   return done({operation:'GENERATE_CANDIDATE',operationClass:'BUSINESS',...result,runId:run.runId,
     candidateId,workspaceId:workspace.workspaceId,candidateRevision,candidateManifestSha256,
     baselineSnapshotSha256:workspace.baseSnapshotSha256,changedFilePaths,
     unresolvedItems:result.reasons,generationEvidenceIds:[...new Set(workspace.files.flatMap(file=>file.evidenceIds))],
     persistenceReceiptIds:[receipt.receiptId],evidenceIds:[...new Set(workspace.files.flatMap(file=>file.evidenceIds))]});
  }
  if(domain==='promotion'&&envelope.command==='APPROVE_REVIEWED_CANDIDATE'){
   const packageId=String(envelope.payload.packageId||'');
   const manifestSha=String(envelope.payload.candidateManifestSha256||'');
   if(!packageId||!manifestSha)return {accepted:false,domain,command:envelope.command,error:'REVIEW_PACKAGE_AND_MANIFEST_REQUIRED',completedAt:Date.now()};
   const {reviewZipExportService}=await import('./reviewZipExportService');
   const {isolatedCandidateWorkspaceService}=await import('./isolatedCandidateWorkspaceService');
   const {persistenceReceiptLedgerService}=await import('./persistenceReceiptLedgerService');
   const {selfCodeSpaceService}=await import('./selfCodeSpaceService');
   const pkg=reviewZipExportService.list().find(item=>item.packageId===packageId);
   if(!pkg)return {accepted:false,domain,command:envelope.command,error:'REVIEW_PACKAGE_NOT_FOUND',completedAt:Date.now()};
   if(pkg.status!=='ACCEPTED'&&pkg.status!=='EXTERNAL_REVIEW_PENDING')return {accepted:false,domain,command:envelope.command,error:'REVIEW_PACKAGE_NOT_ACCEPTED',completedAt:Date.now()};
   if(pkg.candidateManifestSha256!==manifestSha)return {accepted:false,domain,command:envelope.command,error:'CANDIDATE_MANIFEST_SHA_MISMATCH',completedAt:Date.now()};
   const workspace=isolatedCandidateWorkspaceService.get(pkg.workspaceId);
   if(!workspace)return {accepted:false,domain,command:envelope.command,error:'CANDIDATE_WORKSPACE_NOT_FOUND',completedAt:Date.now()};
   const receipt=pkg.persistenceReceiptId;
   const operationInstanceId=String(envelope.payload.operationInstanceId||pkg.operationInstanceId||'');
   if(!receipt||receipt==='UNAVAILABLE')return {accepted:false,domain,command:envelope.command,error:'PERSISTENCE_RECEIPT_REQUIRED',completedAt:Date.now()};
   if(!persistenceReceiptLedgerService.get(receipt))return {accepted:false,domain,command:envelope.command,error:'PERSISTENCE_RECEIPT_NOT_FOUND',completedAt:Date.now()};
   const applied=selfCodeSpaceService.applyCandidate(workspace.files.map(file=>({path:file.path,baselineSha256:file.baselineSha256,candidateContent:file.candidateContent})));
   const result=await isolatedCandidateWorkspaceService.commitWithReceipt(workspace.workspaceId,receipt,operationInstanceId);
   reviewZipExportService.updateStatus(packageId,'ACCEPTED');
   return done({operation:'APPROVE_REVIEWED_CANDIDATE',operationClass:'BUSINESS',status:'SUCCEEDED',packageId,workspaceId:workspace.workspaceId,transactionId:result.transaction.transactionId,candidateManifestSha256:result.transaction.candidateManifestSha256,selfCodeRevisionSha256:applied.repoSha256,evidenceIds:[...new Set(result.workspace.files.flatMap(file=>file.evidenceIds))],receiptIds:[receipt]});
  }
if(domain==='promotion'&&envelope.command==='CREATE_REVIEW_PACKAGE'){
   const {reviewZipExportService}=await import('./reviewZipExportService');
   const runId=String(envelope.payload.runId||'');
   const workspaceId=String(envelope.payload.workspaceId||'');
   if(!runId||!workspaceId)return {accepted:false,domain,command:envelope.command,error:'RUN_AND_WORKSPACE_REQUIRED',completedAt:Date.now()};
   const sourcePackageId=String(envelope.payload.sourcePackageId||'');
   const result=await reviewZipExportService.create(runId,workspaceId,{
     mode:sourcePackageId?'NEXT_PACKAGE_REVISION':'NEW_SERIES',sourcePackageId:sourcePackageId||undefined,taskId:String(envelope.payload.taskId||''),
     corePlanRevision:Number(envelope.payload.planRevision||0),
     operationInstanceId:String(envelope.payload.operationInstanceId||''),
     candidateId:String(envelope.payload.candidateId||''),
     candidateRevision:Number(envelope.payload.candidateRevision||1),
     candidateManifestSha256:String(envelope.payload.candidateManifestSha256||''),
     validationBundleId:String(envelope.payload.validationBundleId||''),
     learningLineage:envelope.payload.learningLineage,
     externalReviewQuestions:Array.isArray(envelope.payload.externalReviewQuestions)?envelope.payload.externalReviewQuestions.map(String):[]
   });
   if(!result.ok)return {
     accepted:false,domain,command:envelope.command,error:result.message,
     result:{operation:'CREATE_REVIEW_PACKAGE',operationClass:'BUSINESS',...result,runId,workspaceId,evidenceIds:[]},completedAt:Date.now()
   };
   return done({operation:'CREATE_REVIEW_PACKAGE',operationClass:'BUSINESS',...result,runId,workspaceId,evidenceIds:[]});
  }
  if(domain==='verification'&&envelope.command==='VALIDATE_CANDIDATE'){
   const {candidateValidationRunnerService}=await import('./candidateValidationRunnerService');
   const {isolatedCandidateWorkspaceService}=await import('./isolatedCandidateWorkspaceService');
   const workspaceId=String(envelope.payload.workspaceId||'');
   const candidateId=String(envelope.payload.candidateId||'');
   const expectedId=workspaceId?`CAND-${workspaceId}`:'';
   if(!workspaceId||!candidateId||candidateId!==expectedId)return {accepted:false,domain,command:envelope.command,error:'CANDIDATE_IDENTITY_MISMATCH',completedAt:Date.now()};
   const workspace=isolatedCandidateWorkspaceService.get(workspaceId);
   if(!workspace)return {accepted:false,domain,command:envelope.command,error:'CANDIDATE_WORKSPACE_NOT_FOUND',completedAt:Date.now()};
   const expectedHash=String(envelope.payload.candidateManifestSha256||workspace.candidateRevisionSha256);
   if(expectedHash!==workspace.candidateRevisionSha256)return {accepted:false,domain,command:envelope.command,error:'CANDIDATE_MANIFEST_SHA_MISMATCH',completedAt:Date.now()};
   const result=await candidateValidationRunnerService.run(workspaceId);
   if(!result.passed)return {
     accepted:false,domain,command:envelope.command,error:result.reasons.join('|')||'VALIDATION_FAILED',
     result:{operation:'VALIDATE_CANDIDATE',operationClass:'BUSINESS',...result,candidateId,candidateHash:workspace.candidateRevisionSha256},completedAt:Date.now()
   };
   const validationBundleId=`VAL-${candidateId}`;
   const validationReceiptId=`PR-VAL-${candidateId}-${canonicalSha256(String(envelope.payload.operationInstanceId||'' )).slice(0,12)}`;
   const taskId=String(envelope.payload.taskId||'');
   const corePlanRevision=Number(envelope.payload.planRevision||0);
   const operationInstanceId=String(envelope.payload.operationInstanceId||'');
   const validationReceipt=persistenceReceiptLedgerService.register({
     receiptId:validationReceiptId,entityType:'CANDIDATE_VALIDATION',entityId:validationBundleId,entitySha256:workspace.candidateRevisionSha256,
     storageKey:'miki_candidate_validation_receipts_v1',persistedAt:Date.now(),reloaded:true,
     taskId,corePlanRevision,operationInstanceId,targetSha256:workspace.candidateRevisionSha256
   },'miki_candidate_validation_receipts_v1');
   return done({operation:'VALIDATE_CANDIDATE',operationClass:'BUSINESS',
     validationBundleId,candidateId,candidateHash:workspace.candidateRevisionSha256,
     validationStatus:result.passed?'PASSED':'FAILED',
     passedChecks:result.passedChecks||[],failedChecks:result.failedChecks||[],
     unexecutedChecks:result.unexecutedChecks||[],evidenceIds:result.evidenceIds||[],
     persistenceReceiptIds:[validationReceipt.receiptId],reviewEligibility:result.passed,
     ...result});
  }
  return {accepted:false,domain,command:envelope.command,error:'DOMAIN_COMMAND_HANDLER_MISSING',completedAt:Date.now()};
 }
}
export const domainIntegrationBootstrapService=new DomainIntegrationBootstrapService();
