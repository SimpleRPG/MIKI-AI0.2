import { canonicalSha256 } from './canonicalSha256Service';
export type RecoveryAction='SEARCH_LOCAL'|'RESEARCH'|'SYNTHESIZE_KNOWLEDGE'|'SYNTHESIZE_COMPONENT'|'SYNTHESIZE_ADAPTER'|'SYNTHESIZE_VALIDATOR'|'REQUEST_DEVICE_RUNNER'|'REQUEST_COMPILER_RUNNER'|'REQUEST_ENGINE_RUNNER'|'ASK_USER';
export interface MissingCapabilityRecoveryPlan{planId:string;reason:string;actions:RecoveryAction[];completionCriteria:string[];terminalOnlyWhen:string[];}
class MissingCapabilityRecoveryService{
 plan(reason:string):MissingCapabilityRecoveryPlan{
  const actions:RecoveryAction[]=['SEARCH_LOCAL'];
  if(/EVIDENCE|RESEARCH|SPEC|UNKNOWN/i.test(reason))actions.push('RESEARCH','SYNTHESIZE_KNOWLEDGE');
  if(/COMPONENT|CONSTRUCTION|PRODUCER|MATERIALIZATION|IMPLEMENTATION/i.test(reason))actions.push('SYNTHESIZE_COMPONENT');
  if(/ADAPTER|FORMAT|BINARY/i.test(reason))actions.push('SYNTHESIZE_ADAPTER');
  if(/VALIDATION|TEST|VERIFY/i.test(reason))actions.push('SYNTHESIZE_VALIDATOR');
  if(/DEVICE|ANDROID|WORKMANAGER|PERMISSION/i.test(reason))actions.push('REQUEST_DEVICE_RUNNER');
  if(/COMPILER|TYPECHECK|LANGUAGE/i.test(reason))actions.push('REQUEST_COMPILER_RUNNER');
  if(/ENGINE|BINARY/i.test(reason))actions.push('REQUEST_ENGINE_RUNNER');
  if(actions.length===1)actions.push('RESEARCH','SYNTHESIZE_KNOWLEDGE','SYNTHESIZE_COMPONENT');
  const unique=[...new Set(actions)];
  const completionCriteria=['EVIDENCE_LINKED','CONTRACT_COMPLETE','CANDIDATE_ASSET_VERIFIED','IMPLEMENTATION_ARTIFACT_AVAILABLE_OR_EXTERNAL_RUNNER_RECEIPT','NO_UNVERIFIED_SYMBOLS'];
  const terminalOnlyWhen=['BOUNDED_ATTEMPTS_EXHAUSTED','AUTHORITATIVE_SPEC_UNAVAILABLE','REQUIRED_EXTERNAL_PERMISSION_MISSING','USER_DECISION_REQUIRED'];
  return {planId:`MCR-${canonicalSha256({reason,actions:unique,completionCriteria,terminalOnlyWhen}).slice(0,20)}`,reason,actions:unique,completionCriteria,terminalOnlyWhen};
 }
 planAll(reasons:string[]):MissingCapabilityRecoveryPlan[]{return [...new Set(reasons)].map(reason=>this.plan(reason));}
}
export const missingCapabilityRecoveryService=new MissingCapabilityRecoveryService();
