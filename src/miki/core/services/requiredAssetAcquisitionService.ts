import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { researchService } from '../../research/services/researchService';
import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { taskBlackboardService } from './taskBlackboardService';
import { reusableComponentFactoryService } from './reusableComponentFactoryService';
import { missingAssetSynthesisService, type MissingAssetDraftKind } from './missingAssetSynthesisService';
import { missingAssetValidationService } from './missingAssetValidationService';
import { missingCapabilityRecoveryService } from './missingCapabilityRecoveryService';
import { verifierService } from '../../verification/services/verifierService';
import { evidenceService } from '../../../services/evidenceService';
import { claimDatabaseService } from '../../../services/claimDatabaseService';
import {
  japaneseAnalysisService,
  contentTermsFromTokens,
} from '../../research/services/japaneseAnalysisService';

/*
 * P425 B1/B2: Claim 文脈の形（正本は claimDatabaseService の
 * buildClaimContext）。矛盾イベントの購読側が ingress payload で
 * 運び、ループの証拠回復が受け取る。claimId と結果語だけでは
 * 主張の内容が分からず、証拠取得が汎用テンプレートへ落ちていた。
 */
export interface ClaimEvidenceContext {
  claimId: string;
  statement: string;
  scope?: Record<string, unknown>;
  source?: string;
  originSourceId?: string;
  contradictedBy: Array<{ claimId: string; statement: string }>;
}

