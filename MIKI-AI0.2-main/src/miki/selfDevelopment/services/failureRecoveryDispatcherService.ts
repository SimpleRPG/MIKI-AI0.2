import { candidateRepairRetryLoopService } from './candidateRepairRetryLoopService';
import { contractPropagationService } from './contractPropagationService';
import { featureArtifactWiringService } from './featureArtifactWiringService';
import { capabilityGapService } from '../../capability/services/capabilityGapService';
import type { FailureRoutingDecision } from './developmentFailureRoutingService';
export interface FailureRecoveryContext { decision:FailureRoutingDecision; workspaceId:string; instruction:string; contractRequest?:any; wiringRequest?:{plan:any;artifacts:any[]}; }
class FailureRecoveryDispatcherService{
 public async dispatch(context:FailureRecoveryContext):Promise<unknown>{switch(context.decision.route){case 'LOCAL_REPAIR':return candidateRepairRetryLoopService.run(context.workspaceId);case 'CONTRACT_PROPAGATION':return context.contractRequest?contractPropagationService.plan(context.contractRequest):{blocked:true,reason:'CONTRACT_REQUEST_REQUIRED'};case 'WIRING_REVISION':return context.wiringRequest?featureArtifactWiringService.wire(context.wiringRequest.plan,context.wiringRequest.artifacts):{blocked:true,reason:'WIRING_REQUEST_REQUIRED'};case 'INTEGRATION_REVISION':return {reanalyseIntegrationTargets:true,workspaceId:context.workspaceId};case 'CAPABILITY_GAP':return capabilityGapService.recordGap({description:context.instruction,gap_type:'failure',capabilityId:'self_development',impact:'HIGH',current_workaround:'人手評価',candidate_solution:context.decision.reasons.join('|'),evidenceIds:[context.decision.decisionId]});default:return {replanRequired:true};}}
}
export const failureRecoveryDispatcherService=new FailureRecoveryDispatcherService();
