/**
 * 設計思想 Master v5.0 第101〜110章 実装補完。
 * 不確実性、全体トレース、終端、部分成果、シミュレーション失効、
 * 因果評価、実現方式選択、要求型、推論資産、統合試験を一つの
 * 決定論的な運用証拠面へ接続する。
 *
 * 外部モデルや任意コード実行には依存しない。
 */
const now=()=>Date.now();
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')};
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
let seq=0; const id=(p:string)=>`${p}-${++seq}-${hash(`${p}|${seq}`)}`;

export type UncertaintyKind='REQUIREMENT'|'MEMORY_CONFLICT'|'INSUFFICIENT_EVIDENCE'|'INCOMPLETE_TOOL_RESULT'|'WORLD_MODEL_OUT_OF_SCOPE'|'SIMULATOR_UNREPRODUCED'|'CAPABILITY_BOUNDARY';
export type UncertaintyAction='EXECUTE'|'SEPARATE_UNCONFIRMED'|'ASK_MINIMAL'|'HOMEWORK'|'REJECT';
export interface UncertaintyRecord { id:string; kind:UncertaintyKind; magnitude:number; decisive:boolean; action:UncertaintyAction; evidence:string[]; confidence:number; outcome?:boolean; createdAt:number; }

export interface TraceEvent { traceId:string; stage:string; type:string; referenceIds:string[]; stateChanges:string[]; inputHash?:string; outputHash?:string; error?:string; retry:number; metrics:Record<string,number>; privacyMode:'RAW_ALLOWED'|'HASHED'|'REDACTED'|'REFERENCE_ONLY'; createdAt:number; }

export type TerminalReason='SUCCESS'|'PARTIAL_SUCCESS'|'NEEDS_USER_INPUT'|'RESOURCE_LIMIT'|'CAPABILITY_LIMIT'|'SAFETY_STOP'|'NO_PROGRESS'|'FAILED_WITH_ROLLBACK';
export interface LoopBudget { maxSteps:number; maxReplans:number; maxToolRetries:number; maxDuplicateSearches:number; maxRuntimeMs:number; maxStateChanges:number; }
export interface ProgressState { evidence:number; state:number; artifacts:number; candidatesReduced:number; }
export interface TerminalDecision { traceId:string; reason:TerminalReason; steps:number; replans:number; toolRetries:number; progress:boolean; finiteProofHash:string; createdAt:number; }

export interface PartialArtifact { id:string; traceId:string; status:'COMPLETED'|'VERIFIED'|'PROVISIONAL'|'UNCONFIRMED'|'FAILED'|'NOT_STARTED'; independentlyUsable:boolean; evidence:string[]; outputHash:string; createdAt:number; }
export interface ResumeCheckpoint { id:string; traceId:string; inputHash:string; outputHash:string; prerequisites:string[]; remainingWork:string[]; resumeConditions:string[]; environmentHash:string; idempotencyKeys:string[]; createdAt:number; }

export type SimulationValidity='VALID'|'STALE'|'INVALID'|'REVALIDATION_REQUIRED';
export interface EnvironmentSnapshot { id:string; kind:string; signature:string; capturedAt:number; }
export interface SimulationRecord { id:string; traceId:string; simulatedAt:number; dependencies:EnvironmentSnapshot[]; validity:SimulationValidity; impactedTests:string[]; createdAt:number; }

export interface CausalEvent { id:string; traceId:string; kind:'ANSWER'|'ARTIFACT_USE'|'FOLLOWUP'|'CORRECTION'|'GOAL_RESULT'; ref:string; value:number; createdAt:number; }
export interface CausalAssessment { traceId:string; candidate:string; treatmentEffect:number; counterfactualEffect:number; attributionRisk:number; conclusion:'SUPPORTED'|'INCONCLUSIVE'|'REJECTED'; createdAt:number; }

export type Realization='RULE'|'SEARCH'|'CLASSIFIER'|'SOLVER'|'COMPOSITION'|'SPECIALIST_MODEL';
export interface RealizationOption { capability:string; method:Realization; proofScore:number; costScore:number; observedSuccess:number; status:'CANDIDATE'|'SELECTED'|'BLOCKED'; reason:string; }

export interface RequirementType { id:string; goal:string; deliverableType:string; constraints:string[]; sideEffects:string[]; approval:string; verification:string[]; missing:string[]; conflicts:string[]; deterministic:boolean; compiledAt:number; }
export interface ReasoningAsset { id:string; kind:'PROBLEM'|'SUBPROBLEM'|'EVIDENCE'|'COUNTEREXAMPLE'|'RULE'|'FAILURE_PATH'|'SUCCESS_PATH'|'SKILL'|'TEST'|'ARTIFACT'; refs:string[]; conditions:string[]; freshness:number; createdAt:number; }
export interface IntegrationScenario { id:string; name:string; steps:string[]; disturbances:string[]; requiredArtifacts:string[]; status:'PASS'|'FAIL'|'INCONCLUSIVE'; environment:string; version:string; createdAt:number; }

