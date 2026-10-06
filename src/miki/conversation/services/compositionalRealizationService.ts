import type { AnswerContentIR } from '../../../types';
export type ConversationTemperature='COOL'|'NEUTRAL'|'WARM';
export interface ComparisonPair{leftLabel:string;rightLabel:string;leftPoints:string[];rightPoints:string[];verdict?:string;}
export interface RealizationContext{previousUserText?:string;previousAssistantText?:string;focusLabel?:string;temperature?:ConversationTemperature;comparison?:ComparisonPair;conclusionFirst?:boolean;paragraphSentenceLimit?:number;}
export interface CompositionalRealizationResult{surfaceText:string;mode:'COMPOSITIONAL'|'TEMPLATE_FALLBACK';clauses:string[];paragraphs:string[];fallbackReason?:string;decisions:string[];}
const sentence=(value:string)=>/[。！？!?]$/.test(value.trim())?value.trim():`${value.trim()}。`;
const clean=(value:string)=>value.replace(/^[、。\s]+|[、。\s]+$/g,'').trim();
const severity=(value:string)=>/重大|危険|禁止|失敗|破損|損失|未検証/.test(value)?3:/ただし|注意|制限|不足|未完了/.test(value)?2:1;
class CompositionalRealizationService{
 realize(ir:AnswerContentIR,context:RealizationContext={}):CompositionalRealizationResult{
  const decisions:string[]=[];const target=clean(String(ir.target||context.focusLabel||''));const conclusion=clean(String(ir.conclusion||''));
  const conditions=(ir.conditions||[]).map(clean).filter(Boolean);const reasons=(ir.reasons||[]).map(clean).filter(Boolean);const exceptions=(ir.exceptions||[]).map(clean).filter(Boolean).sort((a,b)=>severity(b)-severity(a));const actions=(ir.next_actions||[]).map(clean).filter(Boolean);
  const shortCondition=conditions.length===1&&conditions[0].length<=32;const conclusionFirst=context.conclusionFirst??!/なぜ|理由|根拠/.test(context.previousUserText||'');
  const referent=target&&context.previousAssistantText?.includes(target)&&/それ|その|これ|続け|どう/.test(context.previousUserText||'')?'それ':target; if(referent==='それ')decisions.push('CONTEXTUAL_DEMONSTRATIVE');
  let conclusionClause=conclusion;if(referent&&target&&conclusionClause.includes(target))conclusionClause=conclusionClause.replaceAll(target,referent);if(shortCondition&&conclusionClause){conclusionClause=`${conditions[0]}場合、${conclusionClause}`;conditions.shift();decisions.push('CONDITION_FRONTED');}
  const core:string[]=[];if(conclusionClause)core.push(sentence(conclusionClause));for(const reason of reasons)core.push(sentence(`理由は${reason}`));for(const condition of conditions)core.push(sentence(`${condition}場合に成立します`));
  if(!conclusionFirst&&core.length>1){const first=core.shift()!;core.push(first);decisions.push('REASON_FIRST');}
  const comparison:string[]=[];if(context.comparison){const c=context.comparison;comparison.push(sentence(`${c.leftLabel}は${c.leftPoints.join('、')}`));comparison.push(sentence(`${c.rightLabel}は${c.rightPoints.join('、')}`));if(c.verdict)comparison.push(sentence(c.verdict));decisions.push('SYMMETRIC_COMPARISON');}
  const exceptionClauses=exceptions.map((x,i)=>sentence(`${i===0?'ただし':'加えて'}、${x}`));if(exceptionClauses.length>1)decisions.push('EXCEPTIONS_PRIORITY_SORTED');
  const actionClauses=actions.map(x=>sentence(`次に${x}`));let clauses=[...comparison,...core,...exceptionClauses,...actionClauses];
  if(target){let seen=false;clauses=clauses.map((x,i)=>{if(!x.includes(target))return x;if(!seen){seen=true;return x;}decisions.push('REPEATED_TARGET_OMITTED');return x.replaceAll(target,i===0?target:'その対象');});}
  const temperature=context.temperature||'NEUTRAL';if(clauses.length){if(temperature==='WARM'){clauses[0]=`確認したところ、${clauses[0]}`;decisions.push('WARM_TONE');}else if(temperature==='COOL'){clauses[0]=clauses[0].replace(/します。$/,'します。');decisions.push('COOL_TONE');}}
  if(!clauses.length)return{surfaceText:'回答に必要な内容を確定できませんでした。',mode:'TEMPLATE_FALLBACK',clauses:[],paragraphs:[],fallbackReason:'EMPTY_IR',decisions};
  const limit=Math.max(1,context.paragraphSentenceLimit||3);const paragraphs:string[]=[];for(let i=0;i<clauses.length;i+=limit)paragraphs.push(clauses.slice(i,i+limit).join('\n'));if(paragraphs.length>1)decisions.push('PARAGRAPH_PLANNED');
  return{surfaceText:paragraphs.join('\n\n'),mode:'COMPOSITIONAL',clauses,paragraphs,decisions:[...new Set(decisions)]};
 }
}
export const compositionalRealizationService=new CompositionalRealizationService();
