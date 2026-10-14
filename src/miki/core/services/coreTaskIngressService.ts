import { graphAnswerMeaningPipelineP216Service, type P216FinalAnswer } from '../../conversation/services/graphAnswerMeaningPipelineP216Service';
import { conversationGraphRuntimeP212Service } from '../../conversation/services/conversationGraphRuntimeP212Service';
import { coreOrchestratorService, type CoreOrchestrationResult } from './coreOrchestratorService';
import type { MikiDomain } from './crossDomainCirculationService';
import { coreCycleSettingsService } from './coreCycleSettingsService';
export type CoreTaskKind='USER_REQUEST'|'SELF_IMPROVEMENT'|'EXECUTION_EVENT'|'VERIFICATION_EVENT'|'SYSTEM_TASK';
export interface CoreTaskIngressRequest {kind:CoreTaskKind;goal:string;source:MikiDomain|'core';payload?:Record<string,unknown>;initialPayload?:Record<string,unknown>;maxCycles?:number;}
export type CoreConversationFinalizationResult = CoreOrchestrationResult & { finalAnswer: string; finalization?: P216FinalAnswer };
class CoreTaskIngressService {
 async submit(request:CoreTaskIngressRequest):Promise<CoreOrchestrationResult>{
  if(!request.goal.trim())throw new Error('CORE_TASK_GOAL_REQUIRED');
  const maxCycles=request.maxCycles??coreCycleSettingsService.maxCyclesFor(request.kind);
  const result=await coreOrchestratorService.run(request.goal,request.source as MikiDomain,{...(request.payload||{}),...(request.initialPayload||{}),kind:request.kind},maxCycles);
  if(request.source==='conversation')conversationGraphRuntimeP212Service.ingestInput(result.task.taskId,request.goal);
  return result;
 }
 finalizeConversationResponse(taskId:string,response:unknown):CoreConversationFinalizationResult|undefined{
  const envelope=response&&typeof response==='object'&&!Array.isArray(response)?response as Record<string,unknown>:undefined;
  const candidate=typeof response==='string'?response:typeof envelope?.reply==='string'?envelope.reply:'';
  const requirements=conversationGraphRuntimeP212Service.getAnswerRequirements(taskId,envelope?.executionResult);
  const finalized=requirements?graphAnswerMeaningPipelineP216Service.finalize(candidate,requirements):undefined;
  const finalResponse=finalized?.text??'回答を確定できませんでした。会話入力または意味要件の記録を確認してください。';
  const result=coreOrchestratorService.finalizeConversationResponse(taskId,finalResponse);
  const failedReasons:string[]=[];
  if(!finalized)failedReasons.push('P216_ANSWER_REQUIREMENTS_MISSING');
  else{
   if(!finalized.semanticPreservation.passed)failedReasons.push(...finalized.semanticPreservation.missingMeaningIds,...finalized.semanticPreservation.contradictions);
   if(!finalized.executionConsistency.passed)failedReasons.push(...finalized.executionConsistency.unsupportedClaims);
   if(!finalized.grammar.passed)failedReasons.push(...finalized.grammar.issues);
  }
  if(!result)failedReasons.push('CORE_FINALIZATION_RESULT_MISSING');
  const passed=Boolean(result)&&finalized!==undefined&&finalized.semanticPreservation.passed&&finalized.executionConsistency.passed&&finalized.grammar.passed;
  conversationGraphRuntimeP212Service.ingestOutput(taskId,finalResponse,{passed,counterexample:failedReasons.length?[...new Set(failedReasons)].join(','):undefined,repair:finalized?.repaired?'P216_ANSWER_MEANING_REPAIR':undefined});
  return result?{...result,finalAnswer:finalResponse,...(finalized?{finalization:finalized}:{})}:undefined;
 }
 resume(taskId:string,maxCycles=coreCycleSettingsService.maxCyclesFor('USER_REQUEST')):Promise<CoreOrchestrationResult|undefined>{
  if(!taskId.trim())throw new Error('CORE_TASK_ID_REQUIRED');
  return coreOrchestratorService.resume(taskId,maxCycles);
 }
 pause(taskId:string,reason?:string){return coreOrchestratorService.pause(taskId,reason);}
 cancel(taskId:string){return coreOrchestratorService.cancel(taskId);}
}
export const coreTaskIngressService=new CoreTaskIngressService();
