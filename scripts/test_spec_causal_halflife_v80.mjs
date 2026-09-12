import fs from 'fs';
import path from 'path';
const root = path.resolve(process.cwd());
const files = [
  'src/services/specContractCompilerService.ts',
  'src/services/causalMemoryLedgerService.ts',
  'src/services/knowledgeHalfLifeService.ts',
  'server.ts',
  'src/services/backgroundWorkerService.ts',
];
let ok=0;
for(const f of files){ if(fs.existsSync(path.join(root,f))){console.log('PASS',f);ok++;}else console.log('FAIL',f);}
const checks=[
 ['spec endpoint',fs.readFileSync(path.join(root,'server.ts'),'utf8').includes('/api/miki/spec-contract')],
 ['causal endpoint',fs.readFileSync(path.join(root,'server.ts'),'utf8').includes('/api/miki/causal-memory')],
 ['half-life endpoint',fs.readFileSync(path.join(root,'server.ts'),'utf8').includes('/api/miki/knowledge-half-life')],
 ['background integration',fs.readFileSync(path.join(root,'src/services/backgroundWorkerService.ts'),'utf8').includes('Step 6.12.10')],
 ['non-llm boundary retained',fs.readFileSync(path.join(root,'src/services/specContractCompilerService.ts'),'utf8').includes('生成モデルには依存しない')],
];
for(const [n,v] of checks){if(v){console.log('PASS',n);ok++;}else console.log('FAIL',n)}
console.log(`${ok}/${files.length+checks.length} PASS`);
process.exit(ok===files.length+checks.length?0:1);
