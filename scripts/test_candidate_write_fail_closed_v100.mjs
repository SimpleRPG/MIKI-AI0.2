import fs from 'node:fs';
const guard=fs.readFileSync('src/miki/core/services/candidateWriteGuardService.ts','utf8');
const workspace=fs.readFileSync('src/miki/core/services/isolatedCandidateWorkspaceService.ts','utf8');
const required=['stageGuardBeforeWrite:true','rollbackGuardBeforeWrite:true','baseSnapshotSha256','candidateRevisionSha256','targetSetSha256',"status:'STAGED'",'CANDIDATE_WRITE_GUARD_SCOPE_MISMATCH','rollback('];
const missing=required.filter(token=>!guard.includes(token));if(missing.length){console.error(`missing fail-closed guard: ${missing.join(',')}`);process.exit(1);}
if(!workspace.includes('await candidateWriteGuardService.stage')||!workspace.includes('candidateWriteGuardService.consume')){console.error('workspace write is not gated');process.exit(1);}
if(workspace.indexOf('candidateWriteGuardService.consume')>workspace.indexOf('this.items.set(workspaceId,item)')){console.error('write occurs before guard consumption');process.exit(1);}
console.log('PASS candidate write fail-closed v100');
