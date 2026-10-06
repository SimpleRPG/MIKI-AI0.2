import { canonicalProtectedInvariantRegistryService, type InvariantCandidateChange } from './canonicalProtectedInvariantRegistryService';
import { unifiedMultiObjectiveCandidateSelectorService, type CandidateSelectionInput } from '../../strategy/services/unifiedMultiObjectiveCandidateSelectorService';
export interface CandidateGovernancePreflight {invariantChange?:InvariantCandidateChange;candidates?:CandidateSelectionInput[];}
class CandidateGovernanceCoordinatorService {
 preflight(input:CandidateGovernancePreflight){const invariantEvaluation=canonicalProtectedInvariantRegistryService.evaluate(input.invariantChange||{});const selection=input.candidates?.length?unifiedMultiObjectiveCandidateSelectorService.select(input.candidates):undefined;return {allowed:invariantEvaluation.allowed&&(!selection||Boolean(selection.selectedCandidateId)),invariantEvaluation,selection};}
}
export const candidateGovernanceCoordinatorService=new CandidateGovernanceCoordinatorService();
