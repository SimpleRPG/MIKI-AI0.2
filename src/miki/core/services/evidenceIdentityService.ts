import { storageService } from '../../../services/storageService';

const SEQUENCE_KEY = 'miki_evidence_identity_sequence_v1';

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

class EvidenceIdentityService {
  private sequence = this.loadSequence();

  public create(namespace: string, canonicalPayload: string): string {
    const safeNamespace = namespace.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'generic';
    this.sequence += 1;
    storageService.setItem(SEQUENCE_KEY, String(this.sequence));
    const digest = stableHash(`${safeNamespace}|${canonicalPayload}`);
    return `ev_${safeNamespace}_${String(this.sequence).padStart(10, '0')}_${digest}`;
  }

  private loadSequence(): number {
    const value = Number(storageService.getItem(SEQUENCE_KEY) || '0');
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  }
}

export const evidenceIdentityService = new EvidenceIdentityService();
