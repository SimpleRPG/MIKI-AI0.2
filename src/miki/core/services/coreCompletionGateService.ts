import { coreLineageReadModelService } from './coreLineageReadModelService';
import type { BlackboardEntry, BlackboardTask } from './taskBlackboardService';
import type { MikiDomain } from './crossDomainCirculationService';
import { evidenceQualityGateService } from './evidenceQualityGateService';
import { corePlanRevisionService } from './corePlanRevisionService';
import { domainReplyLedgerService } from './domainReplyLedgerService';

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
    return Boolean(reply && reply.operationClass === 'BUSINESS' && Array.isArray(reply.evidenceIds) && reply.evidenceIds.length > 0);
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
    const persistenceConfirmed = task.entries.some((entry) => {
      if (entry.domain !== 'memory' || entry.kind !== 'RESULT') return false;
      const reply = entryReply(entry);
      const data = reply && reply.data && typeof reply.data === 'object' ? reply.data as Record<string, unknown> : undefined;
      return data?.persisted === true;
    });
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
  evaluateCoreOwnedOperation(task: BlackboardTask, operation: string, domain: MikiDomain = 'data'): CoreCompletionAssessment {
    const reasons: string[] = [];
    const observed = task.entries.some((entry) => {
      if (entry.domain !== domain || entry.kind !== 'RESULT') return false;
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

    const quality = evidenceQualityGateService.evaluate(task);
    const evidenceQualityPassed = replyRecords.length === 0 ? true : quality.passed;
    if (!evidenceQualityPassed) reasons.push(`EVIDENCE_QUALITY_FAILED:${quality.reasons.join(',')}`);

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
    const missingRequiredOperations=corePlanRevisionService.missingOperations(task)
      .map(item=>`${item.operation}:${item.operationInstanceId}`);
    const failedOperations=requiredOperations.filter(item=>item.status==='FAILED').map(item=>item.operationInstanceId);
    const replyRecords=domainReplyLedgerService.listByTask(task.taskId);
    const lastDecision=task.entries.filter(entry=>entry.domain==='core'&&entry.kind==='DECISION').at(-1);
    const lineage=coreLineageReadModelService.verify(task,{
      replyIds:replyRecords.map(record=>record.replyId),
      evidenceIds:[...new Set(replyRecords.flatMap(record=>record.evidenceIds))],
      receiptIds:[...new Set(replyRecords.flatMap(record=>record.receiptIds))],
      decisionId:lastDecision?.id
    });
    const reasons:string[]=[];
    if(!plan) reasons.push('CORE_PLAN_REVISION_MISSING');
    if(requiredOperations.length===0) reasons.push('REQUIRED_OPERATION_MISSING');
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
    const evidenceQualityPassed=replyRecords.length===0?true:quality.passed;
    if(!evidenceQualityPassed) reasons.push(`EVIDENCE_QUALITY_FAILED:${quality.reasons.join(',')}`);
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
