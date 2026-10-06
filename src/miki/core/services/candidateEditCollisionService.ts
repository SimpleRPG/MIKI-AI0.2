import { canonicalSha256Object } from './canonicalSha256Service';
export interface CandidateEditClaim{claimId:string;taskId:string;paths:string[];baseRevision:string;claimedAt:number;expiresAt:number;status:'ACTIVE'|'RELEASED'|'EXPIRED';}
class CandidateEditCollisionService{
 private claims=new Map<string,CandidateEditClaim>();
 claim(taskId:string,paths:string[],baseRevision:string,ttlMs=1800000){this.expire();const normalized=[...new Set(paths.map(path=>path.trim()).filter(Boolean))].sort();const conflicts=[...this.claims.values()].filter(row=>row.status==='ACTIVE'&&row.taskId!==taskId&&row.paths.some(path=>normalized.includes(path)));if(conflicts.length)return{allowed:false,reasons:conflicts.flatMap(row=>row.paths.filter(path=>normalized.includes(path)).map(path=>`EDIT_COLLISION:${path}:${row.taskId}`)),conflicts};const now=Date.now();const seed={taskId,normalized,baseRevision,now};const claim:CandidateEditClaim={claimId:`ECLAIM-${canonicalSha256Object(seed).slice(0,22)}`,taskId,paths:normalized,baseRevision,claimedAt:now,expiresAt:now+Math.max(1000,ttlMs),status:'ACTIVE'};this.claims.set(claim.claimId,claim);return{allowed:true,reasons:[],claim};}
 release(claimId:string){const claim=this.claims.get(claimId);if(!claim)throw new Error('EDIT_CLAIM_NOT_FOUND');claim.status='RELEASED';return structuredClone(claim);}
 listActive(){this.expire();return[...this.claims.values()].filter(row=>row.status==='ACTIVE').map(row=>structuredClone(row));}
 private expire(){const now=Date.now();for(const row of this.claims.values())if(row.status==='ACTIVE'&&row.expiresAt<=now)row.status='EXPIRED';}
}
export const candidateEditCollisionService=new CandidateEditCollisionService();
