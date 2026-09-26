import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import type { AstCandidateOperation } from './astCandidateTransformationService';

export type GenerationStrategy='AST_TRANSFORM'|'COMPONENT_REUSE'|'CONSTRUCTION_GRAPH'|'CAPABILITY_GAP';
export type GenerationStepStatus='READY'|'BLOCKED'|'FALLBACK';

export interface IntegratedGenerationStep {
  stepId:string;
  order:number;
  strategy:GenerationStrategy;
  status:GenerationStepStatus;
  targetPaths:string[];
  dependsOn:string[];
  astOperations:Array<{path:string;operations:AstCandidateOperation[]}>;
  componentIds:string[];
  knowledgeIds:string[];
  reasons:string[];
}

export interface IntegratedGenerationPlan {
  schemaVersion:1;
  planId:string;
  objective:string;
  targetPaths:string[];
  requirementContractId?:string;
  repositorySnapshotSha256?:string;
  steps:IntegratedGenerationStep[];
  unresolved:string[];
  createdAt:number;
}

export interface IntegratedGenerationPlanInput {
  objective:string;
  targetPaths:string[];
  requirementContractId?:string;
  repositorySnapshotSha256?:string;
  astTransformations?:Array<{path:string;operations:AstCandidateOperation[]}>;
  reusableComponentIds?:string[];
  codeKnowledgeIds?:string[];
  priorFailureReasons?:string[];
}

class IntegratedGenerationPlanService {
  public plan(input:IntegratedGenerationPlanInput):IntegratedGenerationPlan {
    const targetPaths=this.unique(input.targetPaths);
    const ast=(input.astTransformations||[])
      .filter(item=>targetPaths.includes(item.path)&&item.operations.length>0)
      .map(item=>({path:item.path,operations:[...item.operations]}));
    const componentIds=this.unique(input.reusableComponentIds||[]);
    const knowledgeIds=this.unique(input.codeKnowledgeIds||[]);
    const priorFailures=this.unique(input.priorFailureReasons||[]);
    const steps:IntegratedGenerationStep[]=[];

    if(ast.length>0){
      steps.push(this.step(1,'AST_TRANSFORM','READY',targetPaths,[],ast,[],knowledgeIds,['EXPLICIT_DETERMINISTIC_AST_OPERATIONS']));
    }
    if(componentIds.length>0){
      steps.push(this.step(steps.length+1,'COMPONENT_REUSE','FALLBACK',targetPaths,steps.slice(-1).map(item=>item.stepId),[],componentIds,knowledgeIds,['VERIFIED_COMPONENTS_AVAILABLE']));
    }
    steps.push(this.step(steps.length+1,'CONSTRUCTION_GRAPH',ast.length>0||componentIds.length>0?'FALLBACK':'READY',targetPaths,steps.slice(-1).map(item=>item.stepId),[],componentIds,knowledgeIds,['EXISTING_NON_LLM_SYNTHESIS_PATH']));
    steps.push(this.step(steps.length+1,'CAPABILITY_GAP','FALLBACK',targetPaths,steps.slice(-1).map(item=>item.stepId),[],[],knowledgeIds,['NO_VERIFIED_GENERATION_STRATEGY_COMPLETED',...priorFailures]));

    const unresolved:string[]=[];
    if(!input.objective.trim())unresolved.push('OBJECTIVE_REQUIRED');
    if(targetPaths.length===0)unresolved.push('TARGET_PATHS_REQUIRED');
    const seed={objective:input.objective.trim(),targetPaths,requirementContractId:input.requirementContractId,repositorySnapshotSha256:input.repositorySnapshotSha256,steps:steps.map(item=>({strategy:item.strategy,targetPaths:item.targetPaths,componentIds:item.componentIds,knowledgeIds:item.knowledgeIds,astOperations:item.astOperations}))};
    return {schemaVersion:1,planId:`GENPLAN-${canonicalSha256(seed).slice(0,24)}`,objective:input.objective.trim(),targetPaths,requirementContractId:input.requirementContractId,repositorySnapshotSha256:input.repositorySnapshotSha256,steps,unresolved,createdAt:Date.now()};
  }

  public next(plan:IntegratedGenerationPlan,completedStrategies:GenerationStrategy[],failedStrategies:GenerationStrategy[]):IntegratedGenerationStep|undefined {
    const completed=new Set(completedStrategies);const failed=new Set(failedStrategies);
    return plan.steps.find(step=>!completed.has(step.strategy)&&!failed.has(step.strategy)&&step.dependsOn.every(id=>plan.steps.some(candidate=>candidate.stepId===id)));
  }

  private step(order:number,strategy:GenerationStrategy,status:GenerationStepStatus,targetPaths:string[],dependsOn:string[],astOperations:Array<{path:string;operations:AstCandidateOperation[]}>,componentIds:string[],knowledgeIds:string[],reasons:string[]):IntegratedGenerationStep {
    const seed={order,strategy,targetPaths,dependsOn,astOperations,componentIds,knowledgeIds,reasons};
    return {stepId:`GENSTEP-${canonicalSha256(seed).slice(0,20)}`,order,strategy,status,targetPaths:[...targetPaths],dependsOn:[...dependsOn],astOperations,componentIds:[...componentIds],knowledgeIds:[...knowledgeIds],reasons:[...reasons]};
  }

  private unique(values:string[]):string[]{return [...new Set(values.map(value=>String(value||'').trim()).filter(Boolean))].sort();}
}

export const integratedGenerationPlanService=new IntegratedGenerationPlanService();
