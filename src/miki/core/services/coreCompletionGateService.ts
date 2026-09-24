import { coreLineageReadModelService } from './coreLineageReadModelService';
import type { BlackboardEntry, BlackboardTask } from './taskBlackboardService';
import type { MikiDomain } from './crossDomainCirculationService';
import { evidenceQualityGateService } from './evidenceQualityGateService';
import { corePlanRevisionService } from './corePlanRevisionService';
import { domainReplyLedgerService } from './domainReplyLedgerService';
import { reviewZipExportService } from './reviewZipExportService';

export interface CoreCompletionAssessment {
  businessCompletion: boolean;
  failClosed: true;
  requiredDomains: MikiDomain[];
  missingDomains: MikiDomain[];
  failedDomains: MikiDomain[];
  missingReceipts: MikiDomain[];
  persistenceConfirmed: boolean;
  evidenceQualityPassed: boolean;
  reasons: string[];
  missingRequiredOperations: string[];
}

function entryReply(entry: BlackboardEntry): Record<string, unknown> | undefined {
  if (!entry.value || typeof entry.value !== 'object') return undefined;
  const value = entry.value as Record<string, unknown>;
  const reply = value.reply;
  return reply && typeof reply === 'object' ? reply as Record<string, unknown> : undefined;
}

function domainSucceeded(task: BlackboardTask, domain: MikiDomain): boolean {
  return task.entries.some((entry) => {
    if (entry.domain !== domain || entry.kind !== 'RESULT') return false;
    const value = entry.value as Record<string, unknown>;
    if (value.operationClass !== 'BUSINESS' || value.operation === 'ASSESS_DOMAIN') return false;
    const reply = entryReply(entry);
    if (!reply || reply.operationClass !== 'BUSINESS') return false;
    const status = String(reply.status || '').toUpperCase();
    return status === 'SUCCEEDED' || status === 'SUCCESS' || status === 'COMPLETED';
  });
}

function hasCompletionReceipt(task: BlackboardTask, domain: MikiDomain): boolean {
  return task.entries.some((entry) => {
    if (entry.domain !== domain || entry.kind !== 'RESULT') return false;
    const value = entry.value && typeof entry.value === 'object' ? entry.value as Record<string, unknown> : undefined;
    if (!value || value.coreCollected !== true || value.collectedBy !== 'core' || value.operationClass !== 'BUSINESS' || value.operation === 'ASSESS_DOMAIN' || typeof value.dispatchId !== 'string') return false;
    const reply = entryReply(entry);
    return Boolean(
      reply &&
      reply.operationClass === 'BUSINESS' &&
      Array.isArray(reply.receiptIds) &&
      reply.receiptIds.some(
        (id) => typeof id === 'string' && id.trim().length > 0
      )
    );
  });
}

