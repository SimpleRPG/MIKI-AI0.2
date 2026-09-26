import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';

const canonical=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const source=fs.readFileSync('src/miki/selfDevelopment/services/contractPropagationService.ts','utf8');
const parsed=ts.createSourceFile('contractPropagationService.ts',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
if((parsed.parseDiagnostics||[]).length)throw new Error('PROPAGATION_SOURCE_PARSE_FAILED');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true},reportDiagnostics:true});
if((output.diagnostics||[]).length)throw new Error('PROPAGATION_TRANSPILE_FAILED');
const snapshot={schemaVersion:2,snapshotSha256:'fixture-snapshot',entries:[
 {path:'src/result.ts',symbols:[{kind:'INTERFACE',name:'CandidateResult'}]},
 {path:'src/generator.ts',symbols:[{kind:'VARIABLE',name:'response'}]},
 {path:'src/consumer.ts',symbols:[{kind:'FUNCTION',name:'consume'}]},
 {path:'src/validator.ts',symbols:[{kind:'FUNCTION',name:'validate'}]},
 {path:'src/caller.ts',symbols:[{kind:'FUNCTION',name:'caller'}],relations:[{kind:'CALLS',to:'consume'}]}
]};
const understanding={ready:true,relatedPaths:['src/result.ts','src/generator.ts','src/consumer.ts','src/validator.ts','src/caller.ts'],snapshotSha256:'fixture-snapshot'};
const module={exports:{}};
vm.runInNewContext(output.outputText,{module,exports:module.exports,require:id=>id.includes('canonicalSha256Service')?{canonicalSha256:canonical}:id.includes('selfCodeUnderstandingService')?{selfCodeUnderstandingService:{ensure:()=>understanding,getSnapshot:()=>snapshot}}:undefined,console});
const service=module.exports.contractPropagationService;
const plan=service.plan({fieldName:'candidateRevision',fieldType:'number',interfaceNames:['CandidateResult'],producerObjectNames:['response'],producerExpression:'revision',consumerFunctions:['consume'],validationFunctions:['validate'],validationCondition:'candidateRevision > 0',validationFailureStatement:"throw new Error('INVALID_REVISION');",callSiteCallees:['consume'],callArgumentExpression:'candidateRevision',targetPaths:['src/result.ts','src/generator.ts','src/consumer.ts','src/validator.ts','src/caller.ts']});
if(plan.unresolved.length)throw new Error(`PROPAGATION_UNRESOLVED:${plan.unresolved.join('|')}`);
if(plan.transformations.length!==5)throw new Error('PROPAGATION_FILE_COUNT_INVALID');
if(!plan.transformations.some(row=>row.operations.some(operation=>operation.kind==='ADD_INTERFACE_FIELD')))throw new Error('INTERFACE_PROPAGATION_MISSING');
if(!plan.transformations.some(row=>row.operations.some(operation=>operation.kind==='ADD_OBJECT_PROPERTY')))throw new Error('PRODUCER_PROPAGATION_MISSING');
if(!plan.transformations.some(row=>row.operations.some(operation=>operation.kind==='ADD_PARAMETER')))throw new Error('CONSUMER_PROPAGATION_MISSING');
if(!plan.transformations.some(row=>row.operations.some(operation=>operation.kind==='ADD_VALIDATION_GUARD')))throw new Error('VALIDATION_GUARD_MISSING');
if(!plan.transformations.some(row=>row.operations.some(operation=>operation.kind==='ADD_CALL_ARGUMENT')))throw new Error('CALL_ARGUMENT_PROPAGATION_MISSING');
const compilerSource=fs.readFileSync('src/miki/selfDevelopment/services/specContractCompilerService.ts','utf8');
const plannerSource=fs.readFileSync('src/miki/core/services/adaptiveRoutePlannerService.ts','utf8');
for(const text of ['compileContractPropagationOperations','compileAllDeterministicAstOperations'])if(!compilerSource.includes(text))throw new Error(`COMPILER_INTEGRATION_MISSING:${text}`);
if(!plannerSource.includes('compileAllDeterministicAstOperations'))throw new Error('PLANNER_PROPAGATION_INTEGRATION_MISSING');
console.log(JSON.stringify({passed:true,stage:'MULTI_FILE_CONTRACT_PROPAGATION',checks:18,propagationId:plan.propagationId,files:plan.transformations.map(row=>row.path)},null,2));
