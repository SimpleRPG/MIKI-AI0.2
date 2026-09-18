import fs from 'node:fs';
const planning = fs.readFileSync('src/miki/research/services/researchQueryPlanningService.ts', 'utf8');
const selection = fs.readFileSync('src/miki/research/services/queryPatternSelectionService.ts', 'utf8');
const repository = fs.readFileSync('src/miki/research/services/queryPatternRepositoryService.ts', 'utf8');
const barrel = fs.readFileSync('src/miki/research/index.ts', 'utf8');
const checks = [
  ['selector exists', selection.includes('class QueryPatternSelectionService')],
  ['only active selected', selection.includes("pattern.lifecycle !== 'ACTIVE'")],
  ['failure pattern excluded', selection.includes('FAILURE_HISTORY_PRESENT')],
  ['independent evidence required', selection.includes('INSUFFICIENT_INDEPENDENT_EVIDENCE')],
  ['environment mismatch excluded', selection.includes('ENVIRONMENT_NOT_APPLICABLE')],
  ['selection sha256', selection.includes('selectionSha256') && selection.includes('canonicalSha256Object')],
  ['planning uses selector', planning.includes('queryPatternSelectionService.select')],
  ['plan records used patterns', planning.includes('usedQueryPatternIds:patternSelection.selectedPatternIds')],
  ['plan records excluded patterns', planning.includes('excludedQueryPatternIds:patternSelection.excludedPatternIds')],
  ['single pattern repository', repository.includes("miki_query_pattern_repository_v80")],
  ['research export', barrel.includes('queryPatternSelectionService')],
];
let failed = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) failed += 1;
}
if (failed) process.exit(1);
