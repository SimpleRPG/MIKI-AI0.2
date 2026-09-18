import fs from 'node:fs';
const github=fs.readFileSync('src/miki/core/ui/typedGitHubUiGatewayService.ts','utf8');
const hub=fs.readFileSync('src/components/GitHubHub.tsx','utf8');
const architect=fs.readFileSync('src/miki/core/ui/typedSelfCodeArchitectUiGatewayService.ts','utf8');
const checks={githubNoLegacyLoop:!github.includes('autonomousSelfImprovementLoopService')&&!github.includes('readonly improvementLoop'),githubCoreReadModel:github.includes('priorityOneRuntimeReadModelService.list()')&&github.includes('getImprovementStatus'),hubNoLegacyLoop:!hub.includes('typedGitHubUiGatewayService.improvementLoop'),hubCoreStatus:hub.includes('typedGitHubUiGatewayService.getImprovementStatus()'),architectNoController:!architect.includes('selfImprovementControllerService')&&!architect.includes('improvementController')};
for(const [name,ok] of Object.entries(checks))console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(Object.values(checks).some(ok=>!ok))process.exit(1);
console.log(`PASS ${Object.keys(checks).length}/${Object.keys(checks).length}`);
