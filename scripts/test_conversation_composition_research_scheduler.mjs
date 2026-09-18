import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const service = read('src/miki/conversation/services/conversationCompositionResearchSchedulerService.ts');
const bootstrap = read('src/miki/core/services/domainIntegrationBootstrapService.ts');
const checks = [
  ['scheduler', /setInterval/],
  ['resource gate', /canRunComponentTests/],
  ['idle charging gate', /isIdleOrCharging/],
  ['unresearched signatures', /researchedSignatures/],
  ['bounded cycle', /maxCombinationsPerCycle/],
  ['composition generation', /composeConversation/],
  ['persistence', /STATE_KEY/],
  ['bootstrap initialize', /conversationCompositionResearchSchedulerService\.initialize/],
  ['bootstrap dispose', /conversationCompositionResearchSchedulerService\.dispose/],
];
const sources = [service, service, service, service, service, service, service, bootstrap, bootstrap];
const failed = checks.filter(([, pattern], index) => !pattern.test(sources[index]));
if (failed.length) { for (const [name] of failed) console.error(`FAIL ${name}`); process.exit(1); }
console.log('Conversation composition research scheduler integration PASS');
