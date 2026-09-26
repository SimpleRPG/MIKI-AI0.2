import { autonomousSelfImprovementLoopService, type AutonomousImprovementRequest } from './autonomousSelfImprovementLoopService';
import { evidenceBasedSelfImprovementEngine } from '../../improvement/services/evidenceBasedSelfImprovementEngine';
import type { ChangeSetID } from '../../../types/evidenceSelfImprovementTypes';
export interface SelfImprovementIngressRequest {trigger:string;source:AutonomousImprovementRequest['source'];runId?:string;changeSetId?:ChangeSetID;runType?:string;sourceId?:string;priority?:number;payload?:Record<string,unknown>;}
class SelfImprovementIngressService {
 submit(request:SelfImprovementIngressRequest):AutonomousImprovementRequest {
  const trigger=request.trigger.trim();if(!trigger)throw new Error('SELF_IMPROVEMENT_TRIGGER_REQUIRED');
  const changeSetId=request.changeSetId || evidenceBasedSelfImprovementEngine.generateChangeSetId(request.sourceId || request.runId || trigger);
  return autonomousSelfImprovementLoopService.enqueue(trigger,request.source,{runId:request.runId,changeSetId,runType:request.runType,sourceId:request.sourceId,priority:request.priority,payload:request.payload});
 }
 submitRun(run:{runId:string;runType:string;sourceId:string;objective:string;priority:number;payload:Record<string,unknown>;changeSetId?:ChangeSetID}):AutonomousImprovementRequest {
  const source:AutonomousImprovementRequest['source']=run.runType==='AUTONOMOUS_DISCOVERY'?'SYSTEM':run.runType==='EXECUTION_FAILURE'?'EXECUTION':'UI';
  return this.submit({trigger:run.objective,source,runId:run.runId,changeSetId:run.changeSetId,runType:run.runType,sourceId:run.sourceId,priority:run.priority,payload:run.payload});
 }
}
export const selfImprovementIngressService=new SelfImprovementIngressService();
