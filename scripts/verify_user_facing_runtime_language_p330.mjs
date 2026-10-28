import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const api = read('src/services/api.ts');
const hub = read('src/components/GitHubHub.tsx');
const server = read('server.ts');
const systemLogger = read('src/services/systemLogger.ts');
const registry = read('src/data/specificationRegistryData.ts');
const androidBuild = read('ANDROID_BUILD.md');
const indexHtml = read('index.html');
const metadata = read('metadata.json');

assert.ok(api.includes("import { Capacitor } from '@capacitor/core';"), 'Capacitor platform detection must be imported');
assert.ok(api.includes("const base = configured || (Capacitor.getPlatform() === 'android' ? 'http://127.0.0.1:3000' : '');"), 'Android must default to the local Termux API, while browser calls remain relative');
assert.ok(api.includes('return `${base}${path}`;'), 'Configured base URL must still be applied to API paths');
assert.ok(api.includes('APIサーバーに接続できません。接続先URLとサーバーの起動状態を確認してください。'), 'Connection error must not incorrectly say the server is external');

assert.ok(hub.includes('Android APKとTermuxのNode APIサーバーは同じスマホ内の別プロセスで、APKから自動起動はしません。'), 'UI must explain APK and Termux server are separate processes on the same phone');
assert.ok(hub.includes('Termuxで`npm run dev`を起動すると、APKの空欄設定は`http://127.0.0.1:3000`へ接続します。'), 'UI must explain the Android local API default');
assert.ok(hub.includes('ブラウザ／Web Previewでは、APIを同一オリジンで提供している場合は空欄で相対URLを使います。'), 'UI must explain browser same-origin routing');

const staleLabels = [
  ['src/services/api.ts', '[非LLM決定論的処理完了]'],
  ['src/services/api.ts', '非LLM自律統合中核'],
  ['src/components/GitHubHub.tsx', '空欄ならこのアプリと同じサーバーを使う'],
  ['src/miki/safety/services/nonLlmHardwarePipelineService.ts', '非LLM中核（CPU決定論的経路）'],
  ['src/services/nonLlmCoreService.ts', '非LLM中核では推奨を捏造して確定しません。'],
  ['src/services/nonLlmRuntimeService.ts', 'Non-LLM Core'],
  ['src/miki/capability/services/capabilityTraceabilityService.ts', 'Non-LLM Core'],
  ['src/miki/selfDevelopment/services/selfCodeArchitectService.ts', 'Non-LLM Core'],
  ['src/miki/verification/services/deviceBenchmarkService.ts', 'Non-LLM Core'],
  ['src/miki/verification/services/regressionBenchmarkService.ts', 'Non-LLM Core設定'],
  ['src/services/answerPlanService.ts', '検証済みNon-LLM能力パッチ'],
  ['src/miki/strategy/services/answerPlanService.ts', '検証済みNon-LLM能力パッチ'],
  ['src/miki/learning/services/capabilityEvaluationService.ts', '【判定: 非LLM能力検証合格】'],
  ['src/miki/selfAwareness/services/whyAnswerInspectorService.ts', '内部Non-LLM決定論的処理'],
  ['src/miki/safety/services/nonLlmRuntimePolicyService.ts', 'Use deterministic non-LLM components.'],
  ['src/miki/strategy/services/implementationSelectionService.ts', '非LLM実装を優先'],
  ['src/services/modelLifecycleService.ts', 'Non-LLM Coreのみを維持します。'],
  ['src/services/systemLogger.ts', 'Non-LLM Core設定'],
  ['src/services/systemLogger.ts', 'GPULLM (WebGPU旧ローカル生成ランタイム)'],
  ['src/data/specificationRegistryData.ts', '非LLM'],
  ['src/data/specificationRegistryData.ts', 'Non-LLM'],
  ['server.ts', '非LLM'],
  ['server.ts', 'Non-LLM'],
  ['server.ts', 'non-LLM'],
  ['ANDROID_BUILD.md', 'Non-LLM'],
  ['index.html', 'deterministic non-LLM'],
  ['metadata.json', 'deterministic non-LLM'],
];
for (const [file, stale] of staleLabels) {
  assert.equal(read(file).includes(stale), false, `Stale user-facing label remains in ${file}: ${stale}`);
}

assert.ok(read('src/miki/verification/services/deviceBenchmarkService.ts').includes("const recommendedModelId = 'non-llm-core';"), 'Keep the stable persisted recommendation ID');
assert.ok(read('src/miki/safety/services/nonLlmRuntimePolicyService.ts').includes("'NON_LLM_CORE'"), 'Keep the stable runtime enum');
assert.ok(read('src/miki/learning/services/capabilityEvaluationService.ts').includes("'VERIFIED_NON_LLM_CAPABILITY'"), 'Keep the stable capability verdict enum');
assert.ok(indexHtml.includes('Miki AI Partner & local-first AI companion and autonomous software studio'), 'HTML metadata must use the new product wording');
assert.ok(metadata.includes('Miki AI Partner & local-first AI companion and autonomous software studio'), 'Package metadata must use the new product wording');
assert.ok(read('.github/workflows/build-apk.yml').includes('node scripts/verify_user_facing_runtime_language_p330.mjs'), 'P330 contract verifier must run in GitHub Actions');

console.log('P330 user-facing wording and runtime-specific API routing contract: PASS');
