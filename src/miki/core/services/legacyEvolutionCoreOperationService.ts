import { autonomousContinuousEvolutionService } from '../../autonomy/services/autonomousContinuousEvolutionService';
import { coreOperationRegistryService, type CoreOperationContract } from './coreOperationRegistryService';

export const LEGACY_EVOLUTION_CORE_OPERATION_ID = 'core.selfImprovement.legacyEvolution';

export type LegacyEvolutionOperationInput = NonNullable<
  Parameters<typeof autonomousContinuousEvolutionService.runFullAutonomousCycle>[0]
>;
export type LegacyEvolutionOperationOutput = Awaited<
  ReturnType<typeof autonomousContinuousEvolutionService.runFullAutonomousCycle>
>;

class LegacyEvolutionCoreOperationService {
  public async execute(input: LegacyEvolutionOperationInput): Promise<LegacyEvolutionOperationOutput> {
    const operation = coreOperationRegistryService.get<LegacyEvolutionOperationInput, LegacyEvolutionOperationOutput>(
      LEGACY_EVOLUTION_CORE_OPERATION_ID
    );
    return operation.execute(input);
  }
}

const legacyEvolutionContract: CoreOperationContract<LegacyEvolutionOperationInput, LegacyEvolutionOperationOutput> = {
  operationId: LEGACY_EVOLUTION_CORE_OPERATION_ID,
  ownerDomain: 'self_improvement',
  receiptRequired: true,
  failureState: 'FAILED',
  resumeCondition: 'A persisted Core Plan revision and matching persistence receipt are available.',
  execute: (input) => autonomousContinuousEvolutionService.runFullAutonomousCycle(input),
};

if (!coreOperationRegistryService.has(LEGACY_EVOLUTION_CORE_OPERATION_ID)) {
  coreOperationRegistryService.register(legacyEvolutionContract);
}

export const legacyEvolutionCoreOperationService = new LegacyEvolutionCoreOperationService();
