import { storageService } from '../../../services/storageService';
import { canonicalSha256Object } from './canonicalSha256Service';
import { reviewLearningArtifactService, type ReviewLearningArtifact } from './reviewLearningArtifactService';
import type { ReviewLearningEpisode } from './reviewDecisionLearningService';
import { verifierService } from '../../verification/services/verifierService';
import { componentRegistryService } from '../../../services/componentRegistryService';
import { commonCodeKnowledge, additionalCommonCodeKnowledge, type CodeConstructionProfile, type CodeComponentDefinition, type CodeConstructionBinding, type CodeConstructionGraph, type CodeConstructionNode } from '../data/codeKnowledge/common';
import { javascriptCodeKnowledge, additionalJavascriptCodeKnowledge, additionalJavascriptCodeComponents } from '../data/codeKnowledge/javascript';
import { typescriptCodeKnowledge, additionalTypescriptCodeKnowledge, additionalTypescriptCodeComponents } from '../data/codeKnowledge/typescript';
import { webCodeKnowledge, additionalWebCodeKnowledge, additionalWebCodeComponents } from '../data/codeKnowledge/web';
import { testingCodeKnowledge, additionalTestingCodeKnowledge, additionalTestingCodeComponents } from '../data/codeKnowledge/testing';
import {
  moduleCodeKnowledge,
  additionalModuleCodeKnowledge,
  additionalModuleCodeComponents,
} from '../data/codeKnowledge/modules';
import {
  autonomousConstructionKnowledge,
  additionalAutonomousConstructionComponents,
} from '../data/codeKnowledge/autonomousConstruction';
export type ReusableComponentKind='KNOWLEDGE'|'CODE'|'CONVERSATION';
export type ReusableComponentLifecycle='DRAFT'|'CANDIDATE'|'VERIFIED'|'USER_APPROVED'|'MIKI_APPROVED'|'ACTIVE'|'REVALIDATION_REQUIRED'|'CONFLICT'|'SUSPENDED'|'SUPERSEDED'|'ARCHIVED';
export type ComponentSelectionMode='REUSE_AS_IS'|'ADAPT_EXISTING'|'COMPOSE_MULTIPLE'|'CREATE_NEW'|'ESCALATE_UNKNOWN';
export interface ReusableComponentArtifact {componentId:string;registryComponentId?:string;componentKind:ReusableComponentKind;componentType:string;purpose:string;interfaceContract:Record<string,unknown>;inputs:string[];outputs:string[];prerequisites:string[];dependencies:string[];appliesWhen:string[];doesNotApplyWhen:string[];sourceEpisodeIds:string[];sourceLearningArtifactIds:string[];canonicalSha256:string;environmentFingerprint:string;lifecycleStatus:ReusableComponentLifecycle;usageCount:number;successCount:number;failureCount:number;lastUsedAt?:number;lastConfirmedAt?:number;supersededBy?:string;createdAt:number;updatedAt:number;}
export interface KnowledgeComponentArtifact extends ReusableComponentArtifact {componentKind:'KNOWLEDGE';claimIds:string[];evidenceRefs:string[];sourceUrls:string[];sourceArtifactIds:string[];verificationStatus:'UNVERIFIED'|'VERIFIED'|'CONFLICT';contradictionRefs:string[];freshnessPolicy:string;constructionProfile?:CodeConstructionProfile;}
export interface CodeComponentArtifact extends ReusableComponentArtifact {componentKind:'CODE';exports:string[];imports:string[];publicInterfaces:string[];coreIngressPoints:string[];domainOwnership:string[];persistenceKeys:string[];uiEventEntrypoints:string[];testReferences:string[];requiredValidation:string[];}
export interface ConversationComponentArtifact extends ReusableComponentArtifact {componentKind:'CONVERSATION';atomic:boolean;conversationState:string[];requiredInformation:string[];responseStructure:string[];prohibitedPatterns:string[];clarificationConditions:string[];verbosityConditions:string[];toolResultOrder:string[];}
export type AnyReusableComponent=KnowledgeComponentArtifact|CodeComponentArtifact|ConversationComponentArtifact;
export interface ComponentUsageReceipt {usageReceiptId:string;componentIds:string[];taskId:string;candidateId?:string;conversationPlanId?:string;selectionMode:ComponentSelectionMode;validationResult:'PASSED'|'FAILED'|'NOT_RUN';outcome:'SUCCEEDED'|'FAILED'|'PENDING';coreDecisionId:string;createdAt:number;receiptSha256:string;}
export interface ComponentPack {componentPackId:string;knowledgePackId:string;usedKnowledgeComponentIds:string[];usedCodeComponentIds:string[];usedConversationComponentIds:string[];adaptedComponentIds:string[];createdComponentIds:string[];excludedComponentIds:string[];exclusionReasons:Record<string,string>;environmentFingerprint:string;unresolvedComponentNeeds:string[];componentContextSha256:string;packSha256:string;}
interface ConstructionSearchState { nodes:Set<string>; bindings:CodeConstructionBinding[]; score:number; externalBindings:number; }
interface ConstructionGraphPlan { nodeIds:string[]; bindings:CodeConstructionBinding[]; rootNodeId?:string; score:number; unresolved:string[]; }

const COMPONENT_KEY='miki_reusable_component_repository_v1';const RECEIPT_KEY='miki_component_usage_receipts_v1';

const CONSTRUCTION_KNOWLEDGE_ID_ALIASES:Record<string,string>={
  'code.javascript.node-readdir':'code.node.fs-readdir',
  'code.javascript.node-stat':'code.node.fs-stat',
  'code.javascript.node-rename':'code.node.fs-rename',
  'code.javascript.node-rm':'code.node.fs-rm',
  'code.javascript.node-path-resolve':'code.node.path-resolve',
  'code.javascript.node-path-dirname':'code.node.path-dirname',
  'code.javascript.node-path-basename':'code.node.path-basename',
  'code.javascript.node-path-extname':'code.node.path-extname',
  'code.common.variables':'code.javascript.const-declaration',
  'code.common.functions':'code.javascript.function-declaration',
  'code.typescript.interfaces':'code.typescript.interface',
  'code.typescript.type-guards':'code.typescript.type-guard-component',
};
class ReusableComponentFactoryService{
  constructor(){
    this.seedBuiltInCodeKnowledge();
    this.seedBuiltInCodeComponents();
  }


  private seedBuiltInCodeComponents(): void {
    const definitions: CodeComponentDefinition[] = [
      ...additionalJavascriptCodeComponents,
      ...additionalTypescriptCodeComponents,
      ...additionalWebCodeComponents,
      ...additionalTestingCodeComponents,
      ...additionalModuleCodeComponents,
      ...additionalAutonomousConstructionComponents,
      ...additionalConstructionBridgeCodeComponents,
    ];

    for (const definition of definitions) {
      const existing = this.list().some(item =>
        item.componentKind === 'CODE' &&
        item.appliesWhen.includes(definition.knowledgeId)
      );

      if (existing) continue;

      this.createCodeComponentCandidate({
        purpose: definition.purpose,
        implementation: definition.implementation,
        targetPath: definition.targetPath,
        tests: definition.tests,
        validation: definition.validation,
        componentType: definition.componentType,
        inputs: definition.inputs,
        outputs: definition.outputs,
        prerequisites: definition.prerequisites,
        dependencies: definition.dependencies,
        supportedEnvironments: definition.supportedEnvironments,
        entryPoint: definition.entryPoint,
        securityClass: definition.securityClass,
        exports: definition.exports,
        imports: definition.imports,
        publicInterfaces: definition.publicInterfaces,
        knowledgeComponentId: definition.knowledgeId,
      });
    }
  }

