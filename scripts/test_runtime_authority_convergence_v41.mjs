import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const background=fs.readFileSync(path.join(root,'src/miki/execution/services/backgroundWorkerService.ts'),'utf8');
const governor=fs.readFileSync(path.join(root,'src/miki/autonomy/services/autonomousGrowthGovernorService.ts'),'utf8');
const bootstrap=fs.readFileSync(path.join(root,'src/miki/core/services/domainIntegrationBootstrapService.ts'),'utf8');
const controller=fs.readFileSync(path.join(root,'src/miki/improvement/services/selfImprovementControllerService.ts'),'utf8');
const checks={
 backgroundUsesIngress:background.includes('selfImprovementIngressService.submit'),
 backgroundNoDirectController:!background.includes('selfImprovementControllerService.runOnce'),
 governorUsesIngress:governor.includes('selfImprovementIngressService.submit'),
 governorNoDirectEvolution:!governor.includes('autonomousContinuousEvolutionService.runFullAutonomousCycle'),
 coreDomainHandlerOwnsControllerCall:bootstrap.includes('selfImprovementControllerService.runOnce'),
 controllerOwnsEvolutionCall:controller.includes('autonomousContinuousEvolutionService.runFullAutonomousCycle'),
 queueAcknowledgedNotApplied:governor.includes('improvement queued through core ingress'),
 backgroundQueueAcknowledged:background.includes('自己改善Queue受付')
};
const passed=Object.values(checks).every(Boolean);
const report={version:'v41',passed,checks,remainingAuthorizedDirectCalls:['domainIntegrationBootstrapService -> selfImprovementControllerService','selfImprovementControllerService -> autonomousContinuousEvolutionService']};
fs.writeFileSync(path.join(root,'RUNTIME_AUTHORITY_CONVERGENCE_V41.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!passed)process.exitCode=1;
