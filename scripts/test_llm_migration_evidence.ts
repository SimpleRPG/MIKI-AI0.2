import { llmMigrationProtocolService } from '../src/services/llmMigrationProtocolService';

const taskId = 'MIG-EVIDENCE-SELFTEST';
const existing = llmMigrationProtocolService.getTaskById(taskId);
if (!existing) {
  llmMigrationProtocolService.registerNewTask({
    taskId,
    taskName: 'Migration evidence self-test',
    category: 'FIXED_EXPLANATION',
    description: '13.3 evidence gate regression test',
    inputStructureDefinition: 'AnswerContentIR',
    outputContract: 'SurfaceExplanationString',
    status: 'NON_LLM_CANDIDATE',
    assignedComponentId: 'ir.surface_generator_v1',
  });
}

for (let i = 0; i < 10; i++) {
  llmMigrationProtocolService.runShadowComparison({
    taskId,
    sampleInput: `evidence-case-${i}`,
    llmOutput: 'measured-llm-output',
    nonLlmOutput: 'measured-non-llm-output',
    latencyLlmMs: 100 + i,
    latencyNonLlmMs: 10 + i,
    semanticMatchScore: 99,
    naturalnessScore: 95,
    userCorrection: false,
  });
}

const decision = llmMigrationProtocolService.evaluatePromotion(taskId);
if (!decision) throw new Error('migration task missing');
if (!decision.promotable || decision.recommendedStatus !== 'NON_LLM_DEFAULT') {
  throw new Error(`unexpected promotion decision: ${JSON.stringify(decision)}`);
}
if (decision.evidence.recordCount < 10 || decision.evidence.determinismRate < 99) {
  throw new Error(`evidence aggregation failed: ${JSON.stringify(decision.evidence)}`);
}

console.log('PASS: 13.3 migration evidence aggregation + promotion gate');
