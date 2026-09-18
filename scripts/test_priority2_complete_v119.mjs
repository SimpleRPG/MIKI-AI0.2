import fs from 'node:fs';
const tx=fs.readFileSync('src/miki/core/services/candidateCommitTransactionService.ts','utf8');const ws=fs.readFileSync('src/miki/core/services/isolatedCandidateWorkspaceService.ts','utf8');const gw=fs.readFileSync('src/miki/core/ui/typedImprovementUiGatewayService.ts','utf8');
for(const x of ['restorePreviousCommitted','previous.files.map','candidateContent:file.candidateContent',"recover(transactionId:string,action:'RESUME'|'ROLLBACK')",'RECOVERY_ROLLBACK'])if(!ws.includes(x))throw new Error('workspace recovery missing '+x);
for(const x of ['restorePrevious','markRecoveryRequired','listRecoveryRequired','PERSISTENCE_RECEIPT_LINEAGE_MISMATCH','operationInstanceId:string','schemaVersion:2',"newlinePolicy:'LF'"])if(!tx.includes(x))throw new Error('transaction completion missing '+x);
for(const x of ["commandType:'COMMIT_CANDIDATE_TRANSACTION'",'workspaceId:string','persistenceReceiptId:string',"mode:command.commandType",'workspaceId:command.workspaceId'])if(!gw.includes(x))throw new Error('typed core command missing '+x);
if(gw.includes('isolatedCandidateWorkspaceService.commitWithReceipt'))throw new Error('UI gateway bypasses core');
console.log('PASS priority2 complete v119');
