import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const now = () => Date.now();
let idSeq = 0;
const id = (p: string) => `${p}_${++idSeq}_${now()}`;
const hash = (s: string) => { let h = 2166136261; for (let i=0;i<s.length;i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h>>>0).toString(16).padStart(8,'0'); };

export interface Anchor { id:string; kind:string; value:unknown; version:number; hash:string; reason:string; dependencies:string[]; updatedAt:number; }
class PersistentPersonalityService {
  private anchors = new Map<string, Anchor>(); private readonly key='miki_ch69_anchors_v1'; private safeReadOnly=false;
  initialize(){ try { const raw=storageService.getItem(this.key); if(raw) for(const a of JSON.parse(raw) as Anchor[]) this.anchors.set(a.id,a); } catch { this.safeReadOnly=true; } }
  upsert(kind:string,value:unknown,reason='explicit user rule',dependencies:string[]=[]){ if(this.safeReadOnly) return null; const existing=[...this.anchors.values()].find(a=>a.kind===kind); const a:Anchor={id:existing?.id??id('anchor'),kind,value,version:(existing?.version??0)+1,hash:hash(JSON.stringify(value)),reason,dependencies,updatedAt:now()}; this.anchors.set(a.id,a); this.persist(); return a; }
  validate(){ const groups=[...this.anchors.values()]; const valid=groups.length===0 || groups.every(a=>a.hash===hash(JSON.stringify(a.value))); if(!valid) this.safeReadOnly=true; return {valid,safeReadOnly:this.safeReadOnly,count:groups.length}; }
  get(kind:string){ return [...this.anchors.values()].find(a=>a.kind===kind); } getAll(){return [...this.anchors.values()];}
  private persist(){try{storageService.setItem(this.key,JSON.stringify([...this.anchors.values()]));}catch{this.safeReadOnly=true;}}
}
export const persistentPersonalityService=new PersistentPersonalityService();

export type ProjectStatus='GOAL_DEFINED'|'PLANNED'|'ACTIVE'|'WAITING_INPUT'|'WAITING_RESOURCE'|'VERIFYING'|'PARTIAL'|'COMPLETED'|'ARCHIVED';
export interface ProjectPackage {id:string; goal:string; status:ProjectStatus; milestones:string[]; dependencies:string[]; artifacts:string[]; constraints:string[]; updatedAt:number;}
class LongTermProjectManagerService { private projects=new Map<string,ProjectPackage>(); private key='miki_ch70_projects_v1';
 initialize(){try{const r=storageService.getItem(this.key);if(r)for(const p of JSON.parse(r))this.projects.set(p.id,p);}catch{}}
 create(goal:string, milestones:string[]=[], constraints:string[]=[]){const p:ProjectPackage={id:id('project'),goal,status:'GOAL_DEFINED',milestones,dependencies:[],artifacts:[],constraints,updatedAt:now()};this.projects.set(p.id,p);this.persist();return p;}
 transition(projectId:string,status:ProjectStatus){const p=this.projects.get(projectId);if(!p)return null;p.status=status;p.updatedAt=now();this.persist();return p;}
 replan(projectId:string,reason:string){const p=this.projects.get(projectId);if(!p)return null;p.milestones=[...p.milestones,`REPLAN:${reason}`];p.updatedAt=now();this.persist();return p;}
 get(projectId:string){return this.projects.get(projectId);} list(){return [...this.projects.values()];} private persist(){try{storageService.setItem(this.key,JSON.stringify([...this.projects.values()]));}catch{}}
}
export const longTermProjectManagerService=new LongTermProjectManagerService();

