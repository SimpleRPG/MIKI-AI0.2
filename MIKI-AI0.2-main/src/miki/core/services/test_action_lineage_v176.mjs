import fs from 'node:fs';
const l=fs.readFileSync('src/miki/core/services/domainReplyLedgerService.ts','utf8');
const checks={type:l.includes('ActionLineage'),field:l.includes('actionLineage: ActionLineage'),action:l.includes('actionId'),knowledge:l.includes('knowledgeIds'),capability:l.includes('capabilityIds'),permission:l.includes('permissionClasses'),outcome:l.includes('outcome: normalized?.status'),backCompat:l.includes('const actionLineage: ActionLineage')};
console.log(JSON.stringify({version:'v176',checks},null,2));if(!Object.values(checks).every(Boolean))process.exit(1);
