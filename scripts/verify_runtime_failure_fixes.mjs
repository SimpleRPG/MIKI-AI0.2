import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(path, 'utf8');
const checks = [];
const check = (name, passed) => checks.push({ name, passed: Boolean(passed) });
const verifierSource = read('scripts/verify_runtime_failure_fixes.mjs');

const runner = read('android/app/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt');
const nativeCore = read('android/app/src/main/java/com/miki/ai/MIKINativeCore.kt');
const main = read('android/app/src/main/java/com/miki/ai/MainActivity.java');
const nativeJournal = read('android/app/src/main/java/com/miki/ai/NativeWebViewDiagnosticJournal.java');
const runnerInstaller = read('scripts/install_android_native_runner.sh');
const morphologyInstaller = read('scripts/install_android_japanese_morphology.sh');
const workmanagerInstaller = read('scripts/install_android_workmanager.sh');
const workmanagerRuntime = read('android/app/src/main/java/com/miki/ai/MikiWorkManagerPlugin.kt');
const workmanagerWorkerRuntime = read('android/app/src/main/java/com/miki/ai/MikiBackgroundWorker.kt');
const workmanagerNativePlugin = read('android-native/src/main/java/com/miki/ai/MikiWorkManagerPlugin.kt');
const workmanagerNativeWorker = read('android-native/src/main/java/com/miki/ai/MikiBackgroundWorker.kt');
const morphologySource = read('android-native/src/main/java/com/miki/ai/MIKIJapaneseMorphologyPlugin.kt');
const morphologyApp = read('android/app/src/main/java/com/miki/ai/MIKIJapaneseMorphologyPlugin.kt');
const core = read('src/miki/core/services/coreOrchestratorService.ts');
const api = read('src/services/api.ts');
const teacher = read('src/miki/learning/services/teacherRequestService.ts');
const search = read('src/miki/research/services/autonomousSearchService.ts');
const auditLegacy = read('src/services/privacyGuardrailService.ts');
const auditCore = read('src/miki/safety/services/privacyGuardrailService.ts');
const sanitizerLegacy = read('src/services/abstractSanitizerService.ts');
const sanitizerCore = read('src/miki/safety/services/abstractSanitizerService.ts');
const outboundHelper = read('src/miki/safety/services/outboundPayloadSanitizer.ts');
const design = read('MIKI-AI0.2_統合設計書_正本.txt');
const rustManifest = read('native/miki-native-core/Cargo.toml');
const issueDiscoveryIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/core/services/autonomousIssueDiscoveryService.ts |'));
const taskCaseMemoryIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/memory/services/taskCaseMemoryService.ts |'));
const candidatePreparationIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/core/services/autonomousCandidatePreparationService.ts |'));
const capabilityLedgerIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/capability/services/capabilityLedgerService.ts |'));
const capabilityLedgerScreenIndexRow = design.split(/\r?\n/).find(line => line.includes('src/components/CapabilityLedgerScreen.tsx |'));
const improvementIntakeRouterIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/core/services/improvementIntakeRouterService.ts |'));
const autonomousEvolutionIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/autonomy/services/autonomousEvolutionService.ts |'));
const counterfactualIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/unknown/services/counterfactualReasoningService.ts |'));
const chapter36IndexRow = design.split(/\r?\n/).find(line => line.includes('src/autonomous_modules/chapter_36.ts |'));
const selfCodeArchitectIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/selfDevelopment/services/selfCodeArchitectService.ts |'));
const counterfactualPolicyIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/unknown/services/counterfactualEvaluationPolicy.ts |'));
const executionRunnerIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/execution/services/executionRunnerService.ts |'));
const legacyCounterfactualIndexRow = design.split(/\r?\n/).find(line => line.includes('src/services/counterfactualReasoningService.ts |'));
const runtimeLogger = read('src/services/systemLogger.ts');
const runtimeLifecycle = read('src/app/appRuntimeLifecycleService.ts');
const domainParticipation = read('src/miki/core/services/domainParticipationService.ts');
const domainSequentialConnection = read('src/miki/core/services/domainSequentialConnectionService.ts');
const app = read('src/App.tsx');
const mainEntry = read('src/main.tsx');
const appManifest = read('android/app/src/main/AndroidManifest.xml');
const apkWorkflow = read('.github/workflows/build-apk.yml');
const chatPanel = read('src/components/ChatPanel.tsx');
const domainContract = read('src/miki/core/services/domainContractRegistryService.ts');
const domainRouter = read('src/miki/core/services/domainRouterService.ts');
const oomStorageSource = read('src/services/storageService.ts');
const oomSeedSource = read('src/miki/core/services/selfCodeSpaceService.ts');
const planRevision = read('src/miki/core/services/corePlanRevisionService.ts');
const routePlanner = read('src/miki/core/services/adaptiveRoutePlannerService.ts');
const completionGate = read('src/miki/core/services/coreCompletionGateService.ts');
const taskIngress = read('src/miki/core/services/coreTaskIngressService.ts');
const taskBlackboard = read('src/miki/core/services/taskBlackboardService.ts');
const developmentReviewLifecycle = read('src/miki/selfDevelopment/services/developmentReviewLifecycleService.ts');
const developmentLifecycleStateMachine = read('src/miki/selfDevelopment/services/developmentLifecycleStateMachineService.ts');
const issueDiscovery = read('src/miki/core/services/autonomousIssueDiscoveryService.ts');
const autonomousLoop = read('src/miki/core/services/autonomousSelfImprovementLoopService.ts');
const autonomousEvolution = read('src/miki/autonomy/services/autonomousEvolutionService.ts');
const counterfactual = read('src/miki/unknown/services/counterfactualReasoningService.ts');
const counterfactualPolicy = read('src/miki/unknown/services/counterfactualEvaluationPolicy.ts');
const executionRunner = read('src/miki/execution/services/executionRunnerService.ts');
const legacyCounterfactual = read('src/services/counterfactualReasoningService.ts');
const chapter36 = read('src/autonomous_modules/chapter_36.ts');
const selfCodeArchitect = read('src/miki/selfDevelopment/services/selfCodeArchitectService.ts');
const autonomousSearch = read('src/miki/research/services/autonomousSearchService.ts');
const preflightService = read('src/miki/core/services/selfImprovementPreflightService.ts');
const requiredAssetAcquisition = read('src/miki/core/services/requiredAssetAcquisitionService.ts');
const missingAssetSynthesis = read('src/miki/core/services/missingAssetSynthesisService.ts');
const autonomousRevalidationLoop = read('src/miki/autonomy/services/autonomousRevalidationLoopService.ts');
const domainIntegrationBootstrap = read('src/miki/core/services/domainIntegrationBootstrapService.ts');
const researchPipelineSource = read('src/miki/research/services/researchService.ts');
const claimVerifierSource = read('src/miki/verification/services/verifierService.ts');
const legacyConversationCoreSource = read('src/services/nonLlmCoreService.ts');
const currentConversationCoreSource = read('src/miki/safety/services/conversationCoreService.ts');
const webContentUnderstandingSource = read('src/miki/research/services/webContentUnderstandingService.ts');
const researchServiceIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/research/services/researchService.ts |'));
const claimVerifierIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/verification/services/verifierService.ts |'));
const legacyConversationCoreIndexRow = design.split(/\r?\n/).find(line => line.includes('src/services/nonLlmCoreService.ts |'));
const currentConversationCoreIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/safety/services/conversationCoreService.ts |'));
const webContentUnderstandingIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/research/services/webContentUnderstandingService.ts |'));
const taskBlackboardIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/core/services/taskBlackboardService.ts |'));
const taskIngressIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/core/services/coreTaskIngressService.ts |'));
const developmentReviewLifecycleIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/selfDevelopment/services/developmentReviewLifecycleService.ts |'));
const developmentStateMachineIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/selfDevelopment/services/developmentLifecycleStateMachineService.ts |'));
const developmentRequestModelIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/selfDevelopment/services/unifiedDevelopmentRequestModel.ts |'));
const taskCaseMemory = read('src/miki/memory/services/taskCaseMemoryService.ts');
const candidatePreparation = read('src/miki/core/services/autonomousCandidatePreparationService.ts');
const candidateCodeGeneration = read('src/miki/core/services/candidateCodeGenerationService.ts');
const capabilityLedger = read('src/miki/capability/services/capabilityLedgerService.ts');
const capabilityLedgerScreen = read('src/components/CapabilityLedgerScreen.tsx');
const capabilityLedgerIngress = read('src/miki/core/services/coreTaskIngressService.ts');
const improvementIntakeRouter = read('src/miki/core/services/improvementIntakeRouterService.ts');
const failureUnderstanding = read('src/miki/memory/services/failureUnderstandingService.ts');
const claimDatabase = read('src/miki/memory/services/claimDatabaseService.ts');
const knowledgeHalfLife = read('src/miki/memory/services/knowledgeHalfLifeService.ts');
const canonicalServiceAlias = read('src/miki/core/services/canonicalServiceAliasRegistryService.ts');
const cognitiveQuality = read('src/miki/core/services/cognitiveQualityService.ts');
const operationalGovernance = read('src/miki/autonomy/services/operationalGovernanceService.ts');
const backgroundWorker = read('src/miki/execution/services/backgroundWorkerService.ts');
const continuousEvolution = read('src/miki/autonomy/services/autonomousContinuousEvolutionService.ts');
const eventService = read('src/miki/improvement/services/selfImprovementRequestEventService.ts');
const workManagerFacade = read('src/miki/execution/services/workManagerService.ts');
const orchestratorIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/core/services/coreOrchestratorService.ts |'));
const ingressIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/core/services/coreTaskIngressService.ts |'));
const completionGateIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/core/services/coreCompletionGateService.ts |'));
const cognitiveQualityIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/core/services/cognitiveQualityService.ts |'));
const operationalGovernanceIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/autonomy/services/operationalGovernanceService.ts |'));
const backgroundWorkerIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/execution/services/backgroundWorkerService.ts |'));
const workManagerFacadeIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/execution/services/workManagerService.ts |'));
const continuousEvolutionIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/autonomy/services/autonomousContinuousEvolutionService.ts |'));
const eventServiceIndexRow = design.split(/\r?\n/).find(line => line.includes('src/miki/improvement/services/selfImprovementRequestEventService.ts |'));

