import type { WebSearchResultItem } from '../../../types';
import { storageService } from '../../../services/storageService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { evidenceService } from '../../memory/services/evidenceService';
import { knowledgeGapService } from './knowledgeGapService';
import { unknownResolutionService } from './unknownResolutionService';

export interface UnknownEvidenceLink {
  evidenceId: string;
  unknownId: string;
  claimId?: string;
  expiresAt: number;
  status: 'RETRIEVED' | 'SUPPORTED' | 'CONFLICTED' | 'STALE';
}

const STORAGE_KEY = 'miki_unknown_evidence_links_v31';

class UnknownKnowledgeIntegrationService {
  private links: UnknownEvidenceLink[] = [];
  private persistenceError?: string;

  constructor() {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      this.links = raw ? JSON.parse(raw) : [];
    } catch (error) {
      this.links = [];
      this.persistenceError = String(error);
    }
  }

  ingestWeb(params: { unknownId: string; question: string; results: WebSearchResultItem[]; experienceId?: string }) {
    const evidenceIds: string[] = [];
    const claimIds: string[] = [];
    const ttl = this.ttl(params.question);

    for (const result of params.results.slice(0, 8)) {
      const statement = (result.snippet || result.title).trim().slice(0, 1200);
      if (!statement) continue;
      const evidence = evidenceService.recordWebEvidence({
        title: result.title,
        snippet: statement,
        source: result.source,
        url: result.url,
        publishedDate: result.publishedDate,
        sourceId: params.unknownId,
      });
      const claimId = evidenceService.registerUnverifiedClaim(evidence.evidence_id, statement);
      evidenceIds.push(evidence.evidence_id);
      if (claimId) claimIds.push(claimId);
      this.links.push({
        evidenceId: evidence.evidence_id,
        unknownId: params.unknownId,
        claimId,
        expiresAt: Date.now() + ttl,
        status: 'RETRIEVED',
      });
    }

    const gap = knowledgeGapService.detect({
      query: params.question,
      reason: 'Web由来Evidenceは取得済みだが、主張単位の独立検証が未完了',
      requiredEvidence: ['一次資料または再現可能な独立検証結果'],
      sourceRequestId: params.unknownId,
    });

    unknownResolutionService.link(params.unknownId, {
      evidenceIds,
      claimIds,
      experienceIds: params.experienceId ? [params.experienceId] : [],
      knowledgeGapIds: [gap.id],
    });
    this.save();
    return { evidenceIds, claimIds, knowledgeGapId: gap.id };
  }

  reconcileVerification(claimId: string): void {
    const claim = claimDatabaseService.getClaim(claimId);
    if (!claim) return;
    const related = this.links.filter((link) => link.claimId === claimId);
    for (const link of related) {
      if (claim.status === 'CONTRADICTED' || claim.status === 'FALSE') {
        link.status = 'CONFLICTED';
        unknownResolutionService.markVerification(link.unknownId, 'CONFLICTED', 0.1);
      } else if (claim.status === 'SUPPORTED' || claim.status === 'DEVICE_VERIFIED') {
        link.status = 'SUPPORTED';
        this.promoteIfComplete(link.unknownId);
      }
    }
    this.save();
  }

  findReusable(question: string) {
    const resolution = unknownResolutionService.findReusable(question);
    if (!resolution) return undefined;
    const now = Date.now();
    const links = this.links.filter((link) => link.unknownId === resolution.id && link.status === 'SUPPORTED');
    if (!links.length || links.some((link) => link.expiresAt <= now)) {
      unknownResolutionService.markVerification(resolution.id, 'STALE', 0.2);
      return undefined;
    }
    return { resolution, evidence: links.map((link) => evidenceService.getEvidence(link.evidenceId)).filter(Boolean) };
  }

  listByUnknown(unknownId: string): UnknownEvidenceLink[] {
    return this.links.filter((link) => link.unknownId === unknownId).map((link) => ({ ...link }));
  }

  async ensurePersistent() {
    const backend = storageService.getBackendName();
    if (backend === 'memory') return { persisted: false, backend, error: 'MEMORY_ONLY' };
    try {
      await storageService.flushNow();
      return { persisted: true, backend };
    } catch (error) {
      return { persisted: false, backend, error: String(error) };
    }
  }

  getPersistenceStatus() {
    return { persisted: !this.persistenceError, error: this.persistenceError };
  }

  private promoteIfComplete(unknownId: string): void {
    const links = this.links.filter((link) => link.unknownId === unknownId && link.claimId);
    if (!links.length) return;
    const complete = links.every((link) => {
      const claim = link.claimId ? claimDatabaseService.getClaim(link.claimId) : undefined;
      return claim?.status === 'SUPPORTED' || claim?.status === 'DEVICE_VERIFIED';
    });
    if (!complete) return;
    unknownResolutionService.markVerification(unknownId, 'SUPPORTED', 0.85);
    const resolution = unknownResolutionService.list(500).find((item) => item.id === unknownId);
    for (const gapId of resolution?.knowledgeGapIds || []) knowledgeGapService.markResolved(gapId);
  }

  private ttl(question: string): number {
    if (/最新|今日|ニュース|価格|現在/.test(question)) return 3 * 24 * 60 * 60 * 1000;
    if (/API|仕様|バージョン|製品/i.test(question)) return 30 * 24 * 60 * 60 * 1000;
    return 180 * 24 * 60 * 60 * 1000;
  }

  private save(): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(this.links.slice(-1000)));
      this.persistenceError = undefined;
    } catch (error) {
      this.persistenceError = String(error);
      console.error('[UnknownKnowledgeIntegration] persistence failed', error);
    }
  }
}

export const unknownKnowledgeIntegrationService = new UnknownKnowledgeIntegrationService();
