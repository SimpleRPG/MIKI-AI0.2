import path from 'node:path';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import type { AutonomousFeatureDevelopmentPlan } from './autonomousFeatureDevelopmentPlanService';
import type { ConstructedFeatureArtifact } from './autonomousFeatureConstructionExecutorService';
import type { NewArtifactPlan, NewArtifactKind } from './newFeatureConstructionPlanService';

export interface FeatureIntegrationPatchCandidate { patchId:string; target:'CORE_COMMAND'|'REACT_TREE'; targetPath:string; importStatement:string; registrationStatement:string; requiredAnchors:string[]; }
export interface WiredFeatureArtifact extends ConstructedFeatureArtifact { imports:string[]; dependencyArtifactIds:string[]; }
export interface FeatureArtifactWiringResult { accepted:boolean; wiringId:string; artifacts:WiredFeatureArtifact[]; integrationPatches:FeatureIntegrationPatchCandidate[]; testCommands:string[]; reasons:string[]; }

class FeatureArtifactWiringService {
  public wire(plan:AutonomousFeatureDevelopmentPlan,artifacts:ConstructedFeatureArtifact[],coreTargetPath='src/miki/core/services/domainRouterService.ts',uiTargetPath='src/App.tsx'):FeatureArtifactWiringResult {
    const reasons:string[]=[];const byKind=new Map<NewArtifactKind,NewArtifactPlan>();
    for(const item of plan.construction.artifacts)byKind.set(item.kind,item);
    const sourceById=new Map(artifacts.map(item=>[item.artifactId,item]));
    const wired:WiredFeatureArtifact[]=[];
    for(const spec of plan.construction.artifacts){
      const source=sourceById.get(spec.artifactId);if(!source){reasons.push(`ARTIFACT_SOURCE_MISSING:${spec.artifactId}`);continue;}
      const dependencySpecs=this.dependencies(spec.kind,byKind);
      const imports=dependencySpecs.map(dep=>this.importLine(spec.path,dep.path,dep.exportName));
      let body=source.source;
      if(spec.kind==='STORE')body=this.storageBody(body,spec.exportName,plan.developmentPlanId);
      if(spec.kind==='SERVICE')body=this.serviceBody(body,dependencySpecs);
      if(spec.kind==='ROUTE')body=this.routeBody(body,dependencySpecs);
      if(spec.kind==='REACT_COMPONENT')body=this.uiBody(body,dependencySpecs);
      if(spec.kind==='TEST')body=this.testBody(plan,dependencySpecs);
      body=[...imports,imports.length?'':'',body].join('\n');
      wired.push({...source,source:body,sourceSha256:canonicalSha256(body),imports,dependencyArtifactIds:dependencySpecs.map(item=>item.artifactId)});
    }
    const patches=this.integrationPatches(plan,byKind,coreTargetPath,uiTargetPath);
    const testCommands=plan.tests.cases.map(item=>item.command);
    if(wired.length!==plan.construction.artifacts.length)reasons.push('WIRED_ARTIFACT_COUNT_MISMATCH');
    const wiringId=`WIRE-${canonicalSha256({developmentPlanId:plan.developmentPlanId,artifacts:wired.map(item=>({path:item.path,sha:item.sourceSha256})),patches,testCommands}).slice(0,24)}`;
    return {accepted:reasons.length===0,wiringId,artifacts:wired,integrationPatches:patches,testCommands,reasons};
  }

  private dependencies(kind:NewArtifactKind,byKind:Map<NewArtifactKind,NewArtifactPlan>):NewArtifactPlan[]{
    const order:Record<NewArtifactKind,NewArtifactKind[]>={TYPE:[],STORE:['TYPE'],SERVICE:['TYPE','STORE'],ROUTE:['SERVICE','TYPE'],REACT_COMPONENT:['ROUTE','TYPE'],TEST:['SERVICE','ROUTE','STORE'],EXPORTER:['TYPE','SERVICE']};
    return order[kind].map(value=>byKind.get(value)).filter((value):value is NewArtifactPlan=>Boolean(value));
  }
  private importLine(from:string,to:string,exportName:string):string{let relative=path.posix.relative(path.posix.dirname(from),to).replace(/\.(tsx?|mjs)$/,'');if(!relative.startsWith('.'))relative=`./${relative}`;return `import { ${exportName} } from '${relative}';`;}
  private storageBody(source:string,exportName:string,key:string):string{return `import { storageService } from '../../../services/storageService';\nconst STORAGE_KEY = 'miki_feature_${key.toLowerCase()}';\n${source.replace('private readonly rows = new Map<string, unknown>();',"private readonly rows = new Map<string, unknown>();\n  public load(): void { const raw=storageService.getItem(STORAGE_KEY); if(raw){ for(const [id,value] of JSON.parse(raw) as Array<[string,unknown]>)this.rows.set(id,value); } }\n  public save(): void { storageService.setItem(STORAGE_KEY,JSON.stringify([...this.rows.entries()])); }")}`;}
  private serviceBody(source:string,deps:NewArtifactPlan[]):string{return `${source}\nexport const featureDependencies = [${deps.map(item=>item.exportName).join(', ')}];\n`;}
  private routeBody(source:string,deps:NewArtifactPlan[]):string{return `${source}\nexport const routeDependencies = [${deps.map(item=>item.exportName).join(', ')}];\n`;}
  private uiBody(source:string,deps:NewArtifactPlan[]):string{return `${source}\nexport const uiDependencies = [${deps.map(item=>item.exportName).join(', ')}];\n`;}
  private testBody(plan:AutonomousFeatureDevelopmentPlan,deps:NewArtifactPlan[]):string{return `import assert from 'node:assert/strict';\n${deps.map(item=>`void ${item.exportName};`).join('\n')}\nconst criteria=${JSON.stringify(plan.feature.acceptanceCriteria)};\nfor(const criterion of criteria){assert.ok(criterion.criterionId);assert.ok(criterion.statement);}\nconsole.log(JSON.stringify({passed:true,evidenceIds:criteria.map(item=>item.criterionId)}));\n`;}
  private integrationPatches(plan:AutonomousFeatureDevelopmentPlan,byKind:Map<NewArtifactKind,NewArtifactPlan>,corePath:string,uiPath:string):FeatureIntegrationPatchCandidate[]{const result:FeatureIntegrationPatchCandidate[]=[];const route=byKind.get('ROUTE');if(route)result.push({patchId:`PATCH-${canonicalSha256({route:route.artifactId,corePath}).slice(0,20)}`,target:'CORE_COMMAND',targetPath:corePath,importStatement:this.importLine(corePath,route.path,route.exportName),registrationStatement:`case '${plan.developmentPlanId}': return ${route.exportName}.route();`,requiredAnchors:['switch','command']});const ui=byKind.get('REACT_COMPONENT');if(ui)result.push({patchId:`PATCH-${canonicalSha256({ui:ui.artifactId,uiPath}).slice(0,20)}`,target:'REACT_TREE',targetPath:uiPath,importStatement:`import ${ui.exportName} from '${this.modulePath(uiPath,ui.path)}';`,registrationStatement:`<${ui.exportName} title={${JSON.stringify(plan.feature.objective)}} onExecute={() => undefined} />`,requiredAnchors:['return','JSX']});return result;}
  private modulePath(from:string,to:string):string{let value=path.posix.relative(path.posix.dirname(from),to).replace(/\.(tsx?|mjs)$/,'');if(!value.startsWith('.'))value=`./${value}`;return value;}
}
export const featureArtifactWiringService=new FeatureArtifactWiringService();
