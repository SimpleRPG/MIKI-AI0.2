import { isolatedCandidateWorkspaceService } from '../../core/services/isolatedCandidateWorkspaceService';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import type { AutonomousFeatureDevelopmentPlan } from './autonomousFeatureDevelopmentPlanService';
import type { AutonomousFeatureConstructionResult } from './autonomousFeatureConstructionExecutorService';
import { featureArtifactWiringService, type FeatureArtifactWiringResult } from './featureArtifactWiringService';
import { featureCandidateAnalysisService, type FeatureCandidateAnalysis } from './featureCandidateAnalysisService';
export interface AutonomousFeatureWiringPipelineResult { accepted:boolean; pipelineId:string; workspaceId?:string; wiring:FeatureArtifactWiringResult; analysis:FeatureCandidateAnalysis; testCommands:string[]; validationRequirements:string[]; reasons:string[]; }
class AutonomousFeatureWiringPipelineService {
  public async execute(plan:AutonomousFeatureDevelopmentPlan,construction:AutonomousFeatureConstructionResult,runId?:string):Promise<AutonomousFeatureWiringPipelineResult>{
    const wiring=featureArtifactWiringService.wire(plan,construction.artifacts);const analysis=featureCandidateAnalysisService.analyze(wiring.artifacts);const reasons=[...construction.reasons,...wiring.reasons];if(!construction.accepted)reasons.push('CONSTRUCTION_NOT_ACCEPTED');if(!analysis.passed)reasons.push(...analysis.diagnostics.map(item=>`PROGRAM_${item.code}:${item.path}`),...analysis.cycles.map(cycle=>`IMPORT_CYCLE:${cycle.join('>')}`));
    const pipelineId=`FWPIPE-${canonicalSha256({developmentPlanId:plan.developmentPlanId,wiringId:wiring.wiringId,analysisId:analysis.analysisId,reasons}).slice(0,24)}`;
    if(reasons.length>0)return {accepted:false,pipelineId,wiring,analysis,testCommands:wiring.testCommands,validationRequirements:plan.tests.validationRequirements,reasons:[...new Set(reasons)]};
    const workspace=await isolatedCandidateWorkspaceService.create(`feature-wired:${plan.developmentPlanId}`,wiring.artifacts.map(item=>({path:item.path,baselineContent:'',candidateContent:item.source,evidenceIds:[...item.evidenceIds,wiring.wiringId,analysis.analysisId]})),runId);
    return {accepted:true,pipelineId,workspaceId:workspace.workspaceId,wiring,analysis,testCommands:wiring.testCommands,validationRequirements:plan.tests.validationRequirements,reasons:[]};
  }
}
export const autonomousFeatureWiringPipelineService=new AutonomousFeatureWiringPipelineService();
