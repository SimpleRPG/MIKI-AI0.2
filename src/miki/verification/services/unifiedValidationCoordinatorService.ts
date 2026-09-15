import { storageService } from '../../../services/storageService';
export type ValidationKind='SYNTAX'|'TYPE_CHECK'|'IMPORT_RESOLUTION'|'STATIC_ANALYSIS'|'UNIT'|'REGRESSION'|'MUTATION'|'CANARY'|'PROHIBITED_PATTERNS';
export interface ValidationEvidence { kind:ValidationKind; passed:boolean; evidenceId:string; runner:string; candidateHash:string; observedAt:number; simulated:boolean; details:string; }
export interface ValidationBundle { validationBundleId:string; candidateId:string; candidateHash:string; requiredKinds:ValidationKind[]; evidence:ValidationEvidence[]; allRequiredPassed:boolean; missingKinds:ValidationKind[]; failedKinds:ValidationKind[]; updatedAt:number; }
const KEY='miki_unified_validation_bundles_v1';
const REQUIRED:ValidationKind[]=['SYNTAX','TYPE_CHECK','IMPORT_RESOLUTION','STATIC_ANALYSIS','UNIT','REGRESSION','PROHIBITED_PATTERNS'];
export class UnifiedValidationCoordinatorService {
 private bundles=new Map<string,ValidationBundle>(); constructor(){this.load();}
 public record(candidateId:string,candidateHash:string,input:ValidationEvidence):ValidationBundle|undefined {
  if(!candidateId||!candidateHash||input.candidateHash!==candidateHash||!input.evidenceId||input.simulated)return undefined;
  const current=this.bundles.get(candidateId)||{validationBundleId:`VAL-${candidateId}`,candidateId,candidateHash,requiredKinds:[...REQUIRED],evidence:[],allRequiredPassed:false,missingKinds:[...REQUIRED],failedKinds:[],updatedAt:Date.now()};
  if(current.candidateHash!==candidateHash)return undefined;
  current.evidence=current.evidence.filter(e=>e.kind!==input.kind); current.evidence.push({...input,observedAt:input.observedAt||Date.now()});
  current.missingKinds=current.requiredKinds.filter(k=>!current.evidence.some(e=>e.kind===k)); current.failedKinds=current.evidence.filter(e=>!e.passed).map(e=>e.kind); current.allRequiredPassed=current.missingKinds.length===0&&current.failedKinds.length===0; current.updatedAt=Date.now(); this.bundles.set(candidateId,current);this.save();return this.clone(current);
 }

 public open(candidateId:string,candidateHash:string):ValidationBundle|undefined {
  if(!candidateId||!candidateHash)return undefined;
  const existing=this.bundles.get(candidateId);
  if(existing)return existing.candidateHash===candidateHash?this.clone(existing):undefined;
  const created:ValidationBundle={validationBundleId:`VAL-${candidateId}`,candidateId,candidateHash,requiredKinds:[...REQUIRED],evidence:[],allRequiredPassed:false,missingKinds:[...REQUIRED],failedKinds:[],updatedAt:Date.now()};
  this.bundles.set(candidateId,created);this.save();return this.clone(created);
 }
 public canPromote(candidateId:string,candidateHash:string):{allowed:boolean;reason:string;bundle?:ValidationBundle}{
  const bundle=this.bundles.get(candidateId);
  if(!bundle)return {allowed:false,reason:'VALIDATION_BUNDLE_MISSING'};
  if(bundle.candidateHash!==candidateHash)return {allowed:false,reason:'CANDIDATE_HASH_MISMATCH',bundle:this.clone(bundle)};
  if(!bundle.allRequiredPassed)return {allowed:false,reason:`VALIDATION_INCOMPLETE:${bundle.missingKinds.join(',')}:${bundle.failedKinds.join(',')}`,bundle:this.clone(bundle)};
  return {allowed:true,reason:'ALL_REQUIRED_VALIDATION_PASSED',bundle:this.clone(bundle)};
 }
 public get(candidateId:string):ValidationBundle|undefined{const b=this.bundles.get(candidateId);return b?this.clone(b):undefined;}
 private clone<T>(v:T):T{return JSON.parse(JSON.stringify(v));}
 private load(){try{for(const b of JSON.parse(storageService.getItem(KEY)||'[]'))this.bundles.set(b.candidateId,b);}catch{this.bundles.clear();}}
 private save(){storageService.setItem(KEY,JSON.stringify([...this.bundles.values()].slice(-1000)));}
}
export const unifiedValidationCoordinatorService=new UnifiedValidationCoordinatorService();
