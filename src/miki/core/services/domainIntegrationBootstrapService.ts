import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { executionEventBusService } from '../../execution/services/executionEventBusService';
import { claimVerificationEventService } from '../../verification/services/claimVerificationEventService';
import { selfImprovementRequestEventService } from '../../improvement/services/selfImprovementRequestEventService';
import { crossDomainCirculationService, type MikiDomain } from './crossDomainCirculationService';
import { domainRouterService, type DomainCommand, type DomainEnvelope, type DomainReply } from './domainRouterService';
import { blackboardRecoveryService } from './blackboardRecoveryService';
import { autonomousSelfImprovementLoopService } from './autonomousSelfImprovementLoopService';
import { autonomousIssueDiscoveryService } from './autonomousIssueDiscoveryService';

const DOMAINS:MikiDomain[]=['core','autonomy','capability','conversation','data','execution','experience','improvement','learning','memory','promotion','research','safety','selfAwareness','selfDevelopment','strategy','unknown','verification'];
const BASE_COMMANDS:DomainCommand[]=['HEALTH_CHECK','DESCRIBE','GET_STATUS'];

class DomainIntegrationBootstrapService{
 private initialized=false;
 private unsubscribers:Array<()=>void>=[];

 async initialize():Promise<void>{
  if(this.initialized)return;
  this.initialized=true;
  autonomousSelfImprovementLoopService.initialize();
  autonomousIssueDiscoveryService.initialize();
  const recovery=blackboardRecoveryService.recoverInterrupted();
  if(recovery.recovered.length>0)systemLogger.info('SELF_IMPROVEMENT',`[DomainIntegration] interrupted tasks recovered: ${recovery.recovered.length}`);
  for(const domain of DOMAINS)domainRouterService.register(domain,[...BASE_COMMANDS,...this.extraCommands(domain)],(envelope)=>this.handle(domain,envelope));
  this.unsubscribers.push(
   executionEventBusService.subscribe('execution.completed',e=>{crossDomainCirculationService.record('execution','learning','EXECUTION_COMPLETED',e.event_id);crossDomainCirculationService.record('execution','experience','EXECUTION_EXPERIENCE',e.event_id);}),
   executionEventBusService.subscribe('execution.failed',e=>{crossDomainCirculationService.record('execution','safety','EXECUTION_FAILED',e.event_id);crossDomainCirculationService.record('safety','improvement','FAILURE_REQUIRES_IMPROVEMENT',e.event_id);autonomousSelfImprovementLoopService.enqueue(`execution.failed:${e.event_id}:${e.component_id}`,'EXECUTION');}),
   claimVerificationEventService.subscribe(e=>{crossDomainCirculationService.record('verification',(e.outcome==='SUPPORTED'||e.outcome==='DEVICE_VERIFIED')?'promotion':'unknown',`CLAIM_${e.outcome}`,e.claimId);if(e.outcome==='CONTRADICTED'||e.outcome==='UNRESOLVED'){autonomousIssueDiscoveryService.recordContradiction(e.claimId,e.outcome);autonomousSelfImprovementLoopService.enqueue(`claim.${e.outcome}:${e.claimId}`,'SYSTEM');}}),
   selfImprovementRequestEventService.subscribe(e=>{crossDomainCirculationService.record(e.source==='AUTOPILOT'?'autonomy':'conversation','improvement','SELF_IMPROVEMENT_REQUESTED',e.trigger);autonomousSelfImprovementLoopService.enqueue(e.trigger,e.source);}),
  );
  systemLogger.info('SELF_IMPROVEMENT',`[DomainIntegration] ${DOMAINS.length} domains registered`);
 }

 dispose():void{autonomousIssueDiscoveryService.dispose();for(const u of this.unsubscribers)u();this.unsubscribers=[];for(const d of DOMAINS)domainRouterService.unregister(d);this.initialized=false;}
 getStatus(){return {initialized:this.initialized,registered:domainRouterService.getRegistrations(),missing:domainRouterService.getMissingDomains(DOMAINS),coverage:crossDomainCirculationService.getCoverage()};}

