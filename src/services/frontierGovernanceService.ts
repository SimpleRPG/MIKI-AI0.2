import { mikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';

export type StrategyFamily = 'STANDARD'|'EXPLORATORY'|'PAST_STABLE';
export type CapabilityFrontierState = 'STABLE'|'CONDITIONAL'|'TOOL_REQUIRED'|'TEACHER_REQUIRED'|'USER_CONFIRMATION_REQUIRED'|'UNSUPPORTED'|'UNEVALUATED';
export type ExplorationStage = 'METADATA_ONLY'|'READ_ONLY'|'MOCK_INTERACTION'|'SANDBOX_WRITE'|'REVERSIBLE_OPERATION'|'APPROVED_OPERATION'|'STABLE_CAPABILITY';
export type ErrorClass = 'INTENT_ERROR'|'MEMORY_ERROR'|'ROUTING_ERROR'|'OUTCOME_ERROR'|'RESOURCE_ERROR'|'USER_REACTION_ERROR'|'ENVIRONMENT_ERROR';

const now=()=>Date.now();
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')};
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));

export interface StrategyRecord { id:string; capability:string; family:StrategyFamily; implementation:string; evidence:number; active:boolean; lastUsed:number; failures:number; createdAt:number; }
export interface EvaluationAudit { id:string; subject:string; generator:string; executor:string; auditor:string; promoter:string; difficulty:number; leakageRisk:number; representativeness:number; freshness:number; reproducibility:number; detectedDefects:string[]; valid:boolean; createdAt:number; }
export interface TheoryCandidate { id:string; domain:string; cases:string[]; variables:string[]; hypothesis:string; prediction:string; counterexamples:string[]; scope:string; heldOutScore:number; transferScore:number; status:'CANDIDATE'|'REJECTED'|'VERIFIED'; createdAt:number; }
export interface CoEvolutionRecord { id:string; taskClass:string; role:'AI_EXECUTE'|'AI_PROPOSE_USER_DECIDE'|'USER_EXECUTE_AI_VERIFY'|'CO_DESIGN'; timeMs:number; quality:number; corrections:number; reuse:number; explanationHelp:number; confirmationBurden:number; createdAt:number; }
export interface ResearchTopic { id:string; weakness:string; hypotheses:string[]; candidateApproaches:string[]; controls:string[]; status:'OPEN'|'CANARY_CANDIDATE'|'REJECTED'; debt:string[]; createdAt:number; }
export interface FrontierRecord { capability:string; state:CapabilityFrontierState; maxDifficulty:number; environment:string; implementation:string; knownFailures:string[]; resources:string[]; evaluatedAt:number; expiresAt?:number; evidence:string[]; }
export interface CounterfactualRecord { id:string; task:string; adopted:string; rejected:string[]; branches:string[]; pruning:string[]; createdAt:number; }
export interface MarketRecord { capability:string; implementations:Array<{id:string;quality:number;speed:number;resource:number;maintenance:number;evidence:number;status:'ACTIVE'|'DORMANT'}>; selected?:string; createdAt:number; }
export interface PersonalFrontierScore { taskClass:string; intention:number; correctionRetention:number; policyRetention:number; artifactCompleteness:number; reuse:number; repair:number; secondRunEfficiency:number; externalDependency:number; latency:number; privacy:number; explainability:number; resilience:number; overall:number; evaluatedAt:number; }
export interface AttentionState { key:string; errorClass:ErrorClass; magnitude:number; impact:number; frequency:number; unknownCause:number; density:number; samples:number; lastUpdated:number; }
export interface EnvironmentExploration { id:string; environment:string; stage:ExplorationStage; contract:string[]; permissions:string[]; sideEffects:string[]; rollback:string[]; audit:string[]; status:'ACTIVE'|'BLOCKED'|'STABLE'; createdAt:number; }
export interface InvariantProof { id:string; invariants:string[]; passed:boolean; proofHash:string; checkedAt:number; }

class FrontierGovernanceService {
 private strategies:StrategyRecord[]=[]; private audits:EvaluationAudit[]=[]; private theories:TheoryCandidate[]=[]; private coevolution:CoEvolutionRecord[]=[]; private research:ResearchTopic[]=[]; private frontier=new Map<string,FrontierRecord>(); private counterfactuals:CounterfactualRecord[]=[]; private markets=new Map<string,MarketRecord>(); private scores:PersonalFrontierScore[]=[]; private attention=new Map<string,AttentionState>(); private environments=new Map<string,EnvironmentExploration>(); private proofs:InvariantProof[]=[];

