import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const graph = read('src/services/capabilityGraphService.ts');
const confidence = read('src/services/capabilityConfidenceService.ts');
const research = read('src/services/researchService.ts');
const failure = read('src/services/failureUnderstandingService.ts');
const server = read('server.ts');

const checks = [
  ['confidence service exists', confidence.includes('class CapabilityConfidenceService')],
  ['success/failure ratio', confidence.includes('successRate') && confidence.includes('failures')],
  ['freshness decay wired', confidence.includes('experienceFreshnessService.evaluate')],
  ['environment matching', confidence.includes('environmentMatches')],
  ['implementation hash gate', confidence.includes('currentHash === observedHash') && confidence.includes('hashScore')],
  ['failure risk wired', confidence.includes('failureMemoryService.assessRisk')],
  ['stale requires revalidation', confidence.includes('revalidationRequired') && confidence.includes('markRevalidationRequest')],
  ['graph confidence ranking', graph.includes('capabilityConfidenceService.rank') && graph.includes('confidenceBoost')],
  ['stale confidence boost disabled', graph.includes('confidence?.revalidationRequired ? 0')],
  ['forced web research option', research.includes('forceRoute?: ResearchRoute') && research.includes('options.forceRoute')],
  ['failure creates knowledge gap', failure.includes("type: 'WEAK_COMPONENT'") && failure.includes('knowledgeGapService.detect')],
  ['failure forces web search', failure.includes("forceRoute: 'WEB_SEARCH'")],
  ['failure uses verifier path', failure.includes('researchService.researchGap')],
  ['confidence API', server.includes('/api/miki/capability-confidence')],
  ['failure understanding API', server.includes('/api/miki/failure-understanding')],
  ['no dynamic execution in new services', !/eval\s*\(|new Function\s*\(/.test(confidence + failure)],
  ['no random in new services', !/Math\.random\s*\(/.test(confidence + failure)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`v71 static regression PASS (${checks.length} checks)`);
