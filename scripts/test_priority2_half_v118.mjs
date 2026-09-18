import fs from 'node:fs';
const tx=fs.readFileSync('src/miki/core/services/candidateCommitTransactionService.ts','utf8');
const ws=fs.readFileSync('src/miki/core/services/isolatedCandidateWorkspaceService.ts','utf8');
const required=['persistenceReceiptLedgerService.get','PERSISTENCE_RECEIPT_LINEAGE_MISMATCH','operationInstanceId:string','schemaVersion:2','normalizationVersion:1',"encoding:'UTF-8'","newlinePolicy:'LF'",'orderedPaths','files:input.files.slice().sort','restorePrevious','markRecoveryRequired','listRecoveryRequired','protectedIds','decodeURIComponent(decoded)'];
const missing=required.filter(x=>!tx.includes(x));if(missing.length){console.error('priority2 half missing: '+missing.join(','));process.exit(1);}
for(const x of ['commitWithReceipt(id:string,persistenceReceiptId:string,operationInstanceId:string)','operationInstanceId','WORKSPACE_SAVE_AFTER_COMMIT_FAILED','markRecoveryRequired'])if(!ws.includes(x)){console.error('workspace recovery missing: '+x);process.exit(1);}
console.log('PASS priority2 half v118');
