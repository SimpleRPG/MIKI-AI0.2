import {readFileSync} from 'node:fs';
const plugin=readFileSync('android/app/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt','utf8');
const adapter=readFileSync('src/miki/execution/services/androidNativeRunnerAdapterService.ts','utf8');
const contract=readFileSync('src/miki/execution/services/nativeOperationContractService.ts','utf8');
const failures=[];
for(const term of ['hashWorkspaceFiles','sha256FileKotlin','RUST_TYPESCRIPT_SHADOW_HASH_MISMATCH','HASH_FILE_COUNT_LIMIT_EXCEEDED','aggregate_sha256','Thread {'])if(!plugin.includes(term))failures.push(`PLUGIN_SHADOW_TERM_MISSING:${term}`);
for(const term of ['hashWorkspaceFiles','RUST_HASH_FILES_SHADOW_COUNT_MISMATCH','RUST_HASH_FILES_SHADOW_MISMATCH','aggregateSha256'])if(!adapter.includes(term))failures.push(`ADAPTER_SHADOW_TERM_MISSING:${term}`);
if(!contract.includes("HASH_FILES:'SHADOW'"))failures.push('HASH_FILES_NOT_IN_SHADOW_MODE');
console.log(JSON.stringify({passed:failures.length===0,phase:'RUST_HASH_FILES_SHADOW_3',checks:11,failures},null,2));if(failures.length)process.exitCode=1;
