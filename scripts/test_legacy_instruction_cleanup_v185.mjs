import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const removed = [
  'ADAPTIVE_CORE_PLAN_V148_IMPLEMENTATION_REPORT.txt',
  'AUTONOMOUS_CONVERSATION_DIVERSITY_V94.txt',
  'CANDIDATE_GENERATION_RELIABILITY_V53.txt',
  'FINAL_FIX_REPORT_2026-09-19.txt',
  'MASTER_INSTRUCTION_BIBI_VER121.txt',
  'MERGE_11_13_SHA256.txt',
  'MERGE_LOG_BIBI_VER121.txt',
  'NEW_CORE_CYCLE_SETTINGS_V151_REPORT.txt',
  'NEW_UI_CONVERSATION_SELF_CODE_RECHECK_V150_REPORT.txt',
  'PRIORITY_QUEUE_BIBI_VER121.txt',
  'SEARXNG_CONTENT_READ_INTEGRATION_V153_MANIFEST.txt',
  'SEARXNG_CONTENT_READ_INTEGRATION_V153_REPORT.txt',
  'SYNTAX_ERROR_FIX_REPORT_V148.txt',
  'UI_SHELL_V69_VALIDATION.txt',
  'WORK/BUNDLE_MANIFEST.txt',
  'WORK/CONFIRMATION_REPORT_2026-09-19.txt',
  'docs/MIKI_AUTONOMOUS_APP_UI.md',
  'docs/MIKI_AUTONOMOUS_TERMUX.md',
];
const missing = removed.filter(existsSync);
const design = readFileSync('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt','utf8');
const checks = {
  historicalInstructionFilesRemoved: missing.length === 0,
  consolidatedDesignPreserved: design.includes('MIKI-AIは、COREと17の専門分類から成る18分類構造を使用する。'),
  singleCanonicalSpec: design.includes('過去版の作業指示書、版別実装レポート、移行履歴、修正作業ログ、旧設計思想文書をリポジトリの正本として残さない'),
};
assert.deepEqual(missing, []);
assert.equal(Object.values(checks).every(Boolean), true);
console.log(JSON.stringify({version:'v185',passed:true,checks},null,2));