  private seedBuiltInCodeKnowledge():void{
    const seeds=[
      ...commonCodeKnowledge,
      ...additionalCommonCodeKnowledge,
      ...javascriptCodeKnowledge,
      ...additionalJavascriptCodeKnowledge,
      ...typescriptCodeKnowledge,
      ...additionalTypescriptCodeKnowledge,
      ...webCodeKnowledge,
      ...additionalWebCodeKnowledge,
      ...testingCodeKnowledge,
      ...additionalTestingCodeKnowledge,
      ...moduleCodeKnowledge,
      ...additionalModuleCodeKnowledge,
      ...autonomousConstructionKnowledge,
    ];

    const existing=this.list();
    const now=Date.now();

    const components=seeds
      .filter(seed=>!existing.some(item =>
        item.componentKind==='KNOWLEDGE' &&
        item.appliesWhen.includes(seed.id)
      ))
      .map(seed=>this.identify({
        componentKind:'KNOWLEDGE' as const,
        componentType:seed.componentType,
        purpose:seed.purpose,
        interfaceContract:{
          input:seed.inputs,
          output:seed.outputs,
        },
        inputs:seed.inputs,
        outputs:seed.outputs,
        prerequisites:[],
        dependencies:[],
        appliesWhen:[seed.id,...seed.appliesWhen],
        doesNotApplyWhen:seed.doesNotApplyWhen,
        sourceEpisodeIds:[],
        sourceLearningArtifactIds:[],
        environmentFingerprint:'universal',
        lifecycleStatus:'USER_APPROVED' as const,
        usageCount:0,
        successCount:0,
        failureCount:0,
        createdAt:now,
        updatedAt:now,
        claimIds:[],
        evidenceRefs:[],
        sourceUrls:seed.sourceUrls,
        sourceArtifactIds:seed.sourceArtifactIds,
        constructionProfile:seed.constructionProfile,
        verificationStatus:'UNVERIFIED' as const,
        contradictionRefs:[],
        freshnessPolicy:'REVALIDATE_ON_SOURCE_CHANGE',
      }));

    if(components.length>0){
      this.storeCandidates(components);
    }
  }


