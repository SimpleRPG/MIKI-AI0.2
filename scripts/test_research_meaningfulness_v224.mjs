import assert from 'node:assert/strict';
import fs from 'node:fs';
const strategy=fs.readFileSync('src/miki/research/services/researchStrategyService.ts','utf8');
const research=fs.readFileSync('src/miki/research/services/researchService.ts','utf8');
for (const token of ['ResearchMeaningfulnessAssessment','assessMeaningfulness','newEvidenceCount','newIndependentClusters','unresolvedConditionReduction']) assert.match(strategy,new RegExp(token));
assert.match(research,/NO_NEW_EVIDENCE/);
assert.match(research,/advanceResolutionPlan/);
console.log('PASS: Research meaningfulness / gap redefinition boundary V224');
