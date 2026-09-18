import fs from 'node:fs';
const candidate=fs.readFileSync('src/miki/core/services/candidateCodeGenerationService.ts','utf8');
const registry=fs.readFileSync('src/miki/core/services/storageAuthorityRegistryService.ts','utf8');
const checks={noEmptyCatch:!candidate.includes('catch{}'),readFailure:candidate.includes('PERSISTENCE_FAILED:CANDIDATE_LEDGER_READ'),writeFailure:candidate.includes('PERSISTENCE_FAILED:CANDIDATE_LEDGER_WRITE'),reload:candidate.includes('RELOAD_MISSING'),hash:candidate.includes('RELOAD_HASH_MISMATCH')&&candidate.includes('canonicalSha256(record)'),registry:registry.includes('assertUnique')&&registry.includes('candidateCodeGenerationService')&&registry.includes('coreResultService')};
for(const [name,ok] of Object.entries(checks))console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(Object.values(checks).some(ok=>!ok))process.exit(1);
console.log(`PASS ${Object.keys(checks).length}/${Object.keys(checks).length}`);
