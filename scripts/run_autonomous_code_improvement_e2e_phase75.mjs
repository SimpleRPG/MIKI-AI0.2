import {writeFileSync,readFileSync} from 'node:fs';
import {autonomousE2EProofSuiteService} from '../src/miki/selfDevelopment/services/autonomousE2EProofSuiteService.ts';
const results=await autonomousE2EProofSuiteService.runAll();
const failures=[];
for(const result of results){if(!result.passed)failures.push(`${result.scenario}:${result.reasons.join('|')}`);if(!result.baselineSha256||!result.candidateSha256)failures.push(`${result.scenario}:SHA_MISSING`);if(result.scenario==='INTENTIONAL_FAILURE_ROLLBACK'&&result.rollbackSha256!==result.baselineSha256)failures.push('ROLLBACK_SHA_MISMATCH');}
const core=readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
const chain=['SELF_IMPROVEMENT','candidateConstraintValidationService.validate','acceptanceEvidenceMatrixService.evaluate','workspaceTscAndIsolationE2EService.verify','autonomousE2EProofSuiteService.runAll','candidateDevelopmentCompletionService.complete','reviewManifestInclusionGateService.verify','cumulativeRevalidationService.run','canaryPostReviewVerificationService.dryRun','advancedPipelineHandoffAuditService.audit'];
for(const token of chain)if(!core.includes(token))failures.push(`CORE_CHAIN_MISSING:${token}`);
const report={passed:failures.length===0,phase:'AUTONOMOUS_CODE_IMPROVEMENT_E2E_75',executedAt:new Date().toISOString(),proofScenarios:results.length,proofPassed:results.filter(x=>x.passed).length,rollbackVerified:results.some(x=>x.scenario==='INTENTIONAL_FAILURE_ROLLBACK'&&x.rollbackSha256===x.baselineSha256),coreChainTokens:chain,results,failures};
writeFileSync('AUTONOMOUS_CODE_IMPROVEMENT_E2E_PHASE75_REPORT.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
