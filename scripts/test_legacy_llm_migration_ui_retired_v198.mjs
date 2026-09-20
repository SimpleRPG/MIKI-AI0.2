import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const tab=readFileSync('src/components/self_improvement/NonLlmArchitectureTab.tsx','utf8');
const design=readFileSync('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt','utf8');
const checks={
  legacyImportRemoved:!tab.includes("LlmMigrationSubView"),
  legacyTabRemoved:!tab.includes("'llm_migration'"),
  runtimePolicyTab:tab.includes("'runtime_policy'")&&tab.includes('Current Runtime Policy'),
  nonLlmVisible:tab.includes('NON_LLM_ONLY')&&tab.includes('CORE + 17 classifications'),
  externalTeacherBoundaryVisible:tab.includes('UNTRUSTED_EXTERNAL_AI / review required'),
  promotionBoundaryVisible:tab.includes('CORE_PROMOTION only'),
  legacyFileRemoved:!existsSync('src/components/self_improvement/non_llm_views/LlmMigrationSubView.tsx'),
  design:design.includes('旧LLM移管UIの退役'),
};
const passed=Object.values(checks).every(Boolean);
console.log(JSON.stringify({version:'v198',passed,checks},null,2));
if(!passed)process.exit(1);
