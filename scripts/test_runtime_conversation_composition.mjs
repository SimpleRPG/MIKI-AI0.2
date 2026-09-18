import fs from 'node:fs';
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const service = read('src/miki/conversation/services/runtimeConversationCompositionService.ts');
const core = read('src/miki/safety/services/nonLlmCoreService.ts');
const hybrid = read('src/miki/conversation/services/hybridConversationEngineService.ts');
const checks = [[service,/DEFAULT_MAX_CANDIDATES = 4/],[service,/DEFAULT_TIME_BUDGET_MS = 12/],[service,/CACHE_TTL_MS/],[service,/inspection\.isPreserved/],[core,/runtimeConversationCompositionService\.compose/],[hybrid,/runtimeConversationCompositionService\.compose/]];
if (checks.some(([text, pattern]) => !pattern.test(text))) process.exit(1);
console.log('Runtime conversation composition integration PASS');
