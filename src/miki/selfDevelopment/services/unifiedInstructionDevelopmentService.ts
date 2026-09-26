import { autonomousFeatureDevelopmentPlanService, type AutonomousFeatureDevelopmentPlan } from './autonomousFeatureDevelopmentPlanService';
import { autonomousFeatureConstructionExecutorService, type AutonomousFeatureConstructionResult } from './autonomousFeatureConstructionExecutorService';
import { autonomousFeatureWiringPipelineService, type AutonomousFeatureWiringPipelineResult } from './autonomousFeatureWiringPipelineService';
import { developmentStrategyDecisionService, type DevelopmentStrategyDecision } from './developmentStrategyDecisionService';
import { unifiedDevelopmentCompletionService, type UnifiedDevelopmentCompletionResult } from './unifiedDevelopmentCompletionService';
export type InstructionSource='NATURAL_LANGUAGE'|'WORK_INSTRUCTION';
export interface UnifiedInstructionDevelopmentResult { source:InstructionSource; normalizedInstruction:string; strategy:DevelopmentStrategyDecision; plan:AutonomousFeatureDevelopmentPlan; construction?:AutonomousFeatureConstructionResult; wiring?:AutonomousFeatureWiringPipelineResult; completion?:UnifiedDevelopmentCompletionResult; ready:boolean; reasons:string[]; }
class UnifiedInstructionDevelopmentService {
 public async prepare(instruction:string,targetPaths:string[],packageScripts:Record<string,string>,runId?:string):Promise<UnifiedInstructionDevelopmentResult>{
  const normalizedInstruction=instruction.replace(/\r\n/g,'\n').trim();
  const source=this.detectSource(normalizedInstruction);
  const strategy=developmentStrategyDecisionService.decide(normalizedInstruction,targetPaths);
  const effectiveTargets=strategy.matchedPaths.length?strategy.matchedPaths:targetPaths;
  const plan=autonomousFeatureDevelopmentPlanService.plan(normalizedInstruction,effectiveTargets,packageScripts);
  if(!plan.ready)return {source,normalizedInstruction,strategy,plan,ready:false,reasons:[...plan.reasons]};
  const construction=await autonomousFeatureConstructionExecutorService.execute(plan,runId);
  if(!construction.accepted)return {source,normalizedInstruction,strategy,plan,construction,ready:false,reasons:[...construction.reasons]};
  const wiring=await autonomousFeatureWiringPipelineService.execute(plan,construction,runId);
  const prepared={source,normalizedInstruction,strategy,plan,construction,wiring,ready:wiring.accepted,reasons:[...wiring.reasons]};
  const completion=await unifiedDevelopmentCompletionService.complete(prepared,packageScripts);
  return {...prepared,completion,ready:completion.completed,reasons:[...new Set([...prepared.reasons,...completion.reasons])]};
 }
 private detectSource(value:string):InstructionSource{return /作業指示書|目的[:：]|要件[:：]|検証[:：]|対象ファイル[:：]/.test(value)?'WORK_INSTRUCTION':'NATURAL_LANGUAGE';}
}
export const unifiedInstructionDevelopmentService=new UnifiedInstructionDevelopmentService();
