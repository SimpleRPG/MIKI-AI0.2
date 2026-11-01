import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import { semanticGraphCoreP208Service, type SemanticCandidate, type SemanticGraphState } from '../../core/services/semanticGraphCoreP208Service';
import { semanticDictionaryGraphP209Service } from '../../core/services/semanticDictionaryGraphP209Service';
import { conversationComponentPipelineService } from './conversationComponentPipelineService';
import { contentTermsFromTokens } from '../../research/services/japaneseAnalysisService';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { dictionaryBootstrapService } from '../../research/services/dictionaryBootstrapService';
import { conversationLanguageComponentGraphP213Service } from './conversationLanguageComponentGraphP213Service';
import { conversationGraphCompletionP214Service } from './conversationGraphCompletionP214Service';
import { conversationGraphConnectorP211Service } from './conversationGraphConnectorP211Service';
import { researchGraphConnectorP211Service } from '../../research/services/researchGraphConnectorP211Service';
import { unknownGraphConnectorP211Service } from '../../unknown/services/unknownGraphConnectorP211Service';
import { experienceGraphConnectorP211Service } from '../../experience/services/experienceGraphConnectorP211Service';
import { verificationGraphConnectorP211Service } from '../../verification/services/verificationGraphConnectorP211Service';
import { crossDomainGraphConnectionP211Service } from '../../core/services/crossDomainGraphConnectionP211Service';

