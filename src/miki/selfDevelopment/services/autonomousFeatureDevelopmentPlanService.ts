import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { featureDevelopmentPlannerService, type FeatureDevelopmentPlan } from './featureDevelopmentPlannerService';
import { newFeatureConstructionPlanService, type NewFeatureConstructionPlan } from './newFeatureConstructionPlanService';
import { executableFeatureTestPlanService, type ExecutableFeatureTestPlan } from './executableFeatureTestPlanService';
export interface AutonomousFeatureDevelopmentPlan { developmentPlanId:string; feature:FeatureDevelopmentPlan; construction:NewFeatureConstructionPlan; tests:ExecutableFeatureTestPlan; ready:boolean; reasons:string[]; }
class AutonomousFeatureDevelopmentPlanService {
  public plan(objective:string,targetPaths:string[],packageScripts:Record<string,string>):AutonomousFeatureDevelopmentPlan {
    const feature=featureDevelopmentPlannerService.plan(objective,targetPaths);
    const construction=newFeatureConstructionPlanService.plan(feature);
    const tests=executableFeatureTestPlanService.plan(feature,packageScripts);
    const reasons=[...feature.unresolved,...construction.unresolved];
    if(tests.cases.length===0)reasons.push('EXECUTABLE_TEST_PLAN_EMPTY');
    const seed={featurePlanId:feature.planId,constructionPlanId:construction.constructionPlanId,testPlanId:tests.testPlanId};
    return {developmentPlanId:`AUTODEV-${canonicalSha256(seed).slice(0,24)}`,feature,construction,tests,ready:reasons.length===0,reasons};
  }
}
export const autonomousFeatureDevelopmentPlanService=new AutonomousFeatureDevelopmentPlanService();
