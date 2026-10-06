import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];
const warnings = [];
const requiredOperations = ['SCAN_REPOSITORY','HASH_FILES','BUILD_ZIP','COPY_ZIPTXT','COMPARE_REVISIONS','SEARCH_TEXT','VERIFY_ARTIFACTS'];
const requiredDomains = ['autonomy','capability','conversation','data','execution','experience','improvement','learning','memory','promotion','research','safety','self_awareness','self_development','strategy','unknown','verification'];
const ignoredDirectories = new Set(['node_modules','dist','.git','target','build']);

function text(path) { return readFileSync(join(root, path), 'utf8'); }
function walk(dir, extensions) {
  const out = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(rel, extensions));
    else if (extensions.some(ext => entry.name.endsWith(ext))) out.push(rel);
  }
  return out;
}
const contractPath = 'src/miki/execution/services/nativeOperationContractService.ts';
const dispatcherPath = 'src/miki/execution/services/nativeOperationDispatcherService.ts';
const adapterPath = 'src/miki/execution/services/androidNativeRunnerAdapterService.ts';
const kotlinPath = 'android/app/src/main/java/com/miki/ai/MIKINativeCore.kt';
const rustLibPath = 'native/miki-native-core/src/lib.rs';

for (const path of [contractPath, dispatcherPath, adapterPath, kotlinPath, rustLibPath]) {
  if (!existsSync(join(root, path))) failures.push(`REQUIRED_FILE_MISSING:${path}`);
}

const contract = text(contractPath);
const dispatcher = text(dispatcherPath);
const adapter = text(adapterPath);
const kotlin = text(kotlinPath);
const rustLib = text(rustLibPath);

for (const operation of requiredOperations) {
  if (!contract.includes(`${operation}:'RUST_ONLY'`) && !contract.includes(`${operation}: 'RUST_ONLY'`)) failures.push(`RUST_ONLY_CONTRACT_MISSING:${operation}`);
  if (!adapter.includes(`executeRustOnly('${operation}'`)) failures.push(`DISPATCHER_ROUTE_MISSING:${operation}`);
}
if (!dispatcher.includes('executeRustOnly')) failures.push('RUST_ONLY_EXECUTOR_MISSING');
if (/fallbackUsed\s*:\s*true/.test(dispatcher)) failures.push('TYPESCRIPT_FALLBACK_ENABLED_IN_DISPATCHER');

const kotlinFiles = walk('android/app/src/main', ['.kt','.java']);
for (const file of kotlinFiles) {
  if (file === kotlinPath) continue;
  const source = text(file);
  if (/\bexternal\s+fun\s+native\w+\s*\(/.test(source)) failures.push(`DIRECT_NATIVE_DECLARATION_OUTSIDE_GATEWAY:${file}`);
  if (/\bMIKINativeCore\s*\.\s*native\w+\s*\(/.test(source)) failures.push(`DIRECT_NATIVE_CALL_OUTSIDE_GATEWAY:${file}`);
}

const declarations = [...kotlin.matchAll(/private\s+external\s+fun\s+(native\w+)\s*\(/g)].map(match => match[1]).sort();
const exports = [...rustLib.matchAll(/Java_com_miki_ai_MIKINativeCore_(native\w+)\s*\(/g)].map(match => match[1]).sort();
if (JSON.stringify(declarations) !== JSON.stringify(exports)) failures.push('JNI_DECLARATION_EXPORT_MISMATCH');
if (!kotlin.includes('private external fun nativeApiVersion')) failures.push('PRIVATE_NATIVE_HEALTH_DECLARATION_MISSING');
if (!kotlin.includes('private external fun nativeAbiMagic')) failures.push('PRIVATE_NATIVE_ABI_DECLARATION_MISSING');
if (!kotlin.includes('RUST_NATIVE_CORE_UNAVAILABLE')) failures.push('FAIL_CLOSED_NATIVE_UNAVAILABLE_RULE_MISSING');

for (const domain of requiredDomains) {
  const path = `native/miki-native-core/src/domains/${domain}/mod.rs`;
  if (!existsSync(join(root, path))) failures.push(`RUST_DOMAIN_MODULE_MISSING:${domain}`);
}

const tsFiles = walk('src', ['.ts','.tsx']);
const forbiddenImplementations = [
  /function\s+scanRepository\s*\(/,
  /function\s+hashFiles\s*\(/,
  /function\s+buildZip\s*\(/,
  /function\s+copyZipTxt\s*\(/,
  /function\s+compareRevisions\s*\(/,
  /function\s+verifyArtifacts\s*\(/
];
for (const file of tsFiles) {
  if (file === adapterPath || file === contractPath || file === dispatcherPath) continue;
  const source = text(file);
  for (const pattern of forbiddenImplementations) {
    if (pattern.test(source)) failures.push(`LEGACY_TYPESCRIPT_HEAVY_IMPLEMENTATION:${file}:${pattern.source}`);
  }
}

const ownership = JSON.parse(text('RUST_DOMAIN_OWNERSHIP_MANIFEST.json'));
const ownershipText = JSON.stringify(ownership);
for (const domain of requiredDomains) if (!ownershipText.includes(domain)) failures.push(`OWNERSHIP_DOMAIN_MISSING:${domain}`);

const report = {
  passed: failures.length === 0,
  phase: 'RUST_MIGRATION_COMPLETION_GATE_51',
  generatedAt: new Date().toISOString(),
  requiredOperations,
  rustOnlyOperationCount: requiredOperations.length,
  rustDomainCount: requiredDomains.length,
  jniDeclarationCount: declarations.length,
  jniExportCount: exports.length,
  jniExactMatch: JSON.stringify(declarations) === JSON.stringify(exports),
  scannedTypeScriptFiles: tsFiles.length,
  scannedAndroidSourceFiles: kotlinFiles.length,
  directNativeDeclarationsOutsideGateway: failures.filter(x => x.startsWith('DIRECT_NATIVE_DECLARATION')).length,
  directNativeCallsOutsideGateway: failures.filter(x => x.startsWith('DIRECT_NATIVE_CALL')).length,
  legacyTypeScriptImplementations: failures.filter(x => x.startsWith('LEGACY_TYPESCRIPT')).length,
  failClosedNativeGateway: kotlin.includes('RUST_NATIVE_CORE_UNAVAILABLE'),
  failures,
  warnings,
  completionVerdict: failures.length === 0 ? 'STATIC_MIGRATION_GATE_PASSED' : 'MIGRATION_INCOMPLETE'
};
writeFileSync(join(root, 'RUST_MIGRATION_COMPLETION_PHASE51_REPORT.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
