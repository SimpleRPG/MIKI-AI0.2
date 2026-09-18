import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const src=path.join(root,'src');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const ui=[path.join(src,'App.tsx'),...walk(path.join(src,'components')).filter(p=>/\.tsx?$/.test(p))];
const bypass=[];
for(const p of ui){const s=fs.readFileSync(p,'utf8');if(/selfImprovementControllerService\.runOnce\s*\(/.test(s))bypass.push(path.relative(root,p));}
const ingress=read('src/miki/core/services/selfImprovementIngressService.ts');
const worker=read('src/miki/core/services/autonomousSelfImprovementLoopService.ts');
const coreIngress=read('src/miki/core/services/coreTaskIngressService.ts');
const core=read('src/miki/core/services/coreOrchestratorService.ts');
const bootstrap=read('src/miki/core/services/domainIntegrationBootstrapService.ts');
const checks=[
 ['UI_SELF_IMPROVEMENT_BYPASS_ZERO',bypass.length===0,bypass],
 ['INGRESS_TO_WORKER',/autonomousSelfImprovementLoopService\.enqueue\s*\(/.test(ingress)],
 ['WORKER_TO_CORE_INGRESS',/coreTaskIngressService\.(submit|resume)\s*\(/.test(worker)],
 ['CORE_INGRESS_TO_ORCHESTRATOR',/coreOrchestratorService\.(run|resume)\s*\(/.test(coreIngress)],
 ['CORE_OWNS_BLACKBOARD',/taskBlackboardService\.(create|get|addEntry|setStatus)/.test(core)],
 ['EXECUTION_EVENT_CORE_BRIDGE',/executionEventBusService\.subscribe/.test(bootstrap)],
 ['CLAIM_EVENT_CORE_BRIDGE',/claimVerificationEventService\.subscribe/.test(bootstrap)],
 ['SELF_IMPROVEMENT_EVENT_BRIDGE',/selfImprovementRequestEventService\.subscribe/.test(bootstrap)]
];
let fail=0;for(const [name,ok,detail] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}${detail?` ${JSON.stringify(detail)}`:''}`);if(!ok)fail++;}
if(fail)process.exit(1);
