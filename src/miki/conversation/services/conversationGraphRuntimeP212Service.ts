import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import { semanticGraphCoreP208Service, type SemanticCandidate, type SemanticGraphState } from '../../core/services/semanticGraphCoreP208Service';
import { semanticDictionaryGraphP209Service } from '../../core/services/semanticDictionaryGraphP209Service';
import { conversationComponentPipelineService } from './conversationComponentPipelineService';
import { contentTermsFromTokens, type JapaneseToken } from '../../research/services/japaneseAnalysisService';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { paraphraseService } from '../../memory/services/paraphraseService';
import { dictionaryBootstrapService } from '../../research/services/dictionaryBootstrapService';
import { webTermLearningService } from '../../research/services/webTermLearningService';
import { lexicalRelationService } from '../../memory/services/lexicalRelationService';
import { projectNotebookService } from '../../memory/services/projectNotebookService';
import { roleplaySessionService } from './roleplaySessionService';
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
  const selfInquiryAnswer=this.computeSelfInquiry(text,{terms:effectiveTerms,tokens:analysis.analysis?.tokens??[],hasQuestion:analysis.analysis?.hasQuestion??false});
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
 // P411: intake is no longer limited to the fixed phrasings the
 // P396 patterns enumerate. The patterns stay as a fast path; a
 // meaning path (computeSelfInquiryByMeaning) judges the same five
 // kinds by referent and intent over the analysis this intake
 // already produced, using the concept assets of P389/P390. Both
 // paths compute through the same builders below, so the answer
 // text is identical whichever path fires. A wording with no real
 // semantic path to a store stays unanswered by design — 言い換え
 // shares no WordNet synset with 言い回し in the bundled assets,
 // so it is not aliased to the phrasing store here.
 private computeSelfInquiry(text:string,semantic?:{terms:string[];tokens:JapaneseToken[];hasQuestion:boolean}):string|undefined {
  const byPattern=this.computeSelfInquiryByPattern(text,semantic);
  if(byPattern!==undefined)return byPattern;
  if(!semantic)return undefined;
  return this.computeSelfInquiryByMeaning(semantic);
 }
 private selfInquiryDictionaryAnswer(term:string):string {
  const hits=japaneseDictionaryService.lookup(term);
  if(hits.length){const entry=hits[0];const gloss=entry.gloss?entry.gloss.slice(0,80):'';let answer=`『${term}』は辞書に載っています。${entry.reading?`読みは「${entry.reading}」です。`:''}${gloss?`意味は「${gloss}」です。`:''}`.trim();
  // P495: 辞書の丸写しで終わらせず、意味保存チェックを通った
  // 言い換えを「つまり」で添える（自分の言葉で言い直す）。
  if(gloss){const restated=paraphraseService.restate(gloss,{style:'casual'});if(restated.changed)answer+=` つまり、${restated.text}ってことです。`;}
  // P502: 学習時に保持した「実際に使われていた文」があれば、
  // 使い方の例として添える（意味だけでなく使い方も話せるように）。
  const example=webTermLearningService.exampleSentenceFor(term);
  if(example)answer+=` 例えば「${example.slice(0,80)}${example.length>80?'…':''}」のように使われます。`;
  // P507: 同義語が登録されていれば、似た言葉として添える
  // （語と語のつながりも一緒に話せるように）。
  const synonyms=lexicalRelationService.synonymsOf(term).filter(s=>s!==term).slice(0,3);
  if(synonyms.length)answer+=` 似た言葉には${synonyms.map(s=>`「${s}」`).join('')}があります。`;
  return answer;}
  return `『${term}』は手元の辞書には載っていません。サーバー側の全量辞書に問い合わせておきます。`;
 }
 private selfInquirySurfaceCountAnswer():string {
  const summary=surfaceVariationService.getAllCategoriesSummary();
  const total=summary.reduce((n,c)=>n+c.totalCount,0);const dynamic=summary.reduce((n,c)=>n+c.dynamicCount,0);
  return `言い回しは全部で${total}件あります。そのうち、学習で増えたものが${dynamic}件です。`;
 }
 private selfInquiryDictionaryCountAnswer():string {
  const stats=japaneseDictionaryService.getStats();
  return `辞書には全部で${stats.builtin+stats.personal+stats.imported}件の語が載っています。`;
 }
 private selfInquiryClaimCountAnswer():string {
  return `今、知識として登録されている主張は${claimDatabaseService.listClaims().length}件です。`;
 }
 private selfInquiryRecallAnswer():string {
  const nodes=crossDomainGraphConnectionP211Service.snapshot().nodes||[];
  // The snapshot's node order is not chronological (P398 device
  // follow-up: result nodes sit scattered in the array), so pick
  // the response whose task id is newest rather than the last
  // array element. Task ids are TASK-<ms>-<sequence>.
  let bestAnswer: string|undefined;let bestMs=-1;let bestSeq=-1;let bestIndex=-1;
  nodes.forEach((node,index)=>{const payload=node.payload as {response?:unknown;taskId?:unknown};if(!payload||typeof payload.response!=='string'||!payload.response.trim())return;let ms=-1;let seq=-1;if(typeof payload.taskId==='string'){const parts=payload.taskId.split('-');if(parts.length>=3){ms=Number(parts[1])||-1;seq=Number(parts[2])||-1}}if(ms>bestMs||(ms===bestMs&&seq>bestSeq)||(ms===bestMs&&seq===bestSeq&&index>bestIndex)){bestMs=ms;bestSeq=seq;bestIndex=index;bestAnswer=payload.response.trim()}});
  if(bestAnswer)return `さっきの話では、直前は『${bestAnswer.slice(0,120)}${bestAnswer.length>120?'…':''}』と答えました。`;
  return 'さっきの話については、まだ答えた記録がありません。';
 }
 // P511: プロジェクトの決め事の想起。プロジェクト名がノートに無い
 // 質問（「政府の方針は？」等）では undefined を返して通常経路に委ねる。
 private selfInquiryProjectAnswer(rawProject:string):string|undefined {
  const name=rawProject.replace(/^(この|その|あの)/u,'').trim();
  const project=projectNotebookService.findProject(name);
  if(!project)return undefined;
  const decisions=projectNotebookService.listDecisions(project);
  if(decisions.length===0)return `${project}の決め事は、プロジェクトノートにまだ登録されていません。`;
  return `${project}の決め事はプロジェクトノートに${decisions.length}件あります。\n`+decisions.map((decision,index)=>`${index+1}. ${decision.text}`).join('\n');
 }
 // P520: プロジェクト名＋決め事に含まれる言葉で聞かれたら、その
 // 決め事で答える（例：「EFRのマップはどうするの？」）。一覧の
 // 想起とは別に、相方として普通に話すときの材料にする。
 private selfInquiryProjectAspectAnswer(value:string,terms:string[]):string|undefined {
  const project=projectNotebookService.findProjectInText(value);
  if(!project)return undefined;
  const decisions=projectNotebookService.listDecisions(project);
  if(decisions.length===0)return undefined;
  const aspectTerms=terms.filter((term)=>(term.length>=2||/^[一-龥]$/.test(term))&&term!==project&&!['する','どう','ある','いる','なる','こと','もの','ため','よう'].includes(term));
  let hits=decisions.filter((decision)=>aspectTerms.some((term)=>decision.text.includes(term)));
  if(hits.length===0){
   // 内容語化で落ちた短い漢字（例：「鍵」）は、決め事の主題語
   // （文頭から助詞までの語）が本文に含まれるかでも照合する。
   const body=value.replace(project,'');
   hits=decisions.filter((decision)=>{const head=decision.text.split(/[はがをにへとで、。・（）]/)[0];return head.length>=1&&body.includes(head);});
  }
  if(hits.length===0)return undefined;
  return `${project}については、こう決まっています。\n`+hits.map((decision)=>`・${decision.text}`).join('\n');
 }
 // P515: なりチャ中の役・場面・あらすじの想起。セッションが
 // 無いときは undefined を返して通常経路に委ねる。
 private selfInquiryRoleAnswer():string|undefined {
  const session=roleplaySessionService.getSession();
  if(!session)return undefined;
  const role=roleplaySessionService.getActiveRole();
  const lines=[`今は「${session.roleName}」の役を被っています。`];
  if(role?.stance)lines.push(`立場：${role.stance}`);
  if(session.scene)lines.push(`場面：${session.scene}`);
  if(session.summary)lines.push(`あらすじ：${session.summary}`);
  return lines.join('\n');
 }
 private computeSelfInquiryByPattern(text:string,semantic?:{terms:string[]}):string|undefined {
  const value=text.trim();
  const dictMatch=value.match(/(.{1,24}?)(?:は|って)(?:辞書|じしょ)に(?:ある|載って|入って)/u);
  if(dictMatch){
   const term=dictMatch[1].replace(/^(この|その|あの)/u,'').trim();
   if(term)return this.selfInquiryDictionaryAnswer(term);
  }
  if(/(言い回し|表現)は(?:何件|いくつ)/u.test(value))return this.selfInquirySurfaceCountAnswer();
  if(/(?:辞書|単語)に?は(?:何件|何語|いくつ)/u.test(value))return this.selfInquiryDictionaryCountAnswer();
  if(/(?:主張|知識)は(?:何件|いくつ)/u.test(value))return this.selfInquiryClaimCountAnswer();
  if(/(?:今の|現在の)役|なりチャの(?:場面|あらすじ|続き)|あらすじ(?:は|って)/u.test(value)){
   const roleAnswer=this.selfInquiryRoleAnswer();
   if(roleAnswer)return roleAnswer;
  }
  const projectAspectAnswer=this.selfInquiryProjectAspectAnswer(value,semantic?.terms??[]);
  if(projectAspectAnswer)return projectAspectAnswer;
  const projectMatch=value.match(/(.{1,24}?)(?:の)?(?:決め事|決定事項|方針|ルール)/u);
  if(projectMatch){
   const projectAnswer=this.selfInquiryProjectAnswer(projectMatch[1]);
   if(projectAnswer)return projectAnswer;
  }
  if(/さっき(?:何て|なんて|何を|何の話|なんの話|どんな話)/u.test(value)||/(?:何の話|なんの話)(?:してた|だった)/u.test(value)||/前の答え|直前の答え|さっきの答え/u.test(value))return this.selfInquiryRecallAnswer();
  return undefined;
 }
 // P411 meaning path. Referent: which of MIKI's own stores the
 // question is about. A content term refers directly when it is
 // the store's own designation (or its reading), and through a
 // concept when it shares a WordNet synset with the designation
 // (P389/P390 assets). Following the P390 convention, a concept
 // match scores 0.8 against a direct match's 1.0, and a candidate
 // is accepted only at 0.75 or above; a tie between different
 // kinds abstains rather than guessing. Intent is read from
 // grammatical features of the analysis, not from phrasing
 // templates: a quantity interrogative （何+助数詞 is a closed
 // class; 幾つ is its other form) or a bare count noun asks for a
 // count, an existence predicate inside a question asks whether a
 // word is held, and a deictic together with a discourse noun
 // asks for the previous answer. Requests and outside subjects
 // carry no store referent, so they never become candidates.
 private computeSelfInquiryByMeaning(semantic:{terms:string[];tokens:JapaneseToken[];hasQuestion:boolean}):string|undefined {
  const terms=semantic.terms;const tokens=semantic.tokens;
  const countIntent=tokens.some(token=>/^何[件個語名冊台人回種本枚匹頭羽]/u.test(token.surface)||token.surface==='数'||token.surface==='件数'||token.surface==='語数'||token.lemma==='幾つ'||token.surface==='幾つ'||token.surface==='いくつ');
  const existencePredicate=tokens.some(token=>token.lemma==='有る'||token.lemma==='ある'||token.lemma==='入る'||token.surface.startsWith('載'));
  const deictic=terms.some(term=>term==='さっき'||term==='先ほど'||term==='直前')||tokens.some(token=>token.surface.startsWith('さっき')||token.surface.startsWith('先ほど'));
  const discourseNoun=tokens.some(token=>token.surface==='話'||token.surface==='答え')||terms.some(term=>term==='答え'||term==='話');
  const lookupIntent=semantic.hasQuestion&&existencePredicate;
  const recallIntent=semantic.hasQuestion&&deictic&&discourseNoun;
  if(!countIntent&&!lookupIntent&&!recallIntent)return undefined;
  const stores:{kind:'SURFACE'|'DICTIONARY'|'CLAIMS';anchors:string[]}[]=[
   {kind:'SURFACE',anchors:['言い回し']},
   {kind:'DICTIONARY',anchors:['辞書']},
   {kind:'CLAIMS',anchors:['主張','知識']},
  ];
  const anchorForms=new Map<string,Set<string>>();const anchorConcepts=new Map<string,Set<string>>();
  for(const store of stores){
   const forms=new Set<string>();const concepts=new Set<string>();
   for(const anchor of store.anchors){
    forms.add(anchor);
    const reading=japaneseDictionaryService.lookup(anchor)[0]?.reading;if(reading)forms.add(reading);
    for(const id of japaneseDictionaryService.conceptIdsFor(anchor))concepts.add(id);
   }
   anchorForms.set(store.kind,forms);anchorConcepts.set(store.kind,concepts);
  }
  const referentScore=new Map<string,number>();const matchedTerms=new Set<string>();
  for(const term of terms){
   const termConcepts=japaneseDictionaryService.conceptIdsFor(term);
   for(const store of stores){
    if(anchorForms.get(store.kind)!.has(term)){referentScore.set(store.kind,1);matchedTerms.add(term)}
    else if(anchorConcepts.get(store.kind)!.size&&termConcepts.some(id=>anchorConcepts.get(store.kind)!.has(id))){if((referentScore.get(store.kind)??0)<0.8)referentScore.set(store.kind,0.8);matchedTerms.add(term)}
   }
  }
  type Candidate={kind:string;score:number;answer:()=>string};
  const candidates:Candidate[]=[];
  if(countIntent){
   if(referentScore.has('SURFACE'))candidates.push({kind:'SURFACE_COUNT',score:referentScore.get('SURFACE')!,answer:()=>this.selfInquirySurfaceCountAnswer()});
   if(referentScore.has('DICTIONARY'))candidates.push({kind:'DICTIONARY_COUNT',score:referentScore.get('DICTIONARY')!,answer:()=>this.selfInquiryDictionaryCountAnswer()});
   if(referentScore.has('CLAIMS'))candidates.push({kind:'CLAIM_COUNT',score:referentScore.get('CLAIMS')!,answer:()=>this.selfInquiryClaimCountAnswer()});
  }
  // A quantity interrogative makes the utterance a count question,
  // so no lookup candidate is built then — otherwise the counter
  // fragment itself （件 in 何件） would pose as the looked-up word
  // and tie with the count candidate.
  if(lookupIntent&&!countIntent&&referentScore.has('DICTIONARY')){
   const stop=new Set(['有る','ある','載る','入る','幾つ','さっき','先ほど','直前']);
   const counterOnly=/^[何件個語名冊台人回種本枚匹頭羽数]+$/u;
   const fromTerms=terms.find(term=>!matchedTerms.has(term)&&!stop.has(term)&&!term.startsWith('何')&&!counterOnly.test(term));
   const fromTokens=tokens.filter(token=>token.kind==='WORD'&&!token.surface.startsWith('載')&&token.surface!=='ある'&&token.surface!=='有る').map(token=>token.lemma||token.surface).find(term=>!matchedTerms.has(term)&&!stop.has(term)&&!term.startsWith('何')&&!counterOnly.test(term));
   const target=fromTerms??fromTokens;
   if(target)candidates.push({kind:'DICTIONARY_LOOKUP',score:referentScore.get('DICTIONARY')!,answer:()=>this.selfInquiryDictionaryAnswer(target)});
  }
  if(recallIntent)candidates.push({kind:'RECALL',score:1,answer:()=>this.selfInquiryRecallAnswer()});
  if(!candidates.length)return undefined;
  candidates.sort((a,b)=>b.score-a.score);
  const best=candidates[0];
  if(best.score<0.75)return undefined;
  if(candidates.length>1&&candidates[1].score===best.score&&candidates[1].kind!==best.kind)return undefined;
  return best.answer();
 }
 getSelfInquiryAnswer(taskId:string):string|undefined { return this.inputByTask.get(taskId)?.selfInquiryAnswer; }
 getAnswerRequirements(taskId:string,executionResult?:unknown){const input=this.inputByTask.get(taskId);if(!input)return undefined;return{inputSurface:input.inputSurface,intentIds:input.intentIds,constraintIds:input.constraintIds,grammarIds:input.grammarIds,meaningComponentIds:input.meaningComponentIds,contentTerms:input.contentTerms,executionResult}}
 snapshot(){return crossDomainGraphConnectionP211Service.snapshot()}
 restore(snapshot:ReturnType<typeof crossDomainGraphConnectionP211Service.snapshot>){crossDomainGraphConnectionP211Service.restore(snapshot)}
 reset(){this.semanticState=semanticGraphCoreP208Service.bootstrap();this.inputByTask.clear();crossDomainGraphConnectionP211Service.reset()}
}
export const conversationGraphRuntimeP212Service=new ConversationGraphRuntimeP212Service();