class CoreCompletionGateService {
  evaluate(task: BlackboardTask, requiredDomains: MikiDomain[]): CoreCompletionAssessment {
    const required = [...new Set(requiredDomains)];
    // Adaptive self-improvement has no fixed domain list. Its completion
    // authority is the latest Core Plan Revision and its persisted lineage.
    if (required.length===0) return this.evaluateAdaptivePlan(task);
    const missingDomains = required.filter((domain) => !task.visitedDomains.includes(domain));
    const failedDomains = required.filter((domain) => !domainSucceeded(task, domain));
    const missingReceipts = required.filter((domain) => !hasCompletionReceipt(task, domain));
    const quality = evidenceQualityGateService.evaluate(task);
    // Persistence completion is owned by the required business domain.
// Self-code promotion proves persistence with its promotion receipt;
// requiring a separate memory-domain persisted=true result is unrelated
// to the current CORE -> promotion transaction model.
const persistenceConfirmed =
      required.length > 0 && missingReceipts.length === 0;
    const missingRequiredOperations = corePlanRevisionService.missingOperations(task).map((item) => `${item.operation}:${item.dedupeKey}`);
    const reasons: string[] = [];
    if (task.entries.some((entry) => entry.kind === 'ERROR')) reasons.push('UNRESOLVED_DOMAIN_ERROR');
    if (missingDomains.length) reasons.push(`REQUIRED_DOMAIN_NOT_VISITED:${missingDomains.join(',')}`);
    if (failedDomains.length) reasons.push(`REQUIRED_DOMAIN_NOT_SUCCEEDED:${failedDomains.join(',')}`);
    if (missingReceipts.length) reasons.push(`REQUIRED_DOMAIN_RECEIPT_MISSING:${missingReceipts.join(',')}`);
    if (!persistenceConfirmed) reasons.push('PERSISTENCE_RECEIPT_MISSING');
    if (!quality.passed) reasons.push(`EVIDENCE_QUALITY_FAILED:${quality.reasons.join(',')}`);
    if (missingRequiredOperations.length) reasons.push(`REQUIRED_BUSINESS_OPERATION_MISSING:${missingRequiredOperations.join(',')}`);
    if (task.pendingDomains.length) reasons.push('PENDING_DOMAIN_REMAINS');
    const replyRecords = domainReplyLedgerService.listByTask(task.taskId);
    const lastDecision = task.entries.filter((entry) => entry.domain === 'core' && entry.kind === 'DECISION').at(-1);
    const lineage = coreLineageReadModelService.verify(task, { replyIds: replyRecords.map((record) => record.replyId), evidenceIds: [...new Set(replyRecords.flatMap((record) => record.evidenceIds))], receiptIds: [...new Set(replyRecords.flatMap((record) => record.receiptIds))], decisionId: lastDecision?.id });
    if (!lineage.lineageVerified) reasons.push('LINEAGE_VERIFICATION_FAILED');
    return {businessCompletion: reasons.length===0, failClosed:true, requiredDomains:required, missingDomains, failedDomains, missingReceipts, persistenceConfirmed, evidenceQualityPassed:quality.passed, reasons, missingRequiredOperations};
  }
  evaluateUniversalSynthesisCompletion(
    task: BlackboardTask
  ): CoreCompletionAssessment {
    const reasons: string[] = [];

    const synthesisEntry = [...task.entries]
      .reverse()
      .find(entry =>
        entry.domain === 'core' &&
        (entry.kind === 'RESULT' || entry.kind === 'ERROR') &&
        objectValue(entry)?.operation === 'SYNTHESIZE_UNIVERSAL'
      );

    const value = synthesisEntry
      ? objectValue(synthesisEntry)
      : undefined;

    const synthesisStatus =
      String(value?.status || '').toUpperCase();

    const synthesisId =
      String(value?.synthesisId || '').trim();

    const result =
      value?.result &&
      typeof value.result === 'object'
        ? value.result as Record<string, unknown>
        : value;

    if (
      !synthesisEntry ||
      synthesisStatus !== 'SUCCEEDED'
    ) {
      reasons.push('UNIVERSAL_SYNTHESIS_NOT_SUCCEEDED');
    }

    const validation =
      result?.validation &&
      typeof result.validation === 'object'
        ? result.validation as Record<string, unknown>
        : undefined;

    if (
      String(validation?.status || '').toUpperCase() !== 'PASSED'
    ) {
      reasons.push(
        'UNIVERSAL_SYNTHESIS_VALIDATION_NOT_PASSED'
      );
    }

    const unresolved =
      Array.isArray(result?.unresolved)
        ? result.unresolved.map(String).filter(Boolean)
        : [];

    if (unresolved.length > 0) {
      reasons.push(
        `UNIVERSAL_SYNTHESIS_UNRESOLVED:${unresolved.join('|')}`
      );
    }

    const artifact =
      result?.synthesisArtifact &&
      typeof result.synthesisArtifact === 'object'
        ? result.synthesisArtifact as Record<string, unknown>
        : undefined;

    const artifactLineage =
      artifact?.lineage &&
      typeof artifact.lineage === 'object'
        ? artifact.lineage as Record<string, unknown>
        : undefined;

    const compositionPlan =
      artifact?.compositionPlan &&
      typeof artifact.compositionPlan === 'object'
        ? artifact.compositionPlan as Record<string, unknown>
        : undefined;

    if (!artifact) {
      reasons.push('SYNTHESIS_ARTIFACT_MISSING');
    } else {
      if (!String(artifact.artifactId || '').trim()) {
        reasons.push('SYNTHESIS_ARTIFACT_ID_MISSING');
      }

      if (
        !synthesisId ||
        String(artifact.synthesisId || '') !== synthesisId
      ) {
        reasons.push(
          'SYNTHESIS_ARTIFACT_IDENTITY_MISMATCH'
        );
      }

      if (
        !/^[a-f0-9]{64}$/i.test(
          String(artifact.artifactHash || '')
        )
      ) {
        reasons.push(
          'SYNTHESIS_ARTIFACT_HASH_MISSING_OR_INVALID'
        );
      }

      if (artifactLineage?.source !== 'CORE') {
        reasons.push(
          'SYNTHESIS_ARTIFACT_LINEAGE_INVALID'
        );
      }

      if (
        !compositionPlan ||
        compositionPlan.executable !== true
      ) {
        reasons.push(
          'SYNTHESIS_ARTIFACT_PLAN_NOT_EXECUTABLE'
        );
      }
    }

    const reevaluation = [...task.entries]
      .reverse()
      .find(entry =>
        entry.domain === 'core' &&
        entry.kind === 'DECISION' &&
        String(entry.key).startsWith(
          'coreSynthesisReevaluation:'
        )
      );

    if (!reevaluation) {
      reasons.push(
        'CORE_SYNTHESIS_REEVALUATION_MISSING'
      );
    } else {
      const decision =
        objectValue(reevaluation);

      if (
        decision?.reEvaluateBeforeCompletion !== true
      ) {
        reasons.push(
          'CORE_SYNTHESIS_REEVALUATION_NOT_CONFIRMED'
        );
      }
    }

    const missingRequiredOperations =
      corePlanRevisionService
        .missingOperations(task)
        .map(item =>
          `${item.operation}:${item.operationInstanceId}`
        );

    const remainingAfterSynthesis =
      missingRequiredOperations.filter(
        item =>
          !item.startsWith(
            'SYNTHESIZE_UNIVERSAL:'
          )
      );

    if (remainingAfterSynthesis.length > 0) {
      reasons.push(
        `REQUIRED_BUSINESS_OPERATION_MISSING:${remainingAfterSynthesis.join(',')}`
      );
    }

    if (
      task.entries.some(
        entry => entry.kind === 'ERROR'
      )
    ) {
      reasons.push(
        'UNRESOLVED_DOMAIN_ERROR'
      );
    }

    if (task.pendingDomains.length > 0) {
      reasons.push(
        'PENDING_DOMAIN_REMAINS'
      );
    }

    const replyRecords =
      domainReplyLedgerService.listByTask(
        task.taskId
      );

    const lastDecision =
      reevaluation ||
      task.entries
        .filter(entry =>
          entry.domain === 'core' &&
          entry.kind === 'DECISION'
        )
        .at(-1);

    const lineage =
      coreLineageReadModelService.verify(
        task,
        {
          replyIds:
            replyRecords.map(
              record => record.replyId
            ),
          evidenceIds: [
            ...new Set(
              replyRecords.flatMap(
                record => record.evidenceIds
              )
            )
          ],
          receiptIds: [
            ...new Set(
              replyRecords.flatMap(
                record => record.receiptIds
              )
            )
          ],
          decisionId:
            lastDecision?.id
        }
      );

    if (
      !lineage.lineageVerified ||
      !lineage.verifiedDecisionId
    ) {
      reasons.push(
        'CORE_SYNTHESIS_LINEAGE_VERIFICATION_FAILED'
      );
    }

    return {
      businessCompletion:
        reasons.length === 0,
      failClosed: true,
      requiredDomains: [],
      missingDomains: [],
      failedDomains: [],
      missingReceipts: [],
      persistenceConfirmed:
        reasons.length === 0,
      evidenceQualityPassed: true,
      reasons,
      missingRequiredOperations
    };
  }

