import fs from 'node:fs';
const outcome = fs.readFileSync('src/miki/research/services/researchQueryOutcomeLearningService.ts', 'utf8');
const barrel = fs.readFileSync('src/miki/research.ts', 'utf8');
const checks = [
  ['outcome ledger', outcome.includes('miki_research_query_outcome_v79')],
  ['query identity verification', outcome.includes('QUERY_PLAN_OR_QUERY_NOT_FOUND') && outcome.includes('QUERY_TEXT_MISMATCH')],
  ['persistence reload verification', outcome.includes('QUERY_OUTCOME_PERSISTENCE_FAILED')],
  ['revision budget', outcome.includes('maxRevisionPerQuery') && outcome.includes('REVISION_BUDGET_EXHAUSTED')],
  ['privacy fail closed', outcome.includes("latest.status === 'PRIVACY_BLOCKED'")],
  ['environment revision', outcome.includes('Galaxy S25 arm64 Capacitor WebView')],
  ['no result revision', outcome.includes("latest.status === 'NO_RESULTS'")],
  ['evidence no revision', outcome.includes('EVIDENCE_GAINED_NO_REVISION')],
  ['canonical sha256', outcome.includes('canonicalSha256Object')],
  ['research barrel export', barrel.includes("researchQueryOutcomeLearningService")],
  ['18 domain wording', barrel.includes('18分類における') && !barrel.includes('16分類における')],
  ['todo entrypoint removed', !barrel.includes('TODO: research 関連')],
];
let failed=0;
for (const [name, pass] of checks) { console.log(`${pass?'PASS':'FAIL'} ${name}`); if(!pass) failed++; }
if (failed) process.exit(1);
