import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const core=read('src/miki/core/services/coreOrchestratorService.ts');
const planner=read('src/miki/core/services/adaptiveRoutePlannerService.ts');
const bootstrap=read('src/miki/core/services/domainIntegrationBootstrapService.ts');
const router=read('src/miki/core/services/domainRouterService.ts');
const checks=[
 ['domain result keeps responding domain',core.includes("sourceDomain:route.target")&&core.includes("reply.accepted?'RESULT':'ERROR'")],
 ['core collection metadata retained',core.includes("collectedBy:'core'")],
 ['old core-only result removed',!core.includes("reply.accepted?'RESULT':'ERROR','core',`coreCollected")],
 ['planner uses visited domains',planner.includes('operationInstanceId')&&planner.includes('canonicalRouteKey(route)')],
 ['planner dispatches operational assessment',planner.includes("command:'ASSESS_DOMAIN'")],
 ['bootstrap handles operational assessment',bootstrap.includes("envelope.command==='ASSESS_DOMAIN'")],
 ['router supports operational assessment',router.includes("'ASSESS_DOMAIN'")],
 ['core reevaluates after collection',core.includes('coreReevaluation')],
 ['core alone decides completion',core.includes('adaptiveRoutePlannerService.assessCompletion')]
];
let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed+=1;}
if(failed)process.exit(1);
