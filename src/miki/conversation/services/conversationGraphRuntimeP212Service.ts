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
import { userCommunicationPreferenceService } from './userCommunicationPreferenceService';
import { surfaceVariationGrowthService } from './surfaceVariationGrowthService';
import { WebMaterialPatternExtractor } from '../../research/services/webMaterialPatternExtractor';
import { surfaceVariationService } from './surfaceVariationService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';

export interface ConversationGraphContext { activeGoalIds:string[]; openGoalIds:string[] }
export interface ConversationRuntimeReceipt { turnId:string; inputReceiptSha256:string; semanticReceiptSha256:string; usedComponentIds:string[]; selectedConceptId?:string; requiresResearch:boolean; graphSha256:string; receiptSha256:string }
class ConversationGraphRuntimeP212Service {
 private semanticState:SemanticGraphState=semanticGraphCoreP208Service.bootstrap();
 private readonly inputByTask=new Map<string,ConversationRuntimeReceipt & {inputNodeIds:string[];inputSurface:string;constraintIds:string[];intentIds:string[];grammarIds:string[];meaningComponentIds:string[];contentTerms:string[];selfInquiryAnswer?:string}>();
 // P395: the last delivered answer that passed validation, waiting
 // to be judged by the user's next turn. If that turn corrects it,
 // nothing is harvested; if the conversation simply moves on, its
 // phrasing becomes growth material through the same gate web
 // material passes.
 private pendingAnswerHarvest:{text:string;question:string}|undefined;
 constructor(){const saved=conversationGraphCompletionP214Service.load();if(saved)crossDomainGraphConnectionP211Service.restore(saved.graph)}
 ingestInput(taskId:string,text:string,context?:ConversationGraphContext):ConversationRuntimeReceipt {
  const resolvedContext=context??conversationGraphCompletionP214Service.context(text);conversationGraphCompletionP214Service.observeInput(taskId,text);
  if(!taskId.trim()||!text.trim())throw new Error('P212_EMPTY_CONVERSATION_INPUT');
  // P395: judge the previous delivered answer by this turn. A
  // correction discards it as growth material; anything else lets
  // its phrasing be harvested through the variation growth gate.
  if(this.pendingAnswerHarvest){
   const pending=this.pendingAnswerHarvest;this.pendingAnswerHarvest=undefined;
   if(!/違う|訂正|ではなく|そうじゃなく|そうではない/u.test(text))this.harvestAnswerPatterns(pending);
  }
  const turnId=`turn:${canonicalSha256Object({taskId,text}).slice(0,32)}`;
  // P394: a short instruction about the answering style itself
  // ("短くして", "詳しく説明して") is the user's standing delivery
  // preference, remembered for later answers — not just this one.
  userCommunicationPreferenceService.observeUserInput(text);
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
  const selfInquiryAnswer=this.computeSelfInquiry(text);
  const base={turnId,inputReceiptSha256:inputReceipt.receiptSha256,semanticReceiptSha256:semantic.receiptSha256,usedComponentIds:analysis.usedComponentIds,selectedConceptId:semantic.selected?.conceptId,requiresResearch:semantic.requiresResearch,graphSha256:crossDomainGraphConnectionP211Service.snapshot().graphSha256};
  const receipt={...base,receiptSha256:canonicalSha256Object(base)};this.inputByTask.set(taskId,{...receipt,inputNodeIds:inputReceipt.createdNodeIds,inputSurface:text.slice(0,512),constraintIds:languageComponents.constraintIds,intentIds:languageComponents.intentIds,grammarIds:languageComponents.grammarIds,meaningComponentIds:languageComponents.components.map(component=>component.componentId),contentTerms:effectiveTerms,selfInquiryAnswer});conversationGraphCompletionP214Service.save(crossDomainGraphConnectionP211Service.snapshot());return receipt;
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
  const current={...input,graphSha256:crossDomainGraphConnectionP211Service.snapshot().graphSha256};this.inputByTask.delete(taskId);conversationGraphCompletionP214Service.save(crossDomainGraphConnectionP211Service.snapshot());
  // P395: only a validated answer becomes harvest material, and
  // only once the next turn leaves it uncorrected (see ingestInput).
  if(passed&&typeof response==='string'&&response.trim().length>=8)this.pendingAnswerHarvest={text:response,question:input.inputSurface};
  return{...current,receiptSha256:canonicalSha256Object(current)};
 }
 // P395: mine a delivered, validated, uncorrected answer for
 // surface patterns, through the same extractor and the same
 // verification/promotion gate as web material. The generated
 // footing notes (P392) are fixed annotations, not phrasing the
 // conversation produced, so they are excluded. Harvesting must
 // never break intake, hence the contained failure.
 private harvestAnswerPatterns(pending:{text:string;question:string}):void {
  try{
   const patterns=WebMaterialPatternExtractor.extractSurfacePatternsFromWebText({text:pending.text,sourceQuery:pending.question,sourceUrl:'conversation://self',provider:'conversation'});
   const own=patterns.filter(pattern=>!pattern.originalFragment.startsWith('※')&&!pattern.originalFragment.startsWith('出典'));
   if(own.length)surfaceVariationGrowthService.processWebMaterialForVariationGrowth(own,2);
  }catch{ /* best-effort growth material only */ }
 }
 // P396: questions directed at MIKI's own state are answered from
 // the stores themselves, not from the web and not from composed
 // general knowledge: is a word in the dictionary, how many
 // entries / phrasings / claims are held, and what was just
 // answered. The computed answer is offered to finalization, which
 // still puts it through the same meaning validation as any
 // candidate (see coreTaskIngressService).
 private computeSelfInquiry(text:string):string|undefined {
  const value=text.trim();
  const dictMatch=value.match(/(.{1,24}?)(?:は|って)辞書に(?:ある|載って|入って)/u);
  if(dictMatch){
   const term=dictMatch[1].replace(/^(この|その|あの)/u,'').trim();
   if(term){
    const hits=japaneseDictionaryService.lookup(term);
    if(hits.length){const entry=hits[0];const gloss=entry.gloss?entry.gloss.slice(0,80):'';return `『${term}』は辞書に載っています。${entry.reading?`読みは「${entry.reading}」です。`:''}${gloss?`意味は「${gloss}」です。`:''}`.trim()}
    return `『${term}』は手元の辞書には載っていません。サーバー側の全量辞書に問い合わせておきます。`;
   }
  }
  if(/(言い回し|表現)は(?:何件|いくつ)/u.test(value)){
   const summary=surfaceVariationService.getAllCategoriesSummary();
   const total=summary.reduce((n,c)=>n+c.totalCount,0);const dynamic=summary.reduce((n,c)=>n+c.dynamicCount,0);
   return `言い回しは全部で${total}件あります。そのうち、学習で増えたものが${dynamic}件です。`;
  }
  if(/(?:辞書|単語)は(?:何件|何語|いくつ)/u.test(value)){
   const stats=japaneseDictionaryService.getStats();
   return `辞書には全部で${stats.builtin+stats.personal+stats.imported}件の語が載っています。`;
  }
  if(/(?:主張|知識)は(?:何件|いくつ)/u.test(value)){
   return `今、知識として登録されている主張は${claimDatabaseService.listClaims().length}件です。`;
  }
  if(/さっき(?:何て|なんて|何を)(?:言った|答えた)/u.test(value)||/前の答え/u.test(value)){
   const nodes=crossDomainGraphConnectionP211Service.snapshot().nodes||[];
   for(let i=nodes.length-1;i>=0;i--){const payload=nodes[i].payload as {response?:unknown};if(payload&&typeof payload.response==='string'&&payload.response.trim()){const answer=payload.response.trim();return `直前は『${answer.slice(0,120)}${answer.length>120?'…':''}』と答えました。`}}
   return 'まだ答えた記録がありません。';
  }
  return undefined;
 }
 getSelfInquiryAnswer(taskId:string):string|undefined { return this.inputByTask.get(taskId)?.selfInquiryAnswer; }
 getAnswerRequirements(taskId:string,executionResult?:unknown){const input=this.inputByTask.get(taskId);if(!input)return undefined;return{inputSurface:input.inputSurface,intentIds:input.intentIds,constraintIds:input.constraintIds,grammarIds:input.grammarIds,meaningComponentIds:input.meaningComponentIds,contentTerms:input.contentTerms,executionResult}}
 snapshot(){return crossDomainGraphConnectionP211Service.snapshot()}
 restore(snapshot:ReturnType<typeof crossDomainGraphConnectionP211Service.snapshot>){crossDomainGraphConnectionP211Service.restore(snapshot)}
 reset(){this.semanticState=semanticGraphCoreP208Service.bootstrap();this.inputByTask.clear();crossDomainGraphConnectionP211Service.reset()}
}
export const conversationGraphRuntimeP212Service=new ConversationGraphRuntimeP212Service();
