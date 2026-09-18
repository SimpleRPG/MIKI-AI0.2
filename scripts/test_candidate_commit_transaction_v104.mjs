import fs from 'node:fs';
const source=fs.readFileSync('src/miki/core/services/candidateCommitTransactionService.ts','utf8');
const required=['STAGED','APPLYING','COMMITTED','ROLLED_BACK','RECOVERY_REQUIRED','PERSISTENCE_RECEIPT_REQUIRED','WEB_CRYPTO_REQUIRED','CANDIDATE_PATH_ESCAPE_REJECTED','baselineSnapshotSha256','candidateManifestSha256','candidateRevisionSha256','previousTransactionId','recoverIncomplete'];
const missing=required.filter(token=>!source.includes(token));if(missing.length){console.error(`transaction contract missing: ${missing.join(',')}`);process.exit(1);}
if(source.includes('fallback-')||source.includes('fnv1a-')){console.error('non-SHA fallback is forbidden');process.exit(1);}
if(source.indexOf("status='COMMITTED'")<source.indexOf('receiptId:input.receiptId')){console.error('commit can precede receipt binding');process.exit(1);}
console.log('PASS candidate commit transaction v104');
