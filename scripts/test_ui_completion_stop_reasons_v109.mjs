import fs from 'node:fs';
const core=fs.readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
const gateway=fs.readFileSync('src/miki/core/ui/typedImprovementUiGatewayService.ts','utf8');
const ui=fs.readFileSync('src/components/AutonomousImprovementHome.tsx','utf8');
const fields=['missingDomains','failedDomains','missingReceipts','missingRequiredOperations','completionReasons'];
for(const field of fields){if(!core.includes(field)||!gateway.includes(field)||!ui.includes(field)){console.error(`completion stop field disconnected: ${field}`);process.exit(1);}}
if(!core.includes('buildIncompleteCirculationResult')||!core.includes('coreResultService.waiting(reqId,{...waitingResult')){console.error('waiting Core Result lacks completion assessment');process.exit(1);}
if(!ui.includes('Stop reasons:')||!ui.includes('Missing domains:')){console.error('UI does not show fail-closed stop reasons');process.exit(1);}
console.log('PASS UI completion stop reasons v109');