class OperationalConformanceService {
 private uncertainty:UncertaintyRecord[]=[]; private traces=new Map<string,TraceEvent[]>(); private terminals:TerminalDecision[]=[]; private artifacts=new Map<string,PartialArtifact>(); private checkpoints=new Map<string,ResumeCheckpoint>(); private simulations=new Map<string,SimulationRecord>(); private causal:CausalEvent[]=[]; private assessments:CausalAssessment[]=[]; private realization:RealizationOption[]=[]; private requirements=new Map<string,RequirementType>(); private assets=new Map<string,ReasoningAsset>(); private scenarios:IntegrationScenario[]=[];

 classifyUncertainty(input:{kind:UncertaintyKind;magnitude?:number;decisive?:boolean;evidence?:string[];confidence?:number}){const magnitude=Math.max(0,Math.min(1,input.magnitude??.5));const decisive=input.decisive??magnitude>=.7;let action:UncertaintyAction='EXECUTE';if(input.kind==='CAPABILITY_BOUNDARY')action='HOMEWORK';else if(input.kind==='SIMULATOR_UNREPRODUCED')action='REJECT';else if(decisive&&magnitude>=.7&&!(input.evidence||[]).length)action='ASK_MINIMAL';else if(magnitude>=.35)action='SEPARATE_UNCONFIRMED';const r:UncertaintyRecord={id:id('unc'),kind:input.kind,magnitude,decisive,action,evidence:input.evidence||[],confidence:Math.max(0,Math.min(1,input.confidence??1-magnitude)),createdAt:now()};this.uncertainty.unshift(r);return clone(r);}
 listUncertainty(limit=100){return clone(this.uncertainty.slice(0,limit));}
 calibrate(id0:string,outcome:boolean){const r=this.uncertainty.find(x=>x.id===id0);if(!r)return null;r.outcome=outcome;r.confidence=Math.max(0,Math.min(1,r.confidence+(outcome?0.05:-0.1)));return clone(r);}

 trace(traceId:string,event:Omit<TraceEvent,'traceId'|'createdAt'>){const e={...event,traceId,createdAt:now()};const rows=this.traces.get(traceId)||[];rows.push(e);this.traces.set(traceId,rows);return clone(e);}
 getTrace(traceId:string){return clone(this.traces.get(traceId)||[]);}

 terminal(input:{traceId:string;budget:LoopBudget;steps:number;replans:number;toolRetries:number;duplicateSearches?:number;runtimeMs?:number;stateChanges?:number;before?:ProgressState;after?:ProgressState;failure?:boolean;rolledBack?:boolean;safetyStop?:boolean;userInput?:boolean;capabilityLimit?:boolean}){const b=input.budget,p=input.before||{evidence:0,state:0,artifacts:0,candidatesReduced:0},q=input.after||p;const progress=q.evidence>p.evidence||q.state>p.state||q.artifacts>p.artifacts||q.candidatesReduced>p.candidatesReduced;let reason:TerminalReason='SUCCESS';if(input.safetyStop)reason='SAFETY_STOP';else if(input.userInput)reason='NEEDS_USER_INPUT';else if(input.capabilityLimit)reason='CAPABILITY_LIMIT';else if(input.failure&&input.rolledBack)reason='FAILED_WITH_ROLLBACK';else if(input.steps>b.maxSteps||input.replans>b.maxReplans||input.toolRetries>b.maxToolRetries||(input.runtimeMs||0)>b.maxRuntimeMs||(input.stateChanges||0)>b.maxStateChanges)reason='RESOURCE_LIMIT';else if(!progress)reason='NO_PROGRESS';else if(input.failure)reason='PARTIAL_SUCCESS';const proofHash=hash(JSON.stringify({budget:b,steps:input.steps,replans:input.replans,toolRetries:input.toolRetries,progress,reason}));const r={traceId,reason,steps:input.steps,replans:input.replans,toolRetries:input.toolRetries,progress,finiteProofHash:proofHash,createdAt:now()};this.terminals.unshift(r);this.trace(input.traceId,{stage:'TERMINAL',type:'terminal_decision',referenceIds:[],stateChanges:[reason],retry:input.toolRetries,metrics:{steps:input.steps,replans:input.replans,runtimeMs:input.runtimeMs||0},privacyMode:'REFERENCE_ONLY'});return clone(r);}
 listTerminals(limit=100){return clone(this.terminals.slice(0,limit));}

 addPartialArtifact(x:Omit<PartialArtifact,'id'|'outputHash'|'createdAt'>){const r={...x,id:id('artifact'),outputHash:hash(JSON.stringify(x)),createdAt:now()};this.artifacts.set(r.id,r);return clone(r);}
 createCheckpoint(x:Omit<ResumeCheckpoint,'id'|'createdAt'>){const r={...x,id:id('resume'),createdAt:now()};this.checkpoints.set(r.id,r);return clone(r);}
 resume(id0:string,currentEnvironmentHash:string){const c=this.checkpoints.get(id0);if(!c)return {ok:false,reason:'NOT_FOUND'};if(c.environmentHash!==currentEnvironmentHash)return {ok:false,reason:'ENVIRONMENT_CHANGED',checkpoint:clone(c)};return {ok:true,checkpoint:clone(c)};}

