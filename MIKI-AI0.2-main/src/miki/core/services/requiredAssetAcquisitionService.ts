import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { researchService } from '../../research/services/researchService';
import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { taskBlackboardService } from './taskBlackboardService';
import { reusableComponentFactoryService } from './reusableComponentFactoryService';

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

export interface RequiredAssetAcquisitionDiagnostics {
  localEvidenceIds: string[];
  webEvidenceIds: string[];
  linkedEvidenceIds: string[];
  unlinkedEvidenceIds: string[];
  componentIds: string[];
  state:
    | 'ACQUIRED_LOCAL_AND_WEB'
    | 'ACQUIRED_LOCAL'
    | 'ACQUIRED_WEB'
    | 'RESEARCH_PROGRESS_UNLINKED'
    | 'RESEARCH_FAILED'
    | 'CAPABILITY_GAP'
    | 'NO_REQUIREMENTS';
}

export interface RequiredAssetAcquisitionResult {
  progressed: boolean;
  acquired: boolean;
  evidenceIds: string[];
  reasons: string[];
  requests: RequiredAssetRequest[];
  diagnostics: RequiredAssetAcquisitionDiagnostics;
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
    const localEvidenceIds: string[] = [];
    const webEvidenceIds: string[] = [];
    const linkedEvidenceIds: string[] = [];
    const unlinkedEvidenceIds: string[] = [];
    const componentIds: string[] = [];
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
        localEvidenceIds.push(...outcome.localEvidenceIds);
        webEvidenceIds.push(...outcome.webEvidenceIds);
        linkedEvidenceIds.push(...outcome.linkedEvidenceIds);
        unlinkedEvidenceIds.push(...outcome.unlinkedEvidenceIds);
        componentIds.push(...outcome.componentIds);
        reasons.push(...outcome.reasons);
      } else {
        const outcome = this.acquireCapabilityRecord(request, input.objective);
        progressed = progressed || outcome.progressed;
        acquired = acquired && outcome.acquired;
        reasons.push(...outcome.reasons);
      }
    }

    if (input.taskId && progressed) {
      const blackboardEvidenceIds = [...new Set(evidenceIds)];

      systemLogger.info(
        'SELF_IMPROVEMENT',
        '[RequiredAssetAcquisition] BLACKBOARD_APPEND',
        JSON.stringify({
          taskId: input.taskId,
          evidenceCount: blackboardEvidenceIds.length,
          evidenceIds: blackboardEvidenceIds,
          reasonCount: reasons.length,
        }),
      );

      taskBlackboardService.append(
        input.taskId,
        'EVIDENCE',
        'core',
        'required-assets-acquired',
        {
          requirements: requirements.map(item => item.requirement),
          reasons,
        },
        blackboardEvidenceIds
      );
    }

    const uniqueLocalEvidenceIds = [...new Set(localEvidenceIds)];
    const uniqueWebEvidenceIds = [...new Set(webEvidenceIds)];
    const uniqueLinkedEvidenceIds = [...new Set(linkedEvidenceIds)];
    const uniqueUnlinkedEvidenceIds = [...new Set(unlinkedEvidenceIds)];
    const uniqueComponentIds = [...new Set(componentIds)];

    const diagnostics: RequiredAssetAcquisitionDiagnostics = {
      localEvidenceIds: uniqueLocalEvidenceIds,
      webEvidenceIds: uniqueWebEvidenceIds,
      linkedEvidenceIds: uniqueLinkedEvidenceIds,
      unlinkedEvidenceIds: uniqueUnlinkedEvidenceIds,
      componentIds: uniqueComponentIds,
      state:
        requirements.length === 0
          ? 'NO_REQUIREMENTS'
          : uniqueUnlinkedEvidenceIds.length > 0 && !acquired
            ? 'RESEARCH_PROGRESS_UNLINKED'
            : uniqueLocalEvidenceIds.length > 0 && uniqueWebEvidenceIds.length > 0
              ? 'ACQUIRED_LOCAL_AND_WEB'
              : uniqueLocalEvidenceIds.length > 0
                ? 'ACQUIRED_LOCAL'
                : uniqueWebEvidenceIds.length > 0
                  ? 'ACQUIRED_WEB'
                  : reasons.some(reason => reason.startsWith('EVIDENCE_ACQUISITION_FAILED'))
                    ? 'RESEARCH_FAILED'
                    : requirements.some(item => item.kind !== 'EVIDENCE') && !acquired
                      ? 'CAPABILITY_GAP'
                      : acquired
                        ? 'ACQUIRED_WEB'
                        : 'RESEARCH_FAILED',
    };

    return {
      progressed,
      acquired,
      evidenceIds: [...new Set(evidenceIds)],
      reasons,
      requests: requirements.map(item => this.find(input.runId, item.kind, item.requirement)).filter((item): item is RequiredAssetRequest => Boolean(item)),
      diagnostics,
    };
  }

  public list(limit = 200): RequiredAssetRequest[] {
    return [...this.requests.values()]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, limit)
      .map(item => ({ ...item, evidenceIds: [...item.evidenceIds], gapIds: [...item.gapIds] }));
  }

  private async acquireEvidence(
    request: RequiredAssetRequest,
    objective: string
  ): Promise<{
    progressed: boolean;
    acquired: boolean;
    evidenceIds: string[];
    localEvidenceIds: string[];
    webEvidenceIds: string[];
    linkedEvidenceIds: string[];
    unlinkedEvidenceIds: string[];
    componentIds: string[];
    reasons: string[];
  }> {
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
      systemLogger.info(
        'SELF_IMPROVEMENT',
        '[RequiredAssetAcquisition] researchGap START',
        JSON.stringify({
          gapId: gap.id,
          runId: request.runId,
          taskId: request.taskId,
          workspaceId: request.workspaceId,
          objectiveLength: objective.length,
          requirement: request.requirement,
        }),
      );

      const researched = await researchService.researchGap(gap);

      const researchRecord =
        researched && typeof researched === 'object'
          ? researched as Record<string, unknown>
          : {};

      const researchEvidenceIds =
        this.extractEvidenceIds(researched);

      const evidenceRecords =
        this.extractEvidenceRecords(researched);

      systemLogger.info(
        'SELF_IMPROVEMENT',
        '[RequiredAssetAcquisition] researchGap RESULT',
        JSON.stringify({
          gapId: gap.id,
          runId: request.runId,
          taskId: request.taskId,
          resultKeys: Object.keys(researchRecord),
          researchEvidenceIdCount: researchEvidenceIds.length,
          evidenceRecordCount: evidenceRecords.length,
          evidenceRecordIds: evidenceRecords.map(record => record.evidenceId),
          claimIdCount: this.extractStringIds(
            researched,
            /^claim(?:[_-]?ids?)?$/i,
          ).length,
          sourceUrlCount: this.extractStringIds(
            researched,
            /^source(?:[_-]?urls?)?$/i,
          ).length,
        }),
      );

      // EvidenceRecord が取得できた場合は、その evidence_id/evidenceId
      // もRequiredAssetの正式なEvidence IDとして統合する。
      // ResearchResult内の evidenceIds とEvidenceRecordの形が異なっても
      // WAITING_EVIDENCEへ誤って落とさないよう、EvidenceRecordを正規化する。
      const evidenceIds = [
        ...new Set([
          ...researchEvidenceIds,
          ...evidenceRecords.map(record => record.evidenceId),
        ]),
      ];

      systemLogger.info(
        'SELF_IMPROVEMENT',
        '[RequiredAssetAcquisition] EVIDENCE_NORMALIZATION',
        JSON.stringify({
          gapId: gap.id,
          runId: request.runId,
          taskId: request.taskId,
          extractedEvidenceIds: researchEvidenceIds,
          evidenceRecordIds: evidenceRecords.map(record => record.evidenceId),
          mergedEvidenceIds: evidenceIds,
          mergedEvidenceCount: evidenceIds.length,
        }),
      );
      const localEvidenceIds = evidenceRecords
        .filter(item => item.kind === 'LOCAL_CLAIM')
        .map(item => item.evidenceId);

      const webEvidenceIds = evidenceRecords
        .filter(item => item.kind !== 'LOCAL_CLAIM' && Boolean(item.url))
        .map(item => item.evidenceId);

      const linkedEvidenceIds = evidenceIds.filter(id => evidenceRecords.some(item => item.evidenceId === id));
      const unlinkedEvidenceIds = evidenceIds.filter(
        id => !linkedEvidenceIds.includes(id),
      );

      systemLogger.info(
        'SELF_IMPROVEMENT',
        '[RequiredAssetAcquisition] EVIDENCE_LINK_STATUS',
        JSON.stringify({
          gapId: gap.id,
          runId: request.runId,
          taskId: request.taskId,
          evidenceCount: evidenceIds.length,
          linkedCount: linkedEvidenceIds.length,
          unlinkedCount: unlinkedEvidenceIds.length,
          linkedEvidenceIds,
          unlinkedEvidenceIds,
        }),
      );

      let componentIds = this.extractStringIds(
        researched,
        /component(?:[_-]?ids?)?/i
      );

      /*
       * ResearchでEvidence/Claimまで到達している場合は、
       * RequiredAssetだけをACQUIREDにせずKnowledge Componentにも
       * lineageを残す。
       *
       * LOCALとWEBは別々に捨てず、同じKnowledge Componentへ統合する。
       */
      if(evidenceIds.length>0){
        const researchResult=researched as Record<string, unknown>;

        const claimIds=this.extractStringIds(
          researchResult,
          /^claim(?:[_-]?ids?)?$/i
        );

        const sourceUrls=this.extractStringIds(
          researchResult,
          /^source(?:[_-]?urls?)?$/i
        );

        const componentResult=
          reusableComponentFactoryService.integrateResearchKnowledge({
            purpose:objective,
            claimIds,
            evidenceRefs:evidenceIds,
            sourceUrls,
            environmentFingerprint:request.workspaceId||'unknown',
            contradictionRefs:[],
            verificationStatus:'UNVERIFIED',
          });

        const verificationResult=
          reusableComponentFactoryService.verifyResearchKnowledge(
            componentResult.component.componentId,
            claimIds,
            { requireFresh:false },
          );

        componentIds=[
          ...new Set([
            ...componentIds,
            componentResult.component.componentId,
          ])
        ];

        if(componentResult.created){
          reasons.push(
            `KNOWLEDGE_COMPONENT_CREATED:${componentResult.component.componentId}`
          );
        }else if(componentResult.updated){
          reasons.push(
            `KNOWLEDGE_COMPONENT_UPDATED:${componentResult.component.componentId}`
          );
        }

        if(verificationResult.verified){
          reasons.push(
            `KNOWLEDGE_COMPONENT_VERIFIED:${componentResult.component.componentId}`
          );
        }else if(verificationResult.conflicted){
          reasons.push(
            `KNOWLEDGE_COMPONENT_CONFLICT:${componentResult.component.componentId}`
          );
        }
      }

      request.evidenceIds = [
        ...new Set([...request.evidenceIds, ...evidenceIds]),
      ];
      request.status = evidenceIds.length > 0 ? 'ACQUIRED' : 'BLOCKED';

      systemLogger.info(
        'SELF_IMPROVEMENT',
        '[RequiredAssetAcquisition] ACQUISITION_DECISION',
        JSON.stringify({
          gapId: gap.id,
          runId: request.runId,
          taskId: request.taskId,
          acquired: evidenceIds.length > 0,
          progressed: true,
          evidenceCount: evidenceIds.length,
          localEvidenceCount: localEvidenceIds.length,
          webEvidenceCount: webEvidenceIds.length,
          linkedEvidenceCount: linkedEvidenceIds.length,
          unlinkedEvidenceCount: unlinkedEvidenceIds.length,
          componentCount: componentIds.length,
          componentIds,
        }),
      );
      request.lastError = evidenceIds.length > 0 ? undefined : 'RESEARCH_RETURNED_NO_EVIDENCE_ID';
      request.updatedAt = Date.now();
      this.save();

      const acquisitionReasons = evidenceIds.length > 0
        ? [
            `EVIDENCE_ACQUIRED:${gap.id}`,
            ...(localEvidenceIds.length > 0 ? [`LOCAL_EVIDENCE_ACQUIRED:${localEvidenceIds.length}`] : []),
            ...(webEvidenceIds.length > 0 ? [`WEB_EVIDENCE_ACQUIRED:${webEvidenceIds.length}`] : []),
            ...(unlinkedEvidenceIds.length > 0 ? [`EVIDENCE_IDS_UNLINKED:${unlinkedEvidenceIds.length}`] : []),
            ...(componentIds.length > 0 ? [`COMPONENTS_DISCOVERED:${componentIds.length}`] : []),
          ]
        : [`EVIDENCE_RESEARCHED_BUT_UNLINKED:${gap.id}`];

      return {
        progressed: true,
        acquired: evidenceIds.length > 0,
        evidenceIds,
        localEvidenceIds,
        webEvidenceIds,
        linkedEvidenceIds,
        unlinkedEvidenceIds,
        componentIds,
        reasons: acquisitionReasons,
      };
    } catch (error) {
      request.status = 'BLOCKED';
      request.lastError = error instanceof Error ? error.message : String(error);
      request.updatedAt = Date.now();
      this.save();
      systemLogger.warn('SELF_IMPROVEMENT', '[RequiredAssetAcquisition] evidence acquisition failed', request.lastError);
      return {
        progressed: false,
        acquired: false,
        evidenceIds: [],
        localEvidenceIds: [],
        webEvidenceIds: [],
        linkedEvidenceIds: [],
        unlinkedEvidenceIds: [],
        componentIds: [],
        reasons: [`EVIDENCE_ACQUISITION_FAILED:${request.lastError}`],
      };
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

  private extractEvidenceRecords(value: unknown): Array<{ evidenceId: string; kind?: string; url?: string }> {
    const output: Array<{ evidenceId: string; kind?: string; url?: string }> = [];

    const visit = (current: unknown, depth: number): void => {
      if (depth > 6 || current === null || current === undefined || typeof current !== 'object') {
        return;
      }

      if (Array.isArray(current)) {
        for (const item of current) {
          visit(item, depth + 1);
        }
        return;
      }

      const record = current as Record<string, unknown>;
      const evidenceId =
        typeof record.evidence_id === 'string'
          ? record.evidence_id
          : typeof record.evidenceId === 'string'
            ? record.evidenceId
            : undefined;

      if (evidenceId) {
        output.push({
          evidenceId,
          kind:
            typeof record.kind === 'string'
              ? record.kind
              : typeof record.evidence_kind === 'string'
                ? record.evidence_kind
                : undefined,
          url: typeof record.url === 'string' ? record.url : undefined,
        });
      }

      for (const child of Object.values(record)) {
        visit(child, depth + 1);
      }
    };

    visit(value, 0);

    const unique = new Map<string, { evidenceId: string; kind?: string; url?: string }>();
    for (const item of output) {
      unique.set(item.evidenceId, item);
    }
    return [...unique.values()];
  }

  private extractStringIds(value: unknown, keyPattern: RegExp): string[] {
    const output: string[] = [];

    const visit = (current: unknown, depth: number): void => {
      if (depth > 6 || current === null || current === undefined || typeof current !== 'object') {
        return;
      }

      if (Array.isArray(current)) {
        for (const item of current) {
          visit(item, depth + 1);
        }
        return;
      }

      for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
        if (keyPattern.test(key)) {
          if (typeof child === 'string' && child.trim()) {
            output.push(child.trim());
          } else if (Array.isArray(child)) {
            for (const item of child) {
              if (typeof item === 'string' && item.trim()) {
                output.push(item.trim());
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
        if (/^evidence(?:[_-]?ids?)?$/i.test(key)) {
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
