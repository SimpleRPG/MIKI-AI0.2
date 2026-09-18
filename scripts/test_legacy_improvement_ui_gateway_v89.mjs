import fs from 'node:fs';
const ui=fs.readFileSync('src/components/self_improvement/AutonomousImprovementSettingsPanel.tsx','utf8');
const gw=fs.readFileSync('src/miki/core/ui/typedImprovementUiGatewayService.ts','utf8');
const checks=[
 ['uses typed gateway',ui.includes('typedImprovementUiGatewayService')],
 ['no coreResult direct import',!ui.includes("core/services/coreResultService")],
 ['no controller direct import',!ui.includes("improvement/services/selfImprovementControllerService")],
 ['no directive direct import',!ui.includes("execution/services/workDirectiveIngestionService")],
 ['directive through gateway',ui.includes('typedImprovementUiGatewayService.ingestDirectiveText')],
 ['runtime init through gateway',ui.includes('typedImprovementUiGatewayService.initializeImprovementRuntime')],
 ['request through gateway',ui.includes('typedImprovementUiGatewayService.submitImprovementRequest')],
 ['gateway exposes directive text',gw.includes('ingestDirectiveText(...args')],
 ['gateway exposes init',gw.includes('initializeImprovementRuntime()')],
 ['github action preserved',fs.existsSync('.github/workflows/build-apk.yml')],
 ['gradle wrapper preserved',fs.existsSync('android/gradle/wrapper/gradle-wrapper.jar')]
];
let fail=0; for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`); if(!ok) fail++;} process.exit(fail?1:0);
