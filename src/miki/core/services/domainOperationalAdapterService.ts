import type { MikiDomain } from './crossDomainCirculationService';
import { autonomousContinuousEvolutionService } from '../../autonomy/services/autonomousContinuousEvolutionService';
import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { conversationCompositionResearchSchedulerService } from '../../conversation/services/conversationCompositionResearchSchedulerService';
import { getManifestDefaultConfig, getManifestNativeEnv, getModelManifest } from '../../data/services/deterministicModelCatalog';
import { executionRunnerService } from '../../execution/services/executionRunnerService';
import { unifiedMikiExperienceService } from '../../experience/services/unifiedMikiExperienceService';
import { autonomousCurriculumService } from '../../learning/services/autonomousCurriculumService';
import { causalMemoryLedgerService } from '../../memory/services/causalMemoryLedgerService';
import { heuristicGraduationService } from '../../promotion/services/heuristicGraduationService';
import { autonomousSearchService } from '../../research/services/autonomousSearchService';
import { resourceGovernanceService } from '../../safety/services/resourceGovernanceService';
import { mikiCognitiveVitalsService } from '../../selfAwareness/services/mikiCognitiveVitalsService';
import { codebaseReflectionService } from '../../selfDevelopment/services/codebaseReflectionService';
import { planOrchestratorService } from '../../strategy/services/planOrchestratorService';
import { unknownResolutionService } from '../../unknown/services/unknownResolutionService';
import { completionJudgeService } from '../../verification/services/completionJudgeService';
import { selfImprovementMetricsService } from '../../improvement/services/selfImprovementMetricsService';
import { improvementIntakeRouterService } from './improvementIntakeRouterService';

export interface DomainOperationalSnapshot {
  domain: MikiDomain;
  serviceId: string;
  available: boolean;
  observedAt: number;
  data?: unknown;
  evidenceIds: string[];
  unresolvedRequirements: string[];
}

const snapshot = (domain:MikiDomain, serviceId:string, data:unknown):DomainOperationalSnapshot => ({
  domain,
  serviceId,
  available:true,
  observedAt:Date.now(),
  data,
  evidenceIds:[],
  unresolvedRequirements:[]
});

class DomainOperationalAdapterService {
  inspect(domain:MikiDomain):DomainOperationalSnapshot {
    try {
      switch(domain){
        case 'core':
          return snapshot(domain,'coreOrchestratorService',{authority:'CORE',responsibility:'route-collect-reevaluate-complete'});
        case 'autonomy':
          return snapshot(domain,'autonomousContinuousEvolutionService',{config:autonomousContinuousEvolutionService.getConfig(),historyCount:autonomousContinuousEvolutionService.getHistory().length});
        case 'capability':
          return snapshot(domain,'capabilityGapService',{gaps:capabilityGapService.getAllGaps(),profiles:capabilityGapService.getAllProfiles()});
        case 'conversation':
          return snapshot(domain,'conversationCompositionResearchSchedulerService',{config:conversationCompositionResearchSchedulerService.getConfig(),state:conversationCompositionResearchSchedulerService.getState()});
        case 'data':
          return snapshot(domain,'deterministicModelCatalog',{manifest:getModelManifest(),nativeEnvironment:getManifestNativeEnv(),defaultConfig:getManifestDefaultConfig()});
        case 'execution':
          return snapshot(domain,'executionRunnerService',{requests:executionRunnerService.listRequests()});
        case 'experience':
          return snapshot(domain,'unifiedMikiExperienceService',{state:unifiedMikiExperienceService.getState(),recent:unifiedMikiExperienceService.getRecent(20)});
        case 'improvement':
          return snapshot(domain,'selfImprovementOperationalReadModel',{weaknesses:selfImprovementMetricsService.rankWeaknesses(),runs:improvementIntakeRouterService.list(50)});
        case 'learning':
          return snapshot(domain,'autonomousCurriculumService',{boundaries:autonomousCurriculumService.getAllBoundaries(),curriculums:autonomousCurriculumService.getCurriculums(),skills:autonomousCurriculumService.getCompressedSkills()});
        case 'memory':
          return snapshot(domain,'causalMemoryLedgerService',{stats:causalMemoryLedgerService.stats(),records:causalMemoryLedgerService.list(50)});
        case 'promotion':
          return snapshot(domain,'heuristicGraduationService',{stats:heuristicGraduationService.getGraduationStats()});
        case 'research':
          return snapshot(domain,'autonomousSearchService',{config:autonomousSearchService.getConfig(),stats:autonomousSearchService.getStats(),recent:autonomousSearchService.getRecentRecords(20)});
        case 'safety':
          return snapshot(domain,'resourceGovernanceService',{resources:resourceGovernanceService.getSnapshot()});
        case 'selfAwareness':
          return snapshot(domain,'mikiCognitiveVitalsService',{vitals:mikiCognitiveVitalsService.getSnapshot()});
        case 'selfDevelopment':
          return snapshot(domain,'codebaseReflectionService',{architecture:codebaseReflectionService.getArchitectureOverview(),modules:codebaseReflectionService.getAllModules()});
        case 'strategy':
          return snapshot(domain,'planOrchestratorService',{runs:planOrchestratorService.listRuns()});
        case 'unknown':
          return snapshot(domain,'unknownResolutionService',{items:unknownResolutionService.list(100),persistence:unknownResolutionService.getPersistenceStatus()});
        case 'verification':
          return snapshot(domain,'completionJudgeService',{stats:completionJudgeService.getJudgeStats(),history:completionJudgeService.getHistory()});
      }
    } catch(error) {
      return {domain,serviceId:`${domain}.operational-adapter`,available:false,observedAt:Date.now(),evidenceIds:[],unresolvedRequirements:[`DOMAIN_OPERATIONAL_ADAPTER_ERROR:${String(error)}`]};
    }
  }
}

export const domainOperationalAdapterService = new DomainOperationalAdapterService();
