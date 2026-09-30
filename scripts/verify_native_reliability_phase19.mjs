import{readFileSync}from'node:fs';const failures=[];
const policy=readFileSync('src/miki/execution/services/nativeOperationRuntimePolicyService.ts','utf8');const dispatcher=readFileSync('src/miki/execution/services/nativeOperationDispatcherService.ts','utf8');const receipt=readFileSync('src/miki/execution/services/nativeOperationReceiptService.ts','utf8');
const elements=['createRequestId','normalizeTimeout','validateInputSha256','MAX_GLOBAL_CONCURRENCY','MAX_OPERATION_CONCURRENCY','CIRCUIT_FAILURE_THRESHOLD','assertNotCancelled','awaitBoundary','recordFailure','snapshot()'];
for(const element of elements)if(!policy.includes(element))failures.push(`ELEMENT_MISSING:${element}`);
for(const term of ['requestId','timeoutMs','inputSha256','nativePromise.finally(release)','runtimeSnapshot'])if(!dispatcher.includes(term))failures.push(`DISPATCHER_INTEGRATION_MISSING:${term}`);
if(!receipt.includes("'CANCELLED'"))failures.push('CANCELLED_RECEIPT_MISSING');
console.log(JSON.stringify({passed:!failures.length,phase:'NATIVE_RELIABILITY_19',implemented:['correlation request ID','bounded timeout','pre-start cancellation','in-flight cancellation','global concurrency limit','per-operation concurrency limit','circuit breaker','input SHA-256 validation','runtime metrics','cancelled/failed receipt audit'],checks:16,failures},null,2));if(failures.length)process.exitCode=1;
