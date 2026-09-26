import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import type { FeatureDevelopmentPlan, FeatureImplementationTask } from './featureDevelopmentPlannerService';

export type NewArtifactKind='TYPE'|'SERVICE'|'ROUTE'|'REACT_COMPONENT'|'STORE'|'TEST'|'EXPORTER';
export interface NewArtifactPlan { artifactId:string; kind:NewArtifactKind; path:string; exportName:string; dependsOn:string[]; strategy:'COMPONENT_REUSE'|'CONSTRUCTION_GRAPH'; templateContract:string[]; }
export interface NewFeatureConstructionPlan { constructionPlanId:string; featurePlanId:string; artifacts:NewArtifactPlan[]; unresolved:string[]; }
class NewFeatureConstructionPlanService {
  public plan(feature:FeatureDevelopmentPlan):NewFeatureConstructionPlan {
    const artifacts:NewArtifactPlan[]=[];const unresolved=[...feature.unresolved];
    const stem=this.stem(feature.objective);
    for(const task of feature.tasks){const spec=this.artifact(task,stem);if(!spec)continue;artifacts.push(spec);}
    if(artifacts.length===0)unresolved.push('NEW_ARTIFACT_PLAN_EMPTY');
    return {constructionPlanId:`NEWCON-${canonicalSha256({featurePlanId:feature.planId,artifacts}).slice(0,24)}`,featurePlanId:feature.planId,artifacts,unresolved:[...new Set(unresolved)]};
  }
  private artifact(task:FeatureImplementationTask,stem:string):NewArtifactPlan|undefined {
    const map:Record<string,[NewArtifactKind,string,string[]]>= {
      MODEL:['TYPE',`src/miki/selfDevelopment/types/${stem}Types.ts`,['EXPORTED_TYPES','NO_RUNTIME_SIDE_EFFECT']],
      SERVICE:['SERVICE',`src/miki/selfDevelopment/services/${stem}Service.ts`,['SINGLE_RESPONSIBILITY','NAMED_EXPORT']],
      CORE_ROUTE:['ROUTE',`src/miki/core/services/${stem}RouteService.ts`,['CORE_ENTRY_ONLY','TYPED_RESULT']],
      UI:['REACT_COMPONENT',`src/components/${stem}Panel.tsx`,['TYPED_PROPS','NO_DIRECT_STORAGE']],
      PERSISTENCE:['STORE',`src/miki/selfDevelopment/services/${stem}StoreService.ts`,['EXISTING_STORAGE_SERVICE','PERSISTENCE_RECEIPT']],
      TEST:['TEST',`scripts/verify_${stem}.mjs`,['DETERMINISTIC_FIXTURE','NONZERO_EXIT_ON_FAILURE']],
      EXPORT:['EXPORTER',`src/miki/selfDevelopment/services/${stem}ExportService.ts`,['COMPLETE_ARTIFACT','SHA256_MANIFEST']]
    };
    const row=map[task.kind];if(!row)return undefined;const [kind,path,templateContract]=row;
    return {artifactId:`ART-${canonicalSha256({taskId:task.taskId,path}).slice(0,20)}`,kind,path,exportName:this.exportName(stem,kind),dependsOn:[...task.dependencies],strategy:task.reuseRequired?'COMPONENT_REUSE':'CONSTRUCTION_GRAPH',templateContract};
  }
  private stem(text:string):string{const ascii=text.replace(/[^A-Za-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean).slice(0,5).join('');return ascii?ascii[0].toLowerCase()+ascii.slice(1):`feature${canonicalSha256(text).slice(0,8)}`;}
  private exportName(stem:string,kind:NewArtifactKind):string{return `${stem}${kind.toLowerCase().replace(/(^|_)([a-z])/g,(_,a,b)=>b.toUpperCase())}`;}
}
export const newFeatureConstructionPlanService=new NewFeatureConstructionPlanService();
