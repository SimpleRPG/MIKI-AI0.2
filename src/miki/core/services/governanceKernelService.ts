import { storageService } from '../../../services/storageService';
import type { DomainEnvelope } from './domainRouterService';
export interface GovernanceDecision { allowed:boolean; reason:string; }
class GovernanceKernelService{
 private active=new Set<string>(); private seen=new Set<string>();
 inspect(envelope:DomainEnvelope):GovernanceDecision{
  if(envelope.depth>18)return {allowed:false,reason:'MAX_ROUTE_DEPTH'};
  if(!envelope.correlationId||!envelope.envelopeId)return {allowed:false,reason:'TRACE_REQUIRED'};
  if(this.seen.has(envelope.envelopeId))return {allowed:false,reason:'DUPLICATE_ENVELOPE'};
  if(this.active.has(envelope.correlationId)&&envelope.command==='RUN_SELF_IMPROVEMENT')return {allowed:false,reason:'SELF_IMPROVEMENT_REENTRY'};
  if(envelope.command==='FLUSH'&&storageService.getBackendName()==='memory')return {allowed:false,reason:'MEMORY_ONLY_PERSISTENCE'};
  return {allowed:true,reason:'ALLOWED'};
 }
 begin(envelope:DomainEnvelope):void{this.seen.add(envelope.envelopeId);if(envelope.command==='RUN_SELF_IMPROVEMENT')this.active.add(envelope.correlationId);}
 end(envelope:DomainEnvelope):void{if(envelope.command==='RUN_SELF_IMPROVEMENT')this.active.delete(envelope.correlationId);}
}
export const governanceKernelService=new GovernanceKernelService();
