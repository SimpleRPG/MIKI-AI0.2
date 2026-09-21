import assert from 'node:assert/strict';

import { researchService } from '../src/miki/research/services/researchService';
import { autonomousSearchService } from '../src/miki/research/services/autonomousSearchService';
import { knowledgeGapService } from '../src/miki/unknown/services/knowledgeGapService';
import { reusableComponentFactoryService } from '../src/miki/core/services/reusableComponentFactoryService';

const PROBE_TERM = 'ResearchPipelineProbe';

const originalExecuteSearch = autonomousSearchService.executeSearch;
const originalReadSearchResultPages = autonomousSearchService.readSearchResultPages;

async function run() {
  try {
  /*
   * 実Web検索を使わない決定論的fixture。
   * ResearchService本体はそのまま実行し、
   * 検索ProviderとWebページ取得だけを差し替える。
   */
  (autonomousSearchService as any).executeSearch = async () => ({
    results: [
      {
        title: 'Research Pipeline Fixture',
        snippet: `${PROBE_TERM} は ResearchService のE2E検証用語です。`,
        source: 'fixture',
        url: 'https://example.test/research-pipeline',
        sourceId: 'fixture:research-pipeline',
        independenceClusterId: 'fixture:research-pipeline',
        claimText: `${PROBE_TERM} は ResearchService のE2E検証用語です。`,
      },
    ],
    summary: 'ResearchService web term learning E2E fixture',
    provider: 'fixture',
  });

  (autonomousSearchService as any).readSearchResultPages = async (
    _query: string,
    results: any[],
  ) =>
    results.map((result) => ({
      result,
      success: true,
      url: result.url,
      text: `
        Research Pipeline Fixture
        ${PROBE_TERM} は ResearchService がWebページ本文をEvidenceとして
        取り込み、用語学習へ接続できることを検証するためのテスト用語です。
        ${PROBE_TERM} ${PROBE_TERM}
      `,
    }));

  const gap = knowledgeGapService.detect({
    query: `ResearchService ${PROBE_TERM} web term learning E2E`,
    reason: 'ResearchServiceからWeb用語学習までの統合経路を検証する',
    type: 'UNKNOWN_TERM',
    priority: 50,
    requiredEvidence: ['deterministic research fixture'],
  });

  const before = reusableComponentFactoryService
    .list()
    .filter(
      (component: any) =>
        component.componentType === 'TERM_KNOWLEDGE' &&
        component.purpose?.includes(PROBE_TERM.toLowerCase()),
    ).length;

  const result = await researchService.researchGap(gap, {
    forceRoute: 'WEB_SEARCH',
    adaptive: false,
    maxPasses: 1,
    maxPagesPerPass: 1,
    query: `ResearchService ${PROBE_TERM}`,
  });

  const afterComponents = reusableComponentFactoryService
    .list()
    .filter(
      (component: any) =>
        component.componentType === 'TERM_KNOWLEDGE' &&
        component.purpose?.includes(PROBE_TERM.toLowerCase()),
    );

  const probe = afterComponents.find(
    (component: any) =>
      component.purpose?.includes(PROBE_TERM.toLowerCase()),
  );

  assert.equal(result.route, 'WEB_SEARCH');
  assert.equal(result.performed, true);
  assert.ok(result.evidence.length > 0, 'ResearchServiceがEvidenceを生成していません');
  assert.ok(
    result.evidence.some((e) => e.url === 'https://example.test/research-pipeline'),
    'fixtureページのEvidenceがResearch結果にありません',
  );

  assert.ok(
    afterComponents.length > before,
    'ResearchServiceからTERM_KNOWLEDGEが生成されていません',
  );

  assert.ok(probe, `${PROBE_TERM.toLowerCase()} のTERM_KNOWLEDGEがありません`);

  const retrieved = reusableComponentFactoryService.retrieve({
    purpose: `Web page term knowledge: ${PROBE_TERM.toLowerCase()}`,
    kinds: ['KNOWLEDGE'],
  });

  assert.ok(
    retrieved.candidates.some((component: any) => component.componentId === probe.componentId),
    '生成したTERM_KNOWLEDGEをRepositoryからretrieveできません',
  );

  console.log(
    JSON.stringify(
      {
        schemaVersion: 1,
        test: 'RESEARCH_WEB_TERM_LEARNING_E2E',
        passed: true,
        route: result.route,
        performed: result.performed,
        evidenceCount: result.evidence.length,
        claimCount: result.claimIds.length,
        roundsCompleted: result.roundsCompleted,
        generatedTermComponents: afterComponents.length - before,
        probeTerm: PROBE_TERM,
        repositoryRetrieved: true,
        outcome: result.outcome,
      },
      null,
      2,
    ),
  );

} finally {
  (autonomousSearchService as any).executeSearch = originalExecuteSearch;
  (autonomousSearchService as any).readSearchResultPages =
    originalReadSearchResultPages;
}
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
