import fs from 'node:fs';
import ts from 'typescript';
const files=['src/miki/core/services/candidateValidationRunnerService.ts','src/miki/selfDevelopment/services/candidateRepairRevisionService.ts'];
for(const file of files){const source=fs.readFileSync(file,'utf8');const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);if((parsed.parseDiagnostics||[]).length)throw new Error(`PARSE_FAILED:${file}`);const out=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});if((out.diagnostics||[]).length)throw new Error(`TRANSPILE_FAILED:${file}`);}
const runner=fs.readFileSync(files[0],'utf8');
for(const text of ['contractTestIntents:testIntents','deterministicDiagnosticRepairService.plan','repairPlans','retryRecommended'])if(!runner.includes(text))throw new Error(`RUNNER_CONNECTION_MISSING:${text}`);
const repair=fs.readFileSync(files[1],'utf8');
for(const text of ['astCandidateTransformationService.transform','REPAIRREV-','NO_APPLICABLE_REPAIR_PLANS'])if(!repair.includes(text))throw new Error(`REPAIR_REVISION_MISSING:${text}`);
console.log(JSON.stringify({passed:true,stage:'VALIDATION_REPAIR_LOOP',checks:10,files},null,2));
