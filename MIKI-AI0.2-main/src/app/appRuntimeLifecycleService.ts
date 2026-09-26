import { crossDomainCirculationService } from '../miki/core/services/crossDomainCirculationService';
import { domainIntegrationBootstrapService } from '../miki/core/services/domainIntegrationBootstrapService';
import { capabilityLearningService } from '../miki/capability/services/capabilityLearningService';
import { initializeChapter69to90 } from '../miki';
import { componentArtifactStoreService } from '../miki/capability/services/componentArtifactStoreService';
import { componentRegistryService } from '../miki/capability/services/componentRegistryService';
import { autonomousHardeningService } from '../miki/autonomy/services/autonomousHardeningService';
import { resourceGovernanceService } from '../miki/safety/services/resourceGovernanceService';
import { situationalAwarenessService } from '../miki/selfAwareness/services/situationalAwarenessService';
import { automationStudioService } from '../miki/execution/services/automationStudioService';
import { causalInvestigationService } from '../miki/research/services/causalInvestigationService';
import { benchmarkFactoryService } from '../miki/verification/services/benchmarkFactoryService';
import { dataUnderstandingService } from '../miki/research/services/dataUnderstandingService';
import { unknownResolutionService } from '../miki/unknown/services/unknownResolutionService';
import { reversibilityService } from '../miki/safety/services/reversibilityService';
import { knowledgeOperatingSystemService } from '../miki/selfAwareness/services/knowledgeOperatingSystemService';
import { counterfactualWorkSimulatorService } from '../miki/unknown/services/counterfactualWorkSimulatorService';
import { personalApiGatewayService } from '../miki/execution/services/personalApiGatewayService';
import { improvementRegressionCoordinatorService } from '../miki/improvement/services/improvementRegressionCoordinatorService';
import { taskLineageService } from '../miki/execution/services/taskLineageService';
import { taskCaseMemoryService } from '../miki/memory/services/taskCaseMemoryService';
import { improvementCanaryRollbackService } from '../miki/improvement/services/improvementCanaryRollbackService';
import { taskExecutionOrchestratorService } from '../miki/execution/services/taskExecutionOrchestratorService';
import { recoveryOrchestratorService } from '../miki/safety/services/recoveryOrchestratorService';
import { executionLearningCoordinatorService } from '../miki/learning/services/executionLearningCoordinatorService';
import { failureUnderstandingService } from '../miki/memory/services/failureUnderstandingService';
import { decisionLearningService } from '../miki/learning/services/decisionLearningService';
import { taskResultFeedbackService } from '../miki/learning/services/taskResultFeedbackService';
import { taskConversationFeedbackService } from '../miki/learning/services/taskConversationFeedbackService';
import { selfImprovementMetricsService } from '../miki/improvement/services/selfImprovementMetricsService';

class AppRuntimeLifecycleService {
  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    crossDomainCirculationService.initialize();
    void domainIntegrationBootstrapService.initialize();
    capabilityLearningService.initialize();
    initializeChapter69to90();
    componentArtifactStoreService.reconcile(componentRegistryService.getAllComponents());
    autonomousHardeningService.reconcileHardeningResults();
    resourceGovernanceService.initialize();
    situationalAwarenessService.initialize();

    void automationStudioService;
    void causalInvestigationService;
    void benchmarkFactoryService;
    void dataUnderstandingService;
    void unknownResolutionService;
    void reversibilityService;
    void knowledgeOperatingSystemService;
    void counterfactualWorkSimulatorService;
    void personalApiGatewayService;

    improvementRegressionCoordinatorService.initialize();
    taskLineageService.initialize();
    taskCaseMemoryService.initialize();
    selfImprovementMetricsService.initialize();
    improvementCanaryRollbackService.initialize();
    taskExecutionOrchestratorService.initialize();
    recoveryOrchestratorService.initialize();
    executionLearningCoordinatorService.initialize();
    failureUnderstandingService.initialize();
    decisionLearningService.snapshot();
    taskResultFeedbackService.initialize();
    taskConversationFeedbackService.initialize();
  }

  dispose(): void {
    if (!this.initialized) {
      return;
    }
    this.initialized = false;

    taskConversationFeedbackService.dispose();
    domainIntegrationBootstrapService.dispose();
    crossDomainCirculationService.dispose();
    taskResultFeedbackService.dispose();
    executionLearningCoordinatorService.dispose();
    recoveryOrchestratorService.dispose();
    taskExecutionOrchestratorService.dispose();
    taskCaseMemoryService.dispose();
    selfImprovementMetricsService.dispose();
    taskLineageService.dispose();
    improvementRegressionCoordinatorService.dispose();
    capabilityLearningService.dispose();
  }
}

export const appRuntimeLifecycleService = new AppRuntimeLifecycleService();
