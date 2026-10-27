import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isRuntimeProofCandidatePathForbidden,
  shouldCopyRuntimeProofSnapshotPath,
} from '../src/miki/core/services/runtimeProofWorkspacePolicyService';

assert.equal(shouldCopyRuntimeProofSnapshotPath('',), true,
  'snapshot root remains copyable');
assert.equal(shouldCopyRuntimeProofSnapshotPath('package.json'), true,
  'trusted repository package.json is copied');
assert.equal(shouldCopyRuntimeProofSnapshotPath('src/services/example.ts'), true,
  'normal source remains copyable');

for (const path of [
  '.env', '.env.production', 'src/.env.local', '.npmrc', '.netrc',
  'credentials.json', 'service-account.json', 'private-key.pem',
  'android/release.keystore', '.miki-runtime/session/file.json',
  'node_modules/pkg/index.js', 'dist/assets/index.js', 'dist-apk/index.html',
  '.git/config', '.github/workflows/build-apk.yml',
]) {
  assert.equal(
    shouldCopyRuntimeProofSnapshotPath(path),
    false,
    `sensitive or generated snapshot path must be excluded: ${path}`,
  );
}

assert.equal(
  isRuntimeProofCandidatePathForbidden('src/components/NewFeature.tsx'),
  false,
);
for (const path of [
  'package.json', 'package-lock.json', 'src/package.json',
  'yarn.lock', 'pnpm-lock.yaml', '.env', 'src/.env.production',
  '.npmrc', 'private-key.pem', 'node_modules/pkg/index.js',
  '.github/workflows/build-apk.yml', 'vite.config.ts', 'tsconfig.app.json',
  'android/AndroidManifest.xml', '../escape.ts', 'src/../../escape.ts',
  '/tmp/escape.ts', 'C:\\outside.ts', 'src//empty.ts', 'src/./dot.ts',
]) {
  assert.equal(
    isRuntimeProofCandidatePathForbidden(path),
    true,
    `unsafe candidate path must be rejected: ${path}`,
  );
}

const server = readFileSync('server.ts', 'utf8');
assert.ok(
  server.includes('shouldCopyRuntimeProofSnapshotPath(relative)'),
  'runtime-proof repository copy uses the snapshot policy',
);
assert.ok(
  server.includes('isRuntimeProofCandidatePathForbidden(relative)'),
  'runtime-proof request files use the candidate policy',
);
assert.ok(
  server.includes('fs.lstatSync(source).isSymbolicLink()'),
  'snapshot copy rejects symlinks before execution',
);
console.log('RUNTIME_PROOF_WORKSPACE_POLICY_P328=PASS');
