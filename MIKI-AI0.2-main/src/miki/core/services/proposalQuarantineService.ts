import { storageService } from '../../../services/storageService';

export interface QuarantinedProposalRecord {
  quarantineId: string;
  taskId: string;
  assessmentDispatchId: string;
  proposalType: string;
  dedupeKey: string;
  reasons: string[];
  evidenceIds: string[];
  createdAt: number;
}

const KEY = 'miki_proposal_quarantine_v1';

class ProposalQuarantineService {
  private records: QuarantinedProposalRecord[] = [];
  private sequence = 0;

  constructor() {
    try {
      const raw = storageService.getItem(KEY);
      this.records = raw ? JSON.parse(raw) : [];
    } catch {
      this.records = [];
    }
  }

  quarantine(input: Omit<QuarantinedProposalRecord, 'quarantineId' | 'createdAt'>): QuarantinedProposalRecord {
    const existing = this.records.find((record) =>
      record.taskId === input.taskId && record.assessmentDispatchId === input.assessmentDispatchId &&
      record.proposalType === input.proposalType && record.dedupeKey === input.dedupeKey &&
      record.reasons.join('|') === input.reasons.join('|'));
    if (existing) return { ...existing, reasons: [...existing.reasons], evidenceIds: [...existing.evidenceIds] };
    this.sequence += 1;
    const record: QuarantinedProposalRecord = {
      ...input,
      quarantineId: `PQ-${Date.now()}-${String(this.sequence).padStart(6, '0')}`,
      createdAt: Date.now(),
      reasons: [...input.reasons],
      evidenceIds: [...input.evidenceIds],
    };
    this.records.push(record);
    storageService.setItem(KEY, JSON.stringify(this.records.slice(-1000)));
    return { ...record, reasons: [...record.reasons], evidenceIds: [...record.evidenceIds] };
  }

  list(taskId?: string): QuarantinedProposalRecord[] {
    return this.records.filter((record) => !taskId || record.taskId === taskId)
      .map((record) => ({ ...record, reasons: [...record.reasons], evidenceIds: [...record.evidenceIds] }));
  }
}

export const proposalQuarantineService = new ProposalQuarantineService();
