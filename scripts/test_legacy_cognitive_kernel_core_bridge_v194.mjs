import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const kernel=read('src/miki/selfAwareness/services/mikiCognitiveKernelService.ts');
const server=read('server.ts');
const expected=['core','autonomy','capability','conversation','data','execution','experience','improvement','learning','memory','promotion','research','safety','selfAwareness','selfDevelopment','strategy','unknown','verification'];
const checks={
  coreIngress:kernel.includes("coreTaskIngressService.submit({")&&kernel.includes("kind: 'USER_REQUEST'"),
  noLegacyController:!kernel.includes('integratedCognitionControllerService')&&!kernel.includes("from '../../../services/chapter69_90PlatformServices'"),
  coreAuthority:kernel.includes("authority: 'CORE'"),
  all18:expected.every(d=>kernel.includes(`'${d}'`)),
  noSecondaryBrain:!kernel.includes('new CognitiveKernel')&&!kernel.includes('CognitionController'),
  serverAwaits:server.includes("await mikiCognitiveKernelService.cycle(req.body||{})"),
};
const passed=Object.values(checks).every(Boolean);
console.log(JSON.stringify({version:'v194',passed,checks},null,2));
if(!passed)process.exit(1);
