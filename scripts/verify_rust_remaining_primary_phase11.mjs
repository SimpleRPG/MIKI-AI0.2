import{readFileSync}from'node:fs';
const contract=readFileSync('src/miki/execution/services/nativeOperationContractService.ts','utf8');
const service=readFileSync('src/miki/execution/services/nativeSearchArtifactService.ts','utf8');
const failures=[];
for(const operation of ['SEARCH_TEXT','VERIFY_ARTIFACTS'])if(!contract.includes(`${operation}:'TYPESCRIPT_ONLY'`))failures.push(`NOT_PREPARED:${operation}`);
for(const operation of ['SEARCH_TEXT','VERIFY_ARTIFACTS'])if(!contract.includes(`'${operation}'`))failures.push(`PRIMARY_SET_MISSING:${operation}`);
for(const term of ['searchText(','verifyArtifact(','canonicalSha256(bytes)','SEARCH_QUERY_REQUIRED'])if(!service.includes(term))failures.push(`BOUNDARY_MISSING:${term}`);
console.log(JSON.stringify({passed:failures.length===0,phase:'RUST_REMAINING_PRIMARY_11',preparedFallback:['SEARCH_TEXT','VERIFY_ARTIFACTS'],failures},null,2));if(failures.length)process.exitCode=1;
