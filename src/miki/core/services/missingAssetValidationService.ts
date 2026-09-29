import { canonicalSha256 } from './canonicalSha256Service';
import type { MissingAssetDraft } from './missingAssetSynthesisService';

export interface MissingAssetValidationResult {
  validationId:string;
  draftId:string;
  passed:boolean;
  status:'VERIFIED_CANDIDATE'|'RESEARCH_REQUIRED'|'REJECTED';
  checks:{name:string;passed:boolean;detail:string}[];
  reasons:string[];
  validatedAt:number;
}

class MissingAssetValidationService {
  validate(draft:MissingAssetDraft):MissingAssetValidationResult {
    const checks=[
      {name:'IDENTITY',passed:/^MAD-[a-f0-9]{20}$/i.test(draft.draftId),detail:draft.draftId},
      {name:'OBJECTIVE',passed:draft.objective.trim().length>=8,detail:`length=${draft.objective.trim().length}`},
      {name:'REQUIREMENT',passed:draft.requirement.trim().length>=12,detail:`length=${draft.requirement.trim().length}`},
      {name:'CONTRACT_INPUTS',passed:draft.contract.inputs.length>=2,detail:draft.contract.inputs.join('|')},
      {name:'CONTRACT_OUTPUTS',passed:draft.contract.outputs.length===1,detail:draft.contract.outputs.join('|')},
      {name:'INVARIANTS',passed:draft.contract.invariants.includes('ISOLATED_UNTIL_VERIFIED')&&draft.contract.invariants.includes('SOURCE_LINEAGE_REQUIRED'),detail:draft.contract.invariants.join('|')},
      {name:'FAILURE_MODES',passed:draft.contract.failureModes.length>=2,detail:draft.contract.failureModes.join('|')},
      {name:'VALIDATION_PLAN',passed:draft.contract.validation.length>=4,detail:draft.contract.validation.join('|')},
      {name:'EVIDENCE_LINEAGE',passed:draft.evidenceIds.length>0||draft.kind==='VALIDATION',detail:`evidence=${draft.evidenceIds.length}`},
      {name:'NO_PLACEHOLDER',passed:!/(TODO|TBD|FIXME|ここに|仮実装)/i.test(`${draft.requirement}\n${draft.objective}`),detail:'placeholder scan'},
    ];
    const hardFailure=checks.some(item=>['IDENTITY','OBJECTIVE','REQUIREMENT','CONTRACT_INPUTS','CONTRACT_OUTPUTS','INVARIANTS','FAILURE_MODES','VALIDATION_PLAN','NO_PLACEHOLDER'].includes(item.name)&&!item.passed);
    const evidenceMissing=checks.some(item=>item.name==='EVIDENCE_LINEAGE'&&!item.passed);
    const status=hardFailure?'REJECTED':evidenceMissing?'RESEARCH_REQUIRED':'VERIFIED_CANDIDATE';
    const reasons=checks.filter(item=>!item.passed).map(item=>`MISSING_ASSET_VALIDATION_FAILED:${item.name}:${item.detail}`);
    const validatedAt=Date.now();
    return {validationId:`MAV-${canonicalSha256({draftId:draft.draftId,checks:checks.map(item=>({name:item.name,passed:item.passed}))}).slice(0,20)}`,draftId:draft.draftId,passed:status==='VERIFIED_CANDIDATE',status,checks,reasons,validatedAt};
  }
  validateAll(drafts:MissingAssetDraft[]):MissingAssetValidationResult[]{return drafts.map(draft=>this.validate(draft));}
}
export const missingAssetValidationService=new MissingAssetValidationService();
