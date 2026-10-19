/**
 * Static contract check for Android WorkManager background execution.
 * NOTE: This is NOT device verification.
 * It strictly validates that:
 * 1. Native Kotlin sources (MikiBackgroundWorker.kt & MikiWorkManagerPlugin.kt) are present and implement the required methods
 * 2. Hardware constraint gates in Kotlin match backgroundWorkerService.ts execution conditions
 * 3. MainActivity, build.gradle, and AndroidManifest.xml are patched correctly
 * 4. TypeScript services (nativeWorkManagerService & backgroundWorkerService) provide mutual exclusion and global triggers
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workerKt = fs.readFileSync(path.join(root, 'android-native/src/main/java/com/miki/ai/MikiBackgroundWorker.kt'), 'utf8');
const workerAppKt = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/miki/ai/MikiBackgroundWorker.kt'), 'utf8');
const pluginKt = fs.readFileSync(path.join(root, 'android-native/src/main/java/com/miki/ai/MikiWorkManagerPlugin.kt'), 'utf8');
const pluginAppKt = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/miki/ai/MikiWorkManagerPlugin.kt'), 'utf8');
const bgWorkerTs = fs.readFileSync(path.join(root, 'src/miki/execution/services/backgroundWorkerService.ts'), 'utf8');
const nativeWorkManagerTs = fs.readFileSync(path.join(root, 'src/miki/execution/services/nativeWorkManagerService.ts'), 'utf8');
const mainJava = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/miki/ai/MainActivity.java'), 'utf8');
const buildGradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');

const checks: [string, boolean][] = [
  // 1. Native Worker checks
  ['Worker inherits CoroutineWorker', workerKt.includes(': CoroutineWorker(appContext, workerParams)')],
  ['Worker implements doWork', workerKt.includes('override suspend fun doWork(): Result')],
  ['Worker validates hardware conditions (temp/battery)', workerKt.includes('validateHardwareConditions()')],
  ['Worker thermal gate aligns with backgroundWorkerService (42C hot threshold)', workerKt.includes('temperatureCelsius >= 42.0')],
  ['Worker provides a single headless WebView executor when active runtime is unavailable', workerKt.includes('executeViaHeadlessWebView(cycleId: String)') && workerKt.includes('return executeViaHeadlessWebView(cycleId)')],
  ['Worker uses headless executor only when active plugin is detached', workerKt.includes('plugin.hasActiveWebRuntime()') && workerKt.includes('return executeViaHeadlessWebView(cycleId)') && !workerKt.includes('tryHttpLocalTrigger()')],
  ['Worker receives a cycle-correlated explicit native completion receipt', workerKt.includes('MikiAutonomousCycleCallback(cycleId)') && workerKt.includes('expectedCycleId') && workerKt.includes('completionDeferred.complete(success)')],
  ['Worker does not count trigger acknowledgment or timeout as success', workerKt.includes("log.status === 'completed'") && !workerKt.includes('completionDeferred.complete(true)') && workerKt.includes('stopped == null')],
  ['Worker cleans headless WebView on cancellation and timeout and waits for UI-thread cleanup', workerKt.includes('finally {') && workerKt.includes('cleanupWebView()') && workerKt.includes('cleanupFinished.await()') && workerKt.includes('completionClaimed.compareAndSet(false, true)')],
  ['Worker uses atomic single-flight lock and retries duplicate wake', workerKt.includes('workerExecutionLock.compareAndSet(false, true)') && workerKt.includes('return@withContext Result.retry()')],
  ['Worker has mutual exclusion flag', workerKt.includes('var isWorkerExecuting: Boolean')],
  ['Android app Worker matches the audited native source copy', workerAppKt === workerKt],

  // 2. Native Plugin checks
  ['Plugin annotation MikiWorkManagerPlugin', pluginKt.includes('@CapacitorPlugin(name = "MikiWorkManagerPlugin")')],
  ['Plugin implements schedule method', pluginKt.includes('fun schedule(call: PluginCall)')],
  ['Plugin implements cancel method', pluginKt.includes('fun cancel(call: PluginCall)')],
  ['Plugin implements getStatus method', pluginKt.includes('fun getStatus(call: PluginCall)')],
  ['Plugin exposes cycle-correlated trigger and cancellation', pluginKt.includes('fun triggerAutonomousCycle(cycleId: String') && pluginKt.includes('fun cancelAutonomousCycle(cycleId: String)') && pluginKt.includes('activeAutonomousCycleId')],
  ['Plugin validates attached WebView runtime before active execution', pluginKt.includes('fun hasActiveWebRuntime(): Boolean = activity != null && bridge?.webView != null')],
  ['Plugin waits for a correlated native completion receipt rather than trigger acknowledgment', pluginKt.includes('MikiAutonomousCycleCallback(cycleId)') && pluginKt.includes("log.status === 'completed'") && pluginKt.includes('cancelAutonomousCycle(cycleId: String)') && !pluginKt.includes('notifyListeners("autonomousCycleTriggered", ret)')],
  ['Android app Plugin keeps browser E2E APIs and correlated cancellation', pluginAppKt.includes('fun runCandidateBrowserE2E(call: PluginCall)') && pluginAppKt.includes('fun fetchRenderedPage(call: PluginCall)') && pluginAppKt.includes('cancelAutonomousCycle(cycleId: String)') && pluginAppKt.includes('MikiAutonomousCycleCallback(cycleId)')],

  // 3. Android Project Configuration checks
  ['MainActivity registers MikiWorkManagerPlugin', mainJava.includes('registerPlugin(MikiWorkManagerPlugin.class)')],
  ['app/build.gradle contains work-runtime-ktx dependency', buildGradle.includes('androidx.work:work-runtime-ktx')],
  ['AndroidManifest contains ACCESS_NETWORK_STATE', manifest.includes('android.permission.ACCESS_NETWORK_STATE')],
  ['AndroidManifest contains WAKE_LOCK', manifest.includes('android.permission.WAKE_LOCK')],

  // 4. JS/TS Service integration & Mutual Exclusion checks
  ['nativeWorkManagerService provides schedule/cancel/getStatus',
    nativeWorkManagerTs.includes('schedule(') &&
    nativeWorkManagerTs.includes('cancel(') &&
    nativeWorkManagerTs.includes('getStatus(')
  ],
  ['backgroundWorkerService exposes cycle-correlated run and cancellation entries', bgWorkerTs.includes('mikiRunBackgroundCycle') && bgWorkerTs.includes('mikiCancelBackgroundCycle') && bgWorkerTs.includes('nativeCycleId')],
  ['backgroundWorkerService listens for native autonomousCycleTriggered', bgWorkerTs.includes('nativeWorkManagerService.setupTriggerListener')],
  ['backgroundWorkerService syncs schedule with native on constraints/interval change', bgWorkerTs.includes('syncNativeWorkManagerSchedule()')],
  ['checkAndTriggerScheduledWork checks native status to prevent duplicate execution', bgWorkerTs.includes('nativeStatus.isWorkerExecuting')],
  ['CORE resume re-hashes snapshot, validates the checkpoint chain, and rejects invalid snapshot contents', fs.readFileSync(path.join(root, 'src/miki/core/services/coreOrchestratorService.ts'), 'utf8').includes('COGNITIVE_CHECKPOINT_CHAIN_INVALID') && fs.readFileSync(path.join(root, 'src/miki/core/services/coreOrchestratorService.ts'), 'utf8').includes('canonicalSha256Object(snapshotBody)!==recordedStateHash') && fs.readFileSync(path.join(root, 'src/miki/core/services/coreOrchestratorService.ts'), 'utf8').includes('VALID_SNAPSHOT_RECHECKPOINTED')],
];

let allPassed = true;
console.log('=== Android WorkManager Static Contract Verification ===');
for (const [desc, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} - ${desc}`);
  if (!passed) allPassed = false;
}

if (!allPassed) {
  console.error('\nVerification failed! One or more contracts are missing or invalid.');
  process.exit(1);
}

console.log(`\nSTATIC_CONTRACT_ONLY: All ${checks.length} contract checks passed.`);
console.log('NOTE: Physical device execution logs are required for runtime verification on hardware.');
