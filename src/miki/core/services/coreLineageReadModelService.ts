import { EvidenceService } from '../../memory/services/evidenceService';
import type { BlackboardTask } from './taskBlackboardService';
import { domainReplyLedgerService } from './domainReplyLedgerService';
import { persistenceReceiptLedgerService } from './persistenceReceiptLedgerService';

const DIAGNOSTIC_COMMANDS=new Set([
  'ASSESS_DOMAIN',
  'HEALTH_CHECK',
  'DESCRIBE',
  'GET_STATUS',
  'PARTICIPATE',
  'VERIFY_CONNECTION',
  'DISCOVER_IMPROVEMENT_ISSUE',
  'RUN_SELF_IMPROVEMENT'
]);

export interface VerifiedCoreLineage {
  verifiedReplyIds:string[];
  verifiedEvidenceIds:string[];
  verifiedReceiptIds:string[];
  verifiedDecisionId?:string;
  rejectedReplyIds:string[];
  rejectedEvidenceIds:string[];
  rejectedReceiptIds:string[];
  rejectedDecisionIds:string[];
  lineageVerified:boolean;
}

class CoreLineageReadModelService {
  verify(task:BlackboardTask,input:{replyIds:string[];evidenceIds:string[];receiptIds:string[];decisionId?:string}):VerifiedCoreLineage {
    const verifiedReplyIds:string[]=[];const rejectedReplyIds:string[]=[];
    const validReplyRecords=input.replyIds.map(id=>domainReplyLedgerService.get(id)).filter(record=>{
      const diagnostic=Boolean(record&&DIAGNOSTIC_COMMANDS.has(record.command));
      const validPlanRevision=diagnostic
        ? Boolean(record && Number.isFinite(record.corePlanRevision) && record.corePlanRevision>=0)
        : Boolean(record && record.corePlanRevision>0);
      const valid=Boolean(
        record &&
        record.taskId===task.taskId &&
        record.replyId &&
        record.classificationId &&
        record.operationId &&
        record.operationInstanceId &&
        validPlanRevision &&
        record.dispatchId===record.envelopeId
      );
      (valid?verifiedReplyIds:rejectedReplyIds).push(record?.replyId||'MISSING_REPLY');
      return valid;
    });
    const allowedEvidence=new Set(validReplyRecords.flatMap(record=>record?.evidenceIds||[]));
    const evidenceService=EvidenceService.getInstance();
    const verifiedEvidenceIds:string[]=[];const rejectedEvidenceIds:string[]=[];
    for(const id of [...new Set(input.evidenceIds)]){
      const evidence=evidenceService.getEvidence(id);
      const replyId=typeof evidence?.metadata?.reply_id==='string'?evidence.metadata.reply_id:'';
      const diagnosticReply=validReplyRecords.some(record=>record.replyId===replyId&&DIAGNOSTIC_COMMANDS.has(record.command));
      const verificationStatus=evidence?.metadata?.verification_status;
      const validPlanRevision=diagnosticReply
        ? typeof evidence?.metadata?.core_plan_revision==='number' && evidence.metadata.core_plan_revision>=0
        : typeof evidence?.metadata?.core_plan_revision==='number' && evidence.metadata.core_plan_revision>0;
      const validVerificationStatus=diagnosticReply
        ? verificationStatus==='UNVERIFIED' || verificationStatus==='VERIFIED'
        : verificationStatus==='VERIFIED';
      const valid=Boolean(
        allowedEvidence.has(id) &&
        evidence &&
        evidence.status!=='REJECTED' &&
        evidence.kind==='EXECUTION' &&
        evidence.source_id===task.taskId &&
        evidence.metadata?.task_id===task.taskId &&
        validPlanRevision &&
        typeof evidence.metadata?.operation_instance_id==='string' &&
        evidence.metadata.operation_instance_id.length>0 &&
        verifiedReplyIds.includes(replyId) &&
        /^[a-f0-9]{64}$/i.test(evidence.metadata?.content_sha256||'') &&
        validVerificationStatus &&
        (
          diagnosticReply
            ? evidence.metadata?.operation_class==='DIAGNOSTIC'
            : evidence.metadata?.operation_class==='BUSINESS'
        )
      );
      if(valid)verifiedEvidenceIds.push(id);else rejectedEvidenceIds.push(id);
    }
    const allowedReceipts=new Set(validReplyRecords.flatMap(record=>record?.receiptIds||[]));
    const verifiedReceiptIds=[...new Set(input.receiptIds)].filter(id=>allowedReceipts.has(id)&&persistenceReceiptLedgerService.verify(id));
    const rejectedReceiptIds=[...new Set(input.receiptIds)].filter(id=>!allowedReceipts.has(id)||!persistenceReceiptLedgerService.verify(id));
    const decisions=task.entries.filter(entry=>entry.domain==='core'&&entry.kind==='DECISION').map(entry=>entry.id);
    const verifiedDecisionId=input.decisionId&&decisions.includes(input.decisionId)?input.decisionId:undefined;
    const rejectedDecisionIds=input.decisionId&&!verifiedDecisionId?[input.decisionId]:[];
    return {verifiedReplyIds,verifiedEvidenceIds,verifiedReceiptIds,verifiedDecisionId,rejectedReplyIds,rejectedEvidenceIds,rejectedReceiptIds,rejectedDecisionIds,lineageVerified:rejectedReplyIds.length===0&&rejectedEvidenceIds.length===0&&rejectedReceiptIds.length===0&&rejectedDecisionIds.length===0};
  }
}
export const coreLineageReadModelService=new CoreLineageReadModelService();
