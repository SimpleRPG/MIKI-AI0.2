import fs from 'node:fs';
const read=fs.readFileSync('src/miki/core/services/priorityOneRuntimeReadModelService.ts','utf8');const gate=fs.readFileSync('src/miki/core/services/coreCompletionGateService.ts','utf8');const gateway=fs.readFileSync('src/miki/core/ui/typedImprovementUiGatewayService.ts','utf8');const receipt=fs.readFileSync('src/miki/core/services/persistenceReceiptLedgerService.ts','utf8');const orchestrator=fs.readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
for(const x of ['taskBlackboardService.list(200)','corePlanRevisionService.latest(task)','reviewZipExportService.list()','waitingPackageIds','allowedActions','IMPORT_FEEDBACK','REPLAN','REGENERATE_CANDIDATE','RECOVER'])if(!read.includes(x))throw new Error('runtime read model missing '+x);
if(!gate.includes("LINEAGE_VERIFICATION_FAILED")||!gate.includes("domainReplyLedgerService.listByTask"))throw new Error('completion-lineage integration missing');
for(const x of ['taskId?:string','corePlanRevision?:number','operationInstanceId?:string','targetSha256?:string','receipt.entitySha256===binding.targetSha256'])if(!receipt.includes(x))throw new Error('receipt binding missing '+x);
for(const x of ['operationInstanceIds:plan.revision.requiredOperations','candidateRevision:Number','packageId:typeof'])if(!orchestrator.includes(x))throw new Error('decision binding missing '+x);
for(const banned of ['initializeImprovementRuntime','executeDirective(...args','submitImprovementRequest(...args','resumeLoop()','requestWithResult(...args'])if(gateway.includes(banned))throw new Error('legacy side-effect facade remains '+banned);
if(!gateway.includes('listRestoredPriorityOneRuntime'))throw new Error('restart list not exposed');
console.log('PASS priority one implementation v117');
