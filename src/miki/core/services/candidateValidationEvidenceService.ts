import { storageService } from '../../../services/storageService';
export type ValidationStage='STATIC'|'TYPECHECK'|'REGRESSION'|'COUNTEREXAMPLE'|'GENERALIZATION'|'PERSISTENCE'|'DEVICE';
export interface ValidationEvidence { evidenceId:string; workspaceId:string; candidateSha256:string; stage:ValidationStage; passed:boolean; command:string; exitCode:number; startedAt:number; completedAt:number; logRef:string; }
const KEY='miki_candidate_validation_evidence_v1';
const REQUIRED:ValidationStage[]=['STATIC','TYPECHECK','REGRESSION','COUNTEREXAMPLE','GENERALIZATION','PERSISTENCE','DEVICE'];
class CandidateValidationEvidenceService{
 private rows:ValidationEvidence[]=[];constructor(){this.load();}
 record(input:Omit<ValidationEvidence,'evidenceId'>):ValidationEvidence{const evidenceId=`VE-${input.workspaceId}-${input.stage}-${input.completedAt}`;const row={...input,evidenceId};this.rows=this.rows.filter(x=>!(x.workspaceId===row.workspaceId&&x.stage===row.stage));this.rows.push(row);this.save();return {...row};}
 evaluate(workspaceId:string,candidateSha256:string){const rows=this.rows.filter(x=>x.workspaceId===workspaceId&&x.candidateSha256===candidateSha256);const missing=REQUIRED.filter(stage=>!rows.some(x=>x.stage===stage));const failed=rows.filter(x=>!x.passed||x.exitCode!==0).map(x=>x.stage);return {passed:missing.length===0&&failed.length===0,missing,failed,evidenceIds:rows.map(x=>x.evidenceId)};}
 list(workspaceId?:string){return this.rows.filter(x=>!workspaceId||x.workspaceId===workspaceId).map(x=>({...x}));}
 private save(){storageService.setItem(KEY,JSON.stringify(this.rows.slice(-1000)));}private load(){try{const raw=storageService.getItem(KEY);this.rows=raw?JSON.parse(raw):[];}catch{this.rows=[];}}
}
export const candidateValidationEvidenceService=new CandidateValidationEvidenceService();
