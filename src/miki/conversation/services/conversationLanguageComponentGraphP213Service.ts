import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import type { P151Graph } from '../../core/services/unifiedKnowledgeGraphP151Service';

export type ConversationComponentKind='CHARACTER_COMPONENT'|'LEXEME_COMPONENT'|'PHRASE_COMPONENT'|'GRAMMAR_COMPONENT'|'MEANING_COMPONENT'|'INTENT_COMPONENT'|'CONSTRAINT_COMPONENT'|'CONTEXT_COMPONENT'|'KNOWLEDGE_COMPONENT'|'RESPONSE_COMPONENT'|'POSITIVE_EXAMPLE_COMPONENT'|'COUNTEREXAMPLE_COMPONENT'|'REPAIR_COMPONENT'|'EXECUTABLE_COMPONENT';
export type ConversationGapKind='LEXEME_GAP'|'PHRASE_GAP'|'GRAMMAR_GAP'|'MEANING_GAP'|'INTENT_GAP'|'CONSTRAINT_GAP'|'CONTEXT_GAP'|'REFERENCE_GAP'|'EVIDENCE_GAP'|'CAPABILITY_GAP'|'INTEGRATION_GAP'|'VALIDATION_GAP'|'AMBIGUITY';
export interface LanguageComponent{componentId:string;kind:ConversationComponentKind;surface:string;normalized:string;meaningIds:string[];conditions:string[];confidence:number;source:'BUILTIN'|'LEARNED_GRAPH';sha256:string}
export interface ComponentAnalysis{components:LanguageComponent[];gaps:Array<{gapId:string;kind:ConversationGapKind;surface:string;reason:string;confidence:number}>;intentIds:string[];constraintIds:string[];grammarIds:string[];reusedLearnedComponentIds:string[];analysisSha256:string}
const normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const definition=(kind:ConversationComponentKind,surface:string,meaningIds:string[],conditions:string[]=[],confidence=.9):LanguageComponent=>{const base={componentId:`cc:${canonicalSha256Object({kind,surface:normalize(surface)}).slice(0,24)}`,kind,surface,normalized:normalize(surface),meaningIds,conditions,confidence,source:'BUILTIN' as const};return{...base,sha256:canonicalSha256Object(base)}};
const BUILTIN:LanguageComponent[]=[
 definition('PHRASE_COMPONENT','全部実装して',['intent.implement','scope.all'],['PRESERVE_EXISTING']),
 definition('PHRASE_COMPONENT','続きを実装して',['intent.continue','intent.implement'],['ACTIVE_GOAL_REQUIRED']),
 definition('PHRASE_COMPONENT','失わないように',['constraint.preserve'],[],.98),
 definition('PHRASE_COMPONENT','ということ？',['intent.confirm-understanding']),
 definition('GRAMMAR_COMPONENT','ない',['grammar.negation']),definition('GRAMMAR_COMPONENT','なら',['grammar.condition']),definition('GRAMMAR_COMPONENT','けど',['grammar.contrast']),definition('GRAMMAR_COMPONENT','全部',['grammar.total-scope']),definition('GRAMMAR_COMPONENT','それ',['grammar.reference'],['REFERENT_REQUIRED']),
 definition('INTENT_COMPONENT','実装',['intent.implement']),definition('INTENT_COMPONENT','調べ',['intent.research']),definition('INTENT_COMPONENT','続き',['intent.continue'],['ACTIVE_GOAL_REQUIRED']),definition('INTENT_COMPONENT','確認',['intent.confirm']),
 definition('CONSTRAINT_COMPONENT','失わない',['constraint.preserve'],[],.99),definition('CONSTRAINT_COMPONENT','容量',['constraint.capacity']),definition('CONSTRAINT_COMPONENT','全部',['constraint.no-omission']),
 definition('RESPONSE_COMPONENT','つまり',['response.summary']),definition('RESPONSE_COMPONENT','違う？',['response.contrast-confirmation'])
];
class ConversationLanguageComponentGraphP213Service{
 analyze(text:string,graph:P151Graph,context:{activeGoalIds:string[];openGoalIds:string[]}):ComponentAnalysis{
  const normalized=normalize(text);const found=BUILTIN.filter(c=>normalized.includes(c.normalized));const learned=this.learned(graph,normalized);const components=[...new Map([...found,...learned].map(c=>[c.componentId,c])).values()];
  const gaps:Array<{gapId:string;kind:ConversationGapKind;surface:string;reason:string;confidence:number}>=[];
  const add=(kind:ConversationGapKind,surface:string,reason:string,confidence=.85)=>gaps.push({gapId:`gap:${canonicalSha256Object({kind,surface,reason}).slice(0,24)}`,kind,surface,reason,confidence});
  if(!components.length)add('PHRASE_GAP',text,'No known language component matched the utterance');
  if(found.some(c=>c.conditions.includes('ACTIVE_GOAL_REQUIRED'))&&context.activeGoalIds.length===0)add('CONTEXT_GAP','続き','Active goal is required');
  if(found.some(c=>c.conditions.includes('REFERENT_REQUIRED'))&&context.activeGoalIds.length===0)add('REFERENCE_GAP','それ','Referent is unresolved');
  if(context.openGoalIds.length>1&&found.some(c=>c.meaningIds.includes('intent.continue')))add('AMBIGUITY','続き','Multiple open goals prevent deterministic continuation');
  if(!components.some(c=>c.kind==='INTENT_COMPONENT'||c.meaningIds.some(id=>id.startsWith('intent.'))))add('INTENT_GAP',text,'No intent component reached the candidate set');
  const intentIds=[...new Set(components.flatMap(c=>c.meaningIds.filter(id=>id.startsWith('intent.'))))];const constraintIds=[...new Set(components.flatMap(c=>c.meaningIds.filter(id=>id.startsWith('constraint.'))))];const grammarIds=[...new Set(components.flatMap(c=>c.meaningIds.filter(id=>id.startsWith('grammar.'))))];
  const core={components,gaps,intentIds,constraintIds,grammarIds,reusedLearnedComponentIds:learned.map(c=>c.componentId)};return{...core,analysisSha256:canonicalSha256Object(core)};
 }
 promote(surface:string,meaningIds:string[],kind:ConversationComponentKind='PHRASE_COMPONENT'):LanguageComponent{return definition(kind,surface,meaningIds,[],.8)}
 private learned(graph:P151Graph,normalized:string):LanguageComponent[]{const out:LanguageComponent[]=[];for(const node of graph.nodes){const payload=node.payload as Record<string,unknown>;if(payload.outcome!=='POSITIVE_EXAMPLE'&&payload.outcome!=='COUNTEREXAMPLE')continue;const learnedSurface=typeof payload.surface==='string'?normalize(payload.surface):'';if(!learnedSurface||!normalized.includes(learnedSurface))continue;const kind=payload.outcome==='COUNTEREXAMPLE'?'COUNTEREXAMPLE_COMPONENT':'POSITIVE_EXAMPLE_COMPONENT';const base={componentId:`learned:${node.nodeId}`,kind:kind as ConversationComponentKind,surface:learnedSurface,normalized:learnedSurface,meaningIds:Array.isArray(payload.meaningIds)?payload.meaningIds.filter((x):x is string=>typeof x==='string'):[],conditions:typeof payload.repair==='string'?[payload.repair]:[],confidence:node.confidence,source:'LEARNED_GRAPH' as const};out.push({...base,sha256:canonicalSha256Object(base)})}return out}
}
export const conversationLanguageComponentGraphP213Service=new ConversationLanguageComponentGraphP213Service();
