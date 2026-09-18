import { coreTaskIngressService } from './coreTaskIngressService';
import type { CoreOrchestrationResult } from './coreOrchestratorService';
import type { MikiDomain } from './crossDomainCirculationService';
export type AdaptiveWorkflowResult=CoreOrchestrationResult;
class AdaptiveWorkflowOrchestratorService {
 run(goal:string,source:MikiDomain='core',payload:Record<string,unknown>={},maxCycles=18):Promise<AdaptiveWorkflowResult>{
  return coreTaskIngressService.submit({kind:this.resolveKind(payload),goal,source,payload,maxCycles});
 }
 resume(taskId:string,maxCycles=18):Promise<AdaptiveWorkflowResult|undefined>{return coreTaskIngressService.resume(taskId,maxCycles);}
 pause(taskId:string,reason?:string){return coreTaskIngressService.pause(taskId,reason);}
 cancel(taskId:string){return coreTaskIngressService.cancel(taskId);}
 private resolveKind(payload:Record<string,unknown>){return payload.orchestrationMode==='SELF_IMPROVEMENT_WORKER'?'SELF_IMPROVEMENT' as const:'SYSTEM_TASK' as const;}
}
export const adaptiveWorkflowOrchestratorService=new AdaptiveWorkflowOrchestratorService();
