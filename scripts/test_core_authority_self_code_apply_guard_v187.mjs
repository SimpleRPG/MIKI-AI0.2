import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const service=read('src/miki/selfDevelopment/services/mikiSelfCodingSuperchargerService.ts');
const aut=read('src/miki/autonomy/services/autonomousContinuousEvolutionService.ts');
const design=read('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt');
const checks={
  defaultApplyOff:service.includes('autoApply: boolean = false'),
  runtimeAuthorityGate:service.includes("if (autoApply && authority !== 'CORE_PROMOTION')"),
  authorityFieldForwarded:service.includes('authority,'),
  localModelArgsNotForwarded:service.includes('localLlmEndpoint: undefined')&&service.includes('localLlmModel: undefined'),
  approvedPathHasAuthority:aut.includes("'CORE_PROMOTION'"),
  approvedPathIsManualBoundary:aut.includes('approveAndDeployRecord')&&aut.includes("authority: 'CORE_PROMOTION'")||aut.includes("'CORE_PROMOTION'\n    );"),
  spec:design.includes('自己コード物理適用のCORE承認境界')
};
assert.equal(Object.values(checks).every(Boolean),true);
console.log(JSON.stringify({version:'v187',passed:true,checks},null,2));
