import { storageService } from '../../../services/storageService';
import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';

export type SourceIndependenceMode = 'STRICT' | 'STANDARD' | 'RELAXED';
export type IndependentSourceTarget = 1 | 2 | 3 | 5 | 10 | 'CUSTOM' | 'AUTO';
export interface WebResearchPolicy {
  policyId: string;
  policyRevision: number;
  targetMode: IndependentSourceTarget;
  customTargetCount?: number;
  maxCandidateUrls: number;
  maxRenderedPages: number;
  maxAdditionalChecks: number;
  stopWhenTargetReached: boolean;
  requirePrimarySource: boolean;
  requireCounterEvidenceSearch: boolean;
  sourceIndependenceMode: SourceIndependenceMode;
  updatedAt: number;
}
export interface WebResearchProgress {
  acceptedIndependentSourceCount: number;
  candidateUrlsChecked: number;
  renderedPages: number;
  supportingSourceCount: number;
  counterEvidenceSourceCount: number;
  primarySourceSatisfied: boolean;
  counterEvidenceSearchCompleted: boolean;
  excludedDuplicateCount: number;
  rejectedQualityCount: number;
  conflictingEvidence: boolean;
  requiredIntentTypes?: string[];
  completedIntentTypes?: string[];
  environmentApplicabilitySatisfied?: boolean;
}
export interface WebResearchPolicyReceipt {
  receiptId: string;
  policyId: string;
  policyRevision: number;
  policySha256: string;
  targetIndependentSourceCount: number | 'AUTO';
  createdAt: number;
}
const STORAGE_KEY='miki_web_research_policy_v1';
const DEFAULT_POLICY: WebResearchPolicy={policyId:'WRP-GLOBAL',policyRevision:1,targetMode:'AUTO',maxCandidateUrls:10,maxRenderedPages:5,maxAdditionalChecks:3,stopWhenTargetReached:true,requirePrimarySource:true,requireCounterEvidenceSearch:true,sourceIndependenceMode:'STANDARD',updatedAt:0};
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,Math.trunc(Number.isFinite(n)?n:min)));
class WebResearchPolicyService {
  get():WebResearchPolicy {const saved=(()=>{const raw=storageService.getItem(STORAGE_KEY);try{return raw?JSON.parse(raw) as WebResearchPolicy:DEFAULT_POLICY;}catch{return DEFAULT_POLICY;}})();return this.normalize(saved||DEFAULT_POLICY);}
  save(input:WebResearchPolicy):WebResearchPolicyReceipt {const current=this.get();const next=this.normalize({...input,policyId:'WRP-GLOBAL',policyRevision:current.policyRevision+1,updatedAt:Date.now()});storageService.setItem(STORAGE_KEY,JSON.stringify(next));const policySha256=canonicalSha256Object(next);return {receiptId:`WRPR-${policySha256.slice(0,20)}`,policyId:next.policyId,policyRevision:next.policyRevision,policySha256,targetIndependentSourceCount:this.resolveTarget(next),createdAt:next.updatedAt};}
  resolveTarget(policy=this.get()):number|'AUTO' {if(policy.targetMode==='AUTO')return 'AUTO';if(policy.targetMode==='CUSTOM')return clamp(policy.customTargetCount||3,1,25);return policy.targetMode;}
  remaining(progress:WebResearchProgress,policy=this.get()):number|null {const target=this.resolveTarget(policy);if(target==='AUTO')return null;return Math.max(0,target-progress.acceptedIndependentSourceCount);}
  isSatisfied(progress:WebResearchProgress,policy=this.get()):boolean {if(progress.conflictingEvidence)return false;if(policy.targetMode==='AUTO'){const required=new Set(progress.requiredIntentTypes||[]);const completed=new Set(progress.completedIntentTypes||[]);if(progress.candidateUrlsChecked<1||progress.renderedPages<1)return false;if(required.size>0&&[...required].some(x=>!completed.has(x)))return false;if(progress.acceptedIndependentSourceCount<1)return false;if(policy.requirePrimarySource&&!progress.primarySourceSatisfied)return false;if(policy.requireCounterEvidenceSearch&&!progress.counterEvidenceSearchCompleted)return false;if(progress.environmentApplicabilitySatisfied===false)return false;return true;}const remaining=this.remaining(progress,policy);if(remaining===null||remaining>0)return false;if(policy.requirePrimarySource&&!progress.primarySourceSatisfied)return false;if(policy.requireCounterEvidenceSearch&&!progress.counterEvidenceSearchCompleted)return false;return true;}
  private normalize(x:WebResearchPolicy):WebResearchPolicy {const allowed:[IndependentSourceTarget,...IndependentSourceTarget[]]=[1,2,3,5,10,'CUSTOM','AUTO'];const targetMode=allowed.includes(x.targetMode)?x.targetMode:'AUTO';return {...DEFAULT_POLICY,...x,targetMode,customTargetCount:clamp(x.customTargetCount||3,1,25),maxCandidateUrls:clamp(x.maxCandidateUrls,1,100),maxRenderedPages:clamp(x.maxRenderedPages,1,50),maxAdditionalChecks:clamp(x.maxAdditionalChecks,0,25),policyRevision:Math.max(1,Math.trunc(x.policyRevision||1)),updatedAt:x.updatedAt||0};}
}
export const webResearchPolicyService=new WebResearchPolicyService();
