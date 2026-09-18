import { EvidenceService } from '../../memory/services/evidenceService';
import type { BlackboardTask } from './taskBlackboardService';
import { domainReplyLedgerService } from './domainReplyLedgerService';
import { persistenceReceiptLedgerService } from './persistenceReceiptLedgerService';

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
      const valid=Boolean(record&&record.taskId===task.taskId&&record.replyId&&record.classificationId&&record.operationId&&record.operationInstanceId&&record.corePlanRevision>0&&record.dispatchId===record.envelopeId);
      (valid?verifiedReplyIds:rejectedReplyIds).push(record?.replyId||'MISSING_REPLY');
      return valid;
    });
    const allowedEvidence=new Set(validReplyRecords.flatMap(record=>record?.evidenceIds||[]));
    const evidenceService=EvidenceService.getInstance();
    const verifiedEvidenceIds:string[]=[];const rejectedEvidenceIds:string[]=[];
    for(const id of [...new Set(input.evidenceIds)]){
      const evidence=evidenceService.getEvidence(id);
      if(allowedEvidence.has(id)&&evidence&&evidence.status!=='REJECTED'&&evidence.kind==='EXECUTION'&&evidence.source_id===task.taskId&&evidence.metadata?.task_id===task.taskId&&typeof evidence.metadata?.core_plan_revision==='number'&&evidence.metadata.core_plan_revision>0&&typeof evidence.metadata?.operation_instance_id==='string'&&evidence.metadata.operation_instance_id.length>0&&typeof evidence.metadata?.reply_id==='string'&&verifiedReplyIds.includes(evidence.metadata.reply_id)&&/^[a-f0-9]{64}$/i.test(evidence.metadata?.content_sha256||'')&&evidence.metadata?.verification_status==='VERIFIED')verifiedEvidenceIds.push(id);else rejectedEvidenceIds.push(id);
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
