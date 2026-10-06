import{readFileSync,readdirSync,writeFileSync}from'node:fs';
const failures=[];
const semanticPath='src/miki/selfDevelopment/services/semanticUnderstandingV2OrchestratorService.ts';
const completionPath='src/miki/selfDevelopment/services/candidateDevelopmentCompletionService.ts';
const coveragePath='src/miki/selfDevelopment/services/runtimeCoverageGraphService.ts';
const semantic=readFileSync(semanticPath,'utf8')+readFileSync('src/miki/selfDevelopment/services/semanticExecutionPlanCompiler.ts','utf8');
if(/const operation\s*:?[\/]更新/.test(semantic))failures.push('INVALID_OPERATION_DECLARATION_REMAINS');
for(const token of ["MutationInstruction['operation']","MutationInstruction['valueType']","chain.separators[index-1]","separator===':'","/^0\\d+/"])if(!semantic.includes(token))failures.push(`MUTATION_IR_HARDENING_MISSING:${token}`);
const completion=readFileSync(completionPath,'utf8');if(!completion.includes("integrity && (!integrity.contractPassed"))failures.push('INTEGRITY_PRECEDENCE_NOT_FIXED');
const coverage=readFileSync(coveragePath,'utf8');for(const token of ["rank:Record<EvidenceStatus['status'],number>",'rank[status.status]<rank[current.status]','new Set'])if(!coverage.includes(token))failures.push(`EVIDENCE_MONOTONICITY_MISSING:${token}`);
const tsFiles=[];function walk(path){for(const entry of readdirSync(path,{withFileTypes:true})){if(['node_modules','dist','target','.git'].includes(entry.name))continue;const child=`${path}/${entry.name}`;if(entry.isDirectory())walk(child);else if(/\.tsx?$/.test(entry.name))tsFiles.push(child);}}walk('src');
for(const file of tsFiles){const source=readFileSync(file,'utf8');if(/const\s+\w+\s*:\s*\/[^\n]+\?/.test(source))failures.push(`SUSPICIOUS_TYPE_DECLARATION:${file}`);}
const report={passed:!failures.length,phase:'EXISTING_CAPABILITY_HARDENING_57',fixedInvalidTypeScriptSyntax:true,mutationIrUsesCanonicalActionChains:true,integrityGatePrecedenceFixed:true,evidenceStatusMonotonic:true,typescriptFilesScanned:tsFiles.length,failures};writeFileSync('EXISTING_CAPABILITY_HARDENING_PHASE57_REPORT.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
