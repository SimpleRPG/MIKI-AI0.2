import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import { candidateAdoptionReadinessService, type CandidateAdoptionReadinessInput } from './candidateAdoptionReadinessService';
import { humanAdoptionApprovalReceiptService, type HumanAdoptionApprovalReceipt } from './humanAdoptionApprovalReceiptService';

export interface FormalAdoptionAuthorizationInput extends CandidateAdoptionReadinessInput {
  baseRevision: string;
  currentBaseRevision: string;
  approvalReceipt?: HumanAdoptionApprovalReceipt;
}
export interface FormalAdoptionAuthorization {
  authorizationId: string;
  authorized: boolean;
  reasons: string[];
  candidateId: string;
  candidateHash: string;
  reviewPackageHash: string;
  baseRevision: string;
  approvalReceiptSha256?: string;
  readinessId: string;
  issuedAt: number;
  authorizationSha256: string;
}
class FormalAdoptionAuthorizationService {
  authorize(input: FormalAdoptionAuthorizationInput): FormalAdoptionAuthorization {
    humanAdoptionApprovalReceiptService.invalidateForRevision(input.candidateId,input.candidateHash,input.reviewPackageHash,input.currentBaseRevision);
    const active=input.approvalReceipt?.status==='ACTIVE' ? input.approvalReceipt : humanAdoptionApprovalReceiptService.latestActive(input.candidateId);
    const readiness=candidateAdoptionReadinessService.assessWithApprovalReceipt({...input,baseRevision:input.currentBaseRevision,approvalReceipt:active});
    const reasons=[...readiness.reasons];
    if(input.baseRevision!==input.currentBaseRevision)reasons.push('CURRENT_BASE_REVISION_MISMATCH');
    const issuedAt=Date.now();
    const unsigned={authorizationId:`ADOPT-AUTH-${canonicalSha256Object({candidateId:input.candidateId,candidateHash:input.candidateHash,reviewPackageHash:input.reviewPackageHash,currentBaseRevision:input.currentBaseRevision,approvalReceiptSha256:active?.receiptSha256,readinessId:readiness.readinessId,reasons}).slice(0,24)}`,authorized:readiness.readyForFormalAdoption&&reasons.length===0,reasons:[...new Set(reasons)],candidateId:input.candidateId,candidateHash:input.candidateHash,reviewPackageHash:input.reviewPackageHash,baseRevision:input.currentBaseRevision,approvalReceiptSha256:active?.receiptSha256,readinessId:readiness.readinessId,issuedAt};
    return {...unsigned,authorizationSha256:canonicalSha256Object(unsigned)};
  }
  validate(authorization:FormalAdoptionAuthorization):string[]{const {authorizationSha256,...unsigned}=authorization;const reasons:string[]=[];if(canonicalSha256Object(unsigned)!==authorizationSha256)reasons.push('ADOPTION_AUTHORIZATION_HASH_INVALID');if(!authorization.authorized)reasons.push('ADOPTION_AUTHORIZATION_NOT_AUTHORIZED');return reasons;}
}
export const formalAdoptionAuthorizationService=new FormalAdoptionAuthorizationService();
