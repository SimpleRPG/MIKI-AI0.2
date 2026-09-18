import fs from 'node:fs';
const source=fs.readFileSync('src/miki/core/services/candidateValidationRunnerService.ts','utf8');
const failures=['CANDIDATE_HASH_MISSING','CANDIDATE_HASH_MISMATCH','VALIDATION_EXECUTION_ENVIRONMENT_MISSING','VALIDATION_REQUEST_FAILED','VALIDATION_HTTP_','VALIDATION_FAILED'];
const unconnected=failures.filter(reason=>!source.includes(`rollbackFailure(workspaceId,workspace.writeGuardId`)||!source.includes(reason));
if(unconnected.length){console.error(`validation failures not rollback connected: ${unconnected.join(',')}`);process.exit(1);}
for(const token of ['candidateWriteGuardService.rollback(guardId)',"setStatus(workspaceId,'REJECTED')",'rolledBack:true',"setStatus(workspaceId,'SHADOW_PASSED')"]){if(!source.includes(token)){console.error(`missing validation transaction token: ${token}`);process.exit(1);}}
console.log('PASS validation failure rollback v103');
