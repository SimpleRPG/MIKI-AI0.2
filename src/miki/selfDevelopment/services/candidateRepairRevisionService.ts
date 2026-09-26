import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { astCandidateTransformationService } from './astCandidateTransformationService';
import type { DiagnosticRepairPlan } from './deterministicDiagnosticRepairService';

export interface RepairRevisionFile { path:string; baselineContent:string; baselineSha256:string; candidateContent:string; candidateSha256:string; appliedRepairPlanIds:string[]; }
export interface RepairRevisionResult { accepted:boolean; revisionId:string; files:RepairRevisionFile[]; reasons:string[]; }

class CandidateRepairRevisionService {
  public create(files:Array<{path:string;content:string;sha256:string}>,plans:DiagnosticRepairPlan[]):RepairRevisionResult {
    const acceptedPlans=plans.filter(plan=>plan.accepted&&plan.operations.length>0);
    const output:RepairRevisionFile[]=[];const reasons:string[]=[];
    for(const file of files){
      const filePlans=acceptedPlans.filter(plan=>plan.path===file.path);
      if(filePlans.length===0)continue;
      const transformed=astCandidateTransformationService.transform({path:file.path,baselineContent:file.content,expectedBaselineSha256:file.sha256,operations:filePlans.flatMap(plan=>plan.operations)});
      if(!transformed.accepted||!transformed.candidateContent||!transformed.candidateSha256){reasons.push(...transformed.reasons.map(reason=>`${file.path}:${reason}`));continue;}
      output.push({path:file.path,baselineContent:file.content,baselineSha256:file.sha256,candidateContent:transformed.candidateContent,candidateSha256:transformed.candidateSha256,appliedRepairPlanIds:filePlans.map(plan=>plan.planId)});
    }
    if(output.length===0&&reasons.length===0)reasons.push('NO_APPLICABLE_REPAIR_PLANS');
    const revisionId=`REPAIRREV-${canonicalSha256({files:output.map(file=>({path:file.path,candidateSha256:file.candidateSha256})),plans:acceptedPlans.map(plan=>plan.planId)}).slice(0,24)}`;
    return {accepted:output.length>0&&reasons.length===0,revisionId,files:output,reasons};
  }
}
export const candidateRepairRevisionService=new CandidateRepairRevisionService();
