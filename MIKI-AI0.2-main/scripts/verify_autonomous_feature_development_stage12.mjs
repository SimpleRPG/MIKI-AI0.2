import fs from 'node:fs';
import ts from 'typescript';
const files=['src/miki/selfDevelopment/services/featureDevelopmentPlannerService.ts','src/miki/selfDevelopment/services/newFeatureConstructionPlanService.ts','src/miki/selfDevelopment/services/executableFeatureTestPlanService.ts','src/miki/selfDevelopment/services/autonomousFeatureDevelopmentPlanService.ts'];
for(const file of files){const source=fs.readFileSync(file,'utf8');const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);if((parsed.parseDiagnostics||[]).length)throw new Error(`PARSE_FAILED:${file}`);const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});if((output.diagnostics||[]).length)throw new Error(`TRANSPILE_FAILED:${file}`);}
const feature=fs.readFileSync(files[0],'utf8');for(const text of ['acceptanceCriteria','PERSISTENCE','CORE_ROUTE','reuseRequired:true'])if(!feature.includes(text))throw new Error(`FEATURE_PLANNER_MISSING:${text}`);
const construction=fs.readFileSync(files[1],'utf8');for(const text of ['COMPONENT_REUSE','CONSTRUCTION_GRAPH','REACT_COMPONENT','SHA256_MANIFEST'])if(!construction.includes(text))throw new Error(`CONSTRUCTION_PLAN_MISSING:${text}`);
const tests=fs.readFileSync(files[2],'utf8');for(const text of ['NODE_MJS','TSX_SCRIPT','NO_NETWORK','PROCESS_EXIT_ZERO'])if(!tests.includes(text))throw new Error(`TEST_PLAN_MISSING:${text}`);
const design=fs.readFileSync('MIKI-AI0.2_統合設計書_正本.txt','utf8');if((design.match(/【169\. 現行正本/g)||[]).length!==1)throw new Error('CANONICAL_DESIGN_DUPLICATED');
console.log(JSON.stringify({passed:true,stage:'AUTONOMOUS_FEATURE_DEVELOPMENT',checks:20,files},null,2));
