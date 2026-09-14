import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.cwd());
const files = [
  'miki/promotion/services/verifiedKnowledgePromotionService.ts',
  'miki/safety/services/nonLlmCoreService.ts',
  'miki/capabilityGraphService.ts',
  'server.ts',
];
for (const f of files) if (!fs.existsSync(path.join(root,f))) throw new Error(`missing ${f}`);
const service = fs.readFileSync(path.join(root,'miki/promotion/services/verifiedKnowledgePromotionService.ts'),'utf8');
for (const bad of ['eval(', 'new Function', 'Math.random(']) if (service.includes(bad)) throw new Error(`forbidden dynamic construct: ${bad}`);
const core = fs.readFileSync(path.join(root,'miki/safety/services/nonLlmCoreService.ts'),'utf8');
if (!core.includes('verifiedKnowledgePromotionService.promote')) throw new Error('research promotion not wired');
const graph = fs.readFileSync(path.join(root,'miki/capabilityGraphService.ts'),'utf8');
if (!graph.includes('rankCapabilityKnowledge')) throw new Error('graph knowledge boost not wired');
const server = fs.readFileSync(path.join(root,'server.ts'),'utf8');
if (!server.includes('/api/miki/verified-knowledge')) throw new Error('API not wired');
console.log('PASS verified knowledge promotion v68');
