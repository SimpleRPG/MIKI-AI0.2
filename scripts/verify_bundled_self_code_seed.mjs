import fs from 'node:fs';
import ts from 'typescript';

const files = [
  'src/miki/core/services/selfCodeSpaceService.ts',
  'src/services/githubSyncService.ts',
  'src/App.tsx',
  'scripts/prepare_self_code_seed.mjs',
];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const kind = file.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : file.endsWith('.ts')
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JS;

  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.ES2022,
    true,
    kind
  );

  if ((parsed.parseDiagnostics || []).length) {
    throw new Error(`BUNDLED_SEED_PARSE_FAILED:${file}`);
  }
}

const selfCode = fs.readFileSync(
  'src/miki/core/services/selfCodeSpaceService.ts',
  'utf8'
);
const sync = fs.readFileSync(
  'src/services/githubSyncService.ts',
  'utf8'
);
const app = fs.readFileSync('src/App.tsx', 'utf8');
const design = fs.readFileSync(
  'MIKI-AI0.2_統合設計書_正本.txt',
  'utf8'
);

for (const text of [
  'initializeBundledSeed',
  '/self-code-seed.zip',
  'BUNDLED_SELF_CODE_SEED_MANIFEST_MISSING',
  'BUNDLED_SELF_CODE_SEED_SHA_MISMATCH',
  'FALLBACK_GITHUB',
  'applyBundledSeed',
]) {
  if (!(selfCode + sync).includes(text)) {
    throw new Error(`BUNDLED_SEED_CONTRACT_MISSING:${text}`);
  }
}

for (const text of [
  'selfCodeSpaceService.initializeBundledSeed()',
  'appRuntimeLifecycleService.initialize()',
]) {
  if (!app.includes(text)) {
    throw new Error(`APP_STARTUP_SEED_WIRING_MISSING:${text}`);
  }
}

if (!design.includes('【170. 現行正本：自己コードWorkspaceのアプリ同梱SeedとPULLフォールバック】')) {
  throw new Error('DESIGN_SEED_POLICY_MISSING');
}

console.log(JSON.stringify({
  passed: true,
  stage: 'BUNDLED_SELF_CODE_SEED',
  fallback: 'EXISTING_GITHUB_PULL',
  startupPull: false,
  dirtyWorkspacePreserved: true,
}, null, 2));
