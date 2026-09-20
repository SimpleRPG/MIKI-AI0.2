import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const architect=read('src/miki/selfDevelopment/services/selfCodeArchitectService.ts');
const ultra=read('src/components/self_improvement/UltraSelfEvolverSubView.tsx');
const supercharger=read('src/miki/selfDevelopment/services/mikiSelfCodingSuperchargerService.ts');
const design=read('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt');
const checks={
  architectReviewOnly:architect.includes('false, // V189: selfDevelopment direct caller is review-only'),
  ultraReviewOnly:ultra.includes('targetFileHint.trim() || undefined,\n        false,'),
  runtimeDefaultClosed:supercharger.includes("autoApply: boolean = false"),
  corePromotionGuard:supercharger.includes("authority !== 'CORE_PROMOTION'"),
  spec:design.includes('SelfDevelopment直接適用呼出のReview-only化')
};
const passed=Object.values(checks).every(Boolean);
console.log(JSON.stringify({version:'v189',passed,checks},null,2));
if(!passed)process.exit(1);
