import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { crossDomainCirculationService, type MikiDomain } from './crossDomainCirculationService';
import { governanceKernelService } from './governanceKernelService';
import { resourceGovernanceService } from '../../safety/services/resourceGovernanceService';
import { domainContractRegistryService } from './domainContractRegistryService';

export type DomainCommand =
  | 'SYNTHESIZE_UNIVERSAL'
  | 'HEALTH_CHECK' | 'DESCRIBE' | 'ANALYZE_TEXT' | 'RESOLVE_UNKNOWN' | 'RUN_RESEARCH'
  | 'RUN_SELF_IMPROVEMENT' | 'SAVE_AUTONOMY_CONFIG' | 'GENERATE_CANDIDATE' | 'APPROVE_REVIEWED_CANDIDATE' | 'CREATE_REVIEW_PACKAGE' | 'PLAN_PENDING_IMPROVEMENT_RUN' | 'RESOLVE_CAPABILITY_GAPS' | 'DISCOVER_IMPROVEMENT_ISSUE' | 'LEARN_FROM_CORE_RESULT' | 'APPROVE_REUSABLE_COMPONENTS' | 'GET_STATUS' | 'FLUSH' | 'VALIDATE_CANDIDATE' | 'ASSESS_DOMAIN' | 'PARTICIPATE' | 'VERIFY_CONNECTION' | 'VERIFY_RESEARCH_CLAIMS' | 'VERIFY_CODE_COMPONENT' | 'PROCESS_DATA_RECORDS' | 'PLAN_EXECUTION_GRAPH' | 'SEARCH_MEMORY_INDEX' | 'ANALYZE_CANDIDATE_STRUCTURE' | 'ANALYZE_OWNED_DOMAIN';

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
  status?: 'PENDING_VERIFICATION'|'FAILED'|'SUCCEEDED';
  normalized?: NormalizedDomainResult;
  error?: string;
  completedAt: number;
}

export type DomainHandler = (envelope: DomainEnvelope) => Promise<DomainReply>;
export interface DomainRegistration { domain:MikiDomain; commands:DomainCommand[]; registeredAt:number; }

const KEY='miki_domain_router_history_v1';
const HISTORY_SEGMENT_PREFIX='miki_domain_router_history_v2_segment:';
const HISTORY_INDEX_KEY='miki_domain_router_history_v2_index';
const HISTORY_SEGMENT_MAX_ENTRIES=50;
const HISTORY_SEGMENT_MAX_CHARS=512*1024;
const MAX_DEPTH=18;
const MAX_HISTORY=2000;

type DomainHistoryEntry={envelope:DomainEnvelope;reply:DomainReply};
type DomainHistoryIndexEntry={id:string;segmentKey:string;createdAt:number};

