import fs from 'fs';
const root=new URL('..',import.meta.url).pathname;
const read=p=>fs.readFileSync(root+p,'utf8');
const checks=[];
const a=read('src/services/automationStudioService.ts');
checks.push(['automation has guarded state machine', ['ALLOWED','VIRTUAL_REPLAY_REQUIRED','LIMITED_STAGE_REQUIRED'].every(x=>a.includes(x))]);
checks.push(['automation has virtual replay and confirmation', ['recordVirtualReplay','confirm'].every(x=>a.includes(x))]);
const n=read('src/services/digitalResearchNoteService.ts');
checks.push(['research notes retain evidence/counterevidence/version', ['evidenceIds','counterevidence','version','revalidateAt'].every(x=>n.includes(x))]);
checks.push(['research notes no Math.random id', !n.includes('Math.random')]);
const r=read('src/services/resourceGovernanceService.ts');
checks.push(['resource budgets expose four load tiers', ['LIGHT','MEDIUM','HEAVY','EXTREME'].every(x=>r.includes(x))]);
const s=read('server.ts');
checks.push(['server routes v86 services', ['/api/miki/automation','/api/miki/research-notes','/api/miki/resources'].every(x=>s.includes(x))]);
checks.push(['no local LLM runtime import in v86 services', !read('src/services/mikiSelfCodingSuperchargerService.ts').includes("generationMethod: 'llm_local'" )]);
let pass=0; for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`); if(ok)pass++;}
console.log(`RESULT ${pass}/${checks.length} PASS`); if(pass!==checks.length)process.exit(1);
