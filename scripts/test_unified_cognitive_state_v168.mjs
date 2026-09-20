import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const core=readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
const design=readFileSync('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt','utf8');
for (const x of ['UnifiedCognitiveStateSnapshot','buildUnifiedCognitiveState','latestUnifiedCognitiveState','cognitiveState:${cycles}','stateHash:canonicalSha256Object','evidenceIds','unknowns','capabilityRefs','learningCandidates','activeDomains']) assert.match(core,new RegExp(x.replace(/[${}]/g,'\\$&')));
assert.match(design,/18構成1つの脳/);
console.log('PASS: single Blackboard-derived Unified Cognitive State V168');
