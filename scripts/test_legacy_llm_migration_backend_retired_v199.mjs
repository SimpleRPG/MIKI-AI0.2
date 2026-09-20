import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const barrel = readFileSync('src/miki/safety.ts', 'utf8');
const design = readFileSync('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt', 'utf8');

const sourceFiles = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(full);
  }
}
walk('src');

const activeRefs = [];
for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8');
  if (text.includes('llmMigrationProtocolService') || text.includes('LlmMigrationProtocolService') || text.includes('LlmMigrationSubView')) {
    activeRefs.push(file);
  }
}

const checks = {
  backendRemoved: !existsSync('src/miki/safety/services/llmMigrationProtocolService.ts'),
  barrelExportRemoved: !barrel.includes('llmMigrationProtocolService'),
  migrationEvidenceScriptRemoved: !existsSync('scripts/test_llm_migration_evidence.ts'),
  stalePhilosophyTestRemoved: !existsSync('scripts/test_non_llm_philosophy_v47.ts'),
  oldPackageBackupRemoved: !existsSync('package.json.before-esbuild-api-fix'),
  npmMigrationScriptRemoved: !('test:migration-evidence' in packageJson.scripts),
  noActiveSourceReferences: activeRefs.length === 0,
  designUpdated: design.includes('旧LLM移管バックエンド退役'),
};

const passed = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ version: 'v199', passed, checks, activeRefs }, null, 2));
if (!passed) process.exit(1);
