import fs from 'node:fs';
const r=fs.readFileSync('src/miki/research/services/researchService.ts','utf8');
const checks={states:r.includes("'NO_RESULT'")&&r.includes("'INSUFFICIENT_SEARCH'")&&r.includes("'SOURCE_UNAVAILABLE'")&&r.includes("'NOT_FOUND_AFTER_COVERAGE'")&&r.includes("'CONFIRMED_ABSENCE'"),resultField:r.includes('outcome: ResearchOutcomeState;'),resolvedIsEvidence:r.includes("resolved ? 'EVIDENCE_FOUND'"),noFalseAbsence:!r.includes("resolved ? 'CONFIRMED_ABSENCE'")};
console.log(JSON.stringify({version:'v174',checks},null,2));if(!Object.values(checks).every(Boolean))process.exit(1);
