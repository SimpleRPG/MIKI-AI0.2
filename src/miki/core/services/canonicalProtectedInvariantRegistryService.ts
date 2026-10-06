import { canonicalSha256Object } from './canonicalSha256Service';

export type ProtectedInvariantKind='PATH'|'SYMBOL'|'BEHAVIOR'|'CONTRACT';
export interface ProtectedInvariant {id:string;kind:ProtectedInvariantKind;selector:string;description:string;severity:'CRITICAL'|'HIGH'|'MEDIUM';required:boolean;tags:string[];}
export interface ProtectedInvariantRegistrySnapshot {registryId:string;version:number;createdAt:number;invariants:ProtectedInvariant[];sha256:string;}
export interface InvariantCandidateChange {paths?:string[];symbols?:string[];behaviors?:string[];contracts?:string[];declaredPreservations?:string[];}
export interface InvariantEvaluation {allowed:boolean;registryVersion:number;registrySha256:string;violations:{invariantId:string;reason:string;severity:ProtectedInvariant['severity']}[];evaluatedInvariantIds:string[];}

const DEFAULTS:ProtectedInvariant[]=[
 {id:'CORE_ROUTE_AUTHORITY',kind:'PATH',selector:'src/miki/core/',description:'All entry routes remain governed by CORE.',severity:'CRITICAL',required:true,tags:['core','routing']},
 {id:'NO_RUNTIME_SELF_REWRITE',kind:'BEHAVIOR',selector:'NO_RUNTIME_SELF_REWRITE',description:'Running application code must not rewrite its own canonical source.',severity:'CRITICAL',required:true,tags:['safety','adoption']},
 {id:'CANDIDATE_REQUIRES_EVIDENCE',kind:'CONTRACT',selector:'CANDIDATE_REQUIRES_EVIDENCE',description:'Candidate adoption requires validation evidence and rollback material.',severity:'CRITICAL',required:true,tags:['candidate','evidence']},
 {id:'ROLLBACK_HASH_INTEGRITY',kind:'CONTRACT',selector:'ROLLBACK_HASH_INTEGRITY',description:'Rollback must restore the exact pre-adoption hash.',severity:'CRITICAL',required:true,tags:['rollback','hash']}
];

function normalize(items:ProtectedInvariant[]):ProtectedInvariant[]{
 const ids=new Set<string>();
 return items.map(item=>({...item,id:item.id.trim(),selector:item.selector.trim(),tags:[...new Set(item.tags)].sort()})).sort((a,b)=>a.id.localeCompare(b.id)).filter(item=>{if(!item.id||ids.has(item.id))throw new Error(`DUPLICATE_OR_EMPTY_INVARIANT:${item.id}`);ids.add(item.id);return true;});
}

class CanonicalProtectedInvariantRegistryService {
 private snapshot:ProtectedInvariantRegistrySnapshot;
 constructor(){this.snapshot=this.build(1,DEFAULTS);}
 private build(version:number,invariants:ProtectedInvariant[]):ProtectedInvariantRegistrySnapshot {const normalized=normalize(invariants);const body={registryId:'MIKI_CANONICAL_PROTECTED_INVARIANTS',version,invariants:normalized};return {...body,createdAt:Date.now(),sha256:canonicalSha256Object(body)};}
 getSnapshot():ProtectedInvariantRegistrySnapshot{return {...this.snapshot,invariants:this.snapshot.invariants.map(x=>({...x,tags:[...x.tags]}))};}
 replace(expectedVersion:number,invariants:ProtectedInvariant[]):ProtectedInvariantRegistrySnapshot {if(expectedVersion!==this.snapshot.version)throw new Error('INVARIANT_REGISTRY_VERSION_CONFLICT');this.snapshot=this.build(expectedVersion+1,invariants);return this.getSnapshot();}
 evaluate(change:InvariantCandidateChange):InvariantEvaluation {const declared=new Set(change.declaredPreservations||[]);const values:Record<ProtectedInvariantKind,string[]>={PATH:change.paths||[],SYMBOL:change.symbols||[],BEHAVIOR:change.behaviors||[],CONTRACT:change.contracts||[]};const violations:InvariantEvaluation['violations']=[];for(const invariant of this.snapshot.invariants){const touched=values[invariant.kind].some(value=>value===invariant.selector||value.startsWith(invariant.selector));if(touched&&!declared.has(invariant.id))violations.push({invariantId:invariant.id,reason:`PROTECTED_${invariant.kind}_TOUCHED_WITHOUT_PRESERVATION`,severity:invariant.severity});}return {allowed:violations.length===0,registryVersion:this.snapshot.version,registrySha256:this.snapshot.sha256,violations,evaluatedInvariantIds:this.snapshot.invariants.map(x=>x.id)};}
}
export const canonicalProtectedInvariantRegistryService=new CanonicalProtectedInvariantRegistryService();
