import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const failures = [];

const main = read('src/main.tsx');
const logger = read('src/services/systemLogger.ts');
const startup = read('src/services/startupRecoveryService.ts');
const androidPlugin = read('android/app/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt');
const androidNativeTemplate = read('android-native/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt');
const design = read('MIKI-AI0.2_統合設計書_正本.txt');

for (const token of [
  "initializeRuntimeLogFile",
  "MIKI_RUNTIME_LOG.txt",
  "queueRuntimeLogFile",
  "registerPlugin<RuntimeLogFilePlugin>('MIKINativeRunner')",
]) {
  if (!logger.includes(token)) failures.push(`LOGGER_MISSING:${token}`);
}

for (const token of [
  "[STARTUP]",
  "systemLogger.log(",
  "initializeRuntimeLogFile",
]) {
  if (!startup.includes(token)) failures.push(`STARTUP_TRACE_MISSING:${token}`);
}

for (const token of [
  "[BOOT] JavaScript entry loaded",
  "[WINDOW] unhandledrejection",
  "[WINDOW] error",
  "[BOOTSTRAP_FAILED]",
]) {
  if (!main.includes(token)) failures.push(`BOOT_ERROR_TRACE_MISSING:${token}`);
}

for (const [label, source] of [
  ['android/app', androidPlugin],
  ['android-native/template', androidNativeTemplate],
]) {
  for (const token of [
    'fun ensureRuntimeLogFile',
    'fun appendRuntimeLog',
    'MediaStore.Downloads',
    'Environment.DIRECTORY_DOWNLOADS',
    'MIKI_RUNTIME_LOG.txt',
    'RUNTIME_LOG_DOWNLOADS_API_UNSUPPORTED',
  ]) {
    if (!source.includes(token)) failures.push(`${label}_MISSING:${token}`);
  }
}

if (!design.includes('【161. P2 — 長期運転の観測性と構成変更の追跡】')) {
  failures.push('DESIGN_OBSERVABILITY_SECTION_MISSING');
}

console.log(JSON.stringify({
  passed: failures.length === 0,
  phase: 'RUNTIME_LOGGING_PHASE1_STATIC',
  failures,
  deviceVerified: false,
  note: 'Static contract only. Android real-device file creation and append behavior still require device verification.',
}, null, 2));

if (failures.length) process.exitCode = 1;
