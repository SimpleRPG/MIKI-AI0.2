import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const checks=[];
const assert=(name,ok,detail='')=>{checks.push({name,ok,detail});if(!ok)process.exitCode=1;};
const app=read('src/App.tsx');
const companion=read('src/utils/companionEngine.ts');
const coreIngress=read('src/miki/core/services/coreTaskIngressService.ts');
const coreOrchestrator=read('src/miki/core/services/coreOrchestratorService.ts');
assert('App has no GGUF auto-load call',!app.includes('autoLoadDownloadedModelIfAvailable'));
assert('App has no retired local model load call',!app.includes('deterministicRuntimeService.loadModel('));
assert('App declares local generative runtime disabled',app.includes('localGenerativeRuntime: false'));
assert('Companion does not recommend local LLM settings',!companion.includes('端末ローカルLLM設定'));
assert('Core ingress delegates to core orchestrator',coreIngress.includes('coreOrchestratorService.run('));
assert('Core orchestrator owns blackboard reads',coreOrchestrator.includes('taskBlackboardService.get('));
for(const c of checks)console.log(`${c.ok?'PASS':'FAIL'} ${c.name}${c.detail?`: ${c.detail}`:''}`);
if(process.exitCode)throw new Error('RUNTIME_CONVERGENCE_V30_FAILED');