export type RequiredAssetKind = 'EVIDENCE' | 'CAPABILITY' | 'VALIDATION_SCRIPT' | 'RESOURCE_CAPACITY' | 'BACKEND';
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
    claimContext?: ClaimEvidenceContext;
  }): Promise<RequiredAssetAcquisitionResult> {
    // P366: the persistent-backend requirement is an environment state,
    // not missing knowledge; never plan knowledge synthesis for it.
    const recoveryPlans=missingCapabilityRecoveryService.planAll(input.reasons.filter(reason=>!/PERSISTENT_BACKEND/i.test(reason)));
    if(input.taskId&&recoveryPlans.length>0){taskBlackboardService.append(input.taskId,'DECISION','core','missing-capability-recovery-plans',{plans:recoveryPlans},[]);}
    const expandedReasons = [...input.reasons, ...recoveryPlans.flatMap(plan => plan.actions.map(action => `RECOVERY_ACTION_REQUIRED:${action}:${plan.reason}`))];
    const requestedDrafts: Array<{ kind: MissingAssetDraftKind; requirement: string }> = [];
    for (const plan of recoveryPlans) {
      for (const action of plan.actions) {
        const requirement = `RECOVERY_ACTION_REQUIRED:${action}:${plan.reason}`;
        switch (action) {
          case 'SYNTHESIZE_KNOWLEDGE':
            requestedDrafts.push({ kind: 'KNOWLEDGE', requirement });
            break;
          case 'SYNTHESIZE_COMPONENT':
            requestedDrafts.push({ kind: 'CODE_COMPONENT', requirement });
            break;
          case 'SYNTHESIZE_ADAPTER':
            requestedDrafts.push({ kind: 'ADAPTER', requirement });
            break;
          case 'SYNTHESIZE_VALIDATOR':
            requestedDrafts.push({ kind: 'VALIDATION', requirement });
            break;
          default:
            break;
        }
      }
    }
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

      if (requirement.kind === 'BACKEND') {
        const outcome = this.acquireBackendCheck(request);
        progressed = progressed || outcome.progressed;
        acquired = acquired && outcome.acquired;
        reasons.push(...outcome.reasons);
      } else if (requirement.kind === 'EVIDENCE') {
        const outcome = await this.acquireEvidence(request, input.objective, input.claimContext);
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
          schemaVersion: 2,
          requirements: requirements.map(item => item.requirement),
          reasons: [...new Set(reasons)],
          evidenceIds: blackboardEvidenceIds,
          localEvidenceIds: [...new Set(localEvidenceIds)],
          webEvidenceIds: [...new Set(webEvidenceIds)],
          linkedEvidenceIds: [...new Set(linkedEvidenceIds)],
          unlinkedEvidenceIds: [...new Set(unlinkedEvidenceIds)],
          componentIds: [...new Set(componentIds)],
          runId: input.runId,
          taskId: input.taskId,
          workspaceId: input.workspaceId,
          objective: input.objective,
          recordedAt: Date.now(),
        },
        blackboardEvidenceIds
      );
    }

    const uniqueLocalEvidenceIds = [...new Set(localEvidenceIds)];
    const uniqueWebEvidenceIds = [...new Set(webEvidenceIds)];
    const uniqueLinkedEvidenceIds = [...new Set(linkedEvidenceIds)];
    const uniqueUnlinkedEvidenceIds = [...new Set(unlinkedEvidenceIds)];
    /*
     * P426 B3 (系譜の数えの統一): draft の系譜は、この呼び出しで
     * 新規に取れた証拠だけでなく、タスクに既に記録された証拠系譜
     * （ブラックボードのエントリ evidenceIds の和集合＝実行詳細の
     * ヘッダー表示と同じ集合）を含む。従来は今回分だけを渡して
     * いたため、証拠を蓄積済みのタスクでも draft 検証が
     * evidence=0 になり、その理由が回復全体の理由へ混入して
     * 「証拠が無い」ように見えていた。読みは一方向で、Claim／
     * 証拠の台帳へ書き戻すことはしない。
     */
    const draftAssets=missingAssetSynthesisService.synthesize({runId:input.runId,taskId:input.taskId,objective:input.objective,requirements:expandedReasons,evidenceIds:[...new Set([...evidenceIds,...this.taskLineageEvidenceIds(input.taskId)])],requestedDrafts});
    const draftValidations=missingAssetValidationService.validateAll(draftAssets);
    for(const validation of draftValidations){missingAssetSynthesisService.updateValidation(validation.draftId,{status:validation.status,validationId:validation.validationId,validationReasons:validation.reasons});}
    const verifiedDrafts=draftAssets.filter(draft=>draftValidations.some(validation=>validation.draftId===draft.draftId&&validation.passed));
    const researchDrafts=draftValidations.filter(validation=>validation.status==='RESEARCH_REQUIRED');
    if(input.taskId&&draftAssets.length>0){taskBlackboardService.append(input.taskId,'OBSERVATION','core','missing-asset-validation-results',{draftIds:draftAssets.map(item=>item.draftId),verifiedDraftIds:verifiedDrafts.map(item=>item.draftId),validations:draftValidations},evidenceIds);}
    reasons.push(...researchDrafts.flatMap(item=>item.reasons),...draftValidations.filter(item=>item.status==='REJECTED').flatMap(item=>item.reasons));
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
    objective: string,
    claimContext?: ClaimEvidenceContext
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
    // P409 案3: the gap query used to embed the parent task's full
    // objective text. When the parent was itself a gap-research task, its
    // goal already contained a previous generation's query, so titles and
    // queries grew one prefix per generation and every generation minted
    // a distinct gap. The query is now composed only of what the evidence
    // need itself is (the requirement); which run/task it belongs to
    // stays in the structured fields (sourceRequestId = runId, and
    // request.gapIds), and the objective is handed to research explicitly
    // below so the research context is not lost.
    /*
     * P425 B2: Claim 文脈（B1）が届いている場合は、証拠取得を Claim
     * 由来にする。gap の同一性に claimIds を含め、調査クエリは主張
     * 文と矛盾相手の主張文から組成する（調査側の Claim 照合はクエ
     * リ内の主張文で行われるため、これが証拠を対象 Claim へ
     * attach する機械になる）。Claim 文脈が引けない場合は従来の
     * 汎用経路のままにする。
     * P431 R2: 当初は trigger が claim.* で始まることも条件だった
     * が、それは「Claim のタスクである」ことの代理指標にすぎない。
     * 発見経路（P431 で claimContext を payload に載せるように
     * なった）の trigger は issue タイトル（Claim矛盾: …）のため
     * 代理指標で落ち、実機の主流経路では B2 が一度も発動しなかっ
     * た。claimContext は Claim が対象である場合にだけ（直接経路
     * の購読側、発見経路の dispatch のどちらでも）claimDatabase
     * から組み立てられて載るので、その存在自体が直接の信号であ
     * る。直接経路の挙動は不変（従来どおり文脈ありで Claim 経路）。
     */
    const claimRoute = claimContext && claimContext.statement.trim()
      ? claimContext
      : undefined;
    // 調査側の Claim 照合（findBestMatchingClaim）は空白・句読点で
    // 区切った語と主張文の部分一致でスコアを付けるため、文をその
    // まま並べただけでは（特に DISPUTED 主張の減点で）一致に届か
    // ない。主張文の内容語をキーワード行として併記し、Web 検索と
    // ローカル照合の両方に効く形にする。解析できない場合は行を
    // 足さない（従来の組成のまま）。
    const claimKeywords = claimRoute
      ? (() => {
          try {
            const terms = new Set<string>();
            for (const text of [claimRoute.statement, ...claimRoute.contradictedBy.map(item => item.statement)]) {
              for (const term of contentTermsFromTokens(japaneseAnalysisService.analyze(text).tokens)) terms.add(term);
            }
            return [...terms].slice(0, 12);
          } catch { return []; }
        })()
      : [];
    const claimResearchQuery = claimRoute
      ? [
          '主張の裏付けと矛盾の解消に必要な証拠を調査する。',
          `対象主張: ${claimRoute.statement}`,
          ...(claimRoute.contradictedBy.length
            ? [`矛盾する主張: ${claimRoute.contradictedBy.map(item => item.statement).join(' / ')}`]
            : []),
          ...(claimKeywords.length ? [`調査キーワード: ${claimKeywords.join(' ')}`] : []),
          '対象主張を支持する証拠と、矛盾する主張との整合性を確認できる出典を優先する。',
        ].join('\n')
      : undefined;
    const gap = knowledgeGapService.detect({
      query: `必要Evidenceの取得: ${request.requirement}`,
      reason: request.requirement,
      type: 'INSUFFICIENT_EVIDENCE',
      priority: 90,
      requiredEvidence: [request.requirement],
      sourceRequestId: request.runId,
      ...(claimRoute
        ? { claimIds: [claimRoute.claimId, ...claimRoute.contradictedBy.map(item => item.claimId)] }
        : {}),
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

      // P409 案3: research keeps the full parent context (objective +
      // requirement, the text the gap query used to carry) through the
      // explicit query option instead of the gap's stable identity query.
      // P425 B2: Claim 経路では主張由来のクエリを渡す。
      // P431 R3: the generic route's query is now composed from the
      // task's real subject matter (composeEvidenceResearchQuery);
      // the previous composition appended the requirement token
      // (`必要Evidence: <REASON_CODE>`) to the raw trigger, so the
      // research text was internal codes plus, for issue tasks, a
      // bare title like `Claim矛盾: CLM-…` with no searchable
      // content at all. And the dispatch now pins the route to
      // WEB_SEARCH (the same forceRoute pattern executeSearch uses):
      // whether evidence is missing has already been decided by the
      // completion gate that sent us here, so re-asking the
      // chat-oriented search-need judgment -- against the gap's
      // identity label, which is a reason token by design (P409) --
      // only ever answered "no search" and returned from LOCAL
      // matching with zero records, deterministically, for every
      // task. LOCAL matching inside researchGap still runs first;
      // forceRoute only removes the LOCAL-only early return. Scope
      // is this acquisition dispatch only; the need judgment itself
      // is untouched.
      const researched = await researchService.researchGap(gap, {
        query: claimResearchQuery ?? this.composeEvidenceResearchQuery(request, objective),
        forceRoute: 'WEB_SEARCH',
      });

      const researchRecord =
        researched && typeof researched === 'object'
          ? researched as unknown as Record<string, unknown>
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

      /*
       * P432: researchGapが返したweb証拠のうち、gapのclaimへ未紐付の
       * ものをgap claimへattachする（researchGap側でも同じ紐付けを
       * 行うが、呼び出し経路によらずここで保証する）。claimが無けれ
       * ばgapの要求文から1件作る。ゲートは緩和しない。
       */
      const gapClaimId =
        this.extractStringIds(researched, /^claim(?:[_-]?ids?)?$/i)[0] ??
        knowledgeGapService.getById(gap.id)?.researchClaimIds?.[0] ??
        knowledgeGapService.getById(gap.id)?.identity?.claimIds?.[0] ??
        (webEvidenceIds.length > 0 && request.requirement.trim().length >= 15
          ? evidenceService.registerUnverifiedClaim(webEvidenceIds[0], request.requirement.trim())
          : undefined);
      let gapClaimAttachedCount = 0;
      if (gapClaimId) {
        for (const evidenceId of webEvidenceIds) {
          const record = evidenceService.getEvidence(evidenceId);
          if (!record || record.status === 'REJECTED') continue;
          if (record.claim_ids.includes(gapClaimId)) continue;
          if (evidenceService.attachEvidenceToClaim(evidenceId, gapClaimId)) gapClaimAttachedCount += 1;
        }
        if (gapClaimAttachedCount > 0) {
          knowledgeGapService.attachResearchClaims(gap.id, [gapClaimId]);
        }
      }

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
      const componentReasons:string[]=[];
      if(evidenceIds.length>0 && unlinkedEvidenceIds.length===0){
        const researchResult=researched as unknown as Record<string, unknown>;
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
          componentReasons.push(
            `KNOWLEDGE_COMPONENT_CREATED:${componentResult.component.componentId}`
          );
        }else if(componentResult.updated){
          componentReasons.push(
            `KNOWLEDGE_COMPONENT_UPDATED:${componentResult.component.componentId}`
          );
        }

        if(verificationResult.verified){
          componentReasons.push(
            `KNOWLEDGE_COMPONENT_VERIFIED:${componentResult.component.componentId}`
          );
        }else if(verificationResult.conflicted){
          componentReasons.push(
            `KNOWLEDGE_COMPONENT_CONFLICT:${componentResult.component.componentId}`
          );
        }
      }

      request.evidenceIds = [
        ...new Set([...request.evidenceIds, ...evidenceIds]),
      ];
      let evidenceAcquired = evidenceIds.length > 0 && unlinkedEvidenceIds.length === 0;
      request.status = evidenceAcquired ? 'ACQUIRED' : 'BLOCKED';

      systemLogger.info(
        'SELF_IMPROVEMENT',
        '[RequiredAssetAcquisition] ACQUISITION_DECISION',
        JSON.stringify({
          gapId: gap.id,
          runId: request.runId,
          taskId: request.taskId,
          acquired: evidenceAcquired,
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
      request.lastError = evidenceAcquired ? undefined : evidenceIds.length > 0 ? 'EVIDENCE_IDS_UNLINKED' : 'RESEARCH_RETURNED_NO_EVIDENCE_ID';
      request.updatedAt = Date.now();
      this.save();

      const acquisitionReasons = evidenceIds.length === 0
        ? [`RESEARCH_RETURNED_NO_EVIDENCE_ID:${gap.id}`]
        : [
            ...(unlinkedEvidenceIds.length > 0 ? [`EVIDENCE_RESEARCHED_BUT_UNLINKED:${gap.id}`] : [`EVIDENCE_ACQUIRED:${gap.id}`]),
            ...(gapClaimAttachedCount > 0 ? [`GAP_CLAIM_EVIDENCE_ATTACHED:${gap.id}:${gapClaimAttachedCount}`] : []),
            ...(localEvidenceIds.length > 0 ? [`LOCAL_EVIDENCE_ACQUIRED:${localEvidenceIds.length}`] : []),
            ...(webEvidenceIds.length > 0 ? [`WEB_EVIDENCE_ACQUIRED:${webEvidenceIds.length}`] : []),
            ...(unlinkedEvidenceIds.length > 0 ? [`EVIDENCE_IDS_UNLINKED:${unlinkedEvidenceIds.length}`] : []),
            ...(componentIds.length > 0 ? [`COMPONENTS_DISCOVERED:${componentIds.length}`] : []),
            ...componentReasons,
          ];

      /*
       * P425 B2: Claim 経路では、取得した証拠が対象 Claim の台帳に
       * 届いたかを確認し、検証器による再評価へ戻す。以前は証拠を
       * 取ってきても検証器の再評価に接続されておらず、Claim の
       * 状態は矛盾・未解決のまま放置されていた。再評価の結果は
       * 理由として残し、ループ側の完了判定（run 系譜の証拠）と
       * Claim 側の台帳の接続（B3）は本便の対象外とする。
       */
      if (claimRoute) {
        const attachedCount = evidenceService.list({ claimId: claimRoute.claimId }).length;
        acquisitionReasons.push(`CLAIM_EVIDENCE_ATTACHED:${claimRoute.claimId}:${attachedCount}`);
        const reevaluated = verifierService.verifyClaim({ claimId: claimRoute.claimId });
        acquisitionReasons.push(`CLAIM_REEVALUATED:${claimRoute.claimId}:${reevaluated.outcome}`);
        systemLogger.info(
          'SELF_IMPROVEMENT',
          '[RequiredAssetAcquisition] CLAIM_REEVALUATION',
          JSON.stringify({
            // P428: carry the reason token itself so the event is
            // findable in the runtime log under the same string the
            // recovery reasons use (CLAIM_REEVALUATED:<id>:<outcome>).
            reason: `CLAIM_REEVALUATED:${claimRoute.claimId}:${reevaluated.outcome}`,
            claimId: claimRoute.claimId,
            attachedEvidenceCount: attachedCount,
            outcome: reevaluated.outcome,
            independentEvidenceCount: reevaluated.independentEvidenceCount,
          }),
        );

        /*
         * P426 B3 (決着の消費): 再評価で Claim が決着したら、この
         * 回復が取得すべきものは残っていない。決着とは、検証器自身
         * が従来の厳格なルールのまま昇格させた場合
         * （SUPPORTED／DEVICE_VERIFIED）と、信念改訂で Claim が
         * 閉じられた場合（FALSE／SUPERSEDED）を指す。その場合は
         * 要件を ACQUIRED として回復を終え、ループを CORE の再評価
         * へ戻す。従来は再評価の結果を理由に記録するだけで、決着
         * した Claim のタスクも証拠待ちを繰り返していた。接続は
         * 片方向（回復側が Claim の状態を読むだけ）で、ループ側の
         * 証拠を Claim の台帳へ書き込むことはしない。未決着
         * （UNRESOLVED／CONTRADICTED 等）では従来どおり待つ。
         */
        const settledOutcome =
          reevaluated.outcome === 'SUPPORTED' || reevaluated.outcome === 'DEVICE_VERIFIED'
            ? reevaluated.outcome
            : undefined;
        const claimAfter = settledOutcome ? undefined : claimDatabaseService.getClaim(claimRoute.claimId);
        const settledStatus =
          claimAfter && (claimAfter.status === 'FALSE' || claimAfter.status === 'SUPERSEDED')
            ? String(claimAfter.status)
            : undefined;
        const settled = settledOutcome || settledStatus;
        if (settled) {
          acquisitionReasons.push(`CLAIM_RESOLVED:${claimRoute.claimId}:${settled}`);
          // P428: the settlement existed only as a recovery reason;
          // give it a runtime log line of its own, in the same form
          // as CLAIM_REEVALUATION above.
          systemLogger.info(
            'SELF_IMPROVEMENT',
            '[RequiredAssetAcquisition] CLAIM_RESOLVED',
            JSON.stringify({
              reason: `CLAIM_RESOLVED:${claimRoute.claimId}:${settled}`,
              claimId: claimRoute.claimId,
              settled,
              outcome: reevaluated.outcome,
            }),
          );
          if (!evidenceAcquired) {
            evidenceAcquired = true;
            request.status = 'ACQUIRED';
            request.lastError = undefined;
            request.updatedAt = Date.now();
            this.save();
          }
        }
      }

      return {
        progressed: true,
        acquired: evidenceAcquired,
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

  /*
   * P431 R3: compose the recovery-research query from the task's real
   * subject matter. Sources, in order: the knowledge gap the task
   * was dispatched for (linked from the task's intake payload with
   * the same keys the discovery / revalidation dispatchers write),
   * the issue detail recorded on the task, and the objective / goal
   * with diagnostic prefixes stripped. Internal identifiers (claim /
   * gap / task ids) and reason codes are not searchable content and
   * are never used as query material; the requirement itself stays
   * in the structured fields (gap identity, request record). The
   * result is capped so a stacked historical text cannot grow the
   * query without bound (the P409 failure mode).
   */
  private composeEvidenceResearchQuery(request: RequiredAssetRequest, objective: string): string {
    const candidates: string[] = [];
    const task = request.taskId ? taskBlackboardService.get(request.taskId) : undefined;
    const payloadValue = task?.entries.find(entry => entry.kind === 'INPUT' && entry.key === 'payload')?.value;
    const payload = payloadValue && typeof payloadValue === 'object' && !Array.isArray(payloadValue)
      ? payloadValue as Record<string, unknown>
      : undefined;
    const linkedGapId = String(payload?.autonomousKnowledgeGapId || payload?.gapId || '').trim();
    if (linkedGapId) {
      const linked = knowledgeGapService.getById(linkedGapId);
      if (linked) {
        candidates.push(linked.query);
        if (linked.reason && linked.reason !== linked.query) candidates.push(linked.reason);
      }
    }
    if (typeof payload?.detail === 'string') candidates.push(payload.detail);
    candidates.push(objective);
    if (task?.goal && task.goal !== objective) candidates.push(task.goal);
    const lines: string[] = [];
    for (const raw of candidates) {
      const line = this.researchSubjectLine(raw);
      if (line && !lines.includes(line)) lines.push(line);
      if (lines.join('\n').length >= 800) break;
    }
    return lines.join('\n').slice(0, 800) || objective;
  }

  private researchSubjectLine(raw: string): string {
    let text = String(raw || '').replace(/\s+/g, ' ').trim();
    // Strip stacked diagnostic prefixes (issue titles and
    // outcome-prefixed details carry them); what remains is the
    // subject itself. Mirrors the discovery service's prefix list.
    const prefixes = ['停滞タスク:', '改善負債:', '能力不足:', '知識不足:', '実行失敗:', '18分類未循環:', 'Claim矛盾:', 'CONTRADICTED:', 'UNRESOLVED:'];
    let changed = true;
    while (changed) {
      changed = false;
      for (const prefix of prefixes) {
        if (text.startsWith(prefix)) {
          text = text.slice(prefix.length).trim();
          changed = true;
        }
      }
    }
    if (!text) return '';
    // A bare internal identifier or an all-caps reason code is not a
    // subject; searching for it can only reproduce the zero-evidence
    // outcome this composition exists to end.
    if (/^(?:CLM|GAP|TASK|ISSUE|RUN|AIR|EVD)-[\w-]+$/.test(text)) return '';
    if (/^[A-Z][A-Z0-9_]{3,}$/.test(text)) return '';
    return text;
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

  private acquireBackendCheck(request: RequiredAssetRequest): { progressed: boolean; acquired: boolean; reasons: string[] } {
    // P366: check the live storage backend instead of researching the
    // requirement as if it were knowledge. Previously this reason fell
    // through to evidence research / capability-gap recording, which
    // could never satisfy it and spawned self-referencing recovery tasks.
    const backend = storageService.getBackendName();
    const satisfied = backend !== 'memory';
    request.status = satisfied ? 'ACQUIRED' : 'BLOCKED';
    request.updatedAt = Date.now();
    this.save();
    return {
      progressed: true,
      acquired: satisfied,
      reasons: [satisfied ? `PERSISTENT_BACKEND_AVAILABLE:${backend}` : 'PERSISTENT_BACKEND_REQUIRED'],
    };
  }

  private classify(reasons: string[]): Array<{ kind: RequiredAssetKind; requirement: string }> {
    const output: Array<{ kind: RequiredAssetKind; requirement: string }> = [];
    for (const raw of reasons) {
      const reason = raw.trim();
      if (!reason) {
        continue;
      }
      if (/PERSISTENT_BACKEND/i.test(reason)) {
        output.push({ kind: 'BACKEND', requirement: reason });
      } else if (/required_asset\.capability/i.test(reason)) {
        output.push({ kind: 'CAPABILITY', requirement: reason });
      } else if (/RESOURCE|MEMORY_ONLY|BATTERY|THERMAL|CAPACITY/i.test(reason)) {
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

  /*
   * P426 B3: タスクに記録された証拠系譜＝ブラックボードの全
   * エントリが持つ evidenceIds の和集合。ループ自身がタスクの
   * 証拠を表示・記録するときの導出（エントリ evidenceIds の
   * flatMap）と同一にし、数える場所ごとに集合がずれないように
   * する。
   */
  private taskLineageEvidenceIds(taskId?: string): string[] {
    if (!taskId) return [];
    const task = taskBlackboardService.get(taskId);
    if (!task) return [];
    return [
      ...new Set(
        task.entries
          .flatMap(entry => entry.evidenceIds || [])
          .filter(id => typeof id === 'string' && id.trim().length > 0),
      ),
    ];
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
