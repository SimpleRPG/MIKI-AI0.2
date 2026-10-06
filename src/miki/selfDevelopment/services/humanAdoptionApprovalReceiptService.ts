import { storageService } from '../../../services/storageService';
import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';

const KEY = 'miki_human_adoption_approval_receipts_v1';

export type HumanAdoptionDecision = 'APPROVE' | 'REJECT';
export type HumanAdoptionApprovalStatus = 'ACTIVE' | 'STALE' | 'REVOKED';

export interface HumanAdoptionApprovalReceipt {
  approvalId: string;
  candidateId: string;
  candidateHash: string;
  reviewPackageHash: string;
  baseRevision: string;
  approver: string;
  decision: HumanAdoptionDecision;
  reason: string;
  approvedAt: number;
  status: HumanAdoptionApprovalStatus;
  staleReason?: string;
  receiptSha256: string;
}

export interface CreateHumanAdoptionApprovalInput {
  candidateId: string;
  candidateHash: string;
  reviewPackageHash: string;
  baseRevision: string;
  approver: string;
  decision: HumanAdoptionDecision;
  reason: string;
  approvedAt?: number;
}

class HumanAdoptionApprovalReceiptService {
  create(input: CreateHumanAdoptionApprovalInput): HumanAdoptionApprovalReceipt {
    const normalized = {
      candidateId: input.candidateId.trim(),
      candidateHash: input.candidateHash.trim(),
      reviewPackageHash: input.reviewPackageHash.trim(),
      baseRevision: input.baseRevision.trim(),
      approver: input.approver.trim(),
      decision: input.decision,
      reason: input.reason.trim(),
      approvedAt: input.approvedAt ?? Date.now(),
    };
    if (!normalized.candidateId || !normalized.candidateHash || !normalized.reviewPackageHash || !normalized.baseRevision || !normalized.approver || !normalized.reason) {
      throw new Error('HUMAN_APPROVAL_RECEIPT_REQUIRED_FIELD_MISSING');
    }
    const approvalId = `APPROVAL-${canonicalSha256Object(normalized).slice(0, 24)}`;
    const unsigned = { approvalId, ...normalized, status: 'ACTIVE' as const };
    const receipt: HumanAdoptionApprovalReceipt = { ...unsigned, receiptSha256: canonicalSha256Object(unsigned) };
    const rows = this.list().filter(row => row.approvalId !== approvalId);
    rows.unshift(receipt);
    storageService.setItem(KEY, JSON.stringify(rows.slice(0, 500)));
    return { ...receipt };
  }

  list(candidateId?: string): HumanAdoptionApprovalReceipt[] {
    try {
      const parsed = JSON.parse(storageService.getItem(KEY) || '[]');
      const rows = Array.isArray(parsed) ? parsed as HumanAdoptionApprovalReceipt[] : [];
      return rows.filter(row => !candidateId || row.candidateId === candidateId).map(row => ({ ...row }));
    } catch {
      return [];
    }
  }

  latestActive(candidateId: string): HumanAdoptionApprovalReceipt | undefined {
    return this.list(candidateId).find(row => row.status === 'ACTIVE');
  }

  invalidateForRevision(candidateId: string, currentCandidateHash: string, currentReviewPackageHash: string, currentBaseRevision: string): HumanAdoptionApprovalReceipt[] {
    const rows = this.list();
    let changed = false;
    const next = rows.map(row => {
      if (row.candidateId !== candidateId || row.status !== 'ACTIVE') {
        return row;
      }
      const reasons: string[] = [];
      if (row.candidateHash !== currentCandidateHash) reasons.push('CANDIDATE_HASH_CHANGED');
      if (row.reviewPackageHash !== currentReviewPackageHash) reasons.push('REVIEW_PACKAGE_HASH_CHANGED');
      if (row.baseRevision !== currentBaseRevision) reasons.push('BASE_REVISION_CHANGED');
      if (!reasons.length) return row;
      changed = true;
      const unsigned = { ...row, status: 'STALE' as const, staleReason: reasons.join('|') };
      const { receiptSha256: _old, ...rehash } = unsigned;
      return { ...unsigned, receiptSha256: canonicalSha256Object(rehash) };
    });
    if (changed) storageService.setItem(KEY, JSON.stringify(next));
    return next.filter(row => row.candidateId === candidateId).map(row => ({ ...row }));
  }

  validate(receipt: HumanAdoptionApprovalReceipt | undefined, expected: { candidateId: string; candidateHash: string; reviewPackageHash: string; baseRevision: string }): string[] {
    if (!receipt) return ['HUMAN_APPROVAL_RECEIPT_MISSING'];
    const reasons: string[] = [];
    const { receiptSha256, ...unsigned } = receipt;
    if (canonicalSha256Object(unsigned) !== receiptSha256) reasons.push('HUMAN_APPROVAL_RECEIPT_HASH_INVALID');
    if (receipt.status !== 'ACTIVE') reasons.push('HUMAN_APPROVAL_RECEIPT_NOT_ACTIVE');
    if (receipt.decision !== 'APPROVE') reasons.push('HUMAN_APPROVAL_NOT_APPROVED');
    if (receipt.candidateId !== expected.candidateId) reasons.push('HUMAN_APPROVAL_CANDIDATE_ID_MISMATCH');
    if (receipt.candidateHash !== expected.candidateHash) reasons.push('HUMAN_APPROVAL_CANDIDATE_HASH_MISMATCH');
    if (receipt.reviewPackageHash !== expected.reviewPackageHash) reasons.push('HUMAN_APPROVAL_PACKAGE_HASH_MISMATCH');
    if (receipt.baseRevision !== expected.baseRevision) reasons.push('HUMAN_APPROVAL_BASE_REVISION_MISMATCH');
    return reasons;
  }
}

export const humanAdoptionApprovalReceiptService = new HumanAdoptionApprovalReceiptService();
