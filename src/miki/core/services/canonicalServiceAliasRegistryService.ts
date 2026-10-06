export type ServiceConnectivityClass='CONNECTED_RUNTIME'|'DYNAMIC_ENTRY'|'UI_OR_MANUAL'|'DIAGNOSTIC_ONLY'|'DUPLICATE_CONSOLIDATED'|'OBSOLETE_APP_ONLY'|'MISSING_CONNECTION';
export interface ServiceConnectivityRecord{service:string;path:string;classification:ServiceConnectivityClass;canonical?:string;action:string;}
const records:ServiceConnectivityRecord[]=[
{service:'aiderEngineService',path:'src/miki/selfDevelopment/services/aiderEngineService.ts',classification:'DUPLICATE_CONSOLIDATED',canonical:'repositoryRepairOrchestratorService',action:'Do not activate parallel repair/Git authority; route repository repair through canonical orchestrator.'},
{service:'architectureEvolutionPlannerService',path:'src/miki/selfDevelopment/services/architectureEvolutionPlannerService.ts',classification:'MISSING_CONNECTION',action:'Connect only from explicit architecture-evolution planning request.'},
{service:'atomicAstTemplateExecutionService',path:'src/miki/selfDevelopment/services/atomicAstTemplateExecutionService.ts',classification:'DUPLICATE_CONSOLIDATED',canonical:'atomicAstTransformationComponentService',action:'Use canonical AST transformation component; legacy template executor is not a runtime authority.'},
{service:'browserE2EPreflightService',path:'src/miki/selfDevelopment/services/browserE2EPreflightService.ts',classification:'OBSOLETE_APP_ONLY',action:'Keep disconnected because MIKI-AI is app-only and browser preview is out of scope.'},
{service:'codeKnowledgeLoaderService',path:'src/miki/core/services/codeKnowledgeLoaderService.ts',classification:'DYNAMIC_ENTRY',action:'Lazy knowledge import only; do not add eager startup load.'},
{service:'codeTemplateLibraryService',path:'src/miki/selfDevelopment/services/codeTemplateLibraryService.ts',classification:'UI_OR_MANUAL',action:'Template library remains explicit design-time capability.'},
{service:'codeUnderstandingService',path:'src/miki/selfDevelopment/services/codeUnderstandingService.ts',classification:'DUPLICATE_CONSOLIDATED',canonical:'semanticUnderstandingV2OrchestratorService',action:'Semantic understanding is canonical; legacy code comprehension must supply evidence only.'},
{service:'collectionSourceRegistryService',path:'src/miki/core/services/collectionSourceRegistryService.ts',classification:'MISSING_CONNECTION',action:'Connect to collection receipt creation, not to every core cycle.'},
{service:'complexityCostGateService',path:'src/miki/core/services/complexityCostGateService.ts',classification:'MISSING_CONNECTION',action:'Connect before high-cost candidate execution.'},
{service:'conversationEvaluationService',path:'src/miki/conversation/services/conversationEvaluationService.ts',classification:'DUPLICATE_CONSOLIDATED',canonical:'dialogueEvaluationService',action:'Dialogue evaluation is canonical for runtime scoring; large conversation evaluator remains offline corpus evaluator.'},
{service:'coreOperationRegistryService',path:'src/miki/core/services/coreOperationRegistryService.ts',classification:'MISSING_CONNECTION',action:'Connect through core operation dispatch boundary.'},
{service:'criterionRevisionApplicationService',path:'src/miki/selfDevelopment/services/criterionRevisionApplicationService.ts',classification:'MISSING_CONNECTION',action:'Connect after accepted external review criterion revision.'},
{service:'deterministicSelfImprovementLabService',path:'src/miki/improvement/services/deterministicSelfImprovementLabService.ts',classification:'DIAGNOSTIC_ONLY',action:'Run only under explicit lab request; never mutate canonical code.'},
{service:'developmentStrategyExecutionDispatcherService',path:'src/miki/selfDevelopment/services/developmentStrategyExecutionDispatcherService.ts',classification:'MISSING_CONNECTION',action:'Connect below core after strategy selection.'},
{service:'dialogueEvaluationService',path:'src/miki/conversation/services/dialogueEvaluationService.ts',classification:'MISSING_CONNECTION',action:'Connect after conversation response to return quality evidence.'},
{service:'evaluationPackageDownloadService',path:'src/miki/selfDevelopment/services/evaluationPackageDownloadService.ts',classification:'UI_OR_MANUAL',action:'Manual download operation; no automatic runtime invocation.'},
{service:'evidenceIdentityService',path:'src/miki/core/services/evidenceIdentityService.ts',classification:'MISSING_CONNECTION',action:'Connect at evidence persistence boundary to normalize identity.'},
{service:'failureInjectionSuiteService',path:'src/miki/selfDevelopment/services/failureInjectionSuiteService.ts',classification:'DIAGNOSTIC_ONLY',action:'Explicit verification-only execution.'},
{service:'failureRecoveryDispatcherService',path:'src/miki/selfDevelopment/services/failureRecoveryDispatcherService.ts',classification:'MISSING_CONNECTION',action:'Connect from core failure route after failure taxonomy decision.'},
{service:'failureUnderstandingService',path:'src/miki/memory/services/failureUnderstandingService.ts',classification:'MISSING_CONNECTION',action:'Connect failure evidence to governed memory learning.'},
{service:'hardeningRegressionCandidateService',path:'src/miki/improvement/services/hardeningRegressionCandidateService.ts',classification:'MISSING_CONNECTION',action:'Connect to regression candidate intake, not direct adoption.'},
{service:'hybridConversationEngineService',path:'src/miki/conversation/services/hybridConversationEngineService.ts',classification:'DYNAMIC_ENTRY',action:'Existing conversation entry; static single-reference result is a false positive.'},
{service:'improvementProposalService',path:'src/miki/improvement/services/improvementProposalService.ts',classification:'MISSING_CONNECTION',action:'Connect proposals to core intake as candidates only.'},
{service:'itemDesignPlannerService',path:'src/miki/selfDevelopment/services/itemDesignPlannerService.ts',classification:'UI_OR_MANUAL',action:'Explicit item-design workflow.'},
{service:'knowledgeHalfLifeService',path:'src/miki/memory/services/knowledgeHalfLifeService.ts',classification:'MISSING_CONNECTION',action:'Connect to memory retrieval ranking and expiry maintenance.'}
];
class CanonicalServiceAliasRegistryService{
 list():ServiceConnectivityRecord[]{return records.map(record=>({...record}));}
 resolve(service:string):string{return records.find(record=>record.service===service)?.canonical||service;}
 blocksParallelAuthority(service:string):boolean{return records.some(record=>record.service===service&&record.classification==='DUPLICATE_CONSOLIDATED');}
}
export const canonicalServiceAliasRegistryService=new CanonicalServiceAliasRegistryService();
