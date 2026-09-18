import fs from 'node:fs';
import path from 'node:path';

const roots = ['src', 'server.ts', '.env.example'];
const files = [];
const walk = target => {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(target)) walk(path.join(target, name));
    return;
  }
  files.push(target);
};
for (const root of roots) walk(root);

const prohibited = [
  /Jina Reader/i,
  /jina_direct/i,
  /saveJinaApiKey/i,
  /getJinaApiKeyItem/i,
  /setJinaApiKeyItem/i,
  /crawl4ai/i,
];
for (const file of files) {
  if (file.endsWith('legacyResearchProviderMigrationService.ts')) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of prohibited) {
    if (pattern.test(text)) {
      console.error('legacy research provider remains', file, pattern);
      process.exit(1);
    }
  }
}

const searchService = fs.readFileSync('src/miki/research/services/autonomousSearchService.ts', 'utf8');
for (const required of ['runSearxng', 'runWikipedia', 'runDuckDuckGo', 'fetchRenderedPage']) {
  if (!searchService.includes(required)) {
    console.error('required research path missing', required);
    process.exit(1);
  }
}
console.log('PASS bibi remove legacy research providers v2');
