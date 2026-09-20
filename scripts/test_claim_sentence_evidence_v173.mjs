import fs from 'node:fs';
const types=fs.readFileSync('src/types.ts','utf8');
const conv=fs.readFileSync('src/miki/conversation/services/coreResultAnswerContentIrService.ts','utf8');
const checks={type:types.includes('AnswerSentenceProvenance')&&types.includes('provenance?: AnswerSentenceProvenance[];'),lineage:conv.includes('extractLineage')&&conv.includes('factProvenance'),missingToUnverified:conv.includes('根拠未追跡'),completionGate:conv.includes("coreResult.status === 'completed' && unsupportedFacts.length === 0"),verificationAware:conv.includes('verificationOutcomes'),};
console.log(JSON.stringify({version:'v173',checks},null,2));if(!Object.values(checks).every(Boolean))process.exit(1);
