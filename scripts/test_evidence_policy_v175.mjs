import fs from 'node:fs';
const v=fs.readFileSync('src/miki/verification/services/verifierService.ts','utf8');
const checks={policy:v.includes('ClaimEvidencePolicy'),kindPolicy:v.includes('baseByKind')&&v.includes('FACT_CLAIM'),risk:v.includes('highRisk')&&v.includes('minIndependentClusters: highRisk ? 3 : 2'),allowedKinds:v.includes('allowedEvidenceKinds'),fresh:v.includes('policy.requireFresh'),promotionGate:v.includes('!policy.promotionAllowed'),policyThreshold:v.includes('independentClusters.size >= policy.minIndependentClusters')};
console.log(JSON.stringify({version:'v175',checks},null,2));if(!Object.values(checks).every(Boolean))process.exit(1);
