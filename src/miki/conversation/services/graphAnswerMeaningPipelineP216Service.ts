import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import { surfaceGrammarAndStyleService } from './surfaceGrammarAndStyleService';

export interface P216AnswerRequirements { inputSurface:string; intentIds:string[]; constraintIds:string[]; grammarIds:string[]; meaningComponentIds:string[]; executionResult?:unknown }
export interface P216MeaningPart { partId:string; kind:'CONCLUSION'|'ACTION'|'CONSTRAINT'|'EVIDENCE'|'LIMITATION'|'NEXT_STEP'; meaningId:string; required:boolean; text:string }
export interface P216AnswerPlan { planId:string; skeleton:'DIRECT_RESULT'|'IMPLEMENTATION_REPORT'|'RESEARCH_REPORT'|'CLARIFICATION'; parts:P216MeaningPart[]; intentIds:string[]; constraintIds:string[]; graphComponentIds:string[]; planSha256:string }
export interface P216FinalAnswer { text:string; plan:P216AnswerPlan; semanticPreservation:{passed:boolean;missingMeaningIds:string[];contradictions:string[]};executionConsistency:{passed:boolean;unsupportedClaims:string[]};grammar:{passed:boolean;issues:string[]};repaired:boolean;receiptSha256:string }

function normalizeAnswerSurface(candidate: unknown): string {
  if (typeof candidate === 'string') return candidate;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return '';
  const reply = (candidate as Record<string, unknown>).reply;
  return typeof reply === 'string' ? reply : '';
}

function hasExecutionEvidence(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const status = typeof record.status === 'string' ? record.status.toUpperCase() : '';
  const hasEvidenceIds = Array.isArray(record.evidenceIds) && record.evidenceIds.some(
    (id) => typeof id === 'string' && id.trim().length > 0
  );
  const hasExecutionId = typeof record.executionId === 'string' && record.executionId.trim().length > 0;
  return ['PASS', 'SUCCESS', 'COMPLETED'].includes(status) && (hasEvidenceIds || hasExecutionId);
}

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
  const plan=this.plan(requirements);
  const before=normalizeAnswerSurface(candidate);
  const surfaceMissing=!before.trim();
  let text=surfaceMissing?'回答本文が空のため、内容を確定できませんでした。':before;
  const requiredTokens:Record<string,RegExp>={
   'intent.implement':/実装|反映|更新/u,'intent.research':/調査|確認|根拠/u,
   'constraint.preserve':/維持|保持|失わ|削除しない/u,'constraint.no-omission':/全部|全て|すべて|省略しない/u,'constraint.capacity':/容量|サイズ|常駐|分割/u
  };
  const requiredIds=[...plan.intentIds,...plan.constraintIds];
  let missing=requiredIds.filter(id=>requiredTokens[id]&&!requiredTokens[id].test(text));
  const prefix:string[]=[];
  if(missing.includes('intent.implement'))prefix.push('実装対象と変更点を先に明示します。');
  if(missing.includes('intent.research'))prefix.push('調査対象と確認根拠を先に明示します。');
  if(missing.includes('constraint.preserve'))prefix.push('既存機能と学習済み資産の維持条件を明示します。');
  if(missing.includes('constraint.no-omission'))prefix.push('指定範囲を全て省略せず確認する対象を明示します。');
  if(missing.includes('constraint.capacity'))prefix.push('容量・分割保存・常駐量の検証条件を明示します。');
  if(prefix.length&&!surfaceMissing)text=`${prefix.join('\n')}\n${text}`.trim();
  missing=requiredIds.filter(id=>requiredTokens[id]&&!requiredTokens[id].test(text));
  const contradictions:string[]=[];
  if(/しない|禁止|使うな/u.test(requirements.inputSurface)&&/使用しました|導入しました/u.test(text))contradictions.push('NEGATION_OR_PROHIBITION_CONTRADICTION');
  const unsupportedClaims:string[]=[];
  const completionClaim=/(?:実装済み|実装しました|実装完了|実装完了しました|実装が完了しました|修正済み|修正しました|更新済み|更新しました|反映済み|反映しました|導入済み|導入しました|作業が完了しました|作業は完了しました|処理が成功しました|処理は成功しました|成功しました)/u;
  if(completionClaim.test(text)&&!hasExecutionEvidence(requirements.executionResult)){
   unsupportedClaims.push('COMPLETION_WITHOUT_EXECUTION_RESULT');
   const remaining=text.split(/(?<=[。！？!?])\s*/u).filter(sentence=>!completionClaim.test(sentence)).join('').trim();
   text=[remaining,'実行・検証の証拠がないため、完了したとは確認できません。'].filter(Boolean).join('\n\n');
  }
  const grammarInspection=surfaceGrammarAndStyleService.validateGrammarAndParticles(text);
  const grammarIssues=[...grammarInspection.conjugationIssues,...grammarInspection.particleIssues];
  text=grammarInspection.repairedText;
  const grammarRecheck=surfaceGrammarAndStyleService.validateGrammarAndParticles(text);
  const remainingGrammarIssues=[...grammarRecheck.conjugationIssues,...grammarRecheck.particleIssues];
  missing=requiredIds.filter(id=>requiredTokens[id]&&!requiredTokens[id].test(text));
  if(surfaceMissing)missing.push('ANSWER_SURFACE_EMPTY');
  const semantic={passed:missing.length===0&&contradictions.length===0,missingMeaningIds:missing,contradictions};
  const execution={passed:unsupportedClaims.length===0,unsupportedClaims};
  const grammar={passed:remainingGrammarIssues.length===0,issues:[...new Set([...grammarIssues,...remainingGrammarIssues])].map(String)};
  const core={text,plan,semanticPreservation:semantic,executionConsistency:execution,grammar,repaired:text!==before};
  return{...core,receiptSha256:canonicalSha256Object(core)};
 }
}
export const graphAnswerMeaningPipelineP216Service=new GraphAnswerMeaningPipelineP216Service();
