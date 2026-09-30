import {existsSync,readFileSync} from 'node:fs';
const failures=[];
const receipt=readFileSync('src/miki/execution/services/nativeOperationReceiptService.ts','utf8');
const adapter=readFileSync('src/miki/execution/services/androidNativeRunnerAdapterService.ts','utf8');
for(const term of ['miki_native_operation_receipts_v2','MAX_RECEIPTS=500','record(input','clearLegacy','byOperation'])if(!receipt.includes(term))failures.push(`RECEIPT_MISSING:${term}`);
for(const term of ["operation:'SEARCH_TEXT'","operation:'VERIFY_ARTIFACTS'","mode:'RUST_PRIMARY'"])if(!adapter.includes(term))failures.push(`ADAPTER_RECEIPT_MISSING:${term}`);
for(const file of ['src/services/autonomousSearchService.ts','src/services/researchStrategyService.ts'])if(existsSync(file))failures.push(`FACADE_NOT_DELETED:${file}`);
console.log(JSON.stringify({passed:failures.length===0,phase:'NATIVE_RECEIPT_DEDUP_14',checks:10,deleted:['src/services/autonomousSearchService.ts','src/services/researchStrategyService.ts'],failures},null,2));
if(failures.length)process.exitCode=1;
