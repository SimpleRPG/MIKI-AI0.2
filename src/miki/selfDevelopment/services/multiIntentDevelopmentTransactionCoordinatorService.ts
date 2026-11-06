import { clarificationLifecycleService } from './clarificationLifecycleService';
import { semanticUnderstandingV2OrchestratorService } from './semanticUnderstandingV2OrchestratorService';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';import { isolatedCandidateWorkspaceService } from '../../core/services/isolatedCandidateWorkspaceService';import { specializedDevelopmentExecutorDispatcherService } from './specializedDevelopmentExecutorDispatcherService';import { deterministicGoalSemanticsService } from './deterministicGoalSemanticsService';import { conceptOntologyService } from './conceptOntologyService';import { repositoryGroundedHypothesisService } from './repositoryGroundedHypothesisService';import { capabilityContractSynthesisService } from './capabilityContractSynthesisService';import { atomicComponentTemplateSynthesisService } from './atomicComponentTemplateSynthesisService';import { generatedComponentVerificationRegistrationService } from './generatedComponentVerificationRegistrationService';import { semanticTransactionReviewEvidenceService } from './semanticTransactionReviewEvidenceService';
import { generatedComponentWorkerSandboxService } from './generatedComponentWorkerSandboxService';
import { componentVerificationService } from '../../verification/services/componentVerificationService';
import { componentPromotionService } from '../../promotion/services/componentPromotionService';
import { componentTestCaseService } from '../../verification/services/componentTestCaseService';
import { componentArtifactStoreService } from '../../capability/services/componentArtifactStoreService';
import { systemLogger } from '../../../services/systemLogger';
import type { WorkerSandboxEvidence } from './generatedComponentWorkerSandboxService';
import type { SynthesizedComponent } from './atomicComponentTemplateSynthesisService';
import { generatedComponentSandboxExecutionService } from './generatedComponentSandboxExecutionService';
import { developmentResumeTokenService } from './developmentResumeTokenService';import type { UnifiedDevelopmentRequest } from './unifiedDevelopmentRequestModel';
export interface MultiIntentTransactionResult{transactionId:string;semantics:unknown;concepts:unknown[];hypotheses:unknown[];generatedComponents:string[];resumeTokens:string[];workspace?:unknown;specialized?:unknown;preflightWorkspaceId?:string;continuationInstruction?:string;continueWithOriginalPipeline:boolean;reasons:string[];}
class MultiIntentDevelopmentTransactionCoordinatorService{async execute(request:UnifiedDevelopmentRequest):Promise<MultiIntentTransactionResult>{const understanding=request.understanding;const entities=understanding?.intents.flatMap(intent=>intent.entities)||[];const semanticV2=semanticUnderstandingV2OrchestratorService.analyze(request.instructionText,entities,request.instructionId);if(!semanticV2.ready){const clarification=clarificationLifecycleService.request(request.instructionId,semanticV2.clarification.questions,semanticV2.clarification.reasons);return {transactionId:`TX-WAIT-${canonicalSha256({request:request.instructionId,frame:semanticV2.frame.frameId}).slice(0,20)}`,semantics:semanticV2,concepts:[],hypotheses:semanticV2.hypotheses.causes,generatedComponents:[],resumeTokens:[],continueWithOriginalPipeline:false,reasons:[`WAITING_USER:${clarification.clarificationId}`,...semanticV2.clarification.reasons.map((reason,index)=>`${reason}:${semanticV2.clarification.questions[index]||''}`)]};}const semantics=deterministicGoalSemanticsService.parse(request.instructionText,entities);const concepts=conceptOntologyService.resolve(request.instructionText);const hypotheses=repositoryGroundedHypothesisService.compare(semantics,concepts);const accepted=hypotheses.filter(row=>!row.rejected&&row.score>0);const generatedComponents:string[]=[];const resumeTokens:string[]=[];for(const hypothesis of accepted){const contract=capabilityContractSynthesisService.synthesize(hypothesis.operation,hypothesis.evidence.map(value=>value.path));if(!contract)continue;const synthesized=atomicComponentTemplateSynthesisService.synthesize(contract);
// P441(A+C): サンドボックスは「実行のみ」。先に実行し、そのサーバ結果を
// 登録・検証へ反映する。昇格の根拠にはしない。
let workerEvidence:WorkerSandboxEvidence;
try{workerEvidence=await generatedComponentWorkerSandboxService.execute(synthesized);}catch(error){workerEvidence={evidenceId:`CEXEC-${canonicalSha256({component:synthesized.componentId,error:String(error)}).slice(0,24)}`,componentId:synthesized.componentId,passed:false,implementationHash:canonicalSha256(synthesized.implementation),checks:{},runs:[],reasons:[`SANDBOX_CALL_FAILED: ${String(error)}`],createdAt:Date.now()};}
const verification=generatedComponentVerificationRegistrationService.verifyAndRegister(synthesized,{passed:workerEvidence.passed,evidenceId:workerEvidence.evidenceId});
if(!workerEvidence.passed)continue;
if(!this.advanceGeneratedComponentViaSandboxEvidence(synthesized,workerEvidence))continue;
generatedComponents.push(verification.component.component_id);const token=developmentResumeTokenService.issue({instructionId:request.instructionId,blockedTaskId:hypothesis.id,missingCapabilityId:contract.capabilityId,generatedComponentId:verification.component.component_id,validatedImplementationHash:verification.component.implementation_hash});resumeTokens.push(token.tokenId);}const specialized=await specializedDevelopmentExecutorDispatcherService.execute(request,request.instructionId);if(specialized){const specializedValue=specialized as any;const transactionId=`TX-${canonicalSha256({request:request.instructionId,hypotheses:accepted.map(value=>value.id),kind:specializedValue.kind}).slice(0,24)}`;if(specializedValue.requiresOriginalPipeline===true){const blockedReasons=Array.isArray(specializedValue.plan?.blockedReasons)?specializedValue.plan.blockedReasons:[];const continuationInstruction=[request.instructionText,'','[DETERMINISTIC_PREFLIGHT]',`TRANSACTION_ID=${transactionId}`,`DOMAIN=${String(specializedValue.kind||'UNKNOWN')}`,`PREFLIGHT_WORKSPACE_ID=${String(specializedValue.workspace?.workspaceId||'')}`,`TARGET_PATHS=${JSON.stringify(specializedValue.plan?.targets||request.targetPaths)}`,`ACCEPTANCE_GATES=${JSON.stringify(specializedValue.plan?.gates||specializedValue.manifest?.requiredChecks||[])}`,`CANDIDATE_OPERATIONS=${JSON.stringify(specializedValue.plan?.candidateOperations||[])}`,`BLOCKED_REASONS=${JSON.stringify(blockedReasons)}`].join('\n');const result={transactionId,semantics,concepts,hypotheses,generatedComponents,resumeTokens,specialized,preflightWorkspaceId:specializedValue.workspace?.workspaceId,continuationInstruction,continueWithOriginalPipeline:blockedReasons.length===0,reasons:blockedReasons};semanticTransactionReviewEvidenceService.create(request.instructionId,result);return result;}const result={transactionId,semantics,concepts,hypotheses,generatedComponents,resumeTokens,specialized,workspace:specializedValue.workspace,continueWithOriginalPipeline:false,reasons:[]};semanticTransactionReviewEvidenceService.create(request.instructionId,result);return result;}const transactionId=`TX-${canonicalSha256({request:request.instructionId,hypotheses:accepted.map(value=>value.id)}).slice(0,24)}`;const result={transactionId,semantics,concepts,hypotheses,generatedComponents,resumeTokens,continueWithOriginalPipeline:true,reasons:accepted.length?[]:['NO_GROUNDED_HYPOTHESIS']};semanticTransactionReviewEvidenceService.create(request.instructionId,result);return result;}
  /**
   * P441(C): サンドボックス実行証拠を正式ルートの材料にする。
   * サンドボックスが実際に実行した NORMAL / BOUNDARY ケースについて、
   * 既存の componentVerificationService.verifyExecution へサーバの
   * 実行結果をそのまま渡す。verifyExecution は部品・テストケース・
   * ハッシュ・Artifact の照合を行い、実行証拠を ADMISSIBLE として
   * 記録し、PASS なら ANALYZED -> DEVICE_TESTED へ進める。
   * サンドボックス成功だけでは VERIFIED にはならない。VERIFIED は
   * Regression Gate + Canary を通った promoteIfSafeForCanary のみ。
   * Regression Gate (suite) もここで作り、後続パイプラインの材料に
   * する。ゲート作成の失敗はここでは致命傷にしない。
   * 戻り値: 部品が DEVICE_TESTED に到達したかどうか。
   */
  private advanceGeneratedComponentViaSandboxEvidence(component:SynthesizedComponent,evidence:WorkerSandboxEvidence):boolean{
    const componentId=component.componentId;
    const artifactSnapshotKey=componentArtifactStoreService.getManifest(componentId)?.snapshot_key||'';
    if(!artifactSnapshotKey){systemLogger.warn('SELF_IMPROVEMENT',`⚠️ [P441] ${componentId}: Artifact snapshotがなく、サンドボックス証拠を正式ルートへ載せられません`);return false;}
    const cases=componentTestCaseService.generateForComponent(componentId);
    const inputOrder=['NORMAL','EMPTY','BOUNDARY'] as const;
    let advanced=false;
    for(const category of ['NORMAL','BOUNDARY'] as const){
      const testCase=cases.find(item=>item.category===category);
      if(!testCase)continue;
      const runIndex=inputOrder.indexOf(category);
      const run=evidence.runs.find(item=>item.caseId===category);
      const output=evidence.outputs?.[runIndex];
      const casePassed=evidence.passed&&!!run&&!run.error;
      const outputSummary=output!==undefined?JSON.stringify(output):`sandbox ${category} run: ${run?.error||'no output'}`;
      const verification=componentVerificationService.verifyExecution({componentId,implementationHash:evidence.implementationHash,environment:'EXTERNAL_RUNNER',testCategory:category,passed:casePassed,outputSummary,errorMessage:run?.error,durationMs:run?.durationMs,runnerId:'component-worker-sandbox',artifactSnapshotKey,testCaseId:testCase.test_case_id,expectedSummary:testCase.expected_summary,assertionStatus:casePassed?'PASS':'FAIL',assertionRule:casePassed?'SANDBOX_CHECKS_ALL_TRUE':'SANDBOX_CHECK_FAILED',assertionReason:casePassed?`worker sandbox checks all true (${Object.keys(evidence.checks).filter(key=>evidence.checks[key]).join(',')}); evidence=${evidence.evidenceId}`:`worker sandbox did not pass (${evidence.reasons.join('; ')||'no reason'})`});
      if(verification.nextStatus==='DEVICE_TESTED')advanced=true;
      if(!verification.accepted)systemLogger.warn('SELF_IMPROVEMENT',`⚠️ [P441] ${componentId}: サンドボックス証拠の検証受け入れに失敗 (${category}): ${verification.reason}`);
    }
    const gate=componentPromotionService.createGate(componentId,'EXTERNAL_RUNNER');
    if(gate)systemLogger.info('TOOLS',`🔁 [P441] ${componentId}: Regression Gate ${gate.suite_id} を作成しました（サンドボックス証拠の材料）`);
    else systemLogger.warn('SELF_IMPROVEMENT',`⚠️ [P441] ${componentId}: Regression Gateを作成できませんでした`);
    return advanced;
  }}
export const multiIntentDevelopmentTransactionCoordinatorService=new MultiIntentDevelopmentTransactionCoordinatorService();
