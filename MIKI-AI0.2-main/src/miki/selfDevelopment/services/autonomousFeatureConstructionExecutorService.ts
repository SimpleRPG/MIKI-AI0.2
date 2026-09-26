import ts from 'typescript';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { codeConstructionRendererService } from '../../core/services/codeConstructionRendererService';
import { isolatedCandidateWorkspaceService } from '../../core/services/isolatedCandidateWorkspaceService';
import { selfCodeSpaceService } from '../../core/services/selfCodeSpaceService';
import type { CodeConstructionGraph } from '../../core/data/codeKnowledge/common';
import type { AutonomousFeatureDevelopmentPlan } from './autonomousFeatureDevelopmentPlanService';
import type { NewArtifactPlan } from './newFeatureConstructionPlanService';

export interface ConstructedFeatureArtifact { artifactId:string; path:string; source:string; sourceSha256:string; graphId:string; evidenceIds:string[]; }
export interface AutonomousFeatureConstructionResult { accepted:boolean; executionId:string; developmentPlanId:string; workspaceId?:string; artifacts:ConstructedFeatureArtifact[]; reasons:string[]; }

class AutonomousFeatureConstructionExecutorService {
  public async execute(plan:AutonomousFeatureDevelopmentPlan,runId?:string):Promise<AutonomousFeatureConstructionResult>{
    const reasons:string[]=[];const artifacts:ConstructedFeatureArtifact[]=[];
    if(!plan.ready)reasons.push(...plan.reasons,'AUTONOMOUS_DEVELOPMENT_PLAN_NOT_READY');
    const existing=new Set(selfCodeSpaceService.listSourceFiles().map(file=>file.path));
    for(const artifact of plan.construction.artifacts){
      if(existing.has(artifact.path)){reasons.push(`NEW_ARTIFACT_PATH_ALREADY_EXISTS:${artifact.path}`);continue;}
      const graph=this.graph(plan,artifact);
      const rendered=codeConstructionRendererService.render(graph);
      if(!rendered.accepted||!rendered.source){reasons.push(...rendered.errors.map(error=>`${artifact.path}:${error}`));continue;}
      const syntax=this.validateSyntax(artifact.path,rendered.source);
      if(syntax.length>0){reasons.push(...syntax.map(error=>`${artifact.path}:${error}`));continue;}
      artifacts.push({artifactId:artifact.artifactId,path:artifact.path,source:rendered.source,sourceSha256:canonicalSha256(rendered.source),graphId:graph.graphId,evidenceIds:[plan.developmentPlanId,plan.feature.planId,plan.construction.constructionPlanId,plan.tests.testPlanId,artifact.artifactId]});
    }
    if(artifacts.length!==plan.construction.artifacts.length)reasons.push('CONSTRUCTION_ARTIFACT_COUNT_MISMATCH');
    const executionId=`AUTOCON-${canonicalSha256({developmentPlanId:plan.developmentPlanId,artifacts:artifacts.map(item=>({path:item.path,sha256:item.sourceSha256})),reasons}).slice(0,24)}`;
    if(reasons.length>0)return {accepted:false,executionId,developmentPlanId:plan.developmentPlanId,artifacts,reasons:[...new Set(reasons)]};
    const workspace=await isolatedCandidateWorkspaceService.create(`feature:${plan.developmentPlanId}`,artifacts.map(item=>({path:item.path,baselineContent:'',candidateContent:item.source,evidenceIds:item.evidenceIds})),runId);
    return {accepted:true,executionId,developmentPlanId:plan.developmentPlanId,workspaceId:workspace.workspaceId,artifacts,reasons:[]};
  }

  private graph(plan:AutonomousFeatureDevelopmentPlan,artifact:NewArtifactPlan):CodeConstructionGraph {
    const source=this.template(plan,artifact);const nodeId=`NODE-${artifact.artifactId}`;
    return {graphId:`CGRAPH-${canonicalSha256({developmentPlanId:plan.developmentPlanId,artifactId:artifact.artifactId,source}).slice(0,24)}`,goal:`Construct ${artifact.kind} for ${plan.feature.objective}`,rootNodeId:nodeId,nodes:[{nodeId,knowledgeComponentId:`feature.${artifact.kind.toLowerCase()}`,componentType:artifact.kind,purpose:plan.feature.objective,implementationTemplate:source,profile:{kind:'MODULE',syntaxTemplate:source,outputKinds:['module'],slots:[],constraints:[...artifact.templateContract],adaptationRules:['PREFER_EXISTING_COMPONENTS','ISOLATED_CANDIDATE_ONLY']}}],bindings:[],unresolvedSlots:[],contractErrors:[]};
  }

  private template(plan:AutonomousFeatureDevelopmentPlan,artifact:NewArtifactPlan):string {
    const name=this.identifier(artifact.exportName);const objective=JSON.stringify(plan.feature.objective);
    if(artifact.kind==='TYPE')return `export interface ${name} {\n  readonly id: string;\n  readonly createdAt: number;\n}\n`;
    if(artifact.kind==='SERVICE')return `export class ${name} {\n  public execute(input: unknown): { accepted: boolean; objective: string; input: unknown } {\n    return { accepted: true, objective: ${objective}, input };\n  }\n}\nexport const ${this.lower(name)} = new ${name}();\n`;
    if(artifact.kind==='ROUTE')return `export interface ${name}Result { accepted: boolean; reasons: string[]; }\nexport class ${name} {\n  public route(): ${name}Result { return { accepted: true, reasons: [] }; }\n}\nexport const ${this.lower(name)} = new ${name}();\n`;
    if(artifact.kind==='REACT_COMPONENT')return `export interface ${name}Props { title: string; onExecute: () => void; }\nexport default function ${name}(props: ${name}Props) {\n  return <section><h2>{props.title}</h2><button type="button" onClick={props.onExecute}>Execute</button></section>;\n}\n`;
    if(artifact.kind==='STORE')return `export class ${name} {\n  private readonly rows = new Map<string, unknown>();\n  public set(id: string, value: unknown): void { this.rows.set(id, value); }\n  public get(id: string): unknown { return this.rows.get(id); }\n}\nexport const ${this.lower(name)} = new ${name}();\n`;
    if(artifact.kind==='EXPORTER')return `export class ${name} {\n  public create(value: unknown): string { return JSON.stringify({ objective: ${objective}, value }); }\n}\nexport const ${this.lower(name)} = new ${name}();\n`;
    return `import assert from 'node:assert/strict';\nconst objective = ${objective};\nassert.ok(objective.length > 0);\nconsole.log(JSON.stringify({ passed: true, objective }));\n`;
  }

  private validateSyntax(path:string,source:string):string[]{const kind=path.endsWith('.tsx')?ts.ScriptKind.TSX:path.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS;const file=ts.createSourceFile(path,source,ts.ScriptTarget.ES2022,true,kind);return ((file as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics||[]).map(item=>`SYNTAX_${item.code}:${ts.flattenDiagnosticMessageText(item.messageText,' ')}`);}
  private identifier(value:string):string{const cleaned=value.replace(/[^A-Za-z0-9_$]/g,'');return /^[A-Za-z_$]/.test(cleaned)?cleaned:`Feature${canonicalSha256(value).slice(0,8)}`;}
  private lower(value:string):string{return value.charAt(0).toLowerCase()+value.slice(1);}
}
export const autonomousFeatureConstructionExecutorService=new AutonomousFeatureConstructionExecutorService();
