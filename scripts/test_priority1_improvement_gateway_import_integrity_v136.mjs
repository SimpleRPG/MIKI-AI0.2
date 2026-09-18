import fs from 'node:fs';
const gateway = fs.readFileSync('src/miki/core/ui/typedImprovementUiGatewayService.ts','utf8');
const files = ['src/App.tsx','src/components/chat/AutonomousSelfImprovementModal.tsx','src/components/self_improvement/NonLlmArchitectureTab.tsx'];
const checks = [
 ['gateway imports controller used by getRuns/isLocked', gateway.includes("import { selfImprovementControllerService }")],
 ['gateway implements getRuns', gateway.includes('selfImprovementControllerService.listRuns()')],
 ['gateway implements lock read', gateway.includes('selfImprovementControllerService.isLocked()')],
 ...files.map(f => [`unused controller import removed from ${f}`, !fs.readFileSync(f,'utf8').includes('selfImprovementControllerService')]),
];
let failed=0;
for (const [name,ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++; }
if(failed) process.exit(1);
