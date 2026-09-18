import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { researchService } from '../../research/services/researchService';
import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { taskBlackboardService } from './taskBlackboardService';

export type RequiredAssetKind = 'EVIDENCE' | 'CAPABILITY' | 'VALIDATION_SCRIPT' | 'RESOURCE_CAPACITY';
export type RequiredAssetStatus = 'OPEN' | 'ACQUIRING' | 'ACQUIRED' | 'BLOCKED';

export interface RequiredAssetRequest {
  acquisitionId: string;
  runId?: string;
  taskId?: string;
  workspaceId?: string;
  kind: RequiredAssetKind;
  requirement: string;
  status: RequiredAssetStatus;
  attempts: number;
  evidenceIds: string[];
  gapIds: string[];
  createdAt: number;
  updatedAt: number;
  lastError?: string;
}

export interface RequiredAssetAcquisitionResult {
  progressed: boolean;
  acquired: boolean;
  evidenceIds: string[];
  reasons: string[];
  requests: RequiredAssetRequest[];
}

const STORAGE_KEY = 'miki_required_asset_acquisition_v1';

class RequiredAssetAcquisitionService {
  private requests = new Map<string, RequiredAssetRequest>();
  private sequence = 0;

  public constructor() {
    this.load();
  }

  public async acquire(input: {
    runId?: string;
    taskId?: string;
    workspaceId?: string;
    reasons: string[];
    objective: string;
  }): Promise<RequiredAssetAcquisitionResult> {
    const requirements = this.classify(input.reasons);
    const evidenceIds: string[] = [];
    const reasons: string[] = [];
    let progressed = false;
    let acquired = requirements.length > 0;

    for (const requirement of requirements) {
      const request = this.upsert({ ...input, ...requirement });
      request.status = 'ACQUIRING';
      request.attempts += 1;
      request.updatedAt = Date.now();
      this.save();

      if (requirement.kind === 'EVIDENCE') {
        const outcome = await this.acquireEvidence(request, input.objective);
        progressed = progressed || outcome.progressed;
        acquired = acquired && outcome.acquired;
        evidenceIds.push(...outcome.evidenceIds);
        reasons.push(...outcome.reasons);
      } else {
        const outcome = this.acquireCapabilityRecord(request, input.objective);
        progressed = progressed || outcome.progressed;
        acquired = acquired && outcome.acquired;
        reasons.push(...outcome.reasons);
      }
    }

    if (input.taskId && progressed) {
      taskBlackboardService.append(
        input.taskId,
        'EVIDENCE',
        'core',
        'required-assets-acquired',
        { requirements: requirements.map(item => item.requirement), reasons },
        [...new Set(evidenceIds)]
      );
    }

    return {
      progressed,
      acquired,
      evidenceIds: [...new Set(evidenceIds)],
      reasons,
      requests: requirements.map(item => this.find(input.runId, item.kind, item.requirement)).filter((item): item is RequiredAssetRequest => Boolean(item)),
    };
  }

