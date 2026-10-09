import { graphAnswerMeaningPipelineP216Service } from '../../conversation/services/graphAnswerMeaningPipelineP216Service';
import { conversationGraphRuntimeP212Service } from '../../conversation/services/conversationGraphRuntimeP212Service';
import { coreOrchestratorService, type CoreOrchestrationResult } from './coreOrchestratorService';
import type { MikiDomain } from './crossDomainCirculationService';
import { coreCycleSettingsService } from './coreCycleSettingsService';
export type CoreTaskKind='USER_REQUEST'|'SELF_IMPROVEMENT'|'EXECUTION_EVENT'|'VERIFICATION_EVENT'|'SYSTEM_TASK';
export interface CoreTaskIngressRequest {kind:CoreTaskKind;goal:string;source:MikiDomain|'core';payload?:Record<string,unknown>;initialPayload?:Record<string,unknown>;maxCycles?:number;}
class CoreTaskIngressService {
 async submit(request:CoreTaskIngressRequest):Promise<CoreOrchestrationResult>{
  if(!request.goal.trim())throw new Error('CORE_TASK_GOAL_REQUIRED');
  const maxCycles=request.maxCycles??coreCycleSettingsService.maxCyclesFor(request.kind);
  const result=await coreOrchestratorService.run(request.goal,request.source as MikiDomain,{...(request.payload||{}),...(request.initialPayload||{}),kind:request.kind},maxCycles);
  if(request.source==='conversation')conversationGraphRuntimeP212Service.ingestInput(result.task.taskId,request.goal);
  return result;
 }
 finalizeConversationResponse(taskId:string,response:unknown):CoreOrchestrationResult|undefined{const requirements=conversationGraphRuntimeP212Service.getAnswerRequirements(taskId,response);const finalized=requirements?graphAnswerMeaningPipelineP216Service.finalize(response,requirements):undefined;const finalResponse=finalized?.text??response;const result=coreOrchestratorService.finalizeConversationResponse(taskId,finalResponse);conversationGraphRuntimeP212Service.ingestOutput(taskId,finalResponse,{passed:Boolean(result)&&Boolean(finalized?.semanticPreservation.passed??true)&&Boolean(finalized?.executionConsistency.passed??true),counterexample:finalized&&!finalized.semanticPreservation.passed?finalized.semanticPreservation.missingMeaningIds.join(','):undefined,repair:finalized?.repaired?'P216_ANSWER_MEANING_REPAIR':undefined});return result;}
 resume(taskId:string,maxCycles=coreCycleSettingsService.maxCyclesFor('USER_REQUEST')):Promise<CoreOrchestrationResult|undefined>{
  if(!taskId.trim())throw new Error('CORE_TASK_ID_REQUIRED');
  return coreOrchestratorService.resume(taskId,maxCycles);
 }
 pause(taskId:string,reason?:string){return coreOrchestratorService.pause(taskId,reason);}
 cancel(taskId:string){return coreOrchestratorService.cancel(taskId);}
}
export const coreTaskIngressService=new CoreTaskIngressService();
