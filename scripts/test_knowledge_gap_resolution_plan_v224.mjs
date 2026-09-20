import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('src/miki/unknown/services/knowledgeGapService.ts','utf8');
for (const token of ['KnowledgeGapResolutionPlan','buildResolutionPlan','advanceResolutionPlan','COLLECT_EVIDENCE','VERIFY','RESOLVE']) assert.match(source,new RegExp(token));
assert.match(source,/resolutionPlan\?: KnowledgeGapResolutionPlan/);
console.log('PASS: Knowledge Gap -> resolution plan wiring V224');
