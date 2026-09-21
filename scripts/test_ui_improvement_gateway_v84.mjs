import fs from 'node:fs';
const ui = fs.readFileSync('src/components/AutonomousImprovementHome.tsx','utf8');
const gw = fs.readFileSync('src/miki/core/ui/typedImprovementUiGatewayService.ts','utf8');
const checks = [
 ['gateway imported', ui.includes('typedImprovementUiGatewayService')],
 ['loop direct import removed', !ui.includes("from '../miki/core/services/autonomousSelfImprovementLoopService'")],
 ['controller direct import removed', !ui.includes("from '../miki/improvement/services/selfImprovementControllerService'")],
 ['directive direct import removed', !ui.includes("from '../miki/execution/services/workDirectiveIngestionService'")],
 ['workspace direct import removed', !ui.includes("from '../miki/core/services/isolatedCandidateWorkspaceService'")],
 ['evidence direct import removed', !ui.includes("from '../miki/core/services/candidateValidationEvidenceService'")],
 ['core result direct import removed', !ui.includes("from '../miki/core/services/coreResultService'")],
 ['gateway read model', gw.includes('getLoopState()') && gw.includes('getCoreResults(limit = 50)')],
 ['gateway mutations', gw.includes('sendImprovementCommand') && gw.includes('resumeImprovementTask')],
 ['ui core runtime facade', ui.includes('typedImprovementUiGatewayService.requestWithResult')],
];
for (const [name, ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
if (checks.some(([,ok])=>!ok)) process.exit(1);