export type CognitiveRoute='DIRECT'|'MEMORY'|'WEB_RESEARCH'|'CODE'|'DATA'|'CONSTRAINT_SOLVER'|'WORLD_MODEL'|'SIMULATION'|'TOOL'|'HOMEWORK';
export interface CognitiveBudget {llm:number;search:number;tools:number;simulation:number;retries:number;}
export interface CognitiveDecision {route:CognitiveRoute[];budget:CognitiveBudget;reason:string;degraded:boolean;}
class IntegratedCognitionControllerService { decide(input:{importance?:number;uncertainty?:number;irreversible?:boolean;privacy?:boolean;hasCode?:boolean;hasData?:boolean;needsFresh?:boolean;resources?:number}):CognitiveDecision {const x=input;const r:CognitiveRoute[]=[]; if(x.hasCode)r.push('CODE'); if(x.hasData)r.push('DATA'); if(x.needsFresh)r.push('WEB_RESEARCH'); if(x.uncertainty&&x.uncertainty>.6)r.push('MEMORY'); if(!r.length)r.push('DIRECT'); const heavy=(x.importance??0)>.7||(x.uncertainty??0)>.8; const budget={llm:0,search:x.needsFresh?3:0,tools:heavy?2:1,simulation:x.irreversible||heavy?1:0,retries:2}; return {route:[...new Set(r)],budget,reason:`importance=${x.importance??0}, uncertainty=${x.uncertainty??0}, irreversible=${!!x.irreversible}`,degraded:(x.resources??1)<.3}; } }
export const integratedCognitionControllerService=new IntegratedCognitionControllerService();

export interface PrefetchCandidate {key:string;kind:string;source:string;expiresAt:number;used:boolean;measuredBenefit?:number;}
class PredictiveContextOsService {private c=new Map<string,PrefetchCandidate>(); prefetch(kind:string,key:string,source:string,ttlMs=300000){const p={key,kind,source,expiresAt:now()+ttlMs,used:false};this.c.set(key,p);return p;} consume(key:string){const p=this.c.get(key);if(!p||p.expiresAt<now())return null;p.used=true;return p;} purge(){for(const [k,v] of this.c)if(v.expiresAt<now())this.c.delete(k);} measure(key:string,benefit:number){const p=this.c.get(key);if(p)p.measuredBenefit=benefit;} list(){this.purge();return [...this.c.values()];}}
export const predictiveContextOsService=new PredictiveContextOsService();

export type FailureClass='TEMP_NETWORK'|'TOOL_CONTRACT'|'MODEL_STOP'|'DB_CORRUPTION'|'CAPACITY'|'DIMENSION_MISMATCH'|'INFERENCE_LOOP'|'STATE_INCONSISTENCY'|'PERMISSION_DENIED';
export interface RecoveryPolicy {maxRetries:number;backoffMs:number;allowFallback:boolean;readOnly:boolean;notifyUser:boolean;}
class FailureToleranceKernelService { classify(error:unknown):FailureClass {const s=String(error).toLowerCase();if(/permission|denied/.test(s))return'PERMISSION_DENIED';if(/network|timeout|fetch/.test(s))return'TEMP_NETWORK';if(/database|sqlite|db/.test(s))return'DB_CORRUPTION';if(/memory|quota|capacity/.test(s))return'CAPACITY';if(/loop|recursion/.test(s))return'INFERENCE_LOOP';if(/contract|schema/.test(s))return'TOOL_CONTRACT';return'STATE_INCONSISTENCY';} policy(kind:FailureClass):RecoveryPolicy {return {maxRetries:kind==='TEMP_NETWORK'?3:1,backoffMs:kind==='TEMP_NETWORK'?500:0,allowFallback:kind!=='DB_CORRUPTION',readOnly:kind==='DB_CORRUPTION'||kind==='STATE_INCONSISTENCY',notifyUser:true};} canRetry(attempt:number,policy:RecoveryPolicy){return attempt<policy.maxRetries;}}
export const failureToleranceKernelService=new FailureToleranceKernelService();

export interface LineageNode {id:string;type:string;label:string;sourceIds:string[];evidenceIds:string[];parentIds:string[];status:'ACTIVE'|'QUARANTINED'|'SUPERSEDED';strength:string;updatedAt:number;}
class EvidenceLineageGraphService {private n=new Map<string,LineageNode>(); add(type:string,label:string,opts:Partial<LineageNode>={}){const x:LineageNode={id:id('lineage'),type,label,sourceIds:opts.sourceIds??[],evidenceIds:opts.evidenceIds??[],parentIds:opts.parentIds??[],status:opts.status??'ACTIVE',strength:opts.strength??'UNCLASSIFIED',updatedAt:now()};this.n.set(x.id,x);return x;} descendants(id0:string){return[...this.n.values()].filter(x=>x.parentIds.includes(id0));} quarantine(id0:string){const x=this.n.get(id0);if(x)x.status='QUARANTINED';return x;} trace(id0:string){const out:LineageNode[]=[];const walk=(id1:string)=>{const x=this.n.get(id1);if(!x||out.includes(x))return;out.push(x);x.parentIds.forEach(walk);};walk(id0);return out;}}
export const evidenceLineageGraphService=new EvidenceLineageGraphService();

