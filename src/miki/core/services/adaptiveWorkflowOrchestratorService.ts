import { domainRouterService } from './domainRouterService';
import { taskBlackboardService, type BlackboardTask } from './taskBlackboardService';
import { adaptiveRoutePlannerService } from './adaptiveRoutePlannerService';
import type { MikiDomain } from './crossDomainCirculationService';
import { negativeKnowledgeService } from './negativeKnowledgeService';
import { plateauDetectorService } from './plateauDetectorService';
export interface AdaptiveWorkflowResult { task:BlackboardTask; cycles:number; dispatched:number; }
class AdaptiveWorkflowOrchestratorService{
 async resume(taskId:string,maxCycles=6):Promise<AdaptiveWorkflowResult|undefined>{const resumed=taskBlackboardService.resume(taskId);if(!resumed)return undefined;return this.continueTask(taskId,maxCycles);}
 pause(taskId:string,reason?:string){return taskBlackboardService.pause(taskId,reason);}
 cancel(taskId:string){return taskBlackboardService.cancel(taskId);}
 async run(goal:string,source:MikiDomain='core',payload:Record<string,unknown>={},maxCycles=6):Promise<AdaptiveWorkflowResult>{
  const created=taskBlackboardService.create(goal,source,payload);
  taskBlackboardService.setStatus(created.taskId,'ROUTING');
  return this.continueTask(created.taskId,maxCycles);
 }
 private async continueTask(taskId:string,maxCycles:number):Promise<AdaptiveWorkflowResult>{
  let dispatched=0;let cycles=taskBlackboardService.get(taskId)?.lastCycle||0;
  while(cycles<Math.max(1,Math.min(maxCycles,18))){
   cycles+=1;taskBlackboardService.setCycle(taskId,cycles);const current=taskBlackboardService.get(taskId);if(!current||current.status==='PAUSED'||current.status==='CANCELLED')break;
   taskBlackboardService.append(taskId,'CHECKPOINT','core',`cycle:${cycles}`,{revision:current.revision,cycle:cycles});
   const plateau=plateauDetectorService.evaluate(current);if(plateau.plateau){taskBlackboardService.pause(taskId,plateau.reason);break;}
   const routes=adaptiveRoutePlannerService.plan(current).filter(route=>negativeKnowledgeService.canRetry(route.target,route.command,route.reason));if(routes.length===0)break;
   taskBlackboardService.setPending(taskId,routes.map(r=>r.target));
   for(const route of routes){
    const envelope=domainRouterService.create('core',route.target,route.command,{...route.payload,taskId:taskId},{correlationId:taskId,depth:cycles});
    taskBlackboardService.append(taskId,'DECISION','core',`route:${route.target}`,route.reason);
    const reply=await domainRouterService.dispatch(envelope);dispatched+=1;
    taskBlackboardService.append(taskId,reply.accepted?'RESULT':'ERROR',route.target,route.command,reply.accepted?reply.normalized:reply.error,reply.normalized?.evidenceIds||envelope.evidenceIds);if(!reply.accepted)negativeKnowledgeService.record(route.target,route.command,reply.error||route.reason,['research','strategy','safety']);
   }
   taskBlackboardService.setPending(taskId,[]);
   const after=taskBlackboardService.get(taskId);if(!after)break;
   if(adaptiveRoutePlannerService.shouldComplete(after)){taskBlackboardService.setStatus(taskId,'COMPLETED');break;}
  }
  const finalTask=taskBlackboardService.get(taskId)!;
  if(finalTask.status==='ROUTING')taskBlackboardService.setStatus(taskId,finalTask.entries.some(e=>e.kind==='ERROR')?'FAILED':'WAITING');
  return {task:taskBlackboardService.get(taskId)!,cycles,dispatched};
 }
}
export const adaptiveWorkflowOrchestratorService=new AdaptiveWorkflowOrchestratorService();
