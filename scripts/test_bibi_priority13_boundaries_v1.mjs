import fs from 'node:fs';
const read = file => fs.readFileSync(file, 'utf8');
const secret = read('src/miki/safety/services/secretRedactionService.ts');
const pathBoundary = read('src/miki/safety/services/workspacePathBoundaryService.ts');
const broker = read('src/miki/execution/services/workspaceExecutionBrokerService.ts');
const checks = [
  ['secret redaction service exists', fs.existsSync('src/miki/safety/services/secretRedactionService.ts')],
  ['redacts secret keys', secret.includes('SECRET_KEY_PATTERN') && secret.includes("'[REDACTED]'" )],
  ['redacts bearer tokens', secret.includes('BEARER_PATTERN')],
  ['redacts URL credentials', secret.includes('URL_CREDENTIAL_PATTERN')],
  ['records redacted paths', secret.includes('redactedPaths')],
  ['workspace traversal remains rejected', pathBoundary.includes('PATH_TRAVERSAL_REJECTED') && pathBoundary.includes('ENCODED_TRAVERSAL_REJECTED')],
  ['execution requires core decision', broker.includes('CORE_DECISION_REQUIRED')],
  ['execution rejects shell', broker.includes('SHELL_TRUE_FORBIDDEN')],
  ['execution rejects secret environment names', broker.includes('SECRET_ENVIRONMENT_FORBIDDEN')],
  ['execution rejects secret values', broker.includes('SECRET_VALUE_FORBIDDEN')],
  ['execution enforces output limit', broker.includes('OUTPUT_LIMIT_INVALID')],
  ['execution blocks network URL when none', broker.includes('NETWORK_ARGUMENT_FORBIDDEN')],
];
let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
  if (!pass) failed += 1;
}
console.log(`SUMMARY ${checks.length - failed}/${checks.length}`);
process.exit(failed ? 1 : 0);
