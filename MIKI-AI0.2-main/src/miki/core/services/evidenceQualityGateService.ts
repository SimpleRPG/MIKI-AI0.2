import type { BlackboardTask } from './taskBlackboardService';
export interface EvidenceQualityResult { passed:boolean; score:number; reasons:string[]; evidenceIds:string[]; contributingDomains:string[]; }
class EvidenceQualityGateService{
 evaluate(task:BlackboardTask):EvidenceQualityResult{
  const evidenceIds=[...new Set(task.entries.flatMap(e=>e.evidenceIds).filter(Boolean))];
  const contributingDomains=[...new Set(task.entries.filter(e=>e.kind==='EVIDENCE'||e.kind==='CLAIM'||e.kind==='RESULT').map(e=>e.domain))];
  const reasons:string[]=[];let score=0;
  if(evidenceIds.length>0)score+=40;else reasons.push('EVIDENCE_ID_MISSING');
  if(contributingDomains.length>=2)score+=30;else reasons.push('INDEPENDENT_DOMAIN_CONFIRMATION_MISSING');
  if(task.entries.some(e=>e.kind==='RESULT'))score+=20;else reasons.push('OBSERVED_RESULT_MISSING');
  if(!task.entries.some(e=>e.kind==='ERROR'))score+=10;else reasons.push('UNRESOLVED_ERROR_PRESENT');
  return {passed:score>=70,score,reasons,evidenceIds,contributingDomains};
 }
}
export const evidenceQualityGateService=new EvidenceQualityGateService();
