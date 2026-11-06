import { clarificationLifecycleService } from './clarificationLifecycleService';
import { semanticUnderstandingV2OrchestratorService } from './semanticUnderstandingV2OrchestratorService';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';import { isolatedCandidateWorkspaceService } from '../../core/services/isolatedCandidateWorkspaceService';import { specializedDevelopmentExecutorDispatcherService } from './specializedDevelopmentExecutorDispatcherService';import { deterministicGoalSemanticsService } from './deterministicGoalSemanticsService';import { conceptOntologyService } from './conceptOntologyService';import { repositoryGroundedHypothesisService } from './repositoryGroundedHypothesisService';import { capabilityContractSynthesisService } from './capabilityContractSynthesisService';import { atomicComponentTemplateSynthesisService } from './atomicComponentTemplateSynthesisService';import { generatedComponentVerificationRegistrationService } from './generatedComponentVerificationRegistrationService';import { semanticTransactionReviewEvidenceService } from './semanticTransactionReviewEvidenceService';
import { generatedComponentWorkerSandboxService } from './generatedComponentWorkerSandboxService';
import { executionRunnerService } from '../../execution/services/executionRunnerService';
import { componentRegressionService, RegressionSuite } from '../../verification/services/componentRegressionService';
import { componentRegistryService } from '../../capability/services/componentRegistryService';
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
const driven=await this.driveGeneratedComponent(synthesized);
if(!driven.passed||!driven.reachedDeviceTested)continue;
generatedComponents.push(driven.componentId);const token=developmentResumeTokenService.issue({instructionId:request.instructionId,blockedTaskId:hypothesis.id,missingCapabilityId:contract.capabilityId,generatedComponentId:driven.componentId,validatedImplementationHash:driven.implementationHash});resumeTokens.push(token.tokenId);}const specialized=await specializedDevelopmentExecutorDispatcherService.execute(request,request.instructionId);if(specialized){const specializedValue=specialized as any;const transactionId=`TX-${canonicalSha256({request:request.instructionId,hypotheses:accepted.map(value=>value.id),kind:specializedValue.kind}).slice(0,24)}`;if(specializedValue.requiresOriginalPipeline===true){const blockedReasons=Array.isArray(specializedValue.plan?.blockedReasons)?specializedValue.plan.blockedReasons:[];const continuationInstruction=[request.instructionText,'','[DETERMINISTIC_PREFLIGHT]',`TRANSACTION_ID=${transactionId}`,`DOMAIN=${String(specializedValue.kind||'UNKNOWN')}`,`PREFLIGHT_WORKSPACE_ID=${String(specializedValue.workspace?.workspaceId||'')}`,`TARGET_PATHS=${JSON.stringify(specializedValue.plan?.targets||request.targetPaths)}`,`ACCEPTANCE_GATES=${JSON.stringify(specializedValue.plan?.gates||specializedValue.manifest?.requiredChecks||[])}`,`CANDIDATE_OPERATIONS=${JSON.stringify(specializedValue.plan?.candidateOperations||[])}`,`BLOCKED_REASONS=${JSON.stringify(blockedReasons)}`].join('\n');const result={transactionId,semantics,concepts,hypotheses,generatedComponents,resumeTokens,specialized,preflightWorkspaceId:specializedValue.workspace?.workspaceId,continuationInstruction,continueWithOriginalPipeline:blockedReasons.length===0,reasons:blockedReasons};semanticTransactionReviewEvidenceService.create(request.instructionId,result);return result;}const result={transactionId,semantics,concepts,hypotheses,generatedComponents,resumeTokens,specialized,workspace:specializedValue.workspace,continueWithOriginalPipeline:false,reasons:[]};semanticTransactionReviewEvidenceService.create(request.instructionId,result);return result;}const transactionId=`TX-${canonicalSha256({request:request.instructionId,hypotheses:accepted.map(value=>value.id)}).slice(0,24)}`;const result={transactionId,semantics,concepts,hypotheses,generatedComponents,resumeTokens,continueWithOriginalPipeline:true,reasons:accepted.length?[]:['NO_GROUNDED_HYPOTHESIS']};semanticTransactionReviewEvidenceService.create(request.instructionId,result);return result;}
  /**
   * P444: 生成部品1件のサンドボックス実行→登録→正式ルートへの載せ替え。
   * execute() の仮説ループとテンプレート部品の作成フローで共有する。
   * P441(A+C): サンドボックスは「実行のみ」。先に実行し、そのサーバ結果を
   * 登録・検証へ反映する。昇格の根拠にはしない。VERIFIED 昇格はしない
   * （Regression Gate + Canary を通った promoteIfSafeForCanary のみ）。
   */
  public async driveGeneratedComponent(component:SynthesizedComponent):Promise<{componentId:string;implementationHash:string;passed:boolean;reachedDeviceTested:boolean}>{
    let workerEvidence:WorkerSandboxEvidence;
    try{workerEvidence=await generatedComponentWorkerSandboxService.execute(component);}catch(error){workerEvidence={evidenceId:`CEXEC-${canonicalSha256({component:component.componentId,error:String(error)}).slice(0,24)}`,componentId:component.componentId,passed:false,implementationHash:canonicalSha256(component.implementation),checks:{},runs:[],reasons:[`SANDBOX_CALL_FAILED: ${String(error)}`],createdAt:Date.now()};}
    const verification=generatedComponentVerificationRegistrationService.verifyAndRegister(component,{passed:workerEvidence.passed,evidenceId:workerEvidence.evidenceId});
    if(!workerEvidence.passed)return {componentId:verification.component.component_id,implementationHash:verification.component.implementation_hash,passed:false,reachedDeviceTested:false};
    const reached=this.advanceGeneratedComponentViaSandboxEvidence(component,workerEvidence);
    return {componentId:verification.component.component_id,implementationHash:verification.component.implementation_hash,passed:true,reachedDeviceTested:reached};
  }

  /**
   * P441(C)+P442(V3): サンドボックス実行証拠を正式ルートの材料にする。
   * サンドボックスが実際に実行したケースについて、Regression Gate の
   * 実行要求へ submitResult 経由で結果を載せる。submitResult が
   * expected_summary の ASSERT を再評価し、PASS なら verifyExecution
   * （ANALYZED -> DEVICE_TESTED）と execution.completed/failed
   * イベント発行・success_count 更新まで行う。P441 の直結
   * verifyExecution 呼び出しはやめた（要求が QUEUED のまま残り、
   * Suite が PASSED にならず、イベントも success_count も増えない
   * ため）。サンドボックスの自己申告をそのまま PASS にしない。
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
    // P447: 既存の未完了 Gate があれば再利用する。createGate を無条件に
    // 呼ぶと plan() が同じ suite_id で Suite を上書きし、前の Gate の
    // 要求が QUEUED のまま孤児になる（P441 からの挙動）。探し方は
    // VERIFY_CODE_COMPONENT 経路（domainIntegrationBootstrapService.ts:
    // 507-515）と同じ。終わっている Suite は使い回さず新しく作る。
    // Gate の要求（QUEUED）が submitResult の宛先になる。
    const existingGate=this.findReusableGate(componentId,'EXTERNAL_RUNNER');
    const gate=existingGate??componentPromotionService.createGate(componentId,'EXTERNAL_RUNNER');
    if(!gate){systemLogger.warn('SELF_IMPROVEMENT',`⚠️ [P441] ${componentId}: Regression Gateを作成できませんでした`);return false;}
    if(existingGate)systemLogger.info('TOOLS',`🔁 [P447] ${componentId}: 既存の未完了 Gate ${gate.suite_id} を再利用します（新規作成しません）`);
    else systemLogger.info('TOOLS',`🔁 [P441] ${componentId}: Regression Gate ${gate.suite_id} を作成しました（サンドボックス証拠の材料）`);
    // P443(G3)+P445: サンドボックスは NORMAL/EMPTY/BOUNDARY/INVALID/
    // PERMISSION/REGRESSION の6入力を実行する。INVALID は要求なし
    // （安全な失敗の観測点）、PERMISSION は allowed: false の拒否
    // （実測の拒否）。REGRESSION は以前に成功した NORMAL 入力と
    // 同じ入力の再実行で、サンドボックスで実際に実行した観測を載せ
    // る（NORMAL の出力を流用しない。決定性照合の2回目の流用でも
    // ない）。再実行が失敗すれば REGRESSION 要求の失敗として載り、
    // Suite は PASSED にならない（本物の回帰シグナル）。証拠のない
    // ケースに結果を捏造して載せることはしない。
    const inputOrder=['NORMAL','EMPTY','BOUNDARY','INVALID','PERMISSION','REGRESSION'] as const;
    let advanced=false;
    for(const binding of gate.case_bindings){
      const testCase=cases.find(item=>item.test_case_id===binding.test_case_id);
      if(!testCase){systemLogger.warn('SELF_IMPROVEMENT',`⚠️ [P442] ${componentId}: Suite要求 ${binding.request_id} に対応するテストケースがありません`);continue;}
      const category=testCase.category;
      let runIndex=-1;
      if(category==='NORMAL'||category==='EMPTY'||category==='BOUNDARY'||category==='INVALID'||category==='PERMISSION'||category==='REGRESSION')runIndex=inputOrder.indexOf(category);
      else{systemLogger.warn('SELF_IMPROVEMENT',`⚠️ [P442] ${componentId}: ${category} はサンドボックス証拠がなく結果を載せません（証拠の捏造はしない）`);continue;}
      const run=evidence.runs.find(item=>item.caseId===inputOrder[runIndex]);
      const output=evidence.outputs?.[runIndex];
      if(!run||output===undefined){systemLogger.warn('SELF_IMPROVEMENT',`⚠️ [P442] ${componentId}: ${category} のサンドボックス実行結果がなく結果を載せません`);continue;}
      const casePassed=evidence.passed&&!run.error;
      const submitted=executionRunnerService.markSubmitted(binding.request_id);
      if(!submitted){systemLogger.warn('SELF_IMPROVEMENT',`⚠️ [P442] ${componentId}: ${category} の実行要求 ${binding.request_id} がQUEUEDでなく結果を載せられません`);continue;}
      const result=executionRunnerService.submitResult({request_id:binding.request_id,passed:casePassed,output_summary:JSON.stringify(output),error_message:run.error,duration_ms:run.durationMs,environment:'EXTERNAL_RUNNER',runner_id:'component-worker-sandbox',implementation_hash:evidence.implementationHash,artifact_snapshot_key:artifactSnapshotKey,test_case_id:testCase.test_case_id});
      if(!result.accepted){systemLogger.warn('SELF_IMPROVEMENT',`⚠️ [P442] ${componentId}: ${category} の実行結果を受け入れられません: ${result.reason}`);continue;}
      if(result.verification?.nextStatus==='DEVICE_TESTED')advanced=true;
      if(!result.verification)systemLogger.warn('SELF_IMPROVEMENT',`⚠️ [P442] ${componentId}: ${category} はAssertion INCONCLUSIVEのため検証成功として扱いません: ${result.reason}`);
    }
    const suite=componentRegressionService.refresh(gate.suite_id);
    systemLogger.info('TOOLS',`🔁 [P442] ${componentId}: Regression Suite ${gate.suite_id} status=${suite?.status} passed=${suite?.passed_count}/${gate.request_ids.length}`);
    return advanced;
  }

  /**
   * P447: 再利用できる未完了の Regression Gate を探す。なければ undefined。
   * 探し方は VERIFY_CODE_COMPONENT 経路と同じ（component_id・
   * implementation_hash・environment が一致する最新のもの）。再利用は
   * refresh 後の status が PLANNED/RUNNING で、QUEUED の要求が残って
   * いる場合に限る（markSubmitted の宛先がある場合だけ）。終わって
   * いる Suite（PASSED/FAILED/BLOCKED）は使い回さず、新しく作る。
   * なお advance の時点では verifyAndRegister が部品を ANALYZED へ
   * 登録し直した直後のため、部品状態による DEVICE_TESTED の早期復帰
   * はここでは判定できない（registerComponent は状態チェックなしの
   * 上書き）。その分岐は入れない。
   */
  private findReusableGate(componentId:string,environment:RegressionSuite['environment']):RegressionSuite|undefined{
    const component=componentRegistryService.getComponent(componentId);
    if(!component?.implementation_hash)return undefined;
    const existing=componentRegressionService.list()
      .filter(suite=>suite.component_id===componentId&&suite.implementation_hash===component.implementation_hash&&suite.environment===environment)
      .sort((a,b)=>b.created_at-a.created_at)[0];
    if(!existing)return undefined;
    const refreshed=componentRegressionService.refresh(existing.suite_id);
    if(!refreshed)return undefined;
    if(refreshed.status!=='PLANNED'&&refreshed.status!=='RUNNING')return undefined;
    const hasQueued=refreshed.case_bindings.some(binding=>executionRunnerService.getRequest(binding.request_id)?.status==='QUEUED');
    if(!hasQueued)return undefined;
    return refreshed;
  }}
export const multiIntentDevelopmentTransactionCoordinatorService=new MultiIntentDevelopmentTransactionCoordinatorService();
