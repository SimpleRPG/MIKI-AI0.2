import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { candidateValidationRunnerService, type ValidationRunnerResult } from '../../core/services/candidateValidationRunnerService';
import { isolatedCandidateWorkspaceService } from '../../core/services/isolatedCandidateWorkspaceService';
import { candidateRepairRevisionService } from './candidateRepairRevisionService';
import { repairStrategySelectionService } from './repairStrategySelectionService';

export interface RepairRetryAttempt {
  attempt:number;
  workspaceId:string;
  candidateSha256:string;
  diagnosticSignature:string;
  repairPlanIds:string[];
  validationPassed:boolean;
  reasons:string[];
}
export interface RepairRetryLoopResult {
  passed:boolean;
  initialWorkspaceId:string;
  finalWorkspaceId:string;
  attempts:RepairRetryAttempt[];
  stopReason:string;
}

class CandidateRepairRetryLoopService {
  public async run(initialWorkspaceId:string,maxAttempts=3):Promise<RepairRetryLoopResult>{
    const limit=Math.max(1,Math.min(5,Math.floor(maxAttempts)));
    const attempts:RepairRetryAttempt[]=[];
    const signatures=new Set<string>();
    let workspaceId=initialWorkspaceId;

    for(let attempt=1;attempt<=limit;attempt+=1){
      const workspace=isolatedCandidateWorkspaceService.get(workspaceId);
      if(!workspace)return {passed:false,initialWorkspaceId,finalWorkspaceId:workspaceId,attempts,stopReason:'WORKSPACE_NOT_FOUND'};
      const validation=await candidateValidationRunnerService.run(workspaceId);
      const repairPlans=validation.repairPlans||[];
      const signature=this.signature(validation);
      attempts.push({attempt,workspaceId,candidateSha256:workspace.candidateRevisionSha256,diagnosticSignature:signature,repairPlanIds:repairPlans.map(plan=>plan.planId),validationPassed:validation.passed,reasons:[...validation.reasons]});
      if(validation.passed)return {passed:true,initialWorkspaceId,finalWorkspaceId:workspaceId,attempts,stopReason:'VALIDATION_PASSED'};
      if(attempt>=limit)return {passed:false,initialWorkspaceId,finalWorkspaceId:workspaceId,attempts,stopReason:'MAX_REPAIR_ATTEMPTS_REACHED'};
      if(signatures.has(signature))return {passed:false,initialWorkspaceId,finalWorkspaceId:workspaceId,attempts,stopReason:'REPEATED_DIAGNOSTIC_SIGNATURE'};
      signatures.add(signature);
      if(!validation.retryRecommended||repairPlans.every(plan=>!plan.accepted))return {passed:false,initialWorkspaceId,finalWorkspaceId:workspaceId,attempts,stopReason:'NO_ACCEPTED_REPAIR_PLAN'};

      const acceptedPlans=repairPlans.filter(plan=>plan.accepted);
      const strategyCandidates=acceptedPlans.map(plan=>({strategy:plan.operations.map(operation=>operation.kind).sort().join('+')||'NO_OPERATION',deterministicPriority:plan.operations.length>0?1/plan.operations.length:0,applicable:plan.accepted,risk:plan.operations.length>2?'HIGH' as const:'LOW' as const}));
      const strategySelection=repairStrategySelectionService.select('TYPECHECK_FAILED',strategyCandidates,attempts.flatMap(item=>item.repairPlanIds));
      const selectedStrategy=strategySelection.selected?.strategy;
      const orderedPlans=selectedStrategy?[...acceptedPlans].sort((left,right)=>{const leftName=left.operations.map(operation=>operation.kind).sort().join('+')||'NO_OPERATION';const rightName=right.operations.map(operation=>operation.kind).sort().join('+')||'NO_OPERATION';return Number(rightName===selectedStrategy)-Number(leftName===selectedStrategy);}):acceptedPlans;
      const revision=candidateRepairRevisionService.create(
        workspace.files.map(file=>({path:file.path,content:file.candidateContent,sha256:file.candidateSha256})),
        orderedPlans
      );
      if(!revision.accepted)return {passed:false,initialWorkspaceId,finalWorkspaceId:workspaceId,attempts,stopReason:`REPAIR_REVISION_REJECTED:${revision.reasons.join('|')}`};
      const repairedByPath=new Map(revision.files.map(file=>[file.path,file]));
      const nextFiles=workspace.files.map(file=>{
        const repaired=repairedByPath.get(file.path);
        return {path:file.path,baselineContent:file.candidateContent,candidateContent:repaired?.candidateContent||file.candidateContent,evidenceIds:[...file.evidenceIds,...(repaired?.appliedRepairPlanIds||[])]};
      });
      const next=await isolatedCandidateWorkspaceService.create(`${workspace.issueId}:repair:${revision.revisionId}`,nextFiles,workspace.runId);
      workspaceId=next.workspaceId;
    }
    return {passed:false,initialWorkspaceId,finalWorkspaceId:workspaceId,attempts,stopReason:'REPAIR_LOOP_TERMINATED'};
  }

  private signature(validation:ValidationRunnerResult):string {
    return canonicalSha256({reasons:[...validation.reasons].sort(),plans:(validation.repairPlans||[]).map(plan=>({path:plan.path,operations:plan.operations,reasons:plan.reasons})).sort((a,b)=>a.path.localeCompare(b.path))});
  }
}
export const candidateRepairRetryLoopService=new CandidateRepairRetryLoopService();