  public list(limit = 200): RequiredAssetRequest[] {
    return [...this.requests.values()]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, limit)
      .map(item => ({ ...item, evidenceIds: [...item.evidenceIds], gapIds: [...item.gapIds] }));
  }

  private async acquireEvidence(request: RequiredAssetRequest, objective: string): Promise<{ progressed: boolean; acquired: boolean; evidenceIds: string[]; reasons: string[] }> {
    const gap = knowledgeGapService.detect({
      query: `${objective}\n必要Evidence: ${request.requirement}`,
      reason: request.requirement,
      type: 'INSUFFICIENT_EVIDENCE',
      priority: 90,
      requiredEvidence: [request.requirement],
      sourceRequestId: request.runId,
    });
    if (!request.gapIds.includes(gap.id)) {
      request.gapIds.push(gap.id);
    }
    try {
      const researched = await researchService.researchGap(gap);
      const evidenceIds = this.extractEvidenceIds(researched);
      request.evidenceIds = [...new Set([...request.evidenceIds, ...evidenceIds])];
      request.status = evidenceIds.length > 0 ? 'ACQUIRED' : 'BLOCKED';
      request.lastError = evidenceIds.length > 0 ? undefined : 'RESEARCH_RETURNED_NO_EVIDENCE_ID';
      request.updatedAt = Date.now();
      this.save();
      return {
        progressed: true,
        acquired: evidenceIds.length > 0,
        evidenceIds,
        reasons: evidenceIds.length > 0 ? [`EVIDENCE_ACQUIRED:${gap.id}`] : [`EVIDENCE_RESEARCHED_BUT_UNLINKED:${gap.id}`],
      };
    } catch (error) {
      request.status = 'BLOCKED';
      request.lastError = error instanceof Error ? error.message : String(error);
      request.updatedAt = Date.now();
      this.save();
      systemLogger.warn('SELF_IMPROVEMENT', '[RequiredAssetAcquisition] evidence acquisition failed', request.lastError);
      return { progressed: false, acquired: false, evidenceIds: [], reasons: [`EVIDENCE_ACQUISITION_FAILED:${request.lastError}`] };
    }
  }

  private acquireCapabilityRecord(request: RequiredAssetRequest, objective: string): { progressed: boolean; acquired: boolean; reasons: string[] } {
    const entry = capabilityGapService.recordGap({
      capabilityId: `required_asset.${request.kind.toLowerCase()}`,
      description: `${objective}: ${request.requirement}`,
      gap_type: 'failure',
      impact: 'HIGH',
      current_workaround: request.workspaceId ? `候補Workspace ${request.workspaceId} を保持して必要資産を追加する` : '必要資産を追加してから同じRunを再開する',
      candidate_solution: '必要資産の取得および検証スクリプトの充足',
      source: 'observed',
      evidenceIds: request.runId ? [request.runId] : [],
    });
    request.gapIds = [...new Set([...request.gapIds, entry.gap_id])];
    request.status = 'OPEN';
    request.updatedAt = Date.now();
    this.save();
    return { progressed: true, acquired: false, reasons: [`CAPABILITY_GAP_CREATED:${entry.gap_id}`] };
  }

  private classify(reasons: string[]): Array<{ kind: RequiredAssetKind; requirement: string }> {
    const output: Array<{ kind: RequiredAssetKind; requirement: string }> = [];
    for (const raw of reasons) {
      const reason = raw.trim();
      if (!reason) {
        continue;
      }
      if (/RESOURCE|MEMORY_ONLY|BATTERY|THERMAL|CAPACITY/i.test(reason)) {
        output.push({ kind: 'RESOURCE_CAPACITY', requirement: reason });
      } else if (/REQUIRED_SCRIPT_NOT_FOUND|MISSING_(STATIC|TYPECHECK|REGRESSION|COUNTEREXAMPLE|GENERALIZATION|PERSISTENCE|DEVICE)/i.test(reason)) {
        output.push({ kind: 'VALIDATION_SCRIPT', requirement: reason });
      } else if (/EVIDENCE|UNKNOWN|NOT_FOUND|MISSING|HTTP_|SEARCH|RESEARCH|REQUIRED/i.test(reason)) {
        output.push({ kind: 'EVIDENCE', requirement: reason });
      } else {
        output.push({ kind: 'CAPABILITY', requirement: reason });
      }
    }
    const seen = new Set<string>();
    return output.filter(item => {
      const key = `${item.kind}:${item.requirement}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private upsert(input: {
    runId?: string;
    taskId?: string;
    workspaceId?: string;
    kind: RequiredAssetKind;
    requirement: string;
  }): RequiredAssetRequest {
    const existing = this.find(input.runId, input.kind, input.requirement);
    if (existing) {
      existing.taskId = input.taskId || existing.taskId;
      existing.workspaceId = input.workspaceId || existing.workspaceId;
      existing.updatedAt = Date.now();
      return existing;
    }
    this.sequence += 1;
    const now = Date.now();
    const created: RequiredAssetRequest = {
      acquisitionId: `RAQ-${now}-${String(this.sequence).padStart(6, '0')}`,
      runId: input.runId,
      taskId: input.taskId,
      workspaceId: input.workspaceId,
      kind: input.kind,
      requirement: input.requirement,
      status: 'OPEN',
      attempts: 0,
      evidenceIds: [],
      gapIds: [],
      createdAt: now,
      updatedAt: now,
    };
    this.requests.set(created.acquisitionId, created);
    this.save();
    return created;
  }

  private find(runId: string | undefined, kind: RequiredAssetKind, requirement: string): RequiredAssetRequest | undefined {
    return [...this.requests.values()].find(item => item.runId === runId && item.kind === kind && item.requirement === requirement);
  }

  private extractEvidenceIds(value: unknown): string[] {
    const output: string[] = [];
    const visit = (current: unknown, depth: number): void => {
      if (depth > 5 || current === null || current === undefined) {
        return;
      }
      if (Array.isArray(current)) {
        for (const item of current) {
          visit(item, depth + 1);
        }
        return;
      }
      if (typeof current !== 'object') {
        return;
      }
      for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
        if (/^evidence(ids?)?$/i.test(key)) {
          if (typeof child === 'string' && child.trim()) {
            output.push(child.trim());
          } else if (Array.isArray(child)) {
            for (const id of child) {
              if (typeof id === 'string' && id.trim()) {
                output.push(id.trim());
              }
            }
          }
        }
        visit(child, depth + 1);
      }
    };
    visit(value, 0);
    return [...new Set(output)];
  }

  private save(): void {
    storageService.setItem(STORAGE_KEY, JSON.stringify(this.list(500)));
  }

  private load(): void {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.acquisitionId === 'string') {
            this.requests.set(item.acquisitionId, item as RequiredAssetRequest);
          }
        }
      }
    } catch (error) {
      this.requests.clear();
      systemLogger.warn('SELF_IMPROVEMENT', '[RequiredAssetAcquisition] state load failed', String(error));
    }
  }
}

export const requiredAssetAcquisitionService = new RequiredAssetAcquisitionService();
