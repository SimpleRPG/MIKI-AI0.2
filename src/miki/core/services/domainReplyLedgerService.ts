import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import type { MikiDomain } from './crossDomainCirculationService';
import type { DomainEnvelope, DomainReply } from './domainRouterService';
import { EvidenceService } from '../../memory/services/evidenceService';
import { canonicalSha256Object } from './canonicalSha256Service';

export interface DomainReplyLedgerRecord {
  replyId: string;
  taskId: string;
  operationId: string;
  operationInstanceId: string;
  corePlanRevision: number;
  dispatchId: string;
  envelopeId: string;
  correlationId: string;
  classificationId: MikiDomain;
  command: string;
  status: 'SUCCEEDED' | 'REJECTED' | 'FAILED' | 'OBSERVED';
  evidenceIds: string[];
  unknowns: string[];
  receiptIds: string[];
  retryable: boolean;
  summary: string;
  failure?: string;
  completedAt: number;
}

const STORAGE_KEY = 'miki_domain_reply_ledger_v1';
const MAX_RECORDS = 2000;

class DomainReplyLedgerService {
  private records = new Map<string, DomainReplyLedgerRecord>();

  constructor() {
    this.load();
  }

  record(taskId: string, operationId: string, envelope: DomainEnvelope, reply: DomainReply): DomainReplyLedgerRecord {
    const normalized = reply.normalized;
    const evidenceIds = [...new Set(normalized?.evidenceIds || envelope.evidenceIds)];
    const discoveredReceipts=this.collectStrings(normalized?.data, /(?:persistence)?receipt(?:ids?)?/i);
    const receiptIds=[...new Set([...evidenceIds.filter(id => /receipt/i.test(id)), ...discoveredReceipts])];
    const unknowns = this.collectStrings(normalized?.data, /unknown/i);
    const replyId = `DREPLY-${envelope.envelopeId}`;
    const record: DomainReplyLedgerRecord = {
      replyId,
      taskId,
      operationId,
      operationInstanceId: typeof envelope.payload.operationInstanceId === 'string' ? envelope.payload.operationInstanceId : '',
      corePlanRevision: typeof envelope.payload.planRevision === 'number' ? envelope.payload.planRevision : 0,
      dispatchId: envelope.envelopeId,
      envelopeId: envelope.envelopeId,
      correlationId: envelope.correlationId,
      classificationId: reply.domain,
      command: reply.command,
      status: normalized?.status || (reply.accepted ? 'SUCCEEDED' : 'FAILED'),
      evidenceIds,
      unknowns,
      receiptIds,
      retryable: normalized?.retryable || false,
      summary: normalized?.summary || reply.error || `${reply.domain} completed ${reply.command}`,
      failure: reply.accepted ? undefined : reply.error,
      completedAt: reply.completedAt
    };
    this.records.set(replyId, record);
    const contentSha256 = canonicalSha256Object({ taskId, operationId, operationInstanceId: record.operationInstanceId, corePlanRevision: record.corePlanRevision, dispatchId: record.dispatchId, classificationId: record.classificationId, command: record.command, status: record.status, summary: record.summary });
    for (const evidenceId of evidenceIds) EvidenceService.getInstance().bindExecutionLineage(evidenceId, { taskId, corePlanRevision: record.corePlanRevision, operationInstanceId: record.operationInstanceId, replyId, contentSha256, verificationStatus: record.status === 'SUCCEEDED' ? 'VERIFIED' : record.status === 'FAILED' || record.status === 'REJECTED' ? 'REJECTED' : 'UNVERIFIED' });
    this.persist();
    return this.clone(record);
  }

  get(replyId: string): DomainReplyLedgerRecord | undefined {
    const record = this.records.get(replyId);
    return record ? this.clone(record) : undefined;
  }

  listByTask(taskId: string): DomainReplyLedgerRecord[] {
    return [...this.records.values()]
      .filter(record => record.taskId === taskId)
      .sort((a, b) => a.completedAt - b.completedAt)
      .map(record => this.clone(record));
  }

  private collectStrings(value: unknown, keyPattern: RegExp): string[] {
    const found = new Set<string>();
    const walk = (item: unknown, depth: number): void => {
      if (depth > 4 || item === null || item === undefined) return;
      if (Array.isArray(item)) {
        for (const child of item) walk(child, depth + 1);
        return;
      }
      if (typeof item !== 'object') return;
      for (const [key, child] of Object.entries(item as Record<string, unknown>)) {
        if (keyPattern.test(key)) {
          if (typeof child === 'string' && child.length > 0) found.add(child);
          if (Array.isArray(child)) {
            for (const text of child) if (typeof text === 'string' && text.length > 0) found.add(text);
          }
        }
        walk(child, depth + 1);
      }
    };
    walk(value, 0);
    return [...found];
  }

  private clone(record: DomainReplyLedgerRecord): DomainReplyLedgerRecord {
    return {...record, evidenceIds: [...record.evidenceIds], unknowns: [...record.unknowns], receiptIds: [...record.receiptIds]};
  }

  private persist(): void {
    try {
      const records = [...this.records.values()]
        .sort((a, b) => b.completedAt - a.completedAt)
        .slice(0, MAX_RECORDS);
      storageService.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
      systemLogger.warn('SYSTEM', 'domainReplyLedgerService: persistence failed', { error });
    }
  }

  private load(): void {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      const records: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(records)) return;
      for (const record of records) {
        if (!this.isRecord(record)) continue;
        this.records.set(record.replyId, record);
      }
    } catch (error) {
      this.records.clear();
      systemLogger.warn('SYSTEM', 'domainReplyLedgerService: restore failed', { error });
    }
  }

  private isRecord(value: unknown): value is DomainReplyLedgerRecord {
    if (typeof value !== 'object' || value === null) return false;
    const record = value as Partial<DomainReplyLedgerRecord>;
    return typeof record.replyId === 'string'
      && typeof record.taskId === 'string'
      && typeof record.operationId === 'string'
      && typeof record.classificationId === 'string'
      && Array.isArray(record.evidenceIds)
      && Array.isArray(record.unknowns)
      && Array.isArray(record.receiptIds)
      && typeof record.completedAt === 'number';
  }
}

export const domainReplyLedgerService = new DomainReplyLedgerService();