  evaluateCoreOwnedOperation(task: BlackboardTask, operation: string, domain: MikiDomain = 'data'): CoreCompletionAssessment {
    const reasons: string[] = [];
    const observed = task.entries.some((entry) => {
      if (entry.domain !== domain || entry.kind !== 'OBSERVATION') return false;
      const value = entry.value && typeof entry.value === 'object'
        ? entry.value as Record<string, unknown> : undefined;
      if (!value || value.coreCollected !== true || value.collectedBy !== 'core'
        || value.operation !== 'ASSESS_DOMAIN' || typeof value.dispatchId !== 'string') return false;
      const reply = entryReply(entry);
      if (!reply || reply.operationClass !== 'DIAGNOSTIC') return false;
      const status = String(reply.status || '').toUpperCase();
      return status === 'OBSERVED' || status === 'SUCCEEDED' || status === 'SUCCESS' || status === 'COMPLETED';
    });

    if (!observed) reasons.push(`CORE_OPERATION_NOT_COMPLETED:${operation}`);
    if (task.entries.some((entry) => entry.kind === 'ERROR')) reasons.push('UNRESOLVED_DOMAIN_ERROR');
    if (task.pendingDomains.length) reasons.push('PENDING_DOMAIN_REMAINS');

    const replyRecords = domainReplyLedgerService.listByTask(task.taskId);
    const lastDecision = task.entries.filter((entry) => entry.domain === 'core' && entry.kind === 'DECISION').at(-1);
    const lineage = coreLineageReadModelService.verify(task, {
      replyIds: replyRecords.map((record) => record.replyId),
      evidenceIds: [...new Set(replyRecords.flatMap((record) => record.evidenceIds))],
      receiptIds: [...new Set(replyRecords.flatMap((record) => record.receiptIds))],
      decisionId: lastDecision?.id
    });
    if (replyRecords.length > 0 && !lineage.lineageVerified) reasons.push('LINEAGE_VERIFICATION_FAILED');

    // CORE-owned configuration operations use ASSESS_DOMAIN as a
    // diagnostic observation. They do not produce business evidence and
    // therefore must not be blocked by the evidence-quality gate.
    const evidenceQualityPassed = true;

    return {
      businessCompletion: reasons.length === 0,
      failClosed: true,
      requiredDomains: [domain],
      missingDomains: observed ? [] : [domain],
      failedDomains: observed ? [] : [domain],
      missingReceipts: [],
      // The actual external-config persistence happens after CORE completion
      // returns to externalConnectionUiService. CORE must not claim that
      // persistence has already been confirmed at this point.
      persistenceConfirmed: false,
      evidenceQualityPassed,
      reasons,
      missingRequiredOperations: []
    };
  }



