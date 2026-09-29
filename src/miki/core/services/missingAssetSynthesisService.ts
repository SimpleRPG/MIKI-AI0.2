import { storageService } from '../../../services/storageService';
import { canonicalSha256 } from './canonicalSha256Service';

export type MissingAssetDraftKind='KNOWLEDGE'|'CODE_COMPONENT'|'ADAPTER'|'VALIDATION';
export interface MissingAssetDraft {draftId:string;runId?:string;taskId?:string;kind:MissingAssetDraftKind;requirement:string;objective:string;evidenceIds:string[];status:'CANDIDATE'|'VERIFIED_CANDIDATE'|'RESEARCH_REQUIRED'|'REJECTED';validationId?:string;validationReasons?:string[];contract:{inputs:string[];outputs:string[];invariants:string[];failureModes:string[];validation:string[]};createdAt:number;}
const KEY='miki_missing_asset_drafts_v1';
class MissingAssetSynthesisService{
 synthesize(input:{runId?:string;taskId?:string;objective:string;requirements:string[];evidenceIds:string[]}):MissingAssetDraft[]{
  const drafts=input.requirements.filter(value=>/COMPONENT_|ADAPTER_|CONSTRUCTION_|IMPLEMENTATION_|VALIDATION_|AUTHORITATIVE_SPEC|RESEARCH_OR_COMPONENT/i.test(value)).map(requirement=>{
   const kind:MissingAssetDraftKind=/ADAPTER_/i.test(requirement)?'ADAPTER':/VALIDATION_/i.test(requirement)?'VALIDATION':/COMPONENT_|CONSTRUCTION_|IMPLEMENTATION_/i.test(requirement)?'CODE_COMPONENT':'KNOWLEDGE';
   const base={runId:input.runId,taskId:input.taskId,kind,requirement,objective:input.objective,evidenceIds:[...new Set(input.evidenceIds)],status:'CANDIDATE' as const,contract:{inputs:['objective','repository-context','evidence'],outputs:[kind==='KNOWLEDGE'?'knowledge-component':kind==='ADAPTER'?'adapter-candidate':kind==='VALIDATION'?'validation-script-candidate':'code-component-candidate'],invariants:['ISOLATED_UNTIL_VERIFIED','SOURCE_LINEAGE_REQUIRED','NO_RUNTIME_SELF_MODIFICATION'],failureModes:['INSUFFICIENT_EVIDENCE','AMBIGUOUS_CONTRACT','VALIDATION_UNAVAILABLE'],validation:['STRUCTURE','TRACEABILITY','SYNTAX_OR_SCHEMA','NORMAL_BOUNDARY_FAILURE_CASES']},createdAt:Date.now()};
   return {draftId:`MAD-${canonicalSha256({...base,createdAt:undefined}).slice(0,20)}`,...base};
  });
  const existing=this.list();const map=new Map(existing.map(item=>[item.draftId,item]));for(const draft of drafts)map.set(draft.draftId,draft);storageService.setItem(KEY,JSON.stringify([...map.values()].slice(-1000)));return drafts;
 }

 updateValidation(draftId:string,input:{status:MissingAssetDraft['status'];validationId:string;validationReasons:string[]}):MissingAssetDraft|undefined{const rows=this.list();const row=rows.find(item=>item.draftId===draftId);if(!row)return undefined;row.status=input.status;row.validationId=input.validationId;row.validationReasons=[...input.validationReasons];storageService.setItem(KEY,JSON.stringify(rows.slice(-1000)));return row;}
 list():MissingAssetDraft[]{try{const raw=storageService.getItem(KEY);const rows=raw?JSON.parse(raw):[];return Array.isArray(rows)?rows:[];}catch{return [];}}
}
export const missingAssetSynthesisService=new MissingAssetSynthesisService();
