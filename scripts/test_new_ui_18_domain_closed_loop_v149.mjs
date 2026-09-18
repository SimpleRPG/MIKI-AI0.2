import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const app=read('src/App.tsx');
const selfCode=read('src/components/self_improvement/SelfCodeArchitectTab.tsx');
const evidence=read('src/components/self_improvement/EvidenceBasedLoopSubView.tsx');
const modal=read('src/components/chat/AutonomousSelfImprovementModal.tsx');
const nonLlm=read('src/components/self_improvement/NonLlmArchitectureTab.tsx');
const gateway=read('src/miki/core/ui/typedImprovementUiGatewayService.ts');
const planner=read('src/miki/core/services/adaptiveRoutePlannerService.ts');
const orchestrator=read('src/miki/core/services/coreOrchestratorService.ts');
const bootstrap=read('src/miki/core/services/domainIntegrationBootstrapService.ts');
const receipt=read('src/miki/core/services/persistenceReceiptLedgerService.ts');
const catalog=read('src/miki/core/services/domainCatalogService.ts');
const domains=['autonomy','capability','conversation','data','execution','experience','improvement','learning','memory','promotion','research','safety','selfAwareness','selfDevelopment','strategy','unknown','verification'];
const checks={
  all17DomainsDeclared:domains.every(d=>catalog.includes(`'${d}'`)),
  uiSelfCodeUsesCoreGateway:selfCode.includes('typedImprovementUiGatewayService.startSpecifiedImprovement'),
  uiEvidenceUsesCoreGateway:evidence.includes('typedImprovementUiGatewayService.startSpecifiedImprovement'),
  uiModalUsesCoreGateway:modal.includes('typedImprovementUiGatewayService.startSpecifiedImprovement'),
  uiNonLlmUsesCoreGateway:nonLlm.includes('typedImprovementUiGatewayService.startSpecifiedImprovement'),
  appChatSelfImprovementUsesCoreGateway:app.includes('typedImprovementUiGatewayService.startSpecifiedImprovement'),
  noUiDirectImprovementQueue:![app,selfCode,evidence,modal,nonLlm].some(x=>x.includes('coreResultService.submitImprovementRequest')),
  gatewayEntersCore:gateway.includes('coreTaskIngressService.submit')&&gateway.includes("kind:'SELF_IMPROVEMENT'")&&gateway.includes("entry:'TYPED_IMPROVEMENT_UI_GATEWAY'"),
  coreOwnsPlanning:orchestrator.includes('adaptiveRoutePlannerService.plan'),
  coreOwnsDispatch:orchestrator.includes("domainRouterService.create('core'"),
  coreCollectsResults:orchestrator.includes("collectedBy:'core'")&&orchestrator.includes('coreCollected:true'),
  coreReevaluates:orchestrator.includes('coreReevaluation:'),
  adaptiveNoFixedThree:planner.includes('readiness')&&!planner.includes('routes.slice(0,3)'),
  candidateAfterReadiness:planner.includes('!latestCandidate && readiness.candidateGenerationReady'),
  validationAfterCandidate:planner.includes('latestCandidate && !latestValidation && readiness.validationReady'),
  packageAfterValidation:planner.includes('latestValidation && !latestPackage && readiness.reviewPackageReady'),
  operationInstanceDependencies:planner.includes('sourceOperationInstanceId')&&planner.includes('dependsOn:[sourceOperationInstanceId]'),
  validationPersistenceReceipt:bootstrap.includes("entityType:'CANDIDATE_VALIDATION'")&&bootstrap.includes('validationReceipt.receiptId'),
  validationReceiptLedgerSupported:receipt.includes("'CANDIDATE_VALIDATION'")&&receipt.includes("miki_candidate_validation_receipts_v1"),
  packagePersistenceReceipt:bootstrap.includes('CREATE_REVIEW_PACKAGE')&&bootstrap.includes('reviewZipExportService.create'),
  correctedSequentialTestPath:read('package.json').includes('scripts/test_18_domain_sequential_connections_v17.mjs')
};
const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
const report={version:'v149',purpose:'新UI→CORE→Adaptive 17分類→CORE Result 閉ループ実装監査',passed:failed.length===0,checks,failed};
fs.writeFileSync('NEW_UI_18_DOMAIN_CLOSED_LOOP_V149_REPORT.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(failed.length)process.exitCode=1;
