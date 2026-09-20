import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const autonomous = readFileSync('src/miki/research/services/autonomousSearchService.ts', 'utf8');
const research = readFileSync('src/miki/research/services/researchService.ts', 'utf8');
const types = readFileSync('src/types.ts', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

assert.match(
  autonomous,
  /Promise\.allSettled\(\s*providerRuns\.map/,
  'Provider並行探索がPromise.allSettledで実装されていません',
);
assert.match(autonomous, /mergeSearchResults/, '並行探索結果の統合関数がありません');
assert.match(autonomous, /providerStatuses/, 'Provider別状態が記録されていません');
assert.match(
  autonomous,
  /preferredProviderは「最初に試すProvider」ではなく/,
  'preferredProviderが並行探索向けタイブレークになっていません',
);
assert.doesNotMatch(
  autonomous,
  /for\s*\(const step of pipelineSteps\)/,
  '旧直列Providerフォールバックループが残っています',
);
assert.match(
  autonomous,
  /Promise\.all\(\s*readable\.map/,
  '検索結果本文取得が並行化されていません',
);
assert.match(autonomous, /independenceClusterId/, 'Evidence独立性情報がありません');

assert.match(
  research,
  /itemSource = String\(page\.result\.source \|\| ''\)\.toLowerCase\(\)/,
  'ResearchServiceがページごとのProviderを判別していません',
);
assert.match(research, /itemSource\.includes\('wikipedia'\)/, 'Wikipedia識別がありません');
assert.match(research, /itemSource\.includes\('duckduckgo'\)/, 'DuckDuckGo識別がありません');

assert.match(types, /sourceId\?: string;/, 'WebSearchResultItem.sourceId がありません');
assert.match(
  types,
  /independenceClusterId\?: string;/,
  'WebSearchResultItem.independenceClusterId がありません',
);
assert.match(types, /claimText\?: string;/, 'WebSearchResultItem.claimText がありません');

assert.equal(
  pkg.scripts['test:japanese-analysis-composition'],
  undefined,
  '削除済みtest_japanese_analysis_composition.mjsへの古いnpm scriptが残っています',
);
assert.equal(
  pkg.scripts['test:parallel-research-providers-v160'],
  'node scripts/test_parallel_research_providers_v160.mjs',
  'V160検証scriptがpackage.jsonに登録されていません',
);
assert.ok(existsSync('scripts/test_parallel_research_providers_v160.mjs'));

console.log('PASS: parallel research provider integration V160');
