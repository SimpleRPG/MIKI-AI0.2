import { formalSemanticsKernelService } from './formalSemanticsKernelService';
export interface CompositionProof { id:string; capabilityIds:string[]; passed:boolean; proof:string; reason:string; createdAt:number; }
/** 第167章: 既存能力の連結を形式意味論の有限検査で証明する。実装生成はしない。 */
class CapabilityCompositionProofService {
 prove(capabilityIds:string[]):CompositionProof{
  const ids=Array.from(new Set(capabilityIds.map(x=>x.trim()).filter(Boolean))).sort();
  const sem=formalSemanticsKernelService.evaluate(ids.flatMap(id=>[{op:'REQUIRE' as const,subject:id},{op:'ALLOW' as const,subject:`chain:${id}`} ]));
  const passed=ids.length>0&&sem.passed;
  return {id:`CMP-${this.hash(ids.join('|'))}`,capabilityIds:ids,passed,proof:sem.proofHash,reason:passed?'有限意味検査を通過':'能力が空、または意味制約が衝突',createdAt:Date.now()};
 }
 private hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')}
}
export const capabilityCompositionProofService=new CapabilityCompositionProofService();