check('Canonical Runner exposes decideCoreGoals', runner.includes('fun decideCoreGoals(call: PluginCall)'));
check('Canonical Runner exposes rankDomainRoutes', runner.includes('fun rankDomainRoutes(call: PluginCall)'));
check('MIKINativeCore exposes decideCoreGoals', nativeCore.includes('fun decideCoreGoals(requestJson: String)') && nativeCore.includes('nativeDecideCoreGoals'));
check('MainActivity registers MIKINativeRunner', main.includes('registerPlugin(MIKINativeRunnerPlugin.class)'));
check('Runner installer never copies legacy template', !runnerInstaller.includes('cp "$PLUGIN_SRC" "$PACKAGE_DIR/MIKINativeRunnerPlugin.kt"'));
check('Morphology installer never copies legacy Runner template', !morphologyInstaller.includes('NATIVE_RUNNER_SRC') && !morphologyInstaller.includes('cp "$NATIVE_RUNNER_SRC" "$PACKAGE_DIR/MIKINativeRunnerPlugin.kt"'));
check('Morphology installer guards Rust bridge before changes', morphologyInstaller.includes('grep -Fq \'fun decideCoreGoals(call: PluginCall)\' "$RUNNER_TARGET"') && morphologyInstaller.includes('grep -Fq \'fun decideCoreGoals(requestJson: String)\' "$CORE_TARGET"'));
check('WorkManager source exposes candidate browser E2E', workmanagerRuntime.includes('fun runCandidateBrowserE2E(call: PluginCall)') && workmanagerRuntime.includes('fun fetchRenderedPage(call: PluginCall)'));
check('WorkManager foreground path waits for a cycle-correlated explicit completion receipt', workmanagerRuntime.includes('MikiAutonomousCycleCallback') && workmanagerRuntime.includes("log.status === 'completed'") && workmanagerRuntime.includes('triggerAutonomousCycle(cycleId: String') && workmanagerRuntime.includes('activeAutonomousCycleId'));
check('WorkManager does not report trigger acknowledgment as completion', !workmanagerRuntime.includes('notifyListeners("autonomousCycleTriggered", ret)') && !workmanagerRuntime.includes('triggered = evalRes?.contains("OK")'));
check('Headless Worker requires explicit successful completion receipt', workmanagerWorkerRuntime.includes('MikiAutonomousCycleCallback') && workmanagerWorkerRuntime.includes("log.status === 'completed'") && workmanagerWorkerRuntime.includes('completionDeferred.complete(success)'));
check('Worker falls back to headless only when active runtime is not attached', workmanagerWorkerRuntime.includes('plugin.hasActiveWebRuntime()') && workmanagerRuntime.includes('fun hasActiveWebRuntime(): Boolean = activity != null && bridge?.webView != null'));
check('Headless Worker cleans partially created WebView on setup exception', workmanagerWorkerRuntime.includes('cleanupWebView') && workmanagerWorkerRuntime.includes('cleanupClaimed'));
check('Headless WebView is cleaned in finally for cancellation and timeout', workmanagerWorkerRuntime.includes('finally {') && workmanagerWorkerRuntime.includes('cleanupWebView()'));
check('Headless Worker never turns a 30-second trigger acknowledgment into success', !workmanagerWorkerRuntime.includes('postDelayed({') || !workmanagerWorkerRuntime.includes('completionDeferred.complete(true)'));
check('Worker concurrency lock is released for every in-try exit', workmanagerWorkerRuntime.includes('workerExecutionLock.compareAndSet(false, true)') && workmanagerWorkerRuntime.includes('workerExecutionLock.set(false)') && workmanagerWorkerRuntime.includes('finally'));
check('Timed-out active runtime requests same-cycle cancellation and never launches a second executor', workmanagerWorkerRuntime.includes('refusing fallback') && workmanagerWorkerRuntime.includes('plugin.cancelAutonomousCycle(cycleId)') && !workmanagerWorkerRuntime.includes('tryHttpLocalTrigger()'));
check('CORE resumes only after validating exact Blackboard checkpoint snapshot', core.includes('validateCognitiveCheckpointForResume(currentTask)') && core.includes('BLACKBOARD_SNAPSHOT_DOES_NOT_MATCH_CHECKPOINT') && core.includes('COGNITIVE_CHECKPOINT_CHAIN_INVALID'));
check('WorkManager installer does not overwrite canonical code', !workmanagerInstaller.includes('cp "$SRC_DIR/MikiWorkManagerPlugin.kt" "$PACKAGE_DIR/MikiWorkManagerPlugin.kt"') && !workmanagerInstaller.includes('cp "$SRC_DIR/MikiBackgroundWorker.kt" "$PACKAGE_DIR/MikiBackgroundWorker.kt"'));
check('WorkManager installer validates canonical plugin', workmanagerInstaller.includes('fun runCandidateBrowserE2E(call: PluginCall)') && workmanagerInstaller.includes('fun fetchRenderedPage(call: PluginCall)'));
check('Both morphology sources use filesystem anchor', morphologySource.includes('PathAnchor.filesystem(context.filesDir.absolutePath)') && morphologyApp.includes('PathAnchor.filesystem(context.filesDir.absolutePath)'));
check('Neither morphology source uses PathAnchor.none', !morphologySource.includes('PathAnchor.none()') && !morphologyApp.includes('PathAnchor.none()'));
check('Both morphology sources check empty dictionary', morphologySource.includes('SUDACHI_SYSTEM_DICTIONARY_MISSING_OR_EMPTY') && morphologyApp.includes('SUDACHI_SYSTEM_DICTIONARY_MISSING_OR_EMPTY'));

const resumeStart = core.indexOf(' async resume(taskId:string,maxCycles=18,allowRoutingRecovery=false):Promise<CoreOrchestrationResult|undefined>{');
const resumeEnd = core.indexOf(' pause(taskId:string,reason?:string){', resumeStart);
const resume = resumeStart >= 0 && resumeEnd > resumeStart ? core.slice(resumeStart, resumeEnd) : '';
const thenStart = resume.indexOf("if(result.task.status==='FAILED')");
const catchStart = resume.indexOf('.catch((error)=>{');
const thenBlock = thenStart >= 0 && catchStart > thenStart ? resume.slice(thenStart, catchStart) : '';
const catchBlock = catchStart >= 0 ? resume.slice(catchStart) : '';
check('CORE resume() exact function found', Boolean(resume));
check('FAILED result payload comes from Blackboard INPUT', thenBlock.includes("const payloadValue=task.entries.find(entry=>entry.kind==='INPUT'&&entry.key==='payload')?.value"));
check('FAILED result goal/source come from task', thenBlock.includes('goal:task.goal') && thenBlock.includes('source:task.source'));
check('resume catch has safe task fallback', catchBlock.includes('const failureTask=task??resumed'));
check('resume catch payload comes from fallback task', catchBlock.includes("const payloadValue=failureTask.entries.find(entry=>entry.kind==='INPUT'&&entry.key==='payload')?.value"));
check('resume catch goal/source come from fallback task', catchBlock.includes('goal:failureTask.goal') && catchBlock.includes('source:failureTask.source'));

