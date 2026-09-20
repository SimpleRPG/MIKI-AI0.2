import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const research = readFileSync('src/miki/research/services/researchService.ts', 'utf8');
const planner = readFileSync('src/miki/core/services/adaptiveRoutePlannerService.ts', 'utf8');
const design = readFileSync('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt', 'utf8');

assert.match(research, /adaptive\?: boolean/);
assert.match(research, /continuationAvailable/);
assert.match(research, /NEXT_CORE_CYCLE_REQUIRED/);
assert.match(research, /NO_NEW_EVIDENCE/);
assert.match(research, /buildAdaptiveQuery/);
assert.match(research, /maxPagesPerPass/);
assert.match(research, /itemSource\.includes\('wikipedia'\)/);
assert.match(research, /itemSource\.includes\('duckduckgo'\)/);
assert.doesNotMatch(
  research,
  /Math\.min\(3,\s*options\?\.maxPasses \?\? 2\)/,
  '旧固定3回Research制限が残っています'
);

assert.match(planner, /continuationAvailable===true/);
assert.match(planner, /researchContinuation:true/);
assert.match(planner, /target:'research'/);

assert.match(design, /【138】P0｜適応型Research継続探索/);
assert.match(design, /\[P0\] Provider並行探索/);
assert.match(design, /\[P1\] Knowledge Frontierとの探索優先度統合/);

console.log('PASS: adaptive research continuation V161');