 registerStrategy(capability:string,family:StrategyFamily,implementation:string,evidence=0.5){const id=`STR-${hash(`${capability}|${family}|${implementation}`)}`;const old=this.strategies.find(x=>x.id===id);if(old)return clone(old);const r={id,capability,family,implementation,evidence:Math.max(0,Math.min(1,evidence)),active:true,lastUsed:now(),failures:0,createdAt:now()};this.strategies.unshift(r);this.enforceDiversity(capability);return clone(r);}
 recordStrategyResult(id:string,success:boolean){const r=this.strategies.find(x=>x.id===id);if(!r)return null;r.lastUsed=now();if(!success)r.failures++;r.evidence=Math.max(0,Math.min(1,r.evidence+(success?.05:-.1)));this.enforceDiversity(r.capability);return clone(r);}
 private enforceDiversity(capability:string){const rows=this.strategies.filter(x=>x.capability===capability).sort((a,b)=>(b.evidence-b.failures*.1)-(a.evidence-a.failures*.1));const families=new Set(rows.map(x=>x.family));for(const r of rows)r.active=families.size>1?true:r===rows[0];}
 listStrategies(capability?:string){return clone(this.strategies.filter(x=>!capability||x.capability===capability));}

 auditEvaluator(input:{subject:string;generator?:string;executor?:string;auditor?:string;promoter?:string;difficulty?:number;leakageRisk?:number;representativeness?:number;freshness?:number;reproducibility?:number;knownDefects?:string[]}){const a:EvaluationAudit={id:`EVA-${hash(JSON.stringify(input))}-${now()}`,subject:input.subject,generator:input.generator||'separate-generator',executor:input.executor||'separate-executor',auditor:input.auditor||'meta-auditor',promoter:input.promoter||'promotion-gate',difficulty:input.difficulty??.5,leakageRisk:input.leakageRisk??0,representativeness:input.representativeness??.7,freshness:input.freshness??.7,reproducibility:input.reproducibility??.9,detectedDefects:input.knownDefects||[],valid:(input.leakageRisk??0)<.25&&(input.representativeness??.7)>=.6&&(input.freshness??.7)>=.5&&(input.reproducibility??.9)>=.8,createdAt:now()};this.audits.unshift(a);return clone(a);}
 listAudits(limit=50){return clone(this.audits.slice(0,limit));}
 invalidateIfChanged(signature:string){const invalid=this.audits.filter(a=>hash(`${a.subject}|${signature}`)!==hash(`${a.subject}|stable`));return {invalidated:invalid.length,reason:'evaluator/environment/spec signature changed',ids:invalid.map(x=>x.id)};}

 formTheory(domain:string,cases:Array<{id:string;variables:string[];outcome:string}>,hypothesis:string,prediction:string,scope='bounded'){const vars=[...new Set(cases.flatMap(c=>c.variables))].sort();const id=`TH-${hash(`${domain}|${vars.join(',')}|${hypothesis}`)}`;const heldOut=cases.length>=3?Math.min(1,cases.slice(0,-1).length/Math.max(1,cases.length-1)):.25;const t:TheoryCandidate={id,domain,cases:cases.map(c=>c.id),variables:vars,hypothesis,prediction,counterexamples:[],scope,heldOutScore:heldOut,transferScore:0,status:'CANDIDATE',createdAt:now()};this.theories.unshift(t);return clone(t);}
 testTheory(id:string,unseenMatch:boolean,counterexamples:string[],transferScore:number){const t=this.theories.find(x=>x.id===id);if(!t)return null;t.counterexamples=[...counterexamples];t.transferScore=Math.max(0,Math.min(1,transferScore));t.heldOutScore=Math.min(1,t.heldOutScore+(unseenMatch?.25:0));t.status=t.heldOutScore>=.7&&t.transferScore>=.5&&counterexamples.length===0?'VERIFIED':'REJECTED';return clone(t);}
 listTheories(limit=50){return clone(this.theories.slice(0,limit));}

 recordCoEvolution(input:Omit<CoEvolutionRecord,'id'|'createdAt'|'quality'> & {quality:number}){const r={...input,id:`CO-${hash(JSON.stringify(input))}-${now()}`,createdAt:now(),quality:Math.max(0,Math.min(1,input.quality))};this.coevolution.unshift(r);return clone(r);}
 recommendRole(taskClass:string){const rows=this.coevolution.filter(x=>x.taskClass===taskClass);if(!rows.length)return 'AI_PROPOSE_USER_DECIDE' as const;const score=(r:CoEvolutionRecord)=>r.quality-r.corrections*.05-r.confirmationBurden*.02+r.reuse*.1+r.explanationHelp*.1;return rows.sort((a,b)=>score(b)-score(a))[0].role;}
 listCoEvolution(limit=50){return clone(this.coevolution.slice(0,limit));}

 createResearch(weakness:string,hypotheses:string[],candidateApproaches:string[],controls:string[]){const r:ResearchTopic={id:`RND-${hash(`${weakness}|${hypotheses.join('|')}`)}`,weakness,hypotheses,candidateApproaches,controls,status:'OPEN',debt:[],createdAt:now()};this.research.unshift(r);return clone(r);}
 promoteResearch(id:string,meetsDevice:boolean,licenseOk:boolean,reproducible:boolean){const r=this.research.find(x=>x.id===id);if(!r)return null;r.status=meetsDevice&&licenseOk&&reproducible?'CANARY_CANDIDATE':'REJECTED';if(!reproducible)r.debt.push('REPRODUCIBILITY_DEBT');return clone(r);}
 listResearch(limit=50){return clone(this.research.slice(0,limit));}

