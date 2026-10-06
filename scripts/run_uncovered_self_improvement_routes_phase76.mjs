import {readFileSync,writeFileSync} from 'node:fs';
import {complexCapabilityContractService} from '../src/miki/core/services/complexCapabilityContractService.ts';
const core=readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
const routeCases=[
 {id:'unknown-capability',run:()=>complexCapabilityContractService.validate('missingService',{}),expect:['UNKNOWN_COMPLEX_CAPABILITY']},
 {id:'runtime-proof-no-workspace',run:()=>complexCapabilityContractService.validate('runtimeProofOrchestratorService',{candidateSha256:'sha',evidenceIds:['e']}),expect:['WORKSPACE_ID_REQUIRED']},
 {id:'runtime-proof-no-sha',run:()=>complexCapabilityContractService.validate('runtimeProofOrchestratorService',{workspaceId:'w',evidenceIds:['e']}),expect:['CANDIDATE_SHA_REQUIRED']},
 {id:'runtime-proof-no-evidence',run:()=>complexCapabilityContractService.validate('runtimeProofOrchestratorService',{workspaceId:'w',candidateSha256:'sha'}),expect:['EVIDENCE_IDS_REQUIRED']},
 {id:'runtime-proof-ready',run:()=>complexCapabilityContractService.validate('runtimeProofOrchestratorService',{workspaceId:'w',candidateSha256:'sha',evidenceIds:['e']}),accepted:true},
 {id:'remote-no-approval',run:()=>complexCapabilityContractService.validate('remoteExecutionAgentProtocolService',{workspaceId:'w',candidateSha256:'sha',evidenceIds:['signed','hash','attestation','permission']}),expect:['REMOTE_USER_APPROVAL_REQUIRED']},
 {id:'remote-ready',run:()=>complexCapabilityContractService.validate('remoteExecutionAgentProtocolService',{workspaceId:'w',candidateSha256:'sha',evidenceIds:['signed','hash','attestation','permission'],userApproved:true}),accepted:true},
 {id:'multi-intent-no-evidence',run:()=>complexCapabilityContractService.validate('multiIntentWorkspaceTransactionService',{}),expect:['EVIDENCE_IDS_REQUIRED']},
 {id:'multi-intent-ready',run:()=>complexCapabilityContractService.validate('multiIntentWorkspaceTransactionService',{evidenceIds:['fragment','baseline']}),accepted:true},
 {id:'production-e2e-ready',run:()=>complexCapabilityContractService.validate('productionScaleE2EOrchestratorService',{workspaceId:'w',candidateSha256:'sha',evidenceIds:['validation','resource']}),accepted:true},
 {id:'governance-no-sha',run:()=>complexCapabilityContractService.validate('stages41To50GovernanceGateService',{evidenceIds:['goal','symbol','criteria','result','supply']}),expect:['CANDIDATE_SHA_REQUIRED']},
 {id:'governance-ready',run:()=>complexCapabilityContractService.validate('stages41To50GovernanceGateService',{candidateSha256:'sha',evidenceIds:['goal','symbol','criteria','result','supply']}),accepted:true}
];
const results=routeCases.map(test=>{const actual=test.run();const reasons=actual.reasons||[];const passed=test.accepted===true?actual.accepted===true:(test.expect||[]).every(reason=>reasons.includes(reason))&&!actual.accepted;return{id:test.id,passed,accepted:actual.accepted,reasons,consumer:actual.contract?.consumer,rollbackTarget:actual.contract?.rollbackTarget,invalidationTargets:actual.contract?.invalidationTargets};});
const coreTokens=['COMPLEX_CAPABILITY_INPUT_GAPS','COMPLEX_CAPABILITY_READY','WORKSPACE_PATH_BOUNDARY_GAPS','CANDIDATE_CONSTRAINT_GAPS','ACCEPTANCE_EVIDENCE_GAPS','WORKSPACE_TSC_ISOLATION_GAPS','AUTONOMOUS_E2E_PROOF_GAPS','REVIEW_MANIFEST_GAPS','CUMULATIVE_REVALIDATION_GAPS','CANARY_VERIFICATION_GAPS','SELF_IMPROVEMENT_HANDOFF_GAPS'];
const missingCoreTokens=coreTokens.filter(token=>!core.includes(token));
const failures=[...results.filter(x=>!x.passed).map(x=>`ROUTE:${x.id}`),...missingCoreTokens.map(x=>`CORE_TOKEN:${x}`)];
const report={passed:failures.length===0,phase:'UNCOVERED_SELF_IMPROVEMENT_ROUTES_76',routeCases:results.length,routePassed:results.filter(x=>x.passed).length,failClosedCases:results.filter(x=>!x.accepted).length,readyCases:results.filter(x=>x.accepted).length,coreFailureRoutesChecked:coreTokens.length,results,missingCoreTokens,failures};
writeFileSync('UNCOVERED_SELF_IMPROVEMENT_ROUTES_PHASE76_REPORT.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
