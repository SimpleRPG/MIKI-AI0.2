import type { BlackboardTask } from './taskBlackboardService';
import { evidenceService, type EvidenceRecord } from '../../memory/services/evidenceService';
import { coreLineageReadModelService } from './coreLineageReadModelService';
import { domainReplyLedgerService } from './domainReplyLedgerService';
export interface EvidenceQualityResult {
 passed:boolean; score:number; reasons:string[]; evidenceIds:string[]; contributingDomains:string[];
 registeredEvidenceIds:string[]; admissibleEvidenceIds:string[]; unresolvedEvidenceIds:string[];
 independentEvidenceClusters:number; verifiedExecutionEvidenceIds:string[];
}
class EvidenceQualityGateService{
 evaluate(task:BlackboardTask):EvidenceQualityResult{
  const entryEvidenceIds=task.entries.flatMap(entry=>entry.evidenceIds).filter((id):id is string=>typeof id==='string'&&id.trim().length>0);
  const replyRecords=domainReplyLedgerService.listByTask(task.taskId);
  const evidenceIds=[...new Set([...entryEvidenceIds,...replyRecords.flatMap(record=>record.evidenceIds)])];
  const contributingDomains=[...new Set(task.entries.filter(entry=>entry.kind==='EVIDENCE'||entry.kind==='CLAIM'||entry.kind==='RESULT').map(entry=>entry.domain))];
  const registered:EvidenceRecord[]=[];
  const unresolvedEvidenceIds:string[]=[];
  for(const id of evidenceIds){const record=evidenceService.getEvidence(id);if(record)registered.push(record);else unresolvedEvidenceIds.push(id);}
  const admitted=registered.filter(record=>record.status==='ADMISSIBLE'&&Array.isArray(record.claim_ids)&&record.claim_ids.length>0);
  const lastDecision=[...task.entries].reverse().find(entry=>entry.kind==='DECISION'&&entry.domain==='core');
  const lineage=coreLineageReadModelService.verify(task,{replyIds:replyRecords.map(record=>record.replyId),evidenceIds,receiptIds:[...new Set(replyRecords.flatMap(record=>record.receiptIds))],decisionId:lastDecision?.id});
  const researchEvidence=admitted.filter(record=>{
   if(record.kind!=='WEB'&&record.kind!=='DOCUMENT')return false;
   if(typeof record.source!=='string'||!record.source.trim()||typeof record.snippet!=='string'||!record.snippet.trim())return false;
   if(record.metadata?.research_source_role==='COUNTEREVIDENCE')return false;
   if(record.kind==='WEB'&&(!record.url||!/^https?:\/\/[^\s/]+/i.test(record.url)))return false;
   return true;
  });
  const clustersByClaim=new Map<string,Set<string>>();
  for(const record of researchEvidence){
   const cluster=typeof record.independence_cluster_id==='string'?record.independence_cluster_id.trim():'';
   if(!cluster)continue;
   for(const rawClaimId of record.claim_ids){
    const claimId=typeof rawClaimId==='string'?rawClaimId.trim():'';
    if(!claimId)continue;
    const clusters=clustersByClaim.get(claimId)||new Set<string>();
    clusters.add(cluster);clustersByClaim.set(claimId,clusters);
   }
  }
  const independentlySupportedClaimIds=[...clustersByClaim.entries()].filter(([,clusters])=>clusters.size>=2).map(([claimId])=>claimId);
  const independentEvidenceClusters=Math.max(0,...[...clustersByClaim.values()].map(clusters=>clusters.size));
  const verifiedExecutionEvidenceIds=[...new Set(lineage.verifiedEvidenceIds.filter(id=>{
   const record=evidenceService.getEvidence(id);
   return record?.kind==='EXECUTION'&&record.metadata?.operation_class==='BUSINESS';
  }))];
  const registeredEvidenceIds=[...new Set(registered.map(record=>record.evidence_id))];
  const admissibleEvidenceIds=[...new Set(admitted.map(record=>record.evidence_id))];
  const hasUsableEvidence=researchEvidence.length>0||verifiedExecutionEvidenceIds.length>0;
  const hasIndependentResearch=independentlySupportedClaimIds.length>0;
  const hasVerifiedExecution=verifiedExecutionEvidenceIds.length>0;
  const independentSupport=hasIndependentResearch||hasVerifiedExecution;
  const hasResult=task.entries.some(entry=>entry.kind==='RESULT');
  const hasError=task.entries.some(entry=>entry.kind==='ERROR');
  const reasons:string[]=[];let score=0;
  if(hasUsableEvidence)score+=35;
  else if(evidenceIds.length===0)reasons.push('EVIDENCE_ID_MISSING');
  else if(unresolvedEvidenceIds.length===evidenceIds.length)reasons.push('EVIDENCE_REFERENCE_UNRESOLVED');
  else reasons.push('EVIDENCE_NOT_ADMISSIBLE');
  if(independentSupport)score+=35;
  else reasons.push('INDEPENDENT_EVIDENCE_CONFIRMATION_MISSING');
  if(hasResult)score+=20;else reasons.push('OBSERVED_RESULT_MISSING');
  if(!hasError)score+=10;else reasons.push('UNRESOLVED_ERROR_PRESENT');
  const passed=score>=85&&hasUsableEvidence&&independentSupport&&hasResult&&!hasError;
  return {passed,score,reasons,evidenceIds,contributingDomains,registeredEvidenceIds,admissibleEvidenceIds,unresolvedEvidenceIds,independentEvidenceClusters,verifiedExecutionEvidenceIds};
 }
}
export const evidenceQualityGateService=new EvidenceQualityGateService();
