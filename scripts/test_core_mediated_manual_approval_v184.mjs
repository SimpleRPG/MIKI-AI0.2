import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const router=read('src/miki/core/services/domainRouterService.ts');
const planner=read('src/miki/core/services/adaptiveRoutePlannerService.ts');
const bootstrap=read('src/miki/core/services/domainIntegrationBootstrapService.ts');
const gateway=read('src/miki/core/ui/typedSelfCodeArchitectUiGatewayService.ts');
const ui=read('src/components/self_improvement/SelfCodeArchitectTab.tsx');
const aut=read('src/miki/autonomy/services/autonomousContinuousEvolutionService.ts');
const design=read('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt');
const checks={
 commandRegistered:router.includes('APPROVE_REVIEWED_CANDIDATE'),
 corePlannerOwnsApproval:planner.includes("operation==='APPROVE_REVIEWED_CANDIDATE'")&&planner.includes("target:'promotion',command:'APPROVE_REVIEWED_CANDIDATE'"),
 completionUsesPromotion:planner.includes("coreCompletionGateService.evaluate(task,['promotion'])"),
 promotionHandler:bootstrap.includes("envelope.command==='APPROVE_REVIEWED_CANDIDATE'")&&bootstrap.includes('approveAndDeployRecord(recordId)'),
 gatewayEntersCore:gateway.includes('coreTaskIngressService.submit')&&gateway.includes("operation: 'APPROVE_REVIEWED_CANDIDATE'"),
 uiNoDirectApproval:!ui.includes('gateway.continuousEvolution.approveAndDeployRecord(recordId)'),
 autoCycleReviewOnly:aut.includes('const isApprovalRequired = true;')&&aut.includes('V183_CANONICAL_REVIEW_ONLY'),
 spec:design.includes('手動承認適用のCORE媒介')
};
const passed=Object.values(checks).every(Boolean);
console.log(JSON.stringify({version:'v184',passed,checks},null,2));
if(!passed)process.exit(1);
