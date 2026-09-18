import fs from 'node:fs';
const p=fs.readFileSync('src/miki/core/services/adaptiveRoutePlannerService.ts','utf8');
const checks=[
['design philosophy is repository authority',fs.existsSync('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt')],
['UI task uses adaptive assessment',p.includes('assessImprovementReadiness')&&p.includes("kind==='SELF_IMPROVEMENT'")&&p.includes("entry==='TYPED_IMPROVEMENT_UI_GATEWAY'")],
['research selected for gaps',p.includes("target:'research'")&&p.includes('unresolvedKnowledge')],
['candidate requires context and readiness',p.includes("!latestCandidate && readiness.candidateGenerationReady")],
['no unconditional candidate registration',!p.includes('unconditional candidate')],
['candidate result re-evaluated before validation',p.includes('latestCandidate && !latestValidation && readiness.validationReady')],
['validation result re-evaluated before package',p.includes('latestValidation && !latestPackage && readiness.reviewPackageReady')],
['operation state enables revisits',p.includes('const prior=task.entries.filter')],
['stable operation-instance identities',p.includes('operationInstanceId')&&p.includes('dedupeKey')&&p.includes('dependsOn:[sourceOperationInstanceId]')],
['no fixed route cap',!p.includes('routes.slice(0,3)')]
];
let failed=0;for(const[n,ok]of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)failed++;}if(failed)process.exit(1);