export interface LearningPlan {id:string;goal:string;requiredCapabilities:string[];gaps:string[];principles:string[];metrics:{reuseContexts:number;duplicateReduction:number;firstTrySuccess:number;reasoningReduction:number};}
class GoalBacksolvingLearningService {create(goal:string,current:string[]=[]):LearningPlan{const required=goal.split(/[、,]/).map(s=>s.trim()).filter(Boolean).slice(0,12);const gaps=required.filter(x=>!current.some(c=>c.includes(x)));return{id:id('learn'),goal,requiredCapabilities:required,gaps,principles:[],metrics:{reuseContexts:0,duplicateReduction:0,firstTrySuccess:0,reasoningReduction:0}};}reconstruct(p:LearningPlan,items:string[]){p.principles=[...new Set([...p.principles,...items.map(x=>x.trim()).filter(Boolean)])];return p;}recordReuse(p:LearningPlan,firstTrySuccess:boolean){p.metrics.reuseContexts++;if(firstTrySuccess)p.metrics.firstTrySuccess++;return p;}}
export const goalBacksolvingLearningService=new GoalBacksolvingLearningService();

export interface QaReport {passed:boolean;checks:Record<string,boolean>;missingEvidence:string[];completionAllowed:boolean;}
class AutonomousQaService { inspect(input:{requirement?:string;claim?:string;executionReceipt?:unknown;artifact?:unknown;reversible?:boolean}):QaReport{const checks={requirement:!!input.requirement,claim:!!input.claim,evidence:!!input.executionReceipt,artifact:!!input.artifact,reversible:input.reversible!==false};const missing=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);return{passed:missing.length===0,checks,missingEvidence:missing,completionAllowed:missing.length===0};}}
export const autonomousQaService=new AutonomousQaService();

export interface UniversalInput {id:string;kind:string;content:unknown;structure?:unknown;source?:string;capturedAt:number;confidence:number;privacy:string;projectId?:string;unverified?:string[];}
export interface UniversalArtifact {id:string;kind:string;content:unknown;conditions:string[];sourceInputIds:string[];createdAt:number;}
class UniversalIoService {normalize(kind:string,content:unknown,meta:Partial<UniversalInput>={}):UniversalInput{return{id:id('input'),kind,content,source:meta.source,capturedAt:now(),confidence:meta.confidence??0.5,privacy:meta.privacy??'UNKNOWN',projectId:meta.projectId,unverified:meta.unverified??[]};}emit(kind:string,content:unknown,sourceInputIds:string[]=[],conditions:string[]=[]):UniversalArtifact{return{id:id('artifact'),kind,content,conditions,sourceInputIds,createdAt:now()};}}
export const universalIoService=new UniversalIoService();

export type Ownership='OWNER_USER'|'OWNER_AI'|'AI_PROPOSE_USER_EXECUTE'|'USER_APPROVE_AI_EXECUTE'|'EXTERNAL_DEPENDENCY';
class CollaborationSelfMaintenanceService {estimate(plannedMs:number,factor=1){return{estimateMs:Math.max(1,Math.round(plannedMs*factor)),confidence:factor===1?.5:.35};}audit(services:string[],documented:string[]){const missing=services.filter(s=>!documented.includes(s));return{undocumented:missing,unused:documented.filter(s=>!services.includes(s)),healthy:missing.length===0};} repairGate(){return{requiresVirtualReplay:true,requiresRegression:true,requiresLimitedApply:true,productionAutoRepair:false};}}
export const collaborationSelfMaintenanceService=new CollaborationSelfMaintenanceService();

export interface ExpertRole {role:string;inputs:string[];outputs:string[];independentQa:boolean;}
class VirtualExpertService {compose(complexity:number):ExpertRole[]{if(complexity<2)return[{role:'generalist',inputs:['request'],outputs:['result'],independentQa:false}];return[{role:'requirements',inputs:['request'],outputs:['requestIR'],independentQa:false},{role:'research',inputs:['requestIR'],outputs:['evidenceIds'],independentQa:false},{role:'implementation',inputs:['requestIR','evidenceIds'],outputs:['artifact'],independentQa:false},{role:'qa',inputs:['requestIR','artifact'],outputs:['qaReport'],independentQa:true}];}}
export const virtualExpertService=new VirtualExpertService();

