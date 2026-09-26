import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import type { FeatureDevelopmentPlan, FeatureAcceptanceCriterion } from './featureDevelopmentPlannerService';

export type TestFramework='NODE_MJS'|'TSX_SCRIPT';
export interface ExecutableFeatureTestCase { testId:string; criterionId:string; category:string; framework:TestFramework; filePath:string; command:string; fixtureContract:string[]; assertions:string[]; }
export interface ExecutableFeatureTestPlan { testPlanId:string; featurePlanId:string; framework:TestFramework; cases:ExecutableFeatureTestCase[]; validationRequirements:string[]; }
class ExecutableFeatureTestPlanService {
  public plan(feature:FeatureDevelopmentPlan,packageScripts:Record<string,string>):ExecutableFeatureTestPlan {
    const framework=this.framework(packageScripts);
    const cases=feature.acceptanceCriteria.map((criterion,index)=>this.testCase(feature,criterion,index,framework));
    return {testPlanId:`ETEST-${canonicalSha256({featurePlanId:feature.planId,framework,cases}).slice(0,24)}`,featurePlanId:feature.planId,framework,cases,validationRequirements:feature.acceptanceCriteria.filter(item=>item.required).map(item=>item.criterionId)};
  }
  private framework(scripts:Record<string,string>):TestFramework {return Object.values(scripts).some(value=>/tsx\s+/i.test(value))?'TSX_SCRIPT':'NODE_MJS';}
  private testCase(feature:FeatureDevelopmentPlan,criterion:FeatureAcceptanceCriterion,index:number,framework:TestFramework):ExecutableFeatureTestCase {
    const stem=feature.planId.toLowerCase().replace(/[^a-z0-9]+/g,'_');const ext=framework==='TSX_SCRIPT'?'ts':'mjs';
    const filePath=`scripts/verify_${stem}_${String(index+1).padStart(2,'0')}.${ext}`;
    const command=framework==='TSX_SCRIPT'?`tsx ${filePath}`:`node ${filePath}`;
    const fixtureContract=['DETERMINISTIC_INPUT','NO_NETWORK','NO_SECRET','ISOLATED_STATE'];
    if(criterion.evidenceKind==='PERSISTENCE')fixtureContract.push('SAVE_RELOAD_ROUNDTRIP');
    if(criterion.evidenceKind==='UI')fixtureContract.push('TYPED_UI_GATEWAY');
    return {testId:`FTEST-${canonicalSha256({criterionId:criterion.criterionId,filePath}).slice(0,20)}`,criterionId:criterion.criterionId,category:criterion.evidenceKind,framework,filePath,command,fixtureContract,assertions:[criterion.statement,'PROCESS_EXIT_ZERO','NO_UNHANDLED_EXCEPTION']};
  }
}
export const executableFeatureTestPlanService=new ExecutableFeatureTestPlanService();
