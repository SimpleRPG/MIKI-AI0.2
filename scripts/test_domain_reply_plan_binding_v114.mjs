import fs from 'node:fs';
const ledger=fs.readFileSync('src/miki/core/services/domainReplyLedgerService.ts','utf8');
const lineage=fs.readFileSync('src/miki/core/services/coreLineageReadModelService.ts','utf8');
for(const token of ['operationInstanceId: string','corePlanRevision: number','dispatchId: string',"envelope.payload.operationInstanceId","envelope.payload.planRevision","dispatchId: envelope.envelopeId"])if(!ledger.includes(token)){console.error(`reply binding missing: ${token}`);process.exit(1);}
for(const token of ['record.operationInstanceId','record.corePlanRevision>0','record.dispatchId===record.envelopeId'])if(!lineage.includes(token)){console.error(`lineage binding check missing: ${token}`);process.exit(1);}
console.log('PASS domain reply plan binding v114');
