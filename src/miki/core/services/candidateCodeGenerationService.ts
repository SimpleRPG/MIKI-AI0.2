import { improvementIntakeRouterService } from './improvementIntakeRouterService';
import { autonomousCandidatePreparationService } from './autonomousCandidatePreparationService';
import { selfCodeSpaceService } from './selfCodeSpaceService';
import { selfCodeUnderstandingService } from './selfCodeUnderstandingService';
import { storageService } from '../../../services/storageService';
import { canonicalSha256 } from './canonicalSha256Service';
import { reviewLearningArtifactService } from './reviewLearningArtifactService';
import { failureCatalogService } from '../../memory/services/failureCatalogService';
import { systemLogger } from '../../../services/systemLogger';
import { reusableComponentFactoryService } from './reusableComponentFactoryService';
import { candidateUnknownResolutionService } from './candidateUnknownResolutionService';
import { githubCodeMaterialService } from './githubCodeMaterialService';
import { stackExchangeMaterialService } from './stackExchangeMaterialService';
import { nonLlmCodeSynthesisService } from '../../selfDevelopment/services/nonLlmCodeSynthesisService';
import { componentArtifactStoreService } from '../../capability/services/componentArtifactStoreService';
import { componentRegistryService } from '../../capability/services/componentRegistryService';
import { ComponentCompositionService } from '../../capability/services/componentCompositionService';
import { codeConstructionRendererService } from './codeConstructionRendererService';
import { astCandidateTransformationService, type AstCandidateOperation } from '../../selfDevelopment/services/astCandidateTransformationService';
import { integratedGenerationPlanService } from '../../selfDevelopment/services/integratedGenerationPlanService';
import { taskBlackboardService } from './taskBlackboardService';
import { missingComponentSpecService, type MissingComponentSpec } from './missingComponentSpecService';
import { semanticRequirementCompilerService } from './semanticRequirementCompilerService';
import { codeGenerationQualityPlannerService } from './codeGenerationQualityPlannerService';
import { requirementConsistencyGraphService } from './requirementConsistencyGraphService';
import { acceptanceTestMatrixService } from './acceptanceTestMatrixService';
import { changeScopeImpactService } from './changeScopeImpactService';
import { requirementPriorityResolverService } from './requirementPriorityResolverService';
import { generationTaskDagService } from './generationTaskDagService';
import { requirementTraceabilityMatrixService } from './requirementTraceabilityMatrixService';
import { generationCapabilityExpansionService } from '../../selfDevelopment/services/generationCapabilityExpansionService';
import {
  isCompatibleConstructionKind,
  type CodeConstructionBinding,
  type CodeConstructionGraph,
} from '../data/codeKnowledge/common';
export interface CandidateGenerationFile { path:string; candidateContent:string; evidenceIds:string[]; }
/*
 * P421（供給3）: 不足記録（candidateGenerationGap）に持たせる契約欄。
 * 不足が発生した時点で、自己コード索引から導出できる範囲の
 * 「期待インターフェース」を構造化して確定させる。供給1
 * （componentSupplyRequestService）は、パッケージ生成時に索引から
 * 再構成するより、この記録済み契約を優先して使う（対象ファイルが
 * その後に変わっても、不足時点の契約が要求の正になる）。
 * 導出できない対象については欄を持たせない（捏造しない）。
 */
