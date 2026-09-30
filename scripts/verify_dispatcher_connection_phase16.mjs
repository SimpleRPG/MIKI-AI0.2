import {readFileSync} from 'node:fs';
const adapter=readFileSync('src/miki/execution/services/androidNativeRunnerAdapterService.ts','utf8');
const failures=[];
const expected={
  executeScanRepository:'SCAN_REPOSITORY',
  executeHashFiles:'HASH_FILES',
  executeBuildZip:'BUILD_ZIP',
  executeCopyZipTxt:'COPY_ZIPTXT',
  executeCompareRevisions:'COMPARE_REVISIONS',
  executeSearchText:'SEARCH_TEXT',
  executeVerifyArtifacts:'VERIFY_ARTIFACTS',
};
for(const [method,operation] of Object.entries(expected)){
  if(!adapter.includes(`public async ${method}`))failures.push(`METHOD_MISSING:${method}`);
  if(!adapter.includes(`execute('${operation}'`))failures.push(`DISPATCH_MISSING:${operation}`);
}
if(adapter.includes('nativeOperationReceiptService'))failures.push('ADAPTER_LOCAL_RECEIPT_REMAINS');
if(!adapter.includes("type NativeDispatchResult"))failures.push('DISPATCH_RESULT_TYPE_MISSING');
console.log(JSON.stringify({passed:failures.length===0,phase:'DISPATCHER_CONNECTION_16',operations:Object.values(expected),adapterLocalReceiptCount:(adapter.match(/nativeOperationReceiptService/g)||[]).length,checks:16,failures},null,2));
if(failures.length)process.exitCode=1;