 extract(artifact:ReviewLearningArtifact,episode:ReviewLearningEpisode,environmentFingerprint='unknown'):AnyReusableComponent[]{const components:AnyReusableComponent[]=[];const common={purpose:this.purpose(artifact),interfaceContract:{input:'task context',output:'bounded reusable guidance'},inputs:['task context'],outputs:['reusable guidance'],prerequisites:[],dependencies:[],appliesWhen:this.appliesWhen(artifact),doesNotApplyWhen:this.doesNotApplyWhen(artifact),sourceEpisodeIds:[episode.episodeId],sourceLearningArtifactIds:[artifact.artifactId],environmentFingerprint,lifecycleStatus:'CANDIDATE' as const,usageCount:0,successCount:0,failureCount:0,createdAt:Date.now(),updatedAt:Date.now()};
  const knowledgeBody={...common,componentKind:'KNOWLEDGE' as const,componentType:artifact.artifactType==='FAILURE_PATTERN'?'FAILURE_KNOWLEDGE':artifact.artifactType==='CORRECTION_PAIR'?'PROCEDURE':artifact.artifactType==='ACCEPTED_PATTERN'?'RULE':'UNKNOWN_BOUNDARY',claimIds:[],evidenceRefs:[episode.rawResponseSha256],sourceUrls:[],sourceArtifactIds:[artifact.artifactId],verificationStatus:'UNVERIFIED' as const,contradictionRefs:[],freshnessPolicy:'REVALIDATE_ON_ENVIRONMENT_CHANGE'};components.push(this.identify(knowledgeBody) as KnowledgeComponentArtifact);
  if(artifact.artifactType==='ACCEPTED_PATTERN'||artifact.artifactType==='CORRECTION_PAIR'){const codeBody={...common,componentKind:'CODE' as const,componentType:artifact.artifactType==='ACCEPTED_PATTERN'?'SERVICE_SKELETON':'MIGRATION_STEP',interfaceContract:{input:'repository map and target contract',output:'isolated candidate bundle'},outputs:['isolated candidate bundle'],exports:[],imports:[],publicInterfaces:[],coreIngressPoints:[],domainOwnership:['selfDevelopment'],persistenceKeys:[],uiEventEntrypoints:[],testReferences:[],requiredValidation:['interface consistency','domain contract','core ingress','tests']};components.push(this.identify(codeBody) as CodeComponentArtifact);}
  const conversationBody={...common,componentKind:'CONVERSATION' as const,componentType:artifact.artifactType==='FAILURE_PATTERN'?'CORRECTION_PATTERN':artifact.artifactType==='HOLD_CONDITION'?'CLARIFICATION_PATTERN':'DIRECT_ANSWER_PATTERN',interfaceContract:{input:'conversation state',output:'response composition fragment'},inputs:['conversation state'],outputs:['response composition fragment'],atomic:true,conversationState:['task response'],requiredInformation:[],responseStructure:['conclusion','basis','next action'],prohibitedPatterns:[],clarificationConditions:artifact.artifactType==='HOLD_CONDITION'?['insufficient evidence']:[],verbosityConditions:['follow user preference'],toolResultOrder:['result','validation','limitations']};components.push(this.identify(conversationBody) as ConversationComponentArtifact);return components;}
 integrateResearchKnowledge(input:{purpose:string;claimIds?:string[];evidenceRefs?:string[];sourceUrls?:string[];sourceArtifactIds?:string[];environmentFingerprint?:string;contradictionRefs?:string[];verificationStatus?:KnowledgeComponentArtifact['verificationStatus']}):{component:KnowledgeComponentArtifact;created:boolean;updated:boolean}{
  const claimIds=[...new Set(input.claimIds||[])];
  const evidenceRefs=[...new Set(input.evidenceRefs||[])];
  const sourceUrls=[...new Set(input.sourceUrls||[])];
  const sourceArtifactIds=[...new Set(input.sourceArtifactIds||[])];
  const contradictionRefs=[...new Set(input.contradictionRefs||[])];
  const items=this.list();
  const existing=items.find(item=>
    item.componentKind==='KNOWLEDGE'&&
    item.purpose===input.purpose&&
    (input.environmentFingerprint===undefined||
      item.environmentFingerprint==='unknown'||
      item.environmentFingerprint===input.environmentFingerprint)
  );

  if(existing){
    existing.claimIds=[...new Set([...existing.claimIds,...claimIds])];
    existing.evidenceRefs=[...new Set([...existing.evidenceRefs,...evidenceRefs])];
    existing.sourceUrls=[...new Set([...existing.sourceUrls,...sourceUrls])];
    existing.sourceArtifactIds=[...new Set([...existing.sourceArtifactIds,...sourceArtifactIds])];
    existing.contradictionRefs=[...new Set([...existing.contradictionRefs,...contradictionRefs])];
    if(input.environmentFingerprint) existing.environmentFingerprint=input.environmentFingerprint;
    if(existing.contradictionRefs.length>0){
      existing.lifecycleStatus='CONFLICT';
      existing.verificationStatus='CONFLICT';
    }else if(input.verificationStatus){
      existing.verificationStatus=input.verificationStatus;
    }
    existing.updatedAt=Date.now();
    storageService.setItem(COMPONENT_KEY,JSON.stringify(items));
    return {component:existing,created:false,updated:true};
  }

  const now=Date.now();
  const body={
    purpose:input.purpose,
    interfaceContract:{input:'research evidence',output:'reusable knowledge'},
    inputs:['research evidence'],
    outputs:['reusable knowledge'],
    prerequisites:[],
    dependencies:[],
    appliesWhen:[input.purpose],
    doesNotApplyWhen:[],
    sourceEpisodeIds:[],
    sourceLearningArtifactIds:[],
    environmentFingerprint:input.environmentFingerprint||'unknown',
    lifecycleStatus:'CANDIDATE' as const,
    usageCount:0,
    successCount:0,
    failureCount:0,
    createdAt:now,
    updatedAt:now,
    componentKind:'KNOWLEDGE' as const,
    componentType:'RESEARCH_KNOWLEDGE',
    claimIds,
    evidenceRefs,
    sourceUrls,
    sourceArtifactIds,
    verificationStatus:contradictionRefs.length>0?'CONFLICT':input.verificationStatus||'UNVERIFIED',
    contradictionRefs,
    freshnessPolicy:'REVALIDATE_ON_ENVIRONMENT_CHANGE'
  };
  const component=this.identify(body) as KnowledgeComponentArtifact;
  this.storeCandidates([component]);
  return {component,created:true,updated:false};
 }
 verifyResearchKnowledge(componentId:string,claimIds:string[],options?:{requireFresh?:boolean;maxAgeDays?:number}):{component:KnowledgeComponentArtifact|undefined;verified:boolean;conflicted:boolean;verificationIds:string[];reasons:string[]}{
  const item=this.list().find(x=>x.componentId===componentId);
  if(!item||item.componentKind!=='KNOWLEDGE'){
    return {component:undefined,verified:false,conflicted:false,verificationIds:[],reasons:['KNOWLEDGE_COMPONENT_NOT_FOUND']};
  }

  const ids=[...new Set(claimIds.filter(Boolean))];
  if(ids.length===0){
    return {component:item,verified:false,conflicted:false,verificationIds:[],reasons:['NO_CLAIMS_TO_VERIFY']};
  }

  const results=verifierService.verifyMany({
    claimIds:ids,
    requireFresh:options?.requireFresh,
    maxAgeDays:options?.maxAgeDays,
  });

  const verificationIds=results.map(result=>result.claimId);
  const reasons=results.flatMap(result=>result.reasons);
  const conflicted=results.some(result=>result.outcome==='CONTRADICTED');
  const verified=results.length===ids.length&&
    results.every(result=>result.promoted&&
      (result.outcome==='SUPPORTED'||result.outcome==='DEVICE_VERIFIED'));

  item.contradictionRefs=[
    ...new Set([
      ...item.contradictionRefs,
      ...results.filter(result=>result.outcome==='CONTRADICTED').map(result=>result.claimId),
    ])
  ];

  if(conflicted){
    item.verificationStatus='CONFLICT';
    item.lifecycleStatus='CONFLICT';
  }else if(verified){
    item.verificationStatus='VERIFIED';
    if(['CANDIDATE','VERIFIED'].includes(item.lifecycleStatus)){
      item.lifecycleStatus='VERIFIED';
    }
    item.lastConfirmedAt=Date.now();
  }else{
    item.verificationStatus='UNVERIFIED';
  }

  item.updatedAt=Date.now();
  storageService.setItem(COMPONENT_KEY,JSON.stringify(this.list()));

  return {component:item,verified,conflicted,verificationIds,reasons};
 }
 createCodeComponentCandidate(input:{
  purpose:string;
  implementation:string;
  targetPath:string;
  tests:string;
  validation:string;
  componentType?:string;
  inputs?:string[];
  outputs?:string[];
  prerequisites?:string[];
  dependencies?:string[];
  supportedEnvironments?:string[];
  entryPoint?:string;
  securityClass?:ComponentSecurityClass;
  exports?:string[];
  imports?:string[];
  publicInterfaces?:string[];
  knowledgeComponentId?:string;
  coreIngressPoints?:string[];
  domainOwnership?:string[];
  persistenceKeys?:string[];
  uiEventEntrypoints?:string[];
  sourceEpisodeIds?:string[];
  sourceLearningArtifactIds?:string[];
}):{
  accepted:boolean;
  componentId?:string;
  decision?:string;
  reason?:string;
  component?:AnyReusableComponent;
}{
  const implementation=input.implementation.trim();
  const targetPath=input.targetPath.trim();
  const tests=input.tests.trim();
  const validation=input.validation.trim();

  if(!input.purpose.trim())return {accepted:false,reason:'CODE_COMPONENT_PURPOSE_MISSING'};
  if(!implementation)return {accepted:false,reason:'CODE_COMPONENT_IMPLEMENTATION_MISSING'};
  if(!targetPath)return {accepted:false,reason:'CODE_COMPONENT_TARGET_PATH_MISSING'};
  if(!tests)return {accepted:false,reason:'CODE_COMPONENT_TESTS_MISSING'};
  if(!validation)return {accepted:false,reason:'CODE_COMPONENT_VALIDATION_MISSING'};

  const decision=componentRegistryService.evaluateNewComponentCandidate({
    purpose:input.purpose.trim(),
    implementationCode:implementation,
    entryPoint:input.entryPoint||targetPath,
    securityClass:input.securityClass||('STANDARD' as ComponentSecurityClass),
  });

  if(decision.decision!=='NEW'){
    return {
      accepted:false,
      decision:decision.decision,
      reason:decision.reason,
    };
  }

  const now=Date.now();
  const implementationTxt=[
    `TARGET_PATH: ${targetPath}`,
    'FILE_CONTENT_BEGIN',
    implementation,
    'FILE_CONTENT_END',
  ].join('\\n');

  const implementationHash=(() => {
    let hash=0;
    const clean=implementation.trim();
    for(let i=0;i<clean.length;i++){
      const char=clean.charCodeAt(i);
      hash=((hash<<5)-hash)+char;
      hash|=0;
    }
    return `h_${Math.abs(hash).toString(16).padStart(8,'0')}`;
  })();

  const base={
    component_id:`CC-${implementationHash}-${now.toString(36)}`,
    version:'1.0.0',
    status:'CANDIDATE',
    purpose:input.purpose.trim(),
    inputs:input.inputs||[],
    outputs:input.outputs||[],
    preconditions:input.prerequisites||[],
    postconditions:[],
    side_effects:[],
    dependencies:input.dependencies||[],
    supported_environments:input.supportedEnvironments||['ANDROID'],
    entry_point:input.entryPoint||targetPath,
    failure_behavior:'RETURN_BLOCKED_RESULT',
    security_class:input.securityClass||('STANDARD' as ComponentSecurityClass),
    idempotent:false,
    deterministic:true,
    component_txt:[
      `PURPOSE: ${input.purpose.trim()}`,
      `TARGET_PATH: ${targetPath}`,
      `ENTRY_POINT: ${input.entryPoint||targetPath}`,
      'STATUS: CANDIDATE',
    ].join('\\n'),
    implementation_txt:implementationTxt,
    tests_txt:tests,
    validation_txt:validation,
    implementation_hash:implementationHash,
    validation_hash:'',
    test_count:1,
    validation_count:1,
    created_at:now,
    updated_at:now,
    source_episode_ids:input.sourceEpisodeIds||[],
    source_learning_artifact_ids:input.sourceLearningArtifactIds||[],
  };

  const componentPackage={
    ...base,
    componentType:input.componentType||'RESEARCHED_CODE_COMPONENT',
    exports:input.exports||[],
    imports:input.imports||[],
    publicInterfaces:input.publicInterfaces||[],
    coreIngressPoints:input.coreIngressPoints||[],
    domainOwnership:input.domainOwnership||['selfDevelopment'],
    persistenceKeys:input.persistenceKeys||[],
    uiEventEntrypoints:input.uiEventEntrypoints||[],
  } as ComponentTxtPackage;

  componentRegistryService.registerComponent(componentPackage);

  const registered=componentRegistryService.getComponent(componentPackage.component_id);
  if(!registered){
    return {
      accepted:false,
      decision:'PERSISTENCE_FAILED',
      reason:'CODE_COMPONENT_REGISTRY_PERSISTENCE_FAILED',
    };
  }

  const common={
    purpose:input.purpose.trim(),
    interfaceContract:{
      input:input.inputs||['task context'],
      output:input.outputs||['candidate implementation'],
    },
    inputs:input.inputs||[],
    outputs:input.outputs||[],
    prerequisites:input.prerequisites||[],
    dependencies:input.dependencies||[],
    appliesWhen:[...(input.knowledgeComponentId ? [input.knowledgeComponentId] : []), input.purpose.trim()],
    doesNotApplyWhen:[],
    sourceEpisodeIds:input.sourceEpisodeIds||[],
    sourceLearningArtifactIds:input.sourceLearningArtifactIds||[],
    environmentFingerprint:(input.supportedEnvironments||['ANDROID']).join(','),
    lifecycleStatus:'CANDIDATE' as const,
    usageCount:0,
    successCount:0,
    failureCount:0,
    createdAt:now,
    updatedAt:now,
  };

  const artifact=this.identify({
    ...common,
    componentKind:'CODE' as const,
    componentType:input.componentType||'RESEARCHED_CODE_COMPONENT',
    exports:input.exports||[],
    imports:input.imports||[],
    publicInterfaces:input.publicInterfaces||[],
    coreIngressPoints:input.coreIngressPoints||[],
    domainOwnership:input.domainOwnership||['selfDevelopment'],
    persistenceKeys:input.persistenceKeys||[],
    uiEventEntrypoints:input.uiEventEntrypoints||[],
    testReferences:[targetPath],
    requiredValidation:['tests','validation','registry lifecycle','implementation hash'],
    registryComponentId:componentPackage.component_id,
  }) as CodeComponentArtifact;

  this.storeCandidates([artifact]);

  return {
    accepted:true,
    componentId:componentPackage.component_id,
    decision:'NEW',
    component:artifact,
  };
 }

