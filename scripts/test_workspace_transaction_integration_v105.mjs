import fs from 'node:fs';
const source=fs.readFileSync('src/miki/core/services/isolatedCandidateWorkspaceService.ts','utf8');
const required=['commitWithReceipt','persistenceReceiptId:string','candidateCommitTransactionService.commit','previousTransactionId:previous?.transactionId','transactionId=transaction.transactionId','committedRevision=transaction.revision',"item.status='PROMOTABLE'",'candidateWriteGuardService.rollback',"item.status='REJECTED'",'CANDIDATE_WORKSPACE_NOT_COMMITTABLE','CANDIDATE_WRITE_GUARD_INVALID'];
const missing=required.filter(token=>!source.includes(token));if(missing.length){console.error(`workspace transaction integration missing: ${missing.join(',')}`);process.exit(1);}
const commit=source.indexOf('candidateCommitTransactionService.commit');
const promotable=source.indexOf("item.status='PROMOTABLE'",commit);
if(commit<0||promotable<commit){console.error('workspace can become promotable before transaction commit');process.exit(1);}
console.log('PASS workspace transaction integration v105');
