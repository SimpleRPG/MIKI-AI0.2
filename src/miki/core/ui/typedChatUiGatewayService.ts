/**
 * Typed UI boundary for the chat surface.
 *
 * ChatPanel imports conversation-facing capabilities only from this module.
 * The concrete 18-domain services remain hidden behind the core UI boundary,
 * allowing later command/query adapters to replace compatibility exports
 * without changing the UI component again.
 */
export { speechRecognitionService } from '../../conversation/services/speechRecognitionService';
export { systemLogger } from '../../../services/systemLogger';
export type { StepExecutionSnapshot } from '../../../services/systemLogger';
export { selfImprovementService } from '../../improvement/services/selfImprovementService';
export { skillsService } from '../../capability/services/skillsService';
export { completionJudgeService } from '../../verification/services/completionJudgeService';
export { workflowSynthesisService } from '../../execution/services/workflowSynthesisService';
export { experienceRouterService } from '../../experience/services/experienceRouterService';
export { autonomousEvolutionService } from '../../autonomy/services/autonomousEvolutionService';
export { mikiSelfCodingSuperchargerService } from '../../selfDevelopment/services/mikiSelfCodingSuperchargerService';
export { autonomousContinuousEvolutionService } from '../../autonomy/services/autonomousContinuousEvolutionService';
export { userProficiencyService } from '../../learning/services/userProficiencyService';
export { codeSkeletonService } from '../../selfDevelopment/services/codeSkeletonService';
export { conversationBranchService } from '../../conversation/services/conversationBranchService';
export { liveConversationRepairService } from '../../conversation/services/liveConversationRepairService';
export { whyAnswerInspectorService } from '../../selfAwareness/services/whyAnswerInspectorService';
export { conversationTaskboardService } from '../../conversation/services/conversationTaskboardService';
export { proactiveContextOsService } from '../../strategy/services/proactiveContextOsService';
export type { ProactiveInsightItem } from '../../strategy/services/proactiveContextOsService';
export { userFeedbackGovernanceService } from '../../verification/services/userFeedbackGovernanceService';
