import fs from 'node:fs';
const router=fs.readFileSync('src/miki/core/services/domainRouterService.ts','utf8');
const core=fs.readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
const gate=fs.readFileSync('src/miki/core/services/coreCompletionGateService.ts','utf8');
const checks={
 observedStatusExists:router.includes("'OBSERVED'"),
 diagnosticClassExists:router.includes("operationClass:'BUSINESS'|'DIAGNOSTIC'"),
 assessIsDiagnostic:router.includes("envelope.command==='ASSESS_DOMAIN'"),
 diagnosticCannotSucceedBusiness:router.includes("diagnostic?'OBSERVED':'SUCCEEDED'"),
 blackboardStoresOperation:core.includes('operation:route.command'),
 blackboardStoresDispatchId:core.includes('dispatchId:envelope.envelopeId'),
 completionRejectsAssess:gate.includes("value.operation === 'ASSESS_DOMAIN'"),
 completionRequiresBusiness:gate.includes("value.operationClass !== 'BUSINESS'"),
 receiptRequiresDispatchId:gate.includes("typeof value.dispatchId !== 'string'"),
 receiptRequiresBusinessReply:gate.includes("reply.operationClass === 'BUSINESS'")
};
const passed=Object.values(checks).every(Boolean);const report={version:'v44',passed,checks};fs.writeFileSync('DIAGNOSTIC_NOT_BUSINESS_V44.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!passed)process.exitCode=1;
