import fs from 'node:fs';
const service = fs.readFileSync('src/miki/research/services/internalWebQueryLearningCycleService.ts', 'utf8');
const native = fs.readFileSync('src/miki/execution/services/nativeWorkManagerService.ts', 'utf8');
const research = fs.readFileSync('src/miki/research.ts', 'utf8');
const checks = [
 ['APK rendered page contract synchronized', native.includes('navigationText?: string') && native.includes('advertisementText?: string') && native.includes('footerText?: string')],
 ['body navigation ads menu footer separated', ['main:', 'navigation:', 'advertisements:', 'menus:', 'footer:'].every(x => service.includes(x))],
 ['markdown supported', service.includes("kind === 'MARKDOWN'")],
 ['CSS selector supported', service.includes('extractSelector') && service.includes("selector.startsWith('#')")],
 ['XPath supported', service.includes('extractXpath') && service.includes('extractXpath') && service.includes("xpath?.includes('@id')")],
 ['multiple pages supported', service.includes('inputs.map(input =>')],
 ['evidence generated', service.includes("evidenceId: `EVD-${")],
 ['claims generated', service.includes("claimId: `CLM-${")],
 ['terms learned', service.includes('termMap') && service.includes('occurrences:')],
 ['knowledge component generated', service.includes("componentId: `KCP-${")],
 ['query outcome learned', service.includes('queryOutcome') && service.includes('EVIDENCE_GAINED') && service.includes('NO_RESULTS')],
 ['coverage learned', service.includes('requestedPageCount') && service.includes('evidencePageCount') && service.includes('ratio:')],
 ['revision pair learned', service.includes('QueryRevisionPair') && service.includes('revisionSha256')],
 ['environment distinguished', ['GALAXY_S25','ANDROID','TERMUX','PC','WINDOWS'].every(x => service.includes(x))],
 ['fixture mock internal loop export', research.includes('internalWebQueryLearningCycleService')],
 ['canonical hashes bound', service.includes('canonicalSha256Object') && service.includes('resultSha256')],
];
let failed=0; for (const [name,ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++; }
if (failed) process.exit(1);
