import { storageService } from '../../../services/storageService';
import { selfCodeSpaceService } from './selfCodeSpaceService';
import { improvementIntakeRouterService } from './improvementIntakeRouterService';
import { selfKnowledgeHealthService } from './selfKnowledgeHealthService';
export interface PreflightResult { passed:boolean; runId:string; reasons:string[]; checkedAt:number; }
class SelfImprovementPreflightService {
 async evaluate(runId: string): Promise<PreflightResult> {
    await storageService.ready;
    const reasons: string[] = [];
    const run = improvementIntakeRouterService.get(runId);
    if (!run) reasons.push('RUN_NOT_FOUND');
    // P366: index-first retention (P352) holds only the light manifest;
    // that is a valid synced state, not an empty snapshot.
    const lightManifest = selfCodeSpaceService.getLightManifest();
    if (selfCodeSpaceService.listSourceFiles().length === 0 && !(lightManifest && lightManifest.files.length > 0)) reasons.push('SOURCE_SNAPSHOT_EMPTY');
    if (storageService.getBackendName() === 'memory') reasons.push('PERSISTENT_BACKEND_REQUIRED');
    // P375: do not start improvement work on a broken self-knowledge
    // base (for example a catalog that no longer builds). Warnings
    // (stale index) self-heal and do not block.
    const health = selfKnowledgeHealthService.check();
    if (health.status === 'BROKEN') reasons.push(`SELF_KNOWLEDGE_BROKEN:${health.checks.filter(item => item.status === 'FAIL').map(item => item.id).join(',')}`);
    const result: PreflightResult = { passed: reasons.length === 0, runId, reasons, checkedAt: Date.now() };
    storageService.setItem(`miki_preflight_${runId}`, JSON.stringify(result));
    return result;
  }
}
export const selfImprovementPreflightService=new SelfImprovementPreflightService();