 storeCandidates(items:AnyReusableComponent[]):{componentIds:string[];persistenceReceiptId:string;reloaded:boolean}{const existing=this.list();const merged=[...items,...existing.filter(item=>!items.some(next=>next.canonicalSha256===item.canonicalSha256))].slice(0,1000);storageService.setItem(COMPONENT_KEY,JSON.stringify(merged));const loaded=this.list();const reloaded=items.every(item=>loaded.some(saved=>saved.componentId===item.componentId&&saved.canonicalSha256===item.canonicalSha256));if(!reloaded)throw new Error('COMPONENT_REPOSITORY_PERSISTENCE_FAILED');return {componentIds:items.map(x=>x.componentId),persistenceReceiptId:`CPR-${canonicalSha256Object({ids:items.map(x=>x.componentId),at:Date.now()}).slice(0,20)}`,reloaded};}
 retrieve(input:{purpose:string;environmentFingerprint:string;kinds?:ReusableComponentKind[]}):{candidates:AnyReusableComponent[];excludedComponentIds:string[];exclusionReasons:Record<string,string>}{const words=this.words(input.purpose);const excludedComponentIds:string[]=[];const exclusionReasons:Record<string,string>={};const candidates=this.list().filter(item=>{if(input.kinds&&!input.kinds.includes(item.componentKind)){excludedComponentIds.push(item.componentId);exclusionReasons[item.componentId]='KIND_NOT_SELECTED';return false;}if(!['MIKI_APPROVED','ACTIVE','USER_APPROVED'].includes(item.lifecycleStatus)){excludedComponentIds.push(item.componentId);exclusionReasons[item.componentId]='NOT_MIKI_APPROVED';return false;}if(item.environmentFingerprint!=='unknown'&&item.environmentFingerprint!=='universal'&&item.environmentFingerprint!==input.environmentFingerprint){excludedComponentIds.push(item.componentId);exclusionReasons[item.componentId]='ENVIRONMENT_REVALIDATION_REQUIRED';return false;}const hay=this.words([item.purpose,...item.appliesWhen,item.componentType].join(' '));const matched=words.some(word=>hay.includes(word));if(!matched){excludedComponentIds.push(item.componentId);exclusionReasons[item.componentId]='PURPOSE_NOT_MATCHED';}return matched;});return {candidates,excludedComponentIds,exclusionReasons};}
 plan(input:{taskId:string;purpose:string;environmentFingerprint:string;requiredKinds?:ReusableComponentKind[]}):ComponentPack{const found=this.retrieve({purpose:input.purpose,environmentFingerprint:input.environmentFingerprint,kinds:input.requiredKinds});const knowledge=found.candidates.filter(x=>x.componentKind==='KNOWLEDGE').map(x=>x.componentId);const code=found.candidates.filter(x=>x.componentKind==='CODE').map(x=>x.componentId);const conversation=found.candidates.filter(x=>x.componentKind==='CONVERSATION').map(x=>x.componentId);const unresolved=(input.requiredKinds||[]).filter(kind=>!found.candidates.some(x=>x.componentKind===kind)).map(kind=>`${kind}_COMPONENT_REQUIRED`);const context={taskId:input.taskId,knowledge,code,conversation,excluded:found.excludedComponentIds,environmentFingerprint:input.environmentFingerprint,unresolved};const componentContextSha256=canonicalSha256Object(context);return {componentPackId:`CPACK-${componentContextSha256.slice(0,20)}`,knowledgePackId:`KPACK-${canonicalSha256Object(knowledge).slice(0,20)}`,usedKnowledgeComponentIds:knowledge,usedCodeComponentIds:code,usedConversationComponentIds:conversation,adaptedComponentIds:[],createdComponentIds:[],excludedComponentIds:found.excludedComponentIds,exclusionReasons:found.exclusionReasons,environmentFingerprint:input.environmentFingerprint,unresolvedComponentNeeds:unresolved,componentContextSha256,packSha256:canonicalSha256Object({...context,componentContextSha256})};}