export interface CandidateGenerationGapContractSignature { name:string; kind:string; parameters:string[]; returnType?:string; }
export interface CandidateGenerationGapContractTarget { path:string; exports:string[]; signatures:CandidateGenerationGapContractSignature[]; imports:string[]; }
export interface CandidateGenerationGapContract {
  targets:CandidateGenerationGapContractTarget[];
  missingSlots:Array<{ knowledgeId:string; slotName:string; inputKinds:string[] }>;
  missingComponentIds:string[];
}
export interface CandidateGenerationOutcome { accepted:boolean; runId:string; workspaceId?:string; files:CandidateGenerationFile[]; reasons:string[]; responseHash?:string; attemptCount?:number; createdCodeComponentIds?:string[]; learningLineage?:{sourcePackageId?:string;externalReviewId?:string;candidateRevision:number;requestedChanges:string[];userReason?:string;usedLearningArtifactIds:string[];ignoredLearningArtifactIds:string[];appliedFailurePatternIds:string[];appliedCorrectionPairIds:string[];appliedComponentPatternIds:string[];learningContextSha256:string;componentPackId?:string;usedKnowledgeComponentIds?:string[];usedCodeComponentIds?:string[];usedConversationComponentIds?:string[];excludedComponentIds?:string[];componentContextSha256?:string}; }
class CandidateCodeGenerationService {
 async generate(runId:string):Promise<CandidateGenerationOutcome>{
  const run=improvementIntakeRouterService.get(runId);if(!run)return {accepted:false,runId,files:[],reasons:['IMPROVEMENT_RUN_NOT_FOUND']};
  let currentSourceFiles=selfCodeSpaceService.listSourceFiles();
  const lightMode=currentSourceFiles.length===0&&Boolean(selfCodeSpaceService.getLightManifest());
  if(currentSourceFiles.length===0&&!lightMode)return {accepted:false,runId,files:[],reasons:['SOURCE_SNAPSHOT_EMPTY']};

  const currentSourceSnapshotSha256=selfCodeSpaceService.getSourceSnapshotSha256();

  const runSourceSnapshotSha256=
    typeof run.payload.sourceSnapshotSha256==='string'
      ? run.payload.sourceSnapshotSha256.trim()
      : '';

  if(!runSourceSnapshotSha256){
    return {
      accepted:false,
      runId,
      files:[],
      reasons:['SOURCE_CONTEXT_CONTRACT_REQUIRED']
    };
  }

  if(runSourceSnapshotSha256!==currentSourceSnapshotSha256){
    return {
      accepted:false,
      runId,
      files:[],
      reasons:['SOURCE_CONTEXT_CONFLICT']
    };
  }

  // P352: in index-first mode there is no classic snapshot. Hydrate
  // the target files and their index neighborhood on demand and let
  // generation work on that context closure instead.
  let sourceOverride:typeof currentSourceFiles|undefined;
  if(lightMode){
   const payloadTargets=Array.isArray(run.payload.targetFiles)
    ? run.payload.targetFiles.filter((value):value is string=>typeof value==='string'&&Boolean(value.trim())).map(value=>value.trim())
    : [];
   if(payloadTargets.length>0){
    const entryByPath=new Map((selfCodeUnderstandingService.getSnapshot()?.entries||[]).map(entry=>[entry.path,entry]));
    const manifest=selfCodeSpaceService.getLightManifest();
    const synthetic=(manifest?.files||[])
     .filter(item=>entryByPath.has(item.path))
     .map(item=>({path:item.path,content:'',contentHash:entryByPath.get(item.path)!.contentHash}));
    const rel=selfCodeUnderstandingService.ensure(payloadTargets,synthetic);
    const wanted=[...new Set([...payloadTargets,...rel.relatedPaths])];
    const contents=await selfCodeSpaceService.ensureFileContents(wanted);
    currentSourceFiles=wanted
     .filter(path=>contents.has(path))
     .map(path=>selfCodeSpaceService.toSourceFile(path,contents.get(path)!));
    sourceOverride=currentSourceFiles;
   }
  }
  const probe=await autonomousCandidatePreparationService.prepareForRun(runId,[],sourceOverride);const targetPaths=probe.targetPaths;
  if(targetPaths.length===0)return {accepted:false,runId,files:[],reasons:[probe.reason||'TARGET_FILES_NOT_RESOLVED']};
  const sources=new Map(currentSourceFiles.map(file=>[file.path,file]));const targetFiles=targetPaths.map(path=>sources.get(path)).filter((value):value is NonNullable<typeof value>=>Boolean(value));
  if(targetFiles.length!==targetPaths.length)return {accepted:false,runId,files:[],reasons:['SOURCE_SNAPSHOT_INCOMPLETE']};
  const preparedRun=improvementIntakeRouterService.get(runId);
  if(!preparedRun)return {accepted:false,runId,files:[],reasons:['IMPROVEMENT_RUN_NOT_FOUND_AFTER_PREPARATION']};
  const implementationPlan=preparedRun.implementationPlan;
  if(preparedRun.runType==='AUTONOMOUS_DISCOVERY'&&!implementationPlan)return {accepted:false,runId,files:[],reasons:['AUTONOMOUS_IMPLEMENTATION_PLAN_REQUIRED']};
  const failureFeedback =
    run.payload.failureFeedback &&
    typeof run.payload.failureFeedback === 'object'
      ? run.payload.failureFeedback as Record<string,unknown>
      : undefined;

  const failureFeedbackReasons = failureFeedback
    ? [
        ...this.strings(failureFeedback.reasons),
        ...(
          failureFeedback.result &&
          typeof failureFeedback.result === 'object'
            ? [
                ...this.strings((failureFeedback.result as Record<string,unknown>).reasons),
                ...this.strings((failureFeedback.result as Record<string,unknown>).failedChecks),
                ...this.strings((failureFeedback.result as Record<string,unknown>).unexecutedChecks),
                ...(
                  String((failureFeedback.result as Record<string,unknown>).reason||'').trim()
                    ? [String((failureFeedback.result as Record<string,unknown>).reason).trim()]
                    : []
                ),
                ...(
                  String((failureFeedback.result as Record<string,unknown>).error||'').trim()
                    ? [String((failureFeedback.result as Record<string,unknown>).error).trim()]
                    : []
                ),
                ...(
                  String((failureFeedback.result as Record<string,unknown>).summary||'').trim()
                    ? [String((failureFeedback.result as Record<string,unknown>).summary).trim()]
                    : []
                ),
                ...(
                  Array.isArray((failureFeedback.result as Record<string,unknown>).results)
                    ? ((failureFeedback.result as Record<string,unknown>).results as unknown[])
                        .filter((item): item is Record<string,unknown> => Boolean(item && typeof item==='object'))
                        .flatMap(item=>[
                          ...(
                            String(item.reason||'').trim()
                              ? [String(item.reason).trim()]
                              : []
                          ),
                          ...(
                            String(item.error||'').trim()
                              ? [String(item.error).trim()]
                              : []
                          ),
                          ...this.strings(item.failedChecks),
                          ...this.strings(item.unexecutedChecks),
                        ])
                    : []
                ),
              ]
            : []
        ),
      ].filter(Boolean)
    : [];

  const astTransformations=this.parseAstTransformations(run.payload.astTransformations,targetPaths);
  const integratedPlan=integratedGenerationPlanService.plan({
    objective:run.objective,targetPaths,astTransformations,
    reusableComponentIds:this.strings(run.payload.reusableComponentIds),
    codeKnowledgeIds:this.strings(run.payload.codeKnowledgeIds),
    requirementContractId:typeof run.payload.requirementContractId==='string'?run.payload.requirementContractId:undefined,
    repositorySnapshotSha256:runSourceSnapshotSha256,
    priorFailureReasons:[
      ...this.strings(run.payload.generationFailureReasons),
      ...failureFeedbackReasons,
    ]
  });
  if(integratedPlan.unresolved.length>0)return {accepted:false,runId,files:[],reasons:integratedPlan.unresolved};
  const astFallbackReasons:string[]=[];
  const astStep=integratedPlan.steps.find(step=>step.strategy==='AST_TRANSFORM');
  if(astStep){
    const generated:CandidateGenerationFile[]=[];
    for(const target of targetFiles){
      const operations=astStep.astOperations.filter(item=>item.path===target.path).flatMap(item=>item.operations);
      if(operations.length===0)continue;
      const outcome=astCandidateTransformationService.transform({path:target.path,baselineContent:target.content,expectedBaselineSha256:canonicalSha256(target.content),operations});
      if(!outcome.accepted||!outcome.candidateContent){astFallbackReasons.push(...outcome.reasons.map(reason=>`${target.path}:${reason}`));continue;}
      generated.push({path:target.path,candidateContent:outcome.candidateContent,evidenceIds:[...target.evidenceIds]});
    }
    if(astFallbackReasons.length===0&&generated.length>0&&!failureFeedback){
      const prepared=await autonomousCandidatePreparationService.prepareForRun(runId,generated,sourceOverride);
      if(prepared.workspaceId){
        const duplicates=this.findDuplicateExports(generated);
        if(duplicates.length>0)return {accepted:false,runId,files:[],reasons:duplicates,attemptCount:1};
        return {
          accepted:true,runId,workspaceId:prepared.workspaceId,files:generated,reasons:[],attemptCount:1,
          responseHash:canonicalSha256({
            planId:integratedPlan.planId,
            files:generated.map(file=>({path:file.path,sha256:canonicalSha256(file.candidateContent)}))
          })
        };
      }
      astFallbackReasons.push(prepared.reason||'AST_CANDIDATE_WORKSPACE_NOT_CREATED');
    }
    if(generated.length===0&&astFallbackReasons.length===0)astFallbackReasons.push('AST_TRANSFORMATION_TARGETS_NOT_RESOLVED');
  }
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

  const blackboardTask=run.taskId ? taskBlackboardService.get(run.taskId) : undefined;
  const acquiredAssetEntry=blackboardTask?.entries
    .filter(entry=>entry.key==='required-assets-acquired')
    .at(-1);
  const acquiredAssetValue=acquiredAssetEntry?.value && typeof acquiredAssetEntry.value==='object' && !Array.isArray(acquiredAssetEntry.value)
    ? acquiredAssetEntry.value as Record<string,unknown>
    : {};
  const acquiredEvidenceIds=[...new Set([
    ...this.strings(acquiredAssetValue.evidenceIds),
    ...(acquiredAssetEntry?.evidenceIds||[]),
  ])];
  const acquiredComponentIds=[...new Set(this.strings(acquiredAssetValue.componentIds))];
  const acquiredRequirements=this.strings(acquiredAssetValue.requirements);
  const acquiredReasons=this.strings(acquiredAssetValue.reasons);

  const effectiveRequirements = [
    ...this.strings(run.payload.requirements),
    ...acquiredRequirements,
    ...acquiredReasons.map(reason=>`ACQUIRED_ASSET_CONTEXT:${reason}`),
    ...(failureFeedbackText ? [failureFeedbackText] : []),
  ];

  const semanticContract=semanticRequirementCompilerService.compile(effectiveRequirements);
  const semanticTargetPaths=this.strings(run.payload.targetPaths);
  const generationQualityPlan=codeGenerationQualityPlannerService.plan(semanticContract,semanticTargetPaths);
  const requirementConflicts=requirementConsistencyGraphService.analyze(semanticContract);
  const acceptanceTestMatrix=acceptanceTestMatrixService.create(semanticContract);
  const changeImpactPlan=changeScopeImpactService.plan(semanticTargetPaths,semanticContract.constraints.length);
  const prioritizedRequirements=requirementPriorityResolverService.resolve(semanticContract);
  const generationTaskDag=generationTaskDagService.build(semanticTargetPaths,acceptanceTestMatrix);
  const requirementTraceability=requirementTraceabilityMatrixService.create(prioritizedRequirements,acceptanceTestMatrix);
  const taskDagHasCycle=generationTaskDagService.hasCycle(generationTaskDag);
  taskBlackboardService.append(runId,'OBSERVATION','core','semantic-requirement-contract',semanticContract,[]);
  taskBlackboardService.append(runId,'OBSERVATION','core','code-generation-quality-plan',generationQualityPlan,[]);
  taskBlackboardService.append(runId,'OBSERVATION','core','requirement-consistency-graph',requirementConflicts,[]);
  taskBlackboardService.append(runId,'OBSERVATION','core','acceptance-test-matrix',acceptanceTestMatrix,[]);
  taskBlackboardService.append(runId,'OBSERVATION','core','change-impact-plan',changeImpactPlan,[]);
  taskBlackboardService.append(runId,'OBSERVATION','core','prioritized-requirements',prioritizedRequirements,[]);
  taskBlackboardService.append(runId,'OBSERVATION','core','generation-task-dag',generationTaskDag,[]);
  taskBlackboardService.append(runId,'OBSERVATION','core','requirement-traceability-matrix',requirementTraceability,[]);

  const effectiveValidationRequirements = [
    ...this.strings(run.payload.validationRequirements),
    ...generationQualityPlan.requiredChecks,
    ...semanticContract.acceptanceCriteria.map(item=>`ACCEPTANCE:${item}`),
    ...acceptanceTestMatrix.map(test=>`TEST:${test.id}:${test.scenario}:${test.oracle}`),
    ...requirementConflicts.map(conflict=>`CONFLICT:${conflict.severity}:${conflict.kind}:${conflict.left} <> ${conflict.right}`),
    ...requirementTraceability.filter(row=>row.status==='UNTRACED').map(row=>`UNTRACED:${row.requirementId}:${row.requirement}`),
    ...(taskDagHasCycle?['GENERATION_TASK_DAG_CYCLE']:[]),
  ];

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
      Boolean(item) &&
      item.componentKind === 'KNOWLEDGE' &&
      typeof item.componentType === 'string' &&
      item.componentType.trim().length > 0 &&
      codeKnowledgePack.usedKnowledgeComponentIds.includes(item.componentId)
    )
    .slice(0, 8);

