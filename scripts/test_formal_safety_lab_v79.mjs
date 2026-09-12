import fs from 'fs';
const root=new URL('..',import.meta.url).pathname;
const checks=[];
const files=['src/services/formalSemanticsKernelService.ts','src/services/faultInjectionLabService.ts','src/services/capabilityCompositionProofService.ts','src/services/executableExplanationService.ts'];
for(const f of files) checks.push([`${f} exists`,fs.existsSync(root+f)]);
const src=files.map(f=>fs.readFileSync(root+f,'utf8')).join('\n');
checks.push(['no eval',!src.includes('eval(')]);
checks.push(['no new Function',!src.includes('new Function')]);
checks.push(['no Math.random',!src.includes('Math.random')]);
const server=fs.readFileSync(root+'server.ts','utf8');
for(const r of ['/api/miki/semantics/check','/api/miki/fault-injection/run','/api/miki/capability-composition/prove','/api/miki/executable-explanation']) checks.push([`${r} wired`,server.includes(r)]);
const bg=fs.readFileSync(root+'src/services/backgroundWorkerService.ts','utf8'); checks.push(['fault lab background wired',bg.includes('faultInjectionLabService.run')]);
let pass=0; for(const [n,v] of checks){console.log(`${v?'PASS':'FAIL'} ${n}`);if(v)pass++;}
console.log(`RESULT ${pass}/${checks.length}`); if(pass!==checks.length)process.exit(1);
