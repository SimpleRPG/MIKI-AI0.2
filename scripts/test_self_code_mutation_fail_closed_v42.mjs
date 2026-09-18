import fs from 'node:fs';
const server=fs.readFileSync('server.ts','utf8');
const stageStart=server.indexOf("app.post('/api/self-code/stage-proposal'");
const rollbackStart=server.indexOf("app.post('/api/self-code/rollback-snapshot'");
const stageGuard=server.indexOf("operation: 'STAGE_PROPOSAL'",stageStart);
const rollbackGuard=server.indexOf("operation: 'ROLLBACK_SNAPSHOT'",rollbackStart);
const stageWrite=server.indexOf('fs.writeFileSync(stagedFilePath',stageStart);
const rollbackWrite=server.indexOf('fs.writeFileSync(fullPath, target.originalContent',rollbackStart);
const checks={
 stageEndpointBlocked:stageGuard>stageStart,
 stageWriteRemoved:stageWrite<0,
 rollbackEndpointBlocked:rollbackGuard>rollbackStart,
 rollbackWriteRemoved:rollbackWrite<0,
 bothRequireCoreIngress:(server.match(/error: 'CORE_INGRESS_REQUIRED'/g)||[]).length>=3,
 noBrokenProposalVariable:!server.includes('fs.writeFileSync(stagedFilePath, proposalCode')
};
const passed=Object.values(checks).every(Boolean);const report={version:'v63',passed,checks,mode:'FAIL_CLOSED_NO_UNREACHABLE_MUTATION_CODE'};fs.writeFileSync('SELF_CODE_MUTATION_GATE_V42.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!passed)process.exitCode=1;
