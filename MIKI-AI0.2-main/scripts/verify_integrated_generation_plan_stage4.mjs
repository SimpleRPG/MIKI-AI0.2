import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';

const canonical=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
function load(file){
 const source=fs.readFileSync(file,'utf8');
 const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
 if((parsed.parseDiagnostics||[]).length)throw new Error(`PARSE_FAILED:${file}`);
 const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true},fileName:file,reportDiagnostics:true});
 if((output.diagnostics||[]).length)throw new Error(`TRANSPILE_FAILED:${file}`);
 const module={exports:{}};
 vm.runInNewContext(output.outputText,{module,exports:module.exports,require:id=>id.includes('canonicalSha256Service')?{canonicalSha256:canonical}:undefined,console});
 return module.exports;
}
const service=load('src/miki/selfDevelopment/services/integratedGenerationPlanService.ts').integratedGenerationPlanService;
if(!service)throw new Error('INTEGRATED_PLAN_SERVICE_MISSING');
const plan=service.plan({objective:'ResultへworkspaceIdを追加',targetPaths:['src/result.ts'],astTransformations:[{path:'src/result.ts',operations:[{kind:'ADD_INTERFACE_FIELD',interfaceName:'Result',fieldName:'workspaceId',fieldType:'string'}]}],reusableComponentIds:['component.verified.identity'],codeKnowledgeIds:['code.typescript.interface']});
const strategies=plan.steps.map(step=>step.strategy);
for(const expected of ['AST_TRANSFORM','COMPONENT_REUSE','CONSTRUCTION_GRAPH','CAPABILITY_GAP'])if(!strategies.includes(expected))throw new Error(`STRATEGY_MISSING:${expected}`);
if(service.next(plan,[],[])?.strategy!=='AST_TRANSFORM')throw new Error('FIRST_STRATEGY_NOT_AST');
if(service.next(plan,[],['AST_TRANSFORM'])?.strategy!=='COMPONENT_REUSE')throw new Error('AST_FALLBACK_NOT_COMPONENT');
const candidateSource=fs.readFileSync('src/miki/core/services/candidateCodeGenerationService.ts','utf8');
for(const text of ['integratedGenerationPlanService.plan','astFallbackReasons','AST strategy failed; continue with Component/Construction strategies','integratedGenerationPlanId'])if(!candidateSource.includes(text))throw new Error(`CANDIDATE_INTEGRATION_MISSING:${text}`);
if(/if\(failures\.length>0\)return \{accepted:false/.test(candidateSource))throw new Error('OLD_AST_EARLY_FAILURE_REMAINS');
console.log(JSON.stringify({passed:true,stage:'INTEGRATED_GENERATION_PLAN',checks:14,planId:plan.planId,strategies},null,2));
