import fs from 'node:fs';
const gateway=fs.readFileSync('src/miki/core/ui/typedImprovementUiGatewayService.ts','utf8');
const home=fs.readFileSync('src/components/AutonomousImprovementHome.tsx','utf8');
const checks=[
 ['gateway exports core runtime model',gateway.includes('PriorityOneRuntimeItem')&&gateway.includes('PriorityOneAllowedAction')],
 ['gateway exposes latest core runtime',gateway.includes('getLatestCoreRuntime()')],
 ['gateway derives busy state from core task and operation',gateway.includes('isCoreRuntimeBusy()')&&gateway.includes("operationStatus==='RUNNING'")],
 ['old controller lock authority removed',!gateway.includes('isImprovementLocked()')&&!gateway.includes('selfImprovementControllerService.isLocked()')],
 ['new UI stores core runtime read model',home.includes('useState<PriorityOneRuntimeItem | undefined>')],
 ['new UI refreshes core runtime',home.includes('setCoreRuntime(typedImprovementUiGatewayService.getLatestCoreRuntime())')],
 ['new UI uses core busy authority',home.includes('typedImprovementUiGatewayService.isCoreRuntimeBusy()')],
 ['new UI no longer calls old lock API',!home.includes('isImprovementLocked()')],
 ['new UI renders core task status',home.includes("coreRuntime?.taskStatus?.toUpperCase()")],
];
let failed=0;for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)failed++;}if(failed)process.exit(1);
