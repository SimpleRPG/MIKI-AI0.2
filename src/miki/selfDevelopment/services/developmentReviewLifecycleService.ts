import { storageService } from '../../../services/storageService';
import { domainRouterService } from '../../core/services/domainRouterService';
import { externalReviewIntakeService } from '../../core/services/externalReviewIntakeService';
import { reviewZipExportService } from '../../core/services/reviewZipExportService';
import { canonicalSha256,canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import { reviewLearningArtifactService } from '../../core/services/reviewLearningArtifactService';
import type { ReviewLearningEpisode } from '../../core/services/reviewDecisionLearningService';
import { mikiSelfCodingSuperchargerService, type SelfImplementationResult } from './mikiSelfCodingSuperchargerService';
import { evaluationPackageStoreService } from './evaluationPackageStoreService';
import { developmentLifecycleStateMachineService } from './developmentLifecycleStateMachineService';
import { dataArchitecturePlannerService } from './dataArchitecturePlannerService';
import { itemFamilyExpansionPlannerService } from './itemFamilyExpansionPlannerService';
import { naturalLanguageDevelopmentIntentService } from './naturalLanguageDevelopmentIntentService';
import { autonomousDevelopmentReadinessService } from './autonomousDevelopmentReadinessService';
import { multiIntentDevelopmentTransactionCoordinatorService } from './multiIntentDevelopmentTransactionCoordinatorService';
import { semanticEnforcementService } from './semanticEnforcementService';
import type { DevelopmentReviewAction,UnifiedDevelopmentRequest } from './unifiedDevelopmentRequestModel';
const KEY='miki_unified_development_requests_v1';
export interface DevelopmentLifecycleResult { accepted:boolean; request:UnifiedDevelopmentRequest; implementation?:SelfImplementationResult; coreReply?:unknown; reasons:string[]; }
class DevelopmentReviewLifecycleService {
 public create(instructionText:string,targetPaths:string[]=[]):UnifiedDevelopmentRequest {const now=Date.now();const understanding=naturalLanguageDevelopmentIntentService.understand(instructionText,targetPaths);const readiness=autonomousDevelopmentReadinessService.assess(understanding);const allTargets=[...new Set([...targetPaths,...understanding.repositoryEvidence])];const architectureIntent=understanding.intents.find(intent=>intent.kind==='DATA_ARCHITECTURE');const itemIntent=understanding.intents.find(intent=>intent.kind==='ITEM_EXPANSION');const architecturePlan=architectureIntent?dataArchitecturePlannerService.plan(instructionText,architectureIntent.entities):undefined;const itemExpansionPlan=itemIntent?itemFamilyExpansionPlannerService.plan(instructionText):undefined;const request:UnifiedDevelopmentRequest={instructionId:`INST-${canonicalSha256({instructionText,targetPaths,now}).slice(0,24)}`,instructionSource:/作業指示書|目的[:：]|要件[:：]/.test(instructionText)?'WORK_INSTRUCTION':'NATURAL_LANGUAGE',instructionText:instructionText.trim(),targetPaths:[...new Set([...(allTargets||[]),...(architecturePlan?.selected.affectedPaths||[]),...(itemExpansionPlan?.affectedPaths||[])])],state:'CREATED',understanding,readiness,architecturePlan,itemExpansionPlan,evidenceIds:[],createdAt:now,updatedAt:now};this.save(request);return request;}
 public list():UnifiedDevelopmentRequest[]{return this.read();}
 public async start(base:UnifiedDevelopmentRequest):Promise<DevelopmentLifecycleResult>{
  try {
   return await this.startInternal(base);
  } catch(error) {
   const detail=error instanceof Error?error.message:String(error);
   const failureReason=`DEVELOPMENT_START_EXCEPTION:${detail}`.slice(0,1200);
   let failed:UnifiedDevelopmentRequest={
    ...base,state:'PROMOTION_FAILED',failureReason,failureAt:Date.now(),updatedAt:Date.now()
   };
   try {
    const latest=this.read().find(item=>item.instructionId===base.instructionId)||base;
    failed={...latest,state:'PROMOTION_FAILED',failureReason,failureAt:Date.now(),updatedAt:Date.now()};
    this.save(failed);
   } catch(persistenceError) {
    const persistenceDetail=persistenceError instanceof Error?persistenceError.message:String(persistenceError);
    const combined=`${failureReason}; DEVELOPMENT_FAILURE_STATE_NOT_PERSISTED:${persistenceDetail}`.slice(0,1600);
    failed={...base,state:'PROMOTION_FAILED',failureReason:combined,failureAt:Date.now(),updatedAt:Date.now()};
    return {accepted:false,request:failed,reasons:[failureReason,'DEVELOPMENT_FAILURE_STATE_NOT_PERSISTED',persistenceDetail]};
   }
   return {accepted:false,request:failed,reasons:[failureReason]};
  }
 }
 private async startInternal(base:UnifiedDevelopmentRequest):Promise<DevelopmentLifecycleResult>{const transaction=await multiIntentDevelopmentTransactionCoordinatorService.execute(base);const transactionWorkspace=(transaction as any).workspace;if(transactionWorkspace){const enforcement=await semanticEnforcementService.enforce(base.instructionId,transactionWorkspace.workspaceId,transactionWorkspace.files.flatMap((file:any)=>file.evidenceIds||[]));const semanticGate=semanticEnforcementService.reviewPackageGate(enforcement);if(!semanticGate.allowed){const request={...base,state:'VALIDATING' as const,workspaceId:transactionWorkspace.workspaceId,semanticEnforcement:enforcement,updatedAt:Date.now()};this.save(request);return {accepted:false,request,reasons:[...semanticGate.reasons,...(enforcement.repairDirective?[enforcement.repairDirective]:[])]};}const request={...base,state:'REVIEW_READY' as const,semanticEnforcement:enforcement,workspaceId:transactionWorkspace.workspaceId,candidateId:`CAND-${transactionWorkspace.workspaceId}`,candidateSha256:transactionWorkspace.candidateRevisionSha256,reviewPackageId:`TX-${transactionWorkspace.workspaceId}`,transactionId:transaction.transactionId,resumeTokenIds:transaction.resumeTokens,generatedComponentIds:transaction.generatedComponents,evidenceIds:[...base.evidenceIds,transactionWorkspace.workspaceId,...transaction.resumeTokens],updatedAt:Date.now()};this.save(request);return {accepted:transaction.reasons.length===0,request,reasons:transaction.reasons};}if(!transaction.continueWithOriginalPipeline&&transaction.reasons.some(reason=>reason.startsWith('WAITING_USER:'))){const request={...base,state:'WAITING_USER' as const,clarificationId:transaction.reasons.find(reason=>reason.startsWith('WAITING_USER:'))?.split(':')[1],updatedAt:Date.now()};this.save(request);return {accepted:false,request,reasons:transaction.reasons};}if(!transaction.continueWithOriginalPipeline&&transaction.reasons.length)return {accepted:false,request:{...base,state:'PROMOTION_FAILED',transactionId:transaction.transactionId,evidenceIds:[...base.evidenceIds,...transaction.resumeTokens]},reasons:transaction.reasons};if(base.readiness&&!base.readiness.ready)return {accepted:false,request:{...base,state:'PROMOTION_FAILED'},reasons:[...base.readiness.blockers,...base.readiness.missing]};base={...base,instructionText:transaction.continuationInstruction||base.instructionText,transactionId:transaction.transactionId,resumeTokenIds:transaction.resumeTokens,generatedComponentIds:transaction.generatedComponents,evidenceIds:[...base.evidenceIds,...transaction.resumeTokens,...(transaction.preflightWorkspaceId?[`PREFLIGHT_WORKSPACE:${transaction.preflightWorkspaceId}`]:[])]};let request=developmentLifecycleStateMachineService.transition(base,'PLANNING');this.save(request);request=developmentLifecycleStateMachineService.transition(request,'IMPLEMENTING');this.save(request);const implementation=await mikiSelfCodingSuperchargerService.runAutonomousImplementation(request.instructionText,request.targetPaths[0],false);request=developmentLifecycleStateMachineService.transition(request,'VALIDATING');const unified=implementation.unifiedDevelopment;request={...request,developmentPlanId:unified?.developmentPlanId,workspaceId:unified?.workspaceId,candidateId:unified?.workspaceId?`CAND-${unified.workspaceId}`:undefined,candidateSha256:unified?.candidateSha256,reviewPackageId:unified?.reviewPackageId,evaluationPackageId:unified?.evaluationPackageId,updatedAt:Date.now()};request=unified?.ready&&request.candidateSha256&&request.reviewPackageId?developmentLifecycleStateMachineService.transition(request,'REVIEW_READY'):{...request,state:'PROMOTION_FAILED'};this.save(request);return {accepted:request.state==='REVIEW_READY',request,implementation,reasons:unified?.reasons||[]};}
 public async decide(action:DevelopmentReviewAction):Promise<DevelopmentLifecycleResult>{let request=this.required(action.instructionId);if(!developmentLifecycleStateMachineService.canDecide(request,action.decision))return {accepted:false,request,reasons:[`REVIEW_DECISION_NOT_ALLOWED:${request.state}`]};if(action.decision==='REQUEST_CHANGES'){request=developmentLifecycleStateMachineService.transition(request,'REVISION_REQUESTED');request={...request,decision:action.decision,decisionReason:action.reason};this.save(request);const revised=this.create(`${request.instructionText}\n再修正要求:${action.reason}`,request.targetPaths);revised.parentRevisionId=request.instructionId;revised.state='REVISION_RUNNING';this.save(revised);return this.start({...revised,state:'CREATED'});}if(action.decision==='REJECT'){request=developmentLifecycleStateMachineService.transition(request,'REJECTED');request={...request,decision:'REJECT',decisionReason:action.reason};this.persistRejection(request,action.reason);request=developmentLifecycleStateMachineService.transition(request,'COMPLETED');this.save(request);return {accepted:true,request,reasons:[]};}const reviewPackage=request.reviewPackageId?reviewZipExportService.list().find(item=>item.packageId===request.reviewPackageId):undefined;const externalReview=reviewPackage?externalReviewIntakeService.list(reviewPackage.packageId).find(review=>review.status!=='MISMATCH'):undefined;if(!reviewPackage||!externalReview)return {accepted:false,request:{...request,state:'PROMOTION_FAILED'},reasons:[!reviewPackage?'REVIEW_PACKAGE_NOT_FOUND':'EXTERNAL_REVIEW_NOT_FOUND']};const adoption=await externalReviewIntakeService.submitDecision({externalReviewId:externalReview.externalReviewId,decision:'ACCEPT',reason:action.reason});if(adoption.status==='BLOCKED')return {accepted:false,request:{...request,state:'PROMOTION_FAILED'},coreReply:adoption,reasons:['EXTERNAL_REVIEW_ADOPTION_BLOCKED']};const envelope=domainRouterService.create('core','promotion','APPROVE_REVIEWED_CANDIDATE',{workspaceId:request.workspaceId,candidateId:request.candidateId,candidateManifestSha256:request.candidateSha256,reviewPackageId:request.reviewPackageId,externalReviewId:externalReview.externalReviewId,taskId:reviewPackage.runId||request.instructionId,operationInstanceId:reviewPackage.operationInstanceId||externalReview.operationInstanceId||'',persistenceReceiptId:reviewPackage.persistenceReceiptId||'',decisionReason:action.reason});const coreReply=await domainRouterService.dispatch(envelope);request=coreReply.accepted?developmentLifecycleStateMachineService.transition(request,'ACCEPTED'):{...request,state:'PROMOTION_FAILED'};request={...request,decision:'ACCEPT',decisionReason:action.reason};if(coreReply.accepted)request=developmentLifecycleStateMachineService.transition(request,'COMPLETED');this.save(request);return {accepted:coreReply.accepted,request,coreReply,reasons:coreReply.accepted?[]:[coreReply.error||'CORE_REJECTED']};}
 public packages(){return evaluationPackageStoreService.list();}
 private persistRejection(request:UnifiedDevelopmentRequest,reason:string):void{const now=Date.now();const base={packageId:request.evaluationPackageId||request.reviewPackageId||request.instructionId,packageRevision:1,candidateManifestSha256:request.candidateSha256||'',externalReviewId:`UI-${request.instructionId}`,externalAiRole:'OTHER' as const,rawResponseSha256:canonicalSha256(reason),decision:'REJECT' as const,signal:'REJECTED_EXAMPLE' as const,reason,strengths:[],risks:[reason],requestedChanges:[],scope:'THIS_PACKAGE_ONLY' as const,generalizationAllowed:false,coreTaskId:request.instructionId,coreDecisionId:`REJECT-${now}`,createdAt:now};const episode={episodeId:`LEP-${canonicalSha256Object(base).slice(0,20)}`,...base,episodeSha256:canonicalSha256Object(base)};reviewLearningArtifactService.deriveAndPersist(episode as unknown as ReviewLearningEpisode,`USER-${now}`);}
 private required(id:string):UnifiedDevelopmentRequest{const request=this.read().find(item=>item.instructionId===id);if(!request)throw new Error('DEVELOPMENT_REQUEST_NOT_FOUND');return request;}
 private read():UnifiedDevelopmentRequest[]{
  const raw=storageService.getItem(KEY);
  if(raw==null)return [];
  let parsed:unknown;
  try{parsed=JSON.parse(raw);}catch{
   this.quarantineCorruptRaw(raw);
   return [];
  }
  const validStates=new Set<string>(['CREATED','WAITING_USER','PLANNING','IMPLEMENTING','VALIDATING','REVIEW_READY','ACCEPTED','REJECTED','REVISION_REQUESTED','REVISION_RUNNING','PROMOTION_FAILED','COMPLETED']);
  const invalid=!Array.isArray(parsed)||parsed.some((row:any)=>
   !row||typeof row!=='object'||typeof row.instructionId!=='string'||!row.instructionId.trim()||
   typeof row.instructionText!=='string'||!Array.isArray(row.targetPaths)||!validStates.has(String(row.state))
  );
  const rows=Array.isArray(parsed)?parsed as UnifiedDevelopmentRequest[]:[];
  const duplicateIds=new Set(rows.map(row=>row.instructionId)).size!==rows.length;
  if(invalid||duplicateIds){
   this.quarantineCorruptRaw(raw);
   return [];
  }
  return rows;
 }
 private quarantineCorruptRaw(raw:string):void{
  const quarantineKey=`${KEY}_QUARANTINE_${canonicalSha256(raw).slice(0,20)}`;
  const existing=storageService.getItem(quarantineKey);
  if(existing!=null&&existing!==raw)throw new Error('DEVELOPMENT_REQUEST_STORE_QUARANTINE_KEY_COLLISION');
  if(existing==null)storageService.setItem(quarantineKey,raw);
  if(storageService.getItem(quarantineKey)!==raw)throw new Error('DEVELOPMENT_REQUEST_STORE_QUARANTINE_FAILED');
  storageService.setItem(KEY,'[]');
  if(storageService.getItem(KEY)!=='[]')throw new Error('DEVELOPMENT_REQUEST_STORE_RESET_FAILED');
 }
 private save(request:UnifiedDevelopmentRequest):void{
  const rows=this.read();
  const index=rows.findIndex(item=>item.instructionId===request.instructionId);
  if(index>=0)rows[index]=request;else rows.unshift(request);
  const serialized=JSON.stringify(rows.slice(0,200));
  storageService.setItem(KEY,serialized);
  if(storageService.getItem(KEY)!==serialized)throw new Error('DEVELOPMENT_REQUEST_STORE_READBACK_MISMATCH');
 }
}
export const developmentReviewLifecycleService=new DevelopmentReviewLifecycleService();
