import fs from 'node:fs';
const read = p => fs.readFileSync(p, 'utf8');
const server = read('server.ts');
const architect = read('src/miki/selfDevelopment/services/selfCodeArchitectService.ts');
const controller = read('src/miki/improvement/services/selfImprovementControllerService.ts');
const checks = [
 ['write requires core decision and verification', server.includes('CORE_DECISION_AND_VERIFICATION_REQUIRED')],
 ['write verifies artifact sha256', server.includes('ARTIFACT_SHA256_MISMATCH')],
 ['client dry-run fails closed', architect.includes('verificationEvidenceId') && architect.includes('[Dry-Run未完了]')],
 ['commit requires write receipt', architect.includes('writeResult.written !== true') && architect.includes('writeResult.coreDecisionId')],
 ['directive no pre-ingress in-progress', !/executeDirective[\s\S]{0,300}markStatus\(directiveId, 'IN_PROGRESS'\)/.test(controller)],
 ['lesson direct write blocked', server.includes("operation: 'LEARNING_CANDIDATE_CREATE'")],
 ['dead code count transparent', server.includes('totalEligibleFiles') && server.includes('HEURISTIC_SUSPECT_ONLY')],
 ['prompt patch fail closed', server.includes("status: dryRunValid ? 'VALIDATED' : 'PROPOSED'") && server.includes('success: dryRunValid')],
];
let failed = 0; for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; } process.exitCode = failed ? 1 : 0;
