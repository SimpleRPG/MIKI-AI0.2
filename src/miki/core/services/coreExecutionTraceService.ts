import { taskBlackboardService } from './taskBlackboardService';

export type CoreTraceStage =
  | 'RUN_START'
  | 'CYCLE_START'
  | 'PLAN'
  | 'DISPATCH_START'
  | 'DISPATCH_RESULT'
  | 'REPLY_NORMALIZED'
  | 'REPLY_LEDGER'
  | 'ACTION_COMPLETED'
  | 'BLACKBOARD_WRITE'
  | 'REEVALUATION_INPUT'
  | 'COMPLETION_ASSESSMENT'
  | 'CYCLE_GUARD'
  | 'CORE_SYNTHESIS'
  | 'NO_PROGRESS'
  | 'ACCEPTANCE_EVIDENCE_MATRIX'
  | 'AUTONOMOUS_E2E_PROOF_SUITE'
  | 'CANARY_POST_REVIEW_VERIFICATION'
  | 'CANDIDATE_CONSTRAINT_VALIDATION'
  | 'CANDIDATE_GOVERNANCE_PREFLIGHT'
  | 'CANDIDATE_DEVELOPMENT_COMPLETION'
  | 'COMPLEX_CAPABILITY_CONTRACT_CHECK'
  | 'CUMULATIVE_REVALIDATION'
  | 'FINAL_RESIDUAL_SERVICE_INTEGRATION'
  | 'RESIDUAL_CAPABILITY_INFORMATION_FLOW'
  | 'REVIEW_MANIFEST_INCLUSION_GATE'
  | 'SELF_IMPROVEMENT_HANDOFF_AUDIT'
  | 'SERVICE_CONNECTIVITY_AUDIT_25'
  | 'WORKSPACE_TSC_ISOLATION_E2E'
  | 'CANDIDATE_AUTO_REBASE';

class CoreExecutionTraceService {
  record(
    taskId: string,
    cycle: number,
    stage: CoreTraceStage,
    data: Record<string, unknown> = {}
  ): void {
    taskBlackboardService.append(
      taskId,
      'CHECKPOINT',
      'core',
      `coreTrace:${cycle}:${stage}`,
      {
        schemaVersion: 1,
        traceVersion: 1,
        taskId,
        cycle,
        stage,
        recordedAt: Date.now(),
        ...thissanitize(data),
      }
    );
  }
}

function thissanitize(
  value: Record<string, unknown>
): Record<string, unknown> {
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, item) => {
        if (typeof item === 'bigint') return String(item);
        if (item instanceof Error) {
          return {
            name: item.name,
            message: item.message,
            stack: item.stack,
          };
        }
        return item;
      })
    ) as Record<string, unknown>;
  } catch {
    return {
      serializationFailed: true,
      keys: Object.keys(value),
    };
  }
}

export const coreExecutionTraceService =
  new CoreExecutionTraceService();
