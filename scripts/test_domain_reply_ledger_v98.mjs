import fs from 'node:fs';
const ledger=fs.readFileSync('src/miki/core/services/domainReplyLedgerService.ts','utf8');
const core=fs.readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
const ledgerTokens=['DREPLY-','miki_domain_reply_ledger_v1','classificationId','operationId','evidenceIds','unknowns','receiptIds','failure','persist','load'];
const missing=ledgerTokens.filter(token=>!ledger.includes(token));
if(missing.length){console.error(`missing reply ledger contract: ${missing.join(',')}`);process.exit(1);}
const coreTokens=['domainReplyLedgerService.record','replyRecord.replyId','domainReplyLedgerService.listByTask','replyRecords.flatMap(record=>record.evidenceIds)','replyRecords.flatMap(record=>record.receiptIds)','unknowns','failures'];
const disconnected=coreTokens.filter(token=>!core.includes(token));
if(disconnected.length){console.error(`reply ledger not connected to core result: ${disconnected.join(',')}`);process.exit(1);}
console.log('PASS domain reply ledger v98');
