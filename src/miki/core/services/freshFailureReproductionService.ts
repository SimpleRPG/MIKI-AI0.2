import { canonicalSha256Object } from './canonicalSha256Service';
export interface FreshFailureReproductionInput{failureId:string;historicalEvidenceSha256:string;fixtureSha256:string;expectedFailureSignature:string;observedFailureSignature:string;workerReceivedHistoricalDiagnosis:boolean;}
class FreshFailureReproductionService{
 evaluate(input:FreshFailureReproductionInput){const reasons:string[]=[];if(input.workerReceivedHistoricalDiagnosis)reasons.push('REPLAY_WORKER_CONTAMINATED');if(!input.fixtureSha256)reasons.push('FIXTURE_HASH_MISSING');if(input.expectedFailureSignature!==input.observedFailureSignature)reasons.push('FAILURE_SIGNATURE_MISMATCH');const reproduced=reasons.length===0;const seed={failureId:input.failureId,historicalEvidenceSha256:input.historicalEvidenceSha256,fixtureSha256:input.fixtureSha256,expectedFailureSignature:input.expectedFailureSignature,observedFailureSignature:input.observedFailureSignature,reproduced,reasons};return{...seed,reproductionSha256:canonicalSha256Object(seed)};}
}
export const freshFailureReproductionService=new FreshFailureReproductionService();
