import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { reviewCandidateExportService, type ReviewCandidatePackage } from '../../core/services/reviewCandidateExportService';
import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { candidateRepairRetryLoopService, type RepairRetryLoopResult } from './candidateRepairRetryLoopService';

export interface CandidateDevelopmentCompletionResult {
  passed:boolean;
  finalWorkspaceId:string;
  retryResult:RepairRetryLoopResult;
  reviewPackage?:ReviewCandidatePackage;
  capabilityGapId?:string;
  completionId:string;
  reasons:string[];
}

class CandidateDevelopmentCompletionService {
  public async complete(initialWorkspaceId:string,maxRepairAttempts=3):Promise<CandidateDevelopmentCompletionResult>{
    const retryResult=await candidateRepairRetryLoopService.run(initialWorkspaceId,maxRepairAttempts);
    if(retryResult.passed){
      const reviewPackage=reviewCandidateExportService.create(retryResult.finalWorkspaceId);
      if(!reviewPackage){
        return this.result(false,retryResult,undefined,undefined,['REVIEW_PACKAGE_GATE_REJECTED']);
      }
      return this.result(true,retryResult,reviewPackage,undefined,[]);
    }
    const gap=capabilityGapService.recordGap({
      description:`Candidate repair loop stopped: ${retryResult.stopReason}`,
      gap_type:'failure',
      capabilityId:'cap_autonomous_code_repair',
      impact:this.impact(retryResult.stopReason),
      current_workaround:'評価用Review Packageまたは診断監査を人手で確認する',
      candidate_solution:'不足Operation、契約文脈、または検証Fixtureを追加し、既存Candidate経路で再実行する',
      samplePrompt:retryResult.attempts.flatMap(attempt=>attempt.reasons).join(' | ').slice(0,2000),
      source:'observed',
      evidenceIds:retryResult.attempts.flatMap(attempt=>attempt.repairPlanIds)
    });
    return this.result(false,retryResult,undefined,gap.gap_id,[retryResult.stopReason]);
  }

  private result(passed:boolean,retryResult:RepairRetryLoopResult,reviewPackage:ReviewCandidatePackage|undefined,capabilityGapId:string|undefined,reasons:string[]):CandidateDevelopmentCompletionResult {
    const completionId=`DEVCOMP-${canonicalSha256({passed,finalWorkspaceId:retryResult.finalWorkspaceId,attempts:retryResult.attempts.map(attempt=>({workspaceId:attempt.workspaceId,signature:attempt.diagnosticSignature})),capabilityGapId}).slice(0,24)}`;
    return {passed,finalWorkspaceId:retryResult.finalWorkspaceId,retryResult,reviewPackage,capabilityGapId,completionId,reasons};
  }

  private impact(stopReason:string):'LOW'|'MEDIUM'|'HIGH'|'CRITICAL' {
    if(stopReason==='REPEATED_DIAGNOSTIC_SIGNATURE'||stopReason==='MAX_REPAIR_ATTEMPTS_REACHED')return 'HIGH';
    if(stopReason.startsWith('REPAIR_REVISION_REJECTED'))return 'HIGH';
    return 'MEDIUM';
  }
}
export const candidateDevelopmentCompletionService=new CandidateDevelopmentCompletionService();