check('Outbound helper audits serialized payload and parses only audited text', outboundHelper.includes('JSON.stringify(payload)') && outboundHelper.includes('abstractSanitizerService.sanitizeText(serialized)') && outboundHelper.includes('auditJson(baseline.sanitized)') && outboundHelper.includes('JSON.parse(audit.sanitizedText)') && outboundHelper.includes('SANITIZED_OUTBOUND_PAYLOAD_INVALID_JSON') && outboundHelper.includes('symbolReplacements: {}') && outboundHelper.includes('[REDACTED:${String(violation?.type'));
check('Cloud chat audits all JSON fields before fetch', api.includes('sanitizeOutboundPayload(paramsForAudit') && api.includes('JSON.stringify(outboundParams)') && api.includes('payloadAudit.payload'));
check('Cloud chat no longer sends unaudited history/attachments', !api.includes('const sanitizedAttachedFiles = params.attachedFiles?.map') && !api.includes('const sanitizedWorkspaceFiles = params.workspaceFiles?.map'));
check('Distillation sends its sanitized structured payload', api.includes('sanitizeOutboundPayload(params,') && api.includes('JSON.stringify(outbound.payload)') && !api.includes('topic: audit.sanitizedText'));
check('Teacher request sends sanitized complete payload', teacher.includes('sanitizeOutboundPayload(payload,') && teacher.includes('const safePayload: TeacherRequestPayload = outbound.payload'));
check(
  'Native Runner adapts every Throwable reject to Capacitor Exception',
  runner.includes('private fun Throwable.toCapacitorException(): Exception') &&
    (runner.match(/error\.toCapacitorException\(\)/g) || []).length === 17 &&
    !/call\.reject\(("[A-Z0-9_]+"),\s*error\s*\)/.test(runner)
);
const safeSearchStart = search.indexOf('const safeQuery = outbound.payload;');
const safeSearchEnd = search.indexOf('  public async readSearchResultPages', safeSearchStart);
const safeSearchRegion = safeSearchStart >= 0 && safeSearchEnd > safeSearchStart ? search.slice(safeSearchStart, safeSearchEnd) : '';
const searchAuditStart = search.indexOf('const outbound = sanitizeOutboundPayload(cleanQuery,');
const searchAuditEnd = search.indexOf('const safeQuery = outbound.payload;', searchAuditStart);
const searchAuditRegion = searchAuditStart >= 0 && searchAuditEnd > searchAuditStart ? search.slice(searchAuditStart, searchAuditEnd) : '';
const bannedSearchStart = search.indexOf('const bannedQueryCheck = bannedTopicsConfigService.checkBanned(safeQuery);');
const bannedSearchEnd = search.indexOf('const preferred =', bannedSearchStart);
const bannedSearchRegion = bannedSearchStart >= 0 && bannedSearchEnd > bannedSearchStart ? search.slice(bannedSearchStart, bannedSearchEnd) : '';
check(
  'Web search baseline-sanitizes before the configurable privacy audit',
  search.includes("import { sanitizeOutboundPayload } from '../../safety/services/outboundPayloadSanitizer';") &&
    Boolean(searchAuditRegion) &&
    searchAuditRegion.includes("privacyGuardrailService.auditOutboundContent(serialized, 'web_search', { autoSanitize: true })") &&
    searchAuditRegion.includes('outbound.payload')
);
check(
  'All outbound search provider URLs use sanitized query',
  Boolean(safeSearchRegion) && !safeSearchRegion.includes('cleanQuery') && safeSearchRegion.includes('safeQuery')
);
check(
  'Blocked search logs and summaries never include query or matched topic',
  Boolean(bannedSearchRegion) &&
    !searchAuditRegion.includes('${cleanQuery}') &&
    !searchAuditRegion.includes('${safeQuery}') &&
    !bannedSearchRegion.includes('${safeQuery}') &&
    !bannedSearchRegion.includes('${cleanQuery}') &&
    !bannedSearchRegion.includes('${bannedQueryCheck.matchedTopic}') &&
    bannedSearchRegion.includes('query redacted')
);
check('Legacy audit service path re-exports the canonical safety implementation', auditLegacy.trim().endsWith("export * from '../miki/safety/services/privacyGuardrailService';") && !auditLegacy.includes('sanitizeAuditLogEntry'));
check('Audit logs redact contents and symbol mappings (CORE)', auditCore.includes('sanitizeAuditLogEntry') && auditCore.includes("sanitizedText: ''") && auditCore.includes('symbolReplacements: {}') && auditCore.includes('Audit metadata retained; content, reversible mappings, and identifying details redacted.') && auditCore.includes('data|storage|sdcard|system'));
check('Legacy sanitizer path re-exports the canonical safety implementation', sanitizerLegacy.trim().endsWith("export * from '../miki/safety/services/abstractSanitizerService';") && !sanitizerLegacy.includes('TRANSIENT_SYMBOL_CATEGORIES'));
check('Canonical sanitizer detects Android app-private paths through the legacy facade', sanitizerLegacy.includes("export * from '../miki/safety/services/abstractSanitizerService'") && sanitizerCore.includes('data|storage|sdcard|system'));
check('CORE sanitizer persists no credential/PII/path/host mappings', sanitizerCore.includes('TRANSIENT_SYMBOL_CATEGORIES') && sanitizerCore.includes('if (!TRANSIENT_SYMBOL_CATEGORIES.has(category)) this.saveMappings()'));
check('CORE sanitizer detects Android app-private paths', sanitizerCore.includes('data|storage|sdcard|system'));
check(
  'Sudachi initializes with an explicit OOV provider in both Android source copies',
  morphologySource.includes('SimpleOovProviderPlugin') &&
    morphologyApp.includes('SimpleOovProviderPlugin') &&
    morphologySource.includes('oovProviderPlugin') &&
    morphologyApp.includes('oovProviderPlugin')
);
check(
  'HeadlessWebView page reads are serialized to match native single-flight locking',
  autonomousSearch.includes('for (const result of readable)') &&
    !autonomousSearch.includes('readable.map(async (result) =>')
);
check(
  'ANALYZE_TEXT uses the canonical evidence-free diagnostic contract',
  domainContract.includes("'ANALYZE_TEXT'") &&
    domainContract.includes('export function isDiagnosticDomainCommand') &&
    domainContract.includes('isDiagnosticDomainCommand(envelope.command)')
);
check(
  'Diagnostic plan operations require a successful diagnostic observation, not a fabricated business receipt',
  planRevision.includes('isDiagnosticDomainCommand(command)') &&
    planRevision.includes("entry.kind === 'OBSERVATION'") &&
    planRevision.includes("normalized.operationClass === 'DIAGNOSTIC'")
);
check(
  'Conversation planner accepts successful diagnostic ANALYZE_TEXT and RESOLVE_UNKNOWN observations',
  routePlanner.includes("latestSuccessfulOperationResult(task,'ANALYZE_TEXT')") &&
    routePlanner.includes("latestSuccessfulOperationResult(task,'RESOLVE_UNKNOWN')") &&
    routePlanner.includes('isSuccessfulOperationEntry')
);
check(
  'Adaptive completion uses the same canonical diagnostic command classifier',
  completionGate.includes('isDiagnosticDomainCommand(record.command as DomainCommand)') &&
    !completionGate.includes("['ASSESS_DOMAIN','HEALTH_CHECK','DESCRIBE','GET_STATUS','PARTICIPATE','VERIFY_CONNECTION','DISCOVER_IMPROVEMENT_ISSUE','RUN_SELF_IMPROVEMENT'].includes(record.command)")
);
check(
  'Explicit CORE task kind cannot be overwritten by payload metadata',
  /\.\.\.\(request\.initialPayload\|\|\{\}\),\s*kind:request\.kind/.test(taskIngress)
);
check(
  'Issue discovery records issueKind instead of colliding with task kind',
  issueDiscovery.includes('issueKind:issue.kind') &&
    !/(?:^|[,{]\s*)kind:issue\.kind/.test(issueDiscovery)
);
check(
  'Legacy queued discovery tasks are replaced instead of resumed as generic tasks',
  autonomousLoop.includes('replaceLegacyMisclassifiedTask(request)') &&
    autonomousLoop.includes('legacyWorkerTaskReplaced') &&
    autonomousLoop.includes('taskBlackboardService.cancel(task.taskId)') &&
    autonomousLoop.includes("kind:'SELF_IMPROVEMENT'")
);
check(
  'Waiting head does not block other eligible improvement requests',
  autonomousLoop.includes('item.nextAttemptAt<=Date.now()') &&
    autonomousLoop.includes('eligibleIndex<0') &&
    autonomousLoop.includes("request.waitKind='EVIDENCE'") &&
    autonomousLoop.includes("request.waitKind='RETRY'")
);
check(
  'Autonomous recovery schedules the earliest retry deadline instead of waiting for the polling interval',
  autonomousLoop.includes('private recoveryTimer: ReturnType<typeof setTimeout> | null = null;') &&
    autonomousLoop.includes('private disposed = false;') &&
    autonomousLoop.includes('this.disposed = false;') &&
    autonomousLoop.includes('this.disposed = true;') &&
    autonomousLoop.includes('if (this.writesBlocked || this.disposed || this.running || this.state.queue.length === 0) return;') &&
    autonomousLoop.includes('private scheduleRecovery(delayOverrideMs?: number): void') &&
    autonomousLoop.includes('this.recoveryTimer = setTimeout(() => {') &&
    autonomousLoop.includes('Math.min(...nextAttemptAtValues)') &&
    autonomousLoop.includes('this.scheduleRecovery(RECOVERY_POLL_MS)') &&
    autonomousLoop.includes('this.running = false;\n      this.scheduleRecovery();')
);
check(
  'Preflight waits for persistent storage initialization and treats an unavailable backend as a resource wait',
  preflightService.includes('async evaluate(runId: string): Promise<PreflightResult>') &&
    preflightService.includes('await storageService.ready;') &&
    autonomousLoop.includes('await selfImprovementPreflightService.evaluate(request.runId)') &&
    autonomousLoop.includes("preflight.reasons.includes('PERSISTENT_BACKEND_REQUIRED')")
);
check(
  'Recovery actions use original evidence reasons and all synthesis actions request typed candidate drafts',
  requiredAssetAcquisition.includes('const requirements = this.classify(input.reasons);') &&
    !requiredAssetAcquisition.includes('this.classify(expandedReasons)') &&
    requiredAssetAcquisition.includes("case 'SYNTHESIZE_KNOWLEDGE':\n            requestedDrafts.push({ kind: 'KNOWLEDGE', requirement });") &&
    requiredAssetAcquisition.includes("case 'SYNTHESIZE_COMPONENT':\n            requestedDrafts.push({ kind: 'CODE_COMPONENT', requirement });") &&
    requiredAssetAcquisition.includes("case 'SYNTHESIZE_ADAPTER':\n            requestedDrafts.push({ kind: 'ADAPTER', requirement });") &&
    requiredAssetAcquisition.includes("case 'SYNTHESIZE_VALIDATOR':\n            requestedDrafts.push({ kind: 'VALIDATION', requirement });") &&
    requiredAssetAcquisition.includes('const requestedDrafts: Array<{ kind: MissingAssetDraftKind; requirement: string }> = [];') &&
    requiredAssetAcquisition.includes('requestedDrafts});') &&
    missingAssetSynthesis.includes('requestedDrafts?:Array<{kind:MissingAssetDraftKind;requirement:string}>') &&
    missingAssetSynthesis.includes('input.requestedDrafts || []')
);
check(
  'A missing Evidence ID is not mislabeled as an unlinked existing Evidence record',
  requiredAssetAcquisition.includes('RESEARCH_RETURNED_NO_EVIDENCE_ID:${gap.id}') &&
    requiredAssetAcquisition.includes('const evidenceAcquired = evidenceIds.length > 0 && unlinkedEvidenceIds.length === 0;') &&
    requiredAssetAcquisition.includes('acquired: evidenceAcquired,') &&
    requiredAssetAcquisition.includes('EVIDENCE_RESEARCHED_BUT_UNLINKED:${gap.id}') &&
    requiredAssetAcquisition.includes('if (/required_asset') &&
    requiredAssetAcquisition.includes('.capability/i.test(reason)')
);

check(
  'SOAR recovery subgoals keep stable blocker identities and terminal lifecycle states',
  autonomousLoop.includes('private readRecoverySubgoals(taskId: string): RecoverySubgoalRecord[]') &&
    autonomousLoop.includes('private upsertRecoverySubgoals(') &&
    autonomousLoop.includes('private finishRecoverySubgoals(') &&
    autonomousLoop.includes('const subgoalId = `${taskId}:impasse:${encodeURIComponent(reason)}`;') &&
    autonomousLoop.includes("const key = status === 'RESOLVED' ? 'evidence-recovery-resolved' : 'evidence-recovery-failed';") &&
    autonomousLoop.includes("type RecoverySubgoalStatus = 'WAITING_FOR_EVIDENCE' | 'RESOLVED' | 'FAILED';") &&
    autonomousLoop.includes("this.finishRecoverySubgoals(\n            workflow.task.taskId,") &&
    autonomousLoop.includes("this.finishRecoverySubgoals(request.taskId, 'FAILED', reason);")
);

check(
  'Recovery index row declarations precede the index-count assertion in this verifier',
  (() => {
    const indexRowsRegionStart = verifierSource.lastIndexOf('const appIndexRow =');
    const assertionPosition = verifierSource.lastIndexOf("'Canonical index counts match the modified autonomous recovery sources'");
    const declarations = [
      'const autonomousLoopIndexRow =',
      'const preflightIndexRow =',
      'const requiredAssetIndexRow =',
      'const missingAssetSynthesisIndexRow =',
    ].map(marker => verifierSource.lastIndexOf(marker));
    return indexRowsRegionStart >= 0 && assertionPosition >= 0 &&
      declarations.every(position => position > indexRowsRegionStart && position < assertionPosition);
  })()
);

check(
  'Router does not maintain a second unused diagnostic classifier',
  !domainRouter.includes('const diagnostic=resultClass===')
);

const designRevisionHeader = design.slice(0, 500).match(/^正本Revision：(\d{4}-\d{2}-\d{2}-P\d+)$/m);
check(
  'Canonical design doc preserves P222 history and current revision metadata',
  design.includes('# P222 Android Native Runner同期漏れ・CORE再開例外・Sudachi辞書Anchor・外部送信サニタイズ修正') &&
    design.includes('# P223 Android Kotlin reject型修正・Web検索サニタイズ経路の修復') &&
    design.includes('# P225 CORE契約分類統一・自律改善Task種別衝突・再開修正') &&
    Boolean(designRevisionHeader)
);

const appIndexRow = design.split(/\r?\n/).find(line => line.startsWith('- [USED] UI | src/App.tsx |'));
const chatPanelIndexRow = design.split(/\r?\n/).find(line => line.startsWith('- [USED] UI | src/components/ChatPanel.tsx |'));
const loggerIndexRow = design.split(/\r?\n/).find(line => line.startsWith('- [USED] LEGACY_OR_SHARED | src/services/systemLogger.ts |'));
const autonomousLoopIndexRow = design.split(/\r?\n/).find(line => line.startsWith('- [USED] CORE | src/miki/core/services/autonomousSelfImprovementLoopService.ts |'));
const preflightIndexRow = design.split(/\r?\n/).find(line => line.startsWith('- [USED] CORE | src/miki/core/services/selfImprovementPreflightService.ts |'));
const requiredAssetIndexRow = design.split(/\r?\n/).find(line => line.startsWith('- [USED] CORE | src/miki/core/services/requiredAssetAcquisitionService.ts |'));
const missingAssetSynthesisIndexRow = design.split(/\r?\n/).find(line => line.startsWith('- [USED] CORE | src/miki/core/services/missingAssetSynthesisService.ts |'));

check(
  'Canonical index counts match the modified autonomous recovery sources',
  autonomousLoopIndexRow?.includes(`lines=${autonomousLoop.split(/\r?\n/).length - 1}`) &&
    preflightIndexRow?.includes(`lines=${preflightService.split(/\r?\n/).length - 1}`) &&
    requiredAssetIndexRow?.includes(`lines=${requiredAssetAcquisition.split(/\r?\n/).length - 1}`) &&
    missingAssetSynthesisIndexRow?.includes(`lines=${missingAssetSynthesis.split(/\r?\n/).length - 1}`)
);

check(
  'Mobile viewport does not mount a hidden duplicate desktop ChatPanel',
  app.includes("window.matchMedia('(min-width: 768px)'") &&
    app.includes('{isDesktopViewport && (') &&
    app.includes("mobileTab === 'chat' &&")
);
check(
  'ChatPanel does not rerun automatic verification for completed history',
  chatPanel.includes('initialHistoryMessageIdsRef') &&
    chatPanel.includes('new Set(messages.filter((message) => !message.isStreaming).map((message) => message.id))') &&
    chatPanel.includes('!initialHistoryMessageIdsRef.current?.has(m.id)')
);
check(
  'New message verification is deduplicated and serialized',
  chatPanel.includes('verificationStartedMessageIdsRef.current.has(msg.id)') &&
    chatPanel.includes('verificationStartedMessageIdsRef.current.add(msg.id)') &&
    chatPanel.includes('verificationQueueRef.current = verificationQueueRef.current.then(async () =>')
);
check(
  'Conversation history first render is bounded and older messages remain loadable',
  chatPanel.includes('const [visibleMessageCount, setVisibleMessageCount] = useState(20)') &&
    chatPanel.includes('const visibleMessages = messages.slice(-visibleMessageCount)') &&
    chatPanel.includes('visibleMessages.map((msg) => {') &&
    chatPanel.includes('current + 20') &&
    !chatPanel.includes('{messages.map((msg) => {')
);
check(
  'CORE 18 tracking is collapsed by default and keeps the status and detail fields',
  (() => {
    const trackingStart = chatPanel.indexOf('{/* CORE 18構成 追跡 (実データ: STEP 10) */}');
    const trackingEnd = chatPanel.indexOf('{/* 会話パイプライン 詳細展開パネル */}', trackingStart);
    const trackingBlock = trackingStart >= 0 && trackingEnd > trackingStart
      ? chatPanel.slice(trackingStart, trackingEnd)
      : '';
    return trackingBlock.includes('<details className="group mt-3 overflow-hidden rounded-xl border border-indigo-500/40 bg-slate-950/90 text-xs shadow-sm">') &&
      trackingBlock.includes('<summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400">') &&
      trackingBlock.includes('詳細を表示 ▾') &&
      trackingBlock.includes("msg.coreTracking.status === 'processing'") &&
      trackingBlock.includes('msg.coreTracking.requestId') &&
      trackingBlock.includes('msg.coreTracking.route') &&
      trackingBlock.includes('msg.coreTracking.processedCategories') &&
      trackingBlock.includes('msg.coreTracking.updatedAt') &&
      trackingBlock.includes('</summary>') &&
      trackingBlock.includes('</details>') &&
      !trackingBlock.includes('<details open');
  })()
);
check(
  'Chat UI writes content-free lifecycle diagnostics',
  chatPanel.includes("'[CHAT_UI] panel mounted'") &&
    chatPanel.includes("'[CHAT_UI] code verification begin'") &&
    chatPanel.includes("'[CHAT_UI] code verification complete'") &&
    chatPanel.includes("'[CHAT_UI] code verification failed'")
);
check(
  'Canonical index line counts match edited runtime diagnostic source files',
  appIndexRow?.includes(`lines=${app.split(/\r?\n/).length - 1}`) &&
    chatPanelIndexRow?.includes(`lines=${chatPanel.split(/\r?\n/).length - 1}`) &&
    loggerIndexRow?.includes(`lines=${runtimeLogger.split(/\r?\n/).length - 1}`)
);
const currentRevisionNumber = Number(designRevisionHeader?.[1].match(/-P(\d+)$/)?.[1] ?? 0);
const inventoryCaveat = design.match(/完全再帰インベントリの最終基準:[^\n]*（以下の件数は当該基準時点。([^）]+)）/)?.[1] ?? '';
const expectedInventoryRevisionList = Array.from(
  { length: Math.max(0, currentRevisionNumber - 224) },
  (_, index) => `P${225 + index}`
).join('/');
check(
  'P231 breadcrumbs remain verifiable under the current design revision',
  currentRevisionNumber >= 231 &&
    design.includes('# P230 会話タブ初回描画の重複マウント・履歴自動検証バースト抑制') &&
    design.includes('# P231 同期Runtime Breadcrumb記録と次回起動時の回収') &&
    design.includes('Runtime Breadcrumb Journal') &&
    inventoryCaveat.includes(expectedInventoryRevisionList) &&
    inventoryCaveat.includes('対象ファイル変更後に全ファイル件数を再集計したものではない')
);

check(
  'Runtime breadcrumb journal is synchronous, bounded, and replayed on the next session',
  runtimeLogger.includes("const RUNTIME_BREADCRUMB_STORAGE_KEY = 'miki_runtime_breadcrumb_journal_v1'") &&
    runtimeLogger.includes('const MAX_RUNTIME_BREADCRUMBS = 64') &&
    runtimeLogger.includes('const RUNTIME_BREADCRUMB_EVENTS = new Set([') &&
    runtimeLogger.includes('const RUNTIME_BREADCRUMB_DETAIL_KEYS = new Set([') &&
    runtimeLogger.includes('RUNTIME_BREADCRUMB_DETAIL_KEYS.has(key)') &&
    runtimeLogger.includes('pairs.length <= 12') &&
    runtimeLogger.includes('public recordRuntimeBreadcrumb(event: string') &&
    runtimeLogger.includes("this.recordRuntimeBreadcrumb('JS_ENTRY')") &&
    runtimeLogger.includes('window.localStorage.setItem(') &&
    runtimeLogger.includes('entry.sessionId !== this.runtimeBreadcrumbSessionId') &&
    runtimeLogger.includes('RUNTIME_BREADCRUMB_RECOVERED') &&
    runtimeLogger.includes('sessionId=${entry.sessionId}') &&
    runtimeLogger.includes('replayPreviousRuntimeBreadcrumbs')
);
check(
  'Runtime initialization checkpoints include current and last completed stages',
  runtimeLifecycle.includes("recordRuntimeBreadcrumb('RUNTIME_STAGE_BEGIN'") &&
    runtimeLifecycle.includes("recordRuntimeBreadcrumb('RUNTIME_STAGE_COMPLETE'") &&
    runtimeLifecycle.includes("recordRuntimeBreadcrumb('RUNTIME_STAGE_FAILED'") &&
    runtimeLifecycle.includes('lastCompletedStage') &&
    runtimeLifecycle.includes("nextStage: stages[stageIndex + 1]?.name || 'NONE'")
);
check(
  'Domain audit checkpoints include current step and previous/next operation',
  domainParticipation.includes("recordRuntimeBreadcrumb('DOMAIN_AUDIT_OPERATION_BEGIN'") &&
    domainParticipation.includes("recordRuntimeBreadcrumb('DOMAIN_AUDIT_OPERATION_COMPLETE'") &&
    domainParticipation.includes("recordRuntimeBreadcrumb('DOMAIN_AUDIT_OPERATION_FAILED'") &&
    domainParticipation.includes('lastCompletedOperation') &&
    domainParticipation.includes('completedCount: completedOperations') &&
    domainParticipation.includes('nextDomain') && domainParticipation.includes('nextStep')
);
check(
  'Progress breadcrumbs are coalesced per stream while previous-session evidence is retained',
  runtimeLogger.includes('RUNTIME_BREADCRUMB_PROGRESS_STREAM') &&
    runtimeLogger.includes('existing.sessionId !== this.runtimeBreadcrumbSessionId') &&
    runtimeLogger.includes('RUNTIME_BREADCRUMB_PROGRESS_STREAM[existing.event] !== stream') &&
    runtimeLogger.includes('MAX_RUNTIME_BREADCRUMBS = 64')
);

check(
  'Native WebView renderer termination and Activity lifecycle are journaled without URLs or page content',
  main.includes('addWebViewListener') &&
    main.includes('onRenderProcessGone') &&
    main.includes('WEBVIEW_RENDER_PROCESS_GONE') &&
    main.includes('ACTIVITY_CREATE') &&
    main.includes('return false;') &&
    nativeJournal.includes('MAX_PENDING_BYTES') &&
    nativeJournal.includes('output.getFD().sync()') &&
    !main.includes('webView.getUrl()')
);
check(
  'Native WebView journal is flushed to Downloads before JS breadcrumb replay',
  runner.includes('fun flushNativeWebViewDiagnostics') &&
    runner.includes('NativeWebViewDiagnosticJournal.readPending(context)') &&
    runner.includes('NativeWebViewDiagnosticJournal.clearPending(context)') &&
    runtimeLogger.includes('flushNativeWebViewDiagnostics') &&
    runtimeLogger.includes('await this.runtimeLogFilePlugin.flushNativeWebViewDiagnostics')
);
check(
  'Root, visibility, pagehide, beforeunload, and global JS errors use breadcrumbs',
  mainEntry.includes("recordRuntimeBreadcrumb('APP_ROOT_RENDER_SUBMITTED'") &&
    mainEntry.includes("recordRuntimeBreadcrumb('APP_VISIBILITY_HIDDEN'") &&
    mainEntry.includes("recordRuntimeBreadcrumb('APP_PAGEHIDE'") &&
    mainEntry.includes("recordRuntimeBreadcrumb('APP_BEFORE_UNLOAD'") &&
    mainEntry.includes("recordRuntimeBreadcrumb('WINDOW_ERROR'") &&
    mainEntry.includes("recordRuntimeBreadcrumb('WINDOW_UNHANDLED_REJECTION'")
);
check(
  'Mobile tab taps and committed tab state are journaled independently of ChatPanel',
  app.includes("recordRuntimeBreadcrumb('UI_NAV_TAP'") &&
    app.includes("recordRuntimeBreadcrumb('UI_NAV_STATE_COMMITTED'") &&
    app.includes("recordRuntimeBreadcrumb('APP_COMPONENT_MOUNT'") &&
    app.includes("recordRuntimeBreadcrumb('APP_COMPONENT_UNMOUNT'")
);
check(
  'ChatPanel mount/unmount is journaled without conversation text',
  chatPanel.includes("recordRuntimeBreadcrumb('CHAT_PANEL_MOUNT_EFFECT'") &&
    chatPanel.includes("recordRuntimeBreadcrumb('CHAT_PANEL_UNMOUNT_EFFECT'")
);
check(
  'Breadcrumb recovery scan records whether previous-session entries were available',
  runtimeLogger.includes("'[RUNTIME_BREADCRUMB] recovery scan'") &&
    runtimeLogger.includes('previousSessionEntryCount') &&
    runtimeLogger.includes('previousEventTypes')
);

const providerCallIndex = main.indexOf('recordWebViewProviderInfo();');
const superCreateIndex = main.indexOf('super.onCreate(savedInstanceState);');
const activityCreateIndex = main.indexOf('NativeWebViewDiagnosticJournal.record(this, "ACTIVITY_CREATE"');
check(
  'WebView provider package/version is journaled after Activity framework initialization',
  providerCallIndex > superCreateIndex &&
    providerCallIndex > activityCreateIndex &&
    main.includes('WebView.getCurrentWebViewPackage()') &&
    main.includes('"WEBVIEW_PROVIDER_INFO"') &&
    nativeJournal.includes('"WEBVIEW_PROVIDER_INFO"')
);
const sequentialPhaseMarkers = [
  "checkpoint('ORDER_LOOKUP_BEGIN', 'STARTED')",
  'order = resolvedOrder;',
  "checkpoint('ORDER_LOOKUP_COMPLETE', 'COMPLETED')",
  "checkpoint('INBOUND_RECORD_BEGIN', 'STARTED')",
  "crossDomainCirculationService.record('core', domain, `SEQUENTIAL_CONNECTION_IN_${index + 1}`, evidenceId);",
  "checkpoint('INBOUND_RECORD_COMPLETE', 'COMPLETED')",
  "checkpoint('RETURN_RECORD_BEGIN', 'STARTED')",
  "crossDomainCirculationService.record(domain, 'core', `SEQUENTIAL_CONNECTION_RETURN_${index + 1}`, evidenceId);",
  "checkpoint('RETURN_RECORD_COMPLETE', 'COMPLETED')",
  "checkpoint('VERIFY_COMPLETE', 'COMPLETED')",
];
const sequentialPhasePositions = sequentialPhaseMarkers.map((marker) => domainSequentialConnection.indexOf(marker));
check(
  'Sequential connection lookup and inbound/return mutations have ordered checkpoints',
  sequentialPhasePositions.every((position, index) =>
    position >= 0 && (index === 0 || position > sequentialPhasePositions[index - 1])
  ) &&
    domainSequentialConnection.includes("checkpoint('FAILED', 'FAILED'") &&
    runtimeLogger.includes("'DOMAIN_CONNECTION_CHECKPOINT'") &&
    runtimeLogger.includes("DOMAIN_CONNECTION_CHECKPOINT: 'DOMAIN_CONNECTION'") &&
    runtimeLogger.includes("'correlationId'") &&
    runtimeLogger.includes("'phase'")
);

check(
  'Previous Android process exit reasons are collected after Activity creation and before provider diagnostics',
  main.includes('NativeWebViewDiagnosticJournal.recordPreviousProcessExitReasons(this);') &&
    main.indexOf('NativeWebViewDiagnosticJournal.recordPreviousProcessExitReasons(this);') > activityCreateIndex &&
    main.indexOf('NativeWebViewDiagnosticJournal.recordPreviousProcessExitReasons(this);') < providerCallIndex
);
check(
  'Historical process exit records are durable, de-duplicated, and omit free-form system descriptions',
  nativeJournal.includes('getHistoricalProcessExitReasons(context.getPackageName(), 0, 5)') &&
    nativeJournal.includes('ApplicationExitInfo') &&
    nativeJournal.includes('LAST_EXIT_TIMESTAMP_KEY') &&
    nativeJournal.includes('"PROCESS_EXIT_HISTORY"') &&
    nativeJournal.includes('"PROCESS_EXIT_HISTORY_SCAN"') &&
    nativeJournal.includes('getTimestamp()') &&
    nativeJournal.includes('getReason()') &&
    !nativeJournal.includes('getSubReason()') &&
    nativeJournal.includes('if (safeDetails.length() > 220) safeDetails = safeDetails.substring(0, 220);') &&
    nativeJournal.includes('getPss()') &&
    nativeJournal.includes('getRss()') &&
    nativeJournal.includes('SystemClock.elapsedRealtime()') &&
    nativeJournal.includes('processPid=') &&
    nativeJournal.includes('.commit()') &&
    !nativeJournal.includes('getDescription()')
);

check(
  'Exit-reason diagnostics use public Android API fields and retain full bounded details',
  nativeJournal.includes('info.getReason()') &&
    nativeJournal.includes('info.getStatus()') &&
    nativeJournal.includes('info.getImportance()') &&
    nativeJournal.includes('info.getPss()') &&
    nativeJournal.includes('info.getRss()') &&
    nativeJournal.includes('case 17: return "MEMORY_LIMITER";') &&
    nativeJournal.includes('case 18: return "ANOMALY";') &&
    !nativeJournal.includes('getSubReason()')
);

check(
  'Uncaught Java/Kotlin exceptions are durably journaled before delegating to the original handler',
  main.includes('NativeWebViewDiagnosticJournal.installUncaughtExceptionHandler(getApplicationContext());') &&
    nativeJournal.includes('Thread.setDefaultUncaughtExceptionHandler') &&
    nativeJournal.includes('"UNCAUGHT_EXCEPTION"') &&
    nativeJournal.includes('previousHandler.uncaughtException(thread, error)') &&
    nativeJournal.includes('frameCount=') &&
    nativeJournal.includes('output.getFD().sync()') &&
    !nativeJournal.includes('error.getMessage()')
);

check(
  'Historical exit traces are bounded, hashed, and reduced to selected Java frame names',
  nativeJournal.includes('getTraceInputStream()') &&
    nativeJournal.includes('PROCESS_EXIT_TRACE_SUMMARY') &&
    nativeJournal.includes('PROCESS_EXIT_TRACE_FRAME') &&
    nativeJournal.includes('MAX_EXIT_TRACE_SAMPLE_BYTES') &&
    nativeJournal.includes('sampleSha256=') &&
    nativeJournal.includes('extractTraceFrames') &&
    nativeJournal.includes('isLikelyTextTrace') &&
    !nativeJournal.includes('getDescription()') &&
    !nativeJournal.includes('readAllBytes()')
);

const storageIndexRow = design.split(/\r?\n/).find(line => line.startsWith('- [USED] LEGACY_OR_SHARED | src/services/storageService.ts |'));
const seedIndexRow = design.split(/\r?\n/).find(line => line.startsWith('- [USED] CORE | src/miki/core/services/selfCodeSpaceService.ts |'));
const routerIndexRow = design.split(/\r?\n/).find(line => line.startsWith('- [USED] CORE | src/miki/core/services/domainRouterService.ts |'));
const nativeJournalIndexRow = design.split(/\r?\n/).find(line => line.startsWith('- [NATIVE_SOURCE] ANDROID_NATIVE | android/app/src/main/java/com/miki/ai/NativeWebViewDiagnosticJournal.java |'));
check(
  'Android native memory sampler records bounded Java/native/OS memory checkpoints',
  nativeJournal.includes('"MEMORY_SAMPLE"') &&
    nativeJournal.includes('Debug.getPss()') &&
    nativeJournal.includes('javaUsedKB=') &&
    nativeJournal.includes('MEMORY_SAMPLE_FAST_WINDOW_MS') &&
    nativeJournal.includes('scheduleMemorySample(appContext, 0L)')
);
check(
  'Runtime JS heap measurements reach the existing log queue and remain bounded',
  runtimeLogger.includes("this.recordRuntimeDiagnostic('RUNTIME_MEMORY_SAMPLE'") &&
    runtimeLogger.includes('this.queueRuntimeLogFile({') &&
    runtimeLogger.includes("RUNTIME_MEMORY_SAMPLE: 'RUNTIME_MEMORY'") &&
    runtimeLogger.includes('state.samples = [...state.samples, sample].slice(-120)')
);
check(
  'Storage checkpoints record sizes/timing without raw keys or values',
  oomStorageSource.includes("new CustomEvent('miki-storage-diagnostic'") &&
    oomStorageSource.includes('totalValueChars') &&
    oomStorageSource.includes('maxValueChars') &&
    oomStorageSource.includes('diagnosticKeyClass') &&
    runtimeLogger.includes("window.addEventListener('miki-storage-diagnostic'")
);
check(
  'Seed checkpoints cover fetch/decompression/verification/apply/flush/fallback',
  oomSeedSource.includes("recordRuntimeDiagnostic('SELF_CODE_SEED_CHECKPOINT'") &&
    oomSeedSource.includes("checkpoint('ZIP_FETCHED'") &&
    oomSeedSource.includes("checkpoint('VERIFY_PROGRESS'") &&
    oomSeedSource.includes("checkpoint('APPLY_BEGIN'") &&
    oomSeedSource.includes("checkpoint('GITHUB_FALLBACK_FAILED'") &&
    oomSeedSource.includes('totalContentChars') &&
    oomSeedSource.includes('maxFileChars')
);
check(
  'Domain router serialization checkpoints measure bounded segment batches',
  domainRouter.includes("recordRuntimeDiagnostic('DOMAIN_ROUTER_CHECKPOINT'") &&
    domainRouter.includes("phase:'SERIALIZE_BEGIN'") &&
    domainRouter.includes("phase:'SERIALIZE_COMPLETE'") &&
    domainRouter.includes('serializedChars') &&
    domainRouter.includes('serializationElapsedMs') &&
    domainRouter.includes('HISTORY_SEGMENT_MAX_CHARS') &&
    domainRouter.includes('HISTORY_SEGMENT_MAX_ENTRIES') &&
    !domainRouter.includes('JSON.stringify(this.history)')
);
check(
  'Startup imports App only after storage hydration completes',
  mainEntry.includes('void storageService.ready') &&
    mainEntry.includes('Persistent storage ready') &&
    !mainEntry.includes('nonBlockingStartupP156Service.awaitWithoutBlocking(storageService.ready)')
);
check(
  'Storage hydration preserves writes made before readiness and defers non-durable flushes',
  oomStorageSource.includes('this.dirtyKeys.has(row.key)') &&
    oomStorageSource.includes('if (!this.dirtyKeys.has(key)) this.cache.set(key, cursor.value as string)') &&
    oomStorageSource.includes('const persistentBackendReady =') &&
    oomStorageSource.includes("emitFlushDiagnostic('DEFERRED'")
);

check(
  'Canonical index counts match all sources modified for memory diagnostics',
  storageIndexRow?.includes(`lines=${oomStorageSource.split(/\r?\n/).length - 1}`) &&
    seedIndexRow?.includes(`lines=${oomSeedSource.split(/\r?\n/).length - 1}`) &&
    routerIndexRow?.includes(`lines=${domainRouter.split(/\r?\n/).length - 1}`) &&
    loggerIndexRow?.includes(`lines=${runtimeLogger.split(/\r?\n/).length - 1}`) &&
    nativeJournalIndexRow?.includes(`lines=${nativeJournal.split(/\r?\n/).length - 1}`)
);

check('Large SQLite values use bounded native bridge reads and chunk writes',
  oomStorageSource.includes('SQLITE_CHUNK_PREFIX') && oomStorageSource.includes('persistSqliteValue') &&
    oomStorageSource.includes('SELECT substr(value, ?, ?) AS part') && oomStorageSource.includes('sqliteChunkGenerations'));
check('Oversized diagnostic history is not parsed into a second object graph',
  runtimeLogger.includes('MAX_PERSISTED_LOG_CHARS') && runtimeLogger.includes('saved.length <= MAX_PERSISTED_LOG_CHARS') &&
    runtimeLogger.includes('boundedLogDetails') && runtimeLogger.includes('MAX_LOG_DETAIL_CHARS'));
check(
  'Domain router archives full event records in bounded segments and migrates legacy history safely',
  domainRouter.includes('pendingHistoryRecords:DomainHistoryEntry[]') &&
    domainRouter.includes('this.pendingHistoryRecords.push(entry)') &&
    domainRouter.includes('storageService.setItem(HISTORY_INDEX_KEY') &&
    domainRouter.includes('migrateLegacyHistory') &&
    domainRouter.includes('await storageService.flushNow()') &&
    domainRouter.includes('HISTORY_SEGMENT_PREFIX') &&
    domainRouter.includes('MAX_HISTORY=2000')
);

check('Android requests a larger Java heap without capping functional data', appManifest.includes('android:largeHeap="true"') && design.includes('操作性・応答性') && design.includes('機能データを削減'));
check('APK boot log identifies its source commit', apkWorkflow.includes('VITE_MIKI_BUILD_REVISION: ${{ github.sha }}') && mainEntry.includes('VITE_MIKI_BUILD_REVISION') && mainEntry.includes('buildRevision'));


const autonomousRevalidationIndexRow = design.split(/\r?\n/).find(
  line => line.startsWith('- [USED] autonomy | src/miki/autonomy/services/autonomousRevalidationLoopService.ts |')
);
const domainBootstrapIndexRow = design.split(/\r?\n/).find(
  line => line.startsWith('- [USED] CORE | src/miki/core/services/domainIntegrationBootstrapService.ts |')
);

check(
  'Autonomous Knowledge Gaps dispatch through bounded CORE Tasks with backoff',
  autonomousRevalidationLoop.includes('knowledgeGapService.listOpen(500)') &&
    autonomousRevalidationLoop.includes('coreTaskIngressService.submit({') &&
    autonomousRevalidationLoop.includes('autonomousKnowledgeGapId: gap.id') &&
    autonomousRevalidationLoop.includes('const maxGapTasksPerRun = limit >= 6 ? 3 : 1') &&
    autonomousRevalidationLoop.includes('15 * 60 * 1000 * (2 ** exponent)') &&
    autonomousRevalidationLoop.includes('coreTaskIngressService.resume(') &&
    !autonomousRevalidationLoop.includes('researchService.researchGap(')
);
check(
  'Knowledge Gap resolution requires verifier success for every claim',
  domainIntegrationBootstrap.includes('if (verified && researchGapId)') &&
    domainIntegrationBootstrap.includes("knowledgeGapService.advanceResolutionPlan(researchGapId, 'RESOLVE')") &&
    domainIntegrationBootstrap.includes('knowledgeGapService.markResolved(researchGapId)') &&
    domainIntegrationBootstrap.includes('knowledgeGapResolved')
);
check(
  'Web Claims aggregate only exact normalized statements and verify fetched-page support conservatively',
  researchPipelineSource.includes('const claimIdByNormalizedStatement = new Map<string, string>();') &&
    /this\.linkResearchEvidenceToClaim\(\s*record\.evidence_id,\s*statement,\s*claimIdByNormalizedStatement,\s*!isCounterEvidencePass,\s*\)/.test(researchPipelineSource) &&
    researchPipelineSource.includes('normalizedPageContent.includes(normalizedPageStatement)') &&
    researchPipelineSource.includes('claimIds: [pageClaimId]') &&
    researchPipelineSource.includes('learnedTermComponentClaims')
);
check(
  'Page term learning uses the preceding accepted-evidence guard without a redundant rejected-status comparison',
  researchPipelineSource.includes("if (pageEvidence.status === 'REJECTED') continue;") &&
    researchPipelineSource.includes('if (pageClaimId) {') &&
    !researchPipelineSource.includes("if (pageClaimId && pageEvidence.status !== 'REJECTED')")
);
check(
  'Web page content creates structured, provenance-linked candidate knowledge',
  researchPipelineSource.includes('webContentUnderstandingService.learnPage') &&
    researchPipelineSource.includes('learnedSemanticComponentClaims') &&
    webContentUnderstandingSource.includes('export function extractWebSemanticUnits') &&
    webContentUnderstandingSource.includes('sourceFragmentSha256') &&
    webContentUnderstandingSource.includes("verificationStatus: 'UNVERIFIED'") &&
    webContentUnderstandingSource.includes('researchGraphConnectorP211Service.connect') &&
    webContentUnderstandingSource.includes('requiresVerification: true')
);
check(
  'Web semantic candidates are verified separately from Knowledge Gap-wide resolution',
  legacyConversationCoreSource.includes('research.semanticVerification = semanticVerification;') &&
    currentConversationCoreSource.includes('research.semanticVerification = semanticVerification;') &&
    legacyConversationCoreSource.includes('research.learnedSemanticComponentClaims') &&
    currentConversationCoreSource.includes('research.learnedSemanticComponentClaims')
);
check(
  'Web semantic service source index line count matches the current implementation',
  webContentUnderstandingIndexRow?.includes(`lines=${webContentUnderstandingSource.split(/\r?\n/).length - 1}`)
);
check(
  'Counterevidence is excluded from affirmative Claim promotion',
  claimVerifierSource.includes("e.metadata?.research_source_role !== 'COUNTEREVIDENCE'") &&
    researchPipelineSource.includes('!isCounterEvidencePass')
);
check(
  'Normal CORE conversation paths explicitly verify web Claims before reusable promotion',
  legacyConversationCoreSource.includes('verifierService.verifyMany({') &&
    currentConversationCoreSource.includes('verifierService.verifyMany({') &&
    legacyConversationCoreSource.includes('research.verification = verification;') &&
    currentConversationCoreSource.includes('research.verification = verification;') &&
    legacyConversationCoreSource.includes('reusableComponentFactoryService.verifyResearchKnowledge(') &&
    currentConversationCoreSource.includes('reusableComponentFactoryService.verifyResearchKnowledge(') &&
    legacyConversationCoreSource.includes("knowledgeGapService.advanceResolutionPlan(gap.id, 'RESOLVE')") &&
    currentConversationCoreSource.includes("knowledgeGapService.advanceResolutionPlan(gap.id, 'RESOLVE')")
);
check(
  'Research Claim/CORE source index line counts match the current implementation',
  researchServiceIndexRow?.includes(`lines=${researchPipelineSource.split(/\r?\n/).length - 1}`) &&
    claimVerifierIndexRow?.includes(`lines=${claimVerifierSource.split(/\r?\n/).length - 1}`) &&
    legacyConversationCoreIndexRow?.includes(`lines=${legacyConversationCoreSource.split(/\r?\n/).length - 1}`) &&
    currentConversationCoreIndexRow?.includes(`lines=${currentConversationCoreSource.split(/\r?\n/).length - 1}`)
);
check(
  'Canonical index counts match both changed CORE sources',
  autonomousRevalidationIndexRow?.includes(`lines=${autonomousRevalidationLoop.split(/\r?\n/).length - 1}`) &&
    domainBootstrapIndexRow?.includes(`lines=${domainIntegrationBootstrap.split(/\r?\n/).length - 1}`)
);
check(
  'CORE task verification requires an explicit successful result and no unresolved errors',
  taskIngress.includes('const verified=isVerifiedTaskOutcome(task);') &&
    taskBlackboard.includes('export function isVerifiedTaskOutcome') &&
    taskBlackboard.includes('unresolvedTaskErrors(task).length>0') &&
    taskBlackboard.includes('value.passed===false') &&
    taskBlackboard.includes("entry.evidenceIds.length===0")
);
check(
  'Work-instruction exceptions are returned and recorded as PROMOTION_FAILED',
  developmentReviewLifecycle.includes('private async startInternal(') &&
    developmentReviewLifecycle.includes('DEVELOPMENT_START_EXCEPTION:') &&
    developmentReviewLifecycle.includes("state:'PROMOTION_FAILED'") &&
    developmentReviewLifecycle.includes('failureAt:Date.now()') &&
    developmentReviewLifecycle.includes('DEVELOPMENT_FAILURE_STATE_NOT_PERSISTED')
);
check(
  'Corrupt work-instruction state is quarantined before reset and saves require readback',
  developmentReviewLifecycle.includes('quarantineCorruptRaw(raw)') &&
    developmentReviewLifecycle.includes('DEVELOPMENT_REQUEST_STORE_QUARANTINE_FAILED') &&
    developmentReviewLifecycle.includes('DEVELOPMENT_REQUEST_STORE_RESET_FAILED') &&
    developmentReviewLifecycle.includes('DEVELOPMENT_REQUEST_STORE_READBACK_MISMATCH')
);
check(
  'Failed work instructions can enter the REQUEST_CHANGES recovery path without approving them',
  developmentLifecycleStateMachine.includes("request.state === 'PROMOTION_FAILED' && decision === 'REQUEST_CHANGES'") &&
    developmentLifecycleStateMachine.includes("PROMOTION_FAILED: ['REVISION_REQUESTED']") &&
    developmentLifecycleStateMachine.includes("decision !== 'ACCEPT'")
);
check(
  'Task and work-instruction source index line counts match the current files',
  taskBlackboardIndexRow?.includes(`lines=${taskBlackboard.split(/\r?\n/).length - 1}`) &&
    taskIngressIndexRow?.includes(`lines=${taskIngress.split(/\r?\n/).length - 1}`) &&
    developmentReviewLifecycleIndexRow?.includes(`lines=${developmentReviewLifecycle.split(/\r?\n/).length - 1}`) &&
    developmentStateMachineIndexRow?.includes(`lines=${developmentLifecycleStateMachine.split(/\r?\n/).length - 1}`) &&
    developmentRequestModelIndexRow?.includes(`lines=${read('src/miki/selfDevelopment/services/unifiedDevelopmentRequestModel.ts').split(/\r?\n/).length - 1}`)
);

const canonicalHeaderRevision = design.match(/^正本Revision：(\d{4}-\d{2}-\d{2}-P\d+)$/m)?.[1];
const canonicalCurrentRevision = design.match(/^- 現行Revision: (\d{4}-\d{2}-\d{2}-P\d+)$/m)?.[1];
check(
  'Canonical design revisions stay synchronized and retain P273/P274/P279 history',
  Boolean(canonicalHeaderRevision && canonicalHeaderRevision === canonicalCurrentRevision) &&
    design.includes('2026-10-16-P273 反実仮想スコアの実測境界修正') &&
    design.includes('2026-10-16-P274 実行イベント由来の反実仮想測定と独立レビュー') &&
    design.includes('2026-10-17-P276 自己台帳グラフ編集レイヤー') &&
    design.includes('2026-10-18-P277 認知状態の継続性・自律実行接続') &&
    design.includes('2026-10-18-P278 自律実行完了Receipt・Checkpoint復元境界') &&
    design.includes('2026-10-18-P279 自律実行Receipt相関・アウトボックス・Checkpoint自己検証')
);
check(
  'Shared policy blocks protected runtime, privacy bypass, disabled guardrail, and local LLM route',
  counterfactualPolicy.includes('auditCounterfactualScenario') &&
    counterfactualPolicy.includes('PROTECTED_RUNTIME_MUTATION') &&
    counterfactualPolicy.includes('PRIVACY_BYPASS_INTENT') &&
    counterfactualPolicy.includes('PRIVACY_GUARDRAIL_DISABLED') &&
    counterfactualPolicy.includes('PRIVACY_AUDIT_UNAVAILABLE') &&
    counterfactualPolicy.includes('LOCAL_LLM_PRIMARY_PATH_PROHIBITED')
);
check(
  'Measured decisions require actual paired execution events and a distinct review runner event',
  counterfactualPolicy.includes('MIN_PAIRED_TESTS_PER_METRIC = 3') &&
    counterfactualPolicy.includes('executionEventBusService.list()') &&
    counterfactualPolicy.includes('FACTUAL_ALTERNATIVE_TEST_CASES_NOT_PAIRED') &&
    counterfactualPolicy.includes('MEASUREMENT_BUILD_ENVIRONMENT_OR_COMPONENT_MISMATCH') &&
    counterfactualPolicy.includes('INDEPENDENT_REVIEW_EVENT_INVALID_OR_NOT_INDEPENDENT') &&
    counterfactualPolicy.includes('counterfactual_reviewed_event_ids') &&
    counterfactualPolicy.includes('baselineMedianLatencyMs') &&
    !counterfactualPolicy.includes('factualBenchmark = 80')
);
check(
  'Execution runner validates tags and derives terminal pass state from assertion',
  executionRunner.includes('validateCounterfactualRunnerTag(') &&
    executionRunner.includes('counterfactual_measurement?: CounterfactualExecutionTag') &&
    executionRunner.includes('counterfactualReviewDecision') &&
    executionRunner.includes("type: assertion.status === 'PASS' ? 'execution.completed' : 'execution.failed'") &&
    executionRunner.includes('assertion_status: assertion.status') &&
    executionRunner.includes('counterfactualEventMetadata(request.counterfactual_measurement')
);
check(
  'Canonical service and Chapter36 use the same evidence-gated policy',
  counterfactual.includes('chapter36CounterfactualEngine.evaluate(') &&
    counterfactual.includes('measurementEvidenceByScenario?.[s.id]') &&
    counterfactual.includes('aggregateCounterfactualMeasurementStatus(evaluations)') &&
    chapter36.includes('evaluateCounterfactualScenarioPolicy(') &&
    chapter36.includes('measurementEvidenceByScenario?.[s.id]') &&
    chapter36.includes('aggregateCounterfactualMeasurementStatus(evaluations)') &&
    !chapter36.includes('レイテンシが大幅改善する') &&
    !counterfactual.includes('performanceScore += 12') &&
    !counterfactual.includes('accuracyScore += 8')
);
check(
  'Legacy counterfactual module re-exports canonical service without duplicate scoring',
  legacyCounterfactual.includes("from '../miki/unknown/services/counterfactualReasoningService'") &&
    !legacyCounterfactual.includes('performanceScore += 12') &&
    !legacyCounterfactual.includes('factualBenchmark = 80')
);
check(
  'Self-code architect log does not claim an unexecuted counterfactual comparison ran',
  selfCodeArchitect.includes('反実仮想の仮説を記録しました（代替案の実行比較・独立評価は未実施）') &&
    !selfCodeArchitect.includes('反実仮想推論・分岐シミュレーションを実走記録しました')
);
check(
  'Canonical index line counts match changed counterfactual source files',
  counterfactualIndexRow?.includes(`lines=${counterfactual.split(/\r?\n/).length - 1}`) &&
    chapter36IndexRow?.includes(`lines=${chapter36.split(/\r?\n/).length - 1}`) &&
    counterfactualPolicyIndexRow?.includes(`lines=${counterfactualPolicy.split(/\r?\n/).length - 1}`) &&
    executionRunnerIndexRow?.includes(`lines=${executionRunner.split(/\r?\n/).length - 1}`) &&
    legacyCounterfactualIndexRow?.includes(`lines=${legacyCounterfactual.split(/\r?\n/).length - 1}`)
);
check(
  'Rust native build pins the zip dependency and retains deflate support',
  rustManifest.includes('zip = { version = "9.0.3", default-features = false, features = ["deflate"] }')
);
check(
  'Autonomous Issue Discovery synchronizes terminal outcomes and permits three bounded retries',
  issueDiscovery.includes('private reconcileQueuedIssues():void') &&
    issueDiscovery.includes('private releaseForRetry(issue:DiscoveredIssue,outcome:string):void') &&
    issueDiscovery.includes('if(attempts>=4)') &&
    issueDiscovery.includes('nextRetryAt') &&
    issueDiscovery.includes('private isSourceResolved(issue:DiscoveredIssue):boolean') &&
    issueDiscovery.includes('TASK_CANCELLED_NOT_AUTO_RETRIED') &&
    issueDiscovery.includes("case 'EXECUTION_FAILURE':") &&
    issueDiscovery.includes("latestOutcome?.type==='execution.completed'&&latestOutcome.passed===true") &&
    issueDiscovery.includes("crossDomainCirculationService.getDisconnectedDomains().some(domain=>String(domain)===issue.sourceId)")
);
check(
  'Autonomous candidate generation reloads the prepared IntakeRouter plan',
  candidateCodeGeneration.includes('const preparedRun=improvementIntakeRouterService.get(runId);') &&
    candidateCodeGeneration.indexOf('const preparedRun=improvementIntakeRouterService.get(runId);') >
      candidateCodeGeneration.indexOf('const probe=await autonomousCandidatePreparationService.prepareForRun(runId,[]);') &&
    candidateCodeGeneration.includes('const implementationPlan=preparedRun.implementationPlan;') &&
    candidateCodeGeneration.indexOf('const implementationPlan=preparedRun.implementationPlan;') >
      candidateCodeGeneration.indexOf('const preparedRun=improvementIntakeRouterService.get(runId);') &&
    candidateCodeGeneration.includes("if(preparedRun.runType==='AUTONOMOUS_DISCOVERY'&&!implementationPlan)")
);

check(
  'Relevant verified success and failure Task Cases inform bounded autonomous planning',
  taskCaseMemory.includes('findRelevantCases(goal:string, environment?:string, limit=5)') &&
    taskCaseMemory.includes("if(record.outcome==='FAILURE')return true;") &&
    issueDiscovery.includes('findRelevantCases(') &&
    issueDiscovery.includes('priorCases') &&
    candidatePreparation.includes('run.payload.priorCases') &&
    candidatePreparation.includes('既存成功ケース（実装版・環境・根拠を再検証）') &&
    candidatePreparation.includes('過去の観測失敗（一般則ではなく要再検証）') &&
    candidatePreparation.includes('dependencyConstraints') &&
    candidatePreparation.includes('retryPolicy') &&
    candidatePreparation.includes('stopConditions')
);
check(
  'All IntakeRouter plan construction paths use version-2 planning constraints',
  candidatePreparation.includes("return {version:2,source:'AUTONOMOUS_ISSUE'") &&
    improvementIntakeRouter.includes("run.implementationPlan={\n        version:2,\n        source:'REVIEW_REVALIDATION'") &&
    improvementIntakeRouter.includes('executionConstraints:') &&
    improvementIntakeRouter.includes('dependencyConstraints:') &&
    improvementIntakeRouter.includes('retryPolicy:') &&
    improvementIntakeRouter.includes('stopConditions:')
);
check(
  'Canonical index counts match autonomous lifecycle and case-plan source files',
  issueDiscoveryIndexRow?.includes(`lines=${issueDiscovery.split(/\r?\n/).length - 1}`) &&
    taskCaseMemoryIndexRow?.includes(`lines=${taskCaseMemory.split(/\r?\n/).length - 1}`) &&
    candidatePreparationIndexRow?.includes(`lines=${candidatePreparation.split(/\r?\n/).length - 1}`) &&
    improvementIntakeRouterIndexRow?.includes(`lines=${improvementIntakeRouter.split(/\r?\n/).length - 1}`)
);
check(
  'FailureUnderstanding persists Knowledge Gaps without bypassing CORE through direct research or promotion',
  failureUnderstanding.includes('knowledgeGapService.detect') &&
    failureUnderstanding.includes('AutonomousRevalidationLoop') &&
    !failureUnderstanding.includes('researchService.researchGap(') &&
    !failureUnderstanding.includes('verifiedKnowledgePromotionService.promote(') &&
    !failureUnderstanding.includes('researchToRemediationService.process(')
);


check(
  'Idle reflection hypotheses are not promoted to verified training samples',
  autonomousEvolution.includes('promotedToTrainingSample: false') &&
    autonomousEvolution.includes('verifiedEffective: false') &&
    !autonomousEvolution.includes('selfImprovementService.registerCapabilityCandidate(') &&
    !autonomousEvolution.includes("experienceLinkService.linkEntity(experienceId, 'trainingSample'")
);
check(
  'Legacy idle homework stays unresolved without independent verification and CORE evidence routing',
  !autonomousEvolution.includes('workingAgendaService.resolveAgenda(') &&
    !autonomousEvolution.includes('unifiedWebResearchService.executeSearch(') &&
    !autonomousEvolution.includes('自発思考により解決方針を確定')
);
check(
  'Mastery scoring does not fabricate executed drills, pass scores, or capability success',
  autonomousEvolution.includes('totalDrills: 0') &&
    autonomousEvolution.includes('score: 0') &&
    autonomousEvolution.includes('results: []') &&
    !autonomousEvolution.includes('passed: true') &&
    !autonomousEvolution.includes('capabilityGapService.recordSuccess(capId')
);
check(
  'Enqueuing CORE self-improvement is not counted as applied code improvement',
  autonomousEvolution.includes('let selfCodeImprovementRun = 0;') &&
    !autonomousEvolution.includes('selfCodeImprovementRun = 1;')
);
check(
  'Canonical index count matches autonomous evolution source',
  autonomousEvolutionIndexRow?.includes(`lines=${autonomousEvolution.split(/\r?\n/).length - 1}`)
);

check(
  'Capability Ledger separates evidence-backed state and registry-only state',
  capabilityLedger.includes('VERIFIED_EVIDENCE') &&
    capabilityLedger.includes('VERIFIED_REGISTRY_ONLY') &&
    capabilityLedger.includes('REVALIDATION_REQUIRED') &&
    capabilityLedger.includes('IMPLEMENTED_UNVERIFIED') &&
    capabilityLedger.includes('UNASSESSED')
);
check(
  'Capability Ledger does not automatically resolve gaps or promote components',
  capabilityLedger.includes('listOpen(GAP_LIMIT + 1)') &&
    !capabilityLedger.includes('markResolved(') &&
    !capabilityLedger.includes('recordSuccess(') &&
    !capabilityLedger.includes('.promote(')
);
check(
  'CORE self-improvement ingress receives a capability ledger summary',
  capabilityLedgerIngress.includes("request.kind==='SELF_IMPROVEMENT'") &&
    capabilityLedgerIngress.includes('capabilityLedgerService.buildCoreContext(request.goal)')
);
check(
  'Autonomous plan checks capability ledger and forbids absence inference',
  candidatePreparation.includes('capabilityLedgerService.assessGoal') &&
    candidatePreparation.includes('能力不在と断定しない')
);
check(
  'Capability Ledger UI supports goal assessment and TXT export',
  capabilityLedgerScreen.includes('capabilityLedgerService.assessGoal(goal)') &&
    capabilityLedgerScreen.includes('capabilityLedgerService.toText(snapshot)') &&
    capabilityLedgerScreen.includes('能力が存在しない証拠ではない')
);
check(
  'Canonical index counts match Capability Ledger source files',
  capabilityLedgerIndexRow?.includes(`lines=${capabilityLedger.split(/\r?\n/).length - 1}`) &&
    capabilityLedgerScreenIndexRow?.includes(`lines=${capabilityLedgerScreen.split(/\r?\n/).length - 1}`)
);


check(
  'P277 CognitiveState has stable task identity, revision, safety, evidence, hypotheses, failures, and learning refs',
  core.includes('stateId:`CSTATE-${task.taskId}`') &&
    core.includes('cognitiveStateId:cognitiveState?.stateId') &&
    core.includes('cognitiveStateRevision:cognitiveState?.revision') &&
    core.includes('safetyConstraints') && core.includes('hypothesisRefs') &&
    core.includes('failureRefs') && core.includes('learningRefs')
);
check(
  'P277 CognitiveState checkpoints persist each CORE cycle and CORE owns snapshot recovery validation',
  core.includes('cognitiveStateCheckpointService.create') &&
    core.includes('COGNITIVE_CHECKPOINT_PARENT_CHAIN_INVALID') &&
    core.includes('cognitiveStateCheckpointService.reconstruct') &&
    core.includes('BLACKBOARD_COGNITIVE_SNAPSHOT_HASH_MISMATCH') &&
    !taskIngress.includes('cognitiveStateCheckpointService.reconstruct') &&
    operationalGovernance.includes('miki_cognitive_state_checkpoints_v1') &&
    operationalGovernance.includes('COGNITIVE_CHECKPOINT_PERSIST_FAILED')
);
check(
  'P277 checkpoint chains compact long task history without silently accepting corrupted chains',
  core.includes('compactCheckpointChain') && core.includes('COMPACTED_PARENT_CHAIN:') &&
    operationalGovernance.includes('MAX_COGNITIVE_CHECKPOINTS=2000')
);
check(
  'P277 CORE ingress records explicit multi-intent, hypothesis, unknown, learning, causal, and transfer candidates',
  taskIngress.includes('decomposeMultiIntent(request.goal)') &&
    taskIngress.includes('cognitiveContinuity:requestPlan') &&
    taskIngress.includes('unknown:potentialCandidates') &&
    taskIngress.includes('learning:opportunityCandidates') &&
    taskIngress.includes('learning:causalAttributionCandidate') &&
    taskIngress.includes('learning:crossDomainTransferCandidates') &&
    taskIngress.includes('learning:crossDomainTransferEvaluation') &&
    taskIngress.includes('observedSuccessRate') &&
    taskIngress.includes('causalEffectEstablished:false') &&
    taskIngress.includes('causalInvestigationService.create')
);
check(
  'P277 candidate claims remain AI-output UNVERIFIED and candidate evidence is not falsely attached',
  taskIngress.includes("source:'ai_output'") && taskIngress.includes("status:'UNVERIFIED'") &&
    taskIngress.includes("self_provenance:'SELF_SUPPORTED'") &&
    taskIngress.includes('CANDIDATE_ONLY_NOT_ATTACHED') &&
    taskIngress.includes('AI_OUTPUT_CLAIMS_REMAIN_UNVERIFIED') &&
    taskIngress.includes('semanticCoreSource') &&
    taskIngress.includes('SURFACE_HASH_IS_SEPARATE_FROM_MEANING_CORE') &&
    !taskIngress.includes('meaningCoreHash:canonicalSha256Object({requirements:requirements?')
);
check(
  'P277 information-gain and explanation plans reach CORE synthesis context',
  cognitiveQuality.includes('MAX_INFORMATION_GAIN_PER_USER_COST') &&
    cognitiveQuality.includes('planExplanation') &&
    core.includes('INFORMATION_GAIN_CLARIFICATION') &&
    core.includes('ANSWER_DETAIL_PLAN')
);
check(
  'P277 potential unknowns and transfer/learning opportunities reach synthesis without being promoted to facts',
  cognitiveQuality.includes('POTENTIAL_UNKNOWN') &&
    cognitiveQuality.includes('LEARNING_OPPORTUNITY_CANDIDATE') &&
    core.includes('POTENTIAL_UNKNOWN_HYPOTHESES') &&
    core.includes('CROSS_DOMAIN_TRANSFER_CANDIDATES') &&
    core.includes('must_research_and_verify=true')
);
check(
  'P277 same-input answer changes are recorded as candidates, not invented causal explanations',
  taskIngress.includes('learning:answerChangeExplanation') &&
    taskIngress.includes('CAUSE_CANDIDATES_ONLY') &&
    taskIngress.includes('stateDelta') && taskIngress.includes('semanticCoreChanged') &&
    taskIngress.toLowerCase().includes('a causal explanation is not asserted')
);
check(
  'P277 revalidation completion gate finds packageId nested in ReviewZipCreateResult.artifact',
  completionGate.includes('this.findDeepString(value,\'packageId\')') &&
    completionGate.includes('artifact.packageId') &&
    completionGate.includes('REVALIDATION_REVIEW_PACKAGE_MISSING')
);
check(
  'P277 native Autopilot dispatch persists an outbox and retries until the CORE event is delivered',
  backgroundWorker.includes('miki_autopilot_last_native_dispatch_v1') &&
    backgroundWorker.includes('miki_autopilot_pending_dispatch_v1') &&
    backgroundWorker.includes('receipt.delivered > 0 && receipt.failed === 0') &&
    continuousEvolution.includes('nativeWorkManagerService.isAndroidNative()') &&
    eventService.includes('subscriberCount(): number')
);
check(
  'P277 legacy WorkManager facade delegates to the canonical native service',
  workManagerFacade.includes('nativeWorkManagerService.schedule') &&
    workManagerFacade.includes('nativeWorkManagerService.cancel') &&
    !workManagerFacade.includes('schedulePeriodicWork') &&
    !workManagerFacade.includes('cancelPeriodicWork')
);
check(
  'P277 canonical index counts match all changed runtime source files',
  orchestratorIndexRow?.includes(`lines=${core.split(/\r?\n/).length - 1}`) &&
    ingressIndexRow?.includes(`lines=${taskIngress.split(/\r?\n/).length - 1}`) &&
    completionGateIndexRow?.includes(`lines=${completionGate.split(/\r?\n/).length - 1}`) &&
    cognitiveQualityIndexRow?.includes(`lines=${cognitiveQuality.split(/\r?\n/).length - 1}`) &&
    operationalGovernanceIndexRow?.includes(`lines=${operationalGovernance.split(/\r?\n/).length - 1}`) &&
    backgroundWorkerIndexRow?.includes(`lines=${backgroundWorker.split(/\r?\n/).length - 1}`) &&
    workManagerFacadeIndexRow?.includes(`lines=${workManagerFacade.split(/\r?\n/).length - 1}`) &&
    continuousEvolutionIndexRow?.includes(`lines=${continuousEvolution.split(/\r?\n/).length - 1}`) &&
    eventServiceIndexRow?.includes(`lines=${eventService.split(/\r?\n/).length - 1}`)
);

check(
  'P279 claim half-life tracks freshness without mutating official verification status',
  claimDatabase.includes('ensureClaimFreshness(newClaim)') &&
    claimDatabase.includes('MATCHING_CLAIM_REVALIDATION_REQUIRED') &&
    claimDatabase.includes("status:freshnessDue?'REVALIDATION_DUE'") &&
    claimDatabase.includes("knowledgeHalfLifeService.observe(`claim:${claimId}`,'SUCCESS',true)") &&
    knowledgeHalfLife.includes('public get(key:string):HalfLifeRecord|undefined') &&
    knowledgeHalfLife.includes('now>=r.dueAt') &&
    claimDatabase.includes('public indexMissingFreshness(limit=24):number') &&
    !claimDatabase.includes("if(freshnessDue)bestClaim.status='UNVERIFIED'")
);
check(
  'P279 due real-world Claims enter the existing durable CORE revalidation path without auto downgrade',
  backgroundWorker.includes('claimDatabaseService.indexMissingFreshness(deepSleepExecuted?24:8)') &&
    backgroundWorker.includes('knowledgeHalfLifeService.due(deepSleepExecuted ? 20 : 8)') &&
    backgroundWorker.includes("type:'STALE_INFORMATION'") &&
    backgroundWorker.includes('knowledgeGapService.detect({') &&
    backgroundWorker.includes('Claim状態は自動で降格せず') &&
    backgroundWorker.includes('knowledge-half-life:')
);
check(
  'P279 stale local Claims become research-required potential unknowns',
  cognitiveQuality.includes('claimDatabaseService.findBestMatchingClaim(term)') &&
    cognitiveQuality.includes("claimMatch.suggestedAction==='DIRECT_ANSWER'") &&
    cognitiveQuality.includes('LOCAL_CLAIM_REQUIRES_REVALIDATION') &&
    cognitiveQuality.includes('RESEARCH_AND_VERIFICATION_REQUIRED')
);
check(
  'P279 execution failures persist with event/signature dedupe and only unverified learning observations',
  failureUnderstanding.includes('miki_failure_understanding_records_v1') &&
    failureUnderstanding.includes('record.eventId===event.event_id') &&
    failureUnderstanding.includes('private readonly cooldownMs = 60_000') &&
    failureUnderstanding.includes("outcome:'FAILURE'") &&
    failureUnderstanding.includes('verified:false') &&
    failureUnderstanding.includes('AutonomousRevalidationLoop') &&
    !failureUnderstanding.includes('verifiedKnowledgePromotionService.promote(')
);
const failureAliasRow=canonicalServiceAlias.split(/\r?\n/).find(line=>line.includes("service:'failureUnderstandingService'"));
const halfLifeAliasRow=canonicalServiceAlias.split(/\r?\n/).find(line=>line.includes("service:'knowledgeHalfLifeService'"));
check(
  'P279 service connectivity registry describes the existing half-life and failure-learning runtime paths',
  failureAliasRow?.includes("classification:'CONNECTED_RUNTIME'") &&
    halfLifeAliasRow?.includes("classification:'CONNECTED_RUNTIME'") &&
    failureAliasRow.includes('unverified unified-learning signals') &&
    halfLifeAliasRow.includes('durable STALE_INFORMATION gaps')
);
const p279IndexedSources = [
  ['src/miki/core/services/coreOrchestratorService.ts',core],
  ['src/miki/execution/services/backgroundWorkerService.ts',backgroundWorker],
  ['src/miki/core/services/domainIntegrationBootstrapService.ts',domainIntegrationBootstrap],
  ['src/miki/core/services/coreTaskIngressService.ts',taskIngress],
  ['src/miki/improvement/services/selfImprovementRequestEventService.ts',eventService],
  ['src/miki/core/services/cognitiveQualityService.ts',cognitiveQuality],
  ['src/miki/memory/services/claimDatabaseService.ts',claimDatabase],
  ['src/miki/memory/services/knowledgeHalfLifeService.ts',knowledgeHalfLife],
  ['src/miki/memory/services/failureUnderstandingService.ts',failureUnderstanding],
  ['src/miki/core/services/canonicalServiceAliasRegistryService.ts',canonicalServiceAlias],
  ['android/app/src/main/java/com/miki/ai/MikiBackgroundWorker.kt',workmanagerWorkerRuntime],
  ['android/app/src/main/java/com/miki/ai/MikiWorkManagerPlugin.kt',workmanagerRuntime],
  ['android-native/src/main/java/com/miki/ai/MikiBackgroundWorker.kt',workmanagerNativeWorker],
  ['android-native/src/main/java/com/miki/ai/MikiWorkManagerPlugin.kt',workmanagerNativePlugin],
];
check(
  'P279 source index line counts match every modified source in the execution-integrity and freshness path',
  p279IndexedSources.every(([path,source])=>{
    const row=design.split(/\r?\n/).find(line=>line.includes(`${path} |`));
    return Boolean(row&&row.includes(`lines=${source.split(/\r?\n/).length-1}`));
  })
);

check(
  'P279 Android app and native mirror workers stay byte-identical and both plugins support correlated cancellation',
  workmanagerWorkerRuntime === workmanagerNativeWorker &&
    workmanagerRuntime.includes('fun cancelAutonomousCycle(cycleId: String)') &&
    workmanagerNativePlugin.includes('fun cancelAutonomousCycle(cycleId: String)') &&
    workmanagerRuntime.includes('MikiAutonomousCycleCallback(cycleId)') &&
    workmanagerNativePlugin.includes('MikiAutonomousCycleCallback(cycleId)')
);
check(
  'P279 completed maintenance cycles enter review flow, never the execution-failure path',
  backgroundWorker.includes("runType: 'BACKGROUND_CYCLE_REVIEW'") &&
    !backgroundWorker.includes("runType: 'EXECUTION_FAILURE'") &&
    backgroundWorker.includes("type: isAborted ? 'execution.inconclusive' : 'execution.failed'")
);
check(
  'P279 native dispatch outbox is persisted before publish and acknowledged only without subscriber failures',
  backgroundWorker.includes("storageService.setItem(pendingKey, JSON.stringify(pending))") &&
    backgroundWorker.includes('selfImprovementRequestEventService.publish(pending)') &&
    backgroundWorker.includes('receipt.delivered > 0 && receipt.failed === 0') &&
    domainIntegrationBootstrap.includes('runId:requestId') && domainIntegrationBootstrap.includes('sourceId:requestId')
);
check(
  'P279 benchmark uses real loaded-model readiness instead of constant-false gates',
  backgroundWorker.includes('regressionBenchmarkService.getActiveLoadedModelInfo()') &&
    backgroundWorker.includes('activeRuntime.isReady && activeRuntime.modelId') &&
    !backgroundWorker.includes('const isNativeReady = false') && !backgroundWorker.includes('const isWebReady = false')
);
check(
  'P279 resume recomputes the Blackboard snapshot hash and can re-root only a valid snapshot',
  core.includes('canonicalSha256Object(snapshotBody)!==recordedStateHash') &&
    core.includes('VALID_SNAPSHOT_RECHECKPOINTED') &&
    core.includes('BLACKBOARD_COGNITIVE_SNAPSHOT_HASH_MISMATCH') &&
    operationalGovernance.includes("'CANONICAL_SHA256_V1'") &&
    operationalGovernance.includes('FNV1A32_LEGACY')
);
check(
  'P279 claim freshness migration revisits old records and defaults unknown real-world stability to TIME',
  claimDatabase.includes('miki_claim_freshness_migration_cursor_v1') &&
    claimDatabase.includes("let stability:KnowledgeStability='TIME'") &&
    knowledgeHalfLife.includes("return'TIME'")
);

const failures = checks.filter(item => !item.passed);
for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.name}`);
console.log(JSON.stringify({ passed: failures.length === 0, total: checks.length, failed: failures.map(item => item.name) }, null, 2));
if (failures.length) process.exitCode = 1;
