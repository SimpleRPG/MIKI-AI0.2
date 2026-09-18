import fs from 'node:fs';

const uiPath = 'src/components/self_improvement/SelfCodeArchitectTab.tsx';
const gatewayPath = 'src/miki/core/ui/typedSelfCodeArchitectUiGatewayService.ts';
const ui = fs.readFileSync(uiPath, 'utf8');
const gateway = fs.readFileSync(gatewayPath, 'utf8');
const checks = [
  ['UI imports typed gateway', ui.includes('typedSelfCodeArchitectUiGatewayService')],
  ['UI uses one gateway alias', ui.includes('const gateway = typedSelfCodeArchitectUiGatewayService')],
  ['No direct selfDevelopment service import', !/from ['\"]\.\.\/\.\.\/miki\/selfDevelopment\/services\//.test(ui)],
  ['No direct learning service import', !/from ['\"]\.\.\/\.\.\/miki\/learning\/services\//.test(ui)],
  ['No direct autonomy service import', !/from ['\"]\.\.\/\.\.\/miki\/autonomy\/services\//.test(ui)],
  ['No direct improvement service import', !/from ['\"]\.\.\/\.\.\/miki\/improvement\/services\//.test(ui)],
  ['Gateway exposes architect', gateway.includes('readonly architect = selfCodeArchitectService')],
  ['Gateway exposes core results', gateway.includes('readonly coreResults = coreResultService')],
  ['Gateway does not create orchestrator', !gateway.includes('coreOrchestratorService')],
  ['GitHub Actions retained', fs.existsSync('.github/workflows/build-apk.yml')],
  ['Gradle wrapper retained', fs.existsSync('android/gradle/wrapper/gradle-wrapper.jar')],
];
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}
if (failed) process.exit(1);
