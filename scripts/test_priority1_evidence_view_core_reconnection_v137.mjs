import fs from 'node:fs';
const view=fs.readFileSync('src/components/self_improvement/EvidenceBasedLoopSubView.tsx','utf8');
const checks=[
 ['old controller import removed',!view.includes('improvement/services/selfImprovementControllerService')],
 ['old decide call removed',!view.includes('selfImprovementControllerService.decide()')],
 ['typed core gateway connected',view.includes('typedImprovementUiGatewayService')],
 ['core runtime recovery read used',view.includes('listRestoredPriorityOneRuntime()')],
 ['core status display wired',view.includes('{coreRuntimeStatus}')],
 ['no obsolete decision state',!view.includes('targetDecision')&&!view.includes('ImprovementDecision')],
];
let failed=0; for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)failed++;} if(failed)process.exit(1);