 private extraCommands(domain:MikiDomain):DomainCommand[]{
  if(domain==='conversation')return ['ANALYZE_TEXT'];
  if(domain==='unknown')return ['RESOLVE_UNKNOWN'];
  if(domain==='research')return ['RUN_RESEARCH'];
  if(domain==='improvement'||domain==='autonomy')return ['RUN_SELF_IMPROVEMENT'];
  if(domain==='memory')return ['FLUSH'];
  if(domain==='verification')return ['VALIDATE_CANDIDATE'];
  return [];
 }

 private async handle(domain:MikiDomain,envelope:DomainEnvelope):Promise<DomainReply>{
  const done=(result:unknown):DomainReply=>({accepted:true,domain,command:envelope.command,result,completedAt:Date.now()});
  if(envelope.command==='HEALTH_CHECK'||envelope.command==='DESCRIBE'||envelope.command==='GET_STATUS')return done({domain,registered:true,commands:domainRouterService.getRegistrations().find(x=>x.domain===domain)?.commands||[]});
  if(domain==='conversation'&&envelope.command==='ANALYZE_TEXT'){
   const {japaneseAnalysisComponentOrchestratorService}=await import('../../conversation/services/japaneseAnalysisComponentOrchestratorService');
   return done(await japaneseAnalysisComponentOrchestratorService.analyze(String(envelope.payload.text||'')));
  }
  if(domain==='unknown'&&envelope.command==='RESOLVE_UNKNOWN'){
   const {unifiedUnknownResolutionCoordinatorService}=await import('../../unknown/services/unifiedUnknownResolutionCoordinatorService');
   return done(await unifiedUnknownResolutionCoordinatorService.resolveForChat({question:String(envelope.payload.question||''),useSearch:Boolean(envelope.payload.useSearch),hasAttachments:Boolean(envelope.payload.hasAttachments)}));
  }
  if(domain==='research'&&envelope.command==='RUN_RESEARCH'){
   const {researchService}=await import('../../research/services/researchService');
   const {knowledgeGapService}=await import('../../unknown/services/knowledgeGapService');
   const gap=knowledgeGapService.getById(String(envelope.payload.gapId||''));
   if(!gap)return {accepted:false,domain,command:envelope.command,error:'KNOWLEDGE_GAP_NOT_FOUND',completedAt:Date.now()};
   return done(await researchService.researchGap(gap));
  }
  if((domain==='improvement'||domain==='autonomy')&&envelope.command==='RUN_SELF_IMPROVEMENT'){
   const {selfImprovementControllerService}=await import('../../improvement/services/selfImprovementControllerService');
   return done(await selfImprovementControllerService.runOnce(String(envelope.payload.trigger||'domain-router')));
  }
  if(domain==='memory'&&envelope.command==='FLUSH'){
   if(storageService.getBackendName()==='memory')return {accepted:false,domain,command:envelope.command,error:'MEMORY_ONLY_PERSISTENCE',completedAt:Date.now()};
   await storageService.flushNow();return done({backend:storageService.getBackendName(),persisted:true});
  }
  if(domain==='verification'&&envelope.command==='VALIDATE_CANDIDATE'){
   const {unifiedValidationCoordinatorService}=await import('../../verification/services/unifiedValidationCoordinatorService');
   return done(unifiedValidationCoordinatorService.canPromote(String(envelope.payload.candidateId||''),String(envelope.payload.candidateHash||'')));
  }
  return {accepted:false,domain,command:envelope.command,error:'DOMAIN_COMMAND_HANDLER_MISSING',completedAt:Date.now()};
 }
}
export const domainIntegrationBootstrapService=new DomainIntegrationBootstrapService();
