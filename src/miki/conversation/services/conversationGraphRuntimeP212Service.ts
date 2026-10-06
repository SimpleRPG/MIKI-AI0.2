import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import { semanticGraphCoreP208Service, type SemanticGraphState } from '../../core/services/semanticGraphCoreP208Service';
import { semanticDictionaryGraphP209Service } from '../../core/services/semanticDictionaryGraphP209Service';
import { conversationComponentPipelineService } from './conversationComponentPipelineService';
import { conversationLanguageComponentGraphP213Service } from './conversationLanguageComponentGraphP213Service';
import { conversationGraphCompletionP214Service } from './conversationGraphCompletionP214Service';
import { conversationGraphConnectorP211Service } from './conversationGraphConnectorP211Service';
import { researchGraphConnectorP211Service } from '../../research/services/researchGraphConnectorP211Service';
import { unknownGraphConnectorP211Service } from '../../unknown/services/unknownGraphConnectorP211Service';
import { learningGraphConnectorP211Service } from '../../learning/services/learningGraphConnectorP211Service';
import { experienceGraphConnectorP211Service } from '../../experience/services/experienceGraphConnectorP211Service';
import { verificationGraphConnectorP211Service } from '../../verification/services/verificationGraphConnectorP211Service';
import { crossDomainGraphConnectionP211Service } from '../../core/services/crossDomainGraphConnectionP211Service';

