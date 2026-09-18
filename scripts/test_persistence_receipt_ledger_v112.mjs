import fs from 'node:fs';
const ledger=fs.readFileSync('src/miki/core/services/persistenceReceiptLedgerService.ts','utf8');
const lineage=fs.readFileSync('src/miki/core/services/coreLineageReadModelService.ts','utf8');
for(const token of ['miki_review_learning_persistence_receipts_v1','miki_review_learning_artifact_receipts_v1','item.reloaded===true','entitySha256','storageKey','verify(receiptId:string)'])if(!ledger.includes(token)){console.error(`receipt ledger missing: ${token}`);process.exit(1);}
if(!lineage.includes('allowedReceipts.has(id)&&persistenceReceiptLedgerService.verify(id)')){console.error('lineage receipts are not independently ledger verified');process.exit(1);}
console.log('PASS persistence receipt ledger v112');