export interface SoftwareFactoryRun {id:string;requirement:string;stages:string[];artifacts:string[];status:'CANDIDATE'|'VERIFIED'|'REJECTED';}
class SoftwareFactoryService {start(requirement:string):SoftwareFactoryRun{return{id:id('swfactory'),requirement,stages:['REQUIREMENT_IR','DESIGN','CODE_CANDIDATE','STATIC_CHECK','ISOLATED_BUILD','TEST','EXECUTION_EVIDENCE','ARTIFACT','MAINTENANCE_INFO'],artifacts:[],status:'CANDIDATE'};}admit(r:SoftwareFactoryRun,verified:boolean){r.status=verified?'VERIFIED':'REJECTED';return r;}}
export const softwareFactoryService=new SoftwareFactoryService();

export interface DataFactoryPlan {id:string;inputKind:string;checks:string[];transformations:string[];validation:string[];preserveOriginal:boolean;}
class DataFactoryService {plan(inputKind:string):DataFactoryPlan{return{id:id('datafactory'),inputKind,checks:['FORMAT','SCHEMA','MISSING','DUPLICATE','ANOMALY'],transformations:['VIRTUAL_TRANSFORM'],validation:['ROW_COUNT','COLUMN_COUNT','HASH','SEMANTIC_CONSTRAINT'],preserveOriginal:true};}}
export const dataFactoryService=new DataFactoryService();

export interface DigitalTwinState {id:string;appVersion?:string;configHash?:string;model?:string;memoryHash?:string;capabilityHash?:string;resourceClass?:string;fidelity:'REPRODUCED'|'APPROXIMATE'|'MOCK'|'UNREPRODUCED';capturedAt:number;}
class DigitalTwinService {capture(state:Omit<DigitalTwinState,'id'|'capturedAt'>):DigitalTwinState{return{...state,id:id('twin'),capturedAt:now()};}compare(a:DigitalTwinState,b:DigitalTwinState){return{sameConfig:a.configHash===b.configHash,sameModel:a.model===b.model,sameMemory:a.memoryHash===b.memoryHash,sameCapabilities:a.capabilityHash===b.capabilityHash};}}
export const digitalTwinService=new DigitalTwinService();

export interface SecuritySignal {kind:string;severity:number;evidence:string[];reproducible:boolean;}
class SecurityImmunityService {assess(signals:SecuritySignal[]){const strong=signals.filter(s=>s.severity>=.7&&s.evidence.length>=2);return{isolate:strong.length>0,confidence:Math.min(1,strong.reduce((m,s)=>Math.max(m,s.severity),0)),signals:strong};} response(){return['DETECT','ASSESS','ISOLATE','READ_ONLY_OR_DEGRADE','INVESTIGATE','RECOVERY_TEST','STAGED_RETURN'];}}
export const securityImmunityService=new SecurityImmunityService();

export interface CapabilityDependency {capability:string;children:string[];tools:string[];data:string[];permissions:string[];evaluations:string[];environment:string[];}
class CapabilityDependencyService {private g=new Map<string,CapabilityDependency>();register(x:CapabilityDependency){this.g.set(x.capability,x);return x;}findLeafFailures(capability:string,failed:string[]){const x=this.g.get(capability);if(!x)return failed;return failed.filter(f=>[...x.children,...x.tools,...x.data,...x.permissions,...x.evaluations,...x.environment].includes(f));}get(capability:string){return this.g.get(capability);}}
export const capabilityDependencyService=new CapabilityDependencyService();

export interface IntelligenceSnapshot {id:string;version:number;portable:{personality:string;memory:string;skills:string;knowledge:string;tools:string};modelSpecific:{model?:string;prompt?:string;adapter?:string;quantization?:string};hash:string;createdAt:number;}
class IntelligenceSnapshotService {create(portable:IntelligenceSnapshot['portable'],modelSpecific:IntelligenceSnapshot['modelSpecific']={}):IntelligenceSnapshot{const payload=JSON.stringify({portable,modelSpecific});return{id:id('snapshot'),version:1,portable,modelSpecific,hash:hash(payload),createdAt:now()};}compatibility(s:IntelligenceSnapshot,env:{model?:string;skillsHash?:string}){return{modelCompatible:!s.modelSpecific.model||s.modelSpecific.model===env.model,requiresRegression:true,requiresSecretEval:true};}}
export const intelligenceSnapshotService=new IntelligenceSnapshotService();

