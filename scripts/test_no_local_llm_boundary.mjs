import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const server = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'stable_env_manifest.txt'), 'utf8');

const runtimeOnlyServer = server.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const forbiddenRuntimePatterns = [
  /fetch\([^\n]*LOCAL_LLM_ENDPOINT/i,
  /callLocalLlmChat\s*\(/,
  /streamNativeChat\s*\(/,
  /streamExternalLocalLlm\s*\(/,
  /llama-server/i,
  /llama-swap/i,
];

const failures = forbiddenRuntimePatterns
  .filter((re) => re.test(runtimeOnlyServer))
  .map((re) => re.toString());

if (!/local_llm=removed/.test(manifest) || !/llama_server=removed/.test(manifest)) {
  failures.push('stable_env_manifest does not declare local runtime removal');
}

if (failures.length) {
  console.error('FAIL: local LLM boundary violation');
  failures.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
}

if (!/generationMethod: 'non_llm_only'/.test(server) || !/status\(409\)/.test(server)) {
  console.error('FAIL: autonomous implementation must block missing non-LLM capability');
  process.exit(1);
}

console.log('PASS: server local-LLM runtime boundary is removed and missing capabilities are blocked.');
