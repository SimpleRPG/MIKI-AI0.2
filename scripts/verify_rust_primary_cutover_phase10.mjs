import {readFileSync} from 'node:fs';
const contract=readFileSync('src/miki/execution/services/nativeOperationContractService.ts','utf8');
const failures=[];
for(const operation of ['HEALTH','SCAN_REPOSITORY','HASH_FILES','BUILD_ZIP','COPY_ZIPTXT','COMPARE_REVISIONS']){
  if(!contract.includes(`${operation}:'RUST_PRIMARY'`))failures.push(`NOT_RUST_PRIMARY:${operation}`);
}
for(const operation of ['SEARCH_TEXT','VERIFY_ARTIFACTS']){
  if(!contract.includes(`${operation}:'TYPESCRIPT_ONLY'`))failures.push(`PREMATURE_RUST_CUTOVER:${operation}`);
}
for(const term of ['RUST_PRIMARY_OPERATIONS','isRustPrimary','shouldFallback'])if(!contract.includes(term))failures.push(`CUTOVER_POLICY_MISSING:${term}`);
console.log(JSON.stringify({passed:failures.length===0,phase:'RUST_PRIMARY_CUTOVER_10',rustPrimary:['HEALTH','SCAN_REPOSITORY','HASH_FILES','BUILD_ZIP','COPY_ZIPTXT','COMPARE_REVISIONS'],typescriptOnly:['SEARCH_TEXT','VERIFY_ARTIFACTS'],fallback:true,failures},null,2));
if(failures.length)process.exitCode=1;
