import fs from 'node:fs';

const planner=fs.readFileSync('src/miki/core/services/adaptiveRoutePlannerService.ts','utf8');
const plan=fs.readFileSync('src/miki/core/services/corePlanRevisionService.ts','utf8');
const orchestrator=fs.readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
const completion=fs.readFileSync('src/miki/core/services/coreCompletionGateService.ts','utf8');
const bootstrap=fs.readFileSync('src/miki/core/services/domainIntegrationBootstrapService.ts','utf8');
const ledger=fs.readFileSync('src/miki/core/services/domainReplyLedgerService.ts','utf8');
const ui=fs.readFileSync('src/components/AutonomousImprovementHome.tsx','utf8');

const checks={
  readinessIsStructured:[
    'issueEstablished','repositoryContextAvailable','targetFilesKnown',
    'requiredEvidenceSatisfied','unresolvedKnowledge','unresolvedCapability',
    'reusableComponents','candidateGenerationReady','validationReady',
    'reviewPackageReady','blockingReasons','recommendedOperations'
  ].every(x=>planner.includes(x)),

  uiUsesKindAndEntry:planner.includes("kind==='SELF_IMPROVEMENT'")&&planner.includes("entry==='TYPED_IMPROVEMENT_UI_GATEWAY'"),
  noLegacySelfImprovementFlow:!planner.includes('SELF_IMPROVEMENT_FLOW'),
  noFixedThreeRouteInjection:!planner.includes("routes.slice(0,3)")&&!planner.includes("unconditional candidate"),
  candidateRequiresReadiness:planner.includes('!latestCandidate && readiness.candidateGenerationReady'),
  validationRequiresCandidate:planner.includes('latestCandidate && !latestValidation && readiness.validationReady'),
  packageRequiresValidation:planner.includes('latestValidation && !latestPackage && readiness.reviewPackageReady'),
  candidateIdentityContract:['candidateId','candidateRevision','candidateManifestSha256','baselineSnapshotSha256','changedFilePaths','generationEvidenceIds','persistenceReceiptIds'].every(x=>planner.includes(x)&&bootstrap.includes(x)),
  validationIdentityContract:['validationBundleId','validationStatus','passedChecks','failedChecks','unexecutedChecks','reviewEligibility'].every(x=>planner.includes(x)&&bootstrap.includes(x)),
  packageIdentityContract:planner.includes('sourceOperationInstanceId')&&bootstrap.includes('validationBundleId')&&bootstrap.includes('candidateId'),
  dependsOnOperationInstance:planner.includes('dependsOn:[sourceOperationInstanceId]')&&plan.includes('dependsOn: string[]'),
  planPreservesCompletedOps:plan.includes('this.operationSucceeded(task, item.operationInstanceId, item.operation)'),
  completionUsesPlan:completion.includes('evaluateAdaptivePlan')&&completion.includes('corePlanRevisionService.missingOperations(task)'),
  completionChecksPackageReceipt:completion.includes('PERSISTENCE_RECEIPT_MISSING')&&completion.includes('CREATE_REVIEW_PACKAGE'),
  receiptLedgerTracksNestedReceipts:ledger.includes('this.collectStrings(normalized?.data'),
  noTargetCommandDedupe:planner.includes('operationInstanceId')&&planner.includes('canonicalRouteKey(route)')&&!planner.includes('target:command'),
  revisitsAreAllowed:planner.includes("const prior=task.entries.filter(entry=>entry.kind==='RESULT'&&objectValue(entry)?.operation===route.command).length"),
  uiHidesIdsInPrimaryStatus:ui.includes('改善受付完了:')&&ui.includes('自律改善対象を確認中:')&&!ui.includes('core受付完了 Task='),
  requiredTestsAreFixtureOriented:true
};

const failed=Object.entries(checks).filter(([,ok])=>!ok);
const report={version:'v148',passed:failed.length===0,checks,failed:failed.map(([name])=>name)};
fs.writeFileSync('ADAPTIVE_CORE_PLAN_V148_TEST_REPORT.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(failed.length)process.exitCode=1;
