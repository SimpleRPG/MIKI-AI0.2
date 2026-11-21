import { systemLogger } from '../services/systemLogger';
import { CoreRoutingReadinessGate } from './coreRoutingReadinessGate';
import { crossDomainCirculationService } from '../miki/core/services/crossDomainCirculationService';
// P1122: domainIntegrationBootstrapService と章69-90初期化（../miki）は
// 起動時の静的グラフから外し、初期化ステージの中で動的 import する。
// 静的だとコード理解スタック（TypeScript コンパイラ含む）が起動に乗る。
import { capabilityLearningService } from '../miki/capability/services/capabilityLearningService';
import { componentArtifactStoreService } from '../miki/capability/services/componentArtifactStoreService';
import { componentRegistryService } from '../miki/capability/services/componentRegistryService';
import { autonomousHardeningService } from '../miki/autonomy/services/autonomousHardeningService';
import { resourceGovernanceService } from '../miki/safety/services/resourceGovernanceService';
import { situationalAwarenessService } from '../miki/selfAwareness/services/situationalAwarenessService';
import { automationStudioService } from '../miki/execution/services/automationStudioService';
import { causalInvestigationService } from '../miki/research/services/causalInvestigationService';
import { benchmarkFactoryService } from '../miki/verification/services/benchmarkFactoryService';
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
import { dictionaryBootstrapService } from '../miki/research/services/dictionaryBootstrapService';

class AppRuntimeLifecycleService {
  private initialized = false;
  private generation = 0;
  private readonly coreRoutingReadinessGate = new CoreRoutingReadinessGate();
  // P1122: 動的 import した bootstrap 本体（dispose 用に保持する）
  private bootstrapService: { initialize(): Promise<void>; dispose(): void } | undefined;
  private bootstrapServicePromise: Promise<{ initialize(): Promise<void>; dispose(): void }> | undefined;

  private loadBootstrapService(): Promise<{ initialize(): Promise<void>; dispose(): void }> {
    if (!this.bootstrapServicePromise) {
      this.bootstrapServicePromise = import('../miki/core/services/domainIntegrationBootstrapService')
        .then((m) => {
          this.bootstrapService = m.domainIntegrationBootstrapService;
          return m.domainIntegrationBootstrapService;
        });
    }
    return this.bootstrapServicePromise;
  }

  waitForCoreRoutingReady(signal?: AbortSignal): Promise<void> {
    return this.coreRoutingReadinessGate.wait(signal);
  }

  failCoreRoutingReady(reason: unknown): void {
    this.coreRoutingReadinessGate.markFailed(reason);
  }

  private yieldToBrowser(): Promise<void> {
    return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.coreRoutingReadinessGate.reset();
    this.initialized = true;
    const generation = ++this.generation;

    const stages: Array<{ name: string; run: () => void | Promise<void> }> = [
      { name: 'crossDomainCirculationService.initialize', run: () => crossDomainCirculationService.initialize() },
      {
        name: 'domainIntegrationBootstrapService.initialize',
        run: async () => {
          let lastError: unknown;
          for (let attempt = 1; attempt <= 2; attempt += 1) {
            if (generation !== this.generation) return;
            try {
              const bootstrap = await this.loadBootstrapService();
              if (generation !== this.generation) return;
              await bootstrap.initialize();
              if (generation !== this.generation) return;
              this.coreRoutingReadinessGate.markReady();
              return;
            } catch (error) {
              if (generation !== this.generation) return;
              lastError = error;
              systemLogger.warn(
                'SYSTEM',
                `[DomainIntegration] bootstrap attempt ${attempt}/2 failed: ${error instanceof Error ? error.message : String(error)}`
              );
              if (attempt < 2) {
                await new Promise<void>((resolve) => window.setTimeout(resolve, 1000));
              }
            }
          }
          throw lastError instanceof Error ? lastError : new Error(String(lastError));
        },
      },
      { name: 'capabilityLearningService.initialize', run: () => capabilityLearningService.initialize() },
      { name: 'dictionaryBootstrapService.initialize', run: () => dictionaryBootstrapService.initialize() },
      { name: 'initializeChapter69to90', run: async () => { const m = await import('../miki'); await m.initializeChapter69to90(); } },
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
      let lastCompletedStage = 'BOOT';
      for (const [stageIndex, stage] of stages.entries()) {
        if (generation !== this.generation) return;
        await this.yieldToBrowser();
        if (generation !== this.generation) return;

        systemLogger.recordRuntimeBreadcrumb('RUNTIME_STAGE_BEGIN', {
          stage: stage.name, status: 'STARTED', lastCompleted: lastCompletedStage,
        });
        const startedAt = performance.now();
        systemLogger.info('SYSTEM', '[RUNTIME_INIT] stage begin', { stage: stage.name });
        try {
          await stage.run();
          if (generation !== this.generation) return;
        } catch (error) {
          if (generation !== this.generation) return;
          this.coreRoutingReadinessGate.markFailed(error);
          const elapsedMs = Math.round(performance.now() - startedAt);
          systemLogger.recordRuntimeBreadcrumb('RUNTIME_STAGE_FAILED', {
            stage: stage.name, status: 'FAILED', lastCompleted: lastCompletedStage, elapsedMs,
            errorType: error instanceof Error ? error.name : typeof error,
          });
          systemLogger.error('SYSTEM', '[RUNTIME_INIT] stage failed', {
            stage: stage.name,
            elapsedMs,
            errorType: error instanceof Error ? error.name : typeof error,
          });
          throw error;
        }
        const elapsedMs = Math.round(performance.now() - startedAt);
        systemLogger.recordRuntimeBreadcrumb('RUNTIME_STAGE_COMPLETE', {
          stage: stage.name, status: 'COMPLETED', lastCompleted: stage.name,
          nextStage: stages[stageIndex + 1]?.name || 'NONE', elapsedMs,
        });
        lastCompletedStage = stage.name;
        systemLogger.info('SYSTEM', '[RUNTIME_INIT] stage complete', {
          stage: stage.name,
          elapsedMs,
        });
        await this.yieldToBrowser();
      }
    } catch (error) {
      if (generation !== this.generation) return;
      this.initialized = false;
      this.generation += 1;
      throw error;
    }
  }

  dispose(): void {
    this.generation += 1;
    if (!this.initialized) return;
    this.initialized = false;
    this.coreRoutingReadinessGate.markFailed(
      new Error('APP_RUNTIME_DISPOSED_BEFORE_CORE_READY')
    );
    this.coreRoutingReadinessGate.reset();

    taskConversationFeedbackService.dispose();
    this.bootstrapService?.dispose();
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
