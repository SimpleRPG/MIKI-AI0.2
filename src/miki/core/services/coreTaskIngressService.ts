import { coreOrchestratorService, type CoreOrchestrationResult } from './coreOrchestratorService';
import type { MikiDomain } from './crossDomainCirculationService';
import { coreCycleSettingsService } from './coreCycleSettingsService';
export type CoreTaskKind='USER_REQUEST'|'SELF_IMPROVEMENT'|'EXECUTION_EVENT'|'VERIFICATION_EVENT'|'SYSTEM_TASK';
export interface CoreTaskIngressRequest {kind:CoreTaskKind;goal:string;source:MikiDomain|'core';payload?:Record<string,unknown>;initialPayload?:Record<string,unknown>;maxCycles?:number;}
class CoreTaskIngressService {
 submit(request:CoreTaskIngressRequest):Promise<CoreOrchestrationResult>{
  if(!request.goal.trim())throw new Error('CORE_TASK_GOAL_REQUIRED');
  const maxCycles=request.maxCycles??coreCycleSettingsService.maxCyclesFor(request.kind);
  return coreOrchestratorService.run(request.goal,request.source as MikiDomain,{kind:request.kind,...(request.payload||{}),...(request.initialPayload||{})},maxCycles);
 }
 finalizeConversationResponse(taskId:string,response:unknown):CoreOrchestrationResult|undefined{return coreOrchestratorService.finalizeConversationResponse(taskId,response);}
 resume(taskId:string,maxCycles=coreCycleSettingsService.maxCyclesFor('USER_REQUEST')):Promise<CoreOrchestrationResult|undefined>{
  if(!taskId.trim())throw new Error('CORE_TASK_ID_REQUIRED');
  return coreOrchestratorService.resume(taskId,maxCycles);
 }
 pause(taskId:string,reason?:string){return coreOrchestratorService.pause(taskId,reason);}
 cancel(taskId:string){return coreOrchestratorService.cancel(taskId);}
}
export const coreTaskIngressService=new CoreTaskIngressService();
