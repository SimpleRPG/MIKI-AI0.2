import { storageService } from '../../../services/storageService';
import { canonicalSha256Object } from './canonicalSha256Service';
import { reviewLearningArtifactService, type ReviewLearningArtifact } from './reviewLearningArtifactService';
import type { ReviewLearningEpisode } from './reviewDecisionLearningService';
import { verifierService } from '../../verification/services/verifierService';

export type ReusableComponentKind='KNOWLEDGE'|'CODE'|'CONVERSATION';
export type ReusableComponentLifecycle='DRAFT'|'CANDIDATE'|'VERIFIED'|'USER_APPROVED'|'MIKI_APPROVED'|'ACTIVE'|'REVALIDATION_REQUIRED'|'CONFLICT'|'SUSPENDED'|'SUPERSEDED'|'ARCHIVED';
export type ComponentSelectionMode='REUSE_AS_IS'|'ADAPT_EXISTING'|'COMPOSE_MULTIPLE'|'CREATE_NEW'|'ESCALATE_UNKNOWN';
export interface ReusableComponentArtifact {componentId:string;componentKind:ReusableComponentKind;componentType:string;purpose:string;interfaceContract:Record<string,unknown>;inputs:string[];outputs:string[];prerequisites:string[];dependencies:string[];appliesWhen:string[];doesNotApplyWhen:string[];sourceEpisodeIds:string[];sourceLearningArtifactIds:string[];canonicalSha256:string;environmentFingerprint:string;lifecycleStatus:ReusableComponentLifecycle;usageCount:number;successCount:number;failureCount:number;lastUsedAt?:number;lastConfirmedAt?:number;supersededBy?:string;createdAt:number;updatedAt:number;}
export interface KnowledgeComponentArtifact extends ReusableComponentArtifact {componentKind:'KNOWLEDGE';claimIds:string[];evidenceRefs:string[];sourceUrls:string[];sourceArtifactIds:string[];verificationStatus:'UNVERIFIED'|'VERIFIED'|'CONFLICT';contradictionRefs:string[];freshnessPolicy:string;}
export interface CodeComponentArtifact extends ReusableComponentArtifact {componentKind:'CODE';exports:string[];imports:string[];publicInterfaces:string[];coreIngressPoints:string[];domainOwnership:string[];persistenceKeys:string[];uiEventEntrypoints:string[];testReferences:string[];requiredValidation:string[];}
export interface ConversationComponentArtifact extends ReusableComponentArtifact {componentKind:'CONVERSATION';atomic:boolean;conversationState:string[];requiredInformation:string[];responseStructure:string[];prohibitedPatterns:string[];clarificationConditions:string[];verbosityConditions:string[];toolResultOrder:string[];}
export type AnyReusableComponent=KnowledgeComponentArtifact|CodeComponentArtifact|ConversationComponentArtifact;
export interface ComponentUsageReceipt {usageReceiptId:string;componentIds:string[];taskId:string;candidateId?:string;conversationPlanId?:string;selectionMode:ComponentSelectionMode;validationResult:'PASSED'|'FAILED'|'NOT_RUN';outcome:'SUCCEEDED'|'FAILED'|'PENDING';coreDecisionId:string;createdAt:number;receiptSha256:string;}
export interface ComponentPack {componentPackId:string;knowledgePackId:string;usedKnowledgeComponentIds:string[];usedCodeComponentIds:string[];usedConversationComponentIds:string[];adaptedComponentIds:string[];createdComponentIds:string[];excludedComponentIds:string[];exclusionReasons:Record<string,string>;environmentFingerprint:string;unresolvedComponentNeeds:string[];componentContextSha256:string;packSha256:string;}
const COMPONENT_KEY='miki_reusable_component_repository_v1';const RECEIPT_KEY='miki_component_usage_receipts_v1';
class ReusableComponentFactoryService{
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
 storeCandidates(items:AnyReusableComponent[]):{componentIds:string[];persistenceReceiptId:string;reloaded:boolean}{const existing=this.list();const merged=[...items,...existing.filter(item=>!items.some(next=>next.canonicalSha256===item.canonicalSha256))].slice(0,1000);storageService.setItem(COMPONENT_KEY,JSON.stringify(merged));const loaded=this.list();const reloaded=items.every(item=>loaded.some(saved=>saved.componentId===item.componentId&&saved.canonicalSha256===item.canonicalSha256));if(!reloaded)throw new Error('COMPONENT_REPOSITORY_PERSISTENCE_FAILED');return {componentIds:items.map(x=>x.componentId),persistenceReceiptId:`CPR-${canonicalSha256Object({ids:items.map(x=>x.componentId),at:Date.now()}).slice(0,20)}`,reloaded};}
 retrieve(input:{purpose:string;environmentFingerprint:string;kinds?:ReusableComponentKind[]}):{candidates:AnyReusableComponent[];excludedComponentIds:string[];exclusionReasons:Record<string,string>}{const words=this.words(input.purpose);const excludedComponentIds:string[]=[];const exclusionReasons:Record<string,string>={};const candidates=this.list().filter(item=>{if(input.kinds&&!input.kinds.includes(item.componentKind)){excludedComponentIds.push(item.componentId);exclusionReasons[item.componentId]='KIND_NOT_SELECTED';return false;}if(!['MIKI_APPROVED','ACTIVE','USER_APPROVED'].includes(item.lifecycleStatus)){excludedComponentIds.push(item.componentId);exclusionReasons[item.componentId]='NOT_MIKI_APPROVED';return false;}if(item.environmentFingerprint!=='unknown'&&item.environmentFingerprint!==input.environmentFingerprint){excludedComponentIds.push(item.componentId);exclusionReasons[item.componentId]='ENVIRONMENT_REVALIDATION_REQUIRED';return false;}const hay=this.words([item.purpose,...item.appliesWhen,item.componentType].join(' '));const matched=words.some(word=>hay.includes(word));if(!matched){excludedComponentIds.push(item.componentId);exclusionReasons[item.componentId]='PURPOSE_NOT_MATCHED';}return matched;});return {candidates,excludedComponentIds,exclusionReasons};}
 plan(input:{taskId:string;purpose:string;environmentFingerprint:string;requiredKinds?:ReusableComponentKind[]}):ComponentPack{const found=this.retrieve({purpose:input.purpose,environmentFingerprint:input.environmentFingerprint,kinds:input.requiredKinds});const knowledge=found.candidates.filter(x=>x.componentKind==='KNOWLEDGE').map(x=>x.componentId);const code=found.candidates.filter(x=>x.componentKind==='CODE').map(x=>x.componentId);const conversation=found.candidates.filter(x=>x.componentKind==='CONVERSATION').map(x=>x.componentId);const unresolved=(input.requiredKinds||[]).filter(kind=>!found.candidates.some(x=>x.componentKind===kind)).map(kind=>`${kind}_COMPONENT_REQUIRED`);const context={taskId:input.taskId,knowledge,code,conversation,excluded:found.excludedComponentIds,environmentFingerprint:input.environmentFingerprint,unresolved};const componentContextSha256=canonicalSha256Object(context);return {componentPackId:`CPACK-${componentContextSha256.slice(0,20)}`,knowledgePackId:`KPACK-${canonicalSha256Object(knowledge).slice(0,20)}`,usedKnowledgeComponentIds:knowledge,usedCodeComponentIds:code,usedConversationComponentIds:conversation,adaptedComponentIds:[],createdComponentIds:[],excludedComponentIds:found.excludedComponentIds,exclusionReasons:found.exclusionReasons,environmentFingerprint:input.environmentFingerprint,unresolvedComponentNeeds:unresolved,componentContextSha256,packSha256:canonicalSha256Object({...context,componentContextSha256})};}
 recordUsage(input:Omit<ComponentUsageReceipt,'usageReceiptId'|'createdAt'|'receiptSha256'>):ComponentUsageReceipt{const createdAt=Date.now();const base={...input,componentIds:[...input.componentIds],createdAt};const receiptSha256=canonicalSha256Object(base);const receipt={...base,usageReceiptId:`CUR-${receiptSha256.slice(0,20)}`,receiptSha256};const receipts=this.read<ComponentUsageReceipt>(RECEIPT_KEY);storageService.setItem(RECEIPT_KEY,JSON.stringify([receipt,...receipts.filter(x=>x.usageReceiptId!==receipt.usageReceiptId)].slice(0,2000)));this.updateOutcome(receipt.componentIds,receipt.outcome);return receipt;}
 updateLifecycle(componentId:string,status:ReusableComponentLifecycle,supersededBy?:string):AnyReusableComponent|undefined{const items=this.list();const item=items.find(x=>x.componentId===componentId);if(!item)return undefined;if(status==='ACTIVE'&&!['VERIFIED','USER_APPROVED','MIKI_APPROVED','REVALIDATION_REQUIRED'].includes(item.lifecycleStatus))throw new Error('COMPONENT_ACTIVE_GATE_FAILED');item.lifecycleStatus=status;item.supersededBy=supersededBy;item.updatedAt=Date.now();storageService.setItem(COMPONENT_KEY,JSON.stringify(items));return item;}
 approveByCore():{approvedComponentIds:string[];rejectedComponentIds:string[];reasons:Record<string,string>;changed:boolean}{const approvedComponentIds:string[]=[],rejectedComponentIds:string[]=[],reasons:Record<string,string>={};const artifacts=reviewLearningArtifactService.list();const activeGeneralized=(id:string)=>{const a=artifacts.find(x=>x.artifactId===id);return Boolean(a&&a.artifactType==='ARCHIVED')?false:Boolean(a&&a.artifactType==='ACCEPTED_PATTERN'&&a.lifecycleStatus==='ACTIVE'&&a.scope==='GENERALIZED');};for(const item of this.list()){if(item.lifecycleStatus!== 'CANDIDATE')continue;const ok=item.sourceLearningArtifactIds.some(id=>{const a=artifacts.find(x=>x.artifactId===id);return Boolean(a&&(activeGeneralized(id)||(a.lifecycleStatus==='SUPERSEDED'&&Boolean(a.supersededBy)&&activeGeneralized(a.supersededBy))));});if(ok){this.updateLifecycle(item.componentId,'MIKI_APPROVED');approvedComponentIds.push(item.componentId);}else{rejectedComponentIds.push(item.componentId);reasons[item.componentId]='SOURCE_LEARNING_NOT_GENERALIZED';}}return {approvedComponentIds,rejectedComponentIds,reasons,changed:approvedComponentIds.length>0};} list():AnyReusableComponent[]{return this.read<AnyReusableComponent>(COMPONENT_KEY);}
 private updateOutcome(ids:string[],outcome:ComponentUsageReceipt['outcome']):void{const items=this.list();for(const item of items){if(!ids.includes(item.componentId))continue;item.usageCount+=1;item.lastUsedAt=Date.now();if(outcome==='SUCCEEDED'){item.successCount+=1;item.lastConfirmedAt=Date.now();}if(outcome==='FAILED')item.failureCount+=1;item.updatedAt=Date.now();}storageService.setItem(COMPONENT_KEY,JSON.stringify(items));}
 private identify(body:Record<string,unknown>&{componentKind:ReusableComponentKind}):AnyReusableComponent{const canonicalSha256=canonicalSha256Object(body);return {...body,componentId:`RC-${body.componentKind}-${canonicalSha256.slice(0,18)}`,canonicalSha256} as AnyReusableComponent;}
 private purpose(a:ReviewLearningArtifact):string{if(a.artifactType==='FAILURE_PATTERN')return `${a.symptom}: ${a.preferredAlternative}`;if(a.artifactType==='CORRECTION_PAIR')return a.correctionReason;if(a.artifactType==='ACCEPTED_PATTERN')return a.acceptedApproach;return a.reconsiderWhen.join(' ');}
 private appliesWhen(a:ReviewLearningArtifact):string[]{if(a.artifactType==='FAILURE_PATTERN')return [...a.appliesWhen];if(a.artifactType==='ACCEPTED_PATTERN')return [...a.applicableContext];return [a.packageId];}
 private doesNotApplyWhen(a:ReviewLearningArtifact):string[]{return a.artifactType==='FAILURE_PATTERN'?[...a.doesNotApplyWhen]:[];}
 private words(text:string):string[]{return [...new Set(text.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter(x=>x.length>=2))];}
 private read<T>(key:string):T[]{try{const raw=storageService.getItem(key);const parsed=raw?JSON.parse(raw):[];return Array.isArray(parsed)?parsed:[];}catch{return [];}}
}
export const reusableComponentFactoryService=new ReusableComponentFactoryService();
