import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const checks=[
['policy service',fs.existsSync('src/miki/research/services/webResearchPolicyService.ts')],
['policy panel',fs.existsSync('src/components/WebResearchPolicyPanel.tsx')],
['gateway operations',read('src/miki/core/ui/typedCoreUiGatewayService.ts').includes('SAVE_WEB_RESEARCH_POLICY')],
['gateway core ingress',read('src/miki/core/ui/typedCoreUiGatewayService.ts').includes("operation:'SAVE_WEB_RESEARCH_POLICY'")],
['panel gateway only',!read('src/components/WebResearchPolicyPanel.tsx').includes('storageService')],
['targets',/1,label:'1件'.*10,label:'10件'.*AUTO/s.test(read('src/components/WebResearchPolicyPanel.tsx'))],
['primary and counter evidence',read('src/miki/research/services/webResearchPolicyService.ts').includes('requirePrimarySource')&&read('src/miki/research/services/webResearchPolicyService.ts').includes('requireCounterEvidenceSearch')],
['remaining calculation',read('src/miki/research/services/webResearchPolicyService.ts').includes('acceptedIndependentSourceCount')],
['crawl4ai removed from connection type',!read('src/miki/core/services/externalConnectionUiService.ts').includes("'crawl4ai'")],
['crawl4ai removed from UI defaults',!read('src/miki/core/services/externalConnectionUiService.ts').includes("name:'Crawl4AI'")],
['github workflow retained',fs.existsSync('.github/workflows/build-apk.yml')],
['gradle wrapper retained',fs.existsSync('android/gradle/wrapper/gradle-wrapper.jar')]
];
let fail=0;for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)fail++;}console.log(`SUMMARY ${checks.length-fail}/${checks.length}`);process.exit(fail?1:0);
