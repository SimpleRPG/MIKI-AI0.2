import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(path, 'utf8');
const checks = [];
const check = (name, passed) => checks.push({ name, passed: Boolean(passed) });

const runner = read('android/app/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt');
const nativeCore = read('android/app/src/main/java/com/miki/ai/MIKINativeCore.kt');
const main = read('android/app/src/main/java/com/miki/ai/MainActivity.java');
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
const designRevisionHeader = design.slice(0, 500).match(/^正本Revision：(\d{4}-\d{2}-\d{2}-P\d+)$/m);
check(
  'Canonical design doc preserves P222 history and current revision metadata',
  design.includes('# P222 Android Native Runner同期漏れ・CORE再開例外・Sudachi辞書Anchor・外部送信サニタイズ修正') &&
    design.includes('# P223 Android Kotlin reject型修正・Web検索サニタイズ経路の修復') &&
    Boolean(designRevisionHeader)
);

const failures = checks.filter(item => !item.passed);
for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.name}`);
console.log(JSON.stringify({ passed: failures.length === 0, total: checks.length, failed: failures.map(item => item.name) }, null, 2));
if (failures.length) process.exitCode = 1;
