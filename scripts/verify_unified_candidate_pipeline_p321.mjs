import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import ts from 'typescript';
import { candidateValidationPathPolicyService as policy } from '../src/miki/core/services/candidateValidationPathPolicyService.ts';

const allow = input => policy.evaluate(input);
const create = path => ({path,isNewFile:true,baselineContent:'',sourcePathExists:false,targetPathExists:false});
const update = overrides => ({path:'src/miki/exampleService.ts',isNewFile:false,baselineContent:'export const before = true;\n',sourceContent:'export const before = true;\n',sourcePathExists:true,targetPathExists:true,...overrides});

assert.equal(policy.normalize('src\\generated\\NewFeature.ts').normalizedPath,'src/generated/NewFeature.ts');
assert.equal(allow(create('src/generated/NewFeature.ts')).allowed,true,'safe new source file must be accepted');
assert.equal(allow(create('scripts/verify_new_feature.mjs')).allowed,true,'safe new test file must be accepted');
for (const path of ['../escape.ts','src/../../escape.ts','/tmp/escape.ts','C:\\outside.ts','src//empty.ts','src/.//dot.ts']) {
  assert.equal(policy.normalize(path).allowed,false,`unsafe path must be rejected: ${path}`);
}
for (const path of ['.github/workflows/evil.yml','node_modules/pkg/index.js','dist/evil.js','package.json','tsconfig.json','src/secret.env']) {
  assert.equal(allow(create(path)).allowed,false,`protected new path must be rejected: ${path}`);
}
assert.match(allow({...create('src/generated/NewFeature.ts'),sourcePathExists:true}).reason,/SOURCE_PATH_ALREADY_EXISTS/);
assert.match(allow({...create('src/generated/NewFeature.ts'),targetPathExists:true}).reason,/TARGET_ALREADY_EXISTS/);
assert.match(allow({...create('src/generated/NewFeature.ts'),baselineContent:'previous'}).reason,/BASELINE_MUST_BE_EMPTY/);
assert.equal(allow(update({})).allowed,true,'existing file update with exact baseline must be accepted');
assert.match(allow(update({baselineContent:'stale baseline'})).reason,/BASELINE_MISMATCH/);
assert.match(allow(update({sourcePathExists:false,targetPathExists:false})).reason,/NOT_IN_SOURCE_SNAPSHOT/);
assert.match(allow(update({targetPathExists:false})).reason,/NOT_IN_SOURCE_SNAPSHOT/);
const candidateContent='export const answer = 42;';
const candidateFileSha256=createHash('sha256').update(candidateContent,'utf8').digest('hex');
const aggregateSha256=createHash('sha256').update(`src/generated/feature.ts\n${candidateContent}`,'utf8').digest('hex');
const validReceipt = {developmentPlanId:'PLAN-1',completed:true,validationPassed:true,workspaceId:'CWS-1',candidateSha256:aggregateSha256,validationPlan:{developmentPlanId:'PLAN-1',testPlanId:'TEST-1',validationRequirements:['AC-1'],testCommands:['node scripts/verify_feature.mjs'],acceptanceCriterionIds:['AC-1']},testResults:[{command:'node scripts/verify_feature.mjs',passed:true,exitCode:0}],candidateFiles:[{path:'src/generated/feature.ts',isNewFile:true,baselineContent:'',candidateContent,candidateSha256:candidateFileSha256}]};
assert.equal(policy.validateUnifiedReceipt('PLAN-1',validReceipt,'').allowed,true,'complete plan-linked validated candidate receipt must be accepted');
assert.match(policy.validateUnifiedReceipt('OTHER-PLAN',validReceipt,'').reason,/PLAN_ID_MISMATCH/);
assert.match(policy.validateUnifiedReceipt('PLAN-1',{...validReceipt,testResults:[{command:'node scripts/verify_feature.mjs',passed:false,exitCode:1}]},'').reason,/EVIDENCE_INCOMPLETE/);
assert.match(policy.validateUnifiedReceipt('PLAN-1',{...validReceipt,candidateFiles:[{...validReceipt.candidateFiles[0],path:'../escape.ts'}]},'').reason,/PATH_REJECTED/);
assert.match(policy.validateUnifiedReceipt('PLAN-1',validReceipt,'','export const unsafe = true;').reason,/OVERRIDE_NOT_PRESERVED/);

const root = process.cwd();
const requiredMarkers = [
  ['src/miki/selfDevelopment/services/mikiSelfCodingSuperchargerService.ts', ['/api/self-code/package-scripts','UNIFIED_DEVELOPMENT_PREPARE','UNIFIED_CANDIDATE_HANDOFF','failureStage','UNIFIED_CANDIDATE_VALIDATION_EVIDENCE_INCOMPLETE','candidateFiles']],
  ['src/miki/core/services/isolatedCandidateWorkspaceService.ts', ['CandidateValidationPlan','isNewFile:boolean','setValidationPlan']],
  ['src/miki/core/services/candidateValidationRunnerService.ts', ['workspace.validationPlan','VALIDATION_TEST_COMMANDS_MISSING','isNewFile:file.isNewFile']],
  ['src/miki/core/services/cumulativeRevalidationService.ts', ['CUMULATIVE_VALIDATION_PLAN_MISSING','validationRequirements,testCommands,acceptanceCriterionIds,candidateFiles','canonicalSha256(candidateFiles.map']],
  ['src/miki/selfDevelopment/services/candidateRepairRetryLoopService.ts', ['initialBaselineByPath.get(file.path)','workspace.validationPlan','REPAIR_VALIDATION_PLAN_PROPAGATION_FAILED']],
  ['src/miki/selfDevelopment/services/unifiedDevelopmentCompletionService.ts', ['pinnedValidationPlan','setValidationPlan(workspace.workspaceId,pinnedValidationPlan)']],
  ['src/miki/selfDevelopment/services/unifiedInstructionDevelopmentService.ts', ['linkedRunId=runId||plan.developmentPlanId']],
  ['server.ts', ['/api/self-code/package-scripts','candidateValidationPathPolicyService.validateUnifiedReceipt','candidateValidationPathPolicyService.evaluate({path:relative','UNIFIED_CANDIDATE_HANDOFF','CANDIDATE_CONTENT_HASH_MISMATCH','isNewFile:file.isNewFile']],
  ['.github/workflows/build-apk.yml', ['verify:unified-candidate-pipeline:p321']],
  ['package.json', ['verify:unified-candidate-pipeline:p321']]
];
for (const [file,markers] of requiredMarkers) {
  const source = fs.readFileSync(`${root}/${file}`,'utf8');
  for (const marker of markers) assert.ok(source.includes(marker),`integration marker missing: ${file}:${marker}`);
  if (/\.(ts|tsx)$/.test(file)) {
    const parsed = ts.createSourceFile(file,source,ts.ScriptTarget.ES2022,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    assert.equal(parsed.parseDiagnostics.length,0,`TypeScript parse failed: ${file}`);
    const emitted = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true});
    const errors = (emitted.diagnostics||[]).filter(item=>item.category===ts.DiagnosticCategory.Error);
    assert.equal(errors.length,0,`TypeScript transpile failed: ${file}`);
  }
}
console.log(JSON.stringify({passed:true,stage:'UNIFIED_CANDIDATE_PIPELINE_P321',scope:'candidate path policy, receipt hash gates, and pipeline handoff wiring; not full autonomous E2E'},null,2));
