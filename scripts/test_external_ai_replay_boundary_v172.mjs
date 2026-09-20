import fs from 'node:fs';
const evidence=fs.readFileSync('src/miki/memory/services/evidenceService.ts','utf8');
const bundle=fs.readFileSync('src/miki/research/services/externalAiResearchBundleService.ts','utf8');
const router=fs.readFileSync('src/miki/core/services/domainRouterService.ts','utf8');
const checks={metadata:evidence.includes("trust_boundary?: 'UNTRUSTED_EXTERNAL_WEB' | 'UNTRUSTED_EXTERNAL_AI'"),hashes:bundle.includes('promptSha256')&&bundle.includes('responseSha256')&&bundle.includes('replayKey'),untrusted:bundle.includes("trust_boundary: 'UNTRUSTED_EXTERNAL_AI'"),dedupe:bundle.includes("bundle.responseSha256 === responseSha256")&&bundle.includes("bundle.status === 'IMPORTED'"),coreAuthority:router.includes('CORE_ONLY_BUSINESS_ROUTING')};
const passed=Object.values(checks).every(Boolean);console.log(JSON.stringify({version:'v172',passed,checks},null,2));if(!passed)process.exit(1);
