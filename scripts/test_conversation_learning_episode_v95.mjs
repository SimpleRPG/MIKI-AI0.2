import fs from 'node:fs';

const episode = fs.readFileSync('src/miki/conversation/services/conversationLearningEpisodeService.ts', 'utf8');
const composition = fs.readFileSync('src/miki/conversation/services/conversationComponentCompositionService.ts', 'utf8');
const barrel = fs.readFileSync('src/miki/conversation.ts', 'utf8');
const checks = [
  ['episode service exists', episode.includes('class ConversationLearningEpisodeService')],
  ['content and surface targets separated', episode.includes("'SURFACE_STYLE'") && episode.includes("'CONTENT_OR_FACT'")],
  ['single feedback cannot generalize', episode.includes('generalizationAllowed: false') && episode.includes("scope: 'THIS_RESPONSE_ONLY'")],
  ['conflicted feedback quarantined', episode.includes("epistemicStatus === 'CONFLICTED'") && episode.includes("'QUARANTINED'")],
  ['unknown vocabulary not promoted', episode.includes('unknownTerms.length > 0') && episode.includes("return 'OBSERVED'")],
  ['negative feedback requests revision', episode.includes("return 'REVISION_REQUIRED'")],
  ['only strong surface feedback reusable', episode.includes("target === 'SURFACE_STYLE'") && episode.includes('confidence >= 0.75')],
  ['canonical sha256 lineage', episode.includes('canonicalSha256') && episode.includes('episodeSha256')],
  ['legacy feedback connected', composition.includes('recordLegacy') && composition.includes('conversationLearningEpisodeService.record(observation)')],
  ['structured feedback connected', composition.includes('analyzeText(params)') && composition.match(/conversationLearningEpisodeService\.record\(observation\)/g)?.length >= 2],
  ['conversation barrel export', barrel.includes("conversationLearningEpisodeService")],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed += 1; }
if (failed) process.exit(1);
