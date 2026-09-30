import{readFileSync}from'node:fs';const failures=[];const dispatcher=readFileSync('src/miki/execution/services/nativeOperationDispatcherService.ts','utf8');const receipt=readFileSync('src/miki/execution/services/nativeOperationReceiptService.ts','utf8');
for(const t of ['nativeOperationContractService.mode','shouldFallback','RUST_ONLY','TYPESCRIPT_FALLBACK','fallbackUsed','nativeOperationReceiptService.record'])if(!dispatcher.includes(t))failures.push(`DISPATCHER_MISSING:${t}`);
for(const t of ["status:'FALLBACK'","engine:'TYPESCRIPT'"])if(!dispatcher.includes(t))failures.push(`FALLBACK_RECEIPT_MISSING:${t}`);
if(!receipt.includes("'FALLBACK'"))failures.push('RECEIPT_FALLBACK_STATUS_MISSING');
console.log(JSON.stringify({passed:failures.length===0,phase:'NATIVE_DISPATCHER_15',checks:9,failures},null,2));if(failures.length)process.exitCode=1;
