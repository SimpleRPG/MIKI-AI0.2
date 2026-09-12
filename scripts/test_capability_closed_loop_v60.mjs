import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'src');
const files = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(ent.name)) files.push(p);
  }
}
walk(root);

const evolution = fs.readFileSync(path.join(root, 'services/deterministicCapabilityEvolutionService.ts'), 'utf8');
const orchestrator = fs.readFileSync(path.join(root, 'services/taskExecutionOrchestratorService.ts'), 'utf8');

const required = [
  'compileExecutionEvidence',
  'taskCaseMemoryService.recordSuccess',
  'evidenceEventId',
  'implementationHashes',
];
for (const token of required) {
  if (!evolution.includes(token) && !orchestrator.includes(token)) {
    throw new Error(`missing closed-loop token: ${token}`);
  }
}
if (!orchestrator.includes("run.status !== 'COMPLETED'")) {
  throw new Error('intermediate execution evidence must not be learned as final success');
}
const forbidden = [
  'callLocalLlmChat', 'nativeLlmService', 'webLlmService',
  'LOCAL_LLM_ENDPOINT', '@mlc-ai/web-llm'
];
for (const token of forbidden) {
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes(token)) throw new Error(`forbidden runtime token found: ${token} in ${path.relative(process.cwd(), file)}`);
  }
}
console.log(`PASS: v60 execution-evidence -> task-case -> capability loop verified across ${files.length} executable source files.`);
