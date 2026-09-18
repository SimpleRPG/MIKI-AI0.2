import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const planner=read('src/miki/core/services/adaptiveRoutePlannerService.ts');
const router=read('src/miki/core/services/domainRouterService.ts');
const core=read('src/miki/core/services/coreOrchestratorService.ts');
const checks={
 assessmentStoredAsObservation:core.includes("operationClass==='DIAGNOSTIC'?'OBSERVATION'"),
 diagnosticFailureNotBusinessError:core.includes("const resultKind=operationClass==='DIAGNOSTIC'?'OBSERVATION'"),
 handlerDiagnosticHonored:router.includes("resultClass==='DIAGNOSTIC'"),
 onlyImprovementObservationRead:planner.includes("entry.kind!=='OBSERVATION'||entry.domain!=='improvement'"),
 exactAssessmentOperationRequired:planner.includes("value.operation!=='RUN_SELF_IMPROVEMENT'")&&planner.includes("result.operation!=='IMPROVEMENT_ASSESSMENT'"),
 schemaProducerDispatchRequired:planner.includes('value.schemaVersion!==2')&&planner.includes("value.producerId!=='domainRouterService'")&&planner.includes("typeof value.dispatchId!=='string'"),
 assessmentEvidenceRequired:planner.includes('result.evidenceIds.length===0'),
 priorityStableSort:planner.includes('.sort((left,right)=>Number(right.item.priority||0)-Number(left.item.priority||0)'),
 proposalSchemaValidated:planner.includes('const schemaValid=Boolean(mapped&&dedupeKey&&idempotencyKey'),
 dedupeOnlyAfterSuccess:core.includes("status:'OPERATION_SUCCEEDED'")&&planner.includes('proposedOperationSucceeded:${dedupeKey}')&&core.includes("reply.normalized?.status==='SUCCEEDED'")
};
const passed=Object.values(checks).every(Boolean);const report={version:'v47',passed,checks};fs.writeFileSync('PROPOSAL_STOP_CONTROL_V47.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!passed)process.exitCode=1;
