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
  | 'NO_PROGRESS';

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