export interface ConversationGraphContext { activeGoalIds:string[]; openGoalIds:string[] }
export interface ConversationRuntimeReceipt { turnId:string; inputReceiptSha256:string; semanticReceiptSha256:string; usedComponentIds:string[]; selectedConceptId?:string; requiresResearch:boolean; graphSha256:string; receiptSha256:string }
class ConversationGraphRuntimeP212Service {
 private semanticState:SemanticGraphState=semanticGraphCoreP208Service.bootstrap();
 private readonly inputByTask=new Map<string,ConversationRuntimeReceipt & {inputSurface:string;constraintIds:string[];intentIds:string[];grammarIds:string[];meaningComponentIds:string[]}>();
 constructor(){const saved=conversationGraphCompletionP214Service.load();if(saved)crossDomainGraphConnectionP211Service.restore(saved.graph)}
 ingestInput(taskId:string,text:string,context?:ConversationGraphContext):ConversationRuntimeReceipt {
  const resolvedContext=context??conversationGraphCompletionP214Service.context(text);conversationGraphCompletionP214Service.observeInput(taskId,text);
  if(!taskId.trim()||!text.trim())throw new Error('P212_EMPTY_CONVERSATION_INPUT');
  const turnId=`turn:${canonicalSha256Object({taskId,text}).slice(0,32)}`;
  const analysis=conversationComponentPipelineService.analyzeSync(text);
  const languageComponents=conversationLanguageComponentGraphP213Service.analyze(text,crossDomainGraphConnectionP211Service.snapshot(),resolvedContext);
  const semantic=semanticGraphCoreP208Service.understand(text,this.semanticState,resolvedContext);
  const lexemes=[...new Set(text.normalize('NFKC').split(/[\s、。！？,.!?]+/u).filter(Boolean))].map(token=>({token,found:semanticDictionaryGraphP209Service.has(token)}));
  const inputReceipt=conversationGraphConnectorP211Service.connect({eventKind:'INPUT',subjectId:turnId,payload:{taskId,text,lexemes,languageComponents,usedComponentIds:analysis.usedComponentIds,semanticCandidates:semantic.candidates},confidence:.95,uncertainty:semantic.selected?0.05:.45,sourceRefs:[`conversation:${taskId}`,semantic.receiptSha256],participantDomains:['memory','capability','research','unknown','verification'],requiresVerification:!semantic.selected});
  for(const gap of languageComponents.gaps){unknownGraphConnectorP211Service.connect({eventKind:'UNKNOWN',subjectId:gap.gapId,payload:{taskId,text,...gap},confidence:gap.confidence,uncertainty:1-gap.confidence,sourceRefs:[inputReceipt.eventSha256],participantDomains:['conversation','research','learning','verification']});}
  if(semantic.requiresResearch||languageComponents.gaps.length>0){
   unknownGraphConnectorP211Service.connect({eventKind:'UNKNOWN',subjectId:`unknown:${turnId}`,payload:{taskId,text,candidates:semantic.candidates},confidence:.8,uncertainty:.7,sourceRefs:[inputReceipt.eventSha256],participantDomains:['conversation','research']});
   researchGraphConnectorP211Service.connect({eventKind:'ACTION',subjectId:`research:${turnId}`,payload:{taskId,question:text,reason:semantic.requiresResearch?'SEMANTIC_CANDIDATE_NOT_ACCEPTED':'LANGUAGE_COMPONENT_GAP',gaps:languageComponents.gaps},confidence:.82,uncertainty:.35,sourceRefs:[inputReceipt.eventSha256],participantDomains:['conversation','unknown','verification']});
  }
  const base={turnId,inputReceiptSha256:inputReceipt.receiptSha256,semanticReceiptSha256:semantic.receiptSha256,usedComponentIds:analysis.usedComponentIds,selectedConceptId:semantic.selected?.conceptId,requiresResearch:semantic.requiresResearch,graphSha256:crossDomainGraphConnectionP211Service.snapshot().graphSha256};
  const receipt={...base,receiptSha256:canonicalSha256Object(base)};this.inputByTask.set(taskId,{...receipt,inputSurface:text.slice(0,512),constraintIds:languageComponents.constraintIds,intentIds:languageComponents.intentIds,grammarIds:languageComponents.grammarIds,meaningComponentIds:languageComponents.components.map(component=>component.componentId)});conversationGraphCompletionP214Service.save(crossDomainGraphConnectionP211Service.snapshot());return receipt;
 }
 ingestOutput(taskId:string,response:unknown,validation:{passed?:boolean;counterexample?:string;repair?:string}={}):ConversationRuntimeReceipt|undefined {
  const input=this.inputByTask.get(taskId);if(!input)return undefined;
  const outputSha=canonicalSha256Object(response);
  const output=conversationGraphConnectorP211Service.connect({eventKind:'OUTPUT',subjectId:`answer:${taskId}`,payload:{taskId,responseSha256:outputSha,response},confidence:.9,uncertainty:.1,sourceRefs:[input.inputReceiptSha256],participantDomains:['experience','learning','verification']});
  const semanticValidation=conversationGraphCompletionP214Service.validate(input.inputSurface,response,input.constraintIds);
  const passed=validation.passed!==false&&semanticValidation.passed;
  verificationGraphConnectorP211Service.connect({eventKind:'VALIDATION',subjectId:`validation:${taskId}`,payload:{taskId,passed,semanticValidation,counterexample:validation.counterexample,repair:validation.repair??semanticValidation.repair},confidence:passed?.95:.85,uncertainty:passed?.05:.25,sourceRefs:[output.eventSha256],participantDomains:['conversation','experience','learning','improvement']});
  experienceGraphConnectorP211Service.connect({eventKind:passed?'RESULT':'ERROR',subjectId:`experience:${taskId}`,payload:{taskId,passed,usedComponentIds:input.usedComponentIds,selectedConceptId:input.selectedConceptId,counterexample:validation.counterexample,repair:validation.repair},confidence:.9,uncertainty:.1,sourceRefs:[output.eventSha256],participantDomains:['conversation','learning','verification']});
  learningGraphConnectorP211Service.connect({eventKind:passed?'RESULT':'CORRECTION',subjectId:`learning:${taskId}`,payload:{taskId,outcome:passed?'POSITIVE_EXAMPLE':'COUNTEREXAMPLE',surface:input.inputSurface,meaningIds:input.selectedConceptId?[input.selectedConceptId]:[],counterexample:validation.counterexample,repair:validation.repair,reuseCondition:input.selectedConceptId},confidence:passed?.9:.8,uncertainty:passed?.1:.25,sourceRefs:[output.eventSha256],participantDomains:['conversation','experience','verification']});
  const current={...input,graphSha256:crossDomainGraphConnectionP211Service.snapshot().graphSha256};this.inputByTask.delete(taskId);conversationGraphCompletionP214Service.save(crossDomainGraphConnectionP211Service.snapshot());return{...current,receiptSha256:canonicalSha256Object(current)};
 }
 getAnswerRequirements(taskId:string,executionResult?:unknown){const input=this.inputByTask.get(taskId);if(!input)return undefined;return{inputSurface:input.inputSurface,intentIds:input.intentIds,constraintIds:input.constraintIds,grammarIds:input.grammarIds,meaningComponentIds:input.meaningComponentIds,executionResult}}
 snapshot(){return crossDomainGraphConnectionP211Service.snapshot()}
 restore(snapshot:ReturnType<typeof crossDomainGraphConnectionP211Service.snapshot>){crossDomainGraphConnectionP211Service.restore(snapshot)}
 reset(){this.semanticState=semanticGraphCoreP208Service.bootstrap();this.inputByTask.clear();crossDomainGraphConnectionP211Service.reset()}
}
export const conversationGraphRuntimeP212Service=new ConversationGraphRuntimeP212Service();
