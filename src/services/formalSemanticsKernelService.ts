import { mikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';

export type SemanticInstruction = { op: 'OBSERVE'|'REQUIRE'|'ALLOW'|'DENY'|'ASSERT'; subject: string; value?: string };
export type SemanticCheck = { id:string; instructions:SemanticInstruction[]; passed:boolean; violations:string[]; proofHash:string; createdAt:number };

/** 第156章: 内部命令を有限な意味集合へ落とし、実行前に決定論的に整合性を検査する。任意コードは実行しない。 */
class FormalSemanticsKernelService {
  private checks: SemanticCheck[] = [];
  evaluate(instructions: SemanticInstruction[]): SemanticCheck {
    const violations:string[]=[]; const seen=new Set<string>();
    for(const i of instructions){
      const key=`${i.op}|${i.subject}`;
      if(i.op==='DENY') seen.add(key);
      if(i.op==='ALLOW' && seen.has(`DENY|${i.subject}`)) violations.push(`ALLOW/DENY conflict:${i.subject}`);
      if(i.op==='REQUIRE' && !i.subject.trim()) violations.push('empty requirement');
    }
    const normalized=instructions.map(i=>`${i.op}:${i.subject}:${i.value||''}`).join('|');
    const result={id:`SEM-${this.hash(normalized)}`,instructions:[...instructions],passed:violations.length===0,violations,proofHash:this.hash(`proof|${normalized}|${violations.join('|')}`),createdAt:Date.now()};
    this.checks.unshift(result); this.checks=this.checks.slice(0,500);
    mikiUnifiedLearningContinuumService.observe({domain:'system',action:'formal_semantics_check',input:normalized,outcome:result.passed?'SUCCESS':'FAILURE',verified:result.passed,capabilityIds:['general.formal-semantics'],lesson:`${result.id}:${result.passed?'PASS':'FAIL'}`});
    return JSON.parse(JSON.stringify(result));
  }
  list(limit=50){return this.checks.slice(0,Math.max(1,limit)).map(x=>JSON.parse(JSON.stringify(x)));}
  private hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')}
}
export const formalSemanticsKernelService=new FormalSemanticsKernelService();
