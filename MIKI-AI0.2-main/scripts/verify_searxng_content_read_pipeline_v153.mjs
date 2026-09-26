import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const autonomous = readFileSync('src/miki/research/services/autonomousSearchService.ts', 'utf8');
const research = readFileSync('src/miki/research/services/researchService.ts', 'utf8');
const native = readFileSync('src/miki/execution/services/nativeWorkManagerService.ts', 'utf8');

assert.match(autonomous, /\/search\?q=\$\{encodeURIComponent\(cleanQuery\)\}&format=json/);
assert.match(autonomous, /readSearchResultPages/);
assert.match(autonomous, /this\.fetchRenderedPage\(result\.url/);
assert.match(research, /readSearchResultPages\(passQuery, results/);
assert.match(research, /title: `\$\{page\.result\.title\} \[本文読取\]`/);
assert.match(research, /source: sourceProvider/);
assert.match(research, /fetch_method: 'headless_webview'/);
assert.match(native, /public async fetchRenderedPage\(/);

console.log('PASS: SearXNG search -> selected result URL -> page read -> Web Evidence wiring is present.');
console.log('NOTE: real Galaxy S25/Termux runtime E2E still requires execution on the device.');
