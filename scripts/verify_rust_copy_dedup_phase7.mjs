import {existsSync,readFileSync} from 'node:fs';const failures=[];
const rust=readFileSync('native/miki-native-core/src/lib.rs','utf8');const kotlin=readFileSync('android/app/src/main/java/com/miki/ai/MIKINativeCore.kt','utf8');const plugin=readFileSync('android/app/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt','utf8');const adapter=readFileSync('src/miki/execution/services/androidNativeRunnerAdapterService.ts','utf8');const contract=readFileSync('src/miki/execution/services/nativeOperationContractService.ts','utf8');const importer=readFileSync('src/services/improvementRegressionCoordinatorService.ts','utf8');
for(const term of ['nativeCopyFile','BufWriter::with_capacity','sync_all','nativeCopyFile'])if(!rust.includes(term))failures.push(`RUST_COPY_MISSING:${term}`);
if(!kotlin.includes('EXPECTED_API_VERSION = 8'))failures.push('KOTLIN_API_V4_MISSING');
for(const term of ['copyZipTxt','RUST_ZIPTXT_SHADOW_MISMATCH','ZIPTXT_EXTENSION_CONTRACT_FAILED'])if(!plugin.includes(term))failures.push(`PLUGIN_COPY_MISSING:${term}`);
if(!adapter.includes('copyZipTxt'))failures.push('ADAPTER_COPY_MISSING');if(!contract.includes("COPY_ZIPTXT:'RUST_PRIMARY'"))failures.push('COPY_ZIPTXT_NOT_SHADOW');
if(existsSync('src/services/androidNativeRunnerAdapterService.ts'))failures.push('LEGACY_DUPLICATE_ADAPTER_STILL_EXISTS');
if(!importer.includes("../miki/execution/services/androidNativeRunnerAdapterService"))failures.push('LEGACY_IMPORT_NOT_REDIRECTED');
console.log(JSON.stringify({passed:failures.length===0,phase:'RUST_COPY_DEDUP_7',checks:12,deleted:['src/services/androidNativeRunnerAdapterService.ts'],failures},null,2));if(failures.length)process.exitCode=1;