export interface Experiment {id:string;question:string;hypothesis:string;prediction:string;control:string;variables:string[];runs:number;results:string[];status:'PLANNED'|'RUNNING'|'ANALYZED'|'REJECTED'|'ADOPTED';}
class ScienceExperimentService {plan(question:string,hypothesis:string,prediction:string,control:string):Experiment{return{id:id('experiment'),question,hypothesis,prediction,control,variables:[],runs:0,results:[],status:'PLANNED'};}record(e:Experiment,result:string){e.runs++;e.results.push(result);e.status='ANALYZED';return e;}adopt(e:Experiment,reproduced:boolean){e.status=reproduced?'ADOPTED':'REJECTED';return e;}}
export const scienceExperimentService=new ScienceExperimentService();

export interface SemanticCacheEntry {id:string;premises:string[];rule:string;branches:string[];conclusion:string;conditions:string[];exclusions:string[];evidenceIds:string[];environmentHash:string;createdAt:number;ttlMs:number;}
class SemanticCacheService {private c=new Map<string,SemanticCacheEntry>();put(x:Omit<SemanticCacheEntry,'id'|'createdAt'>){const e={...x,id:id('semcache'),createdAt:now()};this.c.set(e.id,e);return e;}get(id0:string,environmentHash:string){const e=this.c.get(id0);if(!e||e.environmentHash!==environmentHash||e.createdAt+e.ttlMs<now())return null;return e;}invalidateByEnvironment(environmentHash:string){for(const[k,v]of this.c)if(v.environmentHash!==environmentHash)this.c.delete(k);}list(){return[...this.c.values()];}}
export const semanticCacheService=new SemanticCacheService();

export type CapabilityCouncilState='ACTIVE'|'MERGE_CANDIDATE'|'DEPRECATION_CANDIDATE'|'DORMANT'|'PROTECTED';
export interface CapabilityRecord {id:string;state:CapabilityCouncilState;usage:number;performance:number;maintenanceCost:number;dependencies:string[];contains?:string[];}
class CapabilityCouncilService {evaluate(a:CapabilityRecord,b:CapabilityRecord){const overlap=a.contains?.includes(b.id)||b.contains?.includes(a.id)||a.dependencies.some(x=>b.dependencies.includes(x));return{mergeCandidate:!!overlap,score:(a.usage+b.usage)-(a.maintenanceCost+b.maintenanceCost)};}suggest(records:CapabilityRecord[]){return records.filter(r=>r.state!=='PROTECTED'&&(r.usage===0||r.maintenanceCost>r.usage*2)).map(r=>({id:r.id,suggestion:r.usage===0?'DORMANT':'DEPRECATION_CANDIDATE'}));}}
export const capabilityCouncilService=new CapabilityCouncilService();

export interface FrontierCriteria {area:string;currentEvidence:string[];structuralCompensation:string[];modelGap:string[];required:string[];}
class FrontierCriteriaService {assess(area:string,inputs:{evidence:string[];compensation:string[];modelGap:string[];required:string[]}):FrontierCriteria{return{area,currentEvidence:inputs.evidence,structuralCompensation:inputs.compensation,modelGap:inputs.modelGap,required:inputs.required};}completion(c:FrontierCriteria){return{structurallyCovered:c.required.every(r=>c.currentEvidence.includes(r)||c.structuralCompensation.includes(r)),modelGapCount:c.modelGap.length};}}
export const frontierCriteriaService=new FrontierCriteriaService();

export const chapter69to90Services={persistentPersonalityService,longTermProjectManagerService,integratedCognitionControllerService,predictiveContextOsService,failureToleranceKernelService,evidenceLineageGraphService,goalBacksolvingLearningService,autonomousQaService,universalIoService,collaborationSelfMaintenanceService,virtualExpertService,softwareFactoryService,dataFactoryService,digitalTwinService,securityImmunityService,capabilityDependencyService,intelligenceSnapshotService,scienceExperimentService,semanticCacheService,capabilityCouncilService,frontierCriteriaService};
export function initializeChapter69to90(){persistentPersonalityService.initialize();longTermProjectManagerService.initialize();systemLogger.info('SELF_IMPROVEMENT','Chapters 69-90 deterministic service layer initialized');}
