import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const checks = [];
const check = (name, ok) => checks.push({ name, passed: Boolean(ok) });

const completion = read('src/miki/verification/services/completionJudgeService.ts');
const virtualTraining = read('src/miki/learning/services/virtualTrainingService.ts');
const chatPanel = read('src/components/ChatPanel.tsx');
const storage = read('src/services/storageService.ts');
const types = read('src/types.ts');

check('completion defaults fail-closed', completion.includes("let status: CompletionStatus = 'PARTIAL'"));
check('manual completion requires artifact hash', completion.includes('artifactHash: string'));
check('manual completion requires verification evidence', completion.includes('verificationEvidenceId: string'));
check('manual completion requires correlation id', completion.includes('correlationId: string'));
check('proofless UI completion removed', !chatPanel.includes('completionJudgeService.markAsCompleted('));
check('completion proof retained in result type', types.includes('completionProof?:'));
check('fixed same-problem pass removed', !virtualTraining.includes('step3_sameProblemRetestPassed = true'));
check('fixed cross-domain pass removed', !virtualTraining.includes('step5_crossDomainRetestPassed = true'));
check('fixed regression pass removed', !virtualTraining.includes('step6_regressionCheckPassed = true'));
check('virtual training requires observed evidence', virtualTraining.includes('observedEvidence?:'));
check('virtual training id has no random', !virtualTraining.includes('Math.random()'));
check('memory structured sync has no full-table memory delete', !storage.includes(`DELETE FROM ${'${this.MEMORIES_STORE}'};`));
check('memory fts sync has no full-table delete', !storage.includes('DELETE FROM memories_fts;'));
check('memory sync compares record payload', storage.includes('existingById.get(mem.id) === jsonPayload'));

const failed = checks.filter((item) => !item.passed);
const report = { version: 35, checks, passed: failed.length === 0, failed };
fs.writeFileSync(path.join(root, 'CONNECTION_COMPLETION_MEMORY_AUDIT_V35.json'), JSON.stringify(report, null, 2));
for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.name}`);
if (failed.length > 0) process.exit(1);
