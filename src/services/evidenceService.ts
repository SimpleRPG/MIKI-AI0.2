import { storageService } from './storageService';
import { claimDatabaseService } from './claimDatabaseService';
import { systemLogger } from './systemLogger';

const EVIDENCE_STORAGE_KEY = 'miki_evidence_db_v1';

export type EvidenceKind = 'WEB' | 'USER_OBSERVATION' | 'EXECUTION' | 'DOCUMENT' | 'CLOUD_AI';
export type EvidenceStatus = 'DISCOVERED' | 'ADMISSIBLE' | 'REJECTED';

export interface EvidenceRecord {
  evidence_id: string;
  kind: EvidenceKind;
  status: EvidenceStatus;
  title: string;
  snippet: string;
  source: string;
  source_id?: string;
  url?: string;
  published_date?: string;
  independence_cluster_id: string;
  created_at: number;
  claim_ids: string[];
  rejection_reason?: string;
  metadata?: {
    component_id?: string;
    implementation_hash?: string;
    test_category?: string;
    passed?: boolean;
    environment?: string;
    runner?: string;
    observed_at?: number;
    result_summary?: string;
    artifact_snapshot_key?: string;
    test_case_id?: string;
    test_case_source?: string;
    expected_summary?: string;
    assertion_status?: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
    assertion_rule?: string;
    assertion_reason?: string;
    actual_output_summary?: string;
  };
}

/**
 * Evidence is deliberately separated from Claim.
 * A discovered source is not a fact, and evidence never promotes a Claim by itself.
 */
export class EvidenceService {
  private static instance: EvidenceService;
  private records = new Map<string, EvidenceRecord>();
  private counter = 1;

  private constructor() {
    this.load();
  }

  public static getInstance(): EvidenceService {
    if (!EvidenceService.instance) EvidenceService.instance = new EvidenceService();
    return EvidenceService.instance;
  }

  public recordWebEvidence(input: {
    title: string;
    snippet: string;
    source: string;
    url?: string;
    publishedDate?: string;
    sourceId?: string;
    independenceClusterId?: string;
    metadata?: EvidenceRecord['metadata'];
  }): EvidenceRecord {
    const now = Date.now();
    const evidence_id = `EVD-${String(this.counter++).padStart(6, '0')}`;
    const synthetic = this.isSyntheticFallback(input);

    const record: EvidenceRecord = {
      evidence_id,
      kind: 'WEB',
      status: synthetic ? 'REJECTED' : 'DISCOVERED',
      title: input.title.trim(),
      snippet: input.snippet.trim(),
      source: input.source.trim() || 'unknown',
      source_id: input.sourceId,
      url: input.url,
      published_date: input.publishedDate,
      independence_cluster_id: input.independenceClusterId || this.defaultCluster(input),
      created_at: now,
      claim_ids: [],
      rejection_reason: synthetic
        ? 'synthetic/offline fallback is not admissible evidence'
        : undefined,
    };

    this.records.set(evidence_id, record);
    this.save();

    if (synthetic) {
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `⛔ [Evidence] synthetic fallbackを証拠として拒否: ${evidence_id}`
      );
    }

