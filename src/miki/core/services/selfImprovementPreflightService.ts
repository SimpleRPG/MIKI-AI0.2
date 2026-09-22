import { storageService } from '../../../services/storageService';
import { selfCodeSpaceService } from './selfCodeSpaceService';
import { improvementIntakeRouterService } from './improvementIntakeRouterService';
export interface PreflightResult { passed:boolean; runId:string; reasons:string[]; checkedAt:number; }
class SelfImprovementPreflightService {
 evaluate(runId:string):PreflightResult { const reasons:string[]=[]; const run=improvementIntakeRouterService.get(runId); if(!run)reasons.push('RUN_NOT_FOUND'); if(selfCodeSpaceService.listSourceFiles().length===0)reasons.push('SOURCE_SNAPSHOT_EMPTY'); if(storageService.getBackendName()==='memory')reasons.push('PERSISTENT_BACKEND_REQUIRED'); const result={passed:reasons.length===0,runId,reasons,checkedAt:Date.now()}; storageService.setItem(`miki_preflight_${runId}`,JSON.stringify(result)); return result; }
}
export const selfImprovementPreflightService=new SelfImprovementPreflightService();
