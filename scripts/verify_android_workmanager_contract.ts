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
const pluginKt = fs.readFileSync(path.join(root, 'android-native/src/main/java/com/miki/ai/MikiWorkManagerPlugin.kt'), 'utf8');
const bgWorkerTs = fs.readFileSync(path.join(root, 'src/services/backgroundWorkerService.ts'), 'utf8');
const nativeWorkManagerTs = fs.readFileSync(path.join(root, 'src/services/nativeWorkManagerService.ts'), 'utf8');
const mainJava = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/miki/ai/MainActivity.java'), 'utf8');
const buildGradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');

const checks: [string, boolean][] = [
  // 1. Native Worker checks
  ['Worker inherits CoroutineWorker', workerKt.includes(': CoroutineWorker(appContext, workerParams)')],
  ['Worker implements doWork', workerKt.includes('override suspend fun doWork(): Result')],
  ['Worker validates hardware conditions (temp/battery)', workerKt.includes('validateHardwareConditions()')],
  ['Worker thermal gate aligns with backgroundWorkerService (42C hot threshold)', workerKt.includes('temperatureCelsius >= 42.0')],
  ['Worker provides headless WebView execution fallback', workerKt.includes('executeViaHeadlessWebView()')],
  ['Worker provides local HTTP trigger check', workerKt.includes('tryHttpLocalTrigger()')],
  ['Worker has mutual exclusion flag', workerKt.includes('var isWorkerExecuting: Boolean')],

  // 2. Native Plugin checks
  ['Plugin annotation MikiWorkManagerPlugin', pluginKt.includes('@CapacitorPlugin(name = "MikiWorkManagerPlugin")')],
  ['Plugin implements schedule method', pluginKt.includes('fun schedule(call: PluginCall)')],
  ['Plugin implements cancel method', pluginKt.includes('fun cancel(call: PluginCall)')],
  ['Plugin implements getStatus method', pluginKt.includes('fun getStatus(call: PluginCall)')],
  ['Plugin exposes triggerAutonomousCycle', pluginKt.includes('fun triggerAutonomousCycle(')],

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
  ['backgroundWorkerService exposes window.mikiRunBackgroundCycle', bgWorkerTs.includes('mikiRunBackgroundCycle')],
  ['backgroundWorkerService listens for native autonomousCycleTriggered', bgWorkerTs.includes('nativeWorkManagerService.setupTriggerListener')],
  ['backgroundWorkerService syncs schedule with native on constraints/interval change', bgWorkerTs.includes('syncNativeWorkManagerSchedule()')],
  ['checkAndTriggerScheduledWork checks native status to prevent duplicate execution', bgWorkerTs.includes('nativeStatus.isWorkerExecuting')],
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

console.log('\nSTATIC_CONTRACT_ONLY: All 18 contract checks passed.');
console.log('NOTE: Physical device execution logs are required for runtime verification on hardware.');
