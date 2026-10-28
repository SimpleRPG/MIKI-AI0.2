import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isSourceBackedSearchResult, mergeSearchResults } from '../src/miki/research/services/autonomousSearchService';
import { isRealDataProvider } from '../src/miki/research/services/webMaterialPatternExtractor';

const valid = {
  title: 'Research reference',
  snippet: 'A source-backed result with useful content.',
  source: 'SearXNG',
  url: 'https://example.org/research/reference',
};
assert.equal(isSourceBackedSearchResult(valid), true, 'Valid HTTPS source should pass');
assert.equal(isSourceBackedSearchResult({ ...valid, url: 'javascript:alert(1)' }), false, 'Non-HTTP schemes must fail');
assert.equal(isSourceBackedSearchResult({ ...valid, url: 'https://user:secret@example.org/reference' }), false, 'Credential-bearing URLs must fail');
assert.equal(isSourceBackedSearchResult({ ...valid, url: 'not a URL' }), false, 'Malformed URLs must fail');
assert.equal(isSourceBackedSearchResult({ ...valid, source: '' }), false, 'Missing source labels must fail');
assert.equal(isSourceBackedSearchResult({ ...valid, snippet: 'local synthetic fallback payload' }), false, 'Synthetic fallback results must fail');
assert.equal(isRealDataProvider('searxng'), true, 'Concrete SearXNG provider should pass');
assert.equal(isRealDataProvider('wikipedia'), true, 'Concrete Wikipedia provider should pass');
assert.equal(isRealDataProvider('duckduckgo'), true, 'Concrete DuckDuckGo provider should pass');
assert.equal(isRealDataProvider('parallel'), false, 'Aggregate parallel provider must not stand in for a source provider');

const merged = mergeSearchResults([
  { provider: 'searxng', results: [{ ...valid, title: 'SearX item', url: 'https://example.org/a' }] },
  { provider: 'wikipedia', results: [{ ...valid, title: 'Wikipedia item', source: 'Wikipedia', url: 'https://example.org/b' }] },
], 'auto', 4);
assert.equal(merged.find((item) => item.title === 'SearX item')?.provider, 'searxng', 'Merged result must retain its concrete provider');
assert.equal(merged.find((item) => item.title === 'Wikipedia item')?.provider, 'wikipedia', 'Each merged result must retain its own concrete provider');

const background = readFileSync('src/miki/execution/services/backgroundWorkerService.ts', 'utf8');
const workflow = readFileSync('.github/workflows/build-apk.yml', 'utf8');
const design = readFileSync('MIKI-AI0.2_統合設計書_正本.txt', 'utf8');
const admission = background.indexOf('const searchResults = syntheticSummary');
const learningStart = background.indexOf('if (searchResults.length > 0)', admission);
assert.ok(admission >= 0 && learningStart > admission, 'Provenance admission must run before all candidate registration');
assert.ok(background.includes('isSourceBackedSearchResult(result) && isRealDataProvider(provider)'), 'Background learning must use shared source and provider gates');
assert.ok(background.includes("sourceUrl: String(result.url || '')"), 'Surface patterns must retain their own result URL');
assert.ok(background.includes("provider: String(result.provider || '')"), 'Surface patterns must retain their own concrete provider');
assert.ok(!background.includes('combinedSnippets'), 'Cross-source snippets must not be attributed to one URL');
assert.ok(!background.includes('provider: searchRes.provider'), 'Aggregate provider must not be used as result provenance');
assert.ok(workflow.includes('npx tsx scripts/verify_background_web_research_provenance_p337.ts'), 'P337 provenance verifier must run in CI');
assert.match(design, /B-013\n状態：検証待ち/);
assert.match(design, /B-014\n状態：検証待ち/);

console.log('P337 background research provenance and source-level contracts: PASS');
