import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const checks = [
  ['composition/Sudachi', 'src/miki/conversation/services/japaneseAnalysisCompositionService.ts', /SUDACHI_NATIVE/],
  ['composition/Intl', 'src/miki/conversation/services/japaneseAnalysisCompositionService.ts', /INTL_SEGMENTER/],
  ['composition/deterministic', 'src/miki/conversation/services/japaneseAnalysisCompositionService.ts', /DETERMINISTIC_DICTIONARY_NGRAM/],
  ['conversation export', 'src/miki/conversation.ts', /japaneseAnalysisCompositionService/],
  ['orchestrator', 'src/miki/conversation/services/japaneseAnalysisComponentOrchestratorService.ts', /japaneseAnalysisCompositionService\.analyze/],
  ['hybrid', 'src/miki/conversation/services/hybridConversationEngineService.ts', /japaneseAnalysisCompositionService\.analyzeSync/],
  ['safety', 'src/miki/safety/services/nonLlmCoreService.ts', /japaneseAnalysisCompositionService\.analyzeSync/],
  ['memory', 'src/utils/memoryRetrieval.ts', /japaneseAnalysisCompositionService\.analyzeSync/],
];
const failed = checks.filter(([, path, pattern]) => !pattern.test(read(path)));
if (failed.length) { for (const [name] of failed) console.error(`FAIL ${name}`); process.exit(1); }
console.log('Japanese analysis composition integration PASS');
