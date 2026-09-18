import { coreResultService } from '../services/coreResultService';
import {
  selfCodeArchitectService,
  SPECIFICATION_REGISTRY,
} from '../../selfDevelopment/services/selfCodeArchitectService';
import { teacherDriftService } from '../../learning/services/teacherDriftService';
import { codeSkeletonService } from '../../selfDevelopment/services/codeSkeletonService';
import { userProficiencyService } from '../../learning/services/userProficiencyService';
import { autonomousCurriculumService } from '../../learning/services/autonomousCurriculumService';
import { proactiveContextOsService } from '../../strategy/services/proactiveContextOsService';
import { digitalResearchNoteService } from '../../research/services/digitalResearchNoteService';
import { cognitiveDebuggerService } from '../../verification/services/cognitiveDebuggerService';
import {
  codebaseReflectionService,
  type ImprovementRecipe,
} from '../../selfDevelopment/services/codebaseReflectionService';
import { aiderEngineService } from '../../selfDevelopment/services/aiderEngineService';
import { selfImprovementSuiteService } from '../../improvement/services/selfImprovementSuiteService';
import { mikiSelfCodingSuperchargerService } from '../../selfDevelopment/services/mikiSelfCodingSuperchargerService';
import { mikiUltraEvolverService } from '../../autonomy/services/mikiUltraEvolverService';
import { autonomousContinuousEvolutionService } from '../../autonomy/services/autonomousContinuousEvolutionService';

/**
 * UI-only facade for the legacy Self Code Architect screen.
 *
 * The component imports one typed boundary instead of owning the physical
 * placement of services across the 18 domains. Mutating runtime authority
 * remains with the existing core/improvement contracts; this facade does not
 * create a second orchestrator or storage path.
 */
class TypedSelfCodeArchitectUiGatewayService {
  readonly specificationRegistry = SPECIFICATION_REGISTRY;
  readonly architect = selfCodeArchitectService;
  readonly teacherDrift = teacherDriftService;
  readonly codeSkeleton = codeSkeletonService;
  readonly userProficiency = userProficiencyService;
  readonly curriculum = autonomousCurriculumService;
  readonly proactiveContext = proactiveContextOsService;
  readonly researchNotes = digitalResearchNoteService;
  readonly debugger = cognitiveDebuggerService;
  readonly codebaseReflection = codebaseReflectionService;
  readonly aider = aiderEngineService;
  readonly improvementSuite = selfImprovementSuiteService;
  readonly selfCodingSupercharger = mikiSelfCodingSuperchargerService;
  readonly ultraEvolver = mikiUltraEvolverService;
  readonly continuousEvolution = autonomousContinuousEvolutionService;
  readonly coreResults = coreResultService;
}

export const typedSelfCodeArchitectUiGatewayService = new TypedSelfCodeArchitectUiGatewayService();
export type { ImprovementRecipe };
