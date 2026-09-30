import {existsSync,readFileSync} from 'node:fs';const failures=[];
const rust=readFileSync('native/miki-native-core/src/lib.rs','utf8');const kotlin=readFileSync('android/app/src/main/java/com/miki/ai/MIKINativeCore.kt','utf8');const plugin=readFileSync('android/app/src/main/java/com/miki/ai/MIKINativeRunnerPlugin.kt','utf8');const adapter=readFileSync('src/miki/execution/services/androidNativeRunnerAdapterService.ts','utf8');const contract=readFileSync('src/miki/execution/services/nativeOperationContractService.ts','utf8');const tools=readFileSync('src/services/toolsService.ts','utf8');
for(const term of ['nativeBuildZip','ZipWriter::new','ZIP_ENTRY_DUPLICATE','API_VERSION: jint = 8'])if(!rust.includes(term))failures.push(`RUST_ZIP_MISSING:${term}`);
if(!kotlin.includes('EXPECTED_API_VERSION = 8'))failures.push('KOTLIN_API_V5_MISSING');
for(const term of ['buildWorkspaceZip','RUST_ZIP_ENTRY_LIST_MISMATCH','RUST_ZIP_ENTRY_SIZE_MISMATCH','ZipFile(output)'])if(!plugin.includes(term))failures.push(`PLUGIN_ZIP_MISSING:${term}`);
if(!adapter.includes('buildWorkspaceZip'))failures.push('ADAPTER_ZIP_MISSING');if(!contract.includes("BUILD_ZIP:'RUST_PRIMARY'"))failures.push('BUILD_ZIP_NOT_SHADOW');
if(existsSync('src/services/cognitiveDebuggerService.ts'))failures.push('COGNITIVE_DEBUGGER_FACADE_NOT_DELETED');
if(!tools.includes("../miki/verification/services/cognitiveDebuggerService"))failures.push('COGNITIVE_DEBUGGER_IMPORT_NOT_REDIRECTED');
console.log(JSON.stringify({passed:failures.length===0,phase:'RUST_ZIP_DEDUP_8',checks:14,deleted:['src/services/cognitiveDebuggerService.ts'],failures},null,2));if(failures.length)process.exitCode=1;
