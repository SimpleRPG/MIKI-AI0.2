import fs from 'node:fs';
const ui=fs.readFileSync('src/components/GitHubHub.tsx','utf8');
const gw=fs.readFileSync('src/miki/core/ui/typedGitHubUiGatewayService.ts','utf8');
const checks=[
 ['gateway imported',ui.includes('typedGitHubUiGatewayService')],
 ['api direct import removed',!ui.includes("from '../services/api'")],
 ['storage direct import removed',!ui.includes("from '../services/storageService'")],
 ['domain services direct import removed',!ui.includes("from '../miki/core/services/") && !ui.includes("from '../miki/unknown/services/")],
 ['github api routed',ui.includes('typedGitHubUiGatewayService.api.importFromGitHub') && ui.includes('typedGitHubUiGatewayService.api.pushToGitHub')],
 ['directive routed',ui.includes('typedGitHubUiGatewayService.externalDirective.receiveTextFile')],
 ['settings routed',ui.includes('typedGitHubUiGatewayService.storage.setItem')],
 ['18 domain diagnostics routed',ui.includes('typedGitHubUiGatewayService.circulation.getCoverage') && ui.includes('typedGitHubUiGatewayService.bootstrap.getStatus')],
 ['improvement controls routed',ui.includes('typedGitHubUiGatewayService.improvementDirection.setDirection') && ui.includes('typedGitHubUiGatewayService.issueDiscovery.scan')],
 ['gateway owns integrations',gw.includes('readonly api = apiService') && gw.includes('readonly externalDirective = externalDirectiveIntakeService')],
];
let failed=0; for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`); if(!ok) failed++;} process.exit(failed?1:0);