 buildConstructionGraph(input:{
  goal:string;
  componentIds:string[];
  preserveAllNodes?:boolean;
 }):CodeConstructionGraph{
  const selected=[...new Set(input.componentIds)]
    .map(id=>this.list().find(item=>item.componentId===id))
    .filter((item):item is KnowledgeComponentArtifact =>
      Boolean(item) &&
      item.componentKind==='KNOWLEDGE' &&
      Boolean(item.constructionProfile)
    )
    .sort((a,b)=>a.componentId.localeCompare(b.componentId));

  const definitions:CodeComponentDefinition[]=[
    ...additionalJavascriptCodeComponents,
    ...additionalTypescriptCodeComponents,
    ...additionalWebCodeComponents,
    ...additionalTestingCodeComponents,
    ...additionalModuleCodeComponents,
    ...additionalAutonomousConstructionComponents,
    ...additionalConstructionBridgeCodeComponents,
  ];

  const constructionContractErrors:string[]=[];

  const nodes:CodeConstructionNode[]=selected.map(item=>{
    const profile=item.constructionProfile as CodeConstructionProfile;
    const sourceKnowledgeId=item.appliesWhen[0];
    const canonicalKnowledgeId=
      CONSTRUCTION_KNOWLEDGE_ID_ALIASES[sourceKnowledgeId]||sourceKnowledgeId;

    const definition=definitions.find(candidate=>
      candidate.knowledgeId===canonicalKnowledgeId
    );

    if(!definition){
      constructionContractErrors.push(
        `CONSTRUCTION_DEFINITION_MISSING:${sourceKnowledgeId}`
      );
    }

    const linkedCodeComponent=definition
      ? this.list().find(component=>
        component.componentKind==='CODE' &&
        (
          component.appliesWhen.includes(definition.knowledgeId) ||
          component.appliesWhen.includes(sourceKnowledgeId)
        )
      ) as CodeComponentArtifact|undefined
      : undefined;

    if(definition&&!linkedCodeComponent){
      constructionContractErrors.push(
        `CONSTRUCTION_CODE_COMPONENT_MISSING:${sourceKnowledgeId}`
      );
    }

    const digest=canonicalSha256Object({
      componentId:item.componentId,
      codeComponentId:linkedCodeComponent?.componentId||'',
      registryComponentId:linkedCodeComponent?.registryComponentId||'',
      purpose:item.purpose,
      profile,
    });

    return {
      nodeId:'CGN-'+digest.slice(0,20),
      knowledgeComponentId:item.componentId,
      codeComponentId:linkedCodeComponent?.componentId,
      registryComponentId:linkedCodeComponent?.registryComponentId,
      implementationTemplate:definition?.implementation,
      componentType:item.componentType,
      purpose:item.purpose,
      profile,
    };
  });

  const goalScore=(node:CodeConstructionNode):number=>{
    const goal=input.goal.normalize('NFKC').toLowerCase();
    const metadata=[
      node.purpose,
      ...node.profile.constraints,
      ...(node.profile.outputKinds||[]),
      ...node.profile.slots.map(slot=>slot.name),
    ].join(' ').normalize('NFKC').toLowerCase();
    let score=0;
    for(const token of goal.match(/[a-z][a-z0-9_-]*/g)||[]){
      if(token.length>=2&&metadata.includes(token))score+=7;
    }
    const compact=goal.replace(/[^\w\u3040-\u30ff\u3400-\u9fff]+/g,'');
    const stops=new Set(['する','して','です','ます','こと','もの','その','これ','それ','ため','よう','まで','だけ','など','場合','でき','から']);
    const fragments:string[]=[];
    for(let length=6;length>=2;length-=1){
      for(let i=0;i+length<=compact.length;i+=1){
        const fragment=compact.slice(i,i+length);
        if(!/[\u3040-\u30ff\u3400-\u9fff]/.test(fragment))continue;
        if(stops.has(fragment)||!metadata.includes(fragment))continue;
        if(fragments.some(longer=>longer.includes(fragment)))continue;
        fragments.push(fragment);
      }
    }
    for(const fragment of fragments)score+=Math.min(18,fragment.length*3);
    return score;
  };

  const inferExternal=(slot:{name:string;inputKinds:string[]}):CodeConstructionBinding|undefined=>{
    const goal=input.goal.normalize('NFKC').toLowerCase();
    const has=(pattern:RegExp)=>pattern.test(goal);

    if(slot.inputKinds.includes('array-expression') &&
      (has(/配列.{0,8}から/)||has(/配列.{0,8}(入力|受け取|与え)/)||has(/array.{0,12}(from|input)/))){
      return {targetNodeId:'',slotName:slot.name,value:'inputArray',valueKind:'array-expression'};
    }
    if(slot.inputKinds.includes('object-expression') &&
      (has(/オブジェクト.{0,8}から/)||has(/object.{0,12}(from|input)/))){
      return {targetNodeId:'',slotName:slot.name,value:'inputObject',valueKind:'object-expression'};
    }
    if(slot.inputKinds.includes('string-expression') &&
      (has(/文字列.{0,8}から/)||has(/テキスト.{0,8}(入力|から)/)||has(/string.{0,12}(from|input)/))){
      return {targetNodeId:'',slotName:slot.name,value:'inputText',valueKind:'string-expression'};
    }

    const compareKind=slot.inputKinds.includes('comparison-operator')
      ? 'comparison-operator'
      : slot.inputKinds.includes('operator') ? 'operator' : undefined;
    if(compareKind){
      const op=
        has(/以上|greater than|at least/) ? '>=' :
        has(/以下|less than|at most/) ? '<=' :
        has(/超える|より大き|greater than/) ? '>' :
        has(/未満|より小さ|less than/) ? '<' :
        has(/等しい|一致|同じ|equal|equals/) ? '===' :
        undefined;
      if(op)return {targetNodeId:'',slotName:slot.name,value:op,valueKind:compareKind};
    }

    if(slot.inputKinds.includes('logical-operator')){
      const op=has(/かつ|両方|and/) ? '&&' : has(/または|どちらか|or/) ? '||' : undefined;
      if(op)return {targetNodeId:'',slotName:slot.name,value:op,valueKind:'logical-operator'};
    }

    if(slot.inputKinds.includes('module-specifier')){
      const moduleMatch=goal.match(
        /(?:from|import)\\s+["']([^"']+)["']/i
      );
      if(moduleMatch?.[1]){
        return {
          targetNodeId:'',
          slotName:slot.name,
          value:JSON.stringify(moduleMatch[1]),
          valueKind:'module-specifier',
        };
      }
    }

    if(slot.inputKinds.includes('identifier')){
      const value=
        slot.name==='error' ? 'error' :
        has(/名前|名称|\bname\b/) ? 'name' :
        has(/タイトル|\btitle\b/) ? 'title' :
        has(/パス|\bpath\b/) ? 'path' :
        has(/識別子|\bid\b/) ? 'id' :
        has(/\burl\b/) ? 'url' :
        undefined;
      if(value)return {targetNodeId:'',slotName:slot.name,value,valueKind:'identifier'};
    }

    if(slot.inputKinds.includes('type-parameter')){
      return {
        targetNodeId:'',
        slotName:slot.name,
        value:'T',
        valueKind:'type-parameter',
      };
    }

    if(slot.inputKinds.includes('parameter')){
      const value=has(/要素|各要素|\bitem\b/) ? 'item' : has(/値|\bvalue\b/) ? 'value' : undefined;
      if(value)return {targetNodeId:'',slotName:slot.name,value,valueKind:'parameter'};
    }

    if(slot.inputKinds.includes('expression')&&has(/入力|input/)){
      return {targetNodeId:'',slotName:slot.name,value:'inputValue',valueKind:'expression'};
    }
    return undefined;
  };

  const unresolved=(graphNodes:CodeConstructionNode[],bindings:CodeConstructionBinding[]):string[]=>{
    const nodeMap=new Map(graphNodes.map(node=>[node.nodeId,node]));
    const result:string[]=[];
    for(const node of graphNodes){
      for(const slot of node.profile.slots){
        const own=bindings.filter(binding=>
          binding.targetNodeId===node.nodeId&&binding.slotName===slot.name
        );
        if(slot.required&&own.length===0){
          result.push(node.nodeId+':'+slot.name);
          continue;
        }
        if(slot.multiple!==true&&own.length>1){
          result.push(node.nodeId+':'+slot.name+':MULTIPLE');
          continue;
        }
        for(const binding of own){
          if(binding.sourceNodeId){
            const source=nodeMap.get(binding.sourceNodeId);
            if(!source){
              result.push(node.nodeId+':'+slot.name+':SOURCE');
              continue;
            }
            if(!(source.profile.outputKinds||[]).some(output=>
              slot.inputKinds.some(expected=>
                isCompatibleConstructionKind(output,expected)
              )
            )){
              result.push(node.nodeId+':'+slot.name+':TYPE');
            }
          }else if(binding.value===undefined){
            result.push(node.nodeId+':'+slot.name+':VALUE');
          }else if(binding.valueKind&&!slot.inputKinds.includes(binding.valueKind)){
            result.push(node.nodeId+':'+slot.name+':VALUE_TYPE');
          }
        }
      }
    }
    return result.sort();
  };

  type SearchState=ConstructionSearchState;
  const dedupe=(states:SearchState[],limit=96):SearchState[]=>{
    const best=new Map<string,SearchState>();
    for(const state of states){
      const key=[...state.nodes].sort().join(',')+'||'+state.bindings
        .map(binding=>binding.targetNodeId+'|'+binding.slotName+'|'+(binding.sourceNodeId||'')+'|'+(binding.value||''))
        .sort().join('|');
      const old=best.get(key);
      if(!old||state.score>old.score)best.set(key,state);
    }
    return [...best.values()].sort((a,b)=>b.score-a.score).slice(0,limit);
  };

  const expand=(node:CodeConstructionNode,state:SearchState,stack:string[],depth:number):SearchState[]=>{
    if(depth>10||stack.includes(node.nodeId))return [];
    const base:SearchState={
      nodes:new Set(state.nodes),
      bindings:[...state.bindings],
      score:state.score,
      externalBindings:state.externalBindings,
    };
    if(!base.nodes.has(node.nodeId)){
      base.nodes.add(node.nodeId);
      base.score+=goalScore(node);
    }

    let states:SearchState[]=[base];
    for(const slot of node.profile.slots.filter(item=>item.required)){
      const next:SearchState[]=[];
      for(const currentState of states){
        const sources=nodes
          .filter(source=>source.nodeId!==node.nodeId&&!stack.includes(source.nodeId))
          .filter(source=>(source.profile.outputKinds||[]).some(output=>slot.inputKinds.includes(output)))
          .sort((a,b)=>{
            const scoreDiff=goalScore(b)-goalScore(a);
            return scoreDiff!==0?scoreDiff:a.nodeId.localeCompare(b.nodeId);
          })
          .slice(0,4);
        const external=inferExternal(slot);
        const options:Array<{kind:'SOURCE';node:CodeConstructionNode;score:number}|{kind:'VALUE';binding:CodeConstructionBinding;score:number}>=
          sources.map(source=>({kind:'SOURCE' as const,node:source,score:goalScore(source)}));
        if(external)options.push({
          kind:'VALUE',
          binding:{...external,targetNodeId:node.nodeId},
          score:10,
        });
        options.sort((a,b)=>{
          if(b.score!==a.score)return b.score-a.score;
          const ak=a.kind==='SOURCE'?a.node.nodeId:'VALUE:'+String(a.binding.value||'');
          const bk=b.kind==='SOURCE'?b.node.nodeId:'VALUE:'+String(b.binding.value||'');
          return ak.localeCompare(bk);
        });
        if(options.length===0)return [];
        for(const option of options.slice(0,3)){
          if(option.kind==='VALUE'){
            next.push({
              nodes:new Set(currentState.nodes),
              bindings:[...currentState.bindings,option.binding],
              score:currentState.score+option.score,
              externalBindings:currentState.externalBindings+1,
            });
          }else if(currentState.nodes.has(option.node.nodeId)){
            next.push({
              nodes:new Set(currentState.nodes),
              bindings:[...currentState.bindings,{
                targetNodeId:node.nodeId,
                slotName:slot.name,
                sourceNodeId:option.node.nodeId,
              }],
              score:currentState.score+option.score+2,
              externalBindings:currentState.externalBindings,
            });
          }else{
            const childStates=expand(option.node,currentState,[...stack,node.nodeId],depth+1);
            for(const child of childStates){
              next.push({
                nodes:new Set(child.nodes),
                bindings:[...child.bindings,{
                  targetNodeId:node.nodeId,
                  slotName:slot.name,
                  sourceNodeId:option.node.nodeId,
                }],
                score:child.score+2,
                externalBindings:child.externalBindings,
              });
            }
          }
        }
      }
      if(next.length===0)return [];
      states=dedupe(next);
    }

    return states.map(item=>({
      ...item,
      score:item.score-item.nodes.size-item.externalBindings*2,
    }));
  };

  let plan:ConstructionGraphPlan|undefined;
  if(!input.preserveAllNodes&&nodes.length>0){
    const roots=nodes
      .map(node=>({node,score:goalScore(node)}))
      .sort((a,b)=>b.score!==a.score?b.score-a.score:a.node.nodeId.localeCompare(b.node.nodeId))
      .slice(0,8);
    if(roots[0]?.score>0){
      const plans:ConstructionGraphPlan[]=[];
      for(const root of roots){
        const states=expand(root.node,{
          nodes:new Set<string>(),
          bindings:[],
          score:root.score*3,
          externalBindings:0,
        },[],0);
        for(const state of states){
          const selectedNodes=nodes.filter(node=>state.nodes.has(node.nodeId)).sort((a,b)=>a.nodeId.localeCompare(b.nodeId));
          const bindings=[...state.bindings].sort((a,b)=>{
            const ak=a.targetNodeId+'|'+a.slotName+'|'+(a.sourceNodeId||'')+'|'+(a.value||'');
            const bk=b.targetNodeId+'|'+b.slotName+'|'+(b.sourceNodeId||'')+'|'+(b.value||'');
            return ak.localeCompare(bk);
          });
          const gaps=unresolved(selectedNodes,bindings);
          plans.push({
            nodeIds:selectedNodes.map(node=>node.nodeId),
            bindings,
            rootNodeId:root.node.nodeId,
            score:state.score-gaps.length*30+(gaps.length===0?100:0),
            unresolved:gaps,
          });
        }
      }
      plan=plans.sort((a,b)=>{
        if((a.unresolved.length===0)!==(b.unresolved.length===0))return a.unresolved.length===0?-1:1;
        if(b.score!==a.score)return b.score-a.score;
        if(a.nodeIds.length!==b.nodeIds.length)return a.nodeIds.length-b.nodeIds.length;
        return (a.rootNodeId||'').localeCompare(b.rootNodeId||'');
      })[0];
    }
  }

  const plannedNodes=plan&&plan.nodeIds.length>0
    ? nodes.filter(node=>plan.nodeIds.includes(node.nodeId))
    : nodes;
  let bindings:CodeConstructionBinding[]=plan?[...plan.bindings]:[];

  if(!plan){
    for(const target of plannedNodes){
      for(const slot of target.profile.slots){
        const candidates=plannedNodes
          .filter(source=>source.nodeId!==target.nodeId)
          .filter(source=>(source.profile.outputKinds||[]).some(output=>slot.inputKinds.includes(output)))
          .sort((a,b)=>a.nodeId.localeCompare(b.nodeId));
        if(candidates.length===1){
          bindings.push({
            targetNodeId:target.nodeId,
            slotName:slot.name,
            sourceNodeId:candidates[0].nodeId,
          });
        }
      }
    }
  }

  const graphBase={goal:input.goal,nodes:plannedNodes,bindings};
  const graphId='CGRAPH-'+canonicalSha256Object(graphBase).slice(0,20);
  const sourcedNodeIds=new Set(
    bindings.map(binding=>binding.sourceNodeId)
      .filter((value):value is string=>typeof value==='string')
  );
  const incomingBindingCount=new Map(plannedNodes.map(node=>[node.nodeId,0]));
  for(const binding of bindings){
    incomingBindingCount.set(binding.targetNodeId,(incomingBindingCount.get(binding.targetNodeId)||0)+1);
  }
  const rootCandidates=plannedNodes
    .filter(node=>!sourcedNodeIds.has(node.nodeId))
    .sort((a,b)=>{
      const countDiff=(incomingBindingCount.get(b.nodeId)||0)-(incomingBindingCount.get(a.nodeId)||0);
      if(countDiff!==0)return countDiff;
      const scoreDiff=goalScore(b)-goalScore(a);
      if(scoreDiff!==0)return scoreDiff;
      return a.nodeId.localeCompare(b.nodeId);
    });

  const graphUnresolved=unresolved(plannedNodes,bindings);

  return {
    graphId,
    goal:input.goal,
    rootNodeId:plan?.rootNodeId||rootCandidates[0]?.nodeId||plannedNodes[0]?.nodeId,
    nodes:plannedNodes,
    bindings,
    unresolvedSlots:[...new Set(graphUnresolved)],
    contractErrors:[...new Set(constructionContractErrors)],
  };
 }

