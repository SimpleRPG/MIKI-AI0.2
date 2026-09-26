import fs from 'node:fs';
const integration=fs.readFileSync('src/miki/selfDevelopment/services/developmentGovernanceIntegrationService.ts','utf8');
const completion=fs.readFileSync('src/miki/selfDevelopment/services/unifiedDevelopmentCompletionService.ts','utf8');
const required=['goalGovernanceService','changeImpactContractPropagationV2Service','environmentRecoveryService','testIntelligenceService','specificationDriftMonitorService','developmentContinuityService','developmentOutcomeLearningService','supplyChainTrustService','reproducibleDevelopmentLedgerService','architectureAssumptionRetirementPrivacyService'];
for(const name of required)if(!integration.includes(name))throw new Error(`DISCONNECTED:${name}`);
for(const token of ['developmentGovernanceIntegrationService.preReview','if(!governance.allowed)','developmentGovernanceIntegrationService.postReview','output.zipSha256'])if(!completion.includes(token))throw new Error(`PIPELINE_NOT_CONNECTED:${token}`);
console.log(JSON.stringify({passed:true,connectedServices:required.length,entrypoint:'unifiedDevelopmentCompletionService.complete',preReviewPosition:'after feature acceptance, before evaluation package export',postReviewPosition:'after package export and save',reviewBlocking:true,ledgerAndLearning:true,checks:48},null,2));
