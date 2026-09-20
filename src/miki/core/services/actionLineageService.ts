import { domainReplyLedgerService, type ActionLineage, type DomainReplyLedgerRecord } from './domainReplyLedgerService';

export interface ActionLineageSummary {
  taskId: string;
  actionCount: number;
  succeeded: number;
  failed: number;
  rejected: number;
  observed: number;
  actions: ActionLineage[];
}

/**
 * ActionLineageの正規保存先を新設せず、既存DomainReplyLedgerを読み取る統合API。
 */
export class ActionLineageService {
  public getAction(replyId: string): ActionLineage | undefined {
    return domainReplyLedgerService.get(replyId)?.actionLineage;
  }

  public listByTask(taskId: string): Array<DomainReplyLedgerRecord> {
    return domainReplyLedgerService.listByTask(taskId);
  }

  public summarizeTask(taskId: string): ActionLineageSummary {
    const records = this.listByTask(taskId);
    return {
      taskId,
      actionCount: records.length,
      succeeded: records.filter((record) => record.actionLineage.outcome === 'SUCCEEDED').length,
      failed: records.filter((record) => record.actionLineage.outcome === 'FAILED').length,
      rejected: records.filter((record) => record.actionLineage.outcome === 'REJECTED').length,
      observed: records.filter((record) => record.actionLineage.outcome === 'OBSERVED').length,
      actions: records.map((record) => ({
        ...record.actionLineage,
        knowledgeIds: [...record.actionLineage.knowledgeIds],
        capabilityIds: [...record.actionLineage.capabilityIds],
        evidenceIds: [...record.actionLineage.evidenceIds],
        permissionClasses: [...record.actionLineage.permissionClasses],
      })),
    };
  }
}

export const actionLineageService = new ActionLineageService();
