import { autonomousSelfImprovementLoopService, type AutonomousImprovementRequest } from './autonomousSelfImprovementLoopService';
export interface SelfImprovementIngressRequest {trigger:string;source:AutonomousImprovementRequest['source'];runId?:string;runType?:string;sourceId?:string;priority?:number;payload?:Record<string,unknown>;}
class SelfImprovementIngressService {
 submit(request:SelfImprovementIngressRequest):AutonomousImprovementRequest {
  const trigger=request.trigger.trim();if(!trigger)throw new Error('SELF_IMPROVEMENT_TRIGGER_REQUIRED');
  return autonomousSelfImprovementLoopService.enqueue(trigger,request.source,{runId:request.runId,runType:request.runType,sourceId:request.sourceId,priority:request.priority,payload:request.payload});
 }
 submitRun(run:{runId:string;runType:string;sourceId:string;objective:string;priority:number;payload:Record<string,unknown>}):AutonomousImprovementRequest {
  const source:AutonomousImprovementRequest['source']=run.runType==='AUTONOMOUS_DISCOVERY'?'SYSTEM':run.runType==='EXECUTION_FAILURE'?'EXECUTION':'UI';
  return this.submit({trigger:run.objective,source,runId:run.runId,runType:run.runType,sourceId:run.sourceId,priority:run.priority,payload:run.payload});
 }
}
export const selfImprovementIngressService=new SelfImprovementIngressService();
