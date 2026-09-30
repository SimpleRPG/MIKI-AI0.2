import{readFileSync}from'node:fs';
const failures=[];
const lifecycle=readFileSync('src/miki/selfDevelopment/services/developmentReviewLifecycleService.ts','utf8');
const instruction=readFileSync('src/miki/selfDevelopment/services/unifiedInstructionDevelopmentService.ts','utf8');
const completion=readFileSync('src/miki/selfDevelopment/services/unifiedDevelopmentCompletionService.ts','utf8');
const ui=readFileSync('src/components/self_improvement/UltraSelfEvolverSubView.tsx','utf8');
const reviewUi=readFileSync('src/components/self_improvement/DevelopmentReviewLifecyclePanel.tsx','utf8');
const server=readFileSync('server.ts','utf8');
const checks={
 startupHealth:server.includes("app.get('/api/health'")&&server.includes('process.env.PORT'),
 instructionCreate:lifecycle.includes('public create(instructionText:string'),
 instructionStart:lifecycle.includes('public async start(base:UnifiedDevelopmentRequest)'),
 instructionCompiler:instruction.includes('developmentStrategyDecisionService')&&instruction.includes('autonomousFeatureDevelopmentPlanService'),
 constructionAndWiring:instruction.includes('autonomousFeatureConstructionExecutorService')&&instruction.includes('autonomousFeatureWiringPipelineService'),
 completionConnected:instruction.includes('unifiedDevelopmentCompletionService.complete'),
 validationEvidence:completion.includes('allowlistTestRunnerService')&&completion.includes('testResultEvidenceRecorderService')&&completion.includes('featureAcceptanceEvidenceGateService'),
 evaluationPackage:completion.includes('evaluationPackageExportService.create')&&completion.includes('evaluationPackageStoreService.save'),
 reviewReady:lifecycle.includes("transition(request,'REVIEW_READY')"),
 uiStartsLifecycle:(ui+reviewUi).includes('developmentReviewLifecycleService.start')&&(ui+reviewUi).includes('developmentReviewLifecycleService.create'),
 uiDecisions:(ui+reviewUi).includes("'ACCEPT'")&&(ui+reviewUi).includes("'REJECT'")&&(ui+reviewUi).includes("'REQUEST_CHANGES'"),
 acceptExternalReview:lifecycle.includes("submitDecision({externalReviewId:externalReview.externalReviewId,decision:'ACCEPT'"),
 acceptPromotion:lifecycle.includes("domainRouterService.create('core','promotion','APPROVE_REVIEWED_CANDIDATE'"),
 rejectCompletion:lifecycle.includes("transition(request,'REJECTED')")&&lifecycle.includes('persistRejection'),
 revisionLoop:lifecycle.includes("transition(request,'REVISION_REQUESTED')")&&lifecycle.includes('parentRevisionId=request.instructionId'),
 postDecisionState:lifecycle.includes("state:'COMPLETED'")||lifecycle.includes("transition(request,'COMPLETED')"),
 packageDownload:reviewUi.includes('evaluationPackageDownloadService.download'),
};
for(const[name,passed]of Object.entries(checks))if(!passed)failures.push(name);
console.log(JSON.stringify({passed:!failures.length,phase:'INSTRUCTION_TO_ADOPTION_21',checks,flow:['startup','instruction intake','strategy and plan','construction','wiring','validation','evaluation ZIP/ZIPTXT store','review ready','accept/reject/request changes','promotion or rejection completion'],failures},null,2));if(failures.length)process.exitCode=1;
