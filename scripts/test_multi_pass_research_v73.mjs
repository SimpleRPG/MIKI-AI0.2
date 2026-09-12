import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const research = read('src/services/researchService.ts');
const reval = read('src/services/autonomousRevalidationLoopService.ts');
const failure = read('src/services/failureUnderstandingService.ts');
const checks = [
  ['multi-pass research exists', research.includes('maxPasses') && research.includes('second-pass independent verification')],
  ['freshness gate supported', research.includes('requireFresh') && research.includes('maxAgeDays')],
  ['cache bypass on second pass', research.includes('bypassCache: pass > 0')],
  ['verifier remains truth boundary', research.includes('verifierService.verifyMany')],
  ['revalidation requires fresh evidence', reval.includes('requireFresh: true') && reval.includes('maxAgeDays: 30')],
  ['revalidation promotes verified knowledge', reval.includes('verifiedKnowledgePromotionService.promote')],
  ['revalidation promotes capability knowledge', reval.includes('verifiedCapabilityPromotionService.promote')],
  ['failure research multi-pass', failure.includes('maxPasses: 3')],
  ['failure research promotes verified knowledge', failure.includes('verifiedKnowledgePromotionService.promote')],
  ['no eval', !research.includes('eval(') && !reval.includes('eval(') && !failure.includes('eval(')],
  ['no new Function', !research.includes('new Function') && !reval.includes('new Function') && !failure.includes('new Function')],
  ['no Math.random', !research.includes('Math.random') && !reval.includes('Math.random') && !failure.includes('Math.random')],
];
let ok=0;
for (const [name, pass] of checks) { console.log(`${pass?'PASS':'FAIL'} ${name}`); if(pass) ok++; }
if(ok!==checks.length) process.exit(1);
console.log(`v73 multi-pass research regression PASS (${ok}/${checks.length})`);
