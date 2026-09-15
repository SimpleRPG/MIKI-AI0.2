import type { BlackboardTask } from './taskBlackboardService';
export interface PlateauResult { plateau:boolean; repeatedRoutes:number; unchangedCycles:number; reason:string; }
class PlateauDetectorService{
 evaluate(task:BlackboardTask):PlateauResult{const routes=task.entries.filter(e=>e.kind==='DECISION'&&e.key.startsWith('route:')).map(e=>e.key);const repeatedRoutes=routes.length-new Set(routes).size;const checkpoints=task.entries.filter(e=>e.kind==='CHECKPOINT');const revisions=checkpoints.map(e=>Number((e.value as {revision?:number})?.revision||0));let unchangedCycles=0;for(let i=1;i<revisions.length;i+=1){if(revisions[i]===revisions[i-1])unchangedCycles+=1;}const plateau=repeatedRoutes>=3||unchangedCycles>=2;return {plateau,repeatedRoutes,unchangedCycles,reason:plateau?'NO_PROGRESS_DETECTED':'PROGRESS_OBSERVED'};}
}
export const plateauDetectorService=new PlateauDetectorService();
