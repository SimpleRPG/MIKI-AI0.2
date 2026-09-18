import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
let source = fs.readFileSync('src/miki/research/services/internalWebQueryLearningCycleService.ts', 'utf8');
source = source.replace("import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';", `import { createHash } from 'node:crypto';\nconst canonicalSha256Object = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');`);
const temp = path.join(os.tmpdir(), `priority10-${process.pid}.ts`);
fs.writeFileSync(temp, source);
try {
  const { internalWebQueryLearningCycleService: service } = await import(`${pathToFileURL(temp).href}?v=${Date.now()}`);
  const result = service.run('Capacitor WebView fetch contract', 'GALAXY_S25', [
    { url:'fixture://html', contentKind:'HTML', selector:'#content', content:'<nav>Home</nav><aside class="advert">Ad</aside><div class="menu">Menu</div><main id="content">Capacitor WebView returns rendered content. Android bridge contract applies.</main><footer>Footer</footer>' },
    { url:'fixture://markdown', contentKind:'MARKDOWN', content:'# Termux notes\nWindows and Android environments differ.' },
    { url:'fixture://xpath', contentKind:'HTML', xpath:'//article[@class="docs"]', content:'<article class="docs">XPath extraction supplies independent evidence.</article>' },
  ]);
  const checks = [
    ['three fixture pages processed', result.coverage.processedPageCount === 3],
    ['all fixture pages became evidence', result.coverage.evidencePageCount === 3 && result.coverage.ratio === 1],
    ['navigation separated', result.pages[0].sections.navigation === 'Home'],
    ['advertisement separated', result.pages[0].sections.advertisements === 'Ad'],
    ['menu separated', result.pages[0].sections.menus === 'Menu'],
    ['footer separated', result.pages[0].sections.footer === 'Footer'],
    ['CSS selected main body', result.pages[0].selectedText.includes('Capacitor WebView')],
    ['Markdown normalized', result.pages[1].selectedText.includes('Termux notes')],
    ['XPath selected article', result.pages[2].selectedText.includes('independent evidence')],
    ['evidence claim term component created', result.evidence.length === 3 && result.claims.length === 3 && result.terms.length > 0 && result.knowledgeComponent.evidenceIds.length === 3],
    ['query outcome learned', result.queryOutcome.status === 'EVIDENCE_GAINED'],
    ['revision pair retained successful query', result.revisionPair.before === result.revisionPair.after],
    ['Galaxy S25 environment retained', result.environment === 'GALAXY_S25' && result.evidence.every(item => item.environment === 'GALAXY_S25')],
    ['result hash emitted', /^[a-f0-9]{64}$/.test(result.resultSha256)],
  ];
  let failed = 0; for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed += 1; }
  if (failed) process.exitCode = 1;
} finally { fs.rmSync(temp, { force:true }); }
