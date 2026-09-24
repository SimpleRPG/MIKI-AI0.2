import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { crossDomainCirculationService, type MikiDomain } from './crossDomainCirculationService';
import { governanceKernelService } from './governanceKernelService';
import { resourceGovernanceService } from '../../safety/services/resourceGovernanceService';
import { domainContractRegistryService } from './domainContractRegistryService';

export type DomainCommand =
  | 'SYNTHESIZE_UNIVERSAL'
  | 'HEALTH_CHECK' | 'DESCRIBE' | 'ANALYZE_TEXT' | 'RESOLVE_UNKNOWN' | 'RUN_RESEARCH'
  | 'RUN_SELF_IMPROVEMENT' | 'SAVE_AUTONOMY_CONFIG' | 'GENERATE_CANDIDATE' | 'APPROVE_REVIEWED_CANDIDATE' | 'CREATE_REVIEW_PACKAGE' | 'PLAN_PENDING_IMPROVEMENT_RUN' | 'RESOLVE_CAPABILITY_GAPS' | 'DISCOVER_IMPROVEMENT_ISSUE' | 'LEARN_FROM_CORE_RESULT' | 'APPROVE_REUSABLE_COMPONENTS' | 'GET_STATUS' | 'FLUSH' | 'VALIDATE_CANDIDATE' | 'ASSESS_DOMAIN' | 'PARTICIPATE' | 'VERIFY_CONNECTION' | 'VERIFY_RESEARCH_CLAIMS';

export interface DomainEnvelope {
  envelopeId: string;
  correlationId: string;
  causationId?: string;
  source: MikiDomain;
  target: MikiDomain;
  command: DomainCommand;
  payload: Record<string, unknown>;
  evidenceIds: string[];
  createdAt: number;
  depth: number;
}

export interface NormalizedDomainResult { status:'SUCCEEDED'|'REJECTED'|'FAILED'|'OBSERVED'; operationClass:'BUSINESS'|'DIAGNOSTIC'; command:DomainCommand; summary:string; data?:unknown; evidenceIds:string[]; retryable:boolean; }

export interface DomainReply {
  accepted: boolean;
  domain: MikiDomain;
  command: DomainCommand;
  result?: unknown;
  normalized?: NormalizedDomainResult;
  error?: string;
  completedAt: number;
}

export type DomainHandler = (envelope: DomainEnvelope) => Promise<DomainReply>;
export interface DomainRegistration { domain:MikiDomain; commands:DomainCommand[]; registeredAt:number; }

const KEY='miki_domain_router_history_v1';
const MAX_DEPTH=18;
const MAX_HISTORY=2000;

class DomainRouterService {
  private handlers=new Map<MikiDomain,DomainHandler>();
  private registrations=new Map<MikiDomain,DomainRegistration>();
  private history:Array<{envelope:DomainEnvelope;reply:DomainReply}>=[];
  private sequence=0;

  constructor(){this.load();}

  register(domain:MikiDomain,commands:DomainCommand[],handler:DomainHandler):void{
    this.handlers.set(domain,handler);
    this.registrations.set(domain,{domain,commands:[...commands],registeredAt:Date.now()});
    domainContractRegistryService.register(domain,commands,[`${domain} domain handler`]);
  }

  unregister(domain:MikiDomain):void{
    this.handlers.delete(domain);
    this.registrations.delete(domain);
    domainContractRegistryService.unregister(domain);
  }

  create(source:MikiDomain,target:MikiDomain,command:DomainCommand,payload:Record<string,unknown>={},context?:Partial<Pick<DomainEnvelope,'correlationId'|'causationId'|'evidenceIds'|'depth'>>):DomainEnvelope{
    const now=Date.now();
    this.sequence+=1;
    const envelopeId=`DENV-${now}-${String(this.sequence).padStart(6,'0')}`;
    return {envelopeId,correlationId:context?.correlationId||envelopeId,causationId:context?.causationId,source,target,command,payload,evidenceIds:[...(context?.evidenceIds||[])],createdAt:now,depth:context?.depth||0};
  }

