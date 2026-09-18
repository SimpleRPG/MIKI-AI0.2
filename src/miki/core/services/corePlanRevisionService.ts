import type { BlackboardTask } from './taskBlackboardService';
import type { DomainCommand } from './domainRouterService';
import { canonicalSha256 } from './canonicalSha256Service';

export type OperationInstanceStatus = 'PENDING' | 'BLOCKED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SUPERSEDED';

export interface RequiredBusinessOperation {
  operationInstanceId: string;
  operation: DomainCommand;
  targetDomain: string;
  dedupeKey: string;
  idempotencyKey: string;
  proposalSha256: string;
  assessmentDispatchId: string;
  assessmentEvidenceIds: string[];
  dependsOn: string[];
  preconditions: string[];
  priority: number;
  attempt: number;
  status: OperationInstanceStatus;
  inputHash: string;
  planRevision: number;
}

export interface CorePlanRevision {
  schemaVersion: 2;
  producerId: 'core';
  planRevision: number;
  expectedPreviousRevision: number;
  taskId: string;
  planSha256: string;
  requiredOperations: RequiredBusinessOperation[];
  createdAt: number;
}

function hash(value: unknown): string {
  return canonicalSha256(value);
}

class CorePlanRevisionService {
  latest(task: BlackboardTask): CorePlanRevision | undefined {
    const revisions = task.entries.filter((entry) => entry.kind === 'DECISION' && entry.domain === 'core' && entry.key.startsWith('corePlanRevision:'))
      .map((entry) => entry.value).filter((value): value is CorePlanRevision => Boolean(value && typeof value === 'object'))
      .filter((value) => value.schemaVersion === 2 && value.producerId === 'core' && value.taskId === task.taskId && value.planSha256 === hash(value.requiredOperations));
    const byRevision = new Map<number, CorePlanRevision[]>();
    for (const revision of revisions) byRevision.set(revision.planRevision, [...(byRevision.get(revision.planRevision) || []), revision]);
    if ([...byRevision.values()].some((items) => items.length !== 1)) throw new Error('PLAN_CONFLICT_DUPLICATE_REVISION');
    const ordered = [...revisions].sort((left, right) => left.planRevision - right.planRevision);
    for (let index = 0; index < ordered.length; index += 1) if (ordered[index].expectedPreviousRevision !== (index === 0 ? 0 : ordered[index - 1].planRevision)) throw new Error('PLAN_CONFLICT_REVISION_CHAIN');
    return ordered.at(-1);
  }

  build(task: BlackboardTask, additions: Array<Omit<RequiredBusinessOperation, 'planRevision'>>): { revision: CorePlanRevision; changed: boolean } {
    const current = this.latest(task);
    const nextRevision = (current?.planRevision || 0) + 1;
    const byKey = new Map<string, RequiredBusinessOperation>();

    // Preserve operation instances across plan revisions. A new plan revision
    // is a snapshot of requirements, not a new execution attempt.
    for (const item of current?.requiredOperations || []) {
      byKey.set(item.operationInstanceId, {
        ...item,
        dependsOn: [...item.dependsOn],
        preconditions: [...item.preconditions],
        assessmentEvidenceIds: [...item.assessmentEvidenceIds],
      });
    }
    for (const item of additions) {
      for (const [key,existing] of byKey) {
        if(existing.operation===item.operation && key!==item.operationInstanceId
          && ['FAILED','PENDING','BLOCKED','RUNNING'].includes(existing.status)) {
          byKey.set(key,{...existing,status:'SUPERSEDED'});
        }
      }
      byKey.set(item.operationInstanceId, {
        ...item,
        planRevision: nextRevision,
        dependsOn: [...item.dependsOn],
        preconditions: [...item.preconditions],
        assessmentEvidenceIds: [...item.assessmentEvidenceIds],
      });
    }

    const requiredOperations = [...byKey.values()].map(item => {
      const succeeded = this.operationSucceeded(task, item.operationInstanceId, item.operation);
      const dependenciesSatisfied = item.dependsOn.every(dep => this.operationSucceeded(task, dep));
      const status: OperationInstanceStatus = item.status==='SUPERSEDED'
        ? 'SUPERSEDED'
        : succeeded
          ? 'SUCCEEDED'
          : !dependenciesSatisfied ? 'BLOCKED' : (item.status === 'RUNNING' ? 'RUNNING' : 'PENDING');
      return {...item, status, planRevision: nextRevision};
    }).sort((left, right) =>
      right.priority - left.priority || left.operationInstanceId.localeCompare(right.operationInstanceId)
    );

    const planSha256 = hash(requiredOperations);
    if (current && current.planSha256 === planSha256) return { revision: current, changed: false };
    return {
      changed: true,
      revision: {
        schemaVersion: 2, producerId: 'core', planRevision: nextRevision,
        expectedPreviousRevision: current?.planRevision || 0, taskId: task.taskId,
        planSha256, requiredOperations, createdAt: Date.now()
      }
    };
  }

  missingOperations(task: BlackboardTask): RequiredBusinessOperation[] {
    const revision = this.latest(task);
    if (!revision) return [];
    return revision.requiredOperations.filter(required => required.status!=='SUPERSEDED' && !this.operationSucceeded(task, required.operationInstanceId, required.operation)
    );
  }

  private operationSucceeded(task: BlackboardTask, operationInstanceId: string, operation?: DomainCommand): boolean {
    if (!operationInstanceId) return false;
    return task.entries.some(entry => {
      if (entry.kind !== 'RESULT' || typeof entry.value !== 'object' || entry.value === null) return false;
      const value = entry.value as Record<string, unknown>;
      if (value.operationInstanceId !== operationInstanceId) return false;
      if (operation && value.operation !== operation) return false;
      if (value.operationClass !== 'BUSINESS') return false;
      const reply = value.reply;
      if (!reply || typeof reply !== 'object') return false;
      const normalized = reply as Record<string, unknown>;
      return normalized.operationClass === 'BUSINESS'
        && ['SUCCEEDED','SUCCESS','COMPLETED'].includes(String(normalized.status || '').toUpperCase());
    });
  }

}

export const corePlanRevisionService = new CorePlanRevisionService();
