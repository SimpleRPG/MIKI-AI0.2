import { formalSemanticsKernelService } from './formalSemanticsKernelService';
export interface ExplanationEvidence { id:string; decision:string; steps:string[]; evidence:string[]; semanticsPass:boolean; createdAt:number; }
/** 第168章: 実行計画と説明証拠を同じIDで双方向参照できる形にする。 */
class ExecutableExplanationService {
 explain(decision:string,steps:string[],evidence:string[]=[]):ExplanationEvidence{
  const sem=formalSemanticsKernelService.evaluate(steps.map(s=>({op:'ASSERT' as const,subject:s})));
  const id=`EXE-${this.hash(`${decision}|${steps.join('|')}|${evidence.join('|')}`)}`;
  return {id,decision,steps:[...steps],evidence:[...evidence],semanticsPass:sem.passed,createdAt:Date.now()};
 }
 private hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')}
}
export const executableExplanationService=new ExecutableExplanationService();
