import fs from 'node:fs';
const s=fs.readFileSync('src/miki/core/services/candidateCodeGenerationService.ts','utf8');
const checks=[
['two bounded attempts',s.includes('while(attemptCount<2&&!parsed)')],
['timeout',s.includes('setTimeout(()=>controller.abort(),90000)')&&s.includes('CODE_GENERATION_TIMEOUT')],
['repair retry',s.includes('Previous response was rejected')],
['robust response containers',s.includes('extractResponseText')&&s.includes("['response','text','content','message','answer']")],
['json object extraction',s.includes("cleaned.indexOf('{')")&&s.includes("cleaned.lastIndexOf('}')")],
['persistent ledger',s.includes('miki_candidate_generation_ledger_v2')],
['canonical response SHA',s.includes('canonicalSha256(responseText)')],
['no FNV response hash',!s.includes('fnv1a-')],
['isolated workspace after parse',s.indexOf('if(!parsed)return')<s.indexOf('prepareForRun(runId,files)')],
['existing validation pipeline retained',fs.readFileSync('src/miki/core/services/autonomousSelfImprovementLoopService.ts','utf8').includes('candidateValidationRunnerService.run')]
];let fail=0;for(const [n,p] of checks){console.log(`${p?'PASS':'FAIL'} ${n}`);if(!p)fail++;}if(fail)process.exit(1);
