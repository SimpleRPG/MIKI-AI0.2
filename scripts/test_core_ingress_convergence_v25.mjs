import fs from 'node:fs';

const ingress=fs.readFileSync('src/miki/core/services/coreTaskIngressService.ts','utf8');
const improvement=fs.readFileSync('src/miki/core/services/autonomousSelfImprovementLoopService.ts','utf8');
const core=fs.readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');

const checks={
 ingressOwnsSubmit:ingress.includes('coreOrchestratorService.run'),
 ingressOwnsResume:ingress.includes('coreOrchestratorService.resume'),
 ingressOwnsPauseCancel:ingress.includes('coreOrchestratorService.pause')&&ingress.includes('coreOrchestratorService.cancel'),
 selfImprovementUsesIngress:improvement.includes('coreTaskIngressService.submit')&&improvement.includes("kind: 'SELF_IMPROVEMENT'"),
 singleAuthorityImplementation:core.includes('class CoreOrchestratorService'),
 legacyAdaptiveFacadeRemoved:!fs.existsSync('src/miki/core/services/adaptiveWorkflowOrchestratorService.ts'),
 legacySequentialFacadeRemoved:!fs.existsSync('src/miki/core/services/domainSequentialWorkflowService.ts')
};

const passed=Object.values(checks).every(Boolean);
const report={
 version:'v25',
 passed,
 checks,
 ingress:'coreTaskIngressService',
 authority:'coreOrchestratorService'
};

fs.writeFileSync(
 'CORE_INGRESS_CONVERGENCE_AUDIT_V25.json',
 JSON.stringify(report,null,2)+'\n'
);

console.log(JSON.stringify(report,null,2));
if(!passed)process.exitCode=1;