  const resolvedKnowledgeIds = new Set([
    ...codeKnowledge.map(item => item.componentId),
    ...acquiredComponentIds,
  ]);
  const unresolvedKnowledgeComponentIds =
    codeKnowledgePack.usedKnowledgeComponentIds.filter(
      id => !resolvedKnowledgeIds.has(id)
    );

  if(unresolvedKnowledgeComponentIds.length>0){
    const reason=`CODE_COMPOSITION_COMPONENT_UNRESOLVED:${unresolvedKnowledgeComponentIds.join(',')}`;
    return {
      accepted:false,
      runId,
      files:[],
      reasons:[reason],
      attemptCount:1,
      responseHash:canonicalSha256(JSON.stringify({
        runId,
        reason,
        unresolvedKnowledgeComponentIds
      }))
    };
  }

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

  /*
   * Construction Graphの監査は不足を発見するだけで、生成責務を持たない。
   *
   * 1. 現在選択されているKnowledgeを監査
   * 2. 監査が示したcompatible producerを選択集合へ追加
   * 3. 既存KnowledgeのConstructionProfileから不足CODE ComponentをFactoryで補完
   * 4. 補完後に再監査
   * 5. それでも解けない不足だけをUnknown / Researchへ返す
   */
  let constructionKnowledgeComponentIds=[
   ...new Set(codeKnowledgePack.usedKnowledgeComponentIds)
  ];

  let constructionConnectivityAudit =
   reusableComponentFactoryService.auditConstructionConnectivity({
    componentIds:constructionKnowledgeComponentIds,
   });

  const initialSelectedConstructionKnowledgeIds=new Set(
   reusableComponentFactoryService
    .list()
    .filter(item=>
     item.componentKind==='KNOWLEDGE' &&
     constructionKnowledgeComponentIds.includes(item.componentId)
    )
    .flatMap(item=>item.appliesWhen)
  );

  const producerKnowledgeIds=[
   ...new Set(
    constructionConnectivityAudit.selectionProducerGaps
     .filter(item=>initialSelectedConstructionKnowledgeIds.has(item.knowledgeId))
     .flatMap(item=>item.producerKnowledgeIds)
   )
  ];

  if(producerKnowledgeIds.length>0){
   const producerKnowledgeComponentIds=
    reusableComponentFactoryService
     .list()
     .filter(item=>
      item.componentKind==='KNOWLEDGE' &&
      Boolean(item.constructionProfile) &&
      item.appliesWhen.some(id=>producerKnowledgeIds.includes(id))
     )
     .map(item=>item.componentId);

   constructionKnowledgeComponentIds=[
    ...new Set([
     ...constructionKnowledgeComponentIds,
     ...producerKnowledgeComponentIds,
    ])
   ];
  }

  const selectedConstructionKnowledgeIds=[
   ...new Set(
    reusableComponentFactoryService
     .list()
     .filter(item=>
      item.componentKind==='KNOWLEDGE' &&
      constructionKnowledgeComponentIds.includes(item.componentId)
     )
     .flatMap(item=>item.appliesWhen)
   )
  ];

  const constructionMaterialization=
   reusableComponentFactoryService.materializeMissingConstructionComponents({
    knowledgeIds:selectedConstructionKnowledgeIds,
    supportedEnvironments:['ANDROID','MIKI_RUNTIME'],
   });

  constructionConnectivityAudit =
   reusableComponentFactoryService.auditConstructionConnectivity({
    componentIds:constructionKnowledgeComponentIds,
   });

