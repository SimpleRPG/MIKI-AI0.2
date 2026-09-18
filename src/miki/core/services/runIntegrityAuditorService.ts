import { storageService } from '../../../services/storageService';
import { improvementIntakeRouterService } from './improvementIntakeRouterService';
import { isolatedCandidateWorkspaceService } from './isolatedCandidateWorkspaceService';
import { candidateValidationEvidenceService } from './candidateValidationEvidenceService';
import { shadowEvaluationService } from './shadowEvaluationService';
export interface RunIntegrityReport { runId:string; workspaceId:string; passed:boolean; reasons:string[]; auditedAt:number; }
const KEY='miki_run_integrity_reports_v1';
class RunIntegrityAuditorService { private rows:RunIntegrityReport[]=[]; constructor(){try{this.rows=JSON.parse(storageService.getItem(KEY)||'[]');}catch{this.rows=[];}}
 audit(runId:string,workspaceId:string):RunIntegrityReport { const reasons:string[]=[]; const run=improvementIntakeRouterService.get(runId); const workspace=isolatedCandidateWorkspaceService.get(workspaceId); if(!run)reasons.push('RUN_NOT_FOUND'); if(!workspace)reasons.push('WORKSPACE_NOT_FOUND'); if(run&&run.workspaceId&&run.workspaceId!==workspaceId)reasons.push('RUN_WORKSPACE_MISMATCH'); if(workspace){const sha=workspace.files[0]?.candidateSha256||'';const validation=candidateValidationEvidenceService.evaluate(workspaceId,sha);if(!validation.passed)reasons.push('VALIDATION_NOT_COMPLETE');const shadow=shadowEvaluationService.latest(workspaceId);if(!shadow?.passed)reasons.push('SHADOW_NOT_PASSED');} const row={runId,workspaceId,passed:reasons.length===0,reasons,auditedAt:Date.now()};this.rows.push(row);storageService.setItem(KEY,JSON.stringify(this.rows.slice(-500)));return row; }
}
export const runIntegrityAuditorService=new RunIntegrityAuditorService();
