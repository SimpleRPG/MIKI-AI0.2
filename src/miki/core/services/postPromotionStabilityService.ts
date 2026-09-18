import { storageService } from '../../../services/storageService';
export type StabilityCheckpoint='IMMEDIATE'|'NEXT_SIMILAR_RUN'|'AFTER_RESTART'|'AFTER_RELATED_CHANGE';
export interface StabilityObservation { id:string; workspaceId:string; checkpoint:StabilityCheckpoint; passed:boolean; candidateSha256:string; observedAt:number; evidenceIds:string[]; }
const KEY='miki_post_promotion_stability_v1';
class PostPromotionStabilityService{private rows:StabilityObservation[]=[];constructor(){this.load();}
 record(input:Omit<StabilityObservation,'id'>){const row={...input,id:`STAB-${input.workspaceId}-${input.checkpoint}-${input.observedAt}`,evidenceIds:[...input.evidenceIds]};this.rows=this.rows.filter(x=>!(x.workspaceId===row.workspaceId&&x.checkpoint===row.checkpoint));this.rows.push(row);this.save();return row;}
 evaluate(workspaceId:string,candidateSha256:string){const required:StabilityCheckpoint[]=['IMMEDIATE','NEXT_SIMILAR_RUN','AFTER_RESTART','AFTER_RELATED_CHANGE'];const rows=this.rows.filter(x=>x.workspaceId===workspaceId&&x.candidateSha256===candidateSha256);const missing=required.filter(x=>!rows.some(r=>r.checkpoint===x));const failed=rows.filter(x=>!x.passed).map(x=>x.checkpoint);return {stable:missing.length===0&&failed.length===0,missing,failed};}
 private save(){storageService.setItem(KEY,JSON.stringify(this.rows.slice(-500)));}private load(){try{const raw=storageService.getItem(KEY);this.rows=raw?JSON.parse(raw):[];}catch{this.rows=[];}}}
export const postPromotionStabilityService=new PostPromotionStabilityService();
