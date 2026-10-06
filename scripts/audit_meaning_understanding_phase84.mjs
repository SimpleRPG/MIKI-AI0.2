import{writeFileSync}from'node:fs';
import{defaultConversationState,classifyDialogueAct}from'../src/miki/conversation/services/conversationStateService.ts';
import{hybridConversationEngineService}from'../src/miki/conversation/services/hybridConversationEngineService.ts';
import{semanticUnderstandingV2OrchestratorService}from'../src/miki/selfDevelopment/services/semanticUnderstandingV2OrchestratorService.ts';
const state=defaultConversationState();
const intentCases=[
['こんにちは','CASUAL_CHAT'],['違う、AではなくBです','CORRECTION'],['この処理を実装して','REQUEST_ARTIFACT'],['AとBならどっちがおすすめ？','REQUEST_RECOMMENDATION'],['なぜ失敗したの？','REQUEST_EXPLANATION'],['さらに詳しく','FOLLOW_UP'],['どういう意味？','REQUEST_EXPLANATION'],['ありがとう','CASUAL_CHAT'],['これで進めて','REQUEST_ARTIFACT'],['本当に問題ない？','QUESTION'],['Aの場合だけ変更して','QUESTION'],['その行は触らないで','QUESTION']
];
const intent=intentCases.map(([text,expected])=>{const actual=classifyDialogueAct(text);return{text,expected,actual,passed:actual===expected};});
const history=[{turnId:'t1',text:'候補Aを実装して検証する',entities:['候補A']},{turnId:'t2',text:'候補Bは保留する',entities:['候補B']}];
const semanticCases=[
 'Aの場合だけBを更新して、それ以外は変更しない',
 '処理対象外が1の行には一切触らない',
 'Aを変更した行だけ、続けてBも更新する',
 '同じPROJECT_IDをまとめて、重複は除外して',
 '失敗したら元に戻して、成功した場合だけ保存する',
 '03000は条件によって03100か06000に変える',
 'それを続けて。ただし前の条件は残して',
 'できれば直して、無理なら理由だけ教えて',
 'AではなくB。Cはそのまま',
 '昨日の結果と今日の結果を比較して'
];
const semantic=semanticCases.map(text=>{const result=semanticUnderstandingV2OrchestratorService.analyze(text,[],undefined,history);return{text,resolvedText:result.resolvedText,ready:result.ready,clarification:result.clarification.state,conflicts:result.frame.conflicts,targets:result.frame.targets,targetSets:result.frame.targetSets,exclusionSets:result.frame.exclusionSets,actionChains:result.frame.actionChains,mutations:result.executionPlan.mutations,typedTerms:result.executionPlan.typedTerms};});
const references=['それを続けて','前の処理は残して','残りも進めて','さっきの条件を戻して'].map(text=>{const result=semanticUnderstandingV2OrchestratorService.analyze(text,[],undefined,history);return{text,resolvedText:result.resolvedText,ready:result.ready};});
const hybrid=['これでどう？','もっと良くして','問題ない？','既存機能は消さないで実装して'].map(text=>{const result=hybridConversationEngineService.interpret(text,state,history);return{text,dialogueAct:result.dialogueAct,stage:result.stage,anaphora:result.anaphora,deterministic:result.deterministic,llmFallbackNeeded:result.llmFallbackNeeded,reason:result.reason,semanticReady:result.semantic.ready,resolvedText:result.semantic.resolvedText};});
const report={phase:'MEANING_UNDERSTANDING_DEEP_AUDIT_84',executedAt:new Date().toISOString(),intentAccuracy:intent.filter(x=>x.passed).length/intent.length,intent,semantic,references,hybrid,existingRegression:{conversationLearningAndReasoning:'FAIL: second consistent affirmation did not promote claim from CANDIDATE to SUPPORTED',anaphoraShadow:{uniqueTopicMatch:0.85,uniqueResponseTextMatch:0.75}},conclusion:'NOT_YET_GENERAL_CONVERSATION_LEVEL'};
writeFileSync('MEANING_UNDERSTANDING_DEEP_AUDIT_PHASE84_REPORT.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
