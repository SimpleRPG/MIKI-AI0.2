import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';

const file='src/miki/selfDevelopment/services/astCandidateTransformationService.ts';
const source=fs.readFileSync(file,'utf8');
const syntax=ts.createSourceFile(file,source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
const parseDiagnostics=syntax.parseDiagnostics||[];
if(parseDiagnostics.length)throw new Error(parseDiagnostics.map(item=>ts.flattenDiagnosticMessageText(item.messageText,' ')).join('|'));
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true},fileName:file,reportDiagnostics:true});
if((output.diagnostics||[]).length)throw new Error(output.diagnostics.map(item=>ts.flattenDiagnosticMessageText(item.messageText,' ')).join('|'));
const canonical=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const module={exports:{}};
vm.runInNewContext(output.outputText,{module,exports:module.exports,require:id=>id==='typescript'?ts:id.includes('canonicalSha256Service')?{canonicalSha256:canonical}:undefined,console});
const service=module.exports.astCandidateTransformationService;
if(!service)throw new Error('AST_SERVICE_EXPORT_MISSING');
const baseline=`interface Result { ok:boolean; }\nfunction run(id:string){ const response={ok:true}; return response; }\nfunction validate(candidateRevision:number){ return candidateRevision; }\nfunction caller(candidateRevision:number){ return run('id'); }\n`;
const result=service.transform({path:'fixture.ts',baselineContent:baseline,expectedBaselineSha256:canonical(baseline),operations:[
 {kind:'ADD_IMPORT',moduleSpecifier:'./dep',namedImports:['helper']},
 {kind:'ADD_INTERFACE_FIELD',interfaceName:'Result',fieldName:'workspaceId',fieldType:'string'},
 {kind:'ADD_PARAMETER',functionName:'run',parameterName:'revision',parameterType:'number'},
 {kind:'ADD_OBJECT_PROPERTY',variableName:'response',propertyName:'workspaceId',expression:'id'},
 {kind:'ADD_VALIDATION_GUARD',functionName:'validate',condition:'candidateRevision > 0',failureStatement:"throw new Error('INVALID_REVISION');"},
 {kind:'ADD_CALL_ARGUMENT',calleeName:'run',argumentExpression:'candidateRevision'}
]});
if(!result.accepted)throw new Error(`AST_TRANSFORM_REJECTED:${result.reasons.join('|')}`);
for(const expected of ["from \"./dep\"",'workspaceId: string','revision: number','workspaceId: id','if (!(candidateRevision > 0))',"run('id', candidateRevision)"])if(!result.candidateContent.includes(expected))throw new Error(`AST_EXPECTED_OUTPUT_MISSING:${expected}`);
const parsed=ts.createSourceFile('candidate.ts',result.candidateContent,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
if((parsed.parseDiagnostics||[]).length)throw new Error('AST_CANDIDATE_PARSE_FAILED');
console.log(JSON.stringify({passed:true,stage:'DETERMINISTIC_AST_CANDIDATE_TRANSFORMATION',checks:16,candidateSha256:result.candidateSha256},null,2));
