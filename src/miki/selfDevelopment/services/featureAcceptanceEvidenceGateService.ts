import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { reviewCandidateExportService, type ReviewCandidatePackage } from '../../core/services/reviewCandidateExportService';
import type { AutonomousFeatureDevelopmentPlan } from './autonomousFeatureDevelopmentPlanService';
import type { FeatureCandidateAnalysis } from './featureCandidateAnalysisService';

export interface AcceptanceEvidence { criterionId:string; evidenceIds:string[]; passed:boolean; }
export interface FeatureAcceptanceGateResult { gateId:string; allowed:boolean; missingCriterionIds:string[]; failedCriterionIds:string[]; reviewPackage?:ReviewCandidatePackage; reasons:string[]; }
class FeatureAcceptanceEvidenceGateService {
  public evaluate(workspaceId:string,plan:AutonomousFeatureDevelopmentPlan,analysis:FeatureCandidateAnalysis,evidence:AcceptanceEvidence[]):FeatureAcceptanceGateResult {
    const indexed=new Map(evidence.map(item=>[item.criterionId,item]));
    const required=plan.feature.acceptanceCriteria.filter(item=>item.required);
    const missing=required.filter(item=>!indexed.has(item.criterionId)||indexed.get(item.criterionId)?.evidenceIds.length===0).map(item=>item.criterionId);
    const failed=required.filter(item=>indexed.has(item.criterionId)&&indexed.get(item.criterionId)?.passed!==true).map(item=>item.criterionId);
    const reasons:string[]=[];if(!analysis.passed)reasons.push('FEATURE_PROGRAM_ANALYSIS_FAILED');if(missing.length>0)reasons.push('ACCEPTANCE_EVIDENCE_MISSING');if(failed.length>0)reasons.push('ACCEPTANCE_CRITERION_FAILED');
    let reviewPackage:ReviewCandidatePackage|undefined;
    if(reasons.length===0){reviewPackage=reviewCandidateExportService.create(workspaceId);if(!reviewPackage)reasons.push('REVIEW_PACKAGE_GATE_REJECTED');}
    const gateId=`ACGATE-${canonicalSha256({workspaceId,planId:plan.developmentPlanId,analysisId:analysis.analysisId,missing,failed,evidence}).slice(0,24)}`;
    return {gateId,allowed:reasons.length===0&&Boolean(reviewPackage),missingCriterionIds:missing,failedCriterionIds:failed,reviewPackage,reasons};
  }
}
export const featureAcceptanceEvidenceGateService=new FeatureAcceptanceEvidenceGateService();
