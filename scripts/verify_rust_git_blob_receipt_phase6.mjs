import {readFileSync} from 'node:fs';const failures=[];
const rust=readFileSync('native/miki-native-core/src/lib.rs','utf8');const kotlin=readFileSync('android/app/src/main/java/com/miki/ai/MIKINativeCore.kt','utf8');const plugin=readFileSync('android/app/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt','utf8');const adapter=readFileSync('src/miki/execution/services/androidNativeRunnerAdapterService.ts','utf8');const receipts=readFileSync('src/miki/execution/services/nativeOperationReceiptService.ts','utf8');
for(const term of ['nativeGitBlobSha1File','Sha1::new','blob {}\\0','nativeGitBlobSha1File'])if(!rust.includes(term))failures.push(`RUST_BLOB_MISSING:${term}`);
if(!kotlin.includes('EXPECTED_API_VERSION = 8'))failures.push('KOTLIN_API_CURRENT_MISSING');
for(const term of ['gitBlobShaWorkspaceFile','RUST_GIT_BLOB_SHADOW_MISMATCH','MessageDigest.getInstance("SHA-1")'])if(!plugin.includes(term))failures.push(`PLUGIN_BLOB_MISSING:${term}`);
for(const term of ['gitBlobShaWorkspaceFile','RUST_GIT_BLOB_SHA_INVALID','recordScanShadow'])if(!adapter.includes(term))failures.push(`ADAPTER_PHASE6_MISSING:${term}`);
for(const term of ["operation:'SCAN_REPOSITORY'",'byOperation','MAX_RECEIPTS=300'])if(!receipts.includes(term))failures.push(`RECEIPT_PHASE6_MISSING:${term}`);
console.log(JSON.stringify({passed:failures.length===0,phase:'RUST_GIT_BLOB_RECEIPT_6',checks:14,failures},null,2));if(failures.length)process.exitCode=1;