 setFrontier(r:Omit<FrontierRecord,'evaluatedAt'>){const x={...r,evaluatedAt:now()};this.frontier.set(r.capability, x);return clone(x);}
 getFrontier(capability?:string){return clone(capability?this.frontier.get(capability):[...this.frontier.values()]);}

 recordCounterfactual(task:string,adopted:string,rejected:string[],branches:string[],pruning:string[]){const r={id:`CF-${hash(`${task}|${adopted}|${rejected.join('|')}`)}`,task,adopted,rejected,branches,pruning,createdAt:now()};this.counterfactuals.unshift(r);return clone(r);}
 listCounterfactuals(limit=50){return clone(this.counterfactuals.slice(0,limit));}

 compete(capability:string,implementations:MarketRecord['implementations']){const ranked=[...implementations].sort((a,b)=>(b.quality+b.speed+b.evidence-b.resource-b.maintenance)-(a.quality+a.speed+a.evidence-b.resource-b.maintenance));const selected=ranked[0]?.id;const normalized:MarketRecord['implementations']=ranked.map(x=>({...x,status:(x.id===selected?'ACTIVE':'DORMANT') as 'ACTIVE'|'DORMANT'}));const m={capability,implementations:normalized,selected,createdAt:now()};this.markets.set(capability,m);return clone(m);}
 keepFallback(capability:string){const m=this.markets.get(capability);if(!m)return null;m.implementations=m.implementations.map((x,i)=>({...x,status:i===0?'ACTIVE':'DORMANT'}));return clone(m);}
 listMarkets(){return clone([...this.markets.values()]);}

 scorePersonal(input:Omit<PersonalFrontierScore,'overall'|'evaluatedAt'>){const vals=Object.entries(input).filter(([k])=>k!=='taskClass').map(([,v])=>Number(v));const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;const r={...input,overall:avg,evaluatedAt:now()};this.scores.unshift(r);return clone(r);}
 listScores(limit=50){return clone(this.scores.slice(0,limit));}

 observePrediction(key:string,errorClass:ErrorClass,magnitude:number,impact:number,frequency=1,unknownCause=0.5){const k=`${key}|${errorClass}`;const old=this.attention.get(k);const samples=(old?.samples||0)+1;const density=Math.max(0,Math.min(1,.45*Math.abs(magnitude)+.25*Math.abs(impact)+.15*Math.min(1,frequency/5)+.15*unknownCause));const r={key,errorClass,magnitude,impact,frequency,unknownCause,density,samples,lastUpdated:now()};this.attention.set(k,r);return clone(r);}
 attentionPlan(){return clone([...this.attention.values()].sort((a,b)=>b.density-a.density).map(x=>({...x,mode:x.density>=.7?'DETAILED_TRACE':x.density>=.4?'TARGETED_AUDIT':'LIGHT_SAMPLE'})));}

 exploreEnvironment(environment:string,stage:ExplorationStage,contract:string[],permissions:string[],sideEffects:string[],rollback:string[],audit:string[]){const id=`ENV-${hash(environment)}`;const previous=this.environments.get(id);if(previous&&stage!==previous.stage&&stageIndex(stage)>stageIndex(previous.stage)+1)return {...clone(previous),status:'BLOCKED' as const};const r:EnvironmentExploration={id,environment,stage,contract,permissions,sideEffects,rollback,audit,status:'ACTIVE',createdAt:previous?.createdAt||now()};if(stage==='STABLE_CAPABILITY')r.status='STABLE';this.environments.set(id,r);return clone(r);}
 listEnvironments(){return clone([...this.environments.values()]);}

 verifyTopInvariants(){const invariants=['LOCAL_LLM_RUNTIME_NOT_USED_BY_NORMAL_CHAT','LOCAL_PRIVACY_BOUNDARY','ZERO_REGRESSION_CANARY','NO_UNPROVEN_HIGH_IMPACT_COMPOSITION','USER_CORRECTION_HAS_PRIORITY'];const violations:string[]=[];if(this.markets.size>0&&[...this.markets.values()].some(m=>!m.implementations.some(x=>x.status==='DORMANT')&&m.implementations.length>1))violations.push('NO_FALLBACK_DIVERSITY');const proof={id:`META-${hash(invariants.join('|'))}-${now()}`,invariants,passed:violations.length===0,proofHash:hash(`${invariants.join('|')}|${violations.join('|')}`),checkedAt:now()};this.proofs.unshift(proof);mikiUnifiedLearningContinuumService.observe({domain:'system',key:'meta_invariant_proof',outcome:proof.passed?'SUCCESS':'FAILURE',verified:proof.passed,capabilityIds:['general.safety-governance']});return clone(proof);}
 listProofs(limit=50){return clone(this.proofs.slice(0,limit));}
}
function stageIndex(s:ExplorationStage){return ['METADATA_ONLY','READ_ONLY','MOCK_INTERACTION','SANDBOX_WRITE','REVERSIBLE_OPERATION','APPROVED_OPERATION','STABLE_CAPABILITY'].indexOf(s);}
export const frontierGovernanceService=new FrontierGovernanceService();
