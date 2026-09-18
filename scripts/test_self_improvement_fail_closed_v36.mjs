import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const evidence=read('src/miki/memory/services/evidenceService.ts');
const verifier=read('src/miki/verification/services/verifierService.ts');
const engine=read('src/miki/improvement/services/evidenceBasedSelfImprovementEngine.ts');
const evolution=read('src/miki/autonomy/services/autonomousContinuousEvolutionService.ts');
const checks=[
 ['execution claim does not auto-admit',!evidence.includes("evidence.status = 'ADMISSIBLE';\n    this.save();\n    return claim.claim_id;\n  }\n\n  public getEvidence")],
 ['verifier uses strict execution evidence',verifier.includes('isAdmissibleExecutionEvidence')],
 ['verifier requires execution contract',verifier.includes('executionRequirement?:')],
 ['missing counterexample is not pass',!engine.includes('counterexampleResult?.passed ?? true')],
 ['missing generalization is not pass',!engine.includes('generalizationResult?.passed ?? true')],
 ['length pseudo hash removed',!evolution.includes('hash_pre_')&&!evolution.includes('hash_post_')],
 ['artifact SHA-256 used',evolution.includes("crypto.subtle.digest('SHA-256'")]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}if(failed)process.exit(1);
