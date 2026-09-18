import fs from 'node:fs';
const server=fs.readFileSync('server.ts','utf8');
const client=fs.readFileSync('src/miki/selfDevelopment/services/selfCodeArchitectService.ts','utf8');
const checks=[
['core ingress imported',server.includes('coreTaskIngressService')],
['decision endpoint present',server.includes("/api/self-code/request-write-decision")],
['decision uses core ingress',server.includes('await coreTaskIngressService.submit')],
['decision requires completion',server.includes("result.task.status !== 'COMPLETED'")],
['receipt bound to hash and evidence',server.includes('receipt.artifactSha256 !== artifactSha256.toLowerCase()')&&server.includes('receipt.verificationEvidenceId !== verificationEvidenceId')],
['receipt expires',server.includes('receipt.expiresAt < Date.now()')],
['receipt single use',server.includes('receipt.consumed')&&server.includes('receipt.consumed = true')],
['dry run emits evidence',server.includes('verificationEvidenceId = valid ?')&&server.includes("createHash('sha256')")],
['client requests decision before write',client.indexOf('/api/self-code/request-write-decision')>0&&client.indexOf('/api/self-code/request-write-decision')<client.indexOf('/api/self-code/write-module')],
['client sends decision id',client.includes('coreDecisionId,')],
]; let failed=0; for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)failed++;} process.exitCode=failed?1:0;
