import fs from 'node:fs';
const gateway=fs.readFileSync('src/miki/core/ui/typedImprovementUiGatewayService.ts','utf8');
const ui=fs.readFileSync('src/components/AutonomousImprovementHome.tsx','utf8');
const contract=['domainReplyIds:string[]','evidenceIds:string[]','persistenceReceiptIds:string[]','decisionId?:string','this.stringArray(corePayload?.replyIds)','this.stringArray(corePayload?.evidenceIds)','this.stringArray(corePayload?.persistenceReceiptIds)'];
const missingContract=contract.filter(token=>!gateway.includes(token));if(missingContract.length){console.error(`lineage contract missing: ${missingContract.join(',')}`);process.exit(1);}
const displayed=['domainReplyIds.join', 'evidenceIds.join', 'persistenceReceiptIds.join', 'decisionId', 'unresolved.join'];
const missingDisplay=displayed.filter(token=>!ui.includes(token));if(missingDisplay.length){console.error(`lineage display missing: ${missingDisplay.join(',')}`);process.exit(1);}
if(ui.includes('(lastImprovementCommandResult.coreResult as any)')){console.error('UI still reads untyped core payload directly');process.exit(1);}
console.log('PASS UI improvement lineage v108');
