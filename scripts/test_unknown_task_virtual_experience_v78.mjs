import fs from 'fs';
const utd=fs.readFileSync('src/services/unknownTaskDecompositionService.ts','utf8');
const vexp=fs.readFileSync('src/services/virtualExperienceGeneratorService.ts','utf8');
const bg=fs.readFileSync('src/services/backgroundWorkerService.ts','utf8');
const server=fs.readFileSync('server.ts','utf8');
const checks=[
 ['unknown task service', utd.includes('class UnknownTaskDecompositionService')],
 ['deterministic id', utd.includes('UTD-${this.hash(normalized)}')],
 ['unknown boundary', utd.includes('未知部分は研究・検証を通るまで実行能力として扱いません')],
 ['validation gate', utd.includes("record.status = all ? 'VALIDATED' : 'BLOCKED'")],
 ['virtual experience service', vexp.includes('class VirtualExperienceGeneratorService')],
 ['contract source', vexp.includes('counterexampleContractRefinementService.list')],
 ['no execution promotion', vexp.includes('実Regressionへ直接昇格しません')],
 ['continuum wired', vexp.includes('mikiUnifiedLearningContinuumService.observe')],
 ['background wired', bg.includes('virtualExperienceGeneratorService.generateFromContracts')],
 ['api decomposition', server.includes("/api/miki/unknown-task/decompose")],
 ['api virtual experience', server.includes("/api/miki/virtual-experience/generate")],
 ['no eval', !utd.includes('eval(') && !vexp.includes('eval(')],
 ['no new Function', !utd.includes('new Function') && !vexp.includes('new Function')],
 ['no Math.random', !utd.includes('Math.random') && !vexp.includes('Math.random')],
];
let pass=0;for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(ok)pass++;}
console.log(`${pass}/${checks.length} PASS`);if(pass!==checks.length)process.exit(1);
