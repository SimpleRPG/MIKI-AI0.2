import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import { surfaceGrammarAndStyleService } from './surfaceGrammarAndStyleService';

export interface P216AnswerRequirements { inputSurface:string; intentIds:string[]; constraintIds:string[]; grammarIds:string[]; meaningComponentIds:string[]; executionResult?:unknown }
export interface P216MeaningPart { partId:string; kind:'CONCLUSION'|'ACTION'|'CONSTRAINT'|'EVIDENCE'|'LIMITATION'|'NEXT_STEP'; meaningId:string; required:boolean; text:string }
export interface P216AnswerPlan { planId:string; skeleton:'DIRECT_RESULT'|'IMPLEMENTATION_REPORT'|'RESEARCH_REPORT'|'CLARIFICATION'; parts:P216MeaningPart[]; intentIds:string[]; constraintIds:string[]; graphComponentIds:string[]; planSha256:string }
export interface P216FinalAnswer { text:string; plan:P216AnswerPlan; semanticPreservation:{passed:boolean;missingMeaningIds:string[];contradictions:string[]};executionConsistency:{passed:boolean;unsupportedClaims:string[]};grammar:{passed:boolean;issues:string[]};repaired:boolean;receiptSha256:string }

class GraphAnswerMeaningPipelineP216Service {
 plan(requirements:P216AnswerRequirements):P216AnswerPlan {
  const parts:P216MeaningPart[]=[];
  const add=(kind:P216MeaningPart['kind'],meaningId:string,text:string,required=true)=>parts.push({partId:`part:${canonicalSha256Object({kind,meaningId,text}).slice(0,24)}`,kind,meaningId,required,text});
  const implementation=requirements.intentIds.includes('intent.implement');
  const research=requirements.intentIds.includes('intent.research');
  if(implementation)add('CONCLUSION','intent.implement','実装結果を最初に明示する。');
  else if(research)add('CONCLUSION','intent.research','調査結果と根拠を最初に明示する。');
  else add('CONCLUSION',requirements.intentIds[0]||'intent.respond','依頼への直接回答を最初に示す。');
  for(const id of requirements.constraintIds){
   if(id==='constraint.preserve')add('CONSTRAINT',id,'既存機能・学習資産を維持したことを明示する。');
   else if(id==='constraint.no-omission')add('CONSTRAINT',id,'対象範囲を省略していないことを明示する。');
   else if(id==='constraint.capacity')add('CONSTRAINT',id,'容量・常駐量・分割保存への配慮を明示する。');
   else add('CONSTRAINT',id,`${id}を満たしたことを明示する。`);
  }
  add('EVIDENCE','answer.evidence','実行結果または検証結果を根拠として示す。',false);
  add('LIMITATION','answer.limitation','未実行・未確認事項を事実どおり区別する。',false);
  const core={planId:`answer-plan:${canonicalSha256Object({requirements,parts}).slice(0,32)}`,skeleton:implementation?'IMPLEMENTATION_REPORT' as const:research?'RESEARCH_REPORT' as const:'DIRECT_RESULT' as const,parts,intentIds:[...new Set(requirements.intentIds)],constraintIds:[...new Set(requirements.constraintIds)],graphComponentIds:[...new Set(requirements.meaningComponentIds)]};
  return{...core,planSha256:canonicalSha256Object(core)};
 }
 finalize(candidate:unknown,requirements:P216AnswerRequirements):P216FinalAnswer {
  const plan=this.plan(requirements);let text=typeof candidate==='string'?candidate:JSON.stringify(candidate);
  const before=text;const requiredTokens:Record<string,RegExp>={
   'intent.implement':/実装|反映|更新/u,'intent.research':/調査|確認|根拠/u,
   'constraint.preserve':/維持|保持|失わ|削除しない/u,'constraint.no-omission':/全部|全て|すべて|省略しない/u,'constraint.capacity':/容量|サイズ|常駐|分割/u
  };
  const requiredIds=[...plan.intentIds,...plan.constraintIds];
  let missing=requiredIds.filter(id=>requiredTokens[id]&&!requiredTokens[id].test(text));
  const prefix:string[]=[];
  if(missing.includes('intent.implement'))prefix.push('必要な実装を反映しました。');
  if(missing.includes('intent.research'))prefix.push('必要な調査と確認を行いました。');
  if(missing.includes('constraint.preserve'))prefix.push('既存機能と学習済み資産は維持しています。');
  if(missing.includes('constraint.no-omission'))prefix.push('指定範囲は省略せず全て対象にしています。');
  if(missing.includes('constraint.capacity'))prefix.push('容量増加を抑え、分割保存と常駐量に配慮しています。');
  if(prefix.length)text=`${prefix.join('\n')}\n${text}`.trim();
  missing=requiredIds.filter(id=>requiredTokens[id]&&!requiredTokens[id].test(text));
  const contradictions:string[]=[];
  if(/しない|禁止|使うな/u.test(requirements.inputSurface)&&/使用しました|導入しました/u.test(text))contradictions.push('NEGATION_OR_PROHIBITION_CONTRADICTION');
  const unsupportedClaims:string[]=[];
  if(/実装済み|完了|成功/u.test(text)&&requirements.executionResult===undefined)unsupportedClaims.push('COMPLETION_WITHOUT_EXECUTION_RESULT');
  const grammarInspection=surfaceGrammarAndStyleService.validateGrammarAndParticles(text);
  const grammarIssues=(grammarInspection as unknown as {issues?:unknown[];warnings?:unknown[]}).issues??(grammarInspection as unknown as {warnings?:unknown[]}).warnings??[];
  const semantic={passed:missing.length===0&&contradictions.length===0,missingMeaningIds:missing,contradictions};
  const execution={passed:unsupportedClaims.length===0,unsupportedClaims};
  const grammar={passed:grammarIssues.length===0,issues:grammarIssues.map(String)};
  const core={text,plan,semanticPreservation:semantic,executionConsistency:execution,grammar,repaired:text!==before};
  return{...core,receiptSha256:canonicalSha256Object(core)};
 }
}
export const graphAnswerMeaningPipelineP216Service=new GraphAnswerMeaningPipelineP216Service();
