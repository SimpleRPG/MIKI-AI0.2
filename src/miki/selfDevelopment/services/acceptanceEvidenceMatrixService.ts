import type { TestExecutionResult } from './allowlistTestRunnerService';
export interface AcceptanceTestBinding { criterionId:string; testIds:string[]; required:boolean; }
export interface AcceptanceEvidenceMatrixRow { criterionId:string; requiredTestIds:string[]; executionIds:string[]; passed:boolean; reasons:string[]; }
class AcceptanceEvidenceMatrixService{
 public evaluate(bindings:AcceptanceTestBinding[],tests:Array<{testId:string;result:TestExecutionResult;candidateSha256:string}>,candidateSha256:string):AcceptanceEvidenceMatrixRow[]{return bindings.map(binding=>{const matched=tests.filter(test=>binding.testIds.includes(test.testId)&&test.candidateSha256===candidateSha256);const executed=new Set(matched.map(test=>test.testId));const missing=binding.testIds.filter(id=>!executed.has(id));const failed=matched.filter(test=>!test.result.passed).map(test=>test.testId);const reasons=[...missing.map(id=>`TEST_NOT_EXECUTED:${id}`),...failed.map(id=>`TEST_FAILED:${id}`)];return {criterionId:binding.criterionId,requiredTestIds:[...binding.testIds],executionIds:matched.map(test=>test.result.executionId),passed:binding.required?reasons.length===0:failed.length===0,reasons};});}
}
export const acceptanceEvidenceMatrixService=new AcceptanceEvidenceMatrixService();