class DomainRouterService {
  private handlers=new Map<MikiDomain,DomainHandler>();
  private registrations=new Map<MikiDomain,DomainRegistration>();
  private history:DomainHistoryEntry[]=[];
  private historyIndex:DomainHistoryIndexEntry[]=[];
  private pendingHistoryRecords:DomainHistoryEntry[]=[];
  private sequence=0;
  private historySegmentSequence=0;
  private historyPersistTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingHistoryCheckpoint: Pick<DomainEnvelope, 'command' | 'source' | 'target'> | null = null;
  private historyMigrationStarted=false;

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
    const inferred=this.extractEvidenceIds(reply.result);
    const evidenceIds=[...new Set([...envelope.evidenceIds,...inferred])];
    const validation=domainContractRegistryService.validateReply(envelope,reply);
    const completed:DomainReply=validation.valid
      ? {...reply,normalized:validation.normalized}
      : {accepted:false,domain:envelope.target,command:envelope.command,error:'DOMAIN_REPLY_CONTRACT_FAILED:'+validation.reasons.join('|'),completedAt:Date.now(),normalized:{status:'REJECTED',operationClass:'DIAGNOSTIC',command:envelope.command,summary:'Domain reply contract rejected',data:{contractSha256:validation.contractSha256,reasons:validation.reasons,originalAccepted:reply.accepted},evidenceIds:validation.normalized?.evidenceIds||evidenceIds,retryable:false}};
    const entry:DomainHistoryEntry={envelope:{...envelope,payload:{...envelope.payload},evidenceIds:[...envelope.evidenceIds]},reply:{...completed}};
    this.history.push(entry);
    if(this.history.length>MAX_HISTORY)this.history.splice(0,this.history.length-MAX_HISTORY);
    const reportSerializeBoundary=this.history.length===1||this.sequence%100===0;
    if(this.history.length===1)this.persistHistoryEntries([entry],envelope,true);
    else this.scheduleHistoryPersistence(entry,reportSerializeBoundary?envelope:undefined,reportSerializeBoundary);
    if(!reply.accepted)systemLogger.warn('SELF_IMPROVEMENT','[DomainRouter] '+envelope.target+'/'+envelope.command+' rejected',reply.error||'unknown');
    return completed;
  }

  private historySegmentKey():string{
    this.historySegmentSequence+=1;
    const timestamp=String(Date.now()).padStart(13,'0');
    const sequence=String(this.historySegmentSequence).padStart(8,'0');
    return HISTORY_SEGMENT_PREFIX+timestamp+'_'+sequence+'_'+Math.random().toString(36).slice(2,8);
  }

  private scheduleHistoryPersistence(entry:DomainHistoryEntry,envelope?:DomainEnvelope,reportBoundary=false):void{
    this.pendingHistoryRecords.push(entry);
    if(reportBoundary&&envelope)this.pendingHistoryCheckpoint={command:envelope.command,source:envelope.source,target:envelope.target};
    if(this.historyPersistTimer)return;
    this.historyPersistTimer=setTimeout(()=>{
      this.historyPersistTimer=null;
      const checkpoint=this.pendingHistoryCheckpoint;this.pendingHistoryCheckpoint=null;
      const entries=this.pendingHistoryRecords.splice(0);
      this.persistHistoryEntries(entries,checkpoint??undefined,checkpoint!==null);
    },50);
  }

  private persistHistoryEntries(entries:DomainHistoryEntry[],envelope?:Pick<DomainEnvelope,'command'|'source'|'target'>,reportBoundary=false):void{
    if(entries.length===0)return;
    if(reportBoundary)systemLogger.recordRuntimeDiagnostic('DOMAIN_ROUTER_CHECKPOINT',{phase:'SERIALIZE_BEGIN',command:envelope?.command??'BATCHED',source:envelope?.source??'core',target:envelope?.target??'core',historyCount:this.history.length,entryCount:entries.length});
    const startedAt=Date.now();let serializedChars=0;let segmentCount=0;
    let batch:DomainHistoryEntry[]=[];let batchJson:string[]=[];let batchChars=2;
    const writeBatch=()=>{
      if(batch.length===0)return;
      const segmentKey=this.historySegmentKey();
      const serialized='['+batchJson.join(',')+']';
      storageService.setItem(segmentKey,serialized);
      this.historyIndex.push(...batch.map(entry=>({id:entry.envelope.envelopeId,segmentKey,createdAt:entry.envelope.createdAt})));
      serializedChars+=serialized.length;segmentCount++;batch=[];batchJson=[];batchChars=2;
    };
    for(const entry of entries){
      const serialized=JSON.stringify(entry);
      if(batch.length>0&&(batch.length>=HISTORY_SEGMENT_MAX_ENTRIES||batchChars+serialized.length+1>HISTORY_SEGMENT_MAX_CHARS))writeBatch();
      batch.push(entry);batchJson.push(serialized);batchChars+=serialized.length+(batch.length>1?1:0);
    }
    writeBatch();this.historyIndex=this.historyIndex.slice(-MAX_HISTORY);
    storageService.setItem(HISTORY_INDEX_KEY,JSON.stringify(this.historyIndex));
    const serializationElapsedMs=Date.now()-startedAt;
    if(reportBoundary||serializationElapsedMs>=50)systemLogger.recordRuntimeDiagnostic('DOMAIN_ROUTER_CHECKPOINT',{phase:'SERIALIZE_COMPLETE',command:envelope?.command??'BATCHED',source:envelope?.source??'core',target:envelope?.target??'core',historyCount:this.history.length,entryCount:entries.length,segmentCount,serializedChars,serializationElapsedMs});
  }

  private isHistoryEntry(value:unknown):value is DomainHistoryEntry{
    if(!value||typeof value!=='object'||Array.isArray(value))return false;
    const item=value as Record<string,unknown>;const env=item.envelope;const reply=item.reply;
    return Boolean(env&&typeof env==='object'&&!Array.isArray(env)&&typeof (env as Record<string,unknown>).envelopeId==='string'&&typeof (env as Record<string,unknown>).createdAt==='number'&&reply&&typeof reply==='object'&&!Array.isArray(reply));
  }

  private isHistoryIndexEntry(value:unknown):value is DomainHistoryIndexEntry{
    if(!value||typeof value!=='object'||Array.isArray(value))return false;
    const item=value as Record<string,unknown>;
    return typeof item.id==='string'&&typeof item.segmentKey==='string'&&item.segmentKey.startsWith(HISTORY_SEGMENT_PREFIX)&&typeof item.createdAt==='number';
  }

  private load():void{
    const merged=new Map<string,DomainHistoryEntry>();const legacyRaw=storageService.getItem(KEY);let legacyEntries:DomainHistoryEntry[]=[];
    if(legacyRaw){try{const parsed:unknown=JSON.parse(legacyRaw);if(Array.isArray(parsed))legacyEntries=parsed.filter((item):item is DomainHistoryEntry=>this.isHistoryEntry(item));for(const entry of legacyEntries)merged.set(entry.envelope.envelopeId,entry);}catch(error){systemLogger.warn('SELF_IMPROVEMENT','[DomainRouter] legacy history load failed',String(error));}}
    const rawIndex=storageService.getItem(HISTORY_INDEX_KEY);
    if(rawIndex){try{const parsed:unknown=JSON.parse(rawIndex);if(Array.isArray(parsed))this.historyIndex=parsed.filter((item):item is DomainHistoryIndexEntry=>this.isHistoryIndexEntry(item)).slice(-MAX_HISTORY);}catch(error){systemLogger.warn('SELF_IMPROVEMENT','[DomainRouter] history index load failed',String(error));}}
    const segmentKeys=storageService.keys().filter(key=>key.startsWith(HISTORY_SEGMENT_PREFIX)).sort();
    const indexed=[...new Set(this.historyIndex.map(item=>item.segmentKey))];
    const lastIndexed=indexed.slice().sort().at(-1)??'';
    const orphan=segmentKeys.filter(key=>!indexed.includes(key)&&(!lastIndexed||key.localeCompare(lastIndexed)>0));
    const toLoad=this.historyIndex.length===0?segmentKeys:[...new Set([...indexed,...orphan])];
    for(const key of toLoad){try{const raw=storageService.getItem(key);if(!raw)continue;const parsed:unknown=JSON.parse(raw);if(Array.isArray(parsed))for(const item of parsed)if(this.isHistoryEntry(item))merged.set(item.envelope.envelopeId,item);}catch(error){systemLogger.warn('SELF_IMPROVEMENT','[DomainRouter] segment load failed',String(error));}}
    this.history=[...merged.values()].sort((a,b)=>a.envelope.createdAt-b.envelope.createdAt||a.envelope.envelopeId.localeCompare(b.envelope.envelopeId)).slice(-MAX_HISTORY);
    if(legacyRaw&&legacyEntries.length>0&&storageService.getBackendName()!=='memory')setTimeout(()=>{void this.migrateLegacyHistory(legacyRaw,legacyEntries);},0);
  }

  private async migrateLegacyHistory(legacyRaw:string,entries:DomainHistoryEntry[]):Promise<void>{
    if(this.historyMigrationStarted||storageService.getBackendName()==='memory')return;
    this.historyMigrationStarted=true;
    try{
      const indexedIds=new Set(this.historyIndex.map(item=>item.id));
      const pending=entries.filter(entry=>!indexedIds.has(entry.envelope.envelopeId));
      for(let start=0;start<pending.length;start+=HISTORY_SEGMENT_MAX_ENTRIES){
        this.persistHistoryEntries(pending.slice(start,start+HISTORY_SEGMENT_MAX_ENTRIES));
        // Keep the old key until migrated segments and their index are durable.
        await storageService.flushNow();
        if(storageService.getBackendName()==='memory')return;
        if(start+HISTORY_SEGMENT_MAX_ENTRIES<pending.length)await new Promise<void>(resolve=>setTimeout(resolve,0));
      }
      if(storageService.getBackendName()==='memory'||storageService.getItem(KEY)!==legacyRaw)return;
      storageService.removeItem(KEY);await storageService.flushNow();
    }catch(error){systemLogger.warn('SELF_IMPROVEMENT','[DomainRouter] legacy history migration deferred',String(error));}
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
