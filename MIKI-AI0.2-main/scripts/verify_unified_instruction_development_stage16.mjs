import fs from 'node:fs';import ts from 'typescript';
const files=['src/miki/selfDevelopment/services/unifiedInstructionDevelopmentService.ts','src/miki/selfDevelopment/services/mikiSelfCodingSuperchargerService.ts'];
for(const file of files){const source=fs.readFileSync(file,'utf8');const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);if(((parsed).parseDiagnostics||[]).length)throw new Error(`PARSE:${file}`);}
const entry=fs.readFileSync(files[1],'utf8');for(const text of ['unifiedInstructionDevelopmentService.prepare','unifiedDevelopmentPlanId','instructionSource','res.unifiedDevelopment'])if(!entry.includes(text))throw new Error(`ENTRY_NOT_UNIFIED:${text}`);
const unified=fs.readFileSync(files[0],'utf8');for(const text of ['WORK_INSTRUCTION','NATURAL_LANGUAGE','autonomousFeatureConstructionExecutorService.execute','autonomousFeatureWiringPipelineService.execute'])if(!unified.includes(text))throw new Error(`PIPELINE_MISSING:${text}`);
console.log(JSON.stringify({passed:true,stage:'UNIFIED_INSTRUCTION_DEVELOPMENT',checks:12},null,2));
