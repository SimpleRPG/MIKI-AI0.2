import { improvementIntakeRouterService } from './improvementIntakeRouterService';
import { autonomousCandidatePreparationService } from './autonomousCandidatePreparationService';
import { selfCodeSpaceService } from './selfCodeSpaceService';
import { storageService } from '../../../services/storageService';
import { canonicalSha256 } from './canonicalSha256Service';
import { reviewLearningArtifactService } from './reviewLearningArtifactService';
import { reusableComponentFactoryService } from './reusableComponentFactoryService';
import { candidateUnknownResolutionService } from './candidateUnknownResolutionService';
import { nonLlmCodeSynthesisService } from '../../selfDevelopment/services/nonLlmCodeSynthesisService';
import { componentArtifactStoreService } from '../../capability/services/componentArtifactStoreService';
export interface CandidateGenerationFile { path:string; candidateContent:string; evidenceIds:string[]; }
export interface CandidateGenerationOutcome { accepted:boolean; runId:string; workspaceId?:string; files:CandidateGenerationFile[]; reasons:string[]; responseHash?:string; attemptCount?:number; learningLineage?:{sourcePackageId?:string;externalReviewId?:string;candidateRevision:number;requestedChanges:string[];userReason?:string;usedLearningArtifactIds:string[];ignoredLearningArtifactIds:string[];appliedFailurePatternIds:string[];appliedCorrectionPairIds:string[];appliedComponentPatternIds:string[];learningContextSha256:string;componentPackId?:string;usedKnowledgeComponentIds?:string[];usedCodeComponentIds?:string[];usedConversationComponentIds?:string[];excludedComponentIds?:string[];componentContextSha256?:string}; }
class CandidateCodeGenerationService {
 async generate(runId:string):Promise<CandidateGenerationOutcome>{
  const run=improvementIntakeRouterService.get(runId);if(!run)return {accepted:false,runId,files:[],reasons:['IMPROVEMENT_RUN_NOT_FOUND']};
  const probe=await autonomousCandidatePreparationService.prepareForRun(runId,[]);const targetPaths=probe.targetPaths;
  if(targetPaths.length===0)return {accepted:false,runId,files:[],reasons:[probe.reason||'TARGET_FILES_NOT_RESOLVED']};
  const sources=new Map(selfCodeSpaceService.listSourceFiles().map(file=>[file.path,file]));const targetFiles=targetPaths.map(path=>sources.get(path)).filter((value):value is NonNullable<typeof value>=>Boolean(value));
  if(targetFiles.length!==targetPaths.length)return {accepted:false,runId,files:[],reasons:['SOURCE_SNAPSHOT_INCOMPLETE']};
  const implementationPlan=run.implementationPlan;
  if(run.runType==='AUTONOMOUS_DISCOVERY'&&!implementationPlan)return {accepted:false,runId,files:[],reasons:['AUTONOMOUS_IMPLEMENTATION_PLAN_REQUIRED']};
  const unknownContext=await candidateUnknownResolutionService.resolve({runId:run.runId,taskId:run.taskId||run.runId,objective:run.objective,environmentFingerprint:typeof run.payload.environmentFingerprint==='string'?run.payload.environmentFingerprint:'unknown',targetPaths,sourcePaths:targetFiles.map(file=>file.path),requirements:this.strings(run.payload.requirements),validationRequirements:this.strings(run.payload.validationRequirements)});
  const learningContext=reviewLearningArtifactService.retrieve({objective:run.objective,packageId:typeof run.payload.packageId==='string'?run.payload.packageId:undefined});
  const componentPack=reusableComponentFactoryService.plan({taskId:run.taskId||run.runId,purpose:run.objective,environmentFingerprint:typeof run.payload.environmentFingerprint==='string'?run.payload.environmentFingerprint:'unknown',requiredKinds:['KNOWLEDGE','CODE']});
  const selectedComponents=reusableComponentFactoryService.list().filter(x=>[...componentPack.usedKnowledgeComponentIds,...componentPack.usedCodeComponentIds,...componentPack.usedConversationComponentIds].includes(x.componentId)).map(x=>({componentId:x.componentId,componentKind:x.componentKind,componentType:x.componentType,purpose:x.purpose,interfaceContract:x.interfaceContract,inputs:x.inputs,outputs:x.outputs,prerequisites:x.prerequisites,dependencies:x.dependencies,appliesWhen:x.appliesWhen,doesNotApplyWhen:x.doesNotApplyWhen,lifecycleStatus:x.lifecycleStatus,sourceLearningArtifactIds:x.sourceLearningArtifactIds}));
  const compositionPrompt=[
      run.objective,
      ...this.strings(run.payload.requirements),
      ...this.strings(run.payload.requestedChanges)
    ].filter(Boolean).join('\\n');

    /*
     * 既存の決定論的コード合成経路をここで接続する。
     * 新しい合成エンジンやLLM生成器は作らない。
     */
    const compiledRequest:any={
      goal:run.objective,
      targetFiles:targetFiles.map(file=>file.path),
      environment:'ANDROID',
      requirements:this.strings(run.payload.requirements),
      prohibitions:this.strings(run.payload.prohibitions),
      invariants:this.strings(run.payload.invariants),
      validationRequirements:this.strings(run.payload.validationRequirements),
      deliveryRequirements:this.strings(run.payload.deliveryRequirements)
    };

    const synthesisPlan=nonLlmCodeSynthesisService.plan(
      compiledRequest,
      compositionPrompt
    );

    const composition=synthesisPlan.composition;
    const componentIds=Array.isArray(synthesisPlan.componentIds)
      ? synthesisPlan.componentIds
      : [];

    if(!composition || componentIds.length===0){
      const reason='CODE_COMPOSITION_PLAN_UNAVAILABLE';
      this.record(runId,{
        attemptCount:1,
        status:'BLOCKED',
        reason,
        responseHash:canonicalSha256(JSON.stringify({
          runId,
          reason,
          componentIds,
          synthesisPlan
        }))
      });
      return {
        accepted:false,
        runId,
        files:[],
        reasons:[reason],
        attemptCount:1
      };
    }

    /*
     * CompositionPlanは「何を組み合わせるか」を確定する。
     * 未検証の新規コードを捏造して完成品扱いしない。
     * したがって、現段階では検証済みComponentの実装本文だけを
     * targetに対応付けられる場合のみ候補化する。
     */
    const registryCandidates=componentIds.map(id=>{
      const item=selectedComponents.find(x=>x.componentId===id);
      return item ? {
        componentId:item.componentId,
        componentKind:item.componentKind,
        purpose:item.purpose,
        interfaceContract:item.interfaceContract
      } : undefined;
    }).filter(Boolean);

    const unresolved=componentIds.filter(
      id=>!registryCandidates.some((x:any)=>x.componentId===id)
    );

    if(unresolved.length>0){
      const reason=`CODE_COMPOSITION_COMPONENT_UNRESOLVED:${unresolved.join(',')}`;
      this.record(runId,{
        attemptCount:1,
        status:'BLOCKED',
        reason,
        responseHash:canonicalSha256(JSON.stringify({
          runId,componentIds,unresolved
        }))
      });
      return {
        accepted:false,
        runId,
        files:[],
        reasons:[reason],
        attemptCount:1
      };
    }

    if(!synthesisPlan.deterministic || composition.verified!==true || composition.executable!==true){
      const reason='CODE_COMPOSITION_NOT_VERIFIED_OR_EXECUTABLE';
      this.record(runId,{
        attemptCount:1,
        status:'BLOCKED',
        reason,
        responseHash:canonicalSha256(JSON.stringify({
          runId,componentIds,deterministic:synthesisPlan.deterministic,
          verified:composition.verified,executable:composition.executable
        }))
      });
      return {accepted:false,runId,files:[],reasons:[reason],attemptCount:1};
    }

    const materialized=this.materializeComposition(
      runId,
      targetFiles,
      componentIds
    );

    if(!materialized.accepted){
      this.record(runId,{
        attemptCount:1,
        status:'BLOCKED',
        reason:materialized.reason,
        responseHash:canonicalSha256(JSON.stringify({
          runId,componentIds,reason:materialized.reason
        }))
      });
      return {
        accepted:false,
        runId,
        files:[],
        reasons:[materialized.reason],
        attemptCount:1
      };
    }

    const prepared=await autonomousCandidatePreparationService.prepareForRun(
      runId,
      materialized.files
    );

    if(!prepared.workspaceId){
      const reason=prepared.reason||'CANDIDATE_WORKSPACE_NOT_CREATED';
      this.record(runId,{
        attemptCount:1,
        status:'BLOCKED',
        reason,
        responseHash:canonicalSha256(JSON.stringify({
          runId,componentIds,reason
        }))
      });
      return {accepted:false,runId,files:[],reasons:[reason],attemptCount:1};
    }

    return {
      accepted:true,
      runId,
      workspaceId:prepared.workspaceId,
      files:materialized.files,
      reasons:[],
      attemptCount:1
    };

 }
 }
 private materializeComposition(
  runId:string,
  targetFiles:Array<{path:string;content:string;language:string}>,
  componentIds:string[]
):{accepted:true;files:CandidateGenerationFile[]}|{accepted:false;reason:string}{
  const targets=new Map(targetFiles.map(file=>[file.path,file]));
  const files:CandidateGenerationFile[]=[];
  const usedTargets=new Set<string>();

  for(const componentId of componentIds){
    const artifact=componentArtifactStoreService.get(componentId);
    if(!artifact)return {accepted:false,reason:`CODE_COMPONENT_ARTIFACT_NOT_FOUND:${componentId}`};

    const implementation=artifact.implementation_txt.trim();
    if(!implementation)return {accepted:false,reason:`CODE_COMPONENT_IMPLEMENTATION_EMPTY:${componentId}`};

    const targetMatch=implementation.match(/^TARGET_PATH:\s*(.+)$/m);
    const begin=implementation.indexOf('FILE_CONTENT_BEGIN');
    const end=implementation.indexOf('FILE_CONTENT_END');

    if(!targetMatch||begin<0||end<=begin){
      return {
        accepted:false,
        reason:`CODE_COMPONENT_MATERIALIZATION_CONTRACT_MISSING:${componentId}`
      };
    }

    const targetPath=targetMatch[1].trim();
    const target=targets.get(targetPath);
    if(!target)return {accepted:false,reason:`CODE_COMPONENT_TARGET_NOT_REQUESTED:${targetPath}`};
    if(usedTargets.has(targetPath))return {accepted:false,reason:`CODE_COMPONENT_TARGET_DUPLICATE:${targetPath}`};

    const content=implementation
      .slice(begin+'FILE_CONTENT_BEGIN'.length,end)
      .replace(/^\r?\n/,'')
      .replace(/\r?\n$/,'')
      .trim();

    if(!content)return {accepted:false,reason:`CODE_COMPONENT_FILE_CONTENT_EMPTY:${componentId}`};
    if(content===target.content.trim())return {accepted:false,reason:`CODE_COMPONENT_NO_CHANGE:${targetPath}`};

    usedTargets.add(targetPath);
    files.push({
      path:targetPath,
      candidateContent:content,
      evidenceIds:[`component-artifact:${componentId}:${artifact.implementation_hash}`]
    });
  }

  if(files.length===0)return {accepted:false,reason:'CODE_COMPOSITION_MATERIALIZATION_EMPTY'};

  return {accepted:true,files};
 }

 private extractResponseText(body:unknown):string{if(typeof body==='string')return body;if(!body||typeof body!=='object')return '';const object=body as Record<string,unknown>;for(const key of ['response','text','content','message','answer']){const value=object[key];if(typeof value==='string')return value;if(value&&typeof value==='object'){const nested=value as Record<string,unknown>;if(typeof nested.content==='string')return nested.content;if(typeof nested.text==='string')return nested.text;}}return '';}
 private parse(text:string):CandidateGenerationFile[]|undefined{const cleaned=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');const start=cleaned.indexOf('{');const end=cleaned.lastIndexOf('}');const options=[cleaned,start>=0&&end>start?cleaned.slice(start,end+1):''];for(const option of options){if(!option)continue;try{const value=JSON.parse(option);if(!value||!Array.isArray(value.files))continue;const files:CandidateGenerationFile[]=[];for(const row of value.files){if(typeof row?.path!=='string'||typeof row?.candidateContent!=='string')return undefined;files.push({path:row.path,candidateContent:row.candidateContent,evidenceIds:Array.isArray(row.evidenceIds)?row.evidenceIds.filter((x:unknown):x is string=>typeof x==='string'):[]});}return files;}catch{continue;}}return undefined;}
 private record(runId:string,value:Record<string,unknown>):void{const key='miki_candidate_generation_ledger_v2';let ledger:Record<string,unknown>;try{const raw=storageService.getItem(key);const parsed:unknown=raw?JSON.parse(raw):{};ledger=parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{};}catch(error){throw new Error(`PERSISTENCE_FAILED:CANDIDATE_LEDGER_READ:${error instanceof Error?error.message:String(error)}`);}const record={runId,...value};try{storageService.setItem(key,JSON.stringify({...ledger,[runId]:record}));const reloadedRaw=storageService.getItem(key);const reloaded:unknown=reloadedRaw?JSON.parse(reloadedRaw):undefined;if(!reloaded||typeof reloaded!=='object'||Array.isArray(reloaded)||(reloaded as Record<string,unknown>)[runId]===undefined)throw new Error('RELOAD_MISSING');const expected=canonicalSha256(record);const actual=canonicalSha256((reloaded as Record<string,unknown>)[runId]);if(actual!==expected)throw new Error('RELOAD_HASH_MISMATCH');}catch(error){throw new Error(`PERSISTENCE_FAILED:CANDIDATE_LEDGER_WRITE:${error instanceof Error?error.message:String(error)}`);}}
 private strings(value:unknown):string[]{return Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):[];}
}
export const candidateCodeGenerationService=new CandidateCodeGenerationService();
