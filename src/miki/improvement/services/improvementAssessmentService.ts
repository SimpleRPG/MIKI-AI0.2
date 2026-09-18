import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { improvementIntakeRouterService } from '../../core/services/improvementIntakeRouterService';
import { EvidenceService } from '../../memory/services/evidenceService';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';

export type ProposedImprovementOperationType =
  | 'PLAN_PENDING_IMPROVEMENT_RUN'
  | 'RESOLVE_CAPABILITY_GAPS'
  | 'DISCOVER_IMPROVEMENT_ISSUE';

export interface ProposedImprovementOperation {
  type: ProposedImprovementOperationType;
  targetDomain: 'strategy' | 'capability' | 'improvement';
  priority: number;
  sideEffectClass: 'READ_ONLY' | 'CONTROLLED_MUTATION';
  dependsOn: ProposedImprovementOperationType[];
  idempotencyKey: string;
  dedupeKey: string;
  preconditions: string[];
  input: Record<string, unknown>;
  proposalSha256: string;
}

export interface ImprovementAssessmentInput {
  trigger: string;
  taskId: string;
  correlationId: string;
  sourceDomain: string;
}

export interface ImprovementAssessmentResult {
  operation: 'IMPROVEMENT_ASSESSMENT';
  operationClass: 'DIAGNOSTIC';
  performed: true;
  mutationApplied: false;
  trigger: string;
  taskId: string;
  correlationId: string;
  sourceDomain: string;
  pendingRunCount: number;
  unresolvedCapabilityGapCount: number;
  historicalRunCount: number;
  proposedOperations: ProposedImprovementOperation[];
  unresolvedRequirements: string[];
  evidenceIds: string[];
  sourceArtifactHashes: string[];
}

class ImprovementAssessmentService {
  assess(input: ImprovementAssessmentInput): ImprovementAssessmentResult {
    if (!input.taskId.trim() || !input.correlationId.trim()) {
      throw new Error('ASSESSMENT_WORKFLOW_IDENTITY_REQUIRED');
    }
    const runs = improvementIntakeRouterService.list();
    const pendingRuns = runs.filter((run) => !['COMPLETED', 'REJECTED'].includes(run.status));
    const unresolvedGaps = capabilityGapService.getAllGaps().filter((gap) => gap.status !== 'RESOLVED');
    const proposedOperations: ProposedImprovementOperation[] = [];
    if (pendingRuns.length > 0) {
      proposedOperations.push({
        type: 'PLAN_PENDING_IMPROVEMENT_RUN', targetDomain: 'strategy', priority: 100,
        sideEffectClass: 'READ_ONLY', dependsOn: [],
        idempotencyKey: `plan:${input.taskId}:${pendingRuns.map((run) => run.runId).sort().join(',')}`,
        dedupeKey: `plan:${pendingRuns.map((run) => run.runId).sort().join(',')}`,
        preconditions: ['PENDING_RUN_EXISTS'], proposalSha256: '', input: { runIds: pendingRuns.map((run) => run.runId) },
      });
    }
    if (unresolvedGaps.length > 0) {
      proposedOperations.push({
        type: 'RESOLVE_CAPABILITY_GAPS', targetDomain: 'capability', priority: 90,
        sideEffectClass: 'READ_ONLY', dependsOn: [],
        idempotencyKey: `gaps:${input.taskId}:${unresolvedGaps.map((gap) => gap.gap_id).sort().join(',')}`,
        dedupeKey: `gaps:${unresolvedGaps.map((gap) => gap.gap_id).sort().join(',')}`,
        preconditions: ['UNRESOLVED_GAP_EXISTS'], proposalSha256: '', input: { gapIds: unresolvedGaps.map((gap) => gap.gap_id) },
      });
    }
    if (proposedOperations.length === 0) {
      proposedOperations.push({
        type: 'DISCOVER_IMPROVEMENT_ISSUE', targetDomain: 'improvement', priority: 50,
        sideEffectClass: 'READ_ONLY', dependsOn: [],
        idempotencyKey: `discover:${input.taskId}:${input.trigger}`,
        dedupeKey: `discover:${input.trigger}`,
        preconditions: ['DISCOVERY_BUDGET_AVAILABLE', 'NEW_SIGNAL_REQUIRED'], proposalSha256: '', input: { trigger: input.trigger },
      });
    }
    for (const proposal of proposedOperations) {
      proposal.proposalSha256 = canonicalSha256({ type: proposal.type, targetDomain: proposal.targetDomain, priority: proposal.priority, sideEffectClass: proposal.sideEffectClass, dependsOn: proposal.dependsOn, idempotencyKey: proposal.idempotencyKey, dedupeKey: proposal.dedupeKey, preconditions: proposal.preconditions, input: proposal.input });
    }
    const sourceArtifactHashes = pendingRuns.map((run) => String(run.sourceHash || '')).filter(Boolean);
    const evidence = EvidenceService.getInstance().recordExecutionEvidence({
      title: 'Improvement assessment observation',
      snippet: JSON.stringify({ taskId: input.taskId, pendingRunCount: pendingRuns.length, unresolvedCapabilityGapCount: unresolvedGaps.length, proposedOperations: proposedOperations.map((item) => item.type) }),
      source: 'improvementAssessmentService', sourceId: input.taskId,
      independenceClusterId: `assessment_${input.correlationId}`,
      metadata: { component_id: 'improvementAssessmentService', passed: true, environment: 'application-runtime', runner: 'core-domain-handler', observed_at: Date.now(), result_summary: 'Assessment observed; no mutation applied', assertion_status: 'INCONCLUSIVE' },
    });
    return {
      operation: 'IMPROVEMENT_ASSESSMENT', operationClass: 'DIAGNOSTIC', performed: true,
      mutationApplied: false, trigger: input.trigger, taskId: input.taskId,
      correlationId: input.correlationId, sourceDomain: input.sourceDomain,
      pendingRunCount: pendingRuns.length, unresolvedCapabilityGapCount: unresolvedGaps.length,
      historicalRunCount: runs.length, proposedOperations,
      unresolvedRequirements: proposedOperations.map((item) => item.type),
      evidenceIds: [evidence.evidence_id], sourceArtifactHashes,
    };
  }
}

export const improvementAssessmentService = new ImprovementAssessmentService();
