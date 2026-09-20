import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const aut=read('src/miki/autonomy/services/autonomousContinuousEvolutionService.ts');
const server=read('server.ts');
const design=read('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt');
const checks={
  noActiveExternalGenerationConfig:!aut.includes('getActiveExternalConfig()')&&!aut.includes('activeLlm.endpoint')&&!aut.includes('activeLlm.model'),
  deterministicTargetFallback:aut.includes('const fallbackChapterNumber = 171;')&&!aut.includes('Math.random() * 50'),
  noFabricatedCausalGain:aut.includes('() => previousScore,\n        () => previousScore,')&&aut.includes('const projectedScoreDelta = 0;'),
  forcedReviewBoundary:aut.includes('const isApprovalRequired = true;')&&aut.includes('V183_CANONICAL_REVIEW_ONLY'),
  stagedState:aut.includes("adoptionState: 'STAGED'")&&aut.includes("deploymentState: 'LOCAL_PATCH'"),
  legacySentryNotApplied:server.includes('instantAutoApplied: false')&&server.includes("recoveryStatus: 'STAGED_FOR_REVIEW'")&&server.includes('requiresCoreReview: true'),
  specNoAutoProductionApply:design.includes('本番コード自動適用は行わない')
};
const passed=Object.values(checks).every(Boolean);
console.log(JSON.stringify({version:'v183',passed,checks},null,2));
if(!passed)process.exit(1);