  const constructionGraph =
   reusableComponentFactoryService.buildConstructionGraph({
    goal:run.objective,
    componentIds:constructionKnowledgeComponentIds,
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

  /*
   * 複数targetは、単一Graphのrootを無理に複数ファイルへ
   * コピーしない。
   *
   * Factoryの既存Construction Graph機構をtargetごとに再利用し、
   * 全targetが決定論的に構築できた場合だけ一括Candidate化する。
   * 1ファイルでも不足する場合は部分生成せず、既存の
   * CONSTRUCTION_GAP -> Unknown -> Researchへ戻す。
   */
  if(targetFiles.length>1){
    const bundle=reusableComponentFactoryService.buildConstructionGraphBundle({
      goal:run.objective,
      componentIds:constructionKnowledgeComponentIds,
      targetPaths:targetFiles.map(file=>file.path),
      preserveAllNodes:Boolean(run.payload.constructionBindings),
    });

    if(bundle.accepted){
      /*
       * Multi-fileでもsingle-fileと同じ明示Binding解決を使う。
       * constructionBindingsをGoal文字列へ埋め込むだけにはしない。
       */
      const resolvedBundle=bundle.items.map(item=>{
        const explicitBindings=this.parseConstructionBindings(
          item.graph,
          run.payload.constructionBindings,
        );

        const explicitBindingKeys=new Set(
          explicitBindings.map(binding =>
            `${binding.targetNodeId}::${binding.slotName}`
          )
        );

        const graph:CodeConstructionGraph={
          ...item.graph,
          bindings:[
            ...item.graph.bindings.filter(binding =>
              !explicitBindingKeys.has(
                `${binding.targetNodeId}::${binding.slotName}`
              )
            ),
            ...explicitBindings,
          ],
        };

        return {
          ...item,
          graph,
        };
      });

      const renderedBundle=resolvedBundle.map(item=>{
        const validation=
          ComponentCompositionService.getInstance()
            .validateConstructionGraph(item.graph);
        const render=
          validation.valid
            ? codeConstructionRendererService.render(item.graph)
            : {
                accepted:false,
                errors:[
                  ...validation.errors,
                  ...validation.unresolvedSlots.map(
                    slot=>`UNRESOLVED_SLOT:${slot}`
                  ),
                ],
              };

        return {
          ...item,
          validation,
          render,
        };
      });

      const bundleValid=
        renderedBundle.length===targetFiles.length &&
        renderedBundle.every(item=>
          item.validation.valid &&
          item.render.accepted &&
          typeof item.render.source==='string' &&
          item.render.source.trim().length>0
        );

      const targetContent=new Map(
        targetFiles.map(file=>[file.path,file.content.trim()])
      );

      const generatedSources=renderedBundle.map(item=>
        item.render.source!.trim()
      );

      const duplicateSource=
        new Set(generatedSources).size!==generatedSources.length;

      const changedEverywhere=renderedBundle.every(item=>
        item.render.source!.trim()!==(targetContent.get(item.targetPath)||'')
      );

      if(bundleValid&&!duplicateSource&&changedEverywhere){
        const createdBundleIds:string[]=[];

        for(const item of renderedBundle){
          const created=
            reusableComponentFactoryService.createCodeComponentCandidate({
              purpose:run.objective,
              implementation:item.render.source!,
              targetPath:item.targetPath,
              tests:[
                `ConstructionGraph=${item.graph.graphId}`,
                ...effectiveValidationRequirements,
              ].filter(Boolean).join('\\n'),
              validation:[
                `CONSTRUCTION_GRAPH=${item.graph.graphId}`,
                `ROOT_NODE=${item.render.rootNodeId||''}`,
                ...effectiveValidationRequirements,
              ].filter(Boolean).join('\\n'),
              componentType:'CONSTRUCTION_GRAPH_MULTI_FILE_CODE_COMPONENT',
              supportedEnvironments:['ANDROID'],
              entryPoint:item.targetPath,
              sourceEpisodeIds:[],
            });

          if(!created.accepted||!created.componentId){
            return {
              accepted:false,
              runId,
              files:[],
              reasons:[
                'CONSTRUCTION_GRAPH_MULTI_FILE_CANDIDATE_CREATION_FAILED'
              ],
              attemptCount:1,
            };
          }

          createdBundleIds.push(created.componentId);
        }

        const reason=
          'CONSTRUCTION_GRAPH_MULTI_FILE_CODE_COMPONENT_CANDIDATES_CREATED_AWAITING_VERIFICATION';

        this.record(runId,{
          attemptCount:1,
          status:'BLOCKED',
          reason,
          createdCodeComponentIds:createdBundleIds,
          unknownContext: undefined,
          responseHash:canonicalSha256(JSON.stringify({
            runId,
            reason,
            graphIds:renderedBundle.map(item=>item.graph.graphId),
            createdBundleIds,
          })),
        });

        return {
          accepted:false,
          runId,
          files:[],
          reasons:[reason],
          attemptCount:1,
          createdCodeComponentIds:createdBundleIds,
        };
      }
    }
  }

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

  const selectedConstructionKnowledgeIdSet=
   new Set(selectedConstructionKnowledgeIds);

  const scopedMissingConstructionDefinitions=
   constructionConnectivityAudit.missingConstructionDefinitionKnowledgeIds
    .filter(id=>selectedConstructionKnowledgeIdSet.has(id));

  const scopedMissingCodeComponents=
   constructionConnectivityAudit.missingCodeComponentKnowledgeIds
    .filter(id=>selectedConstructionKnowledgeIdSet.has(id));

  const scopedUnlinkedConstructionKnowledge=
   constructionConnectivityAudit.unlinkedConstructionKnowledgeIds
    .filter(id=>selectedConstructionKnowledgeIdSet.has(id));

  const scopedMissingProducerSlots=
   constructionConnectivityAudit.missingProducerSlots
    .filter(item=>selectedConstructionKnowledgeIdSet.has(item.knowledgeId));

  const scopedSelectionProducerGaps=
   constructionConnectivityAudit.selectionProducerGaps
    .filter(item=>selectedConstructionKnowledgeIdSet.has(item.knowledgeId));

  const constructionGapRequirements=[
   ...scopedMissingConstructionDefinitions.map(
    id=>`CONSTRUCTION_DEFINITION_MISSING:${id}`
   ),
   ...scopedMissingCodeComponents.map(
    id=>`CODE_COMPONENT_MISSING:${id}`
   ),
   ...scopedUnlinkedConstructionKnowledge.map(
    id=>`CODE_COMPONENT_UNLINKED:${id}`
   ),
   ...scopedMissingProducerSlots.map(
    item=>
     `NO_COMPATIBLE_PRODUCER:${item.knowledgeId}:${item.slotName}:${item.inputKinds.join('|')}`
   ),
   ...scopedSelectionProducerGaps.map(
    item=>
     `SELECTION_PRODUCER_GAP:${item.knowledgeId}:${item.slotName}:${item.producerKnowledgeIds.join('|')}`
   ),
   ...constructionMaterialization.unresolvedKnowledgeIds.map(
    id=>`CONSTRUCTION_MATERIALIZATION_UNRESOLVED:${id}`
   ),
   ...Object.entries(constructionMaterialization.rejectedReasons).map(
    ([id,reason])=>`CONSTRUCTION_MATERIALIZATION_REJECTED:${id}:${reason}`
   ),
   ...constructionValidation.errors,
   ...constructionValidation.unresolvedSlots.map(
    slot=>`UNRESOLVED_SLOT:${slot}`
   ),
  ]
   .filter(Boolean)
   .map(value=>`CONSTRUCTION_GAP:${value}`)
   .slice(0,12);


  const capabilityExpansion=generationCapabilityExpansionService.plan({
    objective:run.objective,
    targetPaths,
    requirements:effectiveRequirements,
    constructionGaps:constructionGapRequirements,
  });
  effectiveRequirements.push(...capabilityExpansion.componentRequirements,...capabilityExpansion.algorithmPatterns,...capabilityExpansion.implementationContracts,...capabilityExpansion.decompositionSteps,...capabilityExpansion.safeFallbacks);
  effectiveValidationRequirements.push(...capabilityExpansion.validationRequirements,...capabilityExpansion.validationProfiles);
  if(run.taskId){
    taskBlackboardService.append(run.taskId,'OBSERVATION','core','generation-capability-expansion',capabilityExpansion,acquiredEvidenceIds);
  }

  const candidateInputManifest={
    schemaVersion:1,
    runId:run.runId,
    taskId:run.taskId||run.runId,
    objective:run.objective,
    directiveId:typeof run.payload.directiveId==='string'?run.payload.directiveId:'',
    directiveTitle:typeof run.payload.title==='string'?run.payload.title:'',
    directiveSourceHash:typeof run.payload.sourceHash==='string'?run.payload.sourceHash:'',
    relatedIssueIds:this.strings(run.payload.relatedIssueIds),
    targetPaths,
    sourcePaths:targetFiles.map(file=>file.path),
    requirements:effectiveRequirements,
    prohibitions:this.strings(run.payload.prohibitions),
    invariants:this.strings(run.payload.invariants),
    validationRequirements:effectiveValidationRequirements,
    deliveryRequirements:this.strings(run.payload.deliveryRequirements),
    selectedKnowledgeComponentIds:codeKnowledge.map(item=>item.componentId),
    acquiredKnowledgeComponentIds:acquiredComponentIds,
    acquiredEvidenceIds,
    sourceSnapshotSha256:typeof run.payload.sourceSnapshotSha256==='string'?run.payload.sourceSnapshotSha256:'',
    environmentFingerprint,
    capabilityExpansionPlanId:capabilityExpansion.planId,
    algorithmPatterns:capabilityExpansion.algorithmPatterns,
    apiResearchQuestions:capabilityExpansion.apiResearchQuestions,
    adapterDecisions:capabilityExpansion.adapterDecisions,
    implementationContracts:capabilityExpansion.implementationContracts,
    validationProfiles:capabilityExpansion.validationProfiles,
    decompositionSteps:capabilityExpansion.decompositionSteps,
  };
  const candidateInputManifestSha256=canonicalSha256(candidateInputManifest);
  const handoffIssues:string[]=[];
  if(!candidateInputManifest.sourceSnapshotSha256)handoffIssues.push('SOURCE_SNAPSHOT_SHA256_MISSING');
  if(candidateInputManifest.sourcePaths.length===0)handoffIssues.push('SOURCE_PATHS_MISSING');
  if(acquiredAssetEntry&&this.strings(acquiredAssetValue.evidenceIds).length>0&&acquiredEvidenceIds.length===0)handoffIssues.push('ACQUIRED_EVIDENCE_HANDOFF_EMPTY');
  if(run.runType==='EXTERNAL_DIRECTIVE'&&candidateInputManifest.requirements.length===0)handoffIssues.push('DIRECTIVE_REQUIREMENTS_MISSING');
  if(handoffIssues.length>0){
    if(run.taskId){
      taskBlackboardService.append(run.taskId,'ERROR','core','candidate-input-handoff-broken',{
        manifestSha256:candidateInputManifestSha256,
        issues:handoffIssues,
        candidateInputManifest,
      },acquiredEvidenceIds);
    }
    return {accepted:false,runId,files:[],reasons:handoffIssues.map(issue=>`INFORMATION_HANDOFF_BROKEN:${issue}`),attemptCount:1,responseHash:candidateInputManifestSha256};
  }
  if(run.taskId){
    taskBlackboardService.append(run.taskId,'EVIDENCE','core','candidate-input-manifest',{
      ...candidateInputManifest,
      manifestSha256:candidateInputManifestSha256,
    },acquiredEvidenceIds);
  }

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
    // P422: この試行の契約（対象の公開面と不足スロットの期待）を
    // 未知解決へ渡し、GitHub コード材料チャネルのクエリ整形を
    // 契約ファーストにする。gap 記録用に後段でも同じ導出を行うが、
    // 索引スナップショットは共有されるため二重の解析にはならない。
    gapContract:this.buildGapContract(targetPaths,constructionGapRequirements),
    requirements:[
      ...effectiveRequirements,
      ...knowledgeRequirement,
      ...constructionGapRequirements,
      ...acquiredComponentIds.map(id=>`ACQUIRED_KNOWLEDGE_COMPONENT:${id}`),
      ...acquiredEvidenceIds.map(id=>`ACQUIRED_EVIDENCE:${id}`),
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
  /*
   * P406: 候補化のゲートは payload.validationRequirements で判定して
   * いたため、自律発見系など検証要求を明示しないランでは、材料が
   * 収集できていても全件破棄されていた。候補が実際に受ける検証は
   * 生成側で組み立てる実効検証要求（品質計画・受入条件・テスト
   * 行列を含む）なので、判定はそちらで行う。
   */
  const researchedCandidates=this.parseImplementationMaterials(
    unknownContext.implementationMaterials,
    targetPaths,
    effectiveValidationRequirements,
  );

  const acceptedResearchedSourceIds:string[]=[];

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
      acceptedResearchedSourceIds.push(...candidate.sourceEpisodeIds);
    }
  }

  // P422: GitHub コード材料が部品候補まで生き残ったことを使用台帳へ
  // 印す（学習の種の記録まで。重み付けの学習は行わない）。台帳に無い
  // sourceId（Web 由来の材料）はサービス側で無視される。
  if(acceptedResearchedSourceIds.length>0){
    githubCodeMaterialService.markMaterialsUsed(acceptedResearchedSourceIds);
  }

  // P423: Stack Exchange の参照材料は参照専用（部品候補化されない）
  // ため、使用印は「この生成試行の材料として届いた」ことをもって
  // 付ける。台帳に無い sourceId はサービス側で無視される。
  const stackExchangeReferenceIds=unknownContext.implementationMaterials
    .filter(material=>material.provider==='stackexchange_qa')
    .map(material=>material.sourceId);
  if(stackExchangeReferenceIds.length>0){
    stackExchangeMaterialService.markMaterialsUsed(stackExchangeReferenceIds);
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

  /*
   * Review Learning Artifactは既存の学習基盤から取得する。
   * sourcePackageIdがあるREVALIDATIONでは元Packageを優先し、
   * 通常RunではpackageIdを使用する。
   */
  const learningPackageId =
    typeof run.payload.sourcePackageId==='string'
      ? run.payload.sourcePackageId
      : typeof run.payload.packageId==='string'
        ? run.payload.packageId
        : undefined;

  const learningContext=reviewLearningArtifactService.retrieve({
    objective:[
      run.objective,
      ...this.strings(run.payload.requestedChanges),
      ...effectiveRequirements,
    ].filter(Boolean).join(' / '),
    packageId:learningPackageId
  });

  /*
   * P406: 合成材料の環境は生成対象の環境（ANDROID。
   * compiledRequest.environment と同じ）で評価する。ランが環境
   * 指紋を持たない場合に 'unknown' のままだと、ANDROID 向けに
   * 検証・承認された部品が環境不一致で材料から外れ、再利用の
   * 輪が閉じなかった。
   */
  const componentPack=reusableComponentFactoryService.plan({
    taskId:run.taskId||run.runId,
    purpose:[run.objective,knowledgeHints].filter(Boolean).join(' / '),
    environmentFingerprint:environmentFingerprint==='unknown'?'ANDROID':environmentFingerprint,
    requiredKinds:['KNOWLEDGE','CODE']
  });

  /*
   * Learning Artifactは実行可能CODEではない。
   * 既存Compositionの制約・修正知識としてだけ渡す。
   * unresolvedConflictsは命令化せず、未解決状態として明示する。
   */
  // P360: 失敗カタログの回避指示を生成文脈へ接続する（事後走査だけでなく生成時に回避させる）
  const failureAvoidanceBlock=failureCatalogService.formatRulesForPrompt({
    userPrompt:[run.objective,...this.strings(run.payload.requestedChanges)].filter(Boolean).join(' / '),
    language:'typescript',
  });

  const learningGuidance=[
    failureAvoidanceBlock,
    learningContext.acceptedPatterns.length>0
      ? `Accepted patterns: ${learningContext.acceptedPatterns.map(item=>item.acceptedApproach).join(' | ')}`
      : '',
    learningContext.rejectedFailurePatterns.length>0
      ? `Rejected approaches: ${learningContext.rejectedFailurePatterns.map(item=>`${item.rejectedApproach} -> ${item.preferredAlternative}`).join(' | ')}`
      : '',
    learningContext.correctionPairs.length>0
      ? `Correction requirements: ${learningContext.correctionPairs.flatMap(item=>item.externalRequestedChanges).join(' | ')}`
      : '',
    learningContext.unresolvedConflicts.length>0
      ? `Unresolved learning conflicts must not be treated as instructions: ${learningContext.unresolvedConflicts.join(' | ')}`
      : '',
  ].filter(Boolean).join('\\n');

  /*
   * Candidate -> Review Package -> REVALIDATION の系譜を
   * 既存CandidateGenerationOutcomeへ保持する。
   */
  const learningLineage={
    sourcePackageId:
      typeof run.payload.sourcePackageId==='string'
        ? run.payload.sourcePackageId
        : typeof run.payload.packageId==='string'
          ? run.payload.packageId
          : undefined,
    externalReviewId:
      typeof run.payload.externalReviewId==='string'
        ? run.payload.externalReviewId
        : undefined,
    candidateRevision:Number(run.payload.candidateRevision||1),
    requestedChanges:[...new Set(this.strings(run.payload.requestedChanges))],
    userReason:
      typeof run.payload.userReason==='string'
        ? run.payload.userReason
        : undefined,
    usedLearningArtifactIds:[...learningContext.usedLearningArtifactIds],
    ignoredLearningArtifactIds:[...learningContext.ignoredArtifactIds],
    appliedFailurePatternIds:[...learningContext.appliedFailurePatternIds],
    appliedCorrectionPairIds:[...learningContext.appliedCorrectionPairIds],
    appliedComponentPatternIds:[...learningContext.appliedComponentPatternIds],
    learningContextSha256:learningContext.learningContextSha256,
    componentPackId:componentPack.componentPackId,
    usedKnowledgeComponentIds:componentPack.usedKnowledgeComponentIds,
    usedCodeComponentIds:componentPack.usedCodeComponentIds,
    usedConversationComponentIds:componentPack.usedConversationComponentIds,
    excludedComponentIds:componentPack.excludedComponentIds,
    componentContextSha256:componentPack.componentContextSha256,
  };

  const compositionPrompt=[
      run.objective,
      ...(astFallbackReasons.length>0?[`AST strategy failed; continue with Component/Construction strategies: ${astFallbackReasons.join(' | ')}`]:[]),
      ...effectiveRequirements,
      ...this.strings(run.payload.requestedChanges),
      ...(knowledgeHints ? [
        'Reusable CODE KNOWLEDGE guidance:',
        knowledgeHints
      ] : []),
      ...(learningGuidance ? [
        'Review Learning guidance (guidance only; never executable CODE):',
        learningGuidance
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
      integratedGenerationPlanId:integratedPlan.planId,
      generationStrategies:integratedPlan.steps.map(step=>step.strategy),
      astFallbackReasons,
      sourceSnapshotSha256:currentSourceSnapshotSha256,
      targetFiles:targetFiles.map(file=>file.path),
      environment:'ANDROID',
      requirements:this.strings(run.payload.requirements),
      prohibitions:this.strings(run.payload.prohibitions),
      invariants:this.strings(run.payload.invariants),
      validationRequirements:this.strings(run.payload.validationRequirements),
      deliveryRequirements:this.strings(run.payload.deliveryRequirements)
    };

    /*
     * P406: componentPack の ID は Factory 側のアーティファクトID
     * （RC-CODE-…）であり、合成の正本である Component Registry の
     * ID（CC-…）ではない。そのまま渡すと合成側で常時未解決になり、
     * 検証済み部品の再利用が成立しなかった。各アーティファクトが
     * 保持する registryComponentId へ変換してから渡す。対応付けの
     * 無い部品は元のIDのまま渡し、合成側で未解決として扱わせる。
     */
    const factoryArtifacts = reusableComponentFactoryService.list();
    const reusableComponentIds = componentPack.usedCodeComponentIds.map(id => {
      const artifact = factoryArtifacts.find(item => item.componentId === id);
      return artifact?.registryComponentId || id;
    });

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
      /*
       * P433: 不足の一周・第1段。計画が作れないとき、不足の内訳から
       * 「作るべき部品の仕様」を名前・インターフェース付きで導出する。
       * 導出できない場合は仕様を作らない（捏造しない）。仕様化が
       * できない限り、作る工程には入らない。
       */
      const gapContract=this.buildGapContract(targetPaths,constructionGapRequirements);
      const unknownQuestions=unknownContext.items
        .map(item=>item.question)
        .filter(Boolean);
      const missingComponentSpecs=missingComponentSpecService.deriveMissingComponentSpecs({
        constructionGaps:constructionGapRequirements,
        unknownQuestions,
        contract:gapContract,
        targetPaths,
      });

      /*
       * P406: 不足の内訳は生成台帳の中だけにあり、計画側は理由文字列
       * 1本しか読めなかった。計画側の逃げ道（UNKNOWN/Research）が
       * 「何が不足か」を材料にできるよう、計算済みの内訳をタスクの
       * ブラックボードへも残す（台帳の記録は従来どおり）。
       *
       * P421: あわせて、不足発生時点の契約欄（対象の既存の公開面と
       * 生産者不足スロットの期待）を自己コード索引から導出して
       * 確定させる。部品供給の要求生成はこの記録済み契約を優先し、
       * パッケージ生成時点の索引からの再構成は契約が無い場合の
       * フォールバックになる。導出できなければ欄自体を持たせない。
       *
       * P433: あわせて、導出した不足部品の仕様も同じ記録に載せる。
       * 計画側・供給側は「計画が作れない」ではなく「この名前の
       * 部品が無い」として次へ進める。
       */
      if(run.taskId){
        taskBlackboardService.append(run.taskId,'OBSERVATION','selfDevelopment','candidateGenerationGap',{
          operation:'GENERATE_CANDIDATE',
          runId,
          reason:'CODE_COMPOSITION_PLAN_UNAVAILABLE',
          synthesisGapReason:synthesisPlan.source.gapReason||'',
          blockedReason:synthesisPlan.blockedReason||'',
          constructionGaps:constructionGapRequirements,
          unknownQuestions,
          targetPaths,
          missingComponentSpecs,
          ...(gapContract?{contract:gapContract}:{}),
        },[]);
      }

      /*
       * P433: 不足の一周・第2段。仕様が導出できた不足部品について、
       * 組み立ての工程内で作る。材料は明示的なものだけ（研究の
       * codeExamplesのうち未使用のもの、または検証済み部品からの
       * つなぎ）。研究の文章からコードを推測しない。できた案は
       * 教師の供給物と同じ扱いでCANDIDATEとして登録し、このrunの
       * compositionの材料にはしない。検証は既存の梯子
       * （VALIDATE_CANDIDATE → Regression → Canary → VERIFIED）が
       * 駆動する。作れなければ従来どおりResearch／教師供給へ回す。
       */
      const specCreatedIds=this.buildMissingComponentCandidates({
        objective:run.objective,
        specs:missingComponentSpecs,
        materials:unknownContext.implementationMaterials,
        targetFiles,
        targetPaths,
        validationRequirements:effectiveValidationRequirements,
        usedContents:[
          ...researchedCandidates.map(candidate=>candidate.candidateContent),
          ...suppliedCandidates.map(candidate=>candidate.candidateContent),
        ],
      });
      createdCodeComponentIds.push(...specCreatedIds);

      const reason=specCreatedIds.length>0
        ? 'MISSING_COMPONENT_CANDIDATE_CREATED_AWAITING_VERIFICATION'
        : createdCodeComponentIds.length>0
          ? 'NEW_CODE_COMPONENT_CANDIDATE_CREATED_AWAITING_VERIFICATION'
          : 'CODE_COMPOSITION_PLAN_UNAVAILABLE';

      this.record(runId,{
        attemptCount:1,
        status:'BLOCKED',
        reason,
        createdCodeComponentIds,
        missingComponentSpecs,
        unknownContext,
        responseHash:canonicalSha256(JSON.stringify({
          runId,
          reason,
          componentIds,
          createdCodeComponentIds,
          missingComponentSpecs,
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
        reason:('reason' in materialized ? materialized.reason : 'MATERIALIZATION_FAILED'),
        responseHash:canonicalSha256(JSON.stringify({
          runId,componentIds,reason:('reason' in materialized ? materialized.reason : 'MATERIALIZATION_FAILED')
        }))
      });
      return {
        accepted:false,
        runId,
        files:[],
        reasons:[('reason' in materialized ? materialized.reason : 'MATERIALIZATION_FAILED')],
        attemptCount:1
      };
    }

    const prepared=await autonomousCandidatePreparationService.prepareForRun(
      runId,
      materialized.files,
      sourceOverride
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

    const duplicates=this.findDuplicateExports(materialized.files);
    if(duplicates.length>0){
      const reason=duplicates[0];
      this.record(runId,{
        attemptCount:1,
        status:'BLOCKED',
        reason,
        responseHash:canonicalSha256(JSON.stringify({
          runId,duplicates
        }))
      });
      return {accepted:false,runId,files:[],reasons:duplicates,attemptCount:1};
    }

    return {
      accepted:true,
      runId,
      workspaceId:prepared.workspaceId,
      files:materialized.files,
      reasons:[],
      attemptCount:1,
      learningLineage
    };

 }
 private findDuplicateExports(files:CandidateGenerationFile[]):string[]{
  const snapshot=selfCodeUnderstandingService.getSnapshot();
  if(!snapshot){systemLogger.warn('SELF_IMPROVEMENT','[重複検知] 理解索引が無いため重複チェックをスキップしました（無効化を無言にしない）');return [];}
  const manifestCommit=selfCodeSpaceService.getLightManifest()?.commitSha;
  if(snapshot.sourceCommitSha&&manifestCommit&&snapshot.sourceCommitSha!==manifestCommit){
    systemLogger.warn('SELF_IMPROVEMENT',`[重複検知] 索引の生成元コミット (${snapshot.sourceCommitSha.slice(0,8)}) が現在のマニフェスト (${manifestCommit.slice(0,8)}) と異なります。古い索引で重複チェックを行います`);
  }
  const owners=new Map<string,string>();
  for(const entry of snapshot.entries)for(const name of entry.exports){if(!owners.has(name))owners.set(name,entry.path);}
  const duplicates:string[]=[];
  for(const file of files){
   const baseline=new Set(snapshot.entries.find(entry=>entry.path===file.path)?.exports||[]);
   for(const name of selfCodeUnderstandingService.exportsOf(file.path,file.candidateContent)){
    if(baseline.has(name))continue;
    const owner=owners.get(name);
    if(owner&&owner!==file.path)duplicates.push(`DUPLICATE_EXPORT:${name}:${owner}`);
   }
  }
  return [...new Set(duplicates)];
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
 /*
  * P421（供給3）: 不足発生時点の契約欄を導出する。
  * 対象ファイルについては自己コード索引の既存の公開面（export・
  * export 済みシグネチャ・import）を、生産者不足については
  * construction gap の NO_COMPATIBLE_PRODUCER が持つスロット名と
  * 期待入力種別を、それぞれ構造化して返す。索引に項目が無い対象や
  * 公開面が空の対象は契約に含めない（導出できないものを捏造しない）。
  * 全て空なら undefined を返し、gap 記録に contract 自体を持たせない。
  * 上限は既存の gap 項目の粒度（constructionGaps は12件まで）に
  * 合わせ、ブラックボード記録が肥大化しない範囲に抑える。
  * 索引の取得に失敗しても生成の失敗経路自体は壊さない。
  */
 /*
  * P433: 不足の一周・第2段。導出済みの不足部品の仕様ごとに、
  * 組み立ての工程内で候補を作る。仕様1件につき候補は最大1件。
  * (a) つなぎ：検証済み部品がその名前を公開している場合だけ
  * 再エクスポートする候補。(b) 未使用の明示的codeExample：
  * 研究で収集済みのcodeExamplesのうち、既に候補化されたもの
  * 以外で、仕様の対象に合うものだけ。どちらも作れなければ
  * その仕様は飛ばす（推測で補わない）。できた候補は全て
  * CANDIDATEとして登録し、compositionの材料にはしない。
  */
 private buildMissingComponentCandidates(input:{
  objective:string;
  specs:MissingComponentSpec[];
  materials: import('../../research/services/webMaterialPatternExtractor').WebImplementationMaterial[];
  targetFiles:Array<{path:string;content:string}>;
  targetPaths:string[];
  validationRequirements:string[];
  usedContents:string[];
 }):string[]{
  const createdIds:string[]=[];
  if(input.specs.length===0)return createdIds;
  const targetByPath=new Map(input.targetFiles.map(file=>[file.path,file]));
  const used=new Set(input.usedContents.map(content=>content.trim()).filter(Boolean));
  for(const spec of input.specs){
    const target=targetByPath.get(spec.targetPath);
    if(!target)continue;

    const adapter=missingComponentSpecService.buildAdapterDraft(
      spec,
      target.content,
      input.validationRequirements,
    );
    if(adapter){
      const created=reusableComponentFactoryService.createCodeComponentCandidate({
        purpose:`${spec.name}: ${input.objective}`,
        implementation:adapter.implementation,
        targetPath:spec.targetPath,
        tests:adapter.tests,
        validation:adapter.validation,
        componentType:'MISSING_COMPONENT_ADAPTER_CANDIDATE',
        dependencies:[adapter.sourceComponentId],
        supportedEnvironments:['ANDROID'],
        entryPoint:spec.targetPath,
        sourceEpisodeIds:[],
      });
      if(created.accepted&&created.componentId){
        createdIds.push(created.componentId);
        continue;
      }
    }

    for(const material of input.materials){
      let createdForSpec=false;
      for(const example of material.codeExamples){
        const code=example.code.trim();
        if(!code||used.has(code))continue;
        const explicitPath=example.targetPath&&input.targetPaths.includes(example.targetPath)
          ? example.targetPath
          : undefined;
        const path=explicitPath||(
          input.targetPaths.length===1 &&
          this.codeLanguageMatchesTarget(example.language,input.targetPaths[0])
            ? input.targetPaths[0]
            : ''
        );
        if(path!==spec.targetPath)continue;
        const tests=material.testClues.length>0
          ? material.testClues.join('\n')
          : `Validate implementation for ${path} against missing-component spec ${spec.name}.`;
        const validation=[
          `MISSING_COMPONENT_SPEC=${spec.name}`,
          ...(spec.expectedBehavior?[`EXPECTED_BEHAVIOR=${spec.expectedBehavior}`]:[]),
          ...input.validationRequirements,
        ].join('\n');
        const created=reusableComponentFactoryService.createCodeComponentCandidate({
          purpose:`${spec.name}: ${input.objective}`,
          implementation:code,
          targetPath:path,
          tests,
          validation,
          componentType:'MISSING_COMPONENT_SPEC_CANDIDATE',
          dependencies:material.dependencies,
          supportedEnvironments:['ANDROID'],
          entryPoint:path,
          sourceEpisodeIds:[material.sourceId],
        });
        if(created.accepted&&created.componentId){
          createdIds.push(created.componentId);
          used.add(code);
          createdForSpec=true;
        }
        break;
      }
      if(createdForSpec)break;
    }
  }
  return createdIds;
 }

 private buildGapContract(targetPaths:string[],constructionGapRequirements:string[]):CandidateGenerationGapContract|undefined{
  const truncate=(value:string,max:number):string=>value.length>max?value.slice(0,max):value;
  const targets:CandidateGenerationGapContractTarget[]=[];
  try{
    let snapshot=selfCodeUnderstandingService.getSnapshot();
    const coversTargets=(snap:typeof snapshot):boolean=>Boolean(snap?.entries.some(entry=>targetPaths.includes(entry.path)));
    if(!coversTargets(snapshot)){
      selfCodeUnderstandingService.ensure(targetPaths,selfCodeSpaceService.listSourceFiles());
      snapshot=selfCodeUnderstandingService.getSnapshot();
    }
    const entriesByPath=new Map((snapshot?.entries??[]).map(entry=>[entry.path,entry]));
    for(const path of targetPaths.slice(0,8)){
      const entry=entriesByPath.get(path);
      if(!entry)continue;
      const signatures:CandidateGenerationGapContractSignature[]=entry.symbols
        .filter(symbol=>symbol.exported)
        .slice(0,16)
        .map(symbol=>({
          name:symbol.name,
          kind:symbol.kind,
          parameters:(symbol.parameters??[]).slice(0,8).map(parameter=>truncate(String(parameter),120)),
          ...(symbol.returnType?{returnType:truncate(symbol.returnType,120)}:{}),
        }));
      const exportsList=entry.exports.slice(0,32);
      if(exportsList.length===0&&signatures.length===0)continue;
      targets.push({path,exports:exportsList,signatures,imports:entry.imports.slice(0,32)});
    }
  }catch{
    // 索引が使えない場合は対象の契約を付けない（理由は呼び出し側の
    // gap 記録そのものに既にある。ここで例外にして生成を壊さない）。
  }
  const missingSlots:CandidateGenerationGapContract['missingSlots']=[];
  const missingComponentIds:string[]=[];
  for(const raw of constructionGapRequirements){
    const body=raw.startsWith('CONSTRUCTION_GAP:')?raw.slice('CONSTRUCTION_GAP:'.length):raw;
    if(body.startsWith('NO_COMPATIBLE_PRODUCER:')){
      const rest=body.slice('NO_COMPATIBLE_PRODUCER:'.length);
      const first=rest.indexOf(':');
      const second=first>=0?rest.indexOf(':',first+1):-1;
      if(first<=0||second<0)continue;
      const knowledgeId=rest.slice(0,first);
      const slotName=rest.slice(first+1,second);
      const inputKinds=rest.slice(second+1).split('|').map(value=>truncate(value.trim(),80)).filter(Boolean).slice(0,8);
      if(knowledgeId&&slotName&&!missingSlots.some(slot=>slot.knowledgeId===knowledgeId&&slot.slotName===slotName)){
        missingSlots.push({knowledgeId,slotName,inputKinds});
      }
      continue;
    }
    const match=body.match(/^(?:CODE_COMPONENT_MISSING|CONSTRUCTION_DEFINITION_MISSING|CODE_COMPONENT_UNLINKED):(.+)$/);
    if(match&&!missingComponentIds.includes(match[1]))missingComponentIds.push(match[1]);
  }
  const slots=missingSlots.slice(0,8);
  const componentIds=missingComponentIds.slice(0,12);
  if(targets.length===0&&slots.length===0&&componentIds.length===0)return undefined;
  return {targets,missingSlots:slots,missingComponentIds:componentIds};
 }
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
  const raw:unknown[] =
    Array.isArray(value)
      ? value
      : value &&
        typeof value==='object' &&
        Array.isArray((value as Record<string,unknown>).bindings)
        ? (value as Record<string,unknown>).bindings as unknown[]
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
          output=>slot.inputKinds.some(
          expected=>isCompatibleConstructionKind(output,expected)
        )
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

 private parseAstTransformations(value:unknown,targetPaths:string[]):Array<{path:string;operations:AstCandidateOperation[]}>{
  if(!Array.isArray(value))return [];const allowed=new Set(targetPaths);const output:Array<{path:string;operations:AstCandidateOperation[]}>=[];
  for(const row of value){
    if(!row||typeof row!=='object'||Array.isArray(row))continue;const record=row as Record<string,unknown>;const path=typeof record.path==='string'?record.path.trim():'';
    if(!allowed.has(path)||!Array.isArray(record.operations))continue;const operations:AstCandidateOperation[]=[];
    for(const raw of record.operations){
      if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;const item=raw as Record<string,unknown>;const kind=typeof item.kind==='string'?item.kind:'';
      if(kind==='ADD_IMPORT'&&typeof item.moduleSpecifier==='string'&&Array.isArray(item.namedImports))operations.push({kind,moduleSpecifier:item.moduleSpecifier,namedImports:item.namedImports.filter((entry):entry is string=>typeof entry==='string')});
      if(kind==='ADD_INTERFACE_FIELD'&&typeof item.interfaceName==='string'&&typeof item.fieldName==='string'&&typeof item.fieldType==='string')operations.push({kind,interfaceName:item.interfaceName,fieldName:item.fieldName,fieldType:item.fieldType,optional:item.optional===true});
      if(kind==='ADD_PARAMETER'&&typeof item.functionName==='string'&&typeof item.parameterName==='string'&&typeof item.parameterType==='string')operations.push({kind,functionName:item.functionName,parameterName:item.parameterName,parameterType:item.parameterType,optional:item.optional===true});
      if(kind==='ADD_OBJECT_PROPERTY'&&typeof item.variableName==='string'&&typeof item.propertyName==='string'&&typeof item.expression==='string')operations.push({kind,variableName:item.variableName,propertyName:item.propertyName,expression:item.expression});
      if(kind==='ADD_VALIDATION_GUARD'&&typeof item.functionName==='string'&&typeof item.condition==='string'&&typeof item.failureStatement==='string')operations.push({kind,functionName:item.functionName,condition:item.condition,failureStatement:item.failureStatement});
      if(kind==='ADD_CALL_ARGUMENT'&&typeof item.calleeName==='string'&&typeof item.argumentExpression==='string')operations.push({kind,calleeName:item.calleeName,argumentExpression:item.argumentExpression});
    }
    if(operations.length>0)output.push({path,operations});
  }
  return output;
 }
 private strings(value:unknown):string[]{return Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):[];}
}
export const candidateCodeGenerationService=new CandidateCodeGenerationService();
