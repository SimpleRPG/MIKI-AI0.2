import fs from 'node:fs';
const workspace=fs.readFileSync('src/miki/core/services/isolatedCandidateWorkspaceService.ts','utf8');
const guard=fs.readFileSync('src/miki/core/services/candidateWriteGuardService.ts','utf8');
const stage=workspace.indexOf('candidateWriteGuardService.stage');
const begin=workspace.indexOf('try{',stage);
const consume=workspace.indexOf('candidateWriteGuardService.consume',begin);
const write=workspace.indexOf('this.items.set(workspaceId,item)',consume);
const rollback=workspace.indexOf('candidateWriteGuardService.rollback',write);
if(!(stage>=0&&begin>stage&&consume>begin&&write>consume&&rollback>write)){console.error('candidate transaction order is not stage -> consume -> write -> rollback handler');process.exit(1);}
if(!workspace.includes('catch(error)')||!workspace.includes('throw error')){console.error('failure is not rolled back and rethrown');process.exit(1);}
if(!guard.includes("guard.status==='ROLLED_BACK'" )||!guard.includes('stageGuardBeforeWrite===true')||!guard.includes('rollbackGuardBeforeWrite===true')){console.error('restored guard integrity verification is incomplete');process.exit(1);}
console.log('PASS candidate guard failure rollback v101');
