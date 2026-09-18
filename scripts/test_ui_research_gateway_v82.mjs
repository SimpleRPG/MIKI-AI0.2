import fs from 'node:fs';
const tab=fs.readFileSync('src/components/self_improvement/AutonomousSearchTab.tsx','utf8');
const gateway=fs.readFileSync('src/miki/core/ui/typedResearchUiGatewayService.ts','utf8');
const checks=[
 ['tab uses typed gateway',tab.includes('typedResearchUiGatewayService')],
 ['no autonomous search direct import',!tab.includes("from '../../miki/research/services/autonomousSearchService'")],
 ['no banned topics direct import',!tab.includes("from '../../miki/safety/services/bannedTopicsConfigService'")],
 ['no api settings direct import',!tab.includes("from '../../services/api'")],
 ['no work manager direct import',!tab.includes("from '../../miki/execution/services/nativeWorkManagerService'")],
 ['gateway uses core ingress',gateway.includes('coreTaskIngressService.submit')],
 ['search authorization',gateway.includes("authorize('EXECUTE_AUTONOMOUS_SEARCH'")],
 ['learning authorization',gateway.includes("authorize('LEARN_FROM_SEARCH_OUTCOME'")],
 ['render authorization',gateway.includes("authorize('FETCH_RENDERED_RESEARCH_PAGE'")],
 ['secret value not in core payload',gateway.includes("configured: Boolean(apiKey.trim())")],
];
let fail=0;for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)fail++;}process.exit(fail?1:0);
