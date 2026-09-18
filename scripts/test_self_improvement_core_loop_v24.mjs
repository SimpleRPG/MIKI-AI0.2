import fs from 'node:fs';
const bootstrap=fs.readFileSync('src/miki/core/services/domainIntegrationBootstrapService.ts','utf8');
const loop=fs.readFileSync('src/miki/core/services/autonomousSelfImprovementLoopService.ts','utf8');
const planner=fs.readFileSync('src/miki/core/services/adaptiveRoutePlannerService.ts','utf8');
const ingress=fs.readFileSync('src/miki/core/services/coreTaskIngressService.ts','utf8');
const surface=fs.readFileSync('src/miki/core.ts','utf8');
const checks={
  singleDisposeUnregister:(bootstrap.match(/unregister\(domain\)/g)||[]).length===1,
  noLegacyDomainsReference:!bootstrap.includes('getMissingDomains(DOMAINS)')&&!bootstrap.includes('for(const d of DOMAINS)'),
  workerModeMarked:loop.includes("orchestrationMode: 'SELF_IMPROVEMENT_WORKER'"),
  plannerDetectsWorker:planner.includes("isSelfImprovementWorker=inputPayload?.orchestrationMode==='SELF_IMPROVEMENT_WORKER'"),
  recursiveImprovementBlocked:planner.includes("if(!isSelfImprovementWorker&&/改善|修正|実装|成長|自己改善/"),
  singleNewIngress:ingress.includes('coreOrchestratorService.run'),
  ingressExported:surface.includes('coreTaskIngressService')
};
const passed=Object.values(checks).every(Boolean);
const report={version:'v24',passed,checks};
fs.writeFileSync('SELF_IMPROVEMENT_CORE_LOOP_AUDIT_V24.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!passed)process.exitCode=1;
