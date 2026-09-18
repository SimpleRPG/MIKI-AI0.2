export type CiExecutionEnvironment='DEVICE'|'SERVER'|'GITHUB_ACTIONS'|'MANUAL_REVIEW';
export interface EnvironmentRoute { stage:string; environment:CiExecutionEnvironment; reason:string; }
class ExecutionEnvironmentRouterService { route(stage:string):EnvironmentRoute { const normalized=stage.toUpperCase(); if(normalized==='DEVICE')return {stage,environment:'GITHUB_ACTIONS',reason:'APK_AND_ANDROID_CONTRACT'}; if(['STATIC','TYPECHECK','REGRESSION','COUNTEREXAMPLE','GENERALIZATION','PERSISTENCE'].includes(normalized))return {stage,environment:'SERVER',reason:'ISOLATED_NODE_RUNNER'}; return {stage,environment:'MANUAL_REVIEW',reason:'NO_VERIFIED_RUNNER'}; }}
export const executionEnvironmentRouterService=new ExecutionEnvironmentRouterService();
