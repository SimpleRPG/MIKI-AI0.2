import type { SemanticRequirementContract } from './semanticRequirementCompilerService';
export interface PrioritizedRequirement { text:string; priority:number; source:'CONSTRAINT'|'ACCEPTANCE'|'NON_GOAL'|'AMBIGUITY'; reasons:string[]; }
class RequirementPriorityResolverService {
  resolve(contract:SemanticRequirementContract):PrioritizedRequirement[]{
    const rows:PrioritizedRequirement[]=[];
    const add=(text:string,source:PrioritizedRequirement['source'])=>{const reasons:string[]=[];let priority=source==='CONSTRAINT'?70:source==='ACCEPTANCE'?60:source==='NON_GOAL'?65:30;if(/最優先|絶対|必須|禁止|never|must|critical/i.test(text)){priority+=25;reasons.push('EXPLICIT_STRONG_PRIORITY');}if(/既存|互換|保全|preserve|compatible/i.test(text)){priority+=15;reasons.push('COMPATIBILITY_PROTECTION');}if(/安全|ロールバック|backup|rollback|security/i.test(text)){priority+=10;reasons.push('SAFETY_PROTECTION');}rows.push({text,source,priority:Math.min(100,priority),reasons});};
    contract.constraints.forEach(value=>add(value,'CONSTRAINT'));contract.acceptanceCriteria.forEach(value=>add(value,'ACCEPTANCE'));contract.nonGoals.forEach(value=>add(value,'NON_GOAL'));contract.ambiguities.forEach(value=>add(value,'AMBIGUITY'));
    return rows.sort((left,right)=>right.priority-left.priority||left.text.localeCompare(right.text));
  }
}
export const requirementPriorityResolverService=new RequirementPriorityResolverService();
