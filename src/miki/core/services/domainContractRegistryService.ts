import type { MikiDomain } from './crossDomainCirculationService';
import type { DomainCommand, DomainEnvelope, DomainReply, NormalizedDomainResult } from './domainRouterService';
import { canonicalSha256Object } from './canonicalSha256Service';

export interface DomainCapabilityManifest {
  domain: MikiDomain;
  commands: DomainCommand[];
  responsibilities: string[];
  inputContractVersion: 1;
  outputContractVersion: 1;
  requiresEvidenceForBusinessSuccess: boolean;
  registeredAt: number;
  manifestSha256: string;
}
export interface DomainContractValidation {
  valid: boolean;
  reasons: string[];
  normalized?: NormalizedDomainResult;
  contractSha256: string;
}
const DIAGNOSTIC=new Set<DomainCommand>(['ASSESS_DOMAIN','HEALTH_CHECK','DESCRIBE','GET_STATUS','PARTICIPATE','VERIFY_CONNECTION','DISCOVER_IMPROVEMENT_ISSUE','RUN_SELF_IMPROVEMENT','RESOLVE_UNKNOWN','ANALYZE_TEXT']);
export function isDiagnosticDomainCommand(command:DomainCommand):boolean{return DIAGNOSTIC.has(command);}
// P413: outcome vocabulary a domain result can declare about its own
// operation. A result declaring one of these is NOT claiming business
// success, even when the handler returned accepted=true:
// - TERMINAL_RESULT_OUTCOMES are verdicts that map onto the normalized
//   status of the same name (ERROR maps to FAILED).
// - WAITING_RESULT_OUTCOMES are declared in-progress states the
//   orchestrator already waits on (WAITING_EXECUTION / WAITING_CANARY).
// - OBSERVED_RESULT_OUTCOMES are honest no-result states (research
//   SOURCE_UNAVAILABLE / NO_RESULT and kin): the dispatch completed
//   and reported its state, so the normalized status is OBSERVED and
//   the outcome stays in normalized.data for downstream classification
//   (P410 T4 evidence-wait parking reads reply.data.outcome).
const TERMINAL_RESULT_OUTCOMES=new Set(['FAILED','ERROR','REJECTED']);
const WAITING_RESULT_OUTCOMES=new Set(['WAITING_EXECUTION','WAITING_CANARY','CANARY','PENDING_VERIFICATION']);
const OBSERVED_RESULT_OUTCOMES=new Set(['SOURCE_UNAVAILABLE','NO_RESULT','NO_RESULTS','NOT_FOUND','NOT_FOUND_AFTER_COVERAGE','CONFIRMED_ABSENCE','INSUFFICIENT_SEARCH','INSUFFICIENT_VERIFICATION','INSUFFICIENT_EVIDENCE','UNAVAILABLE','UNRESOLVED','UNVERIFIED']);
function declaredResultOutcome(reply:DomainReply):string{
 const result=reply.result&&typeof reply.result==='object'?(reply.result as Record<string,unknown>):undefined;
 const fromString=(value:unknown):string=>typeof value==='string'?value.trim().toUpperCase():'';
 return fromString(result?.outcome)||fromString(result?.status)||fromString(reply.status)||(result?.resolved===false?'UNRESOLVED':'');
}
class DomainContractRegistryService{
 private manifests=new Map<MikiDomain,DomainCapabilityManifest>();
 register(domain:MikiDomain,commands:DomainCommand[],responsibilities:string[]=[]):DomainCapabilityManifest{const base={domain,commands:[...new Set(commands)].sort(),responsibilities:[...new Set(responsibilities)].sort(),inputContractVersion:1 as const,outputContractVersion:1 as const,requiresEvidenceForBusinessSuccess:true,registeredAt:Date.now()};const manifest={...base,manifestSha256:canonicalSha256Object(base)};this.manifests.set(domain,manifest);return this.clone(manifest);}
 unregister(domain:MikiDomain):void{this.manifests.delete(domain);}
 get(domain:MikiDomain):DomainCapabilityManifest|undefined{const item=this.manifests.get(domain);return item?this.clone(item):undefined;}
 list():DomainCapabilityManifest[]{return [...this.manifests.values()].map(item=>this.clone(item));}
 validateEnvelope(envelope:DomainEnvelope):DomainContractValidation{const reasons:string[]=[];const manifest=this.manifests.get(envelope.target);if(!manifest)reasons.push('DOMAIN_MANIFEST_NOT_REGISTERED');else if(!manifest.commands.includes(envelope.command))reasons.push('COMMAND_NOT_IN_DOMAIN_MANIFEST');if(!envelope.envelopeId)reasons.push('ENVELOPE_ID_REQUIRED');if(!envelope.correlationId)reasons.push('CORRELATION_ID_REQUIRED');if(envelope.depth<0||envelope.depth>18)reasons.push('INVALID_DEPTH');return {valid:reasons.length===0,reasons,contractSha256:canonicalSha256Object({envelopeId:envelope.envelopeId,target:envelope.target,command:envelope.command,payload:envelope.payload,evidenceIds:envelope.evidenceIds})};}
 validateReply(envelope:DomainEnvelope,reply:DomainReply):DomainContractValidation{const reasons:string[]=[];if(reply.domain!==envelope.target)reasons.push('REPLY_DOMAIN_MISMATCH');if(reply.command!==envelope.command)reasons.push('REPLY_COMMAND_MISMATCH');if(!Number.isFinite(reply.completedAt))reasons.push('REPLY_COMPLETED_AT_REQUIRED');const diagnostic=isDiagnosticDomainCommand(envelope.command);const inferredEvidence=this.extractEvidenceIds(reply.result);const evidenceIds=[...new Set([...envelope.evidenceIds,...inferredEvidence,...(reply.normalized?.evidenceIds||[])])];let normalized:NormalizedDomainResult=reply.normalized||{status:reply.accepted?(diagnostic?'OBSERVED':'SUCCEEDED'):'REJECTED',operationClass:diagnostic?'DIAGNOSTIC':'BUSINESS',command:envelope.command,summary:reply.accepted?(diagnostic?'Domain state observed':'Domain business command completed'):(reply.error||'Domain command rejected'),data:reply.result,evidenceIds,retryable:!reply.accepted&&/MISSING|NOT_FOUND|WAIT|TIMEOUT|RESOURCE/.test(reply.error||'')};
  // P413: the default normalization above stamps every accepted
  // BUSINESS reply SUCCEEDED, but the reply's own result may declare
  // a non-success outcome (research returning SOURCE_UNAVAILABLE
  // with zero evidence; a verification verdict of FAILED /
  // WAITING_EXECUTION). Treating such a reply as an evidence-free
  // success claim rejected it as BUSINESS_SUCCESS_EVIDENCE_REQUIRED,
  // dropped the outcome, and poisoned the action lineage (device:
  // TASK-1793721497260-000003). Refine ONLY the default
  // normalization from the declared outcome: a domain-provided
  // normalized is the domain's own claim and is validated as-is, so
  // an explicit SUCCEEDED without evidence is still rejected below.
  if(!reply.normalized&&reply.accepted&&normalized.operationClass==='BUSINESS'){
   const declared=declaredResultOutcome(reply);
   if(TERMINAL_RESULT_OUTCOMES.has(declared))normalized={...normalized,status:declared==='REJECTED'?'REJECTED':'FAILED'};
   else if(WAITING_RESULT_OUTCOMES.has(declared))normalized={...normalized,status:declared as NormalizedDomainResult['status']};
   else if(OBSERVED_RESULT_OUTCOMES.has(declared)){
    const resultRecord=reply.result&&typeof reply.result==='object'?(reply.result as Record<string,unknown>):{};
    const declaredSummary=typeof resultRecord.summary==='string'&&resultRecord.summary.trim()?resultRecord.summary:(typeof resultRecord.reason==='string'&&resultRecord.reason.trim()?resultRecord.reason:normalized.summary);
    normalized={...normalized,status:'OBSERVED',summary:declaredSummary};
   }
  }if(normalized.command!==envelope.command)reasons.push('NORMALIZED_COMMAND_MISMATCH');if(diagnostic&&normalized.operationClass!=='DIAGNOSTIC')reasons.push('DIAGNOSTIC_CLASS_REQUIRED');if(!diagnostic&&normalized.operationClass!=='BUSINESS')reasons.push('BUSINESS_CLASS_REQUIRED');if(reply.accepted&&normalized.operationClass==='BUSINESS'&&normalized.status==='SUCCEEDED'&&evidenceIds.length===0)reasons.push('BUSINESS_SUCCESS_EVIDENCE_REQUIRED');if(!normalized.summary.trim())reasons.push('RESULT_SUMMARY_REQUIRED');return {valid:reasons.length===0,reasons,normalized:{...normalized,evidenceIds},contractSha256:canonicalSha256Object({envelopeId:envelope.envelopeId,domain:reply.domain,command:reply.command,accepted:reply.accepted,normalized:{...normalized,evidenceIds}})};}
 private extractEvidenceIds(value:unknown):string[]{const found=new Set<string>();const walk=(item:unknown,depth:number):void=>{if(depth>4||item===null||item===undefined)return;if(Array.isArray(item)){for(const child of item)walk(child,depth+1);return;}if(typeof item!=='object')return;for(const [key,child] of Object.entries(item as Record<string,unknown>)){if(/evidence(?:[_-]?ids?)?$/i.test(key)){if(typeof child==='string'&&child)found.add(child);if(Array.isArray(child))for(const id of child)if(typeof id==='string'&&id)found.add(id);}walk(child,depth+1);}};walk(value,0);return [...found];}
 private clone(item:DomainCapabilityManifest):DomainCapabilityManifest{return {...item,commands:[...item.commands],responsibilities:[...item.responsibilities]};}
}
export const domainContractRegistryService=new DomainContractRegistryService();
