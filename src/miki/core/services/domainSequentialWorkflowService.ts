import { coreTaskIngressService } from './coreTaskIngressService';
import type { CoreOrchestrationResult } from './coreOrchestratorService';
import type { MikiDomain } from './crossDomainCirculationService';
export type SequentialWorkflowResult=CoreOrchestrationResult;
class DomainSequentialWorkflowService {
 run(goal:string,payload:Record<string,unknown>,source:MikiDomain='conversation'):Promise<SequentialWorkflowResult>{
  return coreTaskIngressService.submit({kind:'SYSTEM_TASK',goal,source,payload,maxCycles:18});
 }
}
export const domainSequentialWorkflowService=new DomainSequentialWorkflowService();