 registerSimulation(x:Omit<SimulationRecord,'id'|'validity'|'createdAt'>){const r={...x,id:id('sim'),validity:'VALID' as SimulationValidity,createdAt:now()};this.simulations.set(r.id,r);return clone(r);}
 revalidateSimulation(id0:string,current:EnvironmentSnapshot[]){const s=this.simulations.get(id0);if(!s)return null;const old=new Map(s.dependencies.map(x=>[x.kind,x.signature]));const changed=current.some(x=>old.get(x.kind)!==x.signature);s.validity=changed?'REVALIDATION_REQUIRED':'VALID';s.impactedTests=changed?['DEPENDENCY_CHANGED']:[];return clone(s);}
 listSimulations(){return clone([...this.simulations.values()]);}

 addCausalEvent(x:Omit<CausalEvent,'id'|'createdAt'>){const r={...x,id:id('cause'),createdAt:now()};this.causal.push(r);return clone(r);}
 assessCausal(input:{traceId:string;candidate:string;treatment:number;counterfactual:number;confounders?:number}){const effect=input.treatment-input.counterfactual;const risk=Math.max(0,Math.min(1,input.confounders??.3));const conclusion=Math.abs(effect)>=.2&&risk<.5?'SUPPORTED':Math.abs(effect)<.1||risk>=.7?'REJECTED':'INCONCLUSIVE';const r={traceId:input.traceId,candidate:input.candidate,treatmentEffect:input.treatment,counterfactualEffect:input.counterfactual,attributionRisk:risk,conclusion,createdAt:now()};this.assessments.unshift(r);return clone(r);}
 listCausal(){return clone(this.assessments);}

 selectRealization(capability:string,options:Array<Omit<RealizationOption,'status'|'reason'>>){const normalized=options.map(x=>({...x,status:'CANDIDATE' as const,reason:''})).map(x=>x.method==='LOCAL_MODEL'?{...x,status:'BLOCKED' as const,reason:'LOCAL_LLM_RUNTIME_RETIRED'}:x);const eligible=normalized.filter(x=>x.proofScore>=.7);if(!eligible.length)return {capability,status:'BLOCKED',options:clone(normalized),reason:'NO_PROVEN_REALIZATION'};const selected=[...eligible].sort((a,b)=>(b.proofScore+b.observedSuccess-b.costScore)-(a.proofScore+a.observedSuccess-a.costScore))[0];for(const x of normalized)x.status=x===selected?'SELECTED':'BLOCKED';for(const x of normalized)x.reason=x===selected?'best_proven_cost_adjusted':'insufficient proof or dominated cost';this.realization.push(...normalized);return {capability,status:'SELECTED',selected:clone(selected),options:clone(normalized)};}
 listRealizations(){return clone(this.realization);}

 compileRequirement(x:{goal:string;deliverableType:string;constraints?:string[];sideEffects?:string[];approval?:string;verification?:string[];missing?:string[];conflicts?:string[]}){const deterministic=!(x.missing||[]).length&&!(x.conflicts||[]).length;const r:RequirementType={id:id('req'),goal:x.goal,deliverableType:x.deliverableType,constraints:x.constraints||[],sideEffects:x.sideEffects||[],approval:x.approval||'NONE',verification:x.verification||[],missing:x.missing||[],conflicts:x.conflicts||[],deterministic,compiledAt:now()};this.requirements.set(r.id,r);return clone(r);}
 listRequirements(){return clone([...this.requirements.values()]);}

 addReasoningAsset(x:Omit<ReasoningAsset,'id'|'createdAt'>){const r={...x,id:id('asset'),createdAt:now()};this.assets.set(r.id,r);return clone(r);}
 relatedAssets(refs:string[]){const set=new Set(refs);return clone([...this.assets.values()].filter(a=>a.refs.some(r=>set.has(r))));}

 runIntegrationScenario(x:Omit<IntegrationScenario,'id'|'status'|'createdAt'>){const required=x.requiredArtifacts.length;const usable=x.requiredArtifacts.filter(r=>[...this.artifacts.values()].some(a=>a.id===r&&a.independentlyUsable&&['VERIFIED','COMPLETED'].includes(a.status))).length;const status:IntegrationScenario['status']=required===0||usable===required?'PASS':usable>0?'INCONCLUSIVE':'FAIL';const r={...x,id:id('scenario'),status,createdAt:now()};this.scenarios.unshift(r);return clone(r);}
 listScenarios(){return clone(this.scenarios);}
 summary(){return {uncertainty:this.uncertainty.length,traces:this.traces.size,terminals:this.terminals.length,artifacts:this.artifacts.size,checkpoints:this.checkpoints.size,simulations:this.simulations.size,causalAssessments:this.assessments.length,realizationOptions:this.realization.length,requirements:this.requirements.size,reasoningAssets:this.assets.size,integrationScenarios:this.scenarios.length};}
}
export const operationalConformanceService=new OperationalConformanceService();
