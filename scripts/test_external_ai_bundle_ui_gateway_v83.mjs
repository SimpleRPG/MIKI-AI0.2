import fs from 'node:fs';
const panel=fs.readFileSync('src/components/ExternalAiResearchBundlesPanel.tsx','utf8');
const gateway=fs.readFileSync('src/miki/core/ui/typedResearchUiGatewayService.ts','utf8');
const checks=[
 ['panel uses typed gateway',panel.includes('typedResearchUiGatewayService')],
 ['panel has no direct bundle service import',!panel.includes("research/services/externalAiResearchBundleService")],
 ['build uses gateway',panel.includes('buildExternalAiResearchBundles')],
 ['send uses gateway',panel.includes('sendExternalAiResearchBundle')],
 ['import uses gateway',panel.includes('importExternalAiResearchResponse')],
 ['gateway authorizes build',gateway.includes("authorize('BUILD_EXTERNAL_AI_RESEARCH_BUNDLES'")],
 ['gateway authorizes send',gateway.includes("authorize('SEND_EXTERNAL_AI_RESEARCH_BUNDLE'")],
 ['gateway authorizes import',gateway.includes("authorize('IMPORT_EXTERNAL_AI_RESEARCH_RESPONSE'")],
 ['busy disables mutation buttons',panel.includes('disabled={busy}')],
 ['mobile tap targets',panel.includes('min-h-11') && panel.includes('min-h-12')],
];
let failed=0; for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
if(failed)process.exit(1);
