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
const issueDiscovery = read('src/miki/core/services/autonomousIssueDiscoveryService.ts');
const autonomousLoop = read('src/miki/core/services/autonomousSelfImprovementLoopService.ts');
const autonomousSearch = read('src/miki/research/services/autonomousSearchService.ts');
const preflightService = read('src/miki/core/services/selfImprovementPreflightService.ts');
const requiredAssetAcquisition = read('src/miki/core/services/requiredAssetAcquisitionService.ts');
const missingAssetSynthesis = read('src/miki/core/services/missingAssetSynthesisService.ts');

check('Canonical Runner exposes decideCoreGoals', runner.includes('fun decideCoreGoals(call: PluginCall)'));
check('Canonical Runner exposes rankDomainRoutes', runner.includes('fun rankDomainRoutes(call: PluginCall)'));
check('MIKINativeCore exposes decideCoreGoals', nativeCore.includes('fun decideCoreGoals(requestJson: String)') && nativeCore.includes('nativeDecideCoreGoals'));
check('MainActivity registers MIKINativeRunner', main.includes('registerPlugin(MIKINativeRunnerPlugin.class)'));
check('Runner installer never copies legacy template', !runnerInstaller.includes('cp "$PLUGIN_SRC" "$PACKAGE_DIR/MIKINativeRunnerPlugin.kt"'));
check('Morphology installer never copies legacy Runner template', !morphologyInstaller.includes('NATIVE_RUNNER_SRC') && !morphologyInstaller.includes('cp "$NATIVE_RUNNER_SRC" "$PACKAGE_DIR/MIKINativeRunnerPlugin.kt"'));
check('Morphology installer guards Rust bridge before changes', morphologyInstaller.includes('grep -Fq \'fun decideCoreGoals(call: PluginCall)\' "$RUNNER_TARGET"') && morphologyInstaller.includes('grep -Fq \'fun decideCoreGoals(requestJson: String)\' "$CORE_TARGET"'));
check('WorkManager source exposes candidate browser E2E', workmanagerRuntime.includes('fun runCandidateBrowserE2E(call: PluginCall)') && workmanagerRuntime.includes('fun fetchRenderedPage(call: PluginCall)'));
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
check('Audit logs redact contents and symbol mappings (legacy)', auditLegacy.includes('sanitizeAuditLogEntry') && auditLegacy.includes("sanitizedText: ''") && auditLegacy.includes('symbolReplacements: {}') && auditLegacy.includes('Audit metadata retained; content, reversible mappings, and identifying details redacted.') && auditLegacy.includes('data|storage|sdcard|system'));
check('Audit logs redact contents and symbol mappings (CORE)', auditCore.includes('sanitizeAuditLogEntry') && auditCore.includes("sanitizedText: ''") && auditCore.includes('symbolReplacements: {}') && auditCore.includes('Audit metadata retained; content, reversible mappings, and identifying details redacted.') && auditCore.includes('data|storage|sdcard|system'));
check('Legacy sanitizer persists no credential/PII/path/host mappings', sanitizerLegacy.includes('TRANSIENT_SYMBOL_CATEGORIES') && sanitizerLegacy.includes('if (!TRANSIENT_SYMBOL_CATEGORIES.has(category)) this.saveMappings()'));
check('Legacy sanitizer detects Android app-private paths', sanitizerLegacy.includes('data|storage|sdcard|system'));
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
    autonomousLoop.includes('if (this.disposed || this.running || this.state.queue.length === 0) return;') &&
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

const failures = checks.filter(item => !item.passed);
for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.name}`);
console.log(JSON.stringify({ passed: failures.length === 0, total: checks.length, failed: failures.map(item => item.name) }, null, 2));
if (failures.length) process.exitCode = 1;
