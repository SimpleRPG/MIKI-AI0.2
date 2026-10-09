import { readFileSync, existsSync } from 'node:fs';
const failures = [];
const read = (path) => readFileSync(path, 'utf8');
const rust = read('native/miki-native-core/src/lib.rs');
const core = read('src/miki/core/services/coreOrchestratorService.ts');
const bridge = read('src/miki/core/services/rustCoreDecisionKernelService.ts');
const kotlin = read('android/app/src/main/java/com/miki/ai/MIKINativeCore.kt');
const plugin = read('android/app/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt');
const runnerInstaller = read('scripts/install_android_native_runner.sh');
const morphologyInstaller = read('scripts/install_android_japanese_morphology.sh');
const workmanagerInstaller = read('scripts/install_android_workmanager.sh');
const workmanagerRuntime = read('android/app/src/main/java/com/miki/ai/MikiWorkManagerPlugin.kt');

if (!existsSync('src/miki/core/services/rustCoreDecisionKernelService.ts')) failures.push('BRIDGE_MISSING');
for (const term of ['core_decide_json', 'nativeDecideCoreGoals', 'highest deterministic rank', 'permission or dependency unsatisfied']) {
  if (!rust.includes(term)) failures.push(`RUST_MISSING:${term}`);
}
for (const term of ['nativeDecideCoreGoals', 'decideCoreGoals']) {
  if (!kotlin.includes(term)) failures.push(`KOTLIN_MISSING:${term}`);
}
if (!plugin.includes('fun decideCoreGoals(call: PluginCall)')) failures.push('PLUGIN_DECIDE_CORE_GOALS_MISSING');
if (!plugin.includes('fun rankDomainRoutes(call: PluginCall)')) failures.push('PLUGIN_RANK_DOMAIN_ROUTES_MISSING');
for (const term of ['rustCoreDecisionKernelService.resolveGoalConflicts', 'RUST_CORE_KERNEL_V1']) {
  if (!core.includes(term)) failures.push(`CORE_MISSING:${term}`);
}
for (const term of ['NativeCoreDecision.decideCoreGoals', 'RUST_CORE_DECISION_ENGINE_REQUIRED']) {
  if (!bridge.includes(term)) failures.push(`BRIDGE_MISSING:${term}`);
}
if (runnerInstaller.includes('cp "$PLUGIN_SRC" "$PACKAGE_DIR/MIKINativeRunnerPlugin.kt"')) failures.push('RUNNER_INSTALLER_OVERWRITES_CANONICAL_PLUGIN');
if (morphologyInstaller.includes('cp "$NATIVE_RUNNER_SRC" "$PACKAGE_DIR/MIKINativeRunnerPlugin.kt"')) failures.push('MORPHOLOGY_INSTALLER_OVERWRITES_CANONICAL_PLUGIN');
if (workmanagerInstaller.includes('cp "$SRC_DIR/MikiWorkManagerPlugin.kt" "$PACKAGE_DIR/MikiWorkManagerPlugin.kt"')) failures.push('WORKMANAGER_INSTALLER_OVERWRITES_CANONICAL_PLUGIN');
if (workmanagerInstaller.includes('cp "$SRC_DIR/MikiBackgroundWorker.kt" "$PACKAGE_DIR/MikiBackgroundWorker.kt"')) failures.push('WORKMANAGER_INSTALLER_OVERWRITES_CANONICAL_WORKER');
console.log(JSON.stringify({
  passed: failures.length === 0,
  phase: 'RUST_CORE_KERNEL_37',
  migrated: ['goal candidate normalization', 'permission gate', 'dependency gate', 'safety foreground priority deadline ranking', 'goal conflict pause/block/wait decisions', 'deterministic comparison keys'],
  retainedInTypeScript: ['blackboard lifecycle', '17-domain dispatch', 'UI and conversation integration', 'external side effects'],
  architecture: 'HYBRID_CORE_RUST_DECISION_KERNEL',
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
