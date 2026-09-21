import fs from 'node:fs';

const core=fs.readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
const self=fs.readFileSync('src/miki/core/services/autonomousSelfImprovementLoopService.ts','utf8');
const surface=fs.readFileSync('src/miki/core.ts','utf8');
const ingress=fs.readFileSync('src/miki/core/services/coreTaskIngressService.ts','utf8');

const checks={
 coreOwnsBlackboard:core.includes("taskBlackboardService.create")&&core.includes("taskBlackboardService.get"),
 coreOwnsPlanning:core.includes('adaptiveRoutePlannerService.plan'),
 coreOwnsDispatch:core.includes("domainRouterService.create('core'"),
 coreCollectsResults:core.includes('coreCollected:'),
 coreReevaluates:core.includes('coreReevaluation:'),
 coreCompletes:core.includes('coreCompletion'),
 selfImprovementEntersCore:self.includes('coreTaskIngressService.submit')&&self.includes("kind: 'SELF_IMPROVEMENT'"),
 ingressOwnsAuthority:ingress.includes('coreOrchestratorService.run'),
 legacyAdaptiveFacadeRemoved:!fs.existsSync('src/miki/core/services/adaptiveWorkflowOrchestratorService.ts'),
 legacySequentialFacadeRemoved:!fs.existsSync('src/miki/core/services/domainSequentialWorkflowService.ts'),
 noLegacyAdaptiveExport:!surface.includes('adaptiveWorkflowOrchestratorService'),
 noLegacySequentialExport:!surface.includes('domainSequentialWorkflowService'),
 exported:surface.includes('coreOrchestratorService')
};

const passed=Object.values(checks).every(Boolean);
const report={
 version:'v21',
 passed,
 checks,
 authority:'coreOrchestratorService',
 retiredCompatibilityFacades:[
  'adaptiveWorkflowOrchestratorService',
  'domainSequentialWorkflowService'
 ]
};

fs.writeFileSync(
 'CORE_18_DOMAIN_AUTHORITY_AUDIT_V21.json',
 JSON.stringify(report,null,2)+'\n'
);

console.log(JSON.stringify(report,null,2));
if(!passed)process.exitCode=1;
