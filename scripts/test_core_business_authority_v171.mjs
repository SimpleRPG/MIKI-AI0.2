import fs from 'node:fs';
const r=fs.readFileSync('src/miki/core/services/domainRouterService.ts','utf8');
const checks={coreOnlyGuard:r.includes('CORE_ONLY_BUSINESS_ROUTING'),sourceCheck:r.includes("envelope.source!=='core'"),diagnosticAllowlist:r.includes('coreOnlyDiagnostics'),coreDispatchPreserved:r.includes("domainRouterService.create('core'")};
const passed=Object.values(checks).every(Boolean);console.log(JSON.stringify({version:'v171',passed,checks},null,2));if(!passed)process.exit(1);