export interface ConversationGraphContext { activeGoalIds:string[]; openGoalIds:string[] }
export interface ConversationRuntimeReceipt { turnId:string; inputReceiptSha256:string; semanticReceiptSha256:string; usedComponentIds:string[]; selectedConceptId?:string; requiresResearch:boolean; graphSha256:string; receiptSha256:string }
class ConversationGraphRuntimeP212Service {
 private semanticState:SemanticGraphState=semanticGraphCoreP208Service.bootstrap();
 private readonly inputByTask=new Map<string,ConversationRuntimeReceipt & {inputNodeIds:string[];inputSurface:string;constraintIds:string[];intentIds:string[];grammarIds:string[];meaningComponentIds:string[];contentTerms:string[]}>();
 constructor(){const saved=conversationGraphCompletionP214Service.load();if(saved)crossDomainGraphConnectionP211Service.restore(saved.graph)}
 ingestInput(taskId:string,text:string,context?:ConversationGraphContext):ConversationRuntimeReceipt {
  const resolvedContext=context??conversationGraphCompletionP214Service.context(text);conversationGraphCompletionP214Service.observeInput(taskId,text);
  if(!taskId.trim()||!text.trim())throw new Error('P212_EMPTY_CONVERSATION_INPUT');
  const turnId=`turn:${canonicalSha256Object({taskId,text}).slice(0,32)}`;
  const analysis=conversationComponentPipelineService.analyzeSync(text);
  // P383: keep the input's own content terms so the answer plan can
  // require engagement with what was actually said when the intent /
  // constraint layer yields no checkable requirement. P384: the same
  // terms go to the component analysis so learned examples can be
  // matched by content overlap instead of whole-surface inclusion.
  const contentTerms=contentTermsFromTokens(analysis.analysis?.tokens??[]);
  // P386: content terms the local dictionary cannot resolve are
  // asked once to the server's full dictionary, in the background.
  // Hits are learned locally, so later turns resolve them without
  // the server. This never waits and never blocks the response.
  for (const term of contentTerms.slice(0,4)) { if (!japaneseDictionaryService.lookup(term).length) dictionaryBootstrapService.lookupDeep(term); }
  // P391: discourse resolution. A referential input ("それを…",
  // "その…", "他は…") names no object of its own; the newest topic
  // on the conversation's stack supplies it. The referent's terms
  // join this turn's effective content terms, so component
  // analysis, learned-example matching and answer requirements all
  // see what the turn is actually about. A referential input with
  // nothing to point at becomes an explicit REFERENCE_GAP instead
  // of a silent guess.
  const reference=conversationGraphCompletionP214Service.resolveReference(text);
  const resolvedExtra=reference?reference.terms.filter(term=>!contentTerms.includes(term)):[];
  const effectiveTerms=reference?[...contentTerms,...resolvedExtra].slice(0,16):contentTerms;
  const unresolvedReference=!reference&&conversationGraphCompletionP214Service.isReferential(text);
  conversationGraphCompletionP214Service.observeTopic(text,contentTerms,contentTerms.flatMap(term=>japaneseDictionaryService.conceptIdsFor(term)));
  const languageComponents=conversationLanguageComponentGraphP213Service.analyze(text,crossDomainGraphConnectionP211Service.snapshot(),resolvedContext,effectiveTerms);
  if(unresolvedReference)languageComponents.gaps.push({gapId:`gap:ref:${turnId}`,kind:'REFERENCE_GAP',surface:text.slice(0,64),reason:'Referential expression has no antecedent in the conversation topic stack',confidence:.9});
  const semantic=semanticGraphCoreP208Service.understand(text,this.semanticState,resolvedContext);
  const lexemes=[...new Set(text.normalize('NFKC').split(/[\s、。！？,.!?]+/u).filter(Boolean))].map(token=>({token,found:semanticDictionaryGraphP209Service.has(token)}));
  const inputReceipt=conversationGraphConnectorP211Service.connect({eventKind:'INPUT',subjectId:turnId,payload:{taskId,text,lexemes,languageComponents,usedComponentIds:analysis.usedComponentIds,semanticCandidates:semantic.candidates,discourse:{referential:reference!==undefined||unresolvedReference,resolvedSurface:reference?.surface,resolvedTerms:resolvedExtra,unresolvedReference}},confidence:.95,uncertainty:semantic.selected?0.05:.45,sourceRefs:[`conversation:${taskId}`,semantic.receiptSha256],participantDomains:['memory','capability','research','unknown','verification'],requiresVerification:!semantic.selected});
  for (const mutation of semantic.mutationCandidates) {
   const candidate = mutation.payload.candidate as SemanticCandidate;
   conversationGraphConnectorP211Service.connect({
    eventKind:'SEMANTIC_CANDIDATE',
    subjectId:mutation.subjectId,
    payload:{
     taskId,
     status:'CANDIDATE_UNVERIFIED',
     requiresVerification:true,
     semanticKind:mutation.semanticKind,
     decision:candidate.decision,
     conceptId:candidate.conceptId,
     score:candidate.score,
     matchedAssetIds:candidate.matchedAssetIds,
     declaredEvidenceIds:candidate.evidenceIds,
     evidenceLinkageStatus:candidate.evidenceIds.length?'DECLARED_IDS_NOT_RESOLVED':'NO_DECLARED_IDS',
     counterexampleIds:candidate.counterexampleIds,
     requiredComponentIds:candidate.requiredComponentIds,
     graphGeneration:mutation.payload.graphGeneration,
     semanticReceiptSha256:semantic.receiptSha256
    },
    confidence:candidate.score,
    uncertainty:1-candidate.score,
    sourceRefs:[inputReceipt.eventSha256,semantic.receiptSha256],
    participantDomains:['conversation','memory','research','capability','verification'],
    requiresVerification:true,
    relatedNodeIds:inputReceipt.createdNodeIds
   });
  }
  const gapUnknownNodeIds:string[]=[];for(const gap of languageComponents.gaps){const gapReceipt=unknownGraphConnectorP211Service.connect({eventKind:'UNKNOWN',subjectId:gap.gapId,payload:{taskId,text,...gap},confidence:gap.confidence,uncertainty:1-gap.confidence,sourceRefs:[inputReceipt.eventSha256],participantDomains:['conversation','research','learning','verification'],relatedNodeIds:inputReceipt.createdNodeIds});gapUnknownNodeIds.push(...gapReceipt.createdNodeIds);}
  if(semantic.requiresResearch||languageComponents.gaps.length>0){
   const unknownReceipt=unknownGraphConnectorP211Service.connect({eventKind:'UNKNOWN',subjectId:`unknown:${turnId}`,payload:{taskId,text,candidates:semantic.candidates},confidence:.8,uncertainty:.7,sourceRefs:[inputReceipt.eventSha256],participantDomains:['conversation','research'],relatedNodeIds:[...inputReceipt.createdNodeIds,...gapUnknownNodeIds]});
   researchGraphConnectorP211Service.connect({eventKind:'ACTION',subjectId:`research:${turnId}`,payload:{taskId,question:text,reason:semantic.requiresResearch?'SEMANTIC_CANDIDATE_NOT_ACCEPTED':'LANGUAGE_COMPONENT_GAP',gaps:languageComponents.gaps},confidence:.82,uncertainty:.35,sourceRefs:[inputReceipt.eventSha256],participantDomains:['conversation','unknown','verification'],relatedNodeIds:[...inputReceipt.createdNodeIds,...gapUnknownNodeIds,...unknownReceipt.createdNodeIds]});
  }
  const base={turnId,inputReceiptSha256:inputReceipt.receiptSha256,semanticReceiptSha256:semantic.receiptSha256,usedComponentIds:analysis.usedComponentIds,selectedConceptId:semantic.selected?.conceptId,requiresResearch:semantic.requiresResearch,graphSha256:crossDomainGraphConnectionP211Service.snapshot().graphSha256};
  const receipt={...base,receiptSha256:canonicalSha256Object(base)};this.inputByTask.set(taskId,{...receipt,inputNodeIds:inputReceipt.createdNodeIds,inputSurface:text.slice(0,512),constraintIds:languageComponents.constraintIds,intentIds:languageComponents.intentIds,grammarIds:languageComponents.grammarIds,meaningComponentIds:languageComponents.components.map(component=>component.componentId),contentTerms:effectiveTerms});conversationGraphCompletionP214Service.save(crossDomainGraphConnectionP211Service.snapshot());return receipt;
 }
 ingestOutput(taskId:string,response:unknown,validation:{passed?:boolean;counterexample?:string;repair?:string}={}):ConversationRuntimeReceipt|undefined {
  const input=this.inputByTask.get(taskId);if(!input)return undefined;
  const outputSha=canonicalSha256Object(response);
  const output=conversationGraphConnectorP211Service.connect({eventKind:'OUTPUT',subjectId:`answer:${taskId}`,payload:{taskId,responseSha256:outputSha,response},confidence:.9,uncertainty:.1,sourceRefs:[input.inputReceiptSha256],participantDomains:['experience','learning','verification'],relatedNodeIds:input.inputNodeIds});
  const semanticValidation=conversationGraphCompletionP214Service.validate(input.inputSurface,response,input.constraintIds);
  const passed=validation.passed!==false&&semanticValidation.passed;
  const validationReceipt=verificationGraphConnectorP211Service.connect({eventKind:'VALIDATION',subjectId:`validation:${taskId}`,payload:{taskId,passed,semanticValidation,counterexample:validation.counterexample,repair:validation.repair??semanticValidation.repair},confidence:passed?.95:.85,uncertainty:passed?.05:.25,sourceRefs:[output.eventSha256],participantDomains:['conversation','experience','learning','improvement'],relatedNodeIds:output.createdNodeIds});
  const experienceReceipt=experienceGraphConnectorP211Service.connect({eventKind:passed?'RESULT':'ERROR',subjectId:`experience:${taskId}`,payload:{taskId,passed,usedComponentIds:input.usedComponentIds,selectedConceptId:input.selectedConceptId,counterexample:validation.counterexample,repair:validation.repair},confidence:.9,uncertainty:.1,sourceRefs:[output.eventSha256],participantDomains:['conversation','learning','verification'],relatedNodeIds:[...input.inputNodeIds,...output.createdNodeIds,...validationReceipt.createdNodeIds]});
  crossDomainGraphConnectionP211Service.connect({domain:'learning',eventKind:passed?'RESULT':'CORRECTION',subjectId:`learning:${taskId}`,payload:{taskId,outcome:passed?'POSITIVE_EXAMPLE':'COUNTEREXAMPLE',surface:input.inputSurface,contentTerms:input.contentTerms,meaningIds:input.selectedConceptId?[input.selectedConceptId]:[],counterexample:validation.counterexample,repair:validation.repair,reuseCondition:input.selectedConceptId},confidence:passed?.9:.8,uncertainty:passed?.1:.25,sourceRefs:[output.eventSha256],participantDomains:['conversation','experience','verification'],relatedNodeIds:[...input.inputNodeIds,...output.createdNodeIds,...validationReceipt.createdNodeIds,...experienceReceipt.createdNodeIds]});
  const current={...input,graphSha256:crossDomainGraphConnectionP211Service.snapshot().graphSha256};this.inputByTask.delete(taskId);conversationGraphCompletionP214Service.save(crossDomainGraphConnectionP211Service.snapshot());return{...current,receiptSha256:canonicalSha256Object(current)};
 }
 getAnswerRequirements(taskId:string,executionResult?:unknown){const input=this.inputByTask.get(taskId);if(!input)return undefined;return{inputSurface:input.inputSurface,intentIds:input.intentIds,constraintIds:input.constraintIds,grammarIds:input.grammarIds,meaningComponentIds:input.meaningComponentIds,contentTerms:input.contentTerms,executionResult}}
 snapshot(){return crossDomainGraphConnectionP211Service.snapshot()}
 restore(snapshot:ReturnType<typeof crossDomainGraphConnectionP211Service.snapshot>){crossDomainGraphConnectionP211Service.restore(snapshot)}
 reset(){this.semanticState=semanticGraphCoreP208Service.bootstrap();this.inputByTask.clear();crossDomainGraphConnectionP211Service.reset()}
}
export const conversationGraphRuntimeP212Service=new ConversationGraphRuntimeP212Service();
