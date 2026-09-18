import fs from 'node:fs';
const adapter = fs.readFileSync('src/miki/conversation/services/coreResultAnswerContentIrService.ts', 'utf8');
const runtime = fs.readFileSync('src/miki/conversation/services/runtimeConversationCompositionService.ts', 'utf8');
const learning = fs.readFileSync('src/miki/conversation/services/conversationLearningEpisodeService.ts', 'utf8');
const barrel = fs.readFileSync('src/miki/conversation.ts', 'utf8');
const checks = [
  ['core Result adapter exists', adapter.includes('class CoreResultAnswerContentIrService')],
  ['facts stay explicit', adapter.includes('確認済み:') && adapter.includes("kind: 'FACT'")],
  ['assumptions stay explicit', adapter.includes('推測:') && adapter.includes("kind: 'ASSUMPTION'")],
  ['unverified stays explicit', adapter.includes('未確認:') && adapter.includes("kind: 'UNVERIFIED'")],
  ['proposals stay explicit', adapter.includes('提案:') && adapter.includes("kind: 'PROPOSAL'")],
  ['failure reason stays explicit', adapter.includes('失敗理由:') && adapter.includes("kind: 'FAILURE_REASON'")],
  ['completion is status gated', adapter.includes("coreResult.status === 'completed'") && adapter.includes('completionClaimAllowed')],
  ['persona excluded from semantic adapter', !adapter.includes('personaProfileService') && !adapter.includes('MultiAxisPersonaConfig')],
  ['runtime composes core Result', runtime.includes('composeCoreResult(coreResult: CoreResult') && runtime.includes('coreResultAnswerContentIrService.convert(coreResult)')],
  ['conversation learning reused by similar scene', learning.includes('findReusableForSimilarScene') && learning.includes('similarity') && runtime.includes('reusedConversationEpisodeIds')],
  ['category barrel exports adapter', barrel.includes('coreResultAnswerContentIrService')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed += 1; }
if (failed) process.exit(1);
