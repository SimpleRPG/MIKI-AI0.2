import fs from 'node:fs';
const router=fs.readFileSync('src/miki/core/services/domainRouterService.ts','utf8');
const planner=fs.readFileSync('src/miki/core/services/adaptiveRoutePlannerService.ts','utf8');
const bootstrap=fs.readFileSync('src/miki/core/services/domainIntegrationBootstrapService.ts','utf8');
const checks=[
 ['candidate command is canonical',router.includes("'GENERATE_CANDIDATE'")],
 ['review package command is canonical',router.includes("'CREATE_REVIEW_PACKAGE'")],
 ['UI ingress is recognized by planner',planner.includes('TYPED_IMPROVEMENT_UI_GATEWAY')],
 ['candidate required operation is proposed',planner.includes("command:'GENERATE_CANDIDATE'")],
 ['validation required operation is proposed',planner.includes("command:'VALIDATE_CANDIDATE'")],
 ['review package required operation is proposed',planner.includes("command:'CREATE_REVIEW_PACKAGE'")],
 ['candidate command has business handler',bootstrap.includes("envelope.command==='GENERATE_CANDIDATE'")&&bootstrap.includes('candidateCodeGenerationService.generate(run.runId)')],
 ['package command has business handler',bootstrap.includes("envelope.command==='CREATE_REVIEW_PACKAGE'")&&bootstrap.includes('reviewZipExportService.create(runId,workspaceId')],
 ['lineage includes task and candidate revision',planner.includes('taskId:task.taskId')&&planner.includes('candidateRevision:')],
 ['operations use stable dedupe keys',planner.includes('dedupeKey')&&planner.includes('operationInstanceId')&&planner.includes('attempt')],
];
let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed+=1;}
if(failed)process.exit(1);
