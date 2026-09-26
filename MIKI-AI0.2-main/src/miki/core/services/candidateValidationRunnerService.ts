import { apiUrl, getCustomApiHeaders } from '../../../services/api';
import { selfCodeSpaceService } from './selfCodeSpaceService';
import { isolatedCandidateWorkspaceService } from './isolatedCandidateWorkspaceService';
import { candidateValidationEvidenceService, type ValidationStage } from './candidateValidationEvidenceService';
import { shadowEvaluationService } from './shadowEvaluationService';
import { executionEnvironmentRouterService } from './executionEnvironmentRouterService';
import { candidateWriteGuardService } from './candidateWriteGuardService';
import { improvementIntakeRouterService } from './improvementIntakeRouterService';
import { deterministicDiagnosticRepairService, type DiagnosticRepairPlan, type TypeScriptDiagnosticInput } from '../../selfDevelopment/services/deterministicDiagnosticRepairService';
import { contractTestIntentService, type ContractTestIntent } from '../../selfDevelopment/services/contractTestIntentService';
export interface ValidationRunnerResult { passed:boolean; workspaceId:string; candidateHash?:string; passedChecks?:string[]; failedChecks?:string[]; unexecutedChecks?:string[]; evidenceIds?:string[]; reasons:string[]; rolledBack?:boolean; repairPlans?:DiagnosticRepairPlan[]; testIntents?:ContractTestIntent[]; retryRecommended?:boolean; }
class CandidateValidationRunnerService {
 async run(workspaceId:string):Promise<ValidationRunnerResult>{
  const workspace=isolatedCandidateWorkspaceService.get(workspaceId);
  if(!workspace)return {passed:false,workspaceId,reasons:['WORKSPACE_NOT_FOUND']};
  const candidateSha256=workspace.candidateRevisionSha256||'';
  if(!candidateSha256)return this.rollbackFailure(workspaceId,workspace.writeGuardId,['CANDIDATE_HASH_MISSING']);
  const sourceFiles=selfCodeSpaceService.listSourceFiles();
  const run=workspace.runId?improvementIntakeRouterService.get(workspace.runId):undefined;
  const validationRequirements=Array.isArray(run?.payload.validationRequirements)
    ? run.payload.validationRequirements.filter((value):value is string=>typeof value==='string'&&Boolean(value.trim()))
    : [];
  const testCommands=Array.isArray(run?.payload.testCommands)?run.payload.testCommands.filter((value):value is string=>typeof value==='string'&&Boolean(value.trim())):[];
  const acceptanceCriterionIds=Array.isArray(run?.payload.acceptanceCriterionIds)?run.payload.acceptanceCriterionIds.filter((value):value is string=>typeof value==='string'&&Boolean(value.trim())):[];
  const contractField=typeof run?.payload.contractFieldName==='string'?run.payload.contractFieldName.trim():'';
  const contractCondition=typeof run?.payload.contractValidationCondition==='string'?run.payload.contractValidationCondition.trim():undefined;
  const testIntents=contractField?contractTestIntentService.create(contractField,contractCondition):[];
  const executionRoutes=['STATIC','TYPECHECK','REGRESSION','COUNTEREXAMPLE','GENERALIZATION','PERSISTENCE','DEVICE'].map(stage=>executionEnvironmentRouterService.route(stage));
  if(executionRoutes.some(route=>route.environment==='MANUAL_REVIEW'))return this.rollbackFailure(workspaceId,workspace.writeGuardId,['VALIDATION_EXECUTION_ENVIRONMENT_MISSING']);
  let response:Response;
  try{response=await fetch(apiUrl('/api/candidate-validation/run'),{method:'POST',headers:getCustomApiHeaders(),body:JSON.stringify({workspaceId,candidateSha256,sourceFiles,validationRequirements,contractTestIntents:testIntents,testCommands,acceptanceCriterionIds,candidateFiles:workspace.files.map(file=>({path:file.path,baselineContent:file.baselineContent,candidateContent:file.candidateContent,baselineSha256:file.baselineSha256,candidateSha256:file.candidateSha256}))})});}
  catch(error){return this.rollbackFailure(workspaceId,workspace.writeGuardId,[error instanceof Error?`VALIDATION_REQUEST_FAILED:${error.message}`:'VALIDATION_REQUEST_FAILED']);}
  if(!response.ok)return this.rollbackFailure(workspaceId,workspace.writeGuardId,[`VALIDATION_HTTP_${response.status}`]);
  const body=await response.json();
  const diagnostics=Array.isArray(body.diagnostics)?body.diagnostics:[];
  const repairPlans=diagnostics
    .filter((item:unknown):item is TypeScriptDiagnosticInput=>Boolean(item)&&typeof item==='object'&&typeof (item as TypeScriptDiagnosticInput).code==='number'&&typeof (item as TypeScriptDiagnosticInput).path==='string')
    .map((item:TypeScriptDiagnosticInput)=>deterministicDiagnosticRepairService.plan(item));
  const stages=Array.isArray(body.stages)?body.stages:[];
  for(const row of stages)candidateValidationEvidenceService.record({workspaceId,candidateSha256,stage:row.stage as ValidationStage,passed:Boolean(row.passed),command:String(row.command||''),exitCode:Number(row.exitCode??1),startedAt:Number(row.startedAt||Date.now()),completedAt:Number(row.completedAt||Date.now()),logRef:String(row.logRef||'')});
  if(body.shadow?.baseline&&body.shadow?.candidate)shadowEvaluationService.compare(workspaceId,body.shadow.baseline,body.shadow.candidate);
  const evaluation=candidateValidationEvidenceService.evaluate(workspaceId,candidateSha256);
  const reasons=[...evaluation.missing.map(value=>`MISSING_${value}`),...evaluation.failed.map(value=>`FAILED_${value}`),...(Array.isArray(body.reasons)?body.reasons:[])];
  const passed=evaluation.passed&&Boolean(body.shadow?.passed);
  if(!passed){
    const failed=this.rollbackFailure(workspaceId,workspace.writeGuardId,reasons.length>0?reasons:['VALIDATION_FAILED']);
    return {...failed,repairPlans,testIntents,retryRecommended:repairPlans.some(plan=>plan.accepted)};
  }
  isolatedCandidateWorkspaceService.setStatus(workspaceId,'SHADOW_PASSED');
  return {passed:true,workspaceId,candidateHash:candidateSha256,passedChecks:candidateValidationEvidenceService.list(workspaceId).filter(row=>row.candidateSha256===candidateSha256&&row.passed&&row.exitCode===0).map(row=>row.stage),failedChecks:evaluation.failed,unexecutedChecks:evaluation.missing,evidenceIds:evaluation.evidenceIds,reasons:[],repairPlans:[],testIntents,retryRecommended:false};
 }
 private rollbackFailure(workspaceId:string,guardId:string,reasons:string[]):ValidationRunnerResult{
  candidateWriteGuardService.rollback(guardId);
  isolatedCandidateWorkspaceService.setStatus(workspaceId,'REJECTED');
  return {passed:false,workspaceId,reasons,rolledBack:true};
 }
}
export const candidateValidationRunnerService=new CandidateValidationRunnerService();
