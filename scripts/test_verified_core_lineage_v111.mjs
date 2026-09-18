import fs from 'node:fs';
const service=fs.readFileSync('src/miki/core/services/coreLineageReadModelService.ts','utf8');
const core=fs.readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
for(const token of ['domainReplyLedgerService.get','EvidenceService.getInstance','evidence.status!==\'REJECTED\'','record.taskId===task.taskId','decisions.includes','verifiedReplyIds','verifiedEvidenceIds','verifiedReceiptIds','verifiedDecisionId','lineageVerified'])if(!service.includes(token)){console.error(`lineage verification missing: ${token}`);process.exit(1);}
for(const token of ['coreLineageReadModelService.verify','replyIds:lineage.verifiedReplyIds','evidenceIds:lineage.verifiedEvidenceIds','persistenceReceiptIds:lineage.verifiedReceiptIds','rejectedLineageIds'])if(!core.includes(token)){console.error(`verified lineage not connected: ${token}`);process.exit(1);}
console.log('PASS verified core lineage v111');
