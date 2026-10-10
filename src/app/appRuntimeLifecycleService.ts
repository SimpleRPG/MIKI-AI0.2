import { systemLogger } from '../services/systemLogger';
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
  private generation = 0;

  private yieldToBrowser(): Promise<void> {
    return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    const generation = ++this.generation;

    const stages: Array<{ name: string; run: () => void | Promise<void> }> = [
      { name: 'crossDomainCirculationService.initialize', run: () => crossDomainCirculationService.initialize() },
      {
        name: 'domainIntegrationBootstrapService.initialize',
        run: async () => {
          try {
            await domainIntegrationBootstrapService.initialize();
          } catch (error) {
            systemLogger.warn(
              'SYSTEM',
              `[DomainIntegration] bootstrap failed: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        },
      },
      { name: 'capabilityLearningService.initialize', run: () => capabilityLearningService.initialize() },
      { name: 'initializeChapter69to90', run: () => initializeChapter69to90() },
      {
        name: 'componentArtifactStoreService.reconcile',
        run: () => { componentArtifactStoreService.reconcile(componentRegistryService.getAllComponents()); },
      },
      { name: 'autonomousHardeningService.reconcileHardeningResults', run: () => { autonomousHardeningService.reconcileHardeningResults(); } },
      { name: 'resourceGovernanceService.initialize', run: () => resourceGovernanceService.initialize() },
      { name: 'situationalAwarenessService.initialize', run: () => situationalAwarenessService.initialize() },
      {
        name: 'optional service references',
        run: () => {
          void automationStudioService;
          void causalInvestigationService;
          void benchmarkFactoryService;
          void dataUnderstandingService;
          void unknownResolutionService;
          void reversibilityService;
          void knowledgeOperatingSystemService;
          void counterfactualWorkSimulatorService;
          void personalApiGatewayService;
        },
      },
      { name: 'improvementRegressionCoordinatorService.initialize', run: () => improvementRegressionCoordinatorService.initialize() },
      { name: 'taskLineageService.initialize', run: () => taskLineageService.initialize() },
      { name: 'taskCaseMemoryService.initialize', run: () => taskCaseMemoryService.initialize() },
      { name: 'selfImprovementMetricsService.initialize', run: () => selfImprovementMetricsService.initialize() },
      { name: 'improvementCanaryRollbackService.initialize', run: () => improvementCanaryRollbackService.initialize() },
      { name: 'taskExecutionOrchestratorService.initialize', run: () => taskExecutionOrchestratorService.initialize() },
      { name: 'recoveryOrchestratorService.initialize', run: () => recoveryOrchestratorService.initialize() },
      { name: 'executionLearningCoordinatorService.initialize', run: () => executionLearningCoordinatorService.initialize() },
      { name: 'failureUnderstandingService.initialize', run: () => failureUnderstandingService.initialize() },
      { name: 'decisionLearningService.snapshot', run: () => { decisionLearningService.snapshot(); } },
      { name: 'taskResultFeedbackService.initialize', run: () => taskResultFeedbackService.initialize() },
      { name: 'taskConversationFeedbackService.initialize', run: () => taskConversationFeedbackService.initialize() },
    ];

    try {
      for (const stage of stages) {
        if (generation !== this.generation) return;
        await this.yieldToBrowser();
        if (generation !== this.generation) return;

        const startedAt = performance.now();
        systemLogger.info('SYSTEM', '[RUNTIME_INIT] stage begin', { stage: stage.name });
        try {
          await stage.run();
        } catch (error) {
          systemLogger.error('SYSTEM', '[RUNTIME_INIT] stage failed', {
            stage: stage.name,
            elapsedMs: Math.round(performance.now() - startedAt),
            errorType: error instanceof Error ? error.name : typeof error,
          });
          throw error;
        }
        systemLogger.info('SYSTEM', '[RUNTIME_INIT] stage complete', {
          stage: stage.name,
          elapsedMs: Math.round(performance.now() - startedAt),
        });
        await this.yieldToBrowser();
      }
    } catch (error) {
      throw error;
    }
  }

  dispose(): void {
    this.generation += 1;
    if (!this.initialized) return;
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
