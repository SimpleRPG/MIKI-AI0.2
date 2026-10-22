import { graphAnswerMeaningPipelineP216Service, type P216FinalAnswer } from '../../conversation/services/graphAnswerMeaningPipelineP216Service';
import { conversationGraphRuntimeP212Service } from '../../conversation/services/conversationGraphRuntimeP212Service';
import { coreOrchestratorService, type CoreOrchestrationResult } from './coreOrchestratorService';
import type { MikiDomain } from './crossDomainCirculationService';
import { coreCycleSettingsService } from './coreCycleSettingsService';
import { capabilityLedgerService } from '../../capability/services/capabilityLedgerService';
import { decomposeMultiIntent } from '../../unknown/services/multiIntentDecompositionService';
import { taskBlackboardService, isVerifiedTaskOutcome } from './taskBlackboardService';
import { mikiUnifiedLearningContinuumService } from '../../learning/services/mikiUnifiedLearningContinuumService';
import { canonicalSha256Object } from './canonicalSha256Service';
import { claimEvidenceService } from '../../research/services/claimEvidenceService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { cognitiveQualityService } from './cognitiveQualityService';
import { causalMemoryLedgerService } from '../../memory/services/causalMemoryLedgerService';
import { causalInvestigationService } from '../../research/services/causalInvestigationService';
export type CoreTaskKind='USER_REQUEST'|'SELF_IMPROVEMENT'|'EXECUTION_EVENT'|'VERIFICATION_EVENT'|'SYSTEM_TASK';
export interface CoreTaskIngressRequest {kind:CoreTaskKind;goal:string;source:MikiDomain|'core';payload?:Record<string,unknown>;initialPayload?:Record<string,unknown>;maxCycles?:number;}
export type CoreConversationFinalizationResult = CoreOrchestrationResult & { finalAnswer: string; finalization?: P216FinalAnswer };
class CoreTaskIngressService {
 async submit(request:CoreTaskIngressRequest):Promise<CoreOrchestrationResult>{
  if(!request.goal.trim())throw new Error('CORE_TASK_GOAL_REQUIRED');
  const maxCycles=request.maxCycles??coreCycleSettingsService.maxCyclesFor(request.kind);
  const payload:Record<string,unknown>={...(request.payload||{}),...(request.initialPayload||{}),kind:request.kind};
  const intentPlan=decomposeMultiIntent(request.goal);
  payload.intentPlan=intentPlan;
  payload.input=typeof payload.input==='string'?payload.input:request.goal;
  const clarificationPlan=cognitiveQualityService.selectClarification(Array.isArray(payload.clarificationCandidates)?payload.clarificationCandidates as never:[]);
  const explanationPlan=cognitiveQualityService.planExplanation({goal:request.goal,requestedLevel:payload.explanationLevel,userLevel:payload.userUnderstandingLevel});
  const potentialUnknownCandidates=cognitiveQualityService.predictPotentialUnknowns(request.goal);
  const preliminaryLearningOpportunities=cognitiveQualityService.discoverLearningOpportunities(request.goal,[request.source as MikiDomain]);
  const preliminaryTransferCandidates=cognitiveQualityService.crossDomainTransferCandidates(request.goal,[request.source as MikiDomain],false);
  payload.clarificationPlan=clarificationPlan;
  payload.explanationPlan=explanationPlan;
  payload.potentialUnknownCandidates=potentialUnknownCandidates;
  payload.learningOpportunities=preliminaryLearningOpportunities;
  payload.crossDomainTransferCandidates=preliminaryTransferCandidates;
  payload.cognitiveContinuity={schemaVersion:1,planKey:intentPlan.deterministicKey,intentCount:intentPlan.units.length,hypothesisCount:intentPlan.hypotheses.length,preparedAt:Date.now()};
  if(request.kind==='SELF_IMPROVEMENT')payload.capabilityLedgerContext=capabilityLedgerService.buildCoreContext(request.goal);
  const result=await coreOrchestratorService.run(request.goal,request.source as MikiDomain,payload,maxCycles);
  const task=result.task;
  taskBlackboardService.post(task.taskId,'OBSERVATION','core','cognitiveContinuity:requestPlan',{planKey:intentPlan.deterministicKey,isMultiIntent:intentPlan.isMultiIntent,intents:intentPlan.units.map(unit=>({id:unit.id,text:unit.text,goal:unit.goal,action:unit.action,target:unit.target,dependencies:unit.dependencies})),hypotheses:intentPlan.hypotheses,unresolved:intentPlan.unresolved},[]);
  taskBlackboardService.post(task.taskId,'OBSERVATION','core','decision:explanationPlan',explanationPlan,[]);
  if(clarificationPlan.selected)taskBlackboardService.post(task.taskId,'OBSERVATION','conversation','decision:informationGainClarification',clarificationPlan,[]);
  if(potentialUnknownCandidates.length)taskBlackboardService.post(task.taskId,'OBSERVATION','unknown','unknown:potentialCandidates',{candidates:potentialUnknownCandidates,policy:'HYPOTHESIS_ONLY_NOT_FACTS'},[]);
  const learningOpportunities=cognitiveQualityService.discoverLearningOpportunities(request.goal,task.visitedDomains);
  if(learningOpportunities.length)taskBlackboardService.post(task.taskId,'OBSERVATION','learning','learning:opportunityCandidates',{candidates:learningOpportunities,policy:'OUTCOME_EVALUATION_REQUIRED'},[]);
  const outcome=task.status==='COMPLETED'?'SUCCESS':task.status==='FAILED'?'FAILURE':'INCONCLUSIVE';
  const route=[...new Set(task.visitedDomains.filter(domain=>domain!=='core'))];
  const verified=isVerifiedTaskOutcome(task);
  const transferCandidates=cognitiveQualityService.crossDomainTransferCandidates(request.goal,task.visitedDomains,verified).map(candidate=>({...candidate,reusedInTask:task.entries.some(entry=>(entry.kind==='DECISION'||entry.kind==='RESULT')&&JSON.stringify(entry.value||{}).toLowerCase().includes(String(candidate.key).toLowerCase()))}));
  if(transferCandidates.length){
   taskBlackboardService.post(task.taskId,'OBSERVATION','learning','learning:crossDomainTransferCandidates',{candidates:transferCandidates,policy:'CAUSAL_CONFIRMATION_REQUIRED'},[]);
   for(const candidate of transferCandidates){
    const outcomeVerified=verified&&candidate.reusedInTask===true;
    causalMemoryLedgerService.append({requestId:String(payload.requestId||task.taskId),kind:'TRANSFER',subject:String(candidate.key),outcome:outcome==='SUCCESS'?'SUCCESS':outcome==='FAILURE'?'FAILURE':'INCONCLUSIVE',verified:outcomeVerified,source:outcomeVerified?'cross-domain-transfer-observed-target-outcome':'cross-domain-transfer-candidate'});
   }
   const transferEvaluation=transferCandidates.map(candidate=>{
    const records=causalMemoryLedgerService.list(1500).filter(record=>record.kind==='TRANSFER'&&record.subject===String(candidate.key)&&record.verified);
    const successes=records.filter(record=>record.outcome==='SUCCESS').length;
    const failures=records.filter(record=>record.outcome==='FAILURE').length;
    const measured=successes+failures;
    return {key:candidate.key,reusedInCurrentTask:candidate.reusedInTask===true,verifiedTargetOutcomes:measured,successes,failures,observedSuccessRate:measured?successes/measured:null,causalEffectEstablished:false,minimumSampleSize:5};
   });
   taskBlackboardService.post(task.taskId,'OBSERVATION','learning','learning:crossDomainTransferEvaluation',{evaluations:transferEvaluation,policy:'OBSERVATIONAL_SUCCESS_RATE_ONLY; NOT_CAUSAL_PROMOTION'},[]);
  }
  const evidenceIds=[...new Set(task.entries.flatMap(entry=>entry.evidenceIds).filter(Boolean))];
  const failureRefs=task.entries.filter(entry=>entry.kind==='ERROR').map(entry=>entry.key).slice(-20);
  const attribution={taskId:task.taskId,goalHash:canonicalSha256Object(request.goal),outcome,contributingDomains:route,capabilityRefs:[...new Set(task.entries.filter(entry=>/capability/i.test(entry.key)).map(entry=>entry.key))].slice(-20),evidenceIds,failures:failureRefs,causalStatus:'CANDIDATE_ONLY',verificationRequired:true,recordedAt:Date.now()};
  taskBlackboardService.post(task.taskId,'OBSERVATION','learning','learning:causalAttributionCandidate',attribution,evidenceIds);
  causalMemoryLedgerService.linkDecisionResult(String(payload.requestId||task.taskId),route.join('→')||String(request.source),outcome==='SUCCESS'?'SUCCESS':outcome==='FAILURE'?'FAILURE':'INCONCLUSIVE',verified,task.taskId);
  if(failureRefs.length){
   const investigation=causalInvestigationService.create(request.goal,failureRefs.slice(0,8));
   taskBlackboardService.post(task.taskId,'OBSERVATION','research','causal:investigationCandidate',{investigationId:investigation.id,hypothesisIds:investigation.hypotheses.map(item=>item.id),status:'OPEN',verificationRequired:true},evidenceIds);
  }
  mikiUnifiedLearningContinuumService.observe({domain:request.source==='conversation'?'conversation':request.source==='research'?'research':request.kind==='SELF_IMPROVEMENT'?'code':'system',key:`task:${request.kind}:${intentPlan.deterministicKey}`,action:'core_task_outcome',input:request.goal,outcome:outcome==='SUCCESS'?'SUCCESS':outcome==='FAILURE'?'FAILURE':'UNKNOWN',verified,capabilityIds:attribution.capabilityRefs,concepts:route.map(domain=>`domain:${domain}`),lesson:`task=${task.taskId}; status=${task.status}; causal attribution remains candidate-only`});
  if(request.source==='conversation')conversationGraphRuntimeP212Service.ingestInput(result.task.taskId,request.goal);
  return result;
 }
 finalizeConversationResponse(taskId:string,response:unknown):CoreConversationFinalizationResult|undefined{
  const envelope=response&&typeof response==='object'&&!Array.isArray(response)?response as Record<string,unknown>:undefined;
  const candidate=typeof response==='string'?response:typeof envelope?.reply==='string'?envelope.reply:'';
  const requirements=conversationGraphRuntimeP212Service.getAnswerRequirements(taskId,envelope?.executionResult);
  const finalized=requirements?graphAnswerMeaningPipelineP216Service.finalize(candidate,requirements):undefined;
  const finalResponse=finalized?.text??'回答を確定できませんでした。会話入力または意味要件の記録を確認してください。';
  const taskBefore=taskBlackboardService.get(taskId);
  const answerHash=canonicalSha256Object(finalResponse);
  const claimTrace=claimEvidenceService.extractClaimSentences(finalResponse).filter(sentence=>!/[?？]$/.test(sentence)).slice(0,20).map((sentence,index)=>{
   const sentenceHash=canonicalSha256Object(sentence);
   const candidateEvidence=claimEvidenceService.assessSentence(sentence);
   const originSourceId=`answer:${taskId}:${sentenceHash}:${index}`;
   const claim=claimDatabaseService.listClaims().find(item=>item.origin_source_id===originSourceId)||claimDatabaseService.registerClaim({statement:sentence,world:'REAL',kind:'FACT_CLAIM',status:'UNVERIFIED',source:'ai_output',origin_source_id:originSourceId,independence_cluster_id:`cluster_ai_answer_${taskId}`,maturity:'DISCOVERED',self_provenance:'SELF_SUPPORTED',open_world_status:'SEARCH_INCOMPLETE'});
   return {index,claimId:claim.claim_id,claimSentence:sentence,sentenceHash,candidateEvidenceIds:candidateEvidence.evidenceIds,assessment:candidateEvidence,verificationStatus:'UNVERIFIED',evidenceBinding:'CANDIDATE_ONLY_NOT_ATTACHED'};
  });
  const latestCognitiveStateEntry=[...(taskBefore?.entries||[])].reverse().find(entry=>entry.kind==='DECISION'&&entry.key.startsWith('cognitiveState:'));
  const latestCognitiveState=latestCognitiveStateEntry?.value&&typeof latestCognitiveStateEntry.value==='object'&&!Array.isArray(latestCognitiveStateEntry.value)?latestCognitiveStateEntry.value as Record<string,unknown>:{};
  const meaningCoreHash=typeof latestCognitiveState.semanticCoreHash==='string'?latestCognitiveState.semanticCoreHash:canonicalSha256Object({goal:taskBefore?.goal||'',constraints:Array.isArray(latestCognitiveState.constraints)?latestCognitiveState.constraints:[],evidenceIds:[...new Set((taskBefore?.entries||[]).flatMap(entry=>entry.evidenceIds).filter(Boolean))],unknowns:Array.isArray(latestCognitiveState.unknowns)?latestCognitiveState.unknowns:[]});
  taskBlackboardService.post(taskId,'OBSERVATION','verification','answer:claimEvidenceTrace',{answerHash,surfaceAnswerHash:answerHash,claimCount:claimTrace.length,claims:claimTrace,meaningCoreHash,claimSentenceHashes:claimTrace.map(item=>item.sentenceHash),semanticCoreSource:typeof latestCognitiveState.semanticCoreHash==='string'?'UNIFIED_COGNITIVE_STATE':'TASK_FALLBACK',unresolvedClaimCount:claimTrace.filter(item=>item.candidateEvidenceIds.length===0).length,unverifiedClaimCount:claimTrace.length,policy:'AI_OUTPUT_CLAIMS_REMAIN_UNVERIFIED; CANDIDATE_EVIDENCE_IS_NOT_ATTACHED_OR_PROMOTED; SURFACE_HASH_IS_SEPARATE_FROM_MEANING_CORE'},[...new Set(claimTrace.flatMap(item=>item.candidateEvidenceIds))]);
  const currentTask=taskBlackboardService.get(taskId);
  const currentGoal=currentTask?.goal.trim().normalize('NFKC').toLowerCase();
  const priorTask=taskBlackboardService.list(200).find(item=>item.taskId!==taskId&&item.status==='COMPLETED'&&item.goal.trim().normalize('NFKC').toLowerCase()===currentGoal&&item.entries.some(entry=>entry.key==='conversationResponseFinalized'));
  if(priorTask){
    const priorResponseEntry=[...priorTask.entries].reverse().find(entry=>entry.key==='conversationResponseFinalized');
    const priorResponse=priorResponseEntry?.value&&typeof priorResponseEntry.value==='object'&&!Array.isArray(priorResponseEntry.value)?(priorResponseEntry.value as Record<string,unknown>).response:undefined;
    const priorEvidence=[...new Set(priorTask.entries.flatMap(entry=>entry.evidenceIds).filter(Boolean))].sort();
    const currentEvidence=[...new Set((currentTask?.entries||[]).flatMap(entry=>entry.evidenceIds).filter(Boolean))].sort();
    const priorStateEntry=[...priorTask.entries].reverse().find(entry=>entry.kind==='DECISION'&&entry.key.startsWith('cognitiveState:'));
    const currentStateEntry=[...(currentTask?.entries||[])].reverse().find(entry=>entry.kind==='DECISION'&&entry.key.startsWith('cognitiveState:'));
    const priorState=priorStateEntry?.value&&typeof priorStateEntry.value==='object'&&!Array.isArray(priorStateEntry.value)?priorStateEntry.value as Record<string,unknown>:{};
    const currentState=currentStateEntry?.value&&typeof currentStateEntry.value==='object'&&!Array.isArray(currentStateEntry.value)?currentStateEntry.value as Record<string,unknown>:{};
    const diff=(key:string)=>{const before=Array.isArray(priorState[key])?priorState[key].map(String):[];const after=Array.isArray(currentState[key])?currentState[key].map(String):[];return {added:after.filter(value=>!before.includes(value)),removed:before.filter(value=>!after.includes(value))};};
    const stateDelta={evidenceIds:diff('evidenceIds'),capabilityRefs:diff('capabilityRefs'),constraints:diff('constraints'),unknowns:diff('unknowns'),learningRefs:diff('learningRefs'),semanticCoreChanged:priorState.semanticCoreHash!==currentState.semanticCoreHash};
    const priorHash=canonicalSha256Object(priorResponse??'');
    const currentHash=canonicalSha256Object(finalResponse);
    taskBlackboardService.post(taskId,'OBSERVATION','learning','learning:answerChangeExplanation',{priorTaskId:priorTask.taskId,priorAnswerHash:priorHash,currentAnswerHash:currentHash,changed:priorHash!==currentHash,changedEvidenceIds:currentEvidence.filter(id=>!priorEvidence.includes(id)),removedEvidenceIds:priorEvidence.filter(id=>!currentEvidence.includes(id)),priorRoute:priorTask.visitedDomains,currentRoute:currentTask?.visitedDomains||[],stateDelta,causeStatus:priorHash===currentHash?'UNCHANGED':'CAUSE_CANDIDATES_ONLY',reason:'State deltas are candidates; a causal explanation is not asserted unless linked evidence/verified learning identifies the change'},currentEvidence);
  }
  const failedReasons:string[]=[];
  if(!finalized)failedReasons.push('P216_ANSWER_REQUIREMENTS_MISSING');
  else{
   if(!finalized.semanticPreservation.passed)failedReasons.push(...finalized.semanticPreservation.missingMeaningIds,...finalized.semanticPreservation.contradictions);
   if(!finalized.executionConsistency.passed)failedReasons.push(...finalized.executionConsistency.unsupportedClaims);
   if(!finalized.grammar.passed)failedReasons.push(...finalized.grammar.issues);
  }
  const answerValidationPassed=finalized!==undefined&&finalized.semanticPreservation.passed&&finalized.executionConsistency.passed&&finalized.grammar.passed;
  const result=coreOrchestratorService.finalizeConversationResponse(taskId,finalResponse,{passed:answerValidationPassed,failedReasons:[...new Set(failedReasons)]});
  if(!result)failedReasons.push('CORE_FINALIZATION_RESULT_MISSING');
  const passed=Boolean(result)&&answerValidationPassed;
  conversationGraphRuntimeP212Service.ingestOutput(taskId,finalResponse,{passed,counterexample:failedReasons.length?[...new Set(failedReasons)].join(','):undefined,repair:finalized?.repaired?'P216_ANSWER_MEANING_REPAIR':undefined});
  mikiUnifiedLearningContinuumService.observe({domain:'conversation',key:`answer-quality:${canonicalSha256Object(taskBefore?.goal||taskId)}`,action:'semantic_answer_finalization',input:String(taskBefore?.goal||''),outcome:passed?'SUCCESS':'FAILURE',verified:passed&&Boolean(finalized),capabilityIds:['conversation.semantic-preservation','conversation.execution-consistency'],concepts:claimTrace.filter(item=>item.assessment.outcome!=='UNREGISTERED').map(item=>`claim:${item.assessment.claimId||item.sentenceHash}`).slice(0,12),lesson:`task=${taskId}; semantic=${Boolean(finalized?.semanticPreservation.passed)}; execution=${Boolean(finalized?.executionConsistency.passed)}; grammar=${Boolean(finalized?.grammar.passed)}; unverifiedClaims=${claimTrace.length}`});
  taskBlackboardService.post(taskId,passed?'RESULT':'OBSERVATION','learning','learning:answerOutcome',{passed,verified:passed&&Boolean(finalized),failedReasons:[...new Set(failedReasons)],claimCount:claimTrace.length,unregisteredClaimCount:claimTrace.filter(item=>item.assessment.outcome==='UNREGISTERED').length},[]);
  return result?{...result,finalAnswer:finalResponse,...(finalized?{finalization:finalized}:{})}:undefined;
 }
 async resume(taskId:string,maxCycles=coreCycleSettingsService.maxCyclesFor('USER_REQUEST')):Promise<CoreOrchestrationResult|undefined>{
  if(!taskId.trim())throw new Error('CORE_TASK_ID_REQUIRED');
  const task=taskBlackboardService.get(taskId);
  if(!task)throw new Error('CORE_TASK_NOT_FOUND');
  // CORE is the single authority for snapshot hashing, checkpoint-chain validation and
  // recovery. A duplicate wrapper-level check used to reject a recoverable valid snapshot
  // before CORE could re-root its missing/corrupt receipt.
  return coreOrchestratorService.resume(taskId,maxCycles);
 }
 pause(taskId:string,reason?:string){return coreOrchestratorService.pause(taskId,reason);}
 cancel(taskId:string){return coreOrchestratorService.cancel(taskId);}
}
export const coreTaskIngressService=new CoreTaskIngressService();
