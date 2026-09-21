import { storageService } from '../../../services/storageService';

export interface UserFeedbackRecord {
  id?: string;
  polarity: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  subjectId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  decision?: 'EVIDENCE_ONLY' | 'REQUIRES_CORROBORATION';
  finalStateChanged?: boolean;
  observedAt?: number;
  [key: string]: unknown;
}

const KEY = 'miki_user_feedback_governance_records_v1';

export class UserFeedbackGovernanceService {
  private records: UserFeedbackRecord[] = [];

  constructor() {
    try {
      const raw = storageService.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) this.records = parsed;
    } catch {
      this.records = [];
    }
  }

  public record(input: UserFeedbackRecord): UserFeedbackRecord {
    const record: UserFeedbackRecord = {
      ...input,
      id: `UFG-${Date.now()}-${this.records.length + 1}`,
      decision: input.polarity === 'NEUTRAL' ? 'EVIDENCE_ONLY' : 'REQUIRES_CORROBORATION',
      finalStateChanged: false,
      observedAt: Date.now(),
    };
    this.records.push(record);
    this.records = this.records.slice(-5000);
    storageService.setItem(KEY, JSON.stringify(this.records));
    return record;
  }

  public list(subjectId?: string): UserFeedbackRecord[] {
    return this.records
      .filter((record) => !subjectId || record.subjectId === subjectId)
      .map((record) => ({ ...record }));
  }
}

export const userFeedbackGovernanceService = new UserFeedbackGovernanceService();
