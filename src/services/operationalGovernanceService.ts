import { mikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';

const now = () => Date.now();
const hash = (s: string) => { let h=2166136261; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(16).padStart(8,'0'); };
const clone = <T>(v:T):T => JSON.parse(JSON.stringify(v));
let seq=0;
const id=(p:string)=>`${p}-${++seq}-${hash(`${p}|${seq}`)}`;

export type SloGate='PASS'|'FAIL'|'INSUFFICIENT_EVIDENCE';
export interface CapabilitySlo { capability:string; minSuccessRate:number; maxFailureSeverity:number; maxLatencyMs:number; maxResource:number; maxRetries:number; requiredEvidence:number; hardSafety:boolean; }
export interface SloObservation { capability:string; success:boolean; failureSeverity:number; latencyMs:number; resource:number; retries:number; evidence:number; safetyOk:boolean; createdAt:number; }
export interface SloDecision { capability:string; gate:SloGate; reasons:string[]; sampleCount:number; metrics:Record<string,number>; checkedAt:number; }
class CapabilitySloService {
 private slos=new Map<string,CapabilitySlo>(); private obs:SloObservation[]=[];
 set(capability:string, slo:Partial<CapabilitySlo>):CapabilitySlo { const x:CapabilitySlo={capability,minSuccessRate:slo.minSuccessRate??0.9,maxFailureSeverity:slo.maxFailureSeverity??0.5,maxLatencyMs:slo.maxLatencyMs??10000,maxResource:slo.maxResource??1,maxRetries:slo.maxRetries??3,requiredEvidence:slo.requiredEvidence??0.8,hardSafety:slo.hardSafety!==false}; this.slos.set(capability,x); return clone(x); }
 observe(x:Omit<SloObservation,'createdAt'>){const o={...x,createdAt:now()};this.obs.unshift(o);this.obs=this.obs.slice(0,2000);return clone(o);}
 evaluate(capability:string,minSamples=3):SloDecision {const slo=this.slos.get(capability);if(!slo)return {capability,gate:'INSUFFICIENT_EVIDENCE',reasons:['NO_SLO_DEFINED'],sampleCount:0,metrics:{},checkedAt:now()};const rows=this.obs.filter(x=>x.capability===capability).slice(0,100);if(rows.length<minSamples)return {capability,gate:'INSUFFICIENT_EVIDENCE',reasons:['INSUFFICIENT_SAMPLES'],sampleCount:rows.length,metrics:{},checkedAt:now()};const successRate=rows.filter(x=>x.success).length/rows.length;const maxFailure=Math.max(...rows.map(x=>x.failureSeverity));const maxLatency=Math.max(...rows.map(x=>x.latencyMs));const maxResource=Math.max(...rows.map(x=>x.resource));const maxRetries=Math.max(...rows.map(x=>x.retries));const minEvidence=Math.min(...rows.map(x=>x.evidence));const safety=rows.every(x=>x.safetyOk);const reasons:string[]=[];if(successRate<slo.minSuccessRate)reasons.push('SUCCESS_RATE');if(maxFailure>slo.maxFailureSeverity)reasons.push('FAILURE_SEVERITY');if(maxLatency>slo.maxLatencyMs)reasons.push('LATENCY');if(maxResource>slo.maxResource)reasons.push('RESOURCE');if(maxRetries>slo.maxRetries)reasons.push('RETRIES');if(minEvidence<slo.requiredEvidence)reasons.push('EVIDENCE');if(slo.hardSafety&&!safety)reasons.push('SAFETY');return {capability,gate:reasons.length?'FAIL':'PASS',reasons,sampleCount:rows.length,metrics:{successRate,maxFailureSeverity:maxFailure,maxLatencyMs:maxLatency,maxResource,maxRetries,minEvidence},checkedAt:now()}; }
 list(){return clone([...this.slos.values()]);}
}
export const capabilitySloService=new CapabilitySloService();

export type PermissionClass='READ_ONLY'|'PROPOSE_ONLY'|'SANDBOX_EXECUTE'|'REVERSIBLE_EXECUTE'|'APPROVAL_REQUIRED'|'PROHIBITED';
export interface DelegationGrant { id:string; taskId:string; permission:PermissionClass; target:string; operation:string; expiresAt:number; maxUses:number; uses:number; active:boolean; approvalId?:string; createdAt:number; }
export interface ApprovalRequest { id:string; taskId:string; target:string; operation:string; expectedEffect:string; sideEffects:string[]; rollback:string[]; permission:PermissionClass; status:'PENDING'|'APPROVED'|'REJECTED'|'EXPIRED'; createdAt:number; }
class ApprovalPermissionService {
 private grants=new Map<string,DelegationGrant>(); private approvals=new Map<string,ApprovalRequest>();
 request(x:Omit<ApprovalRequest,'id'|'status'|'createdAt'>){const a={...x,id:id('approval'),status:'PENDING' as const,createdAt:now()};this.approvals.set(a.id,a);return clone(a);}
 decide(id0:string,approved:boolean){const a=this.approvals.get(id0);if(!a)return null;a.status=approved?'APPROVED':'REJECTED';if(approved&&a.permission!=='PROHIBITED')this.issue(a);return clone(a);}
 issue(a:ApprovalRequest,ttlMs=15*60*1000,maxUses=1){const g:DelegationGrant={id:id('grant'),taskId:a.taskId,permission:a.permission,target:a.target,operation:a.operation,expiresAt:now()+ttlMs,maxUses,uses:0,active:true,approvalId:a.id,createdAt:now()};this.grants.set(g.id,g);return g;}
 authorize(grantId:string,taskId:string,target:string,operation:string){const g=this.grants.get(grantId);if(!g||!g.active)return {allowed:false,reason:'NO_ACTIVE_GRANT'};if(g.taskId!==taskId||g.target!==target||g.operation!==operation)return {allowed:false,reason:'SCOPE_MISMATCH'};if(now()>=g.expiresAt){g.active=false;return {allowed:false,reason:'EXPIRED'};}if(g.uses>=g.maxUses){g.active=false;return {allowed:false,reason:'USE_LIMIT'};}if(g.permission==='PROHIBITED'||g.permission==='APPROVAL_REQUIRED')return {allowed:false,reason:'APPROVAL_BOUNDARY'};g.uses++;if(g.uses>=g.maxUses)g.active=false;return {allowed:true,grant:clone(g)};}
 revoke(grantId:string){const g=this.grants.get(grantId);if(!g)return null;g.active=false;return clone(g);}
 listApprovals(){return clone([...this.approvals.values()]);} listGrants(){return clone([...this.grants.values()]);}
}
export const approvalPermissionService=new ApprovalPermissionService();

export interface CognitiveCheckpoint { id:string; parentCheckpointId?:string; baseSnapshotId:string; changedFacts:string[]; addedEvidence:string[]; invalidatedAssumptions:string[]; supersededRequirements:string[]; taskStateChanges:string[]; memoryStateChanges:string[]; skillStateChanges:string[]; artifactReferences:string[]; configurationChanges:string[]; stateHash:string; integrityHash:string; layer:'HOT'|'WARM'|'COLD'|'EPHEMERAL'; verified:boolean; createdAt:number; }
class CognitiveStateCheckpointService {
 private checkpoints=new Map<string,CognitiveCheckpoint>();
 create(input:Omit<CognitiveCheckpoint,'id'|'stateHash'|'integrityHash'|'createdAt'|'verified'>):CognitiveCheckpoint {const payload=JSON.stringify(input);const stateHash=hash(payload);const integrityHash=hash(`${input.parentCheckpointId||''}|${input.baseSnapshotId}|${stateHash}`);const c={...input,id:id('checkpoint'),stateHash,integrityHash,verified:true,createdAt:now()};this.checkpoints.set(c.id,c);return clone(c);}
 verify(id0:string){const c=this.checkpoints.get(id0);if(!c)return false;const {id:_,stateHash,integrityHash,verified:__,createdAt:___,...rest}=c;const ok=hash(JSON.stringify(rest))===stateHash && hash(`${c.parentCheckpointId||''}|${c.baseSnapshotId}|${c.stateHash}`)===integrityHash;c.verified=ok;return ok;}
 chain(id0:string){const out:CognitiveCheckpoint[]=[];const seen=new Set<string>();let cur=this.checkpoints.get(id0);while(cur){if(seen.has(cur.id))return {ok:false,reason:'CYCLE',checkpoints:clone(out)};seen.add(cur.id);out.push(cur);cur=cur.parentCheckpointId?this.checkpoints.get(cur.parentCheckpointId):undefined;}return {ok:out.every(x=>this.verify(x.id)),checkpoints:clone(out.reverse())};}
 reconstruct(id0:string){const c=this.chain(id0);if(!c.ok)return {ok:false,reason:'INTEGRITY_OR_PARENT_FAILURE',checkpoints:c.checkpoints};return {ok:true,checkpointCount:c.checkpoints.length,stateHash:hash(c.checkpoints.map(x=>x.stateHash).join('|')),checkpoints:c.checkpoints};}
 list(limit=100){return clone([...this.checkpoints.values()].slice(-limit).reverse());}
}
export const cognitiveStateCheckpointService=new CognitiveStateCheckpointService();

export interface BlindComparison { id:string; taskId:string; inputHash:string; budgetHash:string; candidates:Array<{id:string;outputHash:string;resource:number;latencyMs:number;corrections:number}>; blindedOrder:string[]; winner?:string; evaluator:string; fair:boolean; createdAt:number; }
class BlindComparisonLabService {
 compare(input:{taskId:string;inputHash:string;budgetHash:string;candidates:BlindComparison['candidates'];evaluator?:string;expectedCompletion?:string}){const candidates=[...input.candidates].sort((a,b)=>hash(`${input.taskId}|${a.id}`).localeCompare(hash(`${input.taskId}|${b.id}`)));const scores=candidates.map(c=>({id:c.id,score:100-c.corrections*15-c.resource*10-Math.min(50,c.latencyMs/1000)})).sort((a,b)=>b.score-a.score);const r:BlindComparison={id:id('blind'),taskId:input.taskId,inputHash:input.inputHash,budgetHash:input.budgetHash,candidates:clone(input.candidates),blindedOrder:candidates.map(x=>x.id),winner:scores[0]?.id,evaluator:input.evaluator||'independent-evaluator',fair:!!input.inputHash&&!!input.budgetHash&&new Set(input.candidates.map(x=>x.id)).size===input.candidates.length,createdAt:now()};mikiUnifiedLearningContinuumService.observe({domain:'system',key:'blind_comparison',input:input.taskId,outcome:r.fair?'SUCCESS':'FAILURE',verified:r.fair,capabilityIds:['general.evaluation-governance'],lesson:`${r.id}:${r.winner||'none'}`});return clone(r);}
}
export const blindComparisonLabService=new BlindComparisonLabService();
