import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDirs = ['src', 'server.ts'];
const forbidden = [
  /nativeLlmService/i,
  /webLlmService/i,
  /callLocalLlmChat/i,
  /LOCAL_LLM_ENDPOINT/i,
  /new\s+Worker\([^)]*(?:llama|webllm|gguf)/i,
  /from\s+['"][^'"]*(?:@mlc-ai\/web-llm|ggufModels)/i,
  /Qwen2\.5-Coder-[^'"`\s]+/i,
  /Llama[- ]3\.2/i,
  /ollama[^\n]{0,80}11434/i,
];

const files = [];
function walk(p) {
  if (!fs.existsSync(p)) return;
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(p)) walk(path.join(p, name));
  } else if (/\.(ts|tsx|js|mjs)$/.test(p) || path.basename(p) === 'server.ts') files.push(p);
}
for (const dir of sourceDirs) walk(path.join(root, dir));

const failures = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(text)) failures.push(`${path.relative(root, file)} :: ${pattern}`);
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageText = JSON.stringify(pkg);
if (/@mlc-ai\/web-llm|llama-cpp|ollama/.test(packageText)) failures.push('package.json :: retired local generative dependency');

if (failures.length) {
  console.error('FAIL: local generative runtime boundary violations detected.');
  for (const f of failures) console.error(f);
  process.exit(1);
}

console.log(`PASS: v55 local generative runtime boundary verified across ${files.length} executable source files.`);
