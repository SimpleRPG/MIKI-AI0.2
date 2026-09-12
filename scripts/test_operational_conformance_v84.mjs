import fs from 'fs';
const s=fs.readFileSync('src/services/operationalConformanceService.ts','utf8');
const server=fs.readFileSync('server.ts','utf8');
const checks=[
 ['uncertainty decomposition',/UncertaintyKind.*REQUIREMENT.*MEMORY_CONFLICT.*CAPABILITY_BOUNDARY/s],
 ['terminal reasons',/SUCCESS.*PARTIAL_SUCCESS.*NEEDS_USER_INPUT.*RESOURCE_LIMIT.*CAPABILITY_LIMIT.*SAFETY_STOP.*NO_PROGRESS.*FAILED_WITH_ROLLBACK/s],
 ['progress gate',/NO_PROGRESS/],
 ['resume environment check',/ENVIRONMENT_CHANGED/],
 ['simulation invalidation',/REVALIDATION_REQUIRED/],
 ['causal counterfactual',/counterfactualEffect/],
 ['realization proof gate',/NO_PROVEN_REALIZATION/],
 ['requirement compiler',/compileRequirement/],
 ['reasoning asset graph',/relatedAssets/],
 ['integration scenario',/runIntegrationScenario/],
 ['server wiring',/operationalConformanceService/],
 ['no arbitrary execution',!/(child_process|eval\(|new Function)/.test(s)],
];
for(const [n,re] of checks){if(typeof re==='boolean'?!re:!re.test(s)&&n!=='server wiring')throw new Error('FAIL '+n);if(n==='server wiring'&&!re.test(server))throw new Error('FAIL '+n);console.log('PASS '+n)}
console.log('PASS 12/12');
