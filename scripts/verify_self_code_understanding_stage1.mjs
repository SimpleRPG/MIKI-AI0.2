import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const servicePath='src/miki/core/services/selfCodeUnderstandingService.ts';
const sourceText=fs.readFileSync(servicePath,'utf8');
const source=ts.createSourceFile(servicePath,sourceText,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
const errors=source.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' '));
if(errors.length)throw new Error(`SELF_CODE_UNDERSTANDING_PARSE_FAILED:${errors.join('|')}`);

const required=[
  "import ts from 'typescript'",
  'schemaVersion:2',
  "'CALLS'",
  "'DECLARES_COMMAND'",
  "'READS_STORAGE'",
  "'WRITES_STORAGE'",
  "'PUBLISHES_EVENT'",
  "'SUBSCRIBES_EVENT'",
  'literalContracts',
  'parseDiagnostics',
  'contractIndex'
];
for(const token of required)if(!sourceText.includes(token))throw new Error(`STAGE1_REQUIRED_TOKEN_MISSING:${token}`);

const fixture=`
import { store } from 'fixture-store';
export interface CandidateResult { workspaceId:string; }
export class CandidateService {
  async generate(runId:string):Promise<CandidateResult>{
    store.setItem('miki_candidate_fixture',runId);
    eventBus.emit('CANDIDATE_READY',runId);
    return {workspaceId:runId};
  }
}
const route={target:'selfDevelopment',command:'GENERATE_CANDIDATE'};
`;
const fixtureSource=ts.createSourceFile('fixture.ts',fixture,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
const interfaceNames=[];
const classNames=[];
const calls=[];
const literals=[];
const visit=(node)=>{
  if(ts.isInterfaceDeclaration(node))interfaceNames.push(node.name.text);
  if(ts.isClassDeclaration(node)&&node.name)classNames.push(node.name.text);
  if(ts.isCallExpression(node))calls.push(node.expression.getText(fixtureSource));
  if(ts.isStringLiteralLike(node))literals.push(node.text);
  ts.forEachChild(node,visit);
};
visit(fixtureSource);
if(!interfaceNames.includes('CandidateResult'))throw new Error('FIXTURE_INTERFACE_NOT_FOUND');
if(!classNames.includes('CandidateService'))throw new Error('FIXTURE_CLASS_NOT_FOUND');
if(!calls.includes('store.setItem'))throw new Error('FIXTURE_STORAGE_CALL_NOT_FOUND');
if(!calls.includes('eventBus.emit'))throw new Error('FIXTURE_EVENT_CALL_NOT_FOUND');
if(!literals.includes('GENERATE_CANDIDATE'))throw new Error('FIXTURE_COMMAND_NOT_FOUND');
const understandingSource=fs.readFileSync(path.join(process.cwd(),'src/miki/core/services/selfCodeUnderstandingService.ts'),'utf8');
const contractSource=fs.readFileSync(path.join(process.cwd(),'src/miki/selfDevelopment/services/specContractCompilerService.ts'),'utf8');
for(const requiredText of ['ImpactScopeRecord','executionPaths','unresolvedEdges','SHARES_CONTRACT'])if(!understandingSource.includes(requiredText))throw new Error(`UNDERSTANDING_EXTENSION_MISSING:${requiredText}`);
for(const requiredText of ['compileImprovementRequirement','reusableComponentIds','codeKnowledgeIds',"status:blockers.length===0?'READY':'BLOCKED'"])if(!contractSource.includes(requiredText))throw new Error(`REQUIREMENT_CONTRACT_MISSING:${requiredText}`);
console.log(JSON.stringify({passed:true,stage:'SELF_CODE_UNDERSTANDING_AND_REQUIREMENT_CONTRACT',checks:required.length+13},null,2));
