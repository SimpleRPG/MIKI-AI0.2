import { candidateValidationEvidenceService } from '../../core/services/candidateValidationEvidenceService';
import type { AcceptanceEvidence } from './featureAcceptanceEvidenceGateService';
import type { TestExecutionResult } from './allowlistTestRunnerService';
class TestResultEvidenceRecorderService {
 public record(workspaceId:string,candidateSha256:string,criterionIds:string[],results:TestExecutionResult[]):AcceptanceEvidence[]{const passed=results.length>0&&results.every(item=>item.passed);const evidenceIds:string[]=[];for(const result of results){const evidence=candidateValidationEvidenceService.record({workspaceId,candidateSha256,stage:'REGRESSION',passed:result.passed,command:result.command,exitCode:result.exitCode,startedAt:result.startedAt,completedAt:result.completedAt,logRef:`${result.executionId}:${result.stdout.length}:${result.stderr.length}`});evidenceIds.push(evidence.evidenceId);}return criterionIds.map(criterionId=>({criterionId,evidenceIds:[...evidenceIds],passed}));}
}
export const testResultEvidenceRecorderService=new TestResultEvidenceRecorderService();
