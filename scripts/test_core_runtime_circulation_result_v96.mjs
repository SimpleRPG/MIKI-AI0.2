import fs from 'node:fs';
const source=fs.readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
const required=['buildRuntimeCirculationResult','selectedClassificationIds','replyIds','evidenceIds','decisionId','persistenceReceiptIds','operationId','commandId'];
const missing=required.filter(token=>!source.includes(token));
if(missing.length){console.error(`missing runtime circulation lineage: ${missing.join(',')}`);process.exit(1);}
if(!source.includes('coreResultService.complete(reqId,this.buildRuntimeCirculationResult')){console.error('completed Core Result does not use runtime circulation lineage');process.exit(1);}
console.log('PASS core runtime circulation result v96');
