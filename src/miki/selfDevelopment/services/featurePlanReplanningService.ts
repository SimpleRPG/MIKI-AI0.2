import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { autonomousFeatureDevelopmentPlanService, type AutonomousFeatureDevelopmentPlan } from './autonomousFeatureDevelopmentPlanService';
export interface FeatureReplanResult { revisionId:string; previousPlanId:string; plan:AutonomousFeatureDevelopmentPlan; reusedArtifactPaths:string[]; reasons:string[]; }
class FeaturePlanReplanningService {
 public replan(previous:AutonomousFeatureDevelopmentPlan,failureReasons:string[],packageScripts:Record<string,string>):FeatureReplanResult{const objective=`${previous.feature.objective}\n再計画条件:${[...new Set(failureReasons)].join('|')}`;const plan=autonomousFeatureDevelopmentPlanService.plan(objective,previous.feature.tasks.flatMap(item=>item.targetPaths),packageScripts);const previousPaths=new Set(previous.construction.artifacts.map(item=>item.path));const reused=plan.construction.artifacts.map(item=>item.path).filter(item=>previousPaths.has(item));return {revisionId:`FREPLAN-${canonicalSha256({previous:previous.developmentPlanId,next:plan.developmentPlanId,failureReasons}).slice(0,24)}`,previousPlanId:previous.developmentPlanId,plan,reusedArtifactPaths:reused,reasons:failureReasons};}
}
export const featurePlanReplanningService=new FeaturePlanReplanningService();
