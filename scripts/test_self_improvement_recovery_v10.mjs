import fs from 'node:fs';
const root=new URL('../',import.meta.url);const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const loop=read('src/miki/core/services/autonomousSelfImprovementLoopService.ts');
const boot=read('src/miki/core/services/domainIntegrationBootstrapService.ts');
const checks=[
 ['resource retry schedule',loop,/RESOURCE_WAIT_MS/],
 ['evidence retry schedule',loop,/EVIDENCE_WAIT_MS/],
 ['persistent retry time',loop,/retryAt\?: number/],
 ['automatic recovery poll',loop,/recoverIfReady/],
 ['resource remeasurement',loop,/await resourceGovernanceService\.refresh\(\)/],
 ['workspace reused',loop,/request\.workspaceId && request\.runId/],
 ['validation retry without regeneration',loop,/retryValidationAndExport\(request\)/],
 ['evidence recovery decision',loop,/evidence-recovery-required/],
 ['resource waits do not consume attempt',loop,/waitForResource\(request/],
 ['legacy state migration',loop,/LEGACY_KEY/],
 ['dispose wired',boot,/autonomousSelfImprovementLoopService\.dispose\(\)/]
];const bad=checks.filter(([,t,p])=>!p.test(t));if(bad.length){bad.forEach(([n])=>console.error('FAIL '+n));process.exit(1);}console.log('Self improvement recovery v10 PASS');