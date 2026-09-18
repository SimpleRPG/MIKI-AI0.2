import fs from 'node:fs';
const guard=fs.readFileSync('src/miki/core/services/candidateWriteGuardService.ts','utf8');
const workspace=fs.readFileSync('src/miki/core/services/isolatedCandidateWorkspaceService.ts','utf8');
const guardChecks=['isGuard(row)','value is CandidateWriteGuard','stageGuardBeforeWrite===true','rollbackGuardBeforeWrite===true',"guard.status==='ROLLED_BACK'"];
const missingGuard=guardChecks.filter(token=>!guard.includes(token));
if(missingGuard.length){console.error(`guard restore validation missing: ${missingGuard.join(',')}`);process.exit(1);}
const recoveryChecks=['this.load();this.reconcileRestoredWorkspaces();','candidateWriteGuardService.verify','guard.baseSnapshotSha256!==workspace.baseSnapshotSha256','guard.candidateRevisionSha256!==workspace.candidateRevisionSha256',"workspace.status='REJECTED'"];
const missingRecovery=recoveryChecks.filter(token=>!workspace.includes(token));
if(missingRecovery.length){console.error(`workspace restart reconciliation missing: ${missingRecovery.join(',')}`);process.exit(1);}
console.log('PASS candidate restart recovery v102');
