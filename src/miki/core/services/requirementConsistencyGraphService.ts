import type { SemanticRequirementContract } from './semanticRequirementCompilerService';
export interface RequirementConflict { left:string; right:string; kind:'REQUIRE_FORBID'|'PRESERVE_REMOVE'|'LIMIT_CONFLICT'; severity:'BLOCKING'|'REVIEW'; }
class RequirementConsistencyGraphService {
  analyze(contract:SemanticRequirementContract):RequirementConflict[] {
    const all=[...contract.constraints,...contract.nonGoals,...contract.acceptanceCriteria];
    const conflicts:RequirementConflict[]=[];
    const key=(value:string)=>value.toLowerCase().replace(/(?:必須|禁止|不要|削除|維持|must|never|remove|preserve)/g,'').replace(/\s+/g,'').slice(0,80);
    for(let i=0;i<all.length;i+=1){for(let j=i+1;j<all.length;j+=1){const left=all[i],right=all[j],lk=key(left),rk=key(right);if(!lk||!rk||!(lk.includes(rk)||rk.includes(lk)))continue;const require=/必須|追加|実装|must|add|implement/i.test(left);const forbid=/禁止|不要|しない|never|not required/i.test(right);const preserve=/維持|互換|preserve|compatible/i.test(left);const remove=/削除|除外|remove|delete/i.test(right);if((require&&forbid)||(/禁止|不要|never/i.test(left)&&/必須|追加|must/i.test(right)))conflicts.push({left,right,kind:'REQUIRE_FORBID',severity:'BLOCKING'});else if((preserve&&remove)||(/削除|remove/i.test(left)&&/維持|preserve/i.test(right)))conflicts.push({left,right,kind:'PRESERVE_REMOVE',severity:'BLOCKING'});}}
    return conflicts;
  }
}
export const requirementConsistencyGraphService=new RequirementConsistencyGraphService();
