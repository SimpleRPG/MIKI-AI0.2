import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const forbidden = [
  'LOCAL_LLM_ENDPOINT', '@mlc-ai/web-llm', 'nativeLlmService', 'webLlmService',
  'llama-server', 'llama-swap', 'Ollama', 'LM Studio', 'streamNativeChat', 'streamExternalLocalLlm'
];
const targets = [
  'server.ts', 'package.json', 'src/types.ts', 'src/App.tsx',
  'src/services', 'src/components'
];
let failed = false;
for (const target of targets) {
  const full = path.join(root, target);
  const files = fs.existsSync(full) && fs.statSync(full).isDirectory()
    ? fs.readdirSync(full, { recursive: true }).filter(x => typeof x === 'string').map(x => path.join(full, x)).filter(x => fs.existsSync(x) && fs.statSync(x).isFile())
    : [full];
  for (const file of files) {
    if (!/\.(ts|tsx|js|mjs|json)$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const token of forbidden) {
      if (text.includes(token)) {
        console.error(`FORBIDDEN ${token}: ${path.relative(root, file)}`);
        failed = true;
      }
    }
  }
}
for (const file of ['src/services/nativeLlmService.ts','src/services/webLlmService.ts','src/services/ggufModels.ts']) {
  if (fs.existsSync(path.join(root, file))) {
    console.error(`RETIRED FILE STILL EXISTS: ${file}`); failed = true;
  }
}
if (!fs.existsSync(path.join(root, 'src/services/nonLlmRuntimeService.ts'))) {
  console.error('Missing deterministic runtime adapter'); failed = true;
}
if (failed) process.exit(1);
console.log('PASS: local generative runtime boundary is removed from executable source.');
