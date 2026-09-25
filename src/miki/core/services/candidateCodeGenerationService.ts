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
import { componentRegistryService } from '../../capability/services/componentRegistryService';
import { ComponentCompositionService } from '../../capability/services/componentCompositionService';
import { codeConstructionRendererService } from './codeConstructionRendererService';
import type {
  CodeConstructionBinding,
  CodeConstructionGraph,
} from '../data/codeKnowledge/common';
export interface CandidateGenerationFile { path:string; candidateContent:string; evidenceIds:string[]; }
export interface CandidateGenerationOutcome { accepted:boolean; runId:string; workspaceId?:string; files:CandidateGenerationFile[]; reasons:string[]; responseHash?:string; attemptCount?:number; createdCodeComponentIds?:string[]; learningLineage?:{sourcePackageId?:string;externalReviewId?:string;candidateRevision:number;requestedChanges:string[];userReason?:string;usedLearningArtifactIds:string[];ignoredLearningArtifactIds:string[];appliedFailurePatternIds:string[];appliedCorrectionPairIds:string[];appliedComponentPatternIds:string[];learningContextSha256:string;componentPackId?:string;usedKnowledgeComponentIds?:string[];usedCodeComponentIds?:string[];usedConversationComponentIds?:string[];excludedComponentIds?:string[];componentContextSha256?:string}; }
class CandidateCodeGenerationService {
 async generate(runId:string):Promise<CandidateGenerationOutcome>{
  const run=improvementIntakeRouterService.get(runId);if(!run)return {accepted:false,runId,files:[],reasons:['IMPROVEMENT_RUN_NOT_FOUND']};
  const probe=await autonomousCandidatePreparationService.prepareForRun(runId,[]);const targetPaths=probe.targetPaths;
  if(targetPaths.length===0)return {accepted:false,runId,files:[],reasons:[probe.reason||'TARGET_FILES_NOT_RESOLVED']};
  const sources=new Map(selfCodeSpaceService.listSourceFiles().map(file=>[file.path,file]));const targetFiles=targetPaths.map(path=>sources.get(path)).filter((value):value is NonNullable<typeof value>=>Boolean(value));
  if(targetFiles.length!==targetPaths.length)return {accepted:false,runId,files:[],reasons:['SOURCE_SNAPSHOT_INCOMPLETE']};
  const implementationPlan=run.implementationPlan;
  if(run.runType==='AUTONOMOUS_DISCOVERY'&&!implementationPlan)return {accepted:false,runId,files:[],reasons:['AUTONOMOUS_IMPLEMENTATION_PLAN_REQUIRED']};
  const failureFeedback =
    run.payload.failureFeedback &&
    typeof run.payload.failureFeedback === 'object'
      ? run.payload.failureFeedback as Record<string,unknown>
      : undefined;

  const failureFeedbackText = failureFeedback
    ? [
        'Previous Candidate verification failure must be corrected in this revision.',
        `sourceOperation=${String(failureFeedback.sourceOperation||'VERIFY_CODE_COMPONENT')}`,
        `status=${String(failureFeedback.status||'FAILED')}`,
        `retryOfCandidateRevision=${String(failureFeedback.retryOfCandidateRevision||'')}`,
        `componentIds=${this.strings(failureFeedback.componentIds).join(',')}`,
        `reasons=${this.strings(failureFeedback.reasons).join(' | ')}`,
        typeof failureFeedback.result==='object'
          ? `result=${JSON.stringify(failureFeedback.result)}`
          : `result=${String(failureFeedback.result||'')}`,
      ].join('\n')
    : '';

  const effectiveRequirements = [
    ...this.strings(run.payload.requirements),
    ...(failureFeedbackText ? [failureFeedbackText] : []),
  ];

  const effectiveValidationRequirements =
    this.strings(run.payload.validationRequirements);

  /*
   * Built-in CODE KNOWLEDGEを「実行可能CODE」として扱わず、
   * 自律コード改善の意味解決・Research・CODE合成条件へ
   * 汎用的な実装知識として渡す。
   *
   * これにより、
   * CODE KNOWLEDGE
   *   → UNKNOWN / Researchの意味補強
   *   → Implementation Material収集
   *   → CODE Component Candidate
   *   → CODE-only Composition
   * の流れを既存基盤上で成立させる。
   */
  const environmentFingerprint =
    typeof run.payload.environmentFingerprint === 'string'
      ? run.payload.environmentFingerprint
      : 'unknown';

  const knowledgeSelectionPurpose = [
    run.objective,
    ...effectiveRequirements,
    ...this.strings(run.payload.requestedChanges),
    ...targetPaths,
    ...effectiveValidationRequirements,
  ].filter(Boolean).join(' / ');

  const codeKnowledgePack = reusableComponentFactoryService.plan({
    taskId: run.taskId || run.runId,
    purpose: knowledgeSelectionPurpose,
    environmentFingerprint,
    requiredKinds: ['KNOWLEDGE'],
  });

  const codeKnowledge = reusableComponentFactoryService
    .list()
    .filter(item =>
      item.componentKind === 'KNOWLEDGE' &&
      codeKnowledgePack.usedKnowledgeComponentIds.includes(item.componentId)
    )
    .slice(0, 8);

  const knowledgeHints = codeKnowledge
    .map(item => [
      `component=${item.componentId}`,
      `type=${item.componentType}`,
      `purpose=${item.purpose}`,
      `appliesWhen=${item.appliesWhen.join(' / ')}`,
      `inputs=${item.inputs.join(' / ')}`,
      `outputs=${item.outputs.join(' / ')}`,
      `doesNotApplyWhen=${item.doesNotApplyWhen.join(' / ')}`,
      item.componentKind === 'KNOWLEDGE' && item.constructionProfile
        ? `construction=${JSON.stringify(item.constructionProfile)}`
        : '',
    ].filter(Boolean).join(' ; '))
    .join('\n');

  const knowledgeRequirement =
    knowledgeHints
      ? [`Reusable CODE KNOWLEDGE guidance (guidance only; never executable CODE):\n${knowledgeHints}`]
      : [];

  const unknownContext=await candidateUnknownResolutionService.resolve({
    runId:run.runId,
    taskId:run.taskId||run.runId,
    objective:failureFeedbackText
      ? `${run.objective}\n${failureFeedbackText}`
      : run.objective,
    environmentFingerprint:typeof run.payload.environmentFingerprint==='string'
      ? run.payload.environmentFingerprint
      : 'unknown',
    targetPaths,
    sourcePaths:targetFiles.map(file=>file.path),
    requirements:[
      ...effectiveRequirements,
      ...knowledgeRequirement,
    ],
    validationRequirements:effectiveValidationRequirements
  });

  /*
   * CREATE判定を実際のCODE Component Candidateへ接続する。
   *
   * implementationCandidatesは通常ランタイム生成物ではなく、
   * 外部Teacher / UNKNOWN_COMPONENT_AUTHOR等から明示的に
   * 提供された実装材料だけを受け取る。
   *
   * 実装本文が無い場合は絶対に生成・捏造しない。
   */
  const createdCodeComponentIds:string[]=[];

  /*
   * 通常経路:
   * MIKI自身がResearchで収集したImplementation Materialを
   * CODE Component Candidateへ変換する。
   *
   * Research本文そのものからコードを推測しない。
   * 明示的なcodeExamplesだけをCandidate化し、Verification待ちにする。
   */
  const researchedCandidates=this.parseImplementationMaterials(
    unknownContext.implementationMaterials,
    targetPaths,
    this.strings(run.payload.validationRequirements),
  );

  for(const candidate of researchedCandidates){
    const created=reusableComponentFactoryService.createCodeComponentCandidate({
      purpose:run.objective,
      implementation:candidate.candidateContent,
      targetPath:candidate.path,
      tests:candidate.tests,
      validation:candidate.validation,
      componentType:'RESEARCHED_IMPLEMENTATION_COMPONENT',
      dependencies:candidate.dependencies,
      supportedEnvironments:['ANDROID'],
      entryPoint:candidate.path,
      sourceEpisodeIds:candidate.sourceEpisodeIds,
    });

    if(created.accepted&&created.componentId){
      createdCodeComponentIds.push(created.componentId);
    }
  }

  /*
   * 外部Teacher / UNKNOWN_COMPONENT_AUTHORから明示的に供給された
   * implementationCandidatesは補助経路としてのみ残す。
   */
  const suppliedCandidates=this.parseImplementationCandidates(
    run.payload.implementationCandidates,
    targetPaths,
  );

  for(const candidate of suppliedCandidates){
    const created=reusableComponentFactoryService.createCodeComponentCandidate({
      purpose:run.objective,
      implementation:candidate.candidateContent,
      targetPath:candidate.path,
      tests:candidate.tests,
      validation:candidate.validation,
      componentType:candidate.componentType||'AUTONOMOUS_CODE_COMPONENT',
      inputs:candidate.inputs,
      outputs:candidate.outputs,
      prerequisites:candidate.prerequisites,
      dependencies:candidate.dependencies,
      supportedEnvironments:candidate.supportedEnvironments||['ANDROID'],
      entryPoint:candidate.entryPoint||candidate.path,
      exports:candidate.exports,
      imports:candidate.imports,
      publicInterfaces:candidate.publicInterfaces,
      coreIngressPoints:candidate.coreIngressPoints,
      domainOwnership:candidate.domainOwnership,
      persistenceKeys:candidate.persistenceKeys,
      uiEventEntrypoints:candidate.uiEventEntrypoints,
      sourceEpisodeIds:candidate.sourceEpisodeIds,
      sourceLearningArtifactIds:candidate.sourceLearningArtifactIds,
    });

    if(created.accepted&&created.componentId){
      createdCodeComponentIds.push(created.componentId);
    }
  }

  if(createdCodeComponentIds.length>0){
    const reason='NEW_CODE_COMPONENT_CANDIDATE_CREATED_AWAITING_VERIFICATION';
    this.record(runId,{
      attemptCount:1,
      status:'BLOCKED',
      reason,
      createdCodeComponentIds,
      unknownContext,
      responseHash:canonicalSha256(JSON.stringify({
        runId,
        reason,
        createdCodeComponentIds,
      }))
    });

    return {
      accepted:false,
      runId,
      files:[],
      reasons:[reason],
      attemptCount:1,
      createdCodeComponentIds
    };
  }

  const learningContext=reviewLearningArtifactService.retrieve({objective:run.objective,packageId:typeof run.payload.packageId==='string'?run.payload.packageId:undefined});
  const componentPack=reusableComponentFactoryService.plan({
    taskId:run.taskId||run.runId,
    purpose:[run.objective,knowledgeHints].filter(Boolean).join(' / '),
    environmentFingerprint,
    requiredKinds:['KNOWLEDGE','CODE']
  });

  const compositionPrompt=[
      run.objective,
      ...effectiveRequirements,
      ...this.strings(run.payload.requestedChanges),
      ...(knowledgeHints ? [
        'Reusable CODE KNOWLEDGE guidance:',
        knowledgeHints
      ] : []),
      ...(failureFeedbackText ? [
        'Failure-driven correction constraints:',
        failureFeedbackText
      ] : [])
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

    const reusableComponentIds = [
      ...componentPack.usedCodeComponentIds,
    ];

    /*
     * CODE KnowledgeのConstruction Profileから構築グラフを作る。
     *
     * ここでは未検証コードを生成しない。
     * Graphは構造判断のための決定論的中間表現であり、
     * 実行可能CODE Componentとは別物。
     */
    const constructionGraph =
      reusableComponentFactoryService.buildConstructionGraph({
        goal:run.objective,
        componentIds:codeKnowledgePack.usedKnowledgeComponentIds,
        preserveAllNodes:Boolean(
          run.payload.constructionBindings
        ),
      });

    const explicitBindings=this.parseConstructionBindings(
      constructionGraph,
      run.payload.constructionBindings,
    );

    const explicitBindingKeys=new Set(
      explicitBindings.map(binding =>
        `${binding.targetNodeId}::${binding.slotName}`
      )
    );

    const resolvedConstructionGraph:CodeConstructionGraph={
      ...constructionGraph,
      bindings:[
        ...constructionGraph.bindings.filter(binding =>
          !explicitBindingKeys.has(
            `${binding.targetNodeId}::${binding.slotName}`
          )
        ),
        ...explicitBindings,
      ],
    };

    const constructionValidation =
      ComponentCompositionService.getInstance()
        .validateConstructionGraph(resolvedConstructionGraph);

    const constructionRender =
      constructionValidation.valid
        ? codeConstructionRendererService.render(
            resolvedConstructionGraph
          )
        : {
            accepted:false,
            errors:constructionValidation.errors,
          };

    if(
      constructionRender.accepted &&
      typeof constructionRender.source==='string' &&
      targetFiles.length===1
    ){
      const target=targetFiles[0];

      const created=
        reusableComponentFactoryService.createCodeComponentCandidate({
          purpose:run.objective,
          implementation:constructionRender.source,
          targetPath:target.path,
          tests:[
            `ConstructionGraph=${resolvedConstructionGraph.graphId}`,
            ...effectiveValidationRequirements,
          ].filter(Boolean).join('\n'),
          validation:[
            `CONSTRUCTION_GRAPH=${resolvedConstructionGraph.graphId}`,
            `ROOT_NODE=${constructionRender.rootNodeId||''}`,
            ...effectiveValidationRequirements,
          ].filter(Boolean).join('\n'),
          componentType:'CONSTRUCTION_GRAPH_CODE_COMPONENT',
          supportedEnvironments:['ANDROID'],
          entryPoint:target.path,
          sourceEpisodeIds:[],
        });

      if(created.accepted && created.componentId){
        const reason=
          'CONSTRUCTION_GRAPH_CODE_COMPONENT_CANDIDATE_CREATED_AWAITING_VERIFICATION';

        this.record(runId,{
          attemptCount:1,
          status:'BLOCKED',
          reason,
          createdCodeComponentIds:[created.componentId],
          unknownContext,
          responseHash:canonicalSha256(JSON.stringify({
            runId,
            reason,
            graphId:resolvedConstructionGraph.graphId,
            componentId:created.componentId,
          }))
        });

        return {
          accepted:false,
          runId,
          files:[],
          reasons:[reason],
          attemptCount:1,
          createdCodeComponentIds:[created.componentId],
        };
      }
    }

    const constructionGraphHint = [
      `ConstructionGraph=${resolvedConstructionGraph.graphId}`,
      `nodes=${resolvedConstructionGraph.nodes.length}`,
      `bindings=${resolvedConstructionGraph.bindings.length}`,
      `valid=${constructionValidation.valid}`,
      `rendered=${constructionRender.accepted}`,
      constructionValidation.errors.length
        ? `errors=${constructionValidation.errors.join(' | ')}`
        : '',
      constructionValidation.unresolvedSlots.length
        ? `unresolvedSlots=${constructionValidation.unresolvedSlots.join(' | ')}`
        : '',
    ].filter(Boolean).join('\n');

    /*
     * Graphが未完成でも即座に捏造して補完しない。
     * 未解決slotは既存CORE/UNKNOWN/Research経路へ
     * 不足情報として渡せるよう、合成要求へ明示する。
     */
    const constructionRequirements = [
      'Construction Graph is deterministic structural guidance only.',
      constructionGraphHint,
      ...(constructionValidation.unresolvedSlots.length
        ? [
            'Unresolved construction slots must not be guessed.',
            `Resolve or research these slots: ${constructionValidation.unresolvedSlots.join(', ')}`,
          ]
        : []),
    ].join('\n');

    const synthesisPlan=nonLlmCodeSynthesisService.plan(
      compiledRequest,
      `${compositionPrompt}\n\n${constructionRequirements}` ,
      reusableComponentIds
    );

    const composition=synthesisPlan.composition;
    const componentIds=Array.isArray(synthesisPlan.componentIds)
      ? synthesisPlan.componentIds
      : [];

    if(!composition || componentIds.length===0){
      const reason=createdCodeComponentIds.length>0
        ? 'NEW_CODE_COMPONENT_CANDIDATE_CREATED_AWAITING_VERIFICATION'
        : 'CODE_COMPOSITION_PLAN_UNAVAILABLE';

      this.record(runId,{
        attemptCount:1,
        status:'BLOCKED',
        reason,
        createdCodeComponentIds,
        unknownContext,
        responseHash:canonicalSha256(JSON.stringify({
          runId,
          reason,
          componentIds,
          createdCodeComponentIds,
          synthesisPlan
        }))
      });

      return {
        accepted:false,
        runId,
        files:[],
        reasons:[reason],
        attemptCount:1,
        createdCodeComponentIds
      };
    }

    /*
     * CompositionPlanは「何を組み合わせるか」を確定する。
     * 未検証の新規コードを捏造して完成品扱いしない。
     * したがって、現段階では検証済みComponentの実装本文だけを
     * targetに対応付けられる場合のみ候補化する。
     */
    /*
     * CapabilityGraphが選択したComponentは、ReusableComponentFactoryの
     * reusable packに入っていない既存Registry Componentでも正規候補である。
     *
     * ここでReusableComponentだけを照合すると、
     * Registry VERIFIED → CapabilityGraph選択済みなのに
     * CODE_COMPOSITION_COMPONENT_UNRESOLVEDになる。
     *
     * CODE合成の存在確認はComponent Registryを正本として行い、
     * materializeComposition()では既存Artifact Storeを使用する。
     */
    const registryCandidates=componentIds.map(id=>{
      const item=componentRegistryService.getComponent(id);
      return item ? {
        componentId:item.component_id,
        componentKind:item.componentKind,
        purpose:item.purpose,
        interfaceContract:{
          inputs:item.inputs,
          outputs:item.outputs,
          preconditions:item.preconditions,
          postconditions:item.postconditions,
          dependencies:item.dependencies,
          entryPoint:item.entry_point
        }
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
 private parseImplementationMaterials(
  materials: import('../../research/services/webMaterialPatternExtractor').WebImplementationMaterial[],
  targetPaths:string[],
  validationRequirements:string[],
):Array<{
  path:string;
  candidateContent:string;
  tests:string;
  validation:string;
  dependencies:string[];
  sourceEpisodeIds:string[];
}>{
  if(materials.length===0||targetPaths.length===0||validationRequirements.length===0){
    return [];
  }

  const allowed=new Set(targetPaths);
  const output:Array<{
    path:string;
    candidateContent:string;
    tests:string;
    validation:string;
    dependencies:string[];
    sourceEpisodeIds:string[];
  }>=[];

  const languageForPath=(path:string):string=>{
    const lower=path.toLowerCase();
    if(lower.endsWith('.ts')||lower.endsWith('.tsx'))return 'ts';
    if(lower.endsWith('.js')||lower.endsWith('.jsx'))return 'js';
    if(lower.endsWith('.mjs')||lower.endsWith('.cjs'))return 'js';
    if(lower.endsWith('.kt'))return 'kt';
    if(lower.endsWith('.java'))return 'java';
    if(lower.endsWith('.py'))return 'py';
    if(lower.endsWith('.go'))return 'go';
    if(lower.endsWith('.rs'))return 'rs';
    return '';
  };

  for(const material of materials){
    for(const example of material.codeExamples){
      const explicitPath=example.targetPath&&allowed.has(example.targetPath)
        ? example.targetPath
        : undefined;

      const path=explicitPath||(
        targetPaths.length===1 &&
        this.codeLanguageMatchesTarget(example.language,targetPaths[0])
          ? targetPaths[0]
          : ''
      );

      if(!path||!allowed.has(path)||!example.code.trim())continue;

      const tests=material.testClues.length>0
        ? material.testClues.join('\\n')
        : `Validate implementation for ${path} against the current target contract.`;

      const validation=validationRequirements.join('\\n');

      output.push({
        path,
        candidateContent:example.code.trim(),
        tests,
        validation,
        dependencies:material.dependencies,
        sourceEpisodeIds:[material.sourceId],
      });

      if(output.length>=targetPaths.length)break;
    }

    if(output.length>=targetPaths.length)break;
  }

  return output.filter((item,index,array)=>
    array.findIndex(other=>other.path===item.path&&other.candidateContent===item.candidateContent)===index
  );
 }

 private codeLanguageMatchesTarget(language:string,targetPath:string):boolean{
  const l=String(language||'').toLowerCase();
  const p=targetPath.toLowerCase();
  if((p.endsWith('.ts')||p.endsWith('.tsx'))&&['ts','typescript','tsx'].includes(l))return true;
  if((p.endsWith('.js')||p.endsWith('.jsx')||p.endsWith('.mjs')||p.endsWith('.cjs'))&&['js','javascript','jsx','mjs','cjs'].includes(l))return true;
  if(p.endsWith('.kt')&&['kt','kotlin'].includes(l))return true;
  if(p.endsWith('.java')&&l==='java')return true;
  if(p.endsWith('.py')&&['py','python'].includes(l))return true;
  if(p.endsWith('.go')&&['go','golang'].includes(l))return true;
  if(p.endsWith('.rs')&&['rs','rust'].includes(l))return true;
  return false;
 }

 private parseConstructionBindings(
  graph:CodeConstructionGraph,
  value:unknown,
):CodeConstructionBinding[]{
  const raw =
    Array.isArray(value)
      ? value
      : value &&
        typeof value==='object' &&
        Array.isArray((value as Record<string,unknown>).bindings)
        ? (value as Record<string,unknown>).bindings
        : [];

  const nodes=new Map(
    graph.nodes.map(node=>[node.nodeId,node])
  );

  return raw
    .filter(
      (item):item is Record<string,unknown> =>
        Boolean(item) &&
        typeof item==='object' &&
        !Array.isArray(item)
    )
    .map(item=>{
      const targetNodeId=
        typeof item.targetNodeId==='string'
          ? item.targetNodeId.trim()
          : '';

      const slotName=
        typeof item.slotName==='string'
          ? item.slotName.trim()
          : '';

      if(!targetNodeId||!slotName)return undefined;

      const target=nodes.get(targetNodeId);
      if(!target)return undefined;

      const slot=target.profile.slots.find(
        candidate=>candidate.name===slotName
      );
      if(!slot)return undefined;

      const sourceNodeId=
        typeof item.sourceNodeId==='string'
          ? item.sourceNodeId.trim()
          : '';

      const hasValue=typeof item.value==='string';
      const value=hasValue
        ? String(item.value)
        : undefined;

      /*
       * sourceNodeId と literal value を同時に指定した場合は
       * どちらを採用するか推測しない。
       */
      if(sourceNodeId&&hasValue)return undefined;

      if(sourceNodeId){
        const source=nodes.get(sourceNodeId);
        if(!source||sourceNodeId===targetNodeId)return undefined;

        const outputs=source.profile.outputKinds||[];
        const compatible=outputs.some(
          output=>slot.inputKinds.includes(output)
        );

        /*
         * 明示Bindingでも契約不一致なら採用しない。
         * 不足状態は後段のValidation/Researchへ残す。
         */
        if(!compatible)return undefined;

        return {
          targetNodeId,
          slotName,
          sourceNodeId,
        } as CodeConstructionBinding;
      }

      if(hasValue){
        const valueKind=
          typeof item.valueKind==='string'
            ? item.valueKind.trim()
            : undefined;

        if(
          valueKind &&
          !slot.inputKinds.includes(valueKind)
        ){
          return undefined;
        }

        return {
          targetNodeId,
          slotName,
          value,
          ...(valueKind ? {valueKind}:{}),
        } as CodeConstructionBinding;
      }

      return undefined;
    })
    .filter(
      (item):item is CodeConstructionBinding =>
        Boolean(item)
    );
 }

 private parseImplementationCandidates(
  value:unknown,
  targetPaths:string[],
):Array<{
  path:string;
  candidateContent:string;
  tests:string;
  validation:string;
  componentType?:string;
  inputs?:string[];
  outputs?:string[];
  prerequisites?:string[];
  dependencies?:string[];
  supportedEnvironments?:string[];
  entryPoint?:string;
  exports?:string[];
  imports?:string[];
  publicInterfaces?:string[];
  coreIngressPoints?:string[];
  domainOwnership?:string[];
  persistenceKeys?:string[];
  uiEventEntrypoints?:string[];
  sourceEpisodeIds?:string[];
  sourceLearningArtifactIds?:string[];
}>{
  if(!Array.isArray(value))return [];

  const allowed=new Set(targetPaths);

  return value
    .filter((item):item is Record<string,unknown>=>Boolean(item)&&typeof item==='object'&&!Array.isArray(item))
    .map(item=>({
      path:typeof item.path==='string'?item.path.trim():'',
      candidateContent:typeof item.candidateContent==='string'?item.candidateContent:'',
      tests:typeof item.tests==='string'?item.tests:'',
      validation:typeof item.validation==='string'?item.validation:'',
      componentType:typeof item.componentType==='string'?item.componentType:undefined,
      inputs:this.strings(item.inputs),
      outputs:this.strings(item.outputs),
      prerequisites:this.strings(item.prerequisites),
      dependencies:this.strings(item.dependencies),
      supportedEnvironments:this.strings(item.supportedEnvironments),
      entryPoint:typeof item.entryPoint==='string'?item.entryPoint:undefined,
      exports:this.strings(item.exports),
      imports:this.strings(item.imports),
      publicInterfaces:this.strings(item.publicInterfaces),
      coreIngressPoints:this.strings(item.coreIngressPoints),
      domainOwnership:this.strings(item.domainOwnership),
      persistenceKeys:this.strings(item.persistenceKeys),
      uiEventEntrypoints:this.strings(item.uiEventEntrypoints),
      sourceEpisodeIds:this.strings(item.sourceEpisodeIds),
      sourceLearningArtifactIds:this.strings(item.sourceLearningArtifactIds),
    }))
    .filter(item=>
      allowed.has(item.path)&&
      item.candidateContent.trim().length>0&&
      item.tests.trim().length>0&&
      item.validation.trim().length>0
    );
 }

 private strings(value:unknown):string[]{return Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):[];}
}
export const candidateCodeGenerationService=new CandidateCodeGenerationService();
