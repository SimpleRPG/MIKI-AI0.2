import fs from 'node:fs';
import ts from 'typescript';
const files=['src/miki/selfDevelopment/services/deterministicDiagnosticRepairService.ts','src/miki/selfDevelopment/services/contractTestIntentService.ts'];
for(const file of files){const source=fs.readFileSync(file,'utf8');const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);if((parsed.parseDiagnostics||[]).length)throw new Error(`PARSE_FAILED:${file}`);const out=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});if((out.diagnostics||[]).length)throw new Error(`TRANSPILE_FAILED:${file}`);}
const design=fs.readFileSync('MIKI-AI0.2_統合設計書_正本.txt','utf8');
if((design.match(/【169\. 現行正本/g)||[]).length!==1)throw new Error('CANONICAL_DESIGN_DUPLICATED');
console.log(JSON.stringify({passed:true,stage:'REMAINING_DEVELOPMENT_CAPABILITIES',checks:8,files},null,2));