  private evaluateAdaptivePlan(task: BlackboardTask): CoreCompletionAssessment {
    const plan=corePlanRevisionService.latest(task);
    const requiredOperations=plan?.requiredOperations||[];
    const replyRecords=domainReplyLedgerService.listByTask(task.taskId);
    const diagnosticOnly=replyRecords.length>0 && replyRecords.every(record=>record.status==='OBSERVED' || ['ASSESS_DOMAIN','HEALTH_CHECK','DESCRIBE','GET_STATUS','PARTICIPATE','VERIFY_CONNECTION','DISCOVER_IMPROVEMENT_ISSUE','RUN_SELF_IMPROVEMENT'].includes(record.command));
    const businessReplyRecords=replyRecords.filter(record=>!(record.status==='OBSERVED' || ['ASSESS_DOMAIN','HEALTH_CHECK','DESCRIBE','GET_STATUS','PARTICIPATE','VERIFY_CONNECTION','DISCOVER_IMPROVEMENT_ISSUE','RUN_SELF_IMPROVEMENT'].includes(record.command)));
    const missingRequiredOperations=corePlanRevisionService.missingOperations(task)
      .map(item=>`${item.operation}:${item.operationInstanceId}`);
    const failedOperations=requiredOperations.filter(item=>item.status==='FAILED').map(item=>item.operationInstanceId);
    const lastDecision=task.entries.filter(entry=>entry.domain==='core'&&entry.kind==='DECISION').at(-1);
    const lineage=coreLineageReadModelService.verify(task,{
      replyIds:replyRecords.map(record=>record.replyId),
      evidenceIds:[...new Set(replyRecords.flatMap(record=>record.evidenceIds))],
      receiptIds:[...new Set(replyRecords.flatMap(record=>record.receiptIds))],
      decisionId:lastDecision?.id
    });
    const reasons:string[]=[];
    if(!plan && !diagnosticOnly) reasons.push('CORE_PLAN_REVISION_MISSING');
    if(requiredOperations.length===0 && !diagnosticOnly) reasons.push('REQUIRED_OPERATION_MISSING');
    if(diagnosticOnly) reasons.push('DIAGNOSTIC_STAGE_IN_PROGRESS');
    if(missingRequiredOperations.length) reasons.push(`REQUIRED_BUSINESS_OPERATION_MISSING:${missingRequiredOperations.join(',')}`);
    if(failedOperations.length) reasons.push(`REQUIRED_OPERATION_FAILED:${failedOperations.join(',')}`);
    if(task.entries.some(entry=>entry.kind==='ERROR')) reasons.push('UNRESOLVED_DOMAIN_ERROR');
    if(task.pendingDomains.length) reasons.push('PENDING_DOMAIN_REMAINS');
    if(!lineage.lineageVerified||lineage.verifiedReplyIds.length===0) reasons.push('LINEAGE_VERIFICATION_FAILED');

    for(const operation of requiredOperations){
      if(operation.operation!=='GENERATE_CANDIDATE'&&operation.operation!=='CREATE_REVIEW_PACKAGE') continue;
      const result=task.entries.filter(entry=>entry.kind==='RESULT'&&entry.value&&typeof entry.value==='object')
        .map(entry=>entry.value as Record<string,unknown>)
        .reverse().find(value=>value.operation===operation.operation&&value.operationInstanceId===operation.operationInstanceId);
      if(!result||!this.hasReceiptDeep(result)) reasons.push(`PERSISTENCE_RECEIPT_MISSING:${operation.operationInstanceId}`);
    }

    const missingDomains:MikiDomain[]=[];
    const failedDomains:MikiDomain[]=[];
    const missingReceipts:MikiDomain[]=[];
    const persistenceConfirmed=reasons.every(reason=>!reason.startsWith('PERSISTENCE_RECEIPT_MISSING'));
    const quality=evidenceQualityGateService.evaluate(task);
    // Evidence quality is still a safety gate when evidence exists, but an
    // adaptive plan with no evidence-producing operation is not forced into a
    // legacy fixed-domain requirement.
    const evidenceQualityPassed=businessReplyRecords.length===0?true:quality.passed;
    if(!evidenceQualityPassed) reasons.push(`EVIDENCE_QUALITY_FAILED:${quality.reasons.join(',')}`);
    const isRevalidation=requiredOperations.some(operation=>operation.operation==='GENERATE_CANDIDATE') && requiredOperations.some(operation=>operation.operation==='CREATE_REVIEW_PACKAGE') && task.entries.some(entry=>entry.kind==='RESULT'&&entry.value&&typeof entry.value==='object'&&(entry.value as Record<string,unknown>).operation==='GENERATE_CANDIDATE'&&typeof (entry.value as Record<string,unknown>).externalReviewId==='string');
    if(isRevalidation){const packageId=task.entries.filter(entry=>entry.kind==='RESULT'&&entry.value&&typeof entry.value==='object').map(entry=>entry.value as Record<string,unknown>).reverse().find(value=>value.operation==='CREATE_REVIEW_PACKAGE'&&typeof value.packageId==='string')?.packageId as string|undefined;const pkg=packageId?reviewZipExportService.list().find(item=>item.packageId===packageId):undefined;if(!pkg) reasons.push('REVALIDATION_REVIEW_PACKAGE_MISSING');else if(pkg.status!=='EXTERNAL_REVIEW_PENDING') reasons.push(`REVALIDATION_REVIEW_NOT_PENDING:${pkg.status}`);}
    const packagePending=requiredOperations.some(operation=>operation.operation==='CREATE_REVIEW_PACKAGE') &&
      !missingRequiredOperations.some(item=>item.startsWith('CREATE_REVIEW_PACKAGE:'));
    return {
      businessCompletion:reasons.length===0&&packagePending,
      failClosed:true,requiredDomains:[],
      missingDomains,failedDomains,missingReceipts,persistenceConfirmed,
      evidenceQualityPassed:evidenceQualityPassed,reasons,missingRequiredOperations
    };
  }

  private hasReceiptDeep(value:unknown):boolean {
    if(value===null||value===undefined)return false;
    if(Array.isArray(value))return value.some(item=>this.hasReceiptDeep(item));
    if(typeof value!=='object')return false;
    for(const [key,item] of Object.entries(value as Record<string,unknown>)){
      if(/(?:persistence)?receipt(?:ids?)?/i.test(key)){
        if(typeof item==='string'&&item.trim()) return true;
        if(Array.isArray(item)&&item.some(id=>typeof id==='string'&&id.trim())) return true;
      }
      if(this.hasReceiptDeep(item)) return true;
    }
    return false;
  }
}
export const coreCompletionGateService = new CoreCompletionGateService();
