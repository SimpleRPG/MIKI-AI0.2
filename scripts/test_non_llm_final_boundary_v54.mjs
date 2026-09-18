/**
 * v54: Non-LLM final boundary regression.
 * This gate checks executable source for reactivation paths rather than
 * merely checking configuration strings.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDirs = [path.join(root, 'src'), path.join(root, 'server.ts')];

function filesOf(input) {
  if (!fs.existsSync(input)) return [];
  const stat = fs.statSync(input);
  if (stat.isFile()) return [input];
  const out = [];
  for (const name of fs.readdirSync(input)) {
    const full = path.join(input, name);
    if (fs.statSync(full).isDirectory()) out.push(...filesOf(full));
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(name)) out.push(full);
  }
  return out;
}

const files = sourceDirs.flatMap(filesOf);
const forbiddenExecutable = [
  /LOCAL_LLM_ENDPOINT/,
  /callLocalLlmChat/,
  /streamNativeChat/,
  /streamExternalLocalLlm/,
  /from ['"].*nativeLlmService/,
  /from ['"].*webLlmService/,
  /['"]LOCAL_LLM['"]/,
  /mode:\s*['"]HYBRID['"]/,
];
const failures = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const rule of forbiddenExecutable) {
    if (rule.test(text)) failures.push(`${path.relative(root, file)} matches ${rule}`);
  }
}

if (failures.length) {
  console.error('FAIL: local generative execution boundary was reintroduced.');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`PASS: v54 deterministic Non-LLM execution boundary verified across ${files.length} source files.`);