 public buildConstructionGraphBundle(input:{
  goal:string;
  componentIds:string[];
  targetPaths:string[];
  preserveAllNodes?:boolean;
 }):{
  accepted:boolean;
  items:Array<{targetPath:string;graph:CodeConstructionGraph}>;
  errors:string[];
 }{
  const targetPaths=[...new Set(
    input.targetPaths
      .map(path=>String(path||'').trim().replace(/^\.\//,''))
      .filter(Boolean)
  )];

  if(targetPaths.length===0){
    return {
      accepted:false,
      items:[],
      errors:['CONSTRUCTION_BUNDLE_TARGETS_EMPTY'],
    };
  }

  const items=targetPaths.map(targetPath=>{
    const graph=this.buildConstructionGraph({
      goal:[
        input.goal,
        `Target file: ${targetPath}`,
        'Generate only the content for this target file.',
        'Respect existing module boundaries and explicit import/export contracts.',
      ].join('\\n'),
      componentIds:input.componentIds,
      preserveAllNodes:input.preserveAllNodes,
    });

    return {targetPath,graph};
  });

  const errors=items.flatMap(item=>[
    ...(item.graph.contractErrors||[]).map(
      value=>`${item.targetPath}:${value}`
    ),
    ...(item.graph.unresolvedSlots||[]).map(
      value=>`${item.targetPath}:${value}`
    ),
  ]);

  return {
    accepted:errors.length===0 && items.length===targetPaths.length,
    items,
    errors:[...new Set(errors)],
  };
 }

 public auditConstructionVocabulary():{
  missingCodeComponentKnowledgeIds:string[];
  orphanCodeComponentKnowledgeIds:string[];
}{
  const knowledge=[
    ...commonCodeKnowledge,
    ...additionalCommonCodeKnowledge,
    ...javascriptCodeKnowledge,
    ...additionalJavascriptCodeKnowledge,
    ...typescriptCodeKnowledge,
    ...additionalTypescriptCodeKnowledge,
    ...webCodeKnowledge,
    ...additionalWebCodeKnowledge,
    ...testingCodeKnowledge,
    ...additionalTestingCodeKnowledge,
    ...moduleCodeKnowledge,
    ...additionalModuleCodeKnowledge,
    ...autonomousConstructionKnowledge,
  ];

  const definitions:CodeComponentDefinition[]=[
    ...additionalJavascriptCodeComponents,
    ...additionalTypescriptCodeComponents,
    ...additionalWebCodeComponents,
    ...additionalTestingCodeComponents,
    ...additionalModuleCodeComponents,
    ...additionalAutonomousConstructionComponents,
    ...additionalConstructionBridgeCodeComponents,
  ];

  const knowledgeIds=new Set(
    knowledge.map(item=>item.id)
  );

  const canonicalDefinitionIds=new Set(
    definitions.map(item=>item.knowledgeId)
  );

  const aliasValues=new Set(
    Object.values(CONSTRUCTION_KNOWLEDGE_ID_ALIASES)
  );

  const constructionKnowledgeIds=
    knowledge
      .filter(item=>Boolean(item.constructionProfile))
      .map(item=>item.id);

  const missingCodeComponentKnowledgeIds=[
    ...new Set(
      constructionKnowledgeIds.filter(id=>{
        const canonical=
          CONSTRUCTION_KNOWLEDGE_ID_ALIASES[id]||id;
        return !canonicalDefinitionIds.has(canonical);
      })
    ),
  ].sort();

  const orphanCodeComponentKnowledgeIds=[
    ...new Set(
      definitions
        .map(item=>item.knowledgeId)
        .filter(id=>
          !knowledgeIds.has(id)&&
          !aliasValues.has(id)
        )
    ),
  ].sort();

  return {
    missingCodeComponentKnowledgeIds,
    orphanCodeComponentKnowledgeIds,
  };
 }

 recordUsage(input:Omit<ComponentUsageReceipt,'usageReceiptId'|'createdAt'|'receiptSha256'>):ComponentUsageReceipt{const createdAt=Date.now();const base={...input,componentIds:[...input.componentIds],createdAt};const receiptSha256=canonicalSha256Object(base);const receipt={...base,usageReceiptId:`CUR-${receiptSha256.slice(0,20)}`,receiptSha256};const receipts=this.read<ComponentUsageReceipt>(RECEIPT_KEY);storageService.setItem(RECEIPT_KEY,JSON.stringify([receipt,...receipts.filter(x=>x.usageReceiptId!==receipt.usageReceiptId)].slice(0,2000)));this.updateOutcome(receipt.componentIds,receipt.outcome);return receipt;}
 findCodeComponentByRegistryId(registryComponentId:string):CodeComponentArtifact|undefined{
  return this.list().find(item =>
    item.componentKind==='CODE' &&
    item.registryComponentId===registryComponentId
  ) as CodeComponentArtifact|undefined;
 }
 approveCodeComponentForRegistry(registryComponentId:string,evidenceIds:string[]):{accepted:boolean;componentId:string;reason:string}{
  const registryComponent=componentRegistryService.getComponent(registryComponentId);
  if(!registryComponent)return {accepted:false,componentId:registryComponentId,reason:'REGISTRY_COMPONENT_NOT_FOUND'};
  if(registryComponent.status!=='VERIFIED')return {accepted:false,componentId:registryComponentId,reason:`REGISTRY_COMPONENT_NOT_VERIFIED:${registryComponent.status}`};
  if(evidenceIds.length===0)return {accepted:false,componentId:registryComponentId,reason:'CODE_REUSABLE_APPROVAL_EVIDENCE_REQUIRED'};

  const linked=this.findCodeComponentByRegistryId(registryComponentId);
  if(!linked)return {accepted:false,componentId:registryComponentId,reason:'LINKED_CODE_REUSABLE_NOT_FOUND'};
  if(['MIKI_APPROVED','ACTIVE'].includes(linked.lifecycleStatus)){
    return {accepted:true,componentId:linked.componentId,reason:'CODE_REUSABLE_ALREADY_APPROVED'};
  }
  if(!['CANDIDATE','VERIFIED'].includes(linked.lifecycleStatus)){
    return {accepted:false,componentId:linked.componentId,reason:`CODE_REUSABLE_LIFECYCLE_NOT_APPROVABLE:${linked.lifecycleStatus}`};
  }

  linked.lifecycleStatus='MIKI_APPROVED';
  linked.lastConfirmedAt=Date.now();
  linked.updatedAt=Date.now();
  this.storeCandidates([linked]);
  return {accepted:true,componentId:linked.componentId,reason:'CODE_REUSABLE_MIKI_APPROVED_FROM_VERIFIED_REGISTRY'};
 }

 updateLifecycle(componentId:string,status:ReusableComponentLifecycle,supersededBy?:string):AnyReusableComponent|undefined{const items=this.list();const item=items.find(x=>x.componentId===componentId);if(!item)return undefined;if(status==='ACTIVE'&&!['VERIFIED','USER_APPROVED','MIKI_APPROVED','REVALIDATION_REQUIRED'].includes(item.lifecycleStatus))throw new Error('COMPONENT_ACTIVE_GATE_FAILED');item.lifecycleStatus=status;item.supersededBy=supersededBy;item.updatedAt=Date.now();storageService.setItem(COMPONENT_KEY,JSON.stringify(items));return item;}
 approveByCore(componentIds?:string[]):{approvedComponentIds:string[];rejectedComponentIds:string[];reasons:Record<string,string>;changed:boolean}{const approvedComponentIds:string[]=[],rejectedComponentIds:string[]=[],reasons:Record<string,string>={};const requestedIds=componentIds&&componentIds.length>0?new Set(componentIds):undefined;const artifacts=reviewLearningArtifactService.list();const activeGeneralized=(id:string)=>{const a=artifacts.find(x=>x.artifactId===id);return Boolean(a&&a.artifactType==='ARCHIVED')?false:Boolean(a&&a.artifactType==='ACCEPTED_PATTERN'&&a.lifecycleStatus==='ACTIVE'&&a.scope==='GENERALIZED');};for(const item of this.list()){
if(requestedIds&&!requestedIds.has(item.componentId))continue;
if(item.lifecycleStatus==='VERIFIED'&&item.componentKind==='KNOWLEDGE'&&item.verificationStatus==='VERIFIED'){
this.updateLifecycle(item.componentId,'MIKI_APPROVED');
approvedComponentIds.push(item.componentId);
continue;
}
if(item.lifecycleStatus!=='CANDIDATE')continue;
const ok=item.sourceLearningArtifactIds.some(id=>{
const a=artifacts.find(x=>x.artifactId===id);
return Boolean(a&&(activeGeneralized(id)||(a.lifecycleStatus==='SUPERSEDED'&&Boolean(a.supersededBy)&&activeGeneralized(a.supersededBy))));
});
if(ok){
this.updateLifecycle(item.componentId,'MIKI_APPROVED');
approvedComponentIds.push(item.componentId);
}else{
rejectedComponentIds.push(item.componentId);
reasons[item.componentId]='SOURCE_LEARNING_NOT_GENERALIZED';
}
}return {approvedComponentIds,rejectedComponentIds,reasons,changed:approvedComponentIds.length>0};} list():AnyReusableComponent[]{return this.read<AnyReusableComponent>(COMPONENT_KEY);}
 private updateOutcome(ids:string[],outcome:ComponentUsageReceipt['outcome']):void{const items=this.list();for(const item of items){if(!ids.includes(item.componentId))continue;item.usageCount+=1;item.lastUsedAt=Date.now();if(outcome==='SUCCEEDED'){item.successCount+=1;item.lastConfirmedAt=Date.now();}if(outcome==='FAILED')item.failureCount+=1;item.updatedAt=Date.now();}storageService.setItem(COMPONENT_KEY,JSON.stringify(items));}
 private identify(body:Record<string,unknown>&{componentKind:ReusableComponentKind}):AnyReusableComponent{const canonicalSha256=canonicalSha256Object(body);return {...body,componentId:`RC-${body.componentKind}-${canonicalSha256.slice(0,18)}`,canonicalSha256} as AnyReusableComponent;}
 private purpose(a:ReviewLearningArtifact):string{if(a.artifactType==='FAILURE_PATTERN')return `${a.symptom}: ${a.preferredAlternative}`;if(a.artifactType==='CORRECTION_PAIR')return a.correctionReason;if(a.artifactType==='ACCEPTED_PATTERN')return a.acceptedApproach;return a.reconsiderWhen.join(' ');}
 private appliesWhen(a:ReviewLearningArtifact):string[]{if(a.artifactType==='FAILURE_PATTERN')return [...a.appliesWhen];if(a.artifactType==='ACCEPTED_PATTERN')return [...a.applicableContext];return [a.packageId];}
 private doesNotApplyWhen(a:ReviewLearningArtifact):string[]{return a.artifactType==='FAILURE_PATTERN'?[...a.doesNotApplyWhen]:[];}
 private words(text:string):string[]{return [...new Set(text.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter(x=>x.length>=2))];}
 private read<T>(key:string):T[]{try{const raw=storageService.getItem(key);const parsed=raw?JSON.parse(raw):[];return Array.isArray(parsed)?parsed:[];}catch{return [];}}
}
export const reusableComponentFactoryService=new ReusableComponentFactoryService();