    return record;
  }

  /**
   * EvidenceからClaimを発見状態で登録する。
   * SUPPORTED / DEVICE_VERIFIEDへの昇格はここでは行わない。
   */
  public recordExecutionEvidence(input: {
    title: string;
    snippet: string;
    source?: string;
    sourceId?: string;
    independenceClusterId?: string;
    metadata?: EvidenceRecord['metadata'];
  }): EvidenceRecord {
    const now = Date.now();
    const evidence_id = `EVD-${String(this.counter++).padStart(6, '0')}`;
    const record: EvidenceRecord = {
      evidence_id,
      kind: 'EXECUTION',
      status: 'DISCOVERED',
      title: input.title.trim(),
      snippet: input.snippet.trim(),
      source: (input.source || 'local_execution').trim(),
      source_id: input.sourceId,
      independence_cluster_id: input.independenceClusterId || `cluster_execution_${input.sourceId || 'local'}`,
      created_at: now,
      claim_ids: [],
      metadata: input.metadata,
    };
    this.records.set(evidence_id, record);
    this.save();
    return record;
  }

  public attachEvidenceToClaim(evidenceId: string, claimId: string): boolean {
    const evidence = this.records.get(evidenceId);
    const claim = claimDatabaseService.getClaim(claimId);
    if (!evidence || !claim || evidence.status === 'REJECTED') return false;
    if (!evidence.claim_ids.includes(claimId)) evidence.claim_ids.push(claimId);
    evidence.status = 'ADMISSIBLE';
    this.save();
    return true;
  }

  public registerUnverifiedClaim(
    evidenceId: string,
    statement?: string
  ): string | undefined {
    const evidence = this.records.get(evidenceId);
    if (!evidence || evidence.status === 'REJECTED') return undefined;

    const text = (statement || evidence.snippet).trim();
    if (text.length < 15) return undefined;

    const claim = claimDatabaseService.registerClaim({
      statement: text,
      world: 'REAL',
      kind: 'FACT_CLAIM',
      status: 'UNVERIFIED',
      source: 'web_search',
      origin_source_id:
        evidence.source_id || evidence.url || evidence.evidence_id,
      independence_cluster_id: evidence.independence_cluster_id,
      maturity: 'DISCOVERED',
      self_provenance: 'INDEPENDENTLY_SUPPORTED',
    });

    evidence.claim_ids.push(claim.claim_id);
    evidence.status = 'ADMISSIBLE';
    this.save();

    return claim.claim_id;
  }

  public registerExecutionClaim(evidenceId: string, statement: string): string | undefined {
    const evidence = this.records.get(evidenceId);
    if (!evidence || evidence.status === 'REJECTED' || evidence.kind !== 'EXECUTION') return undefined;
    const text = statement.trim();
    if (text.length < 15) return undefined;

    const claim = claimDatabaseService.registerClaim({
      statement: text,
      world: 'REAL',
      kind: 'FACT_CLAIM',
      status: 'UNVERIFIED',
      source: 'execution_runner',
      origin_source_id: evidence.source_id || evidence.evidence_id,
      independence_cluster_id: evidence.independence_cluster_id,
      maturity: 'DISCOVERED',
      self_provenance: 'INDEPENDENTLY_SUPPORTED',
    });

    if (!evidence.claim_ids.includes(claim.claim_id)) evidence.claim_ids.push(claim.claim_id);
    evidence.status = 'ADMISSIBLE';
    this.save();
    return claim.claim_id;
  }

  public getEvidence(id: string): EvidenceRecord | undefined {
    return this.records.get(id);
  }

  public isAdmissibleExecutionEvidence(input: {
    evidenceId: string;
    componentId: string;
    implementationHash: string;
    artifactSnapshotKey: string;
    testCaseId: string;
    environment: string;
    expectedSummary?: string;
  }): boolean {
    const evidence = this.records.get(input.evidenceId);
    if (!evidence || evidence.kind !== 'EXECUTION' || evidence.status !== 'ADMISSIBLE') return false;
    const meta = evidence.metadata;
    if (!meta || meta.assertion_status !== 'PASS' || meta.component_id !== input.componentId || meta.implementation_hash !== input.implementationHash ||
        meta.artifact_snapshot_key !== input.artifactSnapshotKey || meta.test_case_id !== input.testCaseId ||
        meta.environment !== input.environment || meta.passed !== true) return false;
    if (input.expectedSummary !== undefined && meta.expected_summary !== input.expectedSummary) return false;
    return true;
  }

  public list(filter?: {
    status?: EvidenceStatus;
    claimId?: string;
  }): EvidenceRecord[] {
    return Array.from(this.records.values()).filter((record) => {
      if (filter?.status && record.status !== filter.status) return false;
      if (filter?.claimId && !record.claim_ids.includes(filter.claimId)) return false;
      return true;
    });
  }

  public getIndependentClusterCount(evidenceIds: string[]): number {
    const clusters = new Set<string>();

    for (const id of evidenceIds) {
      const evidence = this.records.get(id);
      if (evidence && evidence.status !== 'REJECTED') {
        clusters.add(evidence.independence_cluster_id);
      }
    }

    return clusters.size;
  }

  private isSyntheticFallback(input: {
    title: string;
    snippet: string;
    source: string;
    url?: string;
  }): boolean {
    const text =
      `${input.title} ${input.snippet} ${input.source} ${input.url || ''}`.toLowerCase();

    return [
      'local synthetic fallback',
      'synthetic fallback',
      'offline fallback',
      'fallback result',
      'synthetic result',
    ].some((marker) => text.includes(marker));
  }

  private defaultCluster(input: { source: string; url?: string }): string {
    const host = input.url
      ? input.url.replace(/^https?:\/\//, '').split('/')[0]
      : input.source;

    return `cluster_web_${host.toLowerCase() || 'unknown'}`;
  }

  private load(): void {
    try {
      const raw = storageService.getItem(EVIDENCE_STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return;

      for (const item of data as EvidenceRecord[]) {
        this.records.set(item.evidence_id, item);
      }

      const max = data.reduce((n: number, item: EvidenceRecord) => {
        const match = /^EVD-(\d+)$/.exec(item.evidence_id);
        return match ? Math.max(n, Number(match[1])) : n;
      }, 0);

      this.counter = max + 1;
    } catch {
      // Ignore malformed persisted evidence.
    }
  }

  private save(): void {
    try {
      storageService.setItem(
        EVIDENCE_STORAGE_KEY,
        JSON.stringify(Array.from(this.records.values()))
      );
    } catch {
      // Ignore persistence failures.
    }
  }
}

export const evidenceService = EvidenceService.getInstance();