  async dispatch(envelope:DomainEnvelope):Promise<DomainReply>{
    const envelopeValidation=domainContractRegistryService.validateEnvelope(envelope);
    if(!envelopeValidation.valid)return {accepted:false,domain:envelope.target,command:envelope.command,error:`DOMAIN_ENVELOPE_CONTRACT_FAILED:${envelopeValidation.reasons.join('|')}`,completedAt:Date.now(),normalized:{status:'REJECTED',operationClass:'DIAGNOSTIC',command:envelope.command,summary:'Domain envelope contract rejected',data:{contractSha256:envelopeValidation.contractSha256,reasons:envelopeValidation.reasons},evidenceIds:[],retryable:false}};
    const coreOnlyDiagnostics=new Set<DomainCommand>(['ASSESS_DOMAIN','HEALTH_CHECK','DESCRIBE','GET_STATUS','PARTICIPATE','VERIFY_CONNECTION']);
    if(envelope.source!=='core'&&!coreOnlyDiagnostics.has(envelope.command))return this.finish(envelope,{accepted:false,domain:envelope.target,command:envelope.command,error:'CORE_ONLY_BUSINESS_ROUTING',completedAt:Date.now()});
    const resourceBlocked=(envelope.command==='RUN_SELF_IMPROVEMENT'||envelope.command==='RUN_RESEARCH'||(envelope.command==='VALIDATE_CANDIDATE'||envelope.command==='VERIFY_RESEARCH_CLAIMS'))&&!resourceGovernanceService.canRunComponentTests();
    if(resourceBlocked)return this.finish(envelope,{accepted:false,domain:envelope.target,command:envelope.command,error:'RESOURCE_GOVERNANCE_BLOCKED',completedAt:Date.now()});
    const governance=governanceKernelService.inspect(envelope);
    if(!governance.allowed)return this.finish(envelope,{accepted:false,domain:envelope.target,command:envelope.command,error:governance.reason,completedAt:Date.now()});
    if(envelope.depth>MAX_DEPTH)return this.finish(envelope,{accepted:false,domain:envelope.target,command:envelope.command,error:'DOMAIN_ROUTE_DEPTH_EXCEEDED',completedAt:Date.now()});
    const registration=this.registrations.get(envelope.target);
    const handler=this.handlers.get(envelope.target);
    if(!registration||!handler)return this.finish(envelope,{accepted:false,domain:envelope.target,command:envelope.command,error:'DOMAIN_ENTRY_NOT_REGISTERED',completedAt:Date.now()});
    if(!registration.commands.includes(envelope.command))return this.finish(envelope,{accepted:false,domain:envelope.target,command:envelope.command,error:'DOMAIN_COMMAND_NOT_SUPPORTED',completedAt:Date.now()});
    governanceKernelService.begin(envelope);
    crossDomainCirculationService.record(envelope.source,envelope.target,`ROUTE_${envelope.command}`,envelope.evidenceIds[0]);
    try{return this.finish(envelope,await handler(envelope));}
    catch(error){return this.finish(envelope,{accepted:false,domain:envelope.target,command:envelope.command,error:String(error),completedAt:Date.now()});}
    finally{governanceKernelService.end(envelope);}
  }

  getRegistrations():DomainRegistration[]{return [...this.registrations.values()].map(x=>({...x,commands:[...x.commands]}));}
  getMissingDomains(all:MikiDomain[]):MikiDomain[]{return all.filter(d=>!this.handlers.has(d));}
  list(limit=200){return this.history.slice(-Math.max(1,limit)).reverse();}

  private finish(envelope:DomainEnvelope,reply:DomainReply):DomainReply{
    const inferred=this.extractEvidenceIds(reply.result);const evidenceIds=[...new Set([...envelope.evidenceIds,...inferred])];const resultClass=reply.result&&typeof reply.result==='object'?(reply.result as Record<string,unknown>).operationClass:undefined;const diagnostic=resultClass==='DIAGNOSTIC'||envelope.command==='ASSESS_DOMAIN'||envelope.command==='HEALTH_CHECK'||envelope.command==='DESCRIBE'||envelope.command==='GET_STATUS'||envelope.command==='PARTICIPATE'||envelope.command==='VERIFY_CONNECTION'||envelope.command==='VERIFY_RESEARCH_CLAIMS';const validation=domainContractRegistryService.validateReply(envelope,reply);const completed:DomainReply=validation.valid?{...reply,normalized:validation.normalized}:{accepted:false,domain:envelope.target,command:envelope.command,error:`DOMAIN_REPLY_CONTRACT_FAILED:${validation.reasons.join('|')}`,completedAt:Date.now(),normalized:{status:'REJECTED',operationClass:'DIAGNOSTIC',command:envelope.command,summary:'Domain reply contract rejected',data:{contractSha256:validation.contractSha256,reasons:validation.reasons,originalAccepted:reply.accepted},evidenceIds:validation.normalized?.evidenceIds||evidenceIds,retryable:false}};
    this.history.push({envelope:{...envelope,payload:{...envelope.payload},evidenceIds:[...envelope.evidenceIds]},reply:{...completed}});
    if(this.history.length>MAX_HISTORY)this.history.splice(0,this.history.length-MAX_HISTORY);
    storageService.setItem(KEY,JSON.stringify(this.history));
    if(!reply.accepted)systemLogger.warn('SELF_IMPROVEMENT',`[DomainRouter] ${envelope.target}/${envelope.command} rejected`,reply.error||'unknown');
    return completed;
  }
  private extractEvidenceIds(value:unknown):string[]{
    const found=new Set<string>();
    const walk=(item:unknown,depth:number):void=>{
      if(depth>4||item===null||item===undefined)return;
      if(Array.isArray(item)){for(const child of item)walk(child,depth+1);return;}
      if(typeof item!=='object')return;
      for(const [key,child] of Object.entries(item as Record<string,unknown>)){
        if(/evidence(?:[_-]?ids?)?$/i.test(key)){
          if(typeof child==='string'&&child)found.add(child);
          if(Array.isArray(child))for(const id of child)if(typeof id==='string'&&id)found.add(id);
        }
        walk(child,depth+1);
      }
    };
    walk(value,0);
    return [...found];
  }
  private load():void{try{const raw=storageService.getItem(KEY);this.history=raw?JSON.parse(raw):[];}catch(error){this.history=[];systemLogger.warn('SELF_IMPROVEMENT','[DomainRouter] history load failed',String(error));}}
}
export const domainRouterService=new DomainRouterService();
