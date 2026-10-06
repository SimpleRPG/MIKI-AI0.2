import{existsSync,readFileSync,readdirSync,writeFileSync}from'node:fs';
const failures=[];
const retired=['src/miki/selfDevelopment/services/instructionConstraintGraphService.ts','src/miki/conversation/services/conversationContinuityLedgerService.ts','src/miki/selfDevelopment/services/codeGenerationIntegrityPipelineService.ts','src/miki/selfDevelopment/services/understandingConversationCodeOrchestratorService.ts'];
for(const file of retired)if(existsSync(file))failures.push(`DUPLICATE_SERVICE_REMAINS:${file}`);
const semantic=readFileSync('src/miki/selfDevelopment/services/semanticFrameV2Service.ts','utf8');
for(const field of ['targetSets','exclusionSets','evaluationOrder','continuationConditions','stopConditions','confirmationConditions','references'])if(!semantic.includes(field))failures.push(`SEMANTIC_INTEGRATION_MISSING:${field}`);
const taskboard=readFileSync('src/miki/conversation/services/conversationTaskboardService.ts','utf8');
for(const field of ['classifyWorkState','resolveContinuation','EXTERNAL_REQUIRED','completionJudgePassed'])if(!taskboard.includes(field))failures.push(`TASKBOARD_INTEGRATION_MISSING:${field}`);
const verifier=readFileSync('src/miki/verification/services/codeVerificationService.ts','utf8');
for(const field of ['rust_unsafe','rust_unwrap','rust_expect','rust_panic'])if(!verifier.includes(field))failures.push(`RUST_VERIFICATION_MISSING:${field}`);
const sourceFiles=[];function walk(path){for(const entry of readdirSync(path,{withFileTypes:true})){if(['node_modules','dist','target','.git'].includes(entry.name))continue;const child=`${path}/${entry.name}`;if(entry.isDirectory())walk(child);else if(/\.tsx?$/.test(entry.name))sourceFiles.push(child);}}walk('src');
const forbiddenExports=['instructionConstraintGraphService','conversationContinuityLedgerService','codeGenerationIntegrityPipelineService','understandingConversationCodeOrchestratorService'];for(const file of sourceFiles){const source=readFileSync(file,'utf8');for(const name of forbiddenExports)if(source.includes(name))failures.push(`RETIRED_REFERENCE_REMAINS:${file}:${name}`);}
const report={passed:failures.length===0,phase:'SEMANTIC_DUPLICATE_CONSOLIDATION_53',baseline:'RUST_MIGRATION_COMPLETION_PHASE51',retiredDuplicateServices:4,canonicalServicesEnhanced:3,typescriptFilesScanned:sourceFiles.length,failures};writeFileSync('SEMANTIC_DUPLICATE_CONSOLIDATION_PHASE53_REPORT.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
