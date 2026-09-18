import fs from 'node:fs';
const ledger=fs.readFileSync('src/miki/core/services/persistenceReceiptLedgerService.ts','utf8');
const episode=fs.readFileSync('src/miki/core/services/reviewDecisionLearningService.ts','utf8');
const artifact=fs.readFileSync('src/miki/core/services/reviewLearningArtifactService.ts','utf8');
if((episode.match(/export interface PersistenceReceipt/g)||[]).length!==0){console.error('duplicate PersistenceReceipt contract remains');process.exit(1);}
if(!episode.includes('persistenceReceiptLedgerService.register(receipt, RECEIPTS_KEY)')){console.error('episode receipt writer not centralized');process.exit(1);}
if(!artifact.includes('persistenceReceiptLedgerService.registerMany(receipts,RECEIPT_KEY)')){console.error('artifact receipt writer not centralized');process.exit(1);}
for(const source of [episode,artifact])if(source.includes('storageService.setItem(RECEIPTS_KEY')||source.includes('storageService.setItem(RECEIPT_KEY')){console.error('duplicate direct receipt storage writer remains');process.exit(1);}
for(const token of ['register(receipt:PersistenceReceipt','registerMany(receipts:PersistenceReceipt[]','PERSISTENCE_RECEIPT_LEDGER_WRITE_FAILED'])if(!ledger.includes(token)){console.error(`central receipt capability missing: ${token}`);process.exit(1);}
console.log('PASS receipt writer dedup v113');
