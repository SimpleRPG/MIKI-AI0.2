import fs from 'node:fs';
const plan = fs.readFileSync('src/miki/conversation/services/autonomousAnswerCompositionPlanService.ts', 'utf8');
const runtime = fs.readFileSync('src/miki/conversation/services/runtimeConversationCompositionService.ts', 'utf8');
const checks = [
  ['content-driven plan service', plan.includes('AutonomousAnswerCompositionPlanService')],
  ['direct answer required', plan.includes("kind: 'DIRECT_ANSWER'")],
  ['conditions preserved', plan.includes("kind: 'CONDITIONS'")],
  ['exceptions preserved', plan.includes("kind: 'EXCEPTIONS'")],
  ['unknown preserved', plan.includes("kind: 'UNKNOWN'")],
  ['no fixed closing for brief', plan.includes('短答または成果物回答では固定終端を避ける')],
  ['canonical sha256 lineage', plan.includes('canonicalSha256(material)')],
  ['runtime creates plan', runtime.includes('autonomousAnswerCompositionPlanService.create(ir)')],
  ['runtime returns plan id', runtime.includes('compositionPlanId: compositionPlan.planId')],
  ['persona remains surface only', runtime.includes('surfacePersona') && !plan.includes('personaProfileService')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed += 1; }
if (failed) process.exit(1);
