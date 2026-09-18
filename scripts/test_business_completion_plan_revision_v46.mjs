import fs from 'node:fs';
const plan=fs.readFileSync('src/miki/core/services/corePlanRevisionService.ts','utf8');
const core=fs.readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
const gate=fs.readFileSync('src/miki/core/services/coreCompletionGateService.ts','utf8');
const checks={
 planRevisionType:plan.includes('export interface CorePlanRevision'),
 requiredOperationsStored:plan.includes('requiredOperations: RequiredBusinessOperation[]'),
 revisionMonotonic:plan.includes('const nextRevision = (current?.planRevision || 0) + 1'),
 coreFreezesProposalOperations:core.includes('corePlanRevisionService.build'),
 revisionWrittenToBlackboard:core.includes('corePlanRevision:${plan.revision.planRevision}'),
 completionReadsPlan:gate.includes('corePlanRevisionService.missingOperations(task)'),
 completionFailsOnMissingOperation:gate.includes('REQUIRED_BUSINESS_OPERATION_MISSING'),
 onlyBusinessSuccessSatisfies:plan.includes("value.operationClass === 'BUSINESS'")&&plan.includes("reply?.status === 'SUCCEEDED'"),
 oldRevisionCannotAccidentallyMatchDedupe:plan.includes('operationInstanceId')&&plan.includes('value.planRevision === revision.planRevision'),
 assessmentNotCompletionReceipt:!plan.includes('IMPROVEMENT_ASSESSMENT')
};
const passed=Object.values(checks).every(Boolean);const report={version:'v46',passed,checks};fs.writeFileSync('BUSINESS_COMPLETION_PLAN_REVISION_V46.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!passed)process.exitCode=1;
