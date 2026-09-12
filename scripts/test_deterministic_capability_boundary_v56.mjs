import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoots = ['src/services', 'src/utils', 'src/components'];
const forbidden = [
  'callLocalLlmChat', 'streamNativeChat', 'streamExternalLocalLlm',
  'LOCAL_LLM_ENDPOINT', '@mlc-ai/web-llm', 'llama-server', 'llama-swap',
  'generateColabTrainingScript', 'Unsloth', 'PEFT', 'Q4_K_M',
];

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const files = sourceRoots.flatMap((r) => walk(path.join(root, r)));
const hits = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const term of forbidden) {
    if (text.includes(term)) hits.push(`${path.relative(root, file)} :: ${term}`);
  }
}
if (hits.length) {
  console.error('FAIL: retired generative-runtime/training boundary re-entered');
  console.error(hits.join('\n'));
  process.exit(1);
}

const evolution = fs.readFileSync(path.join(root, 'src/services/deterministicCapabilityEvolutionService.ts'), 'utf8');
for (const required of ['compileVerifiedSample', 'recordFailure', 'recordSuccess', 'capabilityGapService', 'answerPlanService']) {
  if (!evolution.includes(required)) {
    console.error(`FAIL: deterministic capability evolution missing ${required}`);
    process.exit(1);
  }
}

const context = fs.readFileSync(path.join(root, 'src/services/contextBudgetEngineService.ts'), 'utf8');
for (const forbiddenContext of ['nCtx', 'modelParamB', 'Qwen', 'Llama', 'KV-cache']) {
  if (context.includes(forbiddenContext)) {
    console.error(`FAIL: structural budget still depends on ${forbiddenContext}`);
    process.exit(1);
  }
}

console.log(`PASS: v56 deterministic capability evolution boundary verified across ${files.length} executable source files.`);
