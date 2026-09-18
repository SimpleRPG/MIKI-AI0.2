import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const router=read('src/miki/core/services/domainRouterService.ts');
const bootstrap=read('src/miki/core/services/domainIntegrationBootstrapService.ts');
const planner=read('src/miki/core/services/adaptiveRoutePlannerService.ts');
const adapter=read('src/miki/core/services/domainOperationalAdapterService.ts');
const domains=['autonomy','capability','conversation','data','execution','experience','improvement','learning','memory','promotion','research','safety','selfAwareness','selfDevelopment','strategy','unknown','verification'];
const checks=[
 ['ASSESS_DOMAIN command',router.includes("'ASSESS_DOMAIN'" )],
 ['ASSESS_DOMAIN registered',bootstrap.includes("'ASSESS_DOMAIN'" )],
 ['ASSESS_DOMAIN handler',bootstrap.includes('domainOperationalAdapterService.inspect(domain)')],
 ['adaptive self improvement flow',planner.includes("kind==='SELF_IMPROVEMENT'")&&planner.includes("entry==='TYPED_IMPROVEMENT_UI_GATEWAY'")],
 ['adaptive unknown resolution',planner.includes("command:'RESOLVE_UNKNOWN'")],
 ['core completion uses plan',planner.includes('assessCompletion')&&planner.includes('coreCompletionGateService')],
 ['all operational adapters',domains.every(d=>adapter.includes(`case '${d}':`))],
 ['adapter fail closed',adapter.includes('DOMAIN_OPERATIONAL_ADAPTER_ERROR')]
];
let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
if(failed)process.exit(1);
