import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const core=read('src/miki/core/services/coreOrchestratorService.ts');
const planner=read('src/miki/core/services/adaptiveRoutePlannerService.ts');
const gate=read('src/miki/core/services/coreCompletionGateService.ts');
const checks={completionGateCalled:core.includes('assessCompletion(reevaluated)'),completionOnlyAfterGate:core.includes('if(completion.businessCompletion)'),finalRecheck:core.includes('CORE_COMPLETION_GATE_FAILED'),noEarlyCoreComplete:!core.includes("coreResultService.complete(reqId,{taskId,cycles,dispatched,status:'COMPLETED',visitedDomains"),failClosedTrue:gate.includes('failClosed:true'),requiresDomainSuccess:gate.includes('REQUIRED_DOMAIN_NOT_SUCCEEDED'),requiresReceipt:gate.includes('REQUIRED_DOMAIN_RECEIPT_MISSING'),requiresPersistence:gate.includes('PERSISTENCE_RECEIPT_MISSING'),rejectsErrors:gate.includes('UNRESOLVED_DOMAIN_ERROR'),plannerDelegates:planner.includes('coreCompletionGateService.evaluate(task,required)')};
const passed=Object.values(checks).every(Boolean);const report={version:'v40',passed,checks};fs.writeFileSync('CORE_AUTHORITY_FAIL_CLOSED_AUDIT_V40.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!passed)process.exitCode=1;
