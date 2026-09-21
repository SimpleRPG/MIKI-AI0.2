import { webTermLearningService } from '../src/miki/research/services/webTermLearningService';
import { reusableComponentFactoryService } from '../src/miki/core/services/reusableComponentFactoryService';

const TEST_URL = 'https://example.invalid/miki-web-term-learning-e2e';
const TEST_EVIDENCE_ID = 'EVIDENCE-WEB-TERM-E2E-001';
const PROBE_TERM = 'MikiTermLearningProbe';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

function main(): void {
  const before = reusableComponentFactoryService.list().length;

  const result = webTermLearningService.learnPage({
    text: [
      `このページは ${PROBE_TERM} の動作確認用です。`,
      `${PROBE_TERM} はWebページから抽出される未知語のテスト対象です。`,
      `同じ ${PROBE_TERM} を複数回出現させ、用語学習と保存を検証します。`,
      'JavaScript とネットワークについても説明します。',
    ].join('\n'),
    url: TEST_URL,
    evidenceId: TEST_EVIDENCE_ID,
    sourceTitle: 'Web Term Learning E2E Test',
  });

  assert(result.componentIds.length > 0, 'learnPage() がKnowledge Componentを生成していません');
  assert(result.terms.length > 0, 'learnPage() が用語を抽出していません');

  const probe = result.terms.find(term => term.term === PROBE_TERM.toLowerCase());
  assert(probe, `テスト用語 ${PROBE_TERM.toLowerCase()} が抽出されていません`);
  assert(probe.occurrences >= 2, `${PROBE_TERM} の出現回数が2未満です`);

  const saved = reusableComponentFactoryService.list();
  const generated = result.componentIds
    .map(componentId => saved.find(component => component.componentId === componentId))
    .filter(Boolean);

  assert(generated.length === result.componentIds.length, '生成したComponentをRepositoryから再取得できません');

  for (const component of generated) {
    assert(component.componentKind === 'KNOWLEDGE', `componentKind が KNOWLEDGE ではありません: ${component.componentId}`);
    assert(component.componentType === 'TERM_KNOWLEDGE', `componentType が TERM_KNOWLEDGE ではありません: ${component.componentId}`);
    assert(component.lifecycleStatus === 'CANDIDATE', `lifecycleStatus が CANDIDATE ではありません: ${component.componentId}`);
    assert(component.verificationStatus === 'UNVERIFIED', `verificationStatus が UNVERIFIED ではありません: ${component.componentId}`);
    assert(component.sourceUrls.includes(TEST_URL), `sourceUrls にテストURLがありません: ${component.componentId}`);
    assert(component.evidenceRefs.includes(TEST_EVIDENCE_ID), `evidenceRefs にテストEvidence IDがありません: ${component.componentId}`);
  }

  const retrieved = reusableComponentFactoryService.retrieve({
    purpose: `Web page term knowledge: ${PROBE_TERM}`,
    environmentFingerprint: 'unknown',
    kinds: ['KNOWLEDGE'],
  });

  assert(
    retrieved.candidates.some(component => result.componentIds.includes(component.componentId)),
    `${PROBE_TERM} のKnowledge Componentをretrieve()で取得できません`,
  );

  const after = reusableComponentFactoryService.list().length;

  console.log(JSON.stringify({
    schemaVersion: 1,
    test: 'WEB_TERM_LEARNING_E2E',
    passed: true,
    generatedComponents: result.componentIds.length,
    extractedTerms: result.terms.length,
    probeTerm: PROBE_TERM,
    probeOccurrences: probe.occurrences,
    repositoryCountBefore: before,
    repositoryCountAfter: after,
    retrieved: true,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    schemaVersion: 1,
    test: 'WEB_TERM_LEARNING_E2E',
    passed: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
}
