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
const DIAGNOSTIC=new Set<DomainCommand>(['ASSESS_DOMAIN','HEALTH_CHECK','DESCRIBE','GET_STATUS','PARTICIPATE','VERIFY_CONNECTION']);
class DomainContractRegistryService{
 private manifests=new Map<MikiDomain,DomainCapabilityManifest>();
 register(domain:MikiDomain,commands:DomainCommand[],responsibilities:string[]=[]):DomainCapabilityManifest{const base={domain,commands:[...new Set(commands)].sort(),responsibilities:[...new Set(responsibilities)].sort(),inputContractVersion:1 as const,outputContractVersion:1 as const,requiresEvidenceForBusinessSuccess:true,registeredAt:Date.now()};const manifest={...base,manifestSha256:canonicalSha256Object(base)};this.manifests.set(domain,manifest);return this.clone(manifest);}
 unregister(domain:MikiDomain):void{this.manifests.delete(domain);}
 get(domain:MikiDomain):DomainCapabilityManifest|undefined{const item=this.manifests.get(domain);return item?this.clone(item):undefined;}
 list():DomainCapabilityManifest[]{return [...this.manifests.values()].map(item=>this.clone(item));}
 validateEnvelope(envelope:DomainEnvelope):DomainContractValidation{const reasons:string[]=[];const manifest=this.manifests.get(envelope.target);if(!manifest)reasons.push('DOMAIN_MANIFEST_NOT_REGISTERED');else if(!manifest.commands.includes(envelope.command))reasons.push('COMMAND_NOT_IN_DOMAIN_MANIFEST');if(!envelope.envelopeId)reasons.push('ENVELOPE_ID_REQUIRED');if(!envelope.correlationId)reasons.push('CORRELATION_ID_REQUIRED');if(envelope.depth<0||envelope.depth>18)reasons.push('INVALID_DEPTH');return {valid:reasons.length===0,reasons,contractSha256:canonicalSha256Object({envelopeId:envelope.envelopeId,target:envelope.target,command:envelope.command,payload:envelope.payload,evidenceIds:envelope.evidenceIds})};}
 validateReply(envelope:DomainEnvelope,reply:DomainReply):DomainContractValidation{const reasons:string[]=[];if(reply.domain!==envelope.target)reasons.push('REPLY_DOMAIN_MISMATCH');if(reply.command!==envelope.command)reasons.push('REPLY_COMMAND_MISMATCH');if(!Number.isFinite(reply.completedAt))reasons.push('REPLY_COMPLETED_AT_REQUIRED');const diagnostic=DIAGNOSTIC.has(envelope.command);const inferredEvidence=this.extractEvidenceIds(reply.result);const evidenceIds=[...new Set([...envelope.evidenceIds,...inferredEvidence,...(reply.normalized?.evidenceIds||[])])];const normalized:NormalizedDomainResult=reply.normalized||{status:reply.accepted?(diagnostic?'OBSERVED':'SUCCEEDED'):'REJECTED',operationClass:diagnostic?'DIAGNOSTIC':'BUSINESS',command:envelope.command,summary:reply.accepted?(diagnostic?'Domain state observed':'Domain business command completed'):(reply.error||'Domain command rejected'),data:reply.result,evidenceIds,retryable:!reply.accepted&&/MISSING|NOT_FOUND|WAIT|TIMEOUT|RESOURCE/.test(reply.error||'')};if(normalized.command!==envelope.command)reasons.push('NORMALIZED_COMMAND_MISMATCH');if(diagnostic&&normalized.operationClass!=='DIAGNOSTIC')reasons.push('DIAGNOSTIC_CLASS_REQUIRED');if(!diagnostic&&normalized.operationClass!=='BUSINESS')reasons.push('BUSINESS_CLASS_REQUIRED');if(reply.accepted&&normalized.operationClass==='BUSINESS'&&normalized.status==='SUCCEEDED'&&evidenceIds.length===0)reasons.push('BUSINESS_SUCCESS_EVIDENCE_REQUIRED');if(!normalized.summary.trim())reasons.push('RESULT_SUMMARY_REQUIRED');return {valid:reasons.length===0,reasons,normalized:{...normalized,evidenceIds},contractSha256:canonicalSha256Object({envelopeId:envelope.envelopeId,domain:reply.domain,command:reply.command,accepted:reply.accepted,normalized:{...normalized,evidenceIds}})};}
 private extractEvidenceIds(value:unknown):string[]{const found=new Set<string>();const walk=(item:unknown,depth:number):void=>{if(depth>4||item===null||item===undefined)return;if(Array.isArray(item)){for(const child of item)walk(child,depth+1);return;}if(typeof item!=='object')return;for(const [key,child] of Object.entries(item as Record<string,unknown>)){if(/evidence(ids?)?/i.test(key)){if(typeof child==='string'&&child)found.add(child);if(Array.isArray(child))for(const id of child)if(typeof id==='string'&&id)found.add(id);}walk(child,depth+1);}};walk(value,0);return [...found];}
 private clone(item:DomainCapabilityManifest):DomainCapabilityManifest{return {...item,commands:[...item.commands],responsibilities:[...item.responsibilities]};}
}
export const domainContractRegistryService=new DomainContractRegistryService();
